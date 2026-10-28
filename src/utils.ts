import { SCHEMA_VERSION, type ImportDraft, type ProjectDocument, type Section } from './types'

export const limits = {
  pdfBytes: 25 * 1024 * 1024,
  pdfPages: 500,
  textChars: 2_000_000,
  imageBytes: 10 * 1024 * 1024,
  imagePixels: 40_000_000,
  archiveBytes: 150 * 1024 * 1024,
  expandedBytes: 150 * 1024 * 1024,
  manifestBytes: 10 * 1024 * 1024,
  entries: 1001,
  sections: 500,
  images: 1000,
}
export function wordCount(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’ʼ-][\p{L}\p{N}]+)*/gu)?.length ?? 0
}
export function formatTime(seconds: number): string {
  const value = Math.max(0, Math.round(seconds))
  const hours = Math.floor(value / 3600)
  const minutes = Math.floor((value % 3600) / 60)
  const secs = String(value % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`
}
export function narrationTime(words: number, wpm: number): string {
  return formatTime((words / wpm) * 60)
}
export function filenameTitle(name: string): string {
  return name.replace(/\.pdf$/i, '').trim() || 'Untitled script'
}
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
export function safeFilename(title: string): string {
  return (
    title
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
      .trim()
      .slice(0, 100) || 'Script'
  )
}
export function orderedSections(doc: ProjectDocument): Section[] {
  const byId = new Map(doc.sections.map((s) => [s.id, s]))
  return doc.project.sectionOrder.map((id) => byId.get(id)).filter((s): s is Section => !!s)
}
export function moveSection(order: string[], id: string, offset: number): string[] {
  const next = [...order],
    from = next.indexOf(id),
    to = from + offset
  if (from < 0 || to < 0 || to >= next.length) return next
  next.splice(from, 1)
  next.splice(to, 0, id)
  return next
}
export function createDocument(
  draft: Pick<ImportDraft, 'title' | 'sourceFilename' | 'sections'>,
): ProjectDocument {
  const id = crypto.randomUUID(),
    now = new Date().toISOString()
  const sections = draft.sections.map((s) => ({
    ...s,
    id: crypto.randomUUID(),
    projectId: id,
    imageIds: [],
  }))
  return {
    project: {
      id,
      schemaVersion: SCHEMA_VERSION,
      title: draft.title || 'Untitled script',
      sourceFilename: draft.sourceFilename,
      narrationWpm: 150,
      sectionOrder: sections.map((s) => s.id),
      createdAt: now,
      updatedAt: now,
    },
    sections,
    images: [],
  }
}
export function cloneDocument(doc: ProjectDocument): ProjectDocument {
  return {
    project: { ...doc.project, sectionOrder: [...doc.project.sectionOrder] },
    sections: doc.sections.map((s) => ({ ...s, imageIds: [...s.imageIds] })),
    images: doc.images.map((i) => ({ ...i })),
  }
}
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (/quota/i.test(error.name + error.message))
      return 'This browser is running out of storage. Export a backup, then remove projects or images you no longer need.'
    if (/denied|security|invalidstate|databaseclosed/i.test(error.name))
      return 'Browser storage is unavailable. Allow site storage or use a regular browser window. Keep this page open and export your changes.'
    return error.message
  }
  return 'Something went wrong. Try again; your existing projects have not been replaced.'
}
