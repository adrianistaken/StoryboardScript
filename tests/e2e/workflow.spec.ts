import { expect, test, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { fixturePdf } from './fixtures'

async function openFixture(
  page: Page,
  kind: 'headings' | 'none' | 'mixed' = 'headings',
  headingSize = 16,
) {
  await page.goto('/')
  await page
    .getByTestId('pdf-input')
    .setInputFiles({
      name: 'river.pdf',
      mimeType: 'application/pdf',
      buffer: await fixturePdf(kind, headingSize),
    })
  await expect(page.getByRole('button', { name: 'Open storyboard' })).toBeVisible()
  await page.getByRole('button', { name: 'Open storyboard' }).click()
  await expect(page.locator('.script-column').first()).toBeVisible()
}
const titles = (page: Page) =>
  page
    .locator('.section-title')
    .evaluateAll((elements) => elements.map((e) => (e as HTMLTextAreaElement).value))
const texts = (page: Page) =>
  page
    .locator('.script-text')
    .evaluateAll((elements) => elements.map((e) => (e as HTMLTextAreaElement).value))

test('import, edit, add, move, refresh, and delete a section', async ({ page }) => {
  const externalRequests: string[] = []
  page.on('request', (r) => {
    if (/^https?:/.test(r.url()) && !r.url().startsWith('http://127.0.0.1:5173'))
      externalRequests.push(r.url())
  })
  await openFixture(page)
  await expect(page.getByRole('textbox', { name: 'Project title', exact: true })).toHaveValue(
    'A walk by the river',
  )
  expect(await titles(page)).toEqual(['An unexpected morning', 'The change', 'A quiet ending'])
  await page
    .getByRole('textbox', { name: 'Script for An unexpected morning', exact: true })
    .fill('An edited line.\n\n[Keep this cue]\nAnother line.')
  await page.getByRole('spinbutton', { name: 'Words per minute' }).fill('200')
  await expect(page.locator('.total-time')).toContainText('estimated narration')
  await page.getByRole('button', { name: 'Move An unexpected morning right', exact: true }).click()
  expect((await titles(page))[0]).toBe('The change')
  await page.getByRole('button', { name: 'Add section after A quiet ending' }).click()
  await page
    .getByRole('textbox', { name: 'Section title', exact: true })
    .last()
    .fill('A new thought')
  await page
    .getByRole('textbox', { name: 'Script for A new thought', exact: true })
    .fill('New narration.')
  await expect(page.locator('.save-status')).toHaveText('Saved locally')
  const url = page.url()
  await page.reload()
  await expect(page.locator('.script-column')).toHaveCount(4)
  expect(await titles(page)).toEqual([
    'The change',
    'An unexpected morning',
    'A quiet ending',
    'A new thought',
  ])
  await expect(
    page.getByRole('textbox', { name: 'Script for An unexpected morning', exact: true }),
  ).toHaveValue('An edited line.\n\n[Keep this cue]\nAnother line.')
  await expect(page.getByRole('spinbutton', { name: 'Words per minute' })).toHaveValue('200')
  await page.getByRole('button', { name: 'Delete section A new thought', exact: true }).click()
  await page.getByRole('button', { name: 'Delete section', exact: true }).click()
  await expect(page.locator('.script-column')).toHaveCount(3)
  await expect(page.locator('.save-status')).toHaveText('Saved locally')
  await page.goto(url)
  await expect(page.locator('.script-column')).toHaveCount(3)
  expect(externalRequests).toEqual([])
})

test('image attachment, preview, backup restore, and image removal', async ({
  page,
  browser,
}, testInfo) => {
  await openFixture(page)
  const png = await page.locator('.script-column').first().screenshot()
  await page
    .locator('.script-column')
    .first()
    .locator('input[type=file]')
    .setInputFiles({ name: 'reference.png', mimeType: 'image/png', buffer: png })
  const preview = page.getByRole('button', { name: 'Preview reference.png' })
  await expect(preview).toBeVisible()
  await preview.click()
  await expect(page.getByRole('dialog', { name: 'reference.png' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'reference.png' })).not.toBeVisible()
  await expect(page.locator('.save-status')).toHaveText('Saved locally')
  await page.reload()
  await expect(preview).toBeVisible()
  const originalTexts = await texts(page)
  await page.locator('.export-menu summary').click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Project backup' }).click()
  const backup = await download
  const path = testInfo.outputPath('project.storyboard.zip')
  await backup.saveAs(path)
  const fresh = await browser.newContext()
  const other = await fresh.newPage()
  await other.goto('/')
  await other.getByTestId('backup-input').setInputFiles(path)
  await expect(other.locator('.script-column')).toHaveCount(3)
  expect(await texts(other)).toEqual(originalTexts)
  expect(other.url()).not.toBe(page.url())
  await expect(other.getByRole('button', { name: 'Preview reference.png' })).toBeVisible()
  await other.getByRole('button', { name: 'Remove reference.png' }).click()
  await expect(other.getByRole('button', { name: 'Preview reference.png' })).toHaveCount(0)
  await expect(other.locator('.save-status')).toHaveText('Saved locally')
  await other.reload()
  await expect(other.getByRole('button', { name: 'Preview reference.png' })).toHaveCount(0)
  await fresh.close()
})

test('script PDF export re-imports with headings, edited text, and empty sections', async ({
  page,
}, testInfo) => {
  await openFixture(page, 'mixed')
  await page
    .getByRole('textbox', { name: 'Section title', exact: true })
    .last()
    .fill(
      'A long ending heading that needs to wrap gracefully when it is written across more than one line in the exported document',
    )
  await page
    .getByRole('textbox', { name: 'Script for An unexpected morning', exact: true })
    .fill('Iʼm here… with €750.\n\n[Keep this production cue]')
  await page
    .locator('.script-column')
    .last()
    .getByRole('button', { name: /Move .* left/ })
    .click()
  const originalTitles = await titles(page),
    originalTexts = await texts(page)
  await page.locator('.export-menu summary').click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Script PDF', exact: false }).click()
  const pdf = await pending,
    path = testInfo.outputPath('export.pdf')
  await pdf.saveAs(path)
  await page.getByRole('link', { name: 'Back to your scripts' }).click()
  await page.getByTestId('pdf-input').setInputFiles(path)
  await page.getByRole('button', { name: 'Open storyboard' }).click()
  await expect(page.locator('.script-column')).toHaveCount(originalTitles.length)
  expect(await titles(page)).toEqual(originalTitles)
  const normalized = (s: string) => s.replace(/\s+/g, ' ').trim()
  expect((await texts(page)).map(normalized)).toEqual(originalTexts.map(normalized))
})

test('a failed save retains the draft and allows a recovery backup', async ({ page }, testInfo) => {
  await openFixture(page)
  await page.evaluate(async () => {
    const modulePath = '/src/services/storage.ts'
    const { projects } = await import(/* @vite-ignore */ modulePath)
    projects.save = async () => {
      throw new DOMException('Storage full', 'QuotaExceededError')
    }
  })
  const draftText = 'This text must survive a storage failure.'
  await page
    .getByRole('textbox', { name: 'Script for An unexpected morning', exact: true })
    .fill(draftText)
  await expect(page.getByRole('alert')).toContainText('running out of storage')
  await expect(page.locator('.save-status')).toHaveText('Not saved')
  await expect(
    page.getByRole('textbox', { name: 'Script for An unexpected morning', exact: true }),
  ).toHaveValue(draftText)
  await page.locator('.export-menu summary').click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Project backup' }).click()
  await (await pending).saveAs(testInfo.outputPath('recovery.zip'))
  await expect(page.locator('.board-hint')).toContainText('Project backup exported')
})

test('no-heading PDF preserves its content in one section', async ({ page }) => {
  await openFixture(page, 'none')
  await expect(page.locator('.script-column')).toHaveCount(1)
  expect((await texts(page))[0]).toContain('A quiet river at sunrise.')
  expect((await texts(page))[0]).toContain('A second sentence in the same script.')
})

test('malformed PDFs, scanned PDFs, and broken backups show errors without losing projects', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Explore an example' }).click()
  await page.getByRole('link', { name: 'Back to your scripts' }).click()
  await page
    .getByTestId('pdf-input')
    .setInputFiles({
      name: 'broken.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('broken'),
    })
  await expect(page.getByRole('alert')).toContainText('could not be read')
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await page
    .getByTestId('pdf-input')
    .setInputFiles({
      name: 'scan.pdf',
      mimeType: 'application/pdf',
      buffer: await fixturePdf('scanned'),
    })
  await expect(page.getByRole('alert')).toContainText('No selectable text')
  await page.getByRole('button', { name: 'Dismiss' }).click()
  await page
    .getByTestId('backup-input')
    .setInputFiles({
      name: 'broken.zip',
      mimeType: 'application/zip',
      buffer: Buffer.from('broken zip'),
    })
  await expect(page.getByRole('alert')).toContainText('could not be opened')
  await expect(page.locator('.project-row')).toHaveCount(1)
})

