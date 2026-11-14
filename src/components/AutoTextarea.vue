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
let pendingScroll: { board: HTMLElement; top: number; left: number } | undefined
let scrollFrame = 0
function rememberScroll() {
  const board = input.value?.closest<HTMLElement>('.board-scroll')
  pendingScroll = board ? { board, top: board.scrollTop, left: board.scrollLeft } : undefined
}
function restoreScroll() {
  if (!pendingScroll) return
  const { board, top, left } = pendingScroll
  board.scrollTop = top
  board.scrollLeft = left
  cancelAnimationFrame(scrollFrame)
  scrollFrame = requestAnimationFrame(() => {
    board.scrollTop = top
    board.scrollLeft = left
    pendingScroll = undefined
  })
}
function resize() {
  const el = input.value
  if (el) {
    // Let the content determine its natural height without collapsing the focused
    // textarea (which makes the browser scroll the caret into view).
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 28)}px`
  }
}
function update(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  resize()
  restoreScroll()
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
onBeforeUnmount(() => {
  observer?.disconnect()
  cancelAnimationFrame(scrollFrame)
})
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
    @beforeinput="rememberScroll"
    @input="update"
  />
</template>
