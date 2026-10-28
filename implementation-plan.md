# Storyboard Script: implementation plan

**Status:** Approved and implemented; preparing GitHub and hosting delivery after local review.  
**Date:** October 27, 2026  
**Requirements:** [MVP specification](./storyboard-script-mvp-spec.md), the concept sketch, and the user's clarifications.

## Product to build

A desktop-first browser app that imports a Notion-style script PDF into editable, horizontally arranged section columns. About four readable columns fit on a typical desktop; the rest are reached by scrolling left/right. Text determines each column's natural height, with one shared vertical scrolling area for long sections.

The user can edit headings and narration, add a section through a trailing plus column, reorder sections, optionally attach local reference images, and export the revised script as a PDF. Projects save locally in the browser, with separate ZIP backups for transfer or recovery.

No accounts, backend, cloud sync, AI processing, OCR, rich-text editor, or split/merge controls.

## Confirmed import rules and review defaults

1. Detect the imported PDF's own document title and use it as the initial editable project name; fall back to the filename without its extension if no title is identifiable. Begin the first column at that PDF's first section heading, regardless of its wording. **Script Revised** and **Intro** describe the supplied sample only and must never be hardcoded.
2. Every section heading creates one column, including headings intended by the author as subsections. The user confirmed they will adjust source formatting to fit this rule. Keep consecutive headings as separate columns even when the earlier section is empty; do not infer nested groups or silently merge/remove headings. The supplied PDF as currently formatted therefore has **17 columns**, including empty **Playoffs** followed by **Newbee**, plus the add-section placeholder.
3. Editing is plain text, preserving line breaks and paragraph spacing. Counts and estimated narration time use section bodies, including production cues, and exclude headings.
4. Exported script PDFs contain headings and narration. Images are optional references retained in the app and project backups.
5. Following local review, empty image areas take no space. An icon beside the section title adds images; attached images appear in a thumbnail tray.

## Sample-driven import requirements

The supplied PDF is 15 pages and contains a distinct document title, 17 consistently tagged H3 section headings, short narration lines, bracketed production cues, and repeated footer text/page numbers. Sections frequently continue across pages. On page 8, **Newbee** appears at the bottom of the page and its narration starts on page 9.

Expected heading order:

1. Intro
2. Ad Finem origins
3. Who are the Ad Finem players
4. Not Qualifying to tournaments
5. Boston Major qualifications
6. Ad Finem’s playstyle
7. Qualifying to Boston Major
8. Tournament overview
9. Playoffs
10. Newbee
11. LGD.Forever Young
12. Digital Chaos
13. They didn't win
14. OG won (again)
15. Where they are now
16. Final wrap up
17. Outro

This sample is a local acceptance reference. The app must not hardcode its heading names, font sizes, or number of sections. Preserve original text characters; the list above is a readable reference, not a normalization rule.

## Architecture and dependencies

Use the specified **Vue 3, Vite, strict TypeScript, Tailwind CSS, Vue Router, Dexie, and Vitest** stack. Use Vue composables for workspace state and repository functions for all storage access. No global state framework is needed initially.

| Concern | Planned choice | Purpose |
| --- | --- | --- |
| PDF reading | `pdfjs-dist` with a locally bundled worker | Read text, positions, and available heading/paragraph structure in the browser. |
| PDF generation | `pdf-lib` with `@pdf-lib/fontkit` and locally bundled, licensed fonts | Generate selectable text, measure wrapping, and preserve the punctuation/currency characters in the sample. |
| Section dragging | Vue 3 `vuedraggable` from SortableJS | Provide handles and horizontal dragging; separate move-left/right buttons supply the keyboard fallback. |
| ZIP backups | `@zip.js/zip.js` | Export blobs and validate/bound archive extraction. |
| Verification | Vitest plus focused Playwright browser flows | Test parser/storage/export behavior and the complete user journey. |

PDF.js exposes page structure through `getStructTree()` and text through `getTextContent()`. Use available tags first, with formatting-based fallback for other PDFs. See the [PDF.js page API](https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib-PDFPageProxy.html).

