import { expect } from '@playwright/test'
import { test } from './fixtures'
import { createRandomPage, newBlock, lastBlock, appFirstLoaded, IsMac, IsLinux, escapeToCodeEditor, escapeToBlockEditor } from './utils'

/**
 * NOTE: CodeMirror is a complex library that requires a lot of setup to work.
 * This test suite is designed to test the basic functionality of the editor.
 * It is not intended to test the full functionality of CodeMirror.
 * For more information, see: https://codemirror.net/doc/manual.html
 */

test('switch code editing mode', async ({ page }) => {
  await createRandomPage(page)

  // NOTE: ` will trigger auto-pairing in Logseq
  // NOTE: ( will trigger auto-pairing in CodeMirror
  // NOTE: waitForTimeout is needed to ensure that the hotkey handler is finished (shift+enter)
  // NOTE: waitForTimeout is needed to ensure that the CodeMirror editor is fully loaded and unloaded
  // NOTE: multiple textarea elements are existed in the editor, be careful to select the right one

  // code block with 0 line
  await page.type(':nth-match(textarea, 1)', '```clojure\n')
  // line number: 1
  await page.waitForSelector('.CodeMirror pre', { state: 'visible' })
  expect(await page.locator('.CodeMirror-gutter-wrapper .CodeMirror-linenumber').innerText()).toBe('1')
  // lang label: clojure
  expect(await page.innerText('.block-body .extensions__code-lang')).toBe('clojure')

  await page.press('.CodeMirror textarea', 'Escape')
  await page.waitForSelector('.CodeMirror pre', { state: 'hidden' })
  expect(await page.inputValue(':nth-match(textarea, 1)')).toBe('```clojure\n```')

  await page.waitForTimeout(500)
  await page.press(':nth-match(textarea, 1)', 'Escape')
  await page.waitForSelector('.CodeMirror pre', { state: 'visible' })

  // NOTE: must wait here, await loading of CodeMirror editor
  await page.waitForTimeout(500)
  await page.click('.CodeMirror pre')
  await page.waitForTimeout(500)

  await page.type('.CodeMirror textarea', '(+ 1 1')
  await page.press('.CodeMirror textarea', 'Escape')
  await page.waitForSelector('.CodeMirror pre', { state: 'hidden' })
  expect(await page.inputValue('.block-editor textarea')).toBe('```clojure\n(+ 1 1)\n```')

  await page.waitForTimeout(500) // editor unloading
  await page.press('.block-editor textarea', 'Escape')
  await page.waitForTimeout(500) // editor loading
  // click position is estimated to be at the begining of the first line
  await page.click('.CodeMirror pre', { position: { x: 1, y: 5 } })
  await page.waitForTimeout(500)

  await page.type('.CodeMirror textarea', ';; comment\n\n  \n')

  await page.press('.CodeMirror textarea', 'Escape')
  await page.waitForSelector('.CodeMirror pre', { state: 'hidden' })
  expect(await page.inputValue('.block-editor textarea')).toBe('```clojure\n;; comment\n\n  \n(+ 1 1)\n```')

  await page.waitForTimeout(500)
})


