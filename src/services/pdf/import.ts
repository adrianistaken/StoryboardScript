import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { detectStructure, type TextLine } from './structure'
import { limits } from '../../utils'
import type { ImportDraft } from '../../types'

GlobalWorkerOptions.workerSrc = workerUrl
type StructureNode = { role?: string; type?: string; id?: string; children?: StructureNode[] }
type StructureInfo = { role?: string; block?: string }

function contentRoles(tree: StructureNode | null, page: number): Map<string, StructureInfo> {
  const result = new Map<string, StructureInfo>()
  let counter = 0
  function visit(node: StructureNode, inherited: StructureInfo) {
    let info = inherited
    if (/^H[1-6]$/.test(node.role ?? '') || node.role === 'P' || node.role === 'Artifact')
      info = { role: node.role, block: `${page}:${counter++}` }
    if (node.type === 'content' && node.id) result.set(node.id, info)
    node.children?.forEach((child) => visit(child, info))
  }
  if (tree) visit(tree, {})
  return result
}

export async function importPdf(
  file: File,
  onProgress: (current: number, total: number) => void = () => {},
): Promise<ImportDraft> {
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf')
    throw new Error('Choose a PDF file. Project ZIP backups have their own import option.')
  if (!file.size)
    throw new Error('This PDF is empty. Export a new selectable-text PDF and try again.')
  if (file.size > limits.pdfBytes)
    throw new Error('This PDF is too large. Choose a file smaller than 25 MB.')
  const data = new Uint8Array(await file.arrayBuffer())
  const task = getDocument({ data, useSystemFonts: true })
  try {
    const pdf = await task.promise
    if (pdf.numPages > limits.pdfPages)
      throw new Error(
        `This PDF has too many pages. Please use fewer than ${limits.pdfPages} pages.`,
      )
    let title = ''
    try {
      const meta = await pdf.getMetadata()
      title = String((meta.info as { Title?: string }).Title ?? '')
    } catch {
      /* Metadata is optional. */
    }
    const lines: TextLine[] = []
    const emptyPages: number[] = []
    let chars = 0
    for (let n = 1; n <= pdf.numPages; n++) {
      onProgress(n - 1, pdf.numPages)
      const page = await pdf.getPage(n)
      const viewport = page.getViewport({ scale: 1 })
      const content = await page.getTextContent({ includeMarkedContent: true })
      const roles = contentRoles(await page.getStructTree().catch(() => null), n)
      const stack: string[] = []
      type Run = TextLine & { end: number }
      const runs: Run[] = []
      for (const item of content.items) {
        if (!('str' in item)) {
          if (item.type === 'beginMarkedContent' || item.type === 'beginMarkedContentProps')
            stack.push(item.id ?? '')
          else if (item.type === 'endMarkedContent') stack.pop()
          continue
        }
        if (!item.str.trim()) continue
        chars += item.str.length
        if (chars > limits.textChars)
          throw new Error(
            'This script contains too much text to process safely. Try importing a shorter script.',
          )
        const info =
          [...stack]
            .reverse()
            .map((id) => roles.get(id))
            .find(Boolean) ?? {}
        const size = Math.hypot(item.transform[2], item.transform[3])
        const style = content.styles[item.fontName]
        runs.push({
          text: item.str,
          size,
          bold: /bold|black|semibold/i.test(item.fontName + (style?.fontFamily ?? '')),
          page: n,
          x: item.transform[4],
          y: item.transform[5],
          width: item.width,
          end: item.transform[4] + item.width,
          pageHeight: viewport.height,
          ...info,
        })
      }
      if (!runs.length) emptyPages.push(n)
      runs.sort((a, b) =>
        Math.abs(a.y - b.y) > Math.min(a.size, b.size) * 0.3 ? b.y - a.y : a.x - b.x,
      )
      const pageLines: Run[] = []
      for (const run of runs) {
        const last = pageLines.at(-1)
        if (
          last &&
          Math.abs(last.y - run.y) < Math.min(last.size, run.size) * 0.3 &&
          last.role === run.role &&
          last.block === run.block
        ) {
          const gap = run.x - last.end
          last.text +=
            gap > Math.min(last.size, run.size) * 0.12 &&
            !/\s$/.test(last.text) &&
            !/^\s/.test(run.text)
              ? ' ' + run.text
              : run.text
          last.end = Math.max(last.end, run.end)
          last.width = last.end - last.x
          last.size = Math.max(last.size, run.size)
        } else pageLines.push({ ...run })
      }
      lines.push(...pageLines.map((l) => ({ ...l, text: l.text.trim() })))
      page.cleanup()
    }
    if (!lines.length)
      throw new Error(
        'No selectable text was found. Scanned or image-only PDFs are not supported. Export a selectable-text PDF from Notion or your writing app.',
      )
    const draft = detectStructure(lines, file.name, title)
    if (draft.sections.length > limits.sections)
      throw new Error('This PDF has more than 500 sections. Please import a shorter script.')
    draft.pageCount = pdf.numPages
    if (emptyPages.length)
      draft.warnings.push(
        `${emptyPages.length} page(s) had no selectable text. Any scanned text on those pages could not be imported.`,
      )
    onProgress(pdf.numPages, pdf.numPages)
    return draft
  } catch (error) {
    if (error instanceof Error && error.name === 'PasswordException')
      throw new Error(
        'This PDF is password-protected. Export an unlocked, selectable-text copy and try again.',
        { cause: error },
      )
    if (error instanceof Error && /InvalidPDF|MissingPDF|UnexpectedResponse/.test(error.name))
      throw new Error(
        'This PDF could not be read. It may be damaged or not a valid PDF. Export a fresh copy and try again.',
        { cause: error },
      )
    throw error
  } finally {
    await task.destroy()
  }
}
