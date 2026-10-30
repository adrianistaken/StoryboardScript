import type { ProjectDocument } from '../types'
import { cloneDocument } from '../utils'

// Blobs are immutable and shared by snapshots, so undoing image deletion retains the file.
export function createHistory(initial: ProjectDocument, capacity = 50) {
  let current = cloneDocument(initial)
  const past: ProjectDocument[] = []
  const future: ProjectDocument[] = []
  let group = ''
  let lastEdit = 0
  const signature = (doc: ProjectDocument) =>
    JSON.stringify({ ...doc, project: { ...doc.project, updatedAt: '' } })
  return {
    get canUndo() {
      return past.length > 0
    },
    get canRedo() {
      return future.length > 0
    },
    breakGroup() {
      group = ''
    },
    record(next: ProjectDocument, key = '', now = Date.now()) {
      if (signature(current) === signature(next)) return false
      if (!key || key !== group || now - lastEdit > 750) {
        past.push(current)
        if (past.length > capacity) past.shift()
      }
      current = cloneDocument(next)
      future.length = 0
      group = key
      lastEdit = now
      return true
    },
    undo() {
      const previous = past.pop()
      if (!previous) return
      future.push(current)
      current = previous
      group = ''
      return cloneDocument(current)
    },
    redo() {
      const next = future.pop()
      if (!next) return
      past.push(current)
      current = next
      group = ''
      return cloneDocument(current)
    },
  }
}
