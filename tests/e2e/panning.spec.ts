import { test, expect } from '@playwright/test'
import { fixturePdf } from './fixtures'

async function open(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByTestId('pdf-input').setInputFiles({
    name: 'story.pdf',
    mimeType: 'application/pdf',
    buffer: await fixturePdf('mixed'),
  })
  await page.getByRole('button', { name: 'Open storyboard' }).click()
  await expect(page.locator('.script-column')).toHaveCount(4)
}
test('space drag pans both axes without editing or activating controls; normal spaces still type', async ({
  page,
}) => {
  await open(page)
  await page.setViewportSize({ width: 900, height: 650 })
  const board = page.locator('.board-scroll')
  await board.focus()
  await page.keyboard.down('Space')
  await page.mouse.move(700, 400)
  await page.mouse.down()
  await page.mouse.move(250, 180, { steps: 12 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  const position = await board.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }))
  expect(position.x).toBeGreaterThan(300)
  expect(position.y).toBeGreaterThan(100)
  await expect(board).not.toHaveClass(/panning|pan-ready/)
  await board.evaluate((el) => {
    el.scrollLeft = 0
    el.scrollTop = 0
  })
  const text = page.locator('.script-text').first()
  await text.fill('two')
  await text.press('End')
  await text.press('Space')
  await text.pressSequentially('words')
  await expect(text).toHaveValue('two words')
  await expect(board).not.toHaveClass(/pan-ready/)
  await board.focus()
  await page.mouse.move(700, 400)
  await page.mouse.down({ button: 'middle' })
  await page.mouse.move(400, 400, { steps: 10 })
  await page.mouse.up({ button: 'middle' })
  expect(await board.evaluate((el) => el.scrollLeft)).toBeGreaterThan(100)
})

test('pan gestures do not activate section controls and releasing focus clears pan mode', async ({
  page,
}) => {
  await open(page)
  const board = page.locator('.board-scroll')
  const remove = page
    .locator('.script-column')
    .first()
    .getByRole('button', { name: /Delete section/ })
  const bounds = await remove.boundingBox()
  if (!bounds) throw new Error('Missing section control')
  await board.focus()
  await page.keyboard.down('Space')
  await page.mouse.click(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.keyboard.up('Space')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(page.locator('.script-column')).toHaveCount(4)
  await page.keyboard.down('Space')
  await expect(board).toHaveClass(/pan-ready/)
  await page.evaluate(() => window.dispatchEvent(new Event('blur')))
  await expect(board).not.toHaveClass(/panning|pan-ready/)
  await page.keyboard.up('Space')
  await remove.click()
  await expect(page.getByRole('dialog', { name: 'Delete this section?' })).toBeVisible()
})

test('Escape leaves section titles and narration ready for Space-drag without changing text', async ({
  page,
}) => {
  await open(page)
  await page.setViewportSize({ width: 900, height: 650 })
  const board = page.locator('.board-scroll')
  for (const selector of ['.section-title', '.script-text']) {
    await board.evaluate((el) => {
      el.scrollLeft = 0
      el.scrollTop = 0
    })
    const field = page.locator(selector).first()
    await field.fill('Keep this edit')
    const before = await board.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }))
    await field.press('Escape')
    await expect(field).not.toBeFocused()
    await expect(board).toBeFocused()
    expect(await board.evaluate((el) => ({ x: el.scrollLeft, y: el.scrollTop }))).toEqual(before)
    await page.keyboard.down('Space')
    await expect(board).toHaveClass(/pan-ready/)
    await page.mouse.move(700, 400)
    await page.mouse.down()
    await page.mouse.move(350, 200, { steps: 12 })
    await page.mouse.up()
    await page.keyboard.up('Space')
    expect(await board.evaluate((el) => el.scrollLeft)).toBeGreaterThan(200)
    await expect(field).toHaveValue('Keep this edit')
  }
  await expect(page.locator('.save-status')).toHaveText('Saved locally')
  await page.reload()
  await expect(page.locator('.section-title').first()).toHaveValue('Keep this edit')
  await expect(page.locator('.script-text').first()).toHaveValue('Keep this edit')
})
