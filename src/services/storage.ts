import Dexie, { type Table } from 'dexie'
import type { Project, Section, ReferenceImage, ProjectDocument } from '../types'

export class StoryboardDatabase extends Dexie {
  projects!: Table<Project, string>
  sections!: Table<Section, string>
  images!: Table<ReferenceImage, string>
  constructor(name = 'storyboard-script') {
    super(name)
    this.version(1).stores({
      projects: 'id, updatedAt',
      sections: 'id, projectId',
      images: 'id, projectId, sectionId',
    })
  }
}
export const db = new StoryboardDatabase()

export function repository(database = db) {
  return {
    list: () => database.projects.orderBy('updatedAt').reverse().toArray(),
    async load(id: string): Promise<ProjectDocument | undefined> {
      return database.transaction(
        'r',
        database.projects,
        database.sections,
        database.images,
        async () => {
          const project = await database.projects.get(id)
          if (!project) return undefined
          return {
            project,
            sections: await database.sections.where('projectId').equals(id).toArray(),
            images: await database.images.where('projectId').equals(id).toArray(),
          }
        },
      )
    },
    async save(doc: ProjectDocument): Promise<void> {
      await database.transaction(
        'rw',
        database.projects,
        database.sections,
        database.images,
        async () => {
          await database.projects.put(doc.project)
          await database.sections.where('projectId').equals(doc.project.id).delete()
          await database.sections.bulkPut(doc.sections)
          const existing = await database.images
            .where('projectId')
            .equals(doc.project.id)
            .primaryKeys()
          const incoming = new Set(doc.images.map((i) => i.id))
          await database.images.bulkDelete(existing.filter((id) => !incoming.has(id)))
          const present = new Set(existing)
          const added = doc.images.filter((i) => !present.has(i.id))
          if (added.length) await database.images.bulkPut(added)
        },
      )
    },
    async rename(id: string, title: string): Promise<void> {
      await database.projects.update(id, {
        title: title.trim() || 'Untitled script',
        updatedAt: new Date().toISOString(),
      })
    },
    async delete(id: string): Promise<void> {
      await database.transaction(
        'rw',
        database.projects,
        database.sections,
        database.images,
        async () => {
          await database.images.where('projectId').equals(id).delete()
          await database.sections.where('projectId').equals(id).delete()
          await database.projects.delete(id)
        },
      )
    },
  }
}
export const projects = repository()
