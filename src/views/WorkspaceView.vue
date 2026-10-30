<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import draggable from 'vuedraggable'
import {
  ArrowLeft,
  ArrowRight,
  Columns3,
  Check,
  ChevronDown,
  Clock3,
  Download,
  FileText,
  Hand,
  Archive,
  RotateCw,
  Undo2,
  Redo2,
} from '@lucide/vue'
import StoryboardColumn from '../components/StoryboardColumn.vue'
import Modal from '../components/Modal.vue'
import { projects } from '../services/storage'
import { cloudRepository } from '../services/cloud'
import { accountUser } from '../services/auth'
import { useProject } from '../composables/useProject'
import { useBoardPan } from '../composables/useBoardPan'
import {
  cloneDocument,
  download,
  errorMessage,
  limits,
  moveSection,
  narrationTime,
  safeFilename,
  wordCount,
} from '../utils'
import type { Section } from '../types'
import { validateImage } from '../services/media'

const route = useRoute()
const isCloud = route.query.storage === 'account'
const projectStore = isCloud ? cloudRepository(accountUser.value?.id ?? '') : projects
const {
  doc,
  sections,
  status,
  error: saveError,
  load,
  changed,
  flush,
  canUndo,
  canRedo,
  undo,
  redo,
  breakHistoryGroup,
} = useProject(projectStore)
const loading = ref(true),
  error = ref(''),
  busy = ref(''),
  notice = ref('')
const scroll = ref<HTMLDivElement>(),
  scrollPosition = ref(0),
  scrollMax = ref(0),
  exportMenu = ref<HTMLDetailsElement>(),
  glance = ref(false)
