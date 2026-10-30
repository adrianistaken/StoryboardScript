<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  FileText,
  FolderOpen,
  HardDrive,
  Pencil,
  Trash2,
  ArchiveRestore,
  Plus,
} from '@lucide/vue'
import Brand from '../components/Brand.vue'
import Modal from '../components/Modal.vue'
import ImportReview from '../components/ImportReview.vue'
import type { ImportDraft, Project } from '../types'
import { projects } from '../services/storage'
import { createDocument, errorMessage, narrationTime, wordCount } from '../utils'
import { createExample } from '../example'

const router = useRouter()
const saved = ref<Project[]>([]),
  loading = ref(true),
  busy = ref(''),
  error = ref('')
const draft = ref<ImportDraft>(),
  pdfPicker = ref<HTMLInputElement>(),
  backupPicker = ref<HTMLInputElement>()
const dragging = ref(false),
  progress = ref(0)
const target = ref<Project>(),
  action = ref<'rename' | 'delete'>('rename'),
  renameTitle = ref('')
async function refresh() {
  try {
    saved.value = await projects.list()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    loading.value = false
  }
}
onMounted(refresh)
async function readPdf(file?: File) {
  if (!file || busy.value) return
  error.value = ''
  busy.value = 'Reading your PDF…'
  progress.value = 0
  try {
    const { importPdf } = await import('../services/pdf/import')
    draft.value = await importPdf(file, (current, total) => {
      progress.value = (current / total) * 100
      busy.value = `Reading page ${Math.min(current + 1, total)} of ${total}…`
    })
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
function pdfSelected(event: Event) {
  const el = event.target as HTMLInputElement
  void readPdf(el.files?.[0])
  el.value = ''
}
function dropped(event: DragEvent) {
  dragging.value = false
  void readPdf(event.dataTransfer?.files[0])
}
async function confirmImport(value: ImportDraft) {
  busy.value = 'Saving project…'
  error.value = ''
  try {
    const doc = createDocument(value)
    await projects.save(doc)
    draft.value = undefined
    await router.push(`/project/${doc.project.id}`)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
async function restore(event: Event) {
  const el = event.target as HTMLInputElement,
    file = el.files?.[0]
  el.value = ''
  if (!file) return
  busy.value = 'Restoring your project…'
  error.value = ''
  try {
    const { importBackup } = await import('../services/backup')
    const doc = await importBackup(file)
    await projects.save(doc)
    await router.push(`/project/${doc.project.id}`)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
async function example() {
  busy.value = 'Opening example…'
  error.value = ''
  try {
    const doc = createExample()
    await projects.save(doc)
    await router.push(`/project/${doc.project.id}`)
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
function manage(project: Project, mode: 'rename' | 'delete') {
  target.value = project
  action.value = mode
  renameTitle.value = project.title
}
async function completeAction() {
  if (!target.value) return
  try {
    if (action.value === 'delete') await projects.delete(target.value.id)
    else await projects.rename(target.value.id, renameTitle.value)
    target.value = undefined
    await refresh()
  } catch (e) {
    error.value = errorMessage(e)
  }
}
const dateLabel = (date: string) =>
  new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(date))
const storyPreview = createExample()
const previewSections = computed(() =>
  storyPreview.project.sectionOrder.map((id) => storyPreview.sections.find((section) => section.id === id)!),
)
const previewWords = computed(() => previewSections.value.reduce((total, section) => total + wordCount(section.text), 0))
</script>
<template>
  <div class="home-page">
    <header class="home-header">
      <Brand /><span class="local-label"><HardDrive :size="15" /> Saved in this browser</span>
    </header>
    <div v-if="error" class="error-banner" role="alert">
      <span>{{ error }}</span
      ><button class="text-button" @click="error = ''">Dismiss</button>
    </div>
    <input
      ref="pdfPicker"
      data-testid="pdf-input"
      type="file"
      accept="application/pdf,.pdf"
      class="visually-hidden"
      tabindex="-1"
      aria-label="Choose script PDF"
      @change="pdfSelected"
    />
    <input
      ref="backupPicker"
      data-testid="backup-input"
      type="file"
      accept="application/zip,.zip"
      class="visually-hidden"
      tabindex="-1"
      aria-label="Choose project backup"
      @change="restore"
    />
    <ImportReview
      v-if="draft"
      :draft="draft"
      :busy="!!busy"
      @cancel="draft = undefined"
      @confirm="confirmImport"
    />
    <main v-else id="main" class="home-main">
      <section class="home-intro">
        <div class="intro-copy">
          <h1>See the shape<br />of your story.</h1>
          <p>
            Turn your script into a storyboard.<br />Find the rhythm. Make room for a better idea.
          </p>
          <button class="text-button sample-button" :disabled="!!busy" @click="example">
            Explore an example <ArrowRight :size="16" />
          </button>
        </div>
        <div class="story-glance" aria-label="Example script section overview">
          <div class="glance-heading">
            <div>
              <span class="glance-kicker">SCRIPT OVERVIEW</span>
              <h2>The story at a glance</h2>
            </div>
            <span class="glance-total">{{ narrationTime(previewWords, storyPreview.project.narrationWpm) }} <small>estimated</small></span>
          </div>
          <div class="glance-board">
            <article
              v-for="(section, index) in previewSections"
              :key="section.id"
              class="glance-section"
              :class="`glance-section-${index + 1}`"
            >
              <span class="glance-accent" :class="`glance-accent-${index + 1}`" />
              <span class="glance-number">{{ String(index + 1).padStart(2, '0') }}</span>
              <h3>{{ section.title }}</h3>
              <p>{{ section.text.split('\n').filter(Boolean).slice(0, 2).join(' ') }}</p>
              <span class="glance-duration">{{ narrationTime(wordCount(section.text), storyPreview.project.narrationWpm) }}</span>
            </article>
          </div>
          <p class="glance-caption">See the structure, pacing, and estimated narration time before you dive in.</p>
        </div>
      </section>
      <section
        class="import-zone"
        :class="{ dragging, 'is-busy': busy }"
        aria-label="Import a script PDF"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="dropped"
      >
        <div class="import-symbol"><FileText :size="26" :stroke-width="1.4" /></div>
        <div class="import-copy">
          <h2>{{ busy || 'Start with your script' }}</h2>
          <p>
            {{
              busy
                ? 'Your file is processed here in your browser.'
                : 'Drop a PDF here. Each heading becomes a section.'
            }}
          </p>
          <small v-if="!busy">Selectable-text PDFs, up to 25 MB</small
          ><progress v-else :value="progress || undefined" max="100" aria-label="Import progress" />
        </div>
        <button class="button primary" :disabled="!!busy" @click="pdfPicker?.click()">
          <Plus :size="18" /> Import PDF
        </button>
      </section>
      <section class="saved-projects" aria-labelledby="saved-title">
        <div class="section-header">
          <h2 id="saved-title">
            Your scripts <span v-if="saved.length" class="count-badge">{{ saved.length }}</span>
          </h2>
          <button class="text-button" :disabled="!!busy" @click="backupPicker?.click()">
            <ArchiveRestore :size="17" /> Import backup
          </button>
        </div>
        <p v-if="loading" class="empty-projects">Loading your scripts…</p>
        <div v-else-if="!saved.length" class="empty-projects">
          <FolderOpen :size="28" :stroke-width="1.3" />
          <p>Your stories will live here.</p>
          <small>Import a script to start shaping it.</small>
        </div>
        <div v-else class="project-list">
          <div v-for="project in saved" :key="project.id" class="project-row">
            <RouterLink :to="`/project/${project.id}`" class="project-link"
              ><span class="project-icon"><FileText :size="21" :stroke-width="1.4" /></span
              ><span class="project-info"
                ><strong>{{ project.title }}</strong
                ><small>{{ project.sourceFilename || 'Your script' }}</small></span
              ><span class="project-date"
                >Edited {{ dateLabel(project.updatedAt) }}</span
              ></RouterLink
            >
            <button
              class="icon-button"
              :aria-label="`Rename ${project.title}`"
              @click="manage(project, 'rename')"
            >
              <Pencil :size="16" /></button
            ><button
              class="icon-button"
              :aria-label="`Delete ${project.title}`"
              @click="manage(project, 'delete')"
            >
              <Trash2 :size="16" /></button
            ><RouterLink
              :to="`/project/${project.id}`"
              class="icon-button"
              :aria-label="`Open ${project.title}`"
              ><ArrowRight :size="18"
            /></RouterLink>
          </div>
        </div>
      </section>
      <footer class="home-footer">
        <HardDrive :size="15" />
        <p>
          Private by design. Your scripts stay on this device.<br /><span
            >Export a project backup to move between browsers or keep a safe copy.</span
          >
        </p>
      </footer>
    </main>
    <Modal
      :open="!!target"
      :title="action === 'rename' ? 'Rename project' : 'Delete project?'"
      @close="target = undefined"
    >
      <form v-if="action === 'rename'" @submit.prevent="completeAction">
        <label class="field-label"
          >Project title<input v-model="renameTitle" autofocus maxlength="1000"
        /></label>
        <div class="dialog-actions">
          <button type="button" class="button secondary" @click="target = undefined">Cancel</button
          ><button class="button primary" :disabled="!renameTitle.trim()">Save name</button>
        </div>
      </form>
      <template v-else
        ><p>
          “{{ target?.title }}” and its reference images will be removed from this browser. Export a
          backup first if you want to keep a copy.
        </p>
        <div class="dialog-actions">
          <button class="button secondary" @click="target = undefined">Keep project</button
          ><button class="button danger" @click="completeAction">Delete project</button>
        </div></template
      >
    </Modal>
  </div>
</template>
