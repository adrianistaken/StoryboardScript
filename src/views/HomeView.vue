<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
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
  Copy,
  TriangleAlert,
  CircleCheck,
} from '@lucide/vue'
import { accountUser } from '../services/auth'
import { cloudRepository } from '../services/cloud'
import Modal from '../components/Modal.vue'
import ImportReview from '../components/ImportReview.vue'
import type { ImportDraft, Project } from '../types'
import { projects } from '../services/storage'
import { libraryCache } from '../services/libraryCache'
import { createDocument, duplicateDocument, errorMessage, narrationTime, wordCount } from '../utils'
import { createExample } from '../example'

const props = withDefaults(defineProps<{ projectsOnly?: boolean }>(), { projectsOnly: false })

const libraryKey = () => accountUser.value?.id ?? 'local'
const router = useRouter()
const cloud = computed(() => accountUser.value ? cloudRepository(accountUser.value.id) : undefined)
const destination = computed(() => cloud.value ?? projects)
const destinationSource = computed(() => cloud.value ? 'account' : 'local')
const projectUrl = (id: string, source: 'local' | 'account' = destinationSource.value) => {
  const query = new URLSearchParams()
  if (source === 'account') query.set('storage', 'account')
  if (props.projectsOnly) query.set('from', 'projects')
  return `/project/${id}${query.size ? `?${query}` : ''}`
}
let refreshVersion = 0
let successTimer: ReturnType<typeof setTimeout> | undefined
const saved = ref<Project[]>(libraryCache.get(libraryKey())?.saved ?? []),
  localSaved = ref<Project[]>(libraryCache.get(libraryKey())?.localSaved ?? []),
  loading = ref(!libraryCache.has(libraryKey())),
  busy = ref(''),
  error = ref(''),
  transferError = ref<{ id: string; message: string }>(),
  transferSuccess = ref(''),
  transferInProgress = ref('')
const draft = ref<ImportDraft>(),
  pdfPicker = ref<HTMLInputElement>(),
  backupPicker = ref<HTMLInputElement>()
const dragging = ref(false),
  progress = ref(0)
const importBusy = computed(() => transferInProgress.value ? '' : busy.value)
const target = ref<Project>(),
  targetSource = ref<'local' | 'account'>('local'),
  action = ref<'rename' | 'duplicate' | 'delete'>('rename'),
  renameTitle = ref('')