const {
  spaceHeld,
  panning,
  pointerdown,
  pointermove,
  end: endPan,
  click: panClick,
} = useBoardPan(scroll)
const deleteId = ref('')
const deletedSection = computed(() => sections.value.find((s) => s.id === deleteId.value))
const totalWords = computed(() => sections.value.reduce((n, s) => n + wordCount(s.text), 0))
const sectionDuration = (text: string) => wordCount(text) / (doc.value?.project.narrationWpm || 150)
function openSection(id: string) {
  glance.value = false
  void nextTick(() => {
    const column = scroll.value?.querySelector<HTMLElement>(`[data-section-id="${CSS.escape(id)}"]`)
    column?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'nearest', inline: 'center' })
    column?.querySelector<HTMLTextAreaElement>('.section-title')?.focus({ preventScroll: true })
  })
}
const animateSection = async (element: HTMLElement | null, direction: 'in' | 'out') => {
  if (!element || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const entering = direction === 'in'
  const animation = element.animate(
    entering
      ? [
          { opacity: 0, transform: 'translateY(7px) scale(.98)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ]
      : [
          { opacity: 1, transform: 'scale(1)' },
          { opacity: 0, transform: 'scale(.97)' },
        ],
    {
      duration: entering ? 190 : 150,
      easing: entering ? 'cubic-bezier(.2,.75,.3,1)' : 'ease-in',
      fill: 'both',
    },
  )
  if (!entering) await animation.finished.catch(() => {})
}
function historyAction(direction: 'undo' | 'redo') {
  if (busy.value || (direction === 'undo' ? !canUndo.value : !canRedo.value)) return false
  const restored = direction === 'undo' ? undo() : redo()
  if (!restored) return false
  notice.value = direction === 'undo' ? 'Change undone.' : 'Change redone.'
  void nextTick(syncScroll)
  return true
}
function historyKey(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.altKey ||
    !(event.ctrlKey || event.metaKey) ||
    document.querySelector('dialog[open]')
  )
    return
  const key = event.key.toLowerCase()
  if (key === 'z' && historyAction(event.shiftKey ? 'redo' : 'undo')) event.preventDefault()
  else if (key === 'y' && event.ctrlKey && historyAction('redo')) event.preventDefault()
}
function historyInput(event: Event) {
  const type = (event as InputEvent).inputType
  if (type === 'historyUndo' && historyAction('undo')) event.preventDefault()
  else if (type === 'historyRedo' && historyAction('redo')) event.preventDefault()
}
window.addEventListener('keydown', historyKey)
let resizeObserver: ResizeObserver | undefined
function syncScroll() {
  if (scroll.value) {
    scrollPosition.value = scroll.value.scrollLeft
    scrollMax.value = Math.max(0, scroll.value.scrollWidth - scroll.value.clientWidth)
  }
}
onMounted(async () => {
  try {
    await load(String(route.params.id))
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
  await nextTick()
  syncScroll()
  resizeObserver = new ResizeObserver(syncScroll)
  if (scroll.value) resizeObserver.observe(scroll.value)
})
onBeforeUnmount(() => resizeObserver?.disconnect())
onBeforeUnmount(() => window.removeEventListener('keydown', historyKey))
function navigate(offset: number) {
  const gap = scroll.value?.querySelector('.board-track')
  const columnGap = gap ? parseFloat(getComputedStyle(gap).columnGap) || 0 : 0
  scroll.value?.scrollBy({
    left: offset * ((scroll.value.querySelector('.script-column')?.clientWidth ?? 330) + columnGap),
    behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
  })
}
function scrub(event: Event) {
  if (scroll.value) scroll.value.scrollLeft = Number((event.target as HTMLInputElement).value)
}
function edit(id: string, field: 'title' | 'text', value: string) {
  const section = doc.value?.sections.find((s) => s.id === id)
  if (!section || !doc.value) return
  if (
    field === 'text' &&
    doc.value.sections.reduce((n, s) => n + (s.id === id ? value.length : s.text.length), 0) >
      limits.textChars
  ) {
    error.value = 'This project has reached its text limit. Create another project to continue.'
    return
  }
  section[field] = value
  changed(`${id}:${field}`)
}
function setSectionColor(id: string, color: Section['color']) {
  const section = doc.value?.sections.find((item) => item.id === id)
  if (!section) return
  if (color) section.color = color
  else delete section.color
  changed()
}
function reorder(next: Section[]) {
  if (doc.value) {
    doc.value.project.sectionOrder = next.map((s) => s.id)
    changed()
  }
}
const moveAnimations = new WeakMap<HTMLElement, Animation>()
async function move(id: string, offset: number) {
  if (doc.value) {
    const columns = Array.from(scroll.value?.querySelectorAll<HTMLElement>('.script-column') ?? [])
    const positions = new Map(
      columns.map((column) => [column, column.getBoundingClientRect().left]),
    )
    columns.forEach((column) => moveAnimations.get(column)?.cancel())
    doc.value.project.sectionOrder = moveSection(doc.value.project.sectionOrder, id, offset)
    changed()
    notice.value = 'Section moved.'
    await nextTick()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    for (const column of columns) {
      const distance = positions.get(column)! - column.getBoundingClientRect().left
      if (Math.abs(distance) < 1) continue
      moveAnimations.set(
        column,
        column.animate(
          [{ transform: `translateX(${distance}px)` }, { transform: 'translateX(0)' }],
          { duration: 150, easing: 'ease' },
        ),
      )
    }
  }
}
async function addSection(anchorId?: string, side: 'left' | 'right' = 'right') {
  if (!doc.value) return
  if (sections.value.length >= limits.sections) {
    error.value = 'A project can contain up to 500 sections.'
    return
  }
  const order = doc.value.project.sectionOrder
  const anchor = anchorId ? order.indexOf(anchorId) : -1
  if (anchorId && anchor < 0) return
  const position = anchor < 0 ? order.length : anchor + (side === 'right' ? 1 : 0)
  const id = crypto.randomUUID()
  doc.value.sections.push({
    id,
    projectId: doc.value.project.id,
    title: 'Untitled section',
    text: '',
    imageIds: [],
  })
  order.splice(position, 0, id)
  changed()
  await nextTick()
  syncScroll()
  const column = scroll.value?.querySelector<HTMLElement>(`[data-section-id="${id}"]`)
  void animateSection(column ?? null, 'in')
  const title = column?.querySelector<HTMLTextAreaElement>('.section-title')
  title?.focus()
  title?.select()
}
async function deleteSection() {
  if (!doc.value || !deleteId.value) return
  const id = deleteId.value
  const column = scroll.value?.querySelector<HTMLElement>(`[data-section-id="${id}"]`)
  await animateSection(column ?? null, 'out')
  if (!doc.value || deleteId.value !== id) return
  doc.value.sections = doc.value.sections.filter((s) => s.id !== id)
  doc.value.project.sectionOrder = doc.value.project.sectionOrder.filter(
    (sectionId) => sectionId !== id,
  )
  doc.value.images = doc.value.images.filter((i) => i.sectionId !== id)
  deleteId.value = ''
  changed()
  void nextTick(syncScroll)
}
function requestDelete(id: string) {
  if (sections.value.length <= 1)
    error.value =
      'Keep at least one section in your script. You can clear its text or delete the project from Your scripts.'
  else deleteId.value = id
}
function setWpm(event: Event, finalize = false) {
  if (!doc.value) return
  const input = event.target as HTMLInputElement
  const value = Number(input.value)
  if (!finalize && (!input.value || !Number.isFinite(value) || value < 100 || value > 220)) return
  doc.value.project.narrationWpm = Number.isFinite(value)
    ? Math.max(100, Math.min(220, Math.round(value)))
    : 150
  input.value = String(doc.value.project.narrationWpm)
  changed('reading-pace')
}
async function addImages(id: string, files: File[]) {
  if (!doc.value || busy.value) return
  const section = doc.value.sections.find((s) => s.id === id)
  if (!section) return
  error.value = ''
  busy.value = 'Adding images…'
  try {
    if (files.length + doc.value.images.length > limits.images)
      throw new Error('This project has reached its image limit. Remove some images first.')
    if (
      files.reduce((n, f) => n + f.size, 0) +
        doc.value.images.reduce((n, i) => n + i.blob.size, 0) >
      limits.expandedBytes - limits.manifestBytes
    )
      throw new Error(
        'These images would make the project too large to back up. Add smaller images or remove unused references.',
      )
    const additions = []
    for (const file of files) {
      const mimeType = await validateImage(file)
      additions.push({
        id: crypto.randomUUID(),
        projectId: doc.value.project.id,
        sectionId: id,
        filename: file.name.slice(0, 1000),
        mimeType,
        blob: new Blob([file], { type: mimeType }),
      })
    }
    doc.value.images.push(...additions)
    section.imageIds.push(...additions.map((i) => i.id))
    changed()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
function removeImage(id: string) {
  if (!doc.value) return
  doc.value.images = doc.value.images.filter((i) => i.id !== id)
  doc.value.sections.forEach((s) => {
    s.imageIds = s.imageIds.filter((imageId) => imageId !== id)
  })
  changed()
}
async function exportProject(kind: 'pdf' | 'backup') {
  if (!doc.value || busy.value) return
  if (exportMenu.value) exportMenu.value.open = false
  busy.value = kind === 'pdf' ? 'Creating script PDF…' : 'Creating project backup…'
  error.value = ''
  notice.value = ''
  try {
    // Export the current draft even when local storage is unavailable; a backup is the recovery path.
    await flush().catch(() => {})
    const snapshot = cloneDocument(doc.value)
    const blob =
      kind === 'pdf'
        ? await (await import('../services/pdf/export')).exportPdf(snapshot)
        : await (await import('../services/backup')).exportBackup(snapshot)
    download(
      blob,
      `${safeFilename(snapshot.project.title)}${kind === 'pdf' ? '.pdf' : '.storyboard.zip'}`,
    )
    notice.value = kind === 'pdf' ? 'Script PDF exported.' : 'Project backup exported.'
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
</script>
<template>
  <div v-if="loading" class="loading-page" role="status">Opening your storyboard…</div>
  <main v-else-if="!doc" id="main" class="not-found">
    <h1>{{ error ? 'Unable to open this project' : 'This project isn’t in this browser.' }}</h1>
    <p>
      {{
        error ||
        'Projects are saved on the device and browser where you created them. You can restore a backup from Your scripts.'
      }}
    </p>
    <RouterLink class="button primary" to="/">Back to your scripts</RouterLink>
  </main>
  <div v-else class="workspace" @focusout="breakHistoryGroup" @beforeinput="historyInput">
    <header class="workspace-header">
      <RouterLink :to="isCloud ? '/?storage=account' : '/?storage=local'" class="back-projects" aria-label="Back to your scripts"
        ><ArrowLeft :size="20"
      /></RouterLink>
      <div class="workspace-title">
        <input
          v-model="doc.project.title"
          aria-label="Project title"
          maxlength="1000"
          @input="changed('project-title')"
          @blur="
            !doc.project.title.trim() &&
            ((doc.project.title = 'Untitled script'), changed('project-title'))
          "
        /><span><FileText :size="12" /> {{ doc.project.sourceFilename || 'Your script' }}</span>
      </div>
      <div class="workspace-stats">
        <div class="totals">
          <span
            ><strong>{{ sections.length }}</strong> sections</span
          ><span
            ><strong>{{ totalWords.toLocaleString() }}</strong> words</span
          ><span class="total-time"
            ><Clock3 :size="15" /><strong>{{
              narrationTime(totalWords, doc.project.narrationWpm)
            }}</strong>
            estimated narration</span
          >
        </div>
        <label class="wpm-control"
          ><span>Reading pace</span
          ><input
            :value="doc.project.narrationWpm"
            type="number"
            min="100"
            max="220"
            step="5"
            aria-label="Words per minute"
            @input="setWpm($event)"
            @change="setWpm($event, true)"
            @blur="setWpm($event, true)"
          /><span>WPM</span></label
        >
      </div>
      <button
        class="button secondary glance-toggle"
        :aria-pressed="glance"
        @click="glance = !glance"
      ><Columns3 :size="16" /> {{ glance ? 'Back to board' : 'Story at a glance' }}</button>
      <span class="save-status" :class="status" role="status"
        ><Check v-if="status === 'saved'" :size="14" /><span v-else class="status-dot" />{{
          status === 'saved' ? (isCloud ? 'Synced' : 'Saved locally') : status === 'saving' ? 'Saving…' : 'Not saved'
        }}</span
      >
      <div class="history-controls" role="group" aria-label="Edit history">
        <button
          class="icon-button"
          aria-label="Undo"
          title="Undo (Ctrl/⌘ Z)"
          :disabled="!canUndo || !!busy"
          @click="historyAction('undo')"
        >
          <Undo2 :size="18" />
        </button>
        <button
          class="icon-button"
          aria-label="Redo"
          title="Redo (Ctrl/⌘ Shift Z)"
          :disabled="!canRedo || !!busy"
          @click="historyAction('redo')"
        >
          <Redo2 :size="18" />
        </button>
      </div>
      <details ref="exportMenu" class="export-menu">
        <summary class="button secondary" :aria-disabled="!!busy">
          <Download :size="16" /> Export <ChevronDown :size="14" />
        </summary>
        <div class="export-options">
          <button :disabled="!!busy" @click="exportProject('pdf')">
            <FileText :size="18" /><span
              >Script PDF<small>Headings and narration, in order</small></span
            ></button
          ><button :disabled="!!busy" @click="exportProject('backup')">
            <Archive :size="18" /><span
              >Project backup<small>Script, settings, and images</small></span
            >
          </button>
        </div>
      </details>
    </header>
    <div v-if="saveError || error" class="error-banner" role="alert">
      <span>{{ error || saveError }}</span
      ><button v-if="saveError" class="text-button" @click="flush().catch(() => {})">
        <RotateCw :size="15" /> Retry save</button
      ><button v-if="error" class="text-button" @click="error = ''">Dismiss</button>
    </div>
    <main
      v-if="glance"
      class="glance-view"
      aria-label="All script sections at a glance"
    >
      <div class="glance-view-board">
        <button
          v-for="(section, index) in sections"
          :key="section.id"
          class="glance-view-card"
          :class="section.color ? 'has-section-color' : ''"
          :style="{
            '--section-height': `${Math.max(0.34, Math.sqrt(Math.max(0.12, sectionDuration(section.text))))}`,
            ...(section.color ? { '--section-color': `var(--section-${section.color})` } : {}),
          }"
          :aria-label="`Open section ${index + 1}: ${section.title || 'Untitled section'}, ${narrationTime(wordCount(section.text), doc.project.narrationWpm)} estimated`"
          @click="openSection(section.id)"
        >
          <span class="glance-view-index">{{ String(index + 1).padStart(2, '0') }} <span>{{ wordCount(section.text).toLocaleString() }} words</span></span>
          <strong>{{ section.title || 'Untitled section' }}</strong>
          <span class="glance-view-excerpt">{{ section.text.trim().split('\n').filter(Boolean).slice(0, 4).join(' ') || 'No script text yet.' }}</span>
          <span class="glance-view-time">{{ narrationTime(wordCount(section.text), doc.project.narrationWpm) }} <span>estimated</span></span>
          <span v-if="section.imageIds.length" class="glance-view-images">{{ section.imageIds.length }} reference {{ section.imageIds.length === 1 ? 'image' : 'images' }}</span>
        </button>
      </div>
    </main>
    <main
      v-else
      id="main"
      ref="scroll"
      class="board-scroll"
      aria-label="Script storyboard"
      tabindex="0"
      :class="{ 'pan-ready': spaceHeld, panning }"
      @pointerdown.capture="pointerdown"
      @pointermove="pointermove"
      @pointerup="endPan"
      @pointercancel="endPan"
      @lostpointercapture="endPan"
      @click.capture="panClick"
      @scroll="syncScroll"
    >
      <draggable
        :model-value="sections"
        item-key="id"
        class="board-track"
        handle=".drag-handle"
        :animation="150"
        :disabled="spaceHeld || panning"
        direction="horizontal"
        ghost-class="column-ghost"
        :scroll-sensitivity="90"
        :scroll-speed="14"
        @update:model-value="reorder"
      >
        <template #item="{ element, index }"
          ><StoryboardColumn
            :section="element"
            :index="index"
            :count="sections.length"
            :wpm="doc.project.narrationWpm"
            :images="doc.images.filter((i) => element.imageIds.includes(i.id))"
            @color="setSectionColor"
            @edit="edit"
            @insert="addSection"
            @move="move"
            @add-images="addImages"
            @remove-image="removeImage"
            @remove-section="requestDelete"
        /></template>
      </draggable>
    </main>
    <footer class="board-navigation">
      <span class="board-hint"
        ><Hand :size="13" />{{
          busy || notice || 'Esc to stop typing. Hold Space + drag to pan.'
        }}</span
      >
      <div class="board-scroll-controls">
        <button
          class="icon-button"
          aria-label="Scroll to earlier sections"
          :disabled="scrollPosition < 1"
          @click="navigate(-1)"
        >
          <ArrowLeft :size="18" /></button
        ><input
          type="range"
          min="0"
          :max="scrollMax"
          :value="scrollPosition"
          :disabled="!scrollMax"
          aria-label="Scroll through sections"
          @input="scrub"
        /><button
          class="icon-button"
          aria-label="Scroll to later sections"
          :disabled="scrollPosition >= scrollMax - 1"
          @click="navigate(1)"
        >
          <ArrowRight :size="18" />
        </button>
      </div>
      <span class="pace-note">Timing excludes pauses &amp; editing.</span>
    </footer>
    <span class="visually-hidden" role="status">{{ notice || busy }}</span>
    <Modal :open="!!deleteId" title="Delete this section?" @close="deleteId = ''"
      ><p>
        “{{ deletedSection?.title }}” and its reference images will be removed from this script.
      </p>
      <div class="dialog-actions">
        <button class="button secondary" @click="deleteId = ''">Keep section</button
        ><button class="button danger" @click="deleteSection">Delete section</button>
      </div></Modal
    >
  </div>
</template>
