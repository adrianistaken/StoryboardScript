import { onBeforeUnmount, ref, type Ref } from 'vue'

export function useBoardPan(board: Ref<HTMLElement | undefined>) {
  const spaceHeld = ref(false)
  const panning = ref(false)
  let origin: { x: number; y: number; left: number; top: number; pointer: number } | undefined
  let suppressClick = false
  let clickTimer: ReturnType<typeof setTimeout> | undefined
  const isEditing = (target: EventTarget | null) =>
    target instanceof HTMLElement &&
    !!target.closest('input, textarea, select, [contenteditable="true"]')
  function end() {
    if (origin && board.value?.hasPointerCapture(origin.pointer))
      board.value.releasePointerCapture(origin.pointer)
    origin = undefined
    panning.value = false
    // The synthetic click follows pointerup; suppress it without swallowing the next real click.
    clearTimeout(clickTimer)
    clickTimer = setTimeout(() => {
      suppressClick = false
    }, 0)
  }
  function reset() {
    spaceHeld.value = false
    end()
  }
  function keydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.isComposing || document.querySelector('dialog[open]'))
      return
    if (
      event.key === 'Escape' &&
      isEditing(event.target) &&
      event.target instanceof HTMLElement &&
      board.value?.contains(event.target)
    ) {
      event.preventDefault()
      reset()
      board.value.focus({ preventScroll: true })
      return
    }
    if (
      event.code !== 'Space' ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      isEditing(event.target)
    )
      return
    event.preventDefault()
    spaceHeld.value = true
  }
  function keyup(event: KeyboardEvent) {
    if (event.code === 'Space') reset()
  }
  function pointerdown(event: PointerEvent) {
    if (
      !board.value ||
      (!spaceHeld.value && event.button !== 1) ||
      (event.button !== 0 && event.button !== 1)
    )
      return
    event.preventDefault()
    event.stopImmediatePropagation()
    clearTimeout(clickTimer)
    suppressClick = true
    origin = {
      x: event.clientX,
      y: event.clientY,
      left: board.value.scrollLeft,
      top: board.value.scrollTop,
      pointer: event.pointerId,
    }
    board.value.setPointerCapture(event.pointerId)
    panning.value = true
  }
  function pointermove(event: PointerEvent) {
    if (!origin || !board.value || event.pointerId !== origin.pointer) return
    event.preventDefault()
    board.value.scrollLeft = origin.left + origin.x - event.clientX
    board.value.scrollTop = origin.top + origin.y - event.clientY
  }
  function click(event: MouseEvent) {
    if (!suppressClick) return
    event.preventDefault()
    event.stopImmediatePropagation()
    suppressClick = false
  }
  const visibility = () => {
    if (document.hidden) reset()
  }
  window.addEventListener('keydown', keydown)
  window.addEventListener('keyup', keyup)
  window.addEventListener('blur', reset)
  document.addEventListener('visibilitychange', visibility)
  onBeforeUnmount(() => {
    reset()
    clearTimeout(clickTimer)
    window.removeEventListener('keydown', keydown)
    window.removeEventListener('keyup', keyup)
    window.removeEventListener('blur', reset)
    document.removeEventListener('visibilitychange', visibility)
  })
  return { spaceHeld, panning, pointerdown, pointermove, end, click }
}
