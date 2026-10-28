import { PDFDocument, StandardFonts } from 'pdf-lib'

export async function fixturePdf(
  kind: 'headings' | 'none' | 'mixed' | 'scanned' = 'headings',
  headingSize = 16,
): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('A walk by the river')
  const body = await pdf.embedFont(StandardFonts.Helvetica),
    bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  let page = pdf.addPage([612, 792])
  const draw = (text: string, y: number, size = 12, heading = false) =>
    page.drawText(text, { x: 54, y, font: heading ? bold : body, size })
  if (kind === 'scanned') {
    page.drawRectangle({ x: 60, y: 100, width: 450, height: 600 })
    return Buffer.from(await pdf.save())
  }
  if (kind === 'none') {
    draw('A quiet river at sunrise.', 700)
    draw('A second sentence in the same script.', 676)
    return Buffer.from(await pdf.save())
  }
  draw('A walk by the river', 730, 30, true)
  draw('Planning notes before the script.', 690)
  draw('An unexpected morning', 630, headingSize, true)
  draw('The street was quiet.', 600)
  draw('Then the rain began.', 576)
  draw('[Show the empty street]', 540)
  draw('The change', 485, headingSize, true)
  if (kind === 'mixed') {
    draw('A second heading with no preceding narration', 450, headingSize, true)
    for (let i = 0; i < 18; i++)
      draw(`A longer section follows the story, line ${i + 1}.`, 420 - i * 20)
    page = pdf.addPage([612, 792])
    draw('Continuing the same section on another page.', 730)
  } else {
    draw('We took a different way home.', 450)
    draw('It was worth the detour.', 426)
  }
  draw('A quiet ending', kind === 'mixed' ? 650 : 350, headingSize, true)
  draw('A different view. A familiar place.', kind === 'mixed' ? 620 : 320)
  return Buffer.from(await pdf.save())
}
