<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
  CloudUpload,
} from '@lucide/vue'
import Brand from '../components/Brand.vue'
import AccountMenu from '../components/AccountMenu.vue'
import { accountUser, accountsEnabled } from '../services/auth'
import { cloudRepository } from '../services/cloud'
import Modal from '../components/Modal.vue'
import ImportReview from '../components/ImportReview.vue'
import type { ImportDraft, Project } from '../types'
import { projects } from '../services/storage'
import { createDocument, errorMessage, narrationTime, wordCount } from '../utils'
import { createExample } from '../example'

const router = useRouter()
const cloud = computed(() => accountUser.value ? cloudRepository(accountUser.value.id) : undefined)
const destination = computed(() => cloud.value ?? projects)
const destinationSource = computed(() => cloud.value ? 'account' : 'local')
const projectUrl = (id: string, source: 'local' | 'account' = destinationSource.value) =>
  `/project/${id}${source === 'account' ? '?storage=account' : ''}`
let refreshVersion = 0
const attemptedAutoMove = new Set<string>()
const saved = ref<Project[]>([]),
  localSaved = ref<Project[]>([]),
  loading = ref(true),
  moving = ref(false),
  busy = ref(''),
  error = ref('')
const draft = ref<ImportDraft>(),
  pdfPicker = ref<HTMLInputElement>(),
  backupPicker = ref<HTMLInputElement>()
const dragging = ref(false),
  progress = ref(0)
const target = ref<Project>(),
  targetSource = ref<'local' | 'account'>('local'),
  action = ref<'rename' | 'delete'>('rename'),
  renameTitle = ref('')
