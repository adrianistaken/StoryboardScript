import type { Project, ProjectDocument } from '../types'
import { accountUser, supabase } from './auth'
import { limits } from '../utils'
import { validateImage } from './media'

const bucket = 'storyboard-images'
const conflict = () =>
  new Error(
    'This script changed on another device. Export a project backup to keep your edits, then reopen the script to load the latest version.',
  )

// Each editor owns its revision: another tab/device must never silently overwrite it.
export function cloudRepository(owner: string) {
  const revisions = new Map<string, string>()
  const uploaded = new Set<string>()
  function client() {
    if (!supabase || accountUser.value?.id !== owner)
      throw new Error(
        'Sign in to the same account again to save this script. Export a backup to keep your current edits.',
      )
    return supabase
  }
  const imagePath = (projectId: string, imageId: string) => `${owner}/${projectId}/${imageId}`
  const repo = {
    async list(): Promise<Project[]> {
      const { data, error } = await client()
        .from('storyboard_projects')
        .select('id, metadata, revision')
        .eq('owner_id', owner)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((row) => {
        revisions.set(row.id, row.revision)
        return row.metadata as Project
      })
    },
    async load(id: string): Promise<ProjectDocument | undefined> {
      const api = client()
      const { data, error } = await api
        .from('storyboard_projects')
        .select('manifest, revision')
        .eq('owner_id', owner)
        .eq('id', id)
        .maybeSingle()
      if (error) throw error
      if (!data) return
      const { validateManifest } = await import('./backup')
      const manifest = validateManifest(data.manifest)
      if (manifest.project.id !== id)
        throw new Error('The saved script has an inconsistent identifier.')
      const images: ProjectDocument['images'] = []
      let totalBytes = 0
      for (const meta of manifest.images) {
        const { data: blob, error: imageError } = await client()
          .storage.from(bucket)
          .download(imagePath(id, meta.id))
        if (imageError) throw imageError
        totalBytes += blob.size
        if (totalBytes > limits.expandedBytes - limits.manifestBytes)
          throw new Error('The saved images exceed the project size limit.')
        if ((await validateImage(blob)) !== meta.mimeType)
          throw new Error('A saved reference image is damaged.')
        const { path: _path, ...image } = meta
        images.push({ ...image, blob })
        uploaded.add(imagePath(id, meta.id))
      }
      client()
      revisions.set(id, data.revision)
      return { project: manifest.project, sections: manifest.sections, images }
    },
    async save(doc: ProjectDocument) {
      const api = client()
      const { projectManifest } = await import('./backup')
      const manifest = projectManifest(doc)
      if (
        new TextEncoder().encode(JSON.stringify(manifest)).length > limits.manifestBytes ||
        doc.images.reduce((n, i) => n + i.blob.size, 0) >
          limits.expandedBytes - limits.manifestBytes
      )
        throw new Error(
          'This project is too large to sync. Remove some reference images and try again.',
        )
      for (const image of doc.images) {
        const path = imagePath(doc.project.id, image.id)
        if (uploaded.has(path)) continue
        const { error } = await client()
          .storage.from(bucket)
          .upload(path, image.blob, { contentType: image.mimeType, upsert: false })
        // IDs are immutable. A duplicate can result from a previous upload whose response was lost.
        if (error && !('statusCode' in error && String(error.statusCode) === '409')) throw error
        uploaded.add(path)
      }
      client()
      const previous = revisions.get(doc.project.id)
      const revision = crypto.randomUUID()
      const row = {
        id: doc.project.id,
        owner_id: owner,
        metadata: doc.project,
        manifest,
        revision,
        updated_at: doc.project.updatedAt,
      }
      const query = previous
        ? api
            .from('storyboard_projects')
            .update(row)
            .eq('owner_id', owner)
            .eq('id', doc.project.id)
            .eq('revision', previous)
        : api.from('storyboard_projects').insert(row)
      const { data, error } = await query.select('revision').maybeSingle()
      if (error?.code === '23505' || (!error && !data)) throw conflict()
      if (error) throw error
      revisions.set(doc.project.id, revision)
    },
    async rename(id: string, title: string) {
      const doc = await repo.load(id)
      if (!doc) throw new Error('This script was deleted on another device.')
      doc.project.title = title.trim() || 'Untitled script'
      doc.project.updatedAt = new Date().toISOString()
      await repo.save(doc)
    },
    async delete(id: string) {
      const api = client()
      const previous = revisions.get(id)
      if (!previous) throw new Error('Refresh your scripts before deleting this project.')
      const { data, error } = await api
        .from('storyboard_projects')
        .delete()
        .eq('owner_id', owner)
        .eq('id', id)
        .eq('revision', previous)
        .select('id')
      if (error) throw error
      if (!data?.length) throw conflict()
      revisions.delete(id)
      // Keep removed references during editing for undo; remove all of them with the project.
      for (;;) {
        const { data: files, error: listError } = await client()
          .storage.from(bucket)
          .list(`${owner}/${id}`, { limit: 100 })
        if (listError)
          throw new Error(
            'The script was deleted, but its image cleanup failed. Contact the site owner to remove leftover files.',
          )
        if (!files.length) break
        const { error: removeError } = await client()
          .storage.from(bucket)
          .remove(files.map((file) => imagePath(id, file.name)))
        if (removeError)
          throw new Error(
            'The script was deleted, but its image cleanup failed. Contact the site owner to remove leftover files.',
          )
      }
    },
  }
  return repo
}
