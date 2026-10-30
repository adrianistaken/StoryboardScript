export const SCHEMA_VERSION = 1
export type Project = {
  id: string
  schemaVersion: number
  title: string
  sourceFilename?: string
  narrationWpm: number
  sectionOrder: string[]
  createdAt: string
  updatedAt: string
}

// Plain text preserves both intentional line breaks and blank paragraph lines.
export type Section = {
  id: string
  projectId: string
  title: string
  text: string
  imageIds: string[]
  color?: SectionColor
}
export type SectionColor = 'blue' | 'amber' | 'green' | 'purple' | 'rose'
export type ReferenceImage = {
  id: string
  projectId: string
  sectionId: string
  filename: string
  mimeType: string
  blob: Blob
}
export type ProjectDocument = { project: Project; sections: Section[]; images: ReferenceImage[] }
export type ImportDraft = {
  title: string
  sourceFilename: string
  sections: { title: string; text: string }[]
  excludedPreamble: string
  warnings: string[]
  pageCount: number
}
