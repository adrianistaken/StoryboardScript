# Storyboard Script: MVP Project Specification

**Status:** Implemented and reviewed locally; GitHub and hosting delivery authorized.  
**Version:** 1.3, October 27, 2026  
**Primary audience:** AI coding agent implementing the first usable version  
**Reference image:** [Concept sketch](./ChatGPT%20Image%20Oct%2027%2C%202026%2C%2004_57_20%20PM.png)

**Revision note:** This revision records the user's clarifications and inspection of the supplied Notion script: desktop-first viewing with roughly four columns visible, heading-delimited sections, script content starting at the first section heading, no split/merge controls, editable script text, an add-section column, and script PDF export. Reference images are optional and start empty. Sample findings and review defaults are listed in §13. The [implementation plan](./implementation-plan.md) is ready for review. Neither document is approval to begin implementation.

## 1. Product vision

Storyboard Script is a browser-based visual planning tool for YouTube video scripts. It transforms a conventional PDF script into a **horizontal storyboard of sections**, letting a creator understand the structure and approximate pacing of a video at a glance.

The motivating problem: A long script is easy to read top-to-bottom, but hard to evaluate as a whole. The creator wants to see the relative size of each part, edit the narration text, optionally attach visual inspiration, add sections, and try a different section order. The current script can then be exported as a new PDF.

**Core promise:** Import a script, see and revise its story structure and text, and export the revised script.

This is initially a personal creative tool, **not** a SaaS launch. Optimize for a polished, genuinely useful experience with a real script instead of growth, monetization, or account features.

## 2. Primary user journey

1. Open the deployed website in a desktop browser, including on a Windows machine with no local development environment.
2. Create a project by uploading a text-based PDF script.
3. The browser extracts the script's text and proposes sections from headings, starting the script at its first section heading and excluding earlier notes.
4. Review proposed sections and rename headings if needed. There are no split or merge controls in this version.
5. Confirm import and enter the **horizontal storyboard** view.
6. Scan the section columns. Read the text and compare section lengths, word counts, and estimated narration times.
7. Edit narration, add sections using the trailing plus column, optionally attach reference images, and drag sections left/right to change their order.
8. Revisit the same project later in the **same browser** with changes preserved.
9. Export the current script as a PDF with headings and section text in board order. Separately, export a project backup and restore it using an import option.

**Success moment:** The creator can import a real video script, quickly identify disproportionately long sections, and experiment with the flow of the story without touching the source PDF.

## 3. Scope: required MVP functionality

### A. Projects and home screen

- Simple home screen with product name, a brief description, **Import PDF** action, and saved project list.
- Each project has a user-editable title, creation and update times, and source PDF filename for reference.
- Initialize the project title from the imported PDF's identifiable document title (visible title or meaningful title metadata). If no title can be identified confidently, use the filename without its extension. Never use a sample-specific title as a default for other PDFs.
- Open, rename, or delete a project; deletion requires confirmation.
- Multiple locally saved projects are supported.
- No login, account creation, or cloud sync.

### B. PDF import and section detection

- Accept standard **text-based PDFs**. Extract content entirely in the browser using PDF.js (`pdfjs-dist`). Nothing is uploaded to a server.
- Reconstruct readable text with paragraph breaks and intentional narration line breaks as faithfully as practical, preserving original narrative order. A section may continue across multiple PDF pages; page breaks are not section boundaries.
- The primary input is a script written in **Notion** and exported as a text-based PDF. Each section is introduced by a heading. Support scripts using H1, H2, or H3-sized headings rather than assuming a particular font size. Prefer usable semantic heading tags when the PDF includes them; the supplied example includes H3 tags for its sections. When tags are absent or unusable, use a **conservative set of deterministic heuristics**, such as relative font size, bold styling, numbering, and whitespace around a line. Do not treat every short sentence as a heading.
- Start script content at the first section heading, whatever its wording. Do not search for or require a heading called “Intro.” Exclude a confidently identified document title, decorative page icon, and preceding notes from narration and timing, but make excluded preamble available to inspect during import review. Do not assume every first H1 is a document title; H1 may be the script's actual section-heading level. Sample-specific titles and section names in §13 are test expectations only.
- Exclude reliably identified recurring page footers and page numbers from section text. In the example these are “Script Revised” and a page number at the bottom of each page. Use margin position and repetition/artifact evidence rather than globally removing matching narration text.
- Every section heading creates a new flat section, including headings the author may have intended as subsections. Consecutive headings are preserved separately, even if the earlier one has no narration. The user confirmed this rule and will adjust source formatting as needed; do not infer nested groups or automatically repair the hierarchy. For the supplied sample as currently formatted, “Playoffs” remains an empty editable column followed by “Newbee.”
- Use detected headings as proposed section boundaries. If detection is uncertain or finds none, import all text as **one section** rather than losing content or inventing headings.
- Present a **review screen** before finalizing import, showing section names and their contained text/paragraphs.
- In the review screen, allow users to rename a section. Do not add split or merge controls. Preserve all script text from the selected starting heading onward.
- If there are no recognizable headings, retain the existing fallback of one “Untitled section” containing all extracted text; there is no reliable heading boundary at which to exclude a preamble.
- Show informative errors for corrupted, encrypted, empty, or image-only/scanned PDFs. **OCR is out of scope.** Suggest that users export a selectable-text PDF.
- Show extraction progress or a clear loading state. Limit file size to a reasonable default (suggested 25 MB) and handle failures without losing existing projects.