test('convert from block content to code', async ({ page }) => {
  await createRandomPage(page)

  await page.type('.block-editor textarea', '```')
  await page.press('.block-editor textarea', 'Shift+Enter')
  await page.waitForTimeout(100) // wait for hotkey handler
  await page.press('.block-editor textarea', 'Escape')
  await page.waitForSelector('.CodeMirror pre', { state: 'visible' })

  await page.waitForTimeout(500)
  await page.click('.CodeMirror pre')
  await page.waitForTimeout(500)
  expect(await page.locator('.CodeMirror-gutter-wrapper .CodeMirror-linenumber >> nth=-1').innerText()).toBe('1')

  await page.press('.CodeMirror textarea', 'Escape')
  await page.waitForTimeout(500)

  expect(await page.inputValue('.block-editor textarea')).toBe('```\n```')

  // reset block, code block with 1 line
  await page.fill('.block-editor textarea', '```\n\n```')
  await page.waitForTimeout(500) // wait for fill
  await escapeToCodeEditor(page)
  expect(await page.locator('.CodeMirror-gutter-wrapper .CodeMirror-linenumber >> nth=-1').innerText()).toBe('1')
  await escapeToBlockEditor(page)
  expect(await page.inputValue('.block-editor textarea')).toBe('```\n\n```')

  // reset block, code block with 2 line
  await page.fill('.block-editor textarea', '```\n\n\n```')
  await page.waitForTimeout(500)
  await escapeToCodeEditor(page)
  expect(await page.locator('.CodeMirror-gutter-wrapper .CodeMirror-linenumber >> nth=-1').innerText()).toBe('2')
  await escapeToBlockEditor(page)
  expect(await page.inputValue('.block-editor textarea')).toBe('```\n\n\n```')

  await page.fill('.block-editor textarea', '```\n  indented\nsecond line\n\n```')
  await page.waitForTimeout(500)
  await escapeToCodeEditor(page)
  await escapeToBlockEditor(page)
  expect(await page.inputValue('.block-editor textarea')).toBe('```\n  indented\nsecond line\n\n```')

  await page.fill('.block-editor textarea', '```\n  indented\n  indented\n```')
  await page.waitForTimeout(500)
  await escapeToCodeEditor(page)
  await escapeToBlockEditor(page)
  expect(await page.inputValue('.block-editor textarea')).toBe('```\n  indented\n  indented\n```')
})

test('code block mixed input source', async ({ page }) => {
  await createRandomPage(page)

  await page.fill('.block-editor textarea', '```\n  ABC\n```')
  await page.waitForTimeout(500) // wait for fill
  await escapeToCodeEditor(page)
  await page.type('.CodeMirror textarea', '  DEF\nGHI')

  await page.waitForTimeout(500)
  await page.press('.CodeMirror textarea', 'Escape')
  await page.waitForTimeout(500)
  // NOTE: auto-indent is on
  expect(await page.inputValue('.block-editor textarea')).toBe('```\n  ABC  DEF\n  GHI\n```')
})

test('code block with text around', async ({ page }) => {
  await createRandomPage(page)

  await page.fill('.block-editor textarea', 'Heading\n```\n```\nFooter')
  await page.waitForTimeout(500)
  await escapeToCodeEditor(page)
  await page.type('.CodeMirror textarea', 'first\n  second')

  await page.waitForTimeout(500)
  await page.press('.CodeMirror textarea', 'Escape')
  await page.waitForTimeout(500)
  expect(await page.inputValue('.block-editor textarea')).toBe('Heading\n```\nfirst\n  second\n```\nFooter')
})

test('multiple code block', async ({ page }) => {
  await createRandomPage(page)

  // NOTE: the two code blocks are of the same content
  await page.fill('.block-editor textarea', 'Heading\n```clojure\n```\nMiddle\n```clojure\n```\nFooter')
  await page.waitForTimeout(500)

  await page.press('.block-editor textarea', 'Escape')
  await page.waitForSelector('.CodeMirror pre', { state: 'visible' })

  // first
  await page.waitForTimeout(500)
  await page.click('.CodeMirror pre >> nth=0')
  await page.waitForTimeout(500)

  await page.type('.CodeMirror textarea >> nth=0', ':key-test\n', { strict: true })
  await page.waitForTimeout(500)

  await page.press('.CodeMirror textarea >> nth=0', 'Escape')
  await page.waitForTimeout(500)
  expect(await page.inputValue('.block-editor textarea'))
    .toBe('Heading\n```clojure\n:key-test\n\n```\nMiddle\n```clojure\n```\nFooter')

  // second
  await page.press('.block-editor textarea', 'Escape')
  await page.waitForSelector('.CodeMirror pre', { state: 'visible' })

  await page.waitForTimeout(500)
  await page.click('.CodeMirror pre >> nth=1')
  await page.waitForTimeout(500)

  await page.type('.CodeMirror textarea >> nth=1', '\n  :key-test\n', { strict: true })
  await page.waitForTimeout(500)

  await page.press('.CodeMirror textarea >> nth=1', 'Escape')
  await page.waitForTimeout(500)
  expect(await page.inputValue('.block-editor textarea'))
    .toBe('Heading\n```clojure\n:key-test\n\n```\nMiddle\n```clojure\n\n  :key-test\n\n```\nFooter')
})