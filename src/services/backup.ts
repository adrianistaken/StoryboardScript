import {
  BlobReader,
  BlobWriter,
  TextReader,
  ZipReader,
  ZipWriter,
  type FileEntry,
} from '@zip.js/zip.js'
import { SCHEMA_VERSION, type ProjectDocument, type Project, type Section, type SectionColor } from '../types'
import { limits } from '../utils'
import { validateImage } from './media'

type ImageManifest = {
  id: string
  projectId: string
  sectionId: string
  filename: string
  mimeType: string
  path: string
}
type Manifest = {
  format: 'storyboard-script'
  version: number
  project: Project
  sections: Section[]
  images: ImageManifest[]
}
const extensions: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
}
const fail = (message: string): never => {
  throw new Error(`Invalid project backup: ${message}`)
}
const object = (x: unknown): Record<string, unknown> =>
  x !== null && typeof x === 'object' && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : fail('expected an object.')
const string = (x: unknown, max = 1000): string =>
  typeof x === 'string' && x.length <= max ? x : fail('invalid or oversized text field.')
const id = (x: unknown): string =>
  typeof x === 'string' && /^[\w-]{1,80}$/.test(x) ? x : fail('invalid identifier.')
const date = (x: unknown): string =>
  typeof x === 'string' && x.length < 40 && Number.isFinite(Date.parse(x))
    ? x
    : fail('invalid timestamp.')
const array = (x: unknown, max: number): unknown[] =>
  Array.isArray(x) && x.length <= max ? x : fail('invalid or oversized list.')
const unique = (values: string[]): boolean => new Set(values).size === values.length

export function validateManifest(input: unknown): Manifest {
  const data = object(input)
  if (data.format !== 'storyboard-script' || data.version !== SCHEMA_VERSION)
    fail(
      'unsupported format or version. Use a backup exported by this version of Storyboard Script.',
    )
  const p = object(data.project)
  if (p.schemaVersion !== SCHEMA_VERSION) fail('unsupported project version.')
  if (
    typeof p.narrationWpm !== 'number' ||
    !Number.isFinite(p.narrationWpm) ||
    p.narrationWpm < 100 ||
    p.narrationWpm > 220
  )
    fail('invalid narration speed.')
  const project: Project = {
    id: id(p.id),
    title: string(p.title),
    schemaVersion: SCHEMA_VERSION,
    narrationWpm: p.narrationWpm as number,
    sectionOrder: array(p.sectionOrder, limits.sections).map(id),
    createdAt: date(p.createdAt),
    updatedAt: date(p.updatedAt),
  }
  if (p.sourceFilename !== undefined) project.sourceFilename = string(p.sourceFilename)
  const sections = array(data.sections, limits.sections).map((value) => {
    const s = object(value)
    const section: Section = {
      id: id(s.id),
      projectId: id(s.projectId),
      title: string(s.title),
      text: string(s.text, limits.textChars),
      imageIds: array(s.imageIds, limits.images).map(id),
    }
    if (s.color !== undefined) {
      if (!['blue', 'amber', 'green', 'purple', 'rose'].includes(String(s.color)))
        fail('invalid section color.')
      section.color = s.color as SectionColor
    }
    return section
  })
  if (!sections.length || sections.reduce((n, s) => n + s.text.length, 0) > limits.textChars)
    fail('invalid script length.')
  if (
    !unique(sections.map((s) => s.id)) ||
    !unique(project.sectionOrder) ||
    project.sectionOrder.length !== sections.length ||
    sections.some((s) => s.projectId !== project.id || !project.sectionOrder.includes(s.id))
  )
    fail('section order or ownership is inconsistent.')
  const images = array(data.images, limits.images).map((value) => {
    const m = object(value)
    const result = {
      id: id(m.id),
      projectId: id(m.projectId),
      sectionId: id(m.sectionId),
      filename: string(m.filename),
      mimeType: string(m.mimeType),
      path: string(m.path),
    }
    const ext = extensions[result.mimeType]
    if (!ext || result.path !== `images/${result.id}.${ext}`)
      fail('unsupported image type or unsafe image path.')
    return result
  })
  const references = sections.flatMap((s) => s.imageIds)
  if (
    !unique(images.map((i) => i.id)) ||
    !unique(references) ||
    references.length !== images.length
  )
    fail('duplicate or missing images.')
  for (const image of images) {
    if (
      image.projectId !== project.id ||
      !sections.find((s) => s.id === image.sectionId)?.imageIds.includes(image.id)
    )
      fail('image ownership is inconsistent.')
  }
  return { format: 'storyboard-script', version: SCHEMA_VERSION, project, sections, images }
}

export function projectManifest(doc: ProjectDocument): Manifest {
  const manifest: Manifest = {
    format: 'storyboard-script',
    version: SCHEMA_VERSION,
    project: doc.project,
    sections: doc.sections,
    images: doc.images.map(({ blob: _blob, ...image }) => ({
      ...image,
      path: `images/${image.id}.${extensions[image.mimeType]}`,
    })),
  }
  return validateManifest(manifest)
}

