import { test, expect, type Page } from '@playwright/test'
import { fixturePdf } from './fixtures'

const titles = (page: Page) =>
  page
    .locator('.section-title')
    .evaluateAll((elements) => elements.map((el) => (el as HTMLTextAreaElement).value))

async function open(page: Page) {
  await page.goto('/')
  await page
    .getByTestId('pdf-input')
    .setInputFiles({ name: 'story.pdf', mimeType: 'application/pdf', buffer: await fixturePdf() })
  await page.getByRole('button', { name: 'Open storyboard' }).click()
  await expect(page.locator('.script-column')).toHaveCount(3)
}

async function expectPlusAlignedWithAddImage(page: Page) {
  const column = page.locator('.script-column').first()
  const plus = await column.getByRole('button', { name: /^Add section before/ }).boundingBox()
  const addImage = await column.getByRole('button', { name: /^Add reference images to/ }).boundingBox()
  if (!plus || !addImage) throw new Error('Missing insertion or image control')
  expect(Math.abs(plus.y + plus.height / 2 - (addImage.y + addImage.height / 2))).toBeLessThanOrEqual(3)
}

async function nameNewSection(page: Page, index: number, name: string) {
  const column = page.locator('.script-column').nth(index)
  const title = column.locator('.section-title')
  await expect(title).toBeFocused()
  await expect(column.locator('.script-text')).toHaveValue('')
  expect(await title.evaluate((el) => (el as HTMLTextAreaElement).selectionStart)).toBe(0)
  expect(await title.evaluate((el) => (el as HTMLTextAreaElement).selectionEnd)).toBe(
    'Untitled section'.length,
  )
  await page.keyboard.type(name)
  await expect(title).toHaveValue(name)
}

test('inserts blank sections before the first, in the middle after a move, and after the last; persists exact order', async ({
  page,
}, testInfo) => {
  await open(page)
  await expectPlusAlignedWithAddImage(page)
  const original = await titles(page)
  await page.getByRole('button', { name: `Add section before ${original[0]}`, exact: true }).click()
  await nameNewSection(page, 0, 'New beginning')
  expect(await titles(page)).toEqual(['New beginning', ...original])
  await page.getByRole('button', { name: `Move ${original[2]} left`, exact: true }).click()
  await page.getByRole('button', { name: `Add section before ${original[1]}`, exact: true }).click()
  await nameNewSection(page, 3, 'New beat')
  expect(await titles(page)).toEqual([
    'New beginning',
    original[0],
    original[2],
    'New beat',
    original[1],
  ])
  await page.getByRole('button', { name: `Add section after ${original[1]}`, exact: true }).click()
  await nameNewSection(page, 5, 'New ending')
  const order = await titles(page)
  await expect(page.locator('.save-status')).toHaveText('Saved locally')
  await page.reload()
  await expect(page.locator('.script-column')).toHaveCount(6)
  expect(await titles(page)).toEqual(order)
  await expect(page.locator('.script-text').nth(0)).toHaveValue('')
  await expect(page.locator('.script-text').nth(3)).toHaveValue('')
  await expect(page.locator('.script-text').nth(5)).toHaveValue('')
  await page.screenshot({ path: testInfo.outputPath('insertion-desktop.png') })
})

test('insertion controls work at narrow widths and the end-of-board add still appends', async ({
  page,
}, testInfo) => {
  await open(page)
  await page.setViewportSize({ width: 390, height: 844 })
  await expectPlusAlignedWithAddImage(page)
  const original = await titles(page)
  await page.getByRole('button', { name: `Add section before ${original[1]}`, exact: true }).click()
  await nameNewSection(page, 1, 'Narrow beat')
  await page.getByRole('button', { name: `Add section after ${original[2]}`, exact: true }).click()
  await nameNewSection(page, 4, 'Last beat')
  expect(await titles(page)).toEqual([
    original[0],
    'Narrow beat',
    original[1],
    original[2],
    'Last beat',
  ])
  await page.locator('.board-scroll').evaluate((el) => {
    el.scrollLeft = 0
  })
  await expect(
    page.getByRole('button', { name: `Add section before ${original[0]}`, exact: true }),
  ).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('insertion-mobile.png') })
})
