import 'fake-indexeddb/auto'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { repository, StoryboardDatabase } from '../../src/services/storage'
import { createDocument } from '../../src/utils'

let db: StoryboardDatabase
beforeEach(() => {
  db = new StoryboardDatabase(`test-${crypto.randomUUID()}`)
})
afterEach(async () => {
  await db.delete()
})
const make = () =>
  createDocument({
    title: 'Original film',
    sourceFilename: 'film.pdf',
    sections: [
      { title: 'First', text: 'Narration.' },
      { title: 'Second', text: 'More narration.' },
    ],
  })
it('restores edits, settings, order, and associated image blobs', async () => {
  const repo = repository(db),
    doc = make()
  const mediaId = crypto.randomUUID()
  doc.images.push({
    id: mediaId,
    sectionId: doc.sections[0]!.id,
    projectId: doc.project.id,
    filename: 'ref.png',
    mimeType: 'image/png',
    blob: new Blob(['image-content']),
  })
  doc.sections[0]!.imageIds.push(mediaId)
  await repo.save(doc)
  doc.sections[0]!.text = 'Changed\n\nwith paragraphs.'
  doc.project.narrationWpm = 180
  doc.project.sectionOrder.reverse()
  await repo.save(doc)
  db.close()
  await db.open()
  const restored = await repo.load(doc.project.id)
  expect(restored?.project.sectionOrder).toEqual(doc.project.sectionOrder)
  expect(restored?.project.narrationWpm).toBe(180)
  expect(restored?.sections.find((s) => s.id === doc.sections[0]!.id)?.text).toBe(
    'Changed\n\nwith paragraphs.',
  )
  expect(await restored?.images[0]?.blob.text()).toBe('image-content')
})
it('deletes a project and its children without affecting other projects', async () => {
  const repo = repository(db),
    a = make(),
    b = make()
  await repo.save(a)
  await repo.save(b)
  await repo.delete(a.project.id)
  expect(await repo.load(a.project.id)).toBeUndefined()
  expect(await db.sections.where('projectId').equals(a.project.id).count()).toBe(0)
  expect(await repo.load(b.project.id)).toBeDefined()
})
it('rolls back a failed update without losing the saved version', async () => {
  const repo = repository(db),
    doc = make()
  await repo.save(doc)
  db.sections.hook('creating', () => {
    throw new DOMException('Storage full', 'QuotaExceededError')
  })
  doc.project.title = 'Unsaved change'
  doc.sections[0]!.text = 'Unsaved narration'
  await expect(repo.save(doc)).rejects.toThrow('Storage full')
  const restored = await repo.load(doc.project.id)
  expect(restored?.project.title).toBe('Original film')
  expect(restored?.sections.find((s) => s.id === doc.sections[0]!.id)?.text).toBe('Narration.')
})
