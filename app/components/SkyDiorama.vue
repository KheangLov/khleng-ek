<script setup lang="ts">
/**
 * The menus' background: the kite flying itself over the countryside in 3D (a made-up endless
 * flight with a simple pilot). It uses the game's own engine and view, and stops whenever a flight
 * is on, so only one 3D scene ever runs at a time. Without WebGL, the plain backdrop shows.
 */
import { Engine, STEP, endlessLevel } from '#shared/game'
import { SkyView } from '~/game/three/sky'

const props = defineProps<{ world: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const overlay = ref<HTMLElement | null>(null)
const progress = useProgressStore()
const ready = ref(false)
let view: SkyView | null = null
let engine: Engine | null = null
let raf = 0
let last = 0
let acc = 0
let think = 0

function fresh() {
  // A flight that never ends and stays in the chosen place.
  const level = { ...endlessLevel(props.world * 31 + 7), n: -1, world: props.world, goals: [{ kind: 'distance' as const, n: 1e9 }] }
  engine = new Engine(level, { magnet: 7, turbo: 3.5, startShield: false })
}

function start() {
  stop()
  try {
    fresh()
    view = new SkyView(canvas.value!, overlay.value!, progress.settings.hd ? 'high' : 'low', progress.paintJob, true)
  }
  catch {
    view = null
    return
  }
  ready.value = true
  fit()
  last = performance.now()
  raf = requestAnimationFrame(frame)
}

function stop() {
  cancelAnimationFrame(raf)
  view?.dispose()
  view = null
  ready.value = false
}

function fit() {
  view?.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1)
}

/** Drifts about the middle of the sky, steering round whatever is close ahead. */
function steer(e: Engine) {
  const ahead = e.course.hazards.filter(h => !h.hit && h.z - e.dist > 0 && h.z - e.dist < e.speed * 1.4 + 4)
  const wander: [number, number] = [Math.sin(e.time * 0.31) * 2.5, 5.5 + Math.sin(e.time * 0.23) * 1.8]
  let best = wander
  let bestScore = -Infinity
  for (let x = -5; x <= 5; x += 1.25) {
    for (let y = 2; y <= 11; y += 1.5) {
      const hits = ahead.filter(h => e.touches(h, x, y, h.z, 0.6)).length
      const score = -hits * 100 - Math.hypot(x - wander[0], y - wander[1]) * 0.3 - Math.hypot(x - e.x, y - e.y) * 0.4
      if (score > bestScore) {
        bestScore = score
        best = [x, y]
      }
    }
  }
  e.steer(best[0], best[1])
}

function frame(now: number) {
  raf = requestAnimationFrame(frame)
  if (!view || !engine || document.hidden) return
  let dt = (now - last) / 1000
  last = now
  if (dt > 0.1) dt = 0.1
  acc += dt
  while (acc >= STEP) {
    engine.step(STEP)
    acc -= STEP
    think -= STEP
    if (think <= 0) {
      think = 0.12
      steer(engine)
    }
  }
  view.handle(engine.drainEvents(), engine)
  if (engine.state !== 'playing' || engine.dist > 4000) fresh()
  view.update(dt)
  view.render(engine)
}

watch(() => props.world, () => {
  if (view) start()
})
onMounted(() => {
  start()
  window.addEventListener('resize', fit)
})
onBeforeUnmount(() => {
  stop()
  window.removeEventListener('resize', fit)
})
</script>

<template>
  <div
    class="pointer-events-none fixed inset-0 -z-10 transition-opacity duration-700"
    :class="ready ? 'opacity-100' : 'opacity-0'"
    aria-hidden="true"
  >
    <canvas
      ref="canvas"
      class="block size-full"
    />
    <div
      ref="overlay"
      class="hidden"
    />
    <!-- Darkened towards the middle, where the menus are, so text stays easy to read. -->
    <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgb(7_20_13/0.7),rgb(7_20_13/0.3)_70%,rgb(7_20_13/0.15))]" />
  </div>
</template>
