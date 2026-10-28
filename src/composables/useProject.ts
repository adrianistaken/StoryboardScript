import { computed, onBeforeUnmount, ref } from 'vue'
import { onBeforeRouteLeave } from 'vue-router'
import type { ProjectDocument } from '../types'
import { cloneDocument, errorMessage, orderedSections } from '../utils'
import { projects } from '../services/storage'

export function useProject() {
  const doc = ref<ProjectDocument>()
  const status = ref<'saved' | 'saving' | 'error'>('saved'),
    error = ref('')
  let version = 0,
    savedVersion = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  let chain: Promise<void> = Promise.resolve()
  const sections = computed(() => (doc.value ? orderedSections(doc.value) : []))
  async function flush() {
    clearTimeout(timer)
    if (!doc.value || version === savedVersion) return chain
    const snapshot = cloneDocument(doc.value),
      snapshotVersion = version
    status.value = 'saving'
    chain = chain
      .catch(() => {})
      .then(async () => {
        try {
          await projects.save(snapshot)
          savedVersion = snapshotVersion
          if (savedVersion === version) {
            status.value = 'saved'
            error.value = ''
          }
        } catch (e) {
          status.value = 'error'
          error.value = errorMessage(e)
          throw e
        }
      })
    return chain
  }
  function changed() {
    if (!doc.value) return
    version++
    doc.value.project.updatedAt = new Date().toISOString()
    status.value = 'saving'
    clearTimeout(timer)
    timer = setTimeout(() => {
      void flush().catch(() => {})
    }, 200)
  }
  async function load(id: string) {
    doc.value = await projects.load(id)
  }
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (version !== savedVersion) {
      event.preventDefault()
      event.returnValue = ''
    }
  }
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void flush().catch(() => {})
  }
  window.addEventListener('beforeunload', beforeUnload)
  document.addEventListener('visibilitychange', onVisibility)
  onBeforeRouteLeave(async () => {
    try {
      await flush()
      return true
    } catch {
      return window.confirm(
        'Your latest changes could not be saved. Export a backup before leaving to keep them. Leave this project anyway?',
      )
    }
  })
  onBeforeUnmount(() => {
    clearTimeout(timer)
    window.removeEventListener('beforeunload', beforeUnload)
    document.removeEventListener('visibilitychange', onVisibility)
  })
  return { doc, sections, status, error, load, changed, flush }
}
