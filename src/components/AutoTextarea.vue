<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
const props = defineProps<{
  modelValue: string
  label: string
  placeholder?: string
  maxlength?: number
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const input = ref<HTMLTextAreaElement>()
let observer: ResizeObserver | undefined
let width = 0
function resize() {
  const el = input.value
  if (el) {
    el.style.height = '0px'
    el.style.height = `${Math.max(el.scrollHeight, 28)}px`
  }
}
function update(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  resize()
}
watch(
  () => props.modelValue,
  () => {
    void nextTick(resize)
  },
)
onMounted(() => {
  resize()
  observer = new ResizeObserver((entries) => {
    const nextWidth = entries[0]?.contentRect.width ?? 0
    if (nextWidth !== width) {
      width = nextWidth
      resize()
    }
  })
  if (input.value) observer.observe(input.value)
  void document.fonts.ready.then(resize)
})
onBeforeUnmount(() => observer?.disconnect())
defineExpose({ focus: () => input.value?.focus() })
</script>
<template>
  <textarea
    ref="input"
    :value="modelValue"
    :aria-label="label"
    :placeholder="placeholder"
    :maxlength="maxlength"
    :spellcheck="false"
    rows="1"
    @input="update"
  />
</template>