async function refresh() {
  const version = ++refreshVersion
  loading.value = true
  saved.value = []
  localSaved.value = []
  try {
    const local = await projects.list()
    if (version !== refreshVersion) return
    if (cloud.value) {
      localSaved.value = local
      saved.value = await cloud.value.list()
      const owner = accountUser.value?.id
      if (owner && local.length && !attemptedAutoMove.has(owner) && !moving.value) {
        attemptedAutoMove.add(owner)
        void moveDeviceScripts(local)
      }
    } else saved.value = local
  } catch (e) {
    if (version === refreshVersion) error.value = errorMessage(e)
  } finally {
    if (version === refreshVersion) loading.value = false
  }
}
function sameDocument(a: Awaited<ReturnType<typeof projects.load>>, b: Awaited<ReturnType<typeof projects.load>>) {
  if (!a || !b) return false
  return JSON.stringify(a.project) === JSON.stringify(b.project)
    && JSON.stringify(a.sections) === JSON.stringify(b.sections)
    && JSON.stringify(a.images.map(({ blob, ...image }) => ({ ...image, size: blob.size })))
      === JSON.stringify(b.images.map(({ blob, ...image }) => ({ ...image, size: blob.size })))
}
async function transfer(project: Project) {
  const destination = cloud.value
  if (!destination) throw new Error('Sign in again to move this script.')
  const doc = await projects.load(project.id)
  if (!doc) return
  const existing = await destination.load(project.id)
  if (existing && !sameDocument(doc, existing)) {
    throw new Error(`“${project.title}” already exists in your account with different edits. Move it manually to keep both versions.`)
  }
  if (!existing) await destination.save(doc)
  const verified = await destination.load(project.id)
  if (!sameDocument(doc, verified)) throw new Error(`Could not verify “${project.title}” in your account.`)
  const latest = await projects.load(project.id)
  if (!sameDocument(doc, latest)) throw new Error(`“${project.title}” changed during sync. It remains on this device; retry to upload the latest edits.`)
  await projects.delete(project.id)
}
async function moveDeviceScripts(items: Project[]) {
  if (moving.value || !cloud.value) return
  moving.value = true
  busy.value = 'Adding device scripts to your account…'
  const failures: string[] = []
  try {
    for (const item of items) {
      try { await transfer(item) } catch (e) { failures.push(errorMessage(e)) }
    }
    if (failures.length) error.value = `Some scripts stayed on this device. ${failures[0]}`
    else error.value = ''
  } finally {
    moving.value = false
    busy.value = ''
    await refresh()
  }
}
watch(() => accountUser.value?.id, () => {
  target.value = undefined
  error.value = ''
})
watch(() => accountUser.value?.id, refresh, { immediate: true })
async function moveToAccount(project: Project) {
  if (!cloud.value || busy.value) return
  busy.value = 'Moving script to your account…'
  error.value = ''
  const destination = cloud.value
  try {
    const doc = await projects.load(project.id)
    if (!doc) throw new Error('This script could not be found in this browser.')
    const { exportBackup, importBackup } = await import('../services/backup')
    const copy = await importBackup(await exportBackup(doc))
    await destination.save(copy)
    if (!await destination.load(copy.project.id)) throw new Error('The account copy could not be verified.')
    const latest = await projects.load(project.id)
    if (!sameDocument(doc, latest)) throw new Error('This script changed during transfer. It remains on this device.')
    await projects.delete(project.id)
    await refresh()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
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
  if (busy.value) return
  const store = destination.value, source = destinationSource.value
  busy.value = 'Saving project…'
  error.value = ''
  try {
    const doc = createDocument(value)
    await store.save(doc)
    draft.value = undefined
    await router.push(projectUrl(doc.project.id, source))
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
async function restore(event: Event) {
  if (busy.value) return
  const store = destination.value, source = destinationSource.value
  const el = event.target as HTMLInputElement,
    file = el.files?.[0]
  el.value = ''
  if (!file) return
  busy.value = 'Restoring your project…'
  error.value = ''
  try {
    const { importBackup } = await import('../services/backup')
    const doc = await importBackup(file)
    await store.save(doc)
    await router.push(projectUrl(doc.project.id, source))
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
async function example() {
  if (busy.value) return
  const store = destination.value, source = destinationSource.value
  busy.value = 'Opening example…'
  error.value = ''
  try {
    const doc = createExample()
    await store.save(doc)
    await router.push(projectUrl(doc.project.id, source))
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
function manage(project: Project, mode: 'rename' | 'delete', source: 'local' | 'account') {
  target.value = project
  targetSource.value = source
  action.value = mode
  renameTitle.value = project.title
}
async function completeAction() {
  if (!target.value || busy.value) return
  busy.value = 'Updating script…'
  try {
    const store = targetSource.value === 'account' ? cloud.value : projects
    if (!store) throw new Error('Sign in again to update this script.')
    if (action.value === 'delete') await store.delete(target.value.id)
    else await store.rename(target.value.id, renameTitle.value)
    target.value = undefined
    await refresh()
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
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
      <Brand /><AccountMenu /><span v-if="!accountsEnabled" class="local-label"><HardDrive :size="15" /> Saved in this browser</span>
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
        <p class="library-description">{{ accountUser ? 'Saved to your account and available on your devices.' : 'Saved in this browser. Sign in to bring your scripts to your account.' }}</p>
        <p v-if="loading" class="empty-projects">Loading your scripts…</p>
        <div v-else-if="!saved.length" class="empty-projects">
          <FolderOpen :size="28" :stroke-width="1.3" />
          <p>{{ accountUser ? 'No scripts in your account yet.' : 'Your stories will live here.' }}</p>
          <small>{{ accountUser && localSaved.length ? 'Move a script from this device below, or import a new one.' : 'Import a script to start shaping it.' }}</small>
        </div>
        <div v-else class="project-list">
          <div v-for="project in saved" :key="project.id" class="project-row">
            <RouterLink :to="projectUrl(project.id)" class="project-link"
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
              :disabled="!!busy"
              @click="manage(project, 'rename', destinationSource)"
            >
              <Pencil :size="16" /></button
            ><button
              class="icon-button"
              :aria-label="`Delete ${project.title}`"
              :disabled="!!busy"
              @click="manage(project, 'delete', destinationSource)"
            >
              <Trash2 :size="16" /></button
            ><RouterLink
              :to="projectUrl(project.id)"
              class="icon-button"
              :aria-label="`Open ${project.title}`"
              ><ArrowRight :size="18"
            /></RouterLink>
          </div>
        </div>
        <div v-if="accountUser && localSaved.length" class="device-projects">
          <div class="section-header"><h2>Only on this device <span class="count-badge">{{ localSaved.length }}</span></h2></div>
          <p class="library-description">These scripts could not sync yet. They are safe on this device; retry when you are online.</p>
          <div v-for="project in localSaved" :key="project.id" class="project-row">
            <RouterLink :to="projectUrl(project.id, 'local')" class="project-link">
              <span class="project-icon"><FileText :size="21" :stroke-width="1.4" /></span>
              <span class="project-info"><strong>{{ project.title }}</strong><small>{{ project.sourceFilename || 'Your script' }}</small></span>
              <span class="project-date">Edited {{ dateLabel(project.updatedAt) }}</span>
            </RouterLink>
            <button class="text-button copy-account" :disabled="!!busy" @click="moveToAccount(project)"><CloudUpload :size="16" /> Retry sync</button>
            <button class="icon-button" :aria-label="`Rename ${project.title}`" :disabled="!!busy" @click="manage(project, 'rename', 'local')"><Pencil :size="16" /></button>
            <button class="icon-button" :aria-label="`Delete ${project.title}`" :disabled="!!busy" @click="manage(project, 'delete', 'local')"><Trash2 :size="16" /></button>
            <RouterLink :to="projectUrl(project.id, 'local')" class="icon-button" :aria-label="`Open ${project.title}`"><ArrowRight :size="18" /></RouterLink>
          </div>
        </div>
      </section>
      <footer class="home-footer">
        <HardDrive v-if="!accountUser" :size="15" /><CloudUpload v-else :size="15" />
        <p>
          {{ accountUser ? 'New scripts sync to your account.' : 'Scripts in this browser stay on this device.' }}<br /><span
            >Export a project backup to keep a separate copy.</span
          >
        </p>
        <RouterLink to="/privacy" class="footer-privacy">Privacy Policy</RouterLink>
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
          “{{ target?.title }}” and its reference images will be removed from {{ targetSource === 'account' ? 'your account' : 'this browser' }}. Export a
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
