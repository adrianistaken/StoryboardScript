import type { Project } from '../types'

export const libraryCache = new Map<string, { saved: Project[]; localSaved: Project[] }>()
