import { describe, expect, it } from 'vitest'
import { duplicateDocument, formatTime, moveSection, narrationTime, wordCount } from '../../src/utils'
import { inspectImage, validateImage } from '../../src/services/media'

describe('script statistics and ordering', () => {
  it('duplicates a project with independent section and image identifiers', () => {
    const blob = new Blob(['image'])
    const original = {
      project: { id: 'project', schemaVersion: 1, title: 'Story', narrationWpm: 150, sectionOrder: ['section'], createdAt: 'old', updatedAt: 'old' },
      sections: [{ id: 'section', projectId: 'project', title: 'Opening', text: 'Hello', imageIds: ['image'] }],
      images: [{ id: 'image', projectId: 'project', sectionId: 'section', filename: 'image.png', mimeType: 'image/png', blob }],
    }
    const copy = duplicateDocument(original)
    expect(copy.project.title).toBe('Story (copy)')
    expect(copy.project.id).not.toBe(original.project.id)
    expect(copy.project.sectionOrder).toEqual([copy.sections[0]!.id])
    expect(copy.sections[0]!.projectId).toBe(copy.project.id)
    expect(copy.sections[0]!.imageIds).toEqual([copy.images[0]!.id])
    expect(copy.images[0]!.projectId).toBe(copy.project.id)
    expect(copy.images[0]!.sectionId).toBe(copy.sections[0]!.id)
    expect(copy.images[0]!.blob).toBe(blob)
    copy.sections[0]!.text = 'Changed'
    expect(original.sections[0]!.text).toBe('Hello')
  })
  it('counts narration and production cues consistently', () => {
    expect(wordCount('Weʼre here.\n\n[Show the €750 prize]')).toBe(6)
    expect(wordCount(' \n\t')).toBe(0)
  })
  it('formats timing and recomputes it at different reading speeds', () => {
    expect(narrationTime(300, 150)).toBe('2:00')
    expect(narrationTime(300, 100)).toBe('3:00')
    expect(formatTime(3723)).toBe('1:02:03')
    expect(formatTime(59.8)).toBe('1:00')
  })
  it('moves IDs without mutating input or losing sections at boundaries', () => {
    const order = ['a', 'b', 'c']
    expect(moveSection(order, 'a', 1)).toEqual(['b', 'a', 'c'])
    expect(moveSection(order, 'a', -1)).toEqual(order)
    expect(moveSection(order, 'c', 1)).toEqual(order)
    expect(moveSection(order, 'missing', 1)).toEqual(order)
    expect(order).toEqual(['a', 'b', 'c'])
  })
})

describe('image validation', () => {
  it('rejects a file with a misleading image extension', () => {
    expect(() => inspectImage(new TextEncoder().encode('<svg>not supported</svg>'))).toThrow(
      'valid PNG',
    )
  })
  it('rejects a compressed image with excessive dimensions before decoding', async () => {
    const bytes = new Uint8Array(24)
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10])
    bytes.set([73, 72, 68, 82], 12)
    const view = new DataView(bytes.buffer)
    view.setUint32(16, 30000)
    view.setUint32(20, 30000)
    await expect(validateImage(new Blob([bytes]), false)).rejects.toThrow('40 million')
  })
})
