<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { X } from '@lucide/vue'
const props = defineProps<{ open: boolean; title: string; wide?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
watch(
  () => props.open,
  async () => {
    await nextTick()
    if (props.open && !dialog.value?.open) dialog.value?.showModal()
    else if (!props.open) dialog.value?.close()
  },
  { immediate: true },
)
</script>
<template>
  <dialog
    v-if="open"
    ref="dialog"
    :class="['modal', { 'modal-wide': wide }]"
    :aria-label="title"
    @cancel.prevent="emit('close')"
    @click="$event.target === dialog && emit('close')"
  >
    <header class="modal-header">
      <h2>{{ title }}</h2>
      <button class="icon-button" aria-label="Close dialog" @click="emit('close')">
        <X :size="20" />
      </button>
    </header>
    <slot />
  </dialog>
</template>
