<script setup lang="ts">
/**
 * The sky: the 3D view filling the screen, the game loop, and the controls. Drag anywhere to steer:
 * the kite follows your finger's movement (a drag across most of the screen sweeps the whole sky).
 * Keys: arrows or W, A, S, D, held.
 */
import { FIELD, STEP, type Engine, type GameEvent } from '#shared/game'
import { ICON_MODELS, SkyView } from '~/game/three/sky'
import { ensureIcons } from '~/game/three/icons'

const props = defineProps<{
  engine: Engine
  paused: boolean
  /** Things that happened in the game since the last frame. */
  onEvents: (events: GameEvent[]) => void
  /** Every frame, after the game moved on (to update the top bar without Vue). */
  onFrame?: () => void
}>()

const { t } = useI18n()
const progress = useProgressStore()
const wrap = ref<HTMLElement | null>(null)
const canvas = ref<HTMLCanvasElement | null>(null)
const overlay = ref<HTMLElement | null>(null)
const reduced = useReducedMotion()
const failed = ref(false)
let view: SkyView | null = null
let raf = 0
let last = 0
let acc = 0

watch(() => props.paused, () => {
  last = performance.now()
})
watch(reduced, (r) => {
  if (view) view.reducedMotion = r
})

function fit() {
  const el = wrap.value
  if (!el || !view) return
  const box = el.getBoundingClientRect()
  view.resize(Math.max(1, Math.floor(box.width)), Math.max(1, Math.floor(box.height)), window.devicePixelRatio || 1)
}

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  let dt = (now - last) / 1000
  last = now
  if (dt > 0.1) dt = 0.1
  if (!view) return
  const engine = props.engine
  if (!props.paused) {
    steerByKeys()
    acc += dt
    let steps = 0
    while (acc >= STEP && steps < 8) {
      engine.step(STEP)
      acc -= STEP
      steps++
    }
    if (steps === 8) acc = 0
    flush()
    view.update(dt)
  }
  props.onFrame?.()
  view.render(engine)
}

function flush() {
  const events = props.engine.drainEvents()
  if (events.length) {
    view?.handle(events, props.engine)
    props.onEvents(events)
  }
}

/* ------------------------------ Controls ------------------------------ */

let drag: { x: number, y: number, id: number, aimX: number, aimY: number } | null = null

function onPointerDown(e: PointerEvent) {
  if (props.paused) return
  drag = { x: e.clientX, y: e.clientY, id: e.pointerId, aimX: props.engine.aimX, aimY: props.engine.aimY }
  canvas.value?.setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!drag || e.pointerId !== drag.id || props.paused) return
  const rect = wrap.value!.getBoundingClientRect()
  // About two-thirds of the screen's width (or its height) sweeps the whole sky.
  const span = Math.min(rect.width, rect.height * 1.4) * 0.66
  const scale = (FIELD.xHalf * 2) / span
  props.engine.steer(drag.aimX + (e.clientX - drag.x) * scale, drag.aimY - (e.clientY - drag.y) * scale)
}

function onPointerUp(e: PointerEvent) {
  if (drag && e.pointerId === drag.id) drag = null
}

const held = new Set<string>()
const KEYS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0],
  ArrowRight: [1, 0], d: [1, 0], D: [1, 0],
  ArrowUp: [0, 1], w: [0, 1], W: [0, 1],
  ArrowDown: [0, -1], s: [0, -1], S: [0, -1],
}

function steerByKeys() {
  if (!held.size) return
  let dx = 0
  let dy = 0
  for (const k of held) {
    dx += KEYS[k]![0]
    dy += KEYS[k]![1]
  }
  const e = props.engine
  // Point a little ahead of the kite the way the keys say: it flies there at about top speed.
  e.steer(e.x + dx * 2.2, e.y + dy * 2.2)
}

function onKey(e: KeyboardEvent) {
  if (!(e.key in KEYS)) return
  e.preventDefault()
  if (e.type === 'keydown' && !props.paused) held.add(e.key)
  else held.delete(e.key)
  if (!held.size) props.engine.steer(props.engine.x, props.engine.y)
}

let observer: ResizeObserver | null = null
onMounted(() => {
  try {
    view = new SkyView(canvas.value!, overlay.value!, progress.settings.hd ? 'high' : 'low', progress.paintJob)
  }
  catch {
    failed.value = true
    return
  }
  view.reducedMotion = reduced.value
  void ensureIcons(ICON_MODELS)
  observer = new ResizeObserver(fit)
  observer.observe(wrap.value!)
  fit()
  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)
  last = performance.now()
  raf = requestAnimationFrame(frame)
})
onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  observer?.disconnect()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('keyup', onKey)
  view?.dispose()
  view = null
})
</script>

<template>
  <div
    ref="wrap"
    class="relative size-full overflow-hidden"
  >
    <canvas
      ref="canvas"
      class="block size-full touch-none"
      role="img"
      :aria-label="t('game.board')"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointercancel="drag = null"
    />
    <div
      ref="overlay"
      class="sky-overlay pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    />
    <p
      v-if="failed"
      class="absolute inset-0 flex items-center justify-center p-6 text-center text-moss-100"
    >
      {{ t('game.noWebgl') }}
    </p>
  </div>
</template>