async function refresh(showLoading = true) {
  const version = ++refreshVersion
  const key = libraryKey()
  const cached = libraryCache.get(key)
  saved.value = cached?.saved ?? []
  localSaved.value = cached?.localSaved ?? []
  loading.value = showLoading && !cached
  try {
    const local = await projects.list()
    if (version !== refreshVersion) return
    if (cloud.value) {
      const account = await cloud.value.list()
      if (version !== refreshVersion) return
      localSaved.value = local
      saved.value = account
    } else {
      localSaved.value = []
      saved.value = local
    }
    libraryCache.set(key, { saved: saved.value, localSaved: localSaved.value })
  } catch (e) {
    if (version === refreshVersion) error.value = errorMessage(e)
  } finally {
    if (version === refreshVersion) loading.value = false
  }
}
function sameDocument(a: Awaited<ReturnType<typeof projects.load>>, b: Awaited<ReturnType<typeof projects.load>>) {
  if (!a || !b) return false
  const normalized = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(normalized)
    if (value && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => [key, normalized(entry)]))
    return value
  }
  const withoutBlobs = (images: typeof a.images) => images.map(({ blob, ...image }) => ({ ...image, size: blob.size }))
  return JSON.stringify(normalized(a.project)) === JSON.stringify(normalized(b.project))
    && JSON.stringify(normalized(a.sections)) === JSON.stringify(normalized(b.sections))
    && JSON.stringify(normalized(withoutBlobs(a.images))) === JSON.stringify(normalized(withoutBlobs(b.images)))
}
async function sameContent(a: NonNullable<Awaited<ReturnType<typeof projects.load>>>, b: NonNullable<Awaited<ReturnType<typeof projects.load>>>) {
  if (a.project.title !== b.project.title || a.project.sourceFilename !== b.project.sourceFilename ||
      a.project.narrationWpm !== b.project.narrationWpm || a.sections.length !== b.sections.length ||
      a.images.length !== b.images.length) return false
  for (let index = 0; index < a.project.sectionOrder.length; index++) {
    const first = a.sections.find((section) => section.id === a.project.sectionOrder[index])
    const second = b.sections.find((section) => section.id === b.project.sectionOrder[index])
    if (!first || !second || first.title !== second.title || first.text !== second.text || first.color !== second.color ||
        first.imageIds.length !== second.imageIds.length) return false
    for (let imageIndex = 0; imageIndex < first.imageIds.length; imageIndex++) {
      const left = a.images.find((image) => image.id === first.imageIds[imageIndex])
      const right = b.images.find((image) => image.id === second.imageIds[imageIndex])
      if (!left || !right || left.filename !== right.filename || left.mimeType !== right.mimeType || left.blob.size !== right.blob.size) return false
      const leftBytes = new Uint8Array(await left.blob.arrayBuffer())
      const rightBytes = new Uint8Array(await right.blob.arrayBuffer())
      if (leftBytes.some((byte, offset) => byte !== rightBytes[offset])) return false
    }
  }
  return true
}
watch(() => accountUser.value?.id, () => {
  target.value = undefined
  error.value = ''
  transferSuccess.value = ''
  if (successTimer) clearTimeout(successTimer)
})
onUnmounted(() => {
  if (successTimer) clearTimeout(successTimer)
})
watch(() => accountUser.value?.id, () => refresh(), { immediate: true })
async function moveToAccount(project: Project) {
  if (!cloud.value || busy.value) return
  busy.value = 'Moving script to your account…'
  transferInProgress.value = project.id
  transferError.value = undefined
  transferSuccess.value = ''
  if (successTimer) clearTimeout(successTimer)
  const destination = cloud.value
  try {
    const doc = await projects.load(project.id)
    if (!doc) throw new Error('This script could not be found in this browser.')
    let alreadyInAccount = false
    for (const candidate of (await destination.list()).filter((item) => item.title === doc.project.title)) {
      const accountDoc = await destination.load(candidate.id)
      if (accountDoc && await sameContent(doc, accountDoc)) {
        alreadyInAccount = true
        break
      }
    }
    if (!alreadyInAccount) {
      const copy = duplicateDocument(doc)
      copy.project.title = doc.project.title
      await destination.save(copy)
      if (!sameDocument(copy, await destination.load(copy.project.id)))
        throw new Error('The account copy could not be verified. Your script remains on this device.')
    }
    const latest = await projects.load(project.id)
    if (!sameDocument(doc, latest)) throw new Error('This script changed during transfer. It remains on this device.')
    await projects.delete(project.id)
    await refresh(false)
    transferSuccess.value = `“${project.title}” was added to your account.`
    successTimer = setTimeout(() => { transferSuccess.value = '' }, 5000)
  } catch (e) {
    transferError.value = { id: project.id, message: errorMessage(e) }
  } finally {
    transferInProgress.value = ''
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
async function startBlank() {
  if (busy.value) return
  const store = destination.value, source = destinationSource.value
  busy.value = 'Creating your story…'
  error.value = ''
  try {
    const doc = createDocument({ title: 'Untitled story', sourceFilename: '', sections: [{ title: 'Untitled section', text: '' }] })
    await store.save(doc)
    await router.push(projectUrl(doc.project.id, source))
  } catch (e) {
    error.value = errorMessage(e)
  } finally {
    busy.value = ''
  }
}
function manage(project: Project, mode: 'rename' | 'duplicate' | 'delete', source: 'local' | 'account') {
  target.value = project
  targetSource.value = source
  action.value = mode
  renameTitle.value = mode === 'duplicate' ? `${project.title} (copy)` : project.title
}
async function completeAction() {
  if (!target.value || busy.value) return
  busy.value = 'Updating script…'
  try {
    const store = targetSource.value === 'account' ? cloud.value : projects
    if (!store) throw new Error('Sign in again to update this script.')
    if (action.value === 'delete') await store.delete(target.value.id)
    else if (action.value === 'rename') await store.rename(target.value.id, renameTitle.value)
    else {
      const original = await store.load(target.value.id)
      if (!original) throw new Error('This script could not be found.')
      const copy = duplicateDocument(original)
      copy.project.title = renameTitle.value.trim()
      await store.save(copy)
    }
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
    <main v-else id="main" class="home-main" :class="{ 'projects-page-main': projectsOnly }">
      <section v-if="!projectsOnly" class="home-intro">
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
        :class="{ dragging, 'is-busy': importBusy }"
        aria-label="Import a script PDF"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="dropped"
      >
        <div class="import-symbol"><FileText :size="26" :stroke-width="1.4" /></div>
        <div class="import-copy">
          <h2>{{ importBusy || 'Start with your script' }}</h2>
          <p>
            {{
              importBusy
                ? 'Your file is processed here in your browser.'
                : 'Begin with an empty story, or drop a PDF here to turn its headings into sections.'
            }}
          </p>
          <small v-if="!importBusy">PDFs need selectable text and can be up to 25 MB</small
          ><progress v-else :value="progress || undefined" max="100" aria-label="Import progress" />
        </div>
        <div class="start-actions">
          <button class="button secondary" :disabled="!!busy" @click="startBlank">
            <Plus :size="18" /> Start blank
          </button>
          <button class="button primary" :disabled="!!busy" @click="pdfPicker?.click()">
            <FileText :size="18" /> Import PDF
          </button>
        </div>
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
        <p class="library-description">{{ accountUser ? 'Saved to your account and available on your devices.' : 'Saved in this browser. After signing in, choose which scripts to add to your account.' }}</p>
        <p v-if="transferSuccess" class="transfer-success" role="status"><CircleCheck :size="18" /> {{ transferSuccess }}</p>
        <p v-if="loading" class="empty-projects">Loading your scripts…</p>
        <div v-else-if="!saved.length" class="empty-projects">
          <FolderOpen :size="28" :stroke-width="1.3" />
          <p>{{ accountUser ? 'No scripts in your account yet.' : 'Your stories will live here.' }}</p>
          <small>{{ accountUser && localSaved.length ? 'Add a script from this device below, or start a new one.' : 'Start blank or import a script to begin.' }}</small>
        </div>
        <TransitionGroup v-else name="script-row" tag="div" class="project-list" appear>
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
              :aria-label="`Duplicate ${project.title}`"
              :disabled="!!busy"
              @click="manage(project, 'duplicate', destinationSource)"
            ><Copy :size="16" /></button
            ><button
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
        </TransitionGroup>
        <Transition name="device-section">
        <div v-if="accountUser && localSaved.length" class="device-projects">
          <div class="section-header"><h2>Only on this device <span class="count-badge">{{ localSaved.length }}</span></h2></div>
          <p class="library-description">These scripts are saved in this browser. Add each one to your account to use it on other devices.</p>
          <TransitionGroup name="script-row" tag="div">
          <div v-for="project in localSaved" :key="project.id" class="device-project-entry">
          <div class="project-row">
            <RouterLink :to="projectUrl(project.id, 'local')" class="project-link">
              <span class="project-icon"><FileText :size="21" :stroke-width="1.4" /></span>
              <span class="project-info"><strong>{{ project.title }}</strong><small>{{ project.sourceFilename || 'Your script' }}</small></span>
              <span class="project-date">Edited {{ dateLabel(project.updatedAt) }}</span>
            </RouterLink>
            <span class="device-warning" role="img" :aria-label="`${project.title} is only on this device, not your account`" tabindex="0"><TriangleAlert :size="17" /><span class="device-warning-tip">Only on this device. Add it to your account to use it elsewhere.</span></span>
            <button class="text-button copy-account" :disabled="!!busy" @click="moveToAccount(project)"><CloudUpload :size="16" /> {{ transferInProgress === project.id ? 'Adding…' : 'Add to account' }}</button>
            <button class="icon-button" :aria-label="`Duplicate ${project.title}`" :disabled="!!busy" @click="manage(project, 'duplicate', 'local')"><Copy :size="16" /></button>
            <button class="icon-button" :aria-label="`Rename ${project.title}`" :disabled="!!busy" @click="manage(project, 'rename', 'local')"><Pencil :size="16" /></button>
            <button class="icon-button" :aria-label="`Delete ${project.title}`" :disabled="!!busy" @click="manage(project, 'delete', 'local')"><Trash2 :size="16" /></button>
            <RouterLink :to="projectUrl(project.id, 'local')" class="icon-button" :aria-label="`Open ${project.title}`"><ArrowRight :size="18" /></RouterLink>
          </div>
          <p v-if="transferError?.id === project.id" class="transfer-error" role="alert"><TriangleAlert :size="17" /> <span>{{ transferError.message }} Your script is still on this device.</span></p>
          </div>
          </TransitionGroup>
        </div>
        </Transition>
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
      :title="action === 'rename' ? 'Rename project' : action === 'duplicate' ? 'Duplicate project' : 'Delete project?'"
      @close="target = undefined"
    >
      <form v-if="action !== 'delete'" @submit.prevent="completeAction">
        <label class="field-label"
          >Project title<input v-model="renameTitle" autofocus maxlength="1000"
        /></label>
        <div class="dialog-actions">
          <button type="button" class="button secondary" @click="target = undefined">Cancel</button
          ><button class="button primary" :disabled="!renameTitle.trim() || !!busy">{{ action === 'duplicate' ? 'Duplicate project' : 'Save name' }}</button>
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
