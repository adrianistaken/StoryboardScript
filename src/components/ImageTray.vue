<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { ImagePlus, X } from '@lucide/vue'
import type { ReferenceImage } from '../types'
import Modal from './Modal.vue'
const props = defineProps<{ images: ReferenceImage[]; sectionTitle: string }>()
const emit = defineEmits<{ add: [files: File[]]; remove: [id: string] }>()
const picker = ref<HTMLInputElement>(),
  previews = ref<{ id: string; url: string; filename: string }[]>([])
const active = ref<{ url: string; filename: string }>()
function release() {
  previews.value.forEach((i) => URL.revokeObjectURL(i.url))
}
watch(
  () => props.images,
  (images) => {
    release()
    previews.value = images.map((i) => ({
      id: i.id,
      filename: i.filename,
      url: URL.createObjectURL(i.blob),
    }))
  },
  { immediate: true },
)
onBeforeUnmount(release)
function choose(event: Event) {
  const el = event.target as HTMLInputElement
  if (el.files?.length) emit('add', Array.from(el.files))
  el.value = ''
}
</script>
<template>
  <div class="column-heading">
    <slot name="heading" />
    <input
      ref="picker"
      class="visually-hidden"
      type="file"
      accept="image/png,image/jpeg,image/webp"
      multiple
      tabindex="-1"
      :aria-label="`Upload images for ${sectionTitle}`"
      @change="choose"
    />
    <button
      class="icon-button heading-image-add"
      :aria-label="`Add reference images to ${sectionTitle}`"
      title="Add reference images"
      @click="picker?.click()"
    >
      <ImagePlus :size="18" :stroke-width="1.5" />
    </button>
  </div>
  <div v-if="images.length" class="image-tray image-tray-filled">
    <div v-for="item in previews" :key="item.id" class="image-thumb">
      <button :aria-label="`Preview ${item.filename}`" @click="active = item">
        <img :src="item.url" :alt="item.filename" loading="lazy" />
      </button>
      <button
        class="remove-image"
        :aria-label="`Remove ${item.filename}`"
        @click="emit('remove', item.id)"
      >
        <X :size="12" />
      </button>
    </div>
  </div>
  <Modal
    :open="!!active"
    :title="active?.filename || 'Reference image'"
    wide
    @close="active = undefined"
    ><img v-if="active" class="image-preview" :src="active.url" :alt="active.filename"
  /></Modal>
</template>