**Important:** PDF heading recognition will never be perfect. Import review and editable titles/text provide correction opportunities, but automatic section split/merge controls are explicitly out of scope. Do not use an LLM or external API for the MVP.

### C. Horizontal storyboard workspace

Match the *concept* in the linked sketch, while applying polished UI design rather than reproducing the hand-drawn appearance literally.

- Each script section is a **vertical column**, aligned from a common top edge. Columns are ordered left-to-right following video chronology.
- Entire board scrolls **horizontally** when columns extend beyond the viewport; make horizontal navigation discoverable and usable with mouse/trackpad. Provide obvious navigation affordances, not a hidden-only scrollbar.
- Keep column widths consistent, targeting roughly **four readable columns across a normal desktop viewport**. Approximately 330–380 px is a starting point; adjust to the usable width. Additional columns are reached by scrolling horizontally. There is no requirement to fit the entire script on one screen. Desktop is the primary target; mobile design is not a priority for this version.
- Each column shows, from top to bottom:
  1. Section title.
  2. Word count and estimated spoken duration.
  3. A consistent-sized reference-image area with an add-image affordance.
  4. The complete current script text, with readable paragraph breaks and an editing affordance.
- **Length comparison is central:** Script text must flow to its natural height, so longer sections result in visibly taller columns. Do **not** give each text body an identical fixed height with its own scrollbar, or truncate the narration by default.
- Keep the image area approximately the same height across columns, including empty-image placeholders, so image attachments do not misleadingly dominate the relative section heights. Multiple images can appear as thumbnails in the image area.
- Show project-wide totals in an unobtrusive workspace toolbar: section count, total words, and total estimated narration duration.
- Allow editing section titles and script bodies from the storyboard. Text changes immediately update word counts, duration estimates, and natural column heights, and are auto-saved. Simple plain-text paragraph editing is the proposed baseline; rich-text formatting is not required.
- Always show a trailing **add-section placeholder column** with a clear plus button. Activating it appends a new empty section with an editable heading and body, before the placeholder. The placeholder is not a section and does not count toward totals, exports, or drag order.
- Do not implement controls to split or merge existing sections in this version.
- Support dragging columns left or right with a visible drag handle. Reordering must update their actual order and persist after refresh. Include accessible move-left/move-right controls as a fallback to dragging.
- A natural, vertically scrollable document is acceptable for exceptionally long sections. Prioritize clear comparison over making every column independently scrollable.

### D. Section reference images

- Add **one or more** local PNG, JPG, or WebP images to each section.
- All sections start with **no images**. Uploading references is entirely optional; importing, editing, reordering, and exporting a script must work without attaching any images.
- Display compact thumbnails/previews within the fixed-height image area; click to inspect a larger preview if straightforward to implement.
- Remove an attached image. Do not change script text or section statistics when images are added or removed.
- Store images locally as blobs in IndexedDB, not as remote URLs.
- Validate image type and size (suggested max 10 MB per image), and show helpful errors.
- No video embeds, stock-image search, image generation, or cloud storage.

### E. Word counts and timing

