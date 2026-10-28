# Storyboard Script

A browser-local workspace for seeing, editing, and rearranging video scripts. Import a selectable-text PDF, review its proposed sections, and work with the whole script as a horizontal board.

## Run locally

Use Node.js **24 LTS** (Node 22.12+ is also supported) and npm.

```sh
npm ci
npm run dev
```

Open the localhost address printed in the terminal. A modern desktop browser is the primary target. Use **Explore an example** for an original sample, or **Import PDF** for your own script.

```sh
npm run build       # Type check and create dist/
npm run preview     # Serve the production build locally
npm run typecheck   # Strict TypeScript and Vue checks
npm run lint        # ESLint
npm test            # Core logic, storage, and archive tests
npm run check       # Type check, lint, unit tests, production build
npm run format      # Format source, tests, and configuration
```

## The workflow

1. Export your script from Notion or another writing app as a selectable-text PDF.
2. Import it and inspect the proposed headings and narration. Rename headings or the project title during review if needed.
3. Open the storyboard. Edit titles or narration directly; changes, counts, and time estimates update automatically.
4. Drag using the dotted handles, or use the left/right buttons. Use the plus column at the end to add a section. Deleting a section requires confirmation.
5. Optionally attach one or more reference images to a section. Click a thumbnail for a larger preview.
6. Use **Export → Script PDF** to download current headings and narration in board order.
7. Use **Export → Project backup** to preserve the full editable project, including images. Restore it using **Import backup** on the home screen.

One heading means one section. Subheadings also create columns; the app does not infer nested chapters. Consecutive headings can create empty sections. There are no split/merge controls or rich-text formatting tools.

## Your data

Projects live in **IndexedDB in this browser profile, on this device and site address**. No account or backend is involved. No scripts or images are uploaded, and there is no telemetry. PDF processing, image validation, backups, and export all happen locally. Fonts and the PDF worker are bundled with the app.

Localhost, a deployed site, another browser, and another computer each have separate storage. Clearing site data removes locally stored projects. Private browsing or browser cleanup may also discard data. **A project ZIP backup is the way to transfer or preserve your work.** A script PDF contains only headings and narration; it does not contain attached images, reading pace, or project IDs.

Wait for **Saved locally** before closing the page. If storage fails, the current draft remains visible and an export can still capture it. The app warns before leaving unsaved work. Avoid editing the same project in multiple tabs at once; there is no live multi-tab collaboration.

## PDF support and limitations

- The initial project name comes from a confidently identified document title or meaningful PDF title metadata. The fallback is the filename, without its extension. No script-specific title or first-heading name is hardcoded.
- The script starts at its first section heading. A document title, decorative icon, and earlier notes are excluded and shown in the review's preamble disclosure.
- Usable PDF heading tags are preferred. Untagged PDFs use relative font size and spacing. H1/H2/H3-style headings are supported; the reader does not require a fixed point size.
- Reliable recurring margin footers/page numbers are excluded. Sections continue across physical page breaks.
- Paragraph spacing and intentional short narration lines are preserved where the PDF provides enough evidence. Visual line wraps are joined within recognized paragraphs. Ambiguous, untagged documents can still need text corrections after import.
- If headings cannot be recognized, the extracted body is kept in one section. Complex layouts, multi-column source documents, tables, and unusual font encodings may not reconstruct perfectly. Review before relying on the result.
- Scanned/image-only and password-protected PDFs are not supported. Export an unlocked, selectable-text copy. Mixed PDFs warn if any pages have no readable text; OCR is not included.
- PDF export uses consistent typography, not the original document's layout. Source Sans 3 covers Latin, Greek, and Cyrillic text and common punctuation/currency characters. Unsupported characters such as many emoji produce an explicit error instead of disappearing; project backups keep their exact text.
- Word counts include production directions in section bodies. Headings are excluded. Narration timing defaults to 150 WPM and can be set from 100–220 WPM. It does not model pauses, footage, music, or editing.

## Limits

PDF imports are limited to 25 MB, 500 pages, 500 sections, and two million text characters. Images must be PNG, JPG, or WebP, under 10 MB and 40 million pixels each. Projects allow up to 1,000 images, within a total media budget that keeps supported backups below 150 MB.

Backups include a versioned `project.json` and `images/` entries. Import checks types, versions, IDs, relationships, image signatures/dimensions, filenames, archive entry count, declared sizes, and actual expanded bytes. It creates a new project with remapped IDs; it never overwrites an existing project. Failed imports do not commit partial records.

## Tests

```sh
npx playwright install chromium
npm run test:e2e
```

Playwright starts the development server when needed. To reuse an existing compatible Chromium binary, set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to its executable.

The browser suite creates original PDF fixtures at runtime: conventional headings, no headings, and mixed/long sections with production cues and page continuations. Unit fixtures also cover heading sizes/tags, wrapped and consecutive headings, footer removal, storage rollback, and malformed backups. Browser tests exercise editing, creation/deletion, mouse dragging and move buttons, local reload persistence, image previews, fresh-context backup restoration, export/re-import, errors, and viewport sizes.

An optional private acceptance test accepts a local script path:

```sh
STORYBOARD_SAMPLE_PDF="/absolute/path/to/script.pdf" npm run test:e2e
```

That optional test is tailored to the sample supplied during development. The sample itself is not included in app assets or test fixtures. Screenshots/downloads go to the ignored `test-results/` directory.

## Project layout

```text
src/
  components/          # Columns, image tray, import review, accessible dialogs
  composables/         # Serialized autosave and project state
  services/
    pdf/               # PDF.js extraction, structure detection, PDF generation
    storage.ts         # Dexie database and project repository
    backup.ts          # ZIP serialization and bounded validation
    media.ts           # Image signature, dimension, and decode validation
  views/               # Home and storyboard workspace
  types.ts             # Versioned project, section, and image models
  utils.ts             # Counts, duration, ordering, filenames, limits
tests/
  unit/                # Behavior-focused logic/storage tests
  e2e/                 # Original PDF fixtures and browser workflows
public/fonts/          # Locally bundled PDF fonts and their license
```

The section model stores a plain `text` string instead of normalizing into an array of paragraphs. This preserves deliberate single line breaks and blank lines through editing, storage, and backups. Statistics are computed rather than stored. Vue components use repository functions; replacing or augmenting storage with a future API does not require rewriting the PDF parser or the views.

## Deploy to Vercel

Repository: [adrianistaken/StoryboardScript](https://github.com/adrianistaken/StoryboardScript).

Vercel's free Hobby plan supports personal, non-commercial projects. To deploy:

1. Open [Vercel's new project page](https://vercel.com/new) and import `adrianistaken/StoryboardScript` into your personal Hobby account.
2. Import that repository into Vercel and select the **Vite** preset with Node **24.x**.
3. Use `npm run build` as the build command and `dist` as the output directory. No environment variables or server/database are required.
4. `vercel.json` supplies the SPA fallback for `/project/:id`. Assets and fonts are served as static files.
5. Open the deployed app, create or restore a project, and refresh its URL to verify routing. Export a ZIP from your local browser and import it on the deployed site to transfer your projects.

Dependencies are pinned in `package-lock.json`. Source Sans 3 is distributed under the SIL Open Font License; see `public/fonts/LICENSE.md`.
