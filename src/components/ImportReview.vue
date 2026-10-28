<script setup lang="ts">
import { computed, ref, toRaw } from 'vue'
import { ArrowLeft, ArrowRight, Check, FileText } from '@lucide/vue'
import type { ImportDraft } from '../types'
import { narrationTime, wordCount } from '../utils'
const props = defineProps<{ draft: ImportDraft; busy: boolean }>()
const emit = defineEmits<{ cancel: []; confirm: [draft: ImportDraft] }>()
const working = ref<ImportDraft>(structuredClone(toRaw(props.draft)))
const selected = ref(0)
const section = computed(() => working.value.sections[selected.value])
const words = computed(() => working.value.sections.reduce((n, s) => n + wordCount(s.text), 0))
</script>
<template>
  <main id="main" class="import-review">
    <button class="text-button" :disabled="busy" @click="emit('cancel')">
      <ArrowLeft :size="16" /> Choose another PDF
    </button>
    <div class="review-intro">
      <div>
        <h1>Your script, in sections.</h1>
        <p>Check the headings and text before opening your storyboard.</p>
      </div>
      <div class="file-tag"><FileText :size="16" />{{ draft.sourceFilename }}</div>
    </div>
    <label class="field-label"
      >Project title<input v-model="working.title" class="project-name-input" maxlength="1000"
    /></label>
    <div class="review-summary">
      <strong>{{ working.sections.length }} sections</strong><span>{{ draft.pageCount }} pages</span
      ><span>{{ words.toLocaleString() }} words</span
      ><span>{{ narrationTime(words, 150) }} estimated at 150 WPM</span>
    </div>
    <div v-for="warning in draft.warnings" :key="warning" class="notice">{{ warning }}</div>
    <details v-if="draft.excludedPreamble" class="preamble">
      <summary>Document title and text before the first section (excluded from narration)</summary>
      <pre>{{ draft.excludedPreamble }}</pre>
    </details>
    <div class="review-layout">
      <nav class="review-sections" aria-label="Proposed sections">
        <button
          v-for="(item, index) in working.sections"
          :key="index"
          :class="{ selected: selected === index }"
          :aria-current="selected === index ? 'true' : undefined"
          @click="selected = index"
        >
          <span>{{ String(index + 1).padStart(2, '0') }}</span
          ><span>{{ item.title || 'Untitled section' }}</span
          ><small>{{ wordCount(item.text) }}</small>
        </button>
      </nav>
      <section v-if="section" class="review-text">
        <label class="field-label"
          >Section heading<input v-model="section.title" class="review-heading" maxlength="1000"
        /></label>
        <pre v-if="section.text">{{ section.text }}</pre>
        <p v-else class="muted">
          This heading has no narration before the next heading. It will become an empty, editable
          section.
        </p>
      </section>
    </div>
    <footer class="review-footer">
      <p><Check :size="16" /> Everything stays in this browser.</p>
      <button
        class="button primary"
        :disabled="busy || !working.title.trim()"
        @click="emit('confirm', working)"
      >
        {{ busy ? 'Saving project…' : 'Open storyboard' }}<ArrowRight :size="17" />
      </button>
    </footer>
  </main>
</template>
