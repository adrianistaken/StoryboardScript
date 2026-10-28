import { filenameTitle } from '../../utils'
import type { ImportDraft } from '../../types'

export type TextLine = {
  text: string
  size: number
  bold: boolean
  page: number
  y: number
  x: number
  width: number
  pageHeight: number
  role?: string
  block?: string
}
const isHeadingTag = (role?: string) => /^H[1-6]$/.test(role ?? '')
const canonical = (text: string) => text.replace(/\s+/g, ' ').trim().toLocaleLowerCase()
const emojiOnly = (text: string) => /^[\p{Extended_Pictographic}\uFE0F\s]+$/u.test(text)

export function typicalBodySize(lines: TextLine[]): number {
  const sizes = new Map<number, number>()
  for (const line of lines) {
    if (line.y < line.pageHeight * 0.08 || isHeadingTag(line.role)) continue
    const size = Math.round(line.size * 2) / 2
    sizes.set(size, (sizes.get(size) ?? 0) + line.text.length)
  }
  const ranked = [...sizes].sort((a, b) => b[1] - a[1])
  const mode = ranked[0]
  if (!mode) return 12
  // In a short outline, headings can outnumber the narration. A substantial
  // smaller text style is better body evidence than that larger modal style.
  return (
    ranked.find(([size, weight]) => size <= mode[0] * 0.85 && weight >= mode[1] * 0.45)?.[0] ??
    mode[0]
  )
}

export function removePageFurniture(lines: TextLine[], bodySize: number): TextLine[] {
  const repetitions = new Map<string, Set<number>>()
  const nearMargin = (l: TextLine) => l.y < l.pageHeight * 0.07 || l.y > l.pageHeight * 0.95
  for (const line of lines.filter(nearMargin)) {
    const key = canonical(line.text).replace(/\d+/g, '#')
    if (!repetitions.has(key)) repetitions.set(key, new Set())
    repetitions.get(key)!.add(line.page)
  }
  return lines.filter((line) => {
    if (line.role === 'Artifact') return false
    if (!nearMargin(line) || line.size > bodySize * 0.9 || isHeadingTag(line.role)) return true
    const key = canonical(line.text).replace(/\d+/g, '#')
    return !(/^\d+$/.test(line.text.trim()) || (repetitions.get(key)?.size ?? 0) >= 2)
  })
}

export function bodyText(lines: TextLine[], bodySize: number): string {
  let text = ''
  const steps = lines
    .slice(1)
    .flatMap((l, i) => {
      const previous = lines[i]!
      const gap = previous.y - l.y
      return previous.page === l.page && gap > bodySize * 0.9 && gap < bodySize * 2.6 ? [gap] : []
    })
    .sort((a, b) => a - b)
  const lineStep = steps[Math.floor(steps.length / 3)] ?? bodySize * 1.6
  const rightEdge = Math.max(...lines.map((l) => l.x + l.width), 0)
  lines.forEach((line, index) => {
    if (!index) {
      text = line.text
      return
    }
    const prev = lines[index - 1]!
    let separator = '\n'
    if (line.page === prev.page) {
      const gap = prev.y - line.y
      if (line.block && prev.block === line.block) separator = ' '
      else if (gap > lineStep * 1.6) separator = '\n\n'
      else if (!line.block && prev.x + prev.width >= rightEdge - bodySize && gap < lineStep * 1.2)
        separator = ' '
    } else if (prev.x + prev.width >= rightEdge - bodySize) separator = ' '
    text += separator + line.text
  })
  return text.trim()
}

export function detectStructure(
  rawLines: TextLine[],
  filename: string,
  metadataTitle = '',
): ImportDraft {
  const bodySize = typicalBodySize(rawLines)
  const heading = (line: TextLine) =>
    isHeadingTag(line.role) ||
    (!line.role?.startsWith('H') &&
      line.size >= bodySize * 1.18 &&
      line.text.length <= 1000 &&
      !emojiOnly(line.text))
  const lines: TextLine[] = []
  for (const original of removePageFurniture(rawLines, bodySize).filter((l) => l.text.trim())) {
    const line = { ...original },
      previous = lines.at(-1)
    const sameTaggedHeading = line.block && line.block === previous?.block
    const tightPhysicalWrap =
      previous &&
      !line.block &&
      !previous.block &&
      previous.y - line.y > line.size * 0.6 &&
      previous.y - line.y <= line.size * 1.5
    if (
      previous &&
      heading(previous) &&
      heading(line) &&
      previous.page === line.page &&
      Math.abs(previous.size - line.size) < 0.5 &&
      (sameTaggedHeading || tightPhysicalWrap)
    ) {
      previous.text += ' ' + line.text
    } else lines.push(line)
  }
  const meaningfulTitle =
    metadataTitle.trim() && !/^(untitled|document|microsoft word\s*-?)$/i.test(metadataTitle.trim())
      ? metadataTitle.trim()
      : ''
  let title = meaningfulTitle || filenameTitle(filename)
  const titleIndex = lines.findIndex((l) => !emojiOnly(l.text))
  const first = lines[titleIndex]
  const laterHeads = lines.slice(titleIndex + 1).filter(heading)
  const nextHeading = laterHeads[0]
  const documentTitle =
    first && nextHeading && first.size > nextHeading.size * 1.35 && first.size > bodySize * 1.5
  if (documentTitle) title = first.text
  const candidates = lines
    .map((line, index) => ({ line, index }))
    .filter(({ line, index }) => heading(line) && !(documentTitle && index === titleIndex))
  const warnings: string[] = []
  if (!candidates.length) {
    warnings.push(
      'No clear section headings were found. Your script is kept together in one section.',
    )
    return {
      title,
      sourceFilename: filename,
      pageCount: Math.max(...rawLines.map((l) => l.page), 0),
      excludedPreamble: '',
      warnings,
      sections: [{ title: 'Untitled section', text: bodyText(lines, bodySize) }],
    }
  }
  if (candidates.some((c) => !isHeadingTag(c.line.role)))
    warnings.push(
      'Some headings were identified from formatting. Check the proposed sections before continuing.',
    )
  const sections: ImportDraft['sections'] = []
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]!
    const next = candidates[i + 1]
    sections.push({
      title: candidate.line.text,
      text: bodyText(lines.slice(candidate.index + 1, next?.index ?? lines.length), bodySize),
    })
  }
  return {
    title,
    sourceFilename: filename,
    sections,
    warnings,
    excludedPreamble: lines
      .slice(0, candidates[0]!.index)
      .map((l) => l.text)
      .join('\n'),
    pageCount: Math.max(...rawLines.map((l) => l.page), 0),
  }
}