test('project rename and confirmed deletion work with multiple projects', async ({ page }) => {
  await openFixture(page)
  await page.getByRole('link', { name: 'Back to your scripts' }).click()
  await page.getByRole('button', { name: 'Explore an example' }).click()
  await page.getByRole('link', { name: 'Back to your scripts' }).click()
  await expect(page.locator('.project-row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Rename A walk by the river' }).click()
  await page.getByRole('textbox', { name: 'Project title' }).fill('Renamed script')
  await page.getByRole('button', { name: 'Save name' }).click()
  await page.getByRole('button', { name: 'Delete Renamed script', exact: true }).click()
  await page.getByRole('button', { name: 'Keep project' }).click()
  await expect(page.locator('.project-row')).toHaveCount(2)
  await page.getByRole('button', { name: 'Delete Renamed script', exact: true }).click()
  await page.getByRole('button', { name: 'Delete project', exact: true }).click()
  await expect(page.locator('.project-row')).toHaveCount(1)
})

test('drag handles reorder sections independently from text editing', async ({ page }) => {
  await openFixture(page)
  const handle = await page.locator('.drag-handle').first().boundingBox()
  const target = await page.locator('.script-column').nth(1).boundingBox()
  if (!handle || !target) throw new Error('Missing drag controls')
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
  await page.mouse.down()
  await page.mouse.move(target.x + target.width - 15, handle.y + handle.height / 2, { steps: 25 })
  await page.mouse.up()
  await expect.poll(async () => (await titles(page))[0]).toBe('The change')
  await expect(page.locator('.save-status')).toHaveText('Saved locally')
  await page.reload()
  expect((await titles(page))[0]).toBe('The change')
})

