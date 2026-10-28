import { PDFDocument, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { ProjectDocument } from '../../types'
import { orderedSections } from '../../utils'

export function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (!text) return ['']
  const lines: string[] = []
  let current = ''
  for (const token of text.split(/(\s+)/)) {
    if (font.widthOfTextAtSize(current + token, size) <= maxWidth) {
      current += token
      continue
    }
    if (current.trim()) lines.push(current.trimEnd())
    current = token.trimStart()
    // A long URL or unbroken token must fit too.
    if (font.widthOfTextAtSize(current, size) > maxWidth) {
      let part = ''
      for (const char of current) {
        if (part && font.widthOfTextAtSize(part + char, size) > maxWidth) {
          lines.push(part)
          part = ''
        }
        part += char
      }
      current = part
    }
  }
  if (current.trim() || !lines.length) lines.push(current.trimEnd())
  return lines
}

export async function exportPdf(
  doc: ProjectDocument,
  fontBytes?: { regular: ArrayBuffer; bold: ArrayBuffer },
): Promise<Blob> {
  const fonts = fontBytes ?? {
    regular: await fetch('/fonts/SourceSans3-Regular.ttf').then((r) => r.arrayBuffer()),
    bold: await fetch('/fonts/SourceSans3-Semibold.ttf').then((r) => r.arrayBuffer()),
  }
  const pdf = await PDFDocument.create()
  pdf.registerFontkit(fontkit)
  pdf.setTitle(doc.project.title)
  pdf.setCreator('Storyboard Script')
  pdf.setProducer('Storyboard Script')
  const bodyFont = await pdf.embedFont(fonts.regular, { subset: true })
  const headingFont = await pdf.embedFont(fonts.bold, { subset: true })
  const bodyChars = new Set(bodyFont.getCharacterSet()),
    headingChars = new Set(headingFont.getCharacterSet())
  for (const section of orderedSections(doc)) {
    for (const [text, chars] of [
      [section.title, headingChars],
      [section.text, bodyChars],
    ] as const) {
      const unsupported = [
        ...new Set([...text].filter((c) => !/\s/.test(c) && !chars.has(c.codePointAt(0)!))),
      ]
      if (unsupported.length)
        throw new Error(
          `PDF export cannot display these characters yet: ${unsupported.slice(0, 6).join(' ')}. Replace them in the script, or export a project backup to keep the original text.`,
        )
    }
  }
  const pageWidth = 612,
    pageHeight = 792,
    margin = 54,
    usableWidth = pageWidth - 2 * margin
  let page = pdf.addPage([pageWidth, pageHeight]),
    y = pageHeight - margin
  const newPage = () => {
    page = pdf.addPage([pageWidth, pageHeight])
    y = pageHeight - margin
  }
  const draw = (text: string, font: PDFFont, size: number, step: number) => {
    if (y - step < margin) newPage()
    if (text)
      page.drawText(text, { x: margin, y: y - size, size, font, color: rgb(0.13, 0.15, 0.16) })
    y -= step
  }
  for (const [index, section] of orderedSections(doc).entries()) {
    const headingLines = wrapText(section.title || 'Untitled section', headingFont, 16, usableWidth)
    const needed = Math.min(
      headingLines.length * 22 + (section.text ? 24 : 0) + 18,
      pageHeight - 2 * margin,
    )
    if (y - needed < margin) newPage()
    else if (index) y -= 18
    headingLines.forEach((line) => draw(line, headingFont, 16, 22))
    y -= 8
    for (const paragraphLine of section.text.replace(/\r\n?/g, '\n').split('\n')) {
      if (!paragraphLine) {
        y -= 12
        continue
      }
      wrapText(paragraphLine.replace(/\t/g, '    '), bodyFont, 11.5, usableWidth).forEach((line) =>
        draw(line, bodyFont, 11.5, 17),
      )
    }
  }
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' })
}