export async function exportBackup(doc: ProjectDocument): Promise<Blob> {
  const manifest = projectManifest(doc)
  const json = JSON.stringify(manifest)
  const manifestSize = new TextEncoder().encode(json).length
  const total = doc.images.reduce((n, i) => n + i.blob.size, manifestSize)
  if (
    manifestSize > limits.manifestBytes ||
    total > limits.expandedBytes ||
    doc.images.some((i) => i.blob.size > limits.imageBytes)
  )
    throw new Error(
      'This project is too large for a supported backup. Remove some reference images and try again.',
    )
  const writer = new ZipWriter(new BlobWriter('application/zip'), { useWebWorkers: false })
  await writer.add('project.json', new TextReader(json))
  for (const entry of manifest.images) {
    await writer.add(entry.path, new BlobReader(doc.images.find((i) => i.id === entry.id)!.blob), {
      level: 0,
    })
  }
  const blob = await writer.close()
  if (blob.size > limits.archiveBytes)
    throw new Error('This backup is too large. Remove some reference images and try again.')
  return blob
}

export async function importBackup(file: Blob): Promise<ProjectDocument> {
  if (!file.size || file.size > limits.archiveBytes)
    throw new Error('Choose a project ZIP backup smaller than 150 MB.')
  const reader = new ZipReader(new BlobReader(file), {
    useWebWorkers: false,
    checkSignature: true,
    checkOverlappingEntry: true,
  })
  const entries = new Map<string, FileEntry>()
  let expanded = 0,
    readBytes = 0,
    entryCount = 0
  try {
    for await (const entry of reader.getEntriesGenerator()) {
      if (++entryCount > limits.entries) fail('too many archive entries.')
      if (entry.directory && entry.filename === 'images/') continue
      if (entry.directory || entry.encrypted || entry.symlink) fail('unsupported archive entry.')
      if (
        entries.has(entry.filename) ||
        !/^(project\.json|images\/[\w-]{1,80}\.(png|jpg|webp))$/.test(entry.filename)
      )
        fail('unexpected or duplicate archive path.')
      expanded += entry.uncompressedSize
      const max = entry.filename === 'project.json' ? limits.manifestBytes : limits.imageBytes
      if (entry.uncompressedSize > max || expanded > limits.expandedBytes)
        fail('expanded archive is too large.')
      if ('getData' in entry) entries.set(entry.filename, entry)
    }
    async function read(entry: FileEntry, type: string, max: number): Promise<Blob> {
      const chunks: Uint8Array<ArrayBuffer>[] = []
      let size = 0
      await entry.getData(
        new WritableStream<Uint8Array>({
          write(chunk) {
            size += chunk.length
            readBytes += chunk.length
            if (size > max || readBytes > limits.expandedBytes)
              fail('decompressed data exceeded the allowed size.')
            chunks.push(new Uint8Array(chunk))
          },
        }),
      )
      if (size !== entry.uncompressedSize) fail('archive entry size does not match its data.')
      return new Blob(chunks, { type })
    }
    const jsonEntry = entries.get('project.json')
    if (!jsonEntry) fail('project.json is missing.')
    let value: unknown
    try {
      value = JSON.parse(
        await (await read(jsonEntry!, 'application/json', limits.manifestBytes)).text(),
      )
    } catch (e) {
      if (e instanceof SyntaxError) fail('project.json is not valid JSON.')
      throw e
    }
    const manifest = validateManifest(value)
    if (entries.size !== manifest.images.length + 1)
      fail('archive files do not match the manifest.')
    const images: ProjectDocument['images'] = []
    for (const meta of manifest.images) {
      const entry = entries.get(meta.path)
      if (!entry) fail('an image file is missing.')
      const blob = await read(entry!, meta.mimeType, limits.imageBytes)
      if ((await validateImage(blob)) !== meta.mimeType)
        fail('image contents do not match their declared type.')
      const { path: _path, ...image } = meta
      images.push({ ...image, blob })
    }
    const projectId = crypto.randomUUID()
    const sectionIds = new Map(manifest.sections.map((s) => [s.id, crypto.randomUUID()]))
    const imageIds = new Map(images.map((i) => [i.id, crypto.randomUUID()]))
    return {
      project: {
        ...manifest.project,
        id: projectId,
        sectionOrder: manifest.project.sectionOrder.map((id) => sectionIds.get(id)!),
        updatedAt: new Date().toISOString(),
      },
      sections: manifest.sections.map((s) => ({
        ...s,
        id: sectionIds.get(s.id)!,
        projectId,
        imageIds: s.imageIds.map((id) => imageIds.get(id)!),
      })),
      images: images.map((i) => ({
        ...i,
        id: imageIds.get(i.id)!,
        projectId,
        sectionId: sectionIds.get(i.sectionId)!,
      })),
    }
  } catch (e) {
    if (e instanceof Error && /Invalid project backup|Choose a|This image/.test(e.message)) throw e
    throw new Error(
      'This backup could not be opened. Choose an undamaged ZIP exported from Storyboard Script.',
      { cause: e },
    )
  } finally {
    await reader.close()
  }
}