test('column height reflects text and navigation works at desktop and narrow widths', async ({
  page,
}, testInfo) => {
  await openFixture(page, 'mixed')
  for (const width of [1366, 1440, 1920, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(page.locator('.board-navigation')).toBeVisible()
    const measurements = await page
      .locator('.script-column')
      .evaluateAll((elements) =>
        elements.map((e) => ({
          height: e.getBoundingClientRect().height,
          width: e.getBoundingClientRect().width,
        })),
      )
    expect(measurements[2]!.height).toBeGreaterThan(measurements[1]!.height + 100)
    expect(new Set(measurements.map((m) => Math.round(m.width))).size).toBe(1)
    const textScrolling = await page
      .locator('.script-text')
      .evaluateAll((elements) => elements.some((e) => e.scrollHeight > e.clientHeight + 2))
    expect(textScrolling).toBe(false)
    await page.screenshot({ path: testInfo.outputPath(`board-${width}.png`) })
  }
  await page.getByRole('button', { name: 'Scroll to later sections' }).click()
  await expect
    .poll(() => page.locator('.board-scroll').evaluate((e) => e.scrollLeft))
    .toBeGreaterThan(0)
})

test('provided Notion PDF reconstructs the real 17-section script', async ({ page }, testInfo) => {
  const sample = process.env.STORYBOARD_SAMPLE_PDF
  test.skip(
    !sample,
    'Set STORYBOARD_SAMPLE_PDF to a local Notion export for private acceptance testing.',
  )
  await page.goto('/')
  await page
    .getByTestId('pdf-input')
    .setInputFiles({
      name: 'sample.pdf',
      mimeType: 'application/pdf',
      buffer: await readFile(sample!),
    })
  await expect(page.locator('.review-summary')).toContainText('17 sections')
  await page.getByRole('button', { name: 'Open storyboard' }).click()
  await expect(page.locator('.script-column')).toHaveCount(17)
  const expected = [
    'Intro',
    'Ad Finem origins',
    'Who are the Ad Finem players',
    'Not Qualifying to tournaments',
    'Boston Major qualifications',
    'Ad Finemʼs playstyle',
    'Qualifying to Boston Major',
    'Tournament overview',
    'Playoffs',
    'Newbee',
    'LGD.Forever Young',
    'Digital Chaos',
    "They didn't win",
    'OG won (again)',
    'Where they are now',
    'Final wrap up',
    'Outro',
  ]
  expect(await titles(page)).toEqual(expected)
  const content = await texts(page)
  expect(content[8]).toBe('')
  expect(content[9]).toContain('Their first opponent - Newbee.')
  expect(content.join('\n')).not.toContain('Script Revised')
  expect(content[0]).toContain('Who never won anything.\n\nAn underdog team')
  await page.screenshot({ path: testInfo.outputPath('sample-board.png') })
})
