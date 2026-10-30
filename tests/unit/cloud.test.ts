import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createDocument } from '../../src/utils'
import { projectManifest } from '../../src/services/backup'

const state = vi.hoisted(() => ({ user: { value: { id: 'owner-a' } }, fetch: vi.fn() }))
vi.mock('../../src/services/auth', async () => {
  const { createClient } = await import('@supabase/supabase-js')
  return {
    accountUser: state.user,
    supabase: createClient('https://example.supabase.co', 'public-test-key', {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: state.fetch },
    }),
  }
})
import { cloudRepository } from '../../src/services/cloud'

const doc = () =>
  createDocument({
    title: 'Story',
    sourceFilename: '',
    sections: [{ title: 'Opening', text: 'Original' }],
  })
const respond = (body: unknown, status = 200) =>
  state.fetch.mockResolvedValueOnce(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  )

beforeEach(() => {
  state.fetch.mockReset()
  state.user.value = { id: 'owner-a' }
})

describe('account project persistence', () => {
  it('creates a cloud document and sends a revision condition on subsequent saves', async () => {
    const store = cloudRepository('owner-a'),
      project = doc()
    project.sections[0]!.color = 'amber'
    respond({ revision: 'server' })
    await store.save(project)
    const first = JSON.parse(state.fetch.mock.calls[0]![1].body)
    expect(first.owner_id).toBe('owner-a')
    expect(first.manifest.sections[0].text).toBe('Original')
    expect(first.manifest.sections[0].color).toBe('amber')
    project.sections[0]!.text = 'Edited'
    respond({ revision: 'server-next' })
    await store.save(project)
    const request = state.fetch.mock.calls[1]!
    expect(request[1].method).toBe('PATCH')
    expect(String(request[0])).toContain(`revision=eq.${first.revision}`)
  })
  it('loads the same project on another device and refuses stale saves without advancing the revision', async () => {
    const project = doc(),
      store = cloudRepository('owner-a')
    respond({ manifest: projectManifest(project), revision: 'old-version' })
    const loaded = await store.load(project.project.id)
    expect(loaded).toEqual(project)
    loaded!.sections[0]!.text = 'My unsaved edit'
    respond(null)
    await expect(store.save(loaded!)).rejects.toThrow('changed on another device')
    respond(null)
    await expect(store.save(loaded!)).rejects.toThrow('changed on another device')
    expect(String(state.fetch.mock.calls[2]![0])).toContain('revision=eq.old-version')
    expect(loaded!.sections[0]!.text).toBe('My unsaved edit')
  })
  it('never falls back to local storage or another owner when the session changes', async () => {
    const store = cloudRepository('owner-a')
    state.user.value = { id: 'owner-b' }
    await expect(store.save(doc())).rejects.toThrow('same account')
    await expect(store.list()).rejects.toThrow('same account')
    await expect(store.load('project')).rejects.toThrow('same account')
    expect(state.fetch).not.toHaveBeenCalled()
  })
  it('surfaces failed uploads before publishing a project document', async () => {
    const project = doc(),
      section = project.sections[0]!
    section.imageIds = ['image-a']
    project.images = [
      {
        id: 'image-a',
        projectId: project.project.id,
        sectionId: section.id,
        filename: 'reference.png',
        mimeType: 'image/png',
        blob: new Blob(['test'], { type: 'image/png' }),
      },
    ]
    respond({ message: 'Upload denied', error: 'Unauthorized', statusCode: '403' }, 403)
    await expect(cloudRepository('owner-a').save(project)).rejects.toBeDefined()
    expect(state.fetch).toHaveBeenCalledTimes(1)
    expect(String(state.fetch.mock.calls[0]![0])).toContain(
      '/storage/v1/object/storyboard-images/owner-a/',
    )
  })
  it('reuses uploaded image blobs for text edits and undo instead of re-uploading them', async () => {
    const project = doc(),
      section = project.sections[0]!,
      store = cloudRepository('owner-a')
    section.imageIds = ['image-a']
    project.images = [
      {
        id: 'image-a',
        projectId: project.project.id,
        sectionId: section.id,
        filename: 'reference.png',
        mimeType: 'image/png',
        blob: new Blob(['test'], { type: 'image/png' }),
      },
    ]
    respond({ Key: 'image-a' })
    respond({ revision: 'first' })
    await store.save(project)
    project.sections[0]!.text = 'Updated'
    respond({ revision: 'second' })
    await store.save(project)
    expect(
      state.fetch.mock.calls.filter((call) => String(call[0]).includes('/storage/')),
    ).toHaveLength(1)
  })
  it('does not delete remote image files when deletion conflicts with a newer revision', async () => {
    const project = doc(),
      store = cloudRepository('owner-a')
    respond([{ id: project.project.id, metadata: project.project, revision: 'old-version' }])
    await store.list()
    respond([])
    await expect(store.delete(project.project.id)).rejects.toThrow('changed on another device')
    expect(state.fetch).toHaveBeenCalledTimes(2)
  })
})
