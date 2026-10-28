import { describe, expect, it } from 'vitest'
import { bodyText, detectStructure, type TextLine } from '../../src/services/pdf/structure'

const line = (text: string, y: number, options: Partial<TextLine> = {}): TextLine => ({
  text,
  y,
  x: 60,
  width: 200,
  size: 12,
  page: 1,
  pageHeight: 792,
  bold: false,
  ...options,
})

describe('heading and paragraph reconstruction', () => {
  it.each(['H1', 'H2', 'H3'])(
    'recognizes %s section headings without relying on names or sizes',
    (role) => {
      const result = detectStructure(
        [
          line('A different film', 730, { size: 30, role: 'H1' }),
          line('Planning notes', 680),
          line('The unexpected beginning', 620, { role, size: 15 }),
          line('A short line.', 590, { role: 'P', block: 'a' }),
          line('Another line.', 566, { role: 'P', block: 'b' }),
          line('The turn', 500, { role, size: 15 }),
          line('Something changes.', 470),
        ],
        'unrelated-filename.pdf',
      )
      expect(result.title).toBe('A different film')
      expect(result.sections.map((s) => s.title)).toEqual(['The unexpected beginning', 'The turn'])
      expect(result.sections[0]?.text).toBe('A short line.\nAnother line.')
      expect(result.excludedPreamble).toContain('Planning notes')
    },
  )
  it('keeps the first H1 when H1 is the section style', () => {
    const result = detectStructure(
      [
        line('Cold open', 700, { role: 'H1', size: 22 }),
        line('Hello there.', 670),
        line('Resolution', 620, { role: 'H1', size: 22 }),
        line('Goodbye.', 590),
      ],
      'My story.pdf',
    )
    expect(result.title).toBe('My story')
    expect(result.sections.map((s) => s.title)).toEqual(['Cold open', 'Resolution'])
  })
  it('keeps a wrapped heading together without merging consecutive section headings', () => {
    const result = detectStructure(
      [
        line('An unusually long section heading', 720, { size: 16 }),
        line('continues on the next line', 698, { size: 16 }),
        line('The next empty section', 650, { size: 16 }),
        line('A final heading', 602, { size: 16 }),
        line('A substantial amount of narration makes up the body of this script.', 570),
        line('This sentence continues the story with some more words.', 546),
      ],
      'Headings.pdf',
    )
    expect(result.sections.map((s) => s.title)).toEqual([
      'An unusually long section heading continues on the next line',
      'The next empty section',
      'A final heading',
    ])
  })
  it('uses formatting when tags are absent, preserving empty headings and cross-page sections', () => {
    const result = detectStructure(
      [
        line('A tournament', 720, { size: 16 }),
        line('Opponent one', 690, { size: 16 }),
        line('A surprise.', 720, { page: 2 }),
        line('Opponent two', 650, { page: 2, size: 16 }),
        line('Another surprise.', 620, { page: 2 }),
      ],
      'A story.pdf',
    )
    expect(result.sections).toEqual([
      { title: 'A tournament', text: '' },
      { title: 'Opponent one', text: 'A surprise.' },
      { title: 'Opponent two', text: 'Another surprise.' },
    ])
  })
  it('keeps all text in a single section when headings are not recognizable', () => {
    const result = detectStructure(
      [line('This is a short sentence.', 700), line('This is not a heading either.', 670)],
      'No headings.pdf',
    )
    expect(result.sections).toHaveLength(1)
    expect(result.sections[0]?.text).toContain('This is a short sentence.')
    expect(result.sections[0]?.text).toContain('This is not a heading either.')
  })
  it('removes repeated footers without removing identical text inside the script', () => {
    const result = detectStructure(
      [
        line('Scene', 700, { role: 'H3', size: 15 }),
        line('My video', 670),
        line('My video', 20, { size: 7.5 }),
        line('1', 20, { size: 7.5, x: 560 }),
        line('Continues here.', 720, { page: 2 }),
        line('My video', 20, { page: 2, size: 7.5 }),
        line('2', 20, { page: 2, size: 7.5, x: 560 }),
      ],
      'My video.pdf',
    )
    expect(result.sections[0]?.text).toBe('My video Continues here.')
    expect(result.sections[0]?.text).not.toContain('\n1')
  })
  it('joins physical wraps in one tagged paragraph and keeps deliberate spacing', () => {
    const text = bodyText(
      [
        line('An intentionally long', 700, { block: 'a' }),
        line('sentence continues.', 682, { block: 'a' }),
        line('[A production cue]', 634, { block: 'b' }),
        line('A short line.', 610, { block: 'c' }),
      ],
      12,
    )
    expect(text).toBe(
      'An intentionally long sentence continues.\n\n[A production cue]\nA short line.',
    )
  })
})
