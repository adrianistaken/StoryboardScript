import { describe, expect, it } from 'vitest'
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'
import { exportBackup, importBackup, validateManifest } from '../../src/services/backup'
import { createDocument } from '../../src/utils'

const doc = () =>
  createDocument({
    title: 'A different script',
    sourceFilename: 'new.pdf',
    sections: [
      { title: 'Opening', text: 'A line.\n\n[Keep this cue]' },
      { title: 'Empty', text: '' },
    ],
  })
const manifest = () => ({ format: 'storyboard-script', version: 1, ...doc() })

describe('portable project backups', () => {
  it('round trips narration, empty sections, settings, and order with fresh IDs', async () => {
    const original = doc()
    original.project.narrationWpm = 175
    original.project.sectionOrder.reverse()
    const imported = await importBackup(await exportBackup(original))
    expect(imported.project.id).not.toBe(original.project.id)
    expect(imported.project.narrationWpm).toBe(175)
    expect(imported.sections.map((s) => s.text)).toEqual(original.sections.map((s) => s.text))
    expect(imported.project.sectionOrder[0]).toBe(imported.sections[1]?.id)
  })
  it('rejects future versions, duplicate order entries, and cross-project ownership', () => {
    expect(() => validateManifest({ ...manifest(), version: 900 })).toThrow('unsupported')
    const duplicate = manifest()
    duplicate.project.sectionOrder[1] = duplicate.project.sectionOrder[0]!
    expect(() => validateManifest(duplicate)).toThrow('inconsistent')
    const mixed = manifest()
    mixed.sections[0]!.projectId = 'wrong'
    expect(() => validateManifest(mixed)).toThrow('ownership')
  })
  it('rejects unsafe image paths and dangling image references', () => {
    const bad = manifest()
    expect(() =>
      validateManifest({
        ...bad,
        images: [
          {
            id: 'x',
            projectId: bad.project.id,
            sectionId: bad.sections[0]!.id,
            filename: 'x.png',
            mimeType: 'image/png',
            path: '../x.png',
          },
        ],
      }),
    ).toThrow('unsafe')
    bad.sections[0]!.imageIds.push('missing')
    expect(() => validateManifest(bad)).toThrow('missing')
  })
  it('rejects incomplete, malformed, and extraneous archive contents', async () => {
    const writer = new ZipWriter(new BlobWriter(), { useWebWorkers: false })
    await writer.add('project.json', new TextReader(JSON.stringify(manifest())))
    await writer.add('unexpected.txt', new TextReader('unexpected'))
    await expect(importBackup(await writer.close())).rejects.toThrow('unexpected')
    await expect(importBackup(new Blob(['not a zip']))).rejects.toThrow('could not be opened')
    const invalid = new ZipWriter(new BlobWriter(), { useWebWorkers: false })
    await invalid.add('project.json', new TextReader('{ broken'))
    await expect(importBackup(await invalid.close())).rejects.toThrow('not valid JSON')
  })
})