- Count words per section based on its current script body, including edits and newly added sections. Calculate totals by summing sections in their current order. Section headings are labels, separate from narration text.
- Narration estimate = `wordCount / wordsPerMinute`; display `m:ss` or `h:mm:ss` as appropriate.
- Set **150 WPM** as the initial default. Allow a **project-level** WPM preference (for example, 100–220) and recompute estimates immediately when it changes.
- Clearly label the result **estimated narration time**; it does not account for footage, pauses, music, ad reads, or editing.
- For MVP, count all text retained in section bodies consistently, including bracketed production directions. Excluded preamble is not part of a section body. Filtering non-spoken directions within a section is a later enhancement.

### F. Local persistence and project backups

- Store project metadata, section contents/order, settings, and image blobs in **IndexedDB** using **Dexie.js**.
- Auto-save edits, with a subtle saved/saving state where helpful. Persist correctly across tab/browser restarts on the same browser profile.
- Keep the storage layer abstracted behind repository/service functions so a later Laravel API + PostgreSQL backend could replace or augment persistence without rewriting Vue views.
- Implement **Export Project** and **Import Project Backup**. Recommended format: a `.zip` archive containing a versioned `project.json` manifest plus image files in an `images/` folder. Validate backup structure and versions before importing; do not trust archive contents blindly.
- Clearly communicate that **projects are local to one browser/device**. Deploying the frontend to Vercel does **not** sync projects from a development computer to a Windows PC. Backups are the manual way to transfer them during the MVP.

### G. Script PDF export

- Provide **Export Script PDF** separately from **Export Project Backup**.
- Compile the current sections in their board order, with each section heading followed by its current body text, into a readable text-based PDF generated entirely in the browser.
- Include edits and newly added sections. Preserve paragraph breaks, support text flowing across pages, and keep heading styling consistent and distinguishable from body text.
- The output should use the same heading-then-body structure expected during import so it can be imported again as a script.
- Proposed baseline: export headings and narration only. Reference images and workspace statistics remain in the project and its backup; they are not part of the script PDF.
- This creates a new PDF; it does not modify the originally imported file or update the source Notion page. Faithful reproduction of the source PDF's visual formatting is not required.

## 4. Intentionally out of scope

Do **not** implement these in the initial build:

- User accounts, authentication, cloud database, cross-device sync, collaboration.
- Rich-text formatting, a full document-layout editor, or changes reflected back into the original PDF or source Notion page. Simple script-body editing and generation of a new script PDF are in scope.
- Section split and merge controls.
- Updating an existing board automatically from a revised source PDF while preserving its image associations and other changes.
- AI-generated structure, AI script feedback, LLM calls, external APIs, or OCR.
- Video timeline integration, playback, editing software plugins, voice recording, or automatic clips.
- Advanced statistics/retention predictions, annotations, story-beat scoring, monetization, subscriptions, or analytics tracking.
- Collapsing/expanding columns, zoomed-out overview mode, and elaborate keyboard shortcuts can be considered later. The MVP should already communicate section length without relying on them.

If a requirement is ambiguous, choose the simpler solution that preserves the user journey. Do not expand the feature list without justification.

## 5. Technology and architecture

**Committed starting stack:**

- **Vue 3** with Composition API and Single File Components.
- **Vite** as bundler/development server.
- **TypeScript** with strict type checking.
- **Tailwind CSS** for styling.
- **PDF.js** (`pdfjs-dist`) for client-side PDF text extraction, with the worker configured correctly in Vite.
- A client-side PDF-generation library for text-based script export; library selection belongs in the implementation plan.
- **Dexie.js** on IndexedDB for persistent local project data.
- A mature **Vue 3-compatible drag-and-drop library** for horizontal reordering, or an equivalently accessible implementation; avoid a custom fragile solution.
- **Vue Router** for a home page and a project workspace URL (`/project/:id`).
- **Vitest** for core business-logic tests. Optional Playwright smoke tests if practical.
- **GitHub → Vercel** for static hosting and deployments.

**Do not build a backend for the MVP.** All PDF extraction, parsing, word counting, image handling, and storage happen client-side. This is a durable frontend architecture, not a throwaway prototype. Future backend integration should be additive rather than a rewrite.

Suggested high-level modules (names flexible):

```text
src/
  components/        # StoryboardColumn, ImageTray, StatsBar, etc.
  views/             # HomeView, ImportReviewView, StoryboardView
  services/pdf/      # PDF.js extraction, section detection, script PDF export
  services/storage/  # Dexie schemas + repository abstraction
  services/backup/   # ZIP export/import + validation
  composables/       # Workspace state/actions
  types/             # Typed project/section/media models
  utils/             # Word counting, time formatting, section transforms
```