PDF generation will use the browser and font-embedding capabilities documented by [pdf-lib](https://pdf-lib.js.org/). Reordering will use the [official Vue 3 SortableJS component](https://github.com/SortableJS/vue.draggable.next). Backup limits will supplement the library's validation as described in [zip.js's untrusted-file guidance](https://gildas-lormeau.github.io/zip.js/#reading-untrusted-zip-files).

Pin compatible package versions during scaffolding. Bundle workers, fonts, and any required PDF support assets with the app; do not depend on runtime CDNs or send script content to external services.

## Build sequence

### 1. Foundation, visual shell, and durable project storage

- Scaffold the app, routes, typed project/section/image models, and checks.
- Establish the quiet cream/paper visual style, restrained accents, readable typography, and compact workspace toolbar.
- Build the project list and workspace shell using original sample content.
- Implement Dexie repositories and transactions for creating, opening, renaming, and deleting projects. Confirm deletion and remove associated section/image records together.
- Add storage schema versioning and visible save/failure state from the start. Keep parsing, PDF export, and ZIP operations separate from Vue components.

**Completion check:** Multiple projects can be created, opened, renamed, and deleted; surviving data remains correct after reload.

### 2. PDF import and review

- Validate file size/type, load PDF.js locally, show progress, and handle encrypted, corrupted, empty, and scanned-only files clearly.
- Read text with position/style metadata and map usable structure tags to content. Reconstruct reading order, paragraphs, and intentional line breaks; join physical wraps within a paragraph without flattening intentional short narration lines.
- Distinguish a confidently detected document title from section headings. Use visible title/meaningful metadata, placement, and surrounding structure together; never discard the first H1 solely because it is an H1. Use the detected title for the editable project name, with the filename without its extension as fallback.
- Start narration at the first section heading, regardless of its name, and retain excluded preamble for inspection in review. Remove reliable repeated margin footers/page numbers, without removing matching text in the body.
- Prefer semantic H1/H2/H3 section tags when present. Fall back to relative text size, styling, and spacing when absent. Keep the no-heading/uncertain fallback as one section containing the extracted body.
- Preserve consecutive headings as separate sections, including empty sections, and carry narration across page boundaries.
- Present proposed section titles and text for review and title corrections. Create the saved project only when import is confirmed; cancellation/failure must leave existing projects untouched.

**Completion check:** The supplied PDF produces the expected 17 sections, starts with Intro, excludes recurring footers, and places page 9's opening narration under Newbee. Controlled fixtures use different document titles and first-heading names to prove there is no dependency on sample wording; they also cover title fallback, H1/H2/H3 variants, untagged PDFs, preambles, and no headings.

### 3. Editable horizontal storyboard

- Render top-aligned, consistently sized columns, responsive enough to show approximately four on ordinary desktop widths. Keep both horizontal navigation buttons and a discoverable scrollbar available even when columns are very tall.
- Use auto-growing plain-text fields with readable line/paragraph spacing. The board owns scrolling; individual bodies do not receive fixed-height scroll areas.
- Edit project/section titles and narration, retain paragraph boundaries and line breaks, and recompute counts and time immediately.
- Add the trailing plus placeholder. Clicking creates a stable new section and focuses its title; the placeholder stays outside section totals and ordering.
- Implement project WPM, initially 150, with bounded numeric input and consistent duration formatting. Label estimates clearly.
- Persist edits promptly and serialize writes so an older update cannot replace a newer one. Flush pending writes before internal navigation and exports, show unsaved state accurately, and preserve the in-memory draft if a save fails.

**Completion check:** Edits and added sections survive reload, counts update correctly, and long sections remain naturally taller than short ones at desktop widths.

### 4. Reordering and optional reference images

- Add drag handles with horizontal movement/edge scrolling and accessible move-left/right actions. Preserve editor selection by dragging only from handles.
- Reorder stable section IDs and keep images attached to their section. Keep the plus placeholder permanently last.
- Add optional PNG/JPG/WebP uploads with byte/type/decode validation and a decoded-pixel limit. Store original accepted blobs in IndexedDB and show compact previews in a consistently sized image area.
- Provide image removal and a larger preview with keyboard dismissal/focus handling. Release object URLs when no longer needed.

**Completion check:** Reordering and image changes survive reload, fallback move buttons work, and uploading/removing images does not alter text or statistics.

### 5. Script PDF export

- Export a stable snapshot of the current saved/in-memory script in board order, including new and empty sections. Flush pending edits first and report storage/export errors explicitly.
- Generate a new text-based PDF with consistent headings, body typography, margins, and pagination. Store the project title in PDF metadata; printable script content starts with the first section heading.
- Measure wrapped lines, preserve intentional line breaks and paragraph gaps, and keep a heading with initial narration where space permits. Long sections continue across pages.
- Embed fonts supporting the sample's curly apostrophes, ellipses, and currency symbols. Detect unsupported characters rather than silently dropping them.
- Keep reference images, timing statistics, and app controls out of the script PDF.

**Completion check:** Visually inspect the output; verify selectable text, no clipping, correct order, and preserved punctuation. Re-import the output through the actual importer and compare headings and normalized narration text, including consecutive empty headings. Exact original page layout is not required.

### 6. Portable project backups

- Export a versioned `project.json` and image files in one ZIP. Include current text, order, titles, WPM, metadata, and all image associations.
- Validate versions, field types, lengths, relationships, filenames, duplicate entries, media types, and decoded image limits before creating records.
- Bound archive bytes, entry count, per-entry size, total expanded size, and actual decompression output; reject unsupported/encrypted entries and abort if limits are exceeded. Keep export/import limits consistent so supported exports can be restored.
- Import into a new project with newly generated IDs and remapped relationships. Never overwrite an existing project; commit only after validation succeeds.
- Explain browser-local storage and the difference between a script PDF and a full project backup in the UI.

**Completion check:** A backup restores all text, images, order, and settings in a fresh browser context. Broken or excessive archives fail without partial projects or changes to existing ones.

### 7. Product verification and deployment readiness

- Add original small PDF fixtures for tagged/untagged headings at different sizes, no headings, preamble and footer cleanup, consecutive headings, page-spanning sections, and production cues.
- Run focused logic tests for parsing, text preservation, counts/timing, section creation/reorder, persistence errors, backup validation, and export/re-import.
- Exercise the browser journey: import, review, edit, add, reorder, upload image, reload, export PDF, export backup, restore, and delete a project.
- Inspect the actual board at common desktop widths, including 1366, 1440, and 1920 px. Verify keyboard focus, image preview, editable-field behavior, and horizontal navigation on a tall board.
- Use the supplied PDF locally for manual acceptance; do not put the user's narration in public assets or distributed fixtures. Use a longer original sample to check dozens of columns and tens of thousands of words.
- Verify file operations make no outbound requests containing script/image data and use only bundled app assets.
- Run build, type checking, lint, and tests; configure Vercel SPA route fallback and verify direct project-route reloads.
- Write an accessible README covering setup, commands, local storage/backups, supported PDF structure, known limitations, and deployment. Deploy and verify the hosted app when the GitHub/Vercel destination is available; report any account/destination access still needed.

**Completion check:** The full workflow works with the real sample and controlled fixtures, checks pass, and the deployment opens project routes correctly.

## Limits and review boundary

PDF structure varies. Tags present in this example may be absent in other exports, and font-size fallback cannot perfectly distinguish every heading or intentional line break. The importer must preserve uncertain content and make its proposed result inspectable. The sample's H3 structure is evidence for this file, not a guarantee about all Notion PDFs.

Project backups preserve the complete editable project; script PDFs preserve headings and narration for reading or re-import, with potentially different page wrapping. Projects remain local to one browser profile.

This plan is the next review artifact in the user's requested sequence. Begin implementation only after the user approves it or requests changes that also authorize proceeding.
