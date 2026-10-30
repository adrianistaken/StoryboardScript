<script setup lang="ts">
import { ArrowLeft, ArrowRight, GripVertical, Trash2, Plus } from '@lucide/vue'
import type { ReferenceImage, Section } from '../types'
import { limits, narrationTime, wordCount } from '../utils'
import AutoTextarea from './AutoTextarea.vue'
import ImageTray from './ImageTray.vue'
defineProps<{
  section: Section
  index: number
  count: number
  wpm: number
  images: ReferenceImage[]
}>()
const emit = defineEmits<{
  edit: [id: string, field: 'title' | 'text', value: string]
  move: [id: string, offset: number]
  insert: [id: string, side: 'left' | 'right']
  addImages: [id: string, files: File[]]
  removeImage: [id: string]
  removeSection: [id: string]
}>()
</script>
<template>
  <article
    class="script-column"
    :data-section-id="section.id"
    :aria-label="`Section ${index + 1}: ${section.title}`"
  >
    <div class="column-actions">
      <div class="section-stats">
        <span>{{ wordCount(section.text).toLocaleString() }} words</span>
        <span
          :aria-label="`${narrationTime(wordCount(section.text), wpm)} estimated narration time`"
          >{{ narrationTime(wordCount(section.text), wpm) }} est.</span
        >
      </div>
      <div class="column-tools">
        <button
          class="icon-button small"
          :disabled="index === 0"
          :aria-label="`Move ${section.title} left`"
          @click="emit('move', section.id, -1)"
        >
          <ArrowLeft :size="15" />
        </button>
        <button
          class="icon-button small"
          :disabled="index === count - 1"
          :aria-label="`Move ${section.title} right`"
          @click="emit('move', section.id, 1)"
        >
          <ArrowRight :size="15" />
        </button>
        <button
          class="icon-button small"
          :aria-label="`Delete section ${section.title}`"
          @click="emit('removeSection', section.id)"
        >
          <Trash2 :size="14" />
        </button>
        <span class="drag-handle" title="Drag to reorder" aria-hidden="true"
          ><GripVertical :size="19"
        /></span>
      </div>
    </div>
    <button
      class="insert-gap insert-before"
      :disabled="count >= limits.sections"
      :aria-label="`Add section before ${section.title}`"
      :title="`Add a blank section before ${section.title}`"
      @click="emit('insert', section.id, 'left')"
    >
      <Plus :size="12" />
    </button>
    <button
      v-if="index === count - 1"
      class="insert-gap insert-after"
      :disabled="count >= limits.sections"
      :aria-label="`Add section after ${section.title}`"
      :title="`Add a blank section after ${section.title}`"
      @click="emit('insert', section.id, 'right')"
    >
      <Plus :size="12" />
    </button>
    <ImageTray
      :images="images"
      :section-title="section.title || 'Untitled section'"
      @add="emit('addImages', section.id, $event)"
      @remove="emit('removeImage', $event)"
    >
      <template #heading>
        <AutoTextarea
          class="section-title"
          :model-value="section.title"
          label="Section title"
          placeholder="Section title"
          :maxlength="1000"
          @update:model-value="emit('edit', section.id, 'title', $event)"
        />
      </template>
    </ImageTray>
    <AutoTextarea
      class="script-text"
      :model-value="section.text"
      :label="`Script for ${section.title || 'Untitled section'}`"
      placeholder="Write this part of your story…"
      :maxlength="2000000"
      @update:model-value="emit('edit', section.id, 'text', $event)"
    />
  </article>
</template>