Prefer straightforward Vue state/composables over a global store unless application complexity warrants Pinia. Keep the PDF parser separate from components so it is easy to test and improve without restructuring the UI.

## 6. Data model (conceptual)

Use a versioned schema roughly equivalent to:

```ts
type Project = {
  id: string;
  schemaVersion: number;
  title: string;
  sourceFilename?: string;
  narrationWpm: number; // initial default 150
  sectionOrder: string[]; // ids in display order
  createdAt: string;
  updatedAt: string;
};

type Section = {
  id: string;
  projectId: string;
  title: string;
  paragraphs: string[]; // editable blocks; strings may contain intentional line breaks
  imageIds: string[];
};

type ReferenceImage = {
  id: string;
  projectId: string;
  sectionId: string;
  filename: string;
  mimeType: string;
  blob: Blob; // stored in Dexie; serialized as image file in backup
};
```

Word count and estimated time should generally be **computed** from current paragraphs and WPM rather than stored as authoritative fields. During reorder, update `sectionOrder` only. Newly added sections receive stable IDs and are appended to `sectionOrder`. Editing text or titles must preserve existing section/image associations. The add-section placeholder is a UI control and is never persisted as a section.

## 7. UI and interaction guidance

Visual direction: **quiet, editorial, clean, subtly paper-inspired**. Think warm off-white or cream canvas, restrained borders/shadows, generous whitespace, legible typography, and muted accent colors. Aim for a focused creative workspace, not a crowded analytics dashboard or kanban clone.

- Desktop-first at approximately 1366–1920 px wide, but functional on narrower screens with horizontal scrolling.
- A compact top bar provides project title, totals, WPM setting, script PDF export, backup export, and a route back to projects.
- Columns should feel like a script visualization, with readable narration and obvious differences in natural height.
- Clear empty states, import progress, graceful error messages, and responsive controls.
- Use actual drag handles, stable keys/IDs, keyboard fallback buttons for reorder, and sensible focus/ARIA labels.
- Avoid heavy decorative textures that reduce readability. Motion can be subtle; avoid large transitions that make the storyboard feel sluggish.

## 8. Engineering constraints and safety

- Work entirely in the browser; no script uploads or API calls beyond fetching the app assets.
- Treat all PDF text, image metadata, and imported backup JSON as **untrusted content**. Render text as text, never unsafe HTML.
- Prevent destructive overwrites and confirm project deletion; catch IndexedDB quota/storage errors and explain that a backup may be needed.
- Validate file types/sizes, malformed backups, and unsupported schema versions. Avoid decompression bombs and uncontrolled memory allocations when reading ZIPs.
- Use generated stable IDs, avoid leaking object URLs, and keep interactions smooth with longer real-world scripts (target: dozens of sections and tens of thousands of words).
- Configure Vercel SPA route fallbacks so direct `/project/:id` navigation and refreshes work.
- No telemetry, payment infrastructure, or login required.

## 9. Planning and approval

The user requested the following sequence:

1. Review and discuss the specification and sketch.
2. Resolve the remaining product questions.
3. Produce an implementation plan for the user's review.
4. Begin building only after the user has reviewed and approved the plan.

The original implementation phases are superseded by this approval sequence. A revised [implementation plan](./implementation-plan.md) has been drafted and awaits review and approval. Implementation has not started. The eventual finished MVP must include all required functionality in §3.

## 10. Acceptance criteria / definition of done

The agent should verify all of the following:

- [ ] A text-based PDF with headings creates multiple sections in the correct narration order.
- [ ] Scripts using H1, H2, or H3-style section headings are supported without assuming one fixed heading size.
- [ ] Different document titles and first-heading names are detected from their PDFs; neither “Script Revised” nor “Intro” is hardcoded. When no document title is identifiable, the filename supplies the initial editable project title.
- [ ] Text preceding the first section heading is excluded from the script and can be inspected during import review.
- [ ] The supplied sample begins at “Intro,” excludes its document title/icon and repeated footers, retains all 17 section headings including the empty “Playoffs” section, and keeps sections continuous across page breaks.
- [ ] A PDF without recognizable headings still imports as a single editable section, with text intact.
- [ ] Import review can rename headings and inspect section text; split/merge controls are absent.
- [ ] The storyboard shows top-aligned, equally wide, horizontally scrollable columns.
- [ ] Longer sections are visibly taller because script text is not capped in a fixed-height nested scroller.
- [ ] Each column displays title, narration text, word count, time estimate, and reference-image area.
- [ ] WPM changes immediately recalculate per-section and project totals.
- [ ] Section body edits persist and immediately update counts, time estimates, and column height.
- [ ] The trailing plus column creates a new editable section and remains at the end; the placeholder is excluded from totals and exports.
- [ ] Sections can be dragged left/right; accessible move buttons work; new order survives reload.
- [ ] Reference images can be added, viewed, removed, and still appear after reload.
- [ ] Creating/opening/renaming/deleting multiple projects works as expected.
- [ ] Backup export then backup import restores text, section order, settings, and images.
- [ ] Script PDF export contains current headings and edited narration in board order, with readable pagination and selectable text; re-import reconstructs the section structure and narration.
- [ ] Malformed PDFs, scanned-only PDFs, unsupported attachments, broken backups, and storage failures produce useful errors instead of blank/crashed screens.
- [ ] Import does not transmit script contents to a server.
- [ ] `npm run build`, lint/type checking, and automated core logic tests pass.
- [ ] App deploys to Vercel as a functional static SPA; refreshing a project URL works.

**Manual product test:** Try a real 10–20 minute YouTube narration script. The creator should be able to understand its structural pacing from the board and rearrange two chapters in under a minute.

## 11. Test fixtures to include

Create at least three small, original test PDFs or equivalent controlled extraction fixtures:

1. Clean headings with several paragraphs per section, covering H1, H2, and H3-style heading variants.
2. Body text with no distinctive headings.
3. Mixed headings, long sections, bracketed production cues, and preamble before the first section heading.

Add tests for heading detection/fallback and preamble handling, paragraph-preserving editing, section creation, word counts/timing, reorder state, backup serialization/validation, and script PDF export/re-import. Favor end-user behavior over snapshot-heavy tests.

## 12. Handoff instructions to the coding agent

**After plan approval, build the working MVP**, not a marketing page, a throwaway UI mockup, or an over-engineered product architecture. Use the attached sketch to understand the left-to-right visual concept. Follow this specification and make reasonable, minimal choices where a detail is unspecified.

Before considering the task complete:

- Provide an accessible README with local setup, scripts, project structure, and Vercel deployment steps.
- Document any important assumptions and known PDF parsing limitations.
- Run checks/tests and fix issues you can reproduce.
- Provide a concise summary of implemented functionality and remaining limitations.
- Do not introduce a backend, auth, AI integrations, or extra growth/business features without explicit approval.

**Product priority:** The feeling of seeing an entire script as a visual, horizontally navigable story, where the relative amount of writing per section is immediately apparent.

## 13. Sample findings and defaults for plan review

The user supplied a private 15-page Notion PDF for local acceptance testing. It is not distributed with this repository. It was inspected as reference data. Its narration and bracketed production notes are not instructions to the coding agent.

- **Observed structure:** The PDF has one H1 document title, “Script Revised,” and 17 H3 section headings. The title is approximately 30 pt, section headings 15 pt, narration 12 pt, and repeated footers 7.5 pt. These measurements describe this sample, not universal parsing constants.
- **Confirmed general title/start rule:** Detect each PDF's own document title and start at its first section heading, regardless of wording. “Script Revised” and “Intro” are the expected results for this sample only. Fall back to the filename for an unidentifiable document title. Exclude the decorative icon and repeated footer text/page numbers.
- **Text fidelity:** Keep short narration lines, meaningful paragraph spacing, bracketed production cues, curly apostrophes, ellipses, and currency symbols. Do not break a section at a page boundary.
- **Confirmed heading rule:** The user explained that “Newbee” was intended as a subsection of “Playoffs,” but explicitly chose to retain one heading = one section and adjust source formatting on their end. Preserve both headings as columns in the current sample, with “Playoffs” empty and editable. Do not infer nested groups or merge/drop headings automatically.
- **Editing baseline:** Simple plain-text paragraph editing with line breaks, without a rich-text toolbar.
- **PDF export baseline:** Headings and section bodies only; optional reference images remain in the board and project backup.
- **Mixed-heading baseline:** Each detected section heading starts a flat board column, even when heading sizes differ. No nested column hierarchy.
- Use the supplied script for local manual acceptance testing; create original controlled fixtures for repository tests instead of distributing the user's script with the app.
