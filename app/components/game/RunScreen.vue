<script setup lang="ts">
/**
 * A flight, from start to finish: the world's story (first time), the briefing, a countdown, the
 * flight itself with its top bar, and the result. `n` is the level number, or 0 for endless mode.
 */
import { AnimatePresence, motion } from 'motion-v'
import {
  Engine, TOTAL_LEVELS, WORLDS, endlessLevel, getLevel, levelLabel,
  type GameEvent, type Goal, type LevelDef,
} from '#shared/game'
import { buzz } from '~/game/audio'

type Phase = 'storyIntro' | 'briefing' | 'countdown' | 'playing' | 'storyOutro' | 'result'

const props = defineProps<{ n: number }>()
const router = useRouter()
const { locale, t } = useI18n()
const progress = useProgressStore()
const reduced = useReducedMotion()
const audio = useGameAudio()

const endless = computed(() => props.n === 0)
const phase = ref<Phase>('briefing')
const level = shallowRef<LevelDef>(props.n ? getLevel(props.n) : endlessLevel(1))
const engine = shallowRef<Engine | null>(null)
const paused = ref(false)
const settingsOpen = ref(false)
const count = ref(3)
const record = ref(false)
/** Whether the sky is on screen (the menus' 3D backdrop rests meanwhile). */
const playing = useState('playing', () => false)
watch(phase, p => (playing.value = p === 'countdown' || p === 'playing' || p === 'result' || p === 'storyOutro'), { immediate: true })

const hud = reactive({ dist: 0, coins: 0, coinBump: 0, lives: 3, goals: [] as { have: number, need: number }[], magnet: 0, turbo: 0, shield: false, world: 0 })
const num = (value: number) => localNumber(value, locale.value)
const world = computed(() => WORLDS[engine.value?.worldIndex ?? level.value.world]!)
const label = computed(() => endless.value ? t('home.endless') : localDigits(levelLabel(level.value.n), locale.value))

useHead({ title: () => `${t('app.title')} · ${endless.value ? t('home.endless') : levelLabel(level.value.n)}` })

interface Banner { id: number, text: string, tone: 'sun' | 'berry' | 'leaf' }
const banner = ref<Banner | null>(null)
let bannerTimer: ReturnType<typeof setTimeout> | undefined
let bannerId = 0
function showBanner(text: string, tone: Banner['tone'] = 'sun', ms = 1400) {
  clearTimeout(bannerTimer)
  banner.value = { id: ++bannerId, text, tone }
  bannerTimer = setTimeout(() => (banner.value = null), ms)
}

const hint = ref<string | null>(null)

function goalText(g: Goal) {
  if (g.kind === 'distance') return t('goals.distance', { n: num(g.n) })
  if (g.kind === 'coins') return t('goals.coins', { n: num(g.n) })
  return t('goals.rings', { n: num(g.n) })
}

/* ------------------------------ Flow ------------------------------ */

function init() {
  progress.load()
  if (props.n && (props.n < 1 || props.n > TOTAL_LEVELS || !progress.isUnlocked(props.n))) {
    void router.replace('/map')
    return
  }
  level.value = props.n ? getLevel(props.n) : endlessLevel(Math.floor(Math.random() * 1e9))
  engine.value = null
  paused.value = false
  const intro = `${WORLDS[level.value.world]!.id}-intro`
  phase.value = !endless.value && level.value.index === 0 && !progress.seen.includes(intro) ? 'storyIntro' : endless.value ? 'countdown' : 'briefing'
  if (phase.value === 'countdown') start()
}

let countTimer: ReturnType<typeof setInterval> | undefined
function start() {
  if (endless.value) level.value = endlessLevel(Math.floor(Math.random() * 1e9))
  const e = new Engine(level.value, progress.runOptions)
  engine.value = markRaw(e)
  sync(true)
  paused.value = true
  record.value = false
  phase.value = 'countdown'
  count.value = 3
  audio?.unlock()
  audio?.ui('tap')
  clearInterval(countTimer)
  countTimer = setInterval(() => {
    count.value--
    audio?.ui(count.value > 0 ? 'tap' : 'star')
    if (count.value <= 0) {
      clearInterval(countTimer)
      phase.value = 'playing'
      paused.value = false
      audio?.playMusic(level.value.world)
      audio?.duck(false)
      if (level.value.n === 1) hint.value = 'hints.drag'
      if (level.value.n === 2) hint.value = 'hints.lives'
      if (level.value.n === 3) hint.value = 'hints.rings'
      setTimeout(() => (hint.value = null), 5000)
    }
  }, 650)
}

function finish() {
  const e = engine.value
  if (!e) return
  audio?.duck(true)
  progress.earn(e.coins)
  if (endless.value) record.value = progress.endless(e.score, e.dist)
  else if (e.state === 'won') {
    progress.complete(level.value.n, e.stars)
    if (level.value.n === TOTAL_LEVELS && !progress.seen.includes('moon-outro')) {
      phase.value = 'storyOutro'
      return
    }
  }
  phase.value = 'result'
}

function retry() {
  start()
}

function next() {
  void router.push(`/play/${level.value.n + 1}`)
}

/* ------------------------------ Playing ------------------------------ */

function haptic(ms: number | number[]) {
  if (progress.settings.haptics) buzz(ms)
}

function onEvents(events: GameEvent[]) {
  audio?.handle(events)
  for (const ev of events) {
    switch (ev.type) {
      case 'ring':
        haptic(20)
        break
      case 'hit':
        showBanner(t('game.hit'), 'berry', 900)
        haptic([40, 40, 40])
        break
      case 'power':
        showBanner(t(`powers.${ev.kind}`), 'sun', 1200)
        haptic(30)
        break
      case 'shieldHit':
        showBanner(t('game.saved'), 'leaf', 1000)
        haptic([30, 30, 30])
        break
      case 'smash':
        haptic(25)
        break
      case 'goal':
        showBanner(t('game.goalDone'), 'leaf', 1000)
        haptic(30)
        break
      case 'world':
        showBanner(t(`worlds.${WORLDS[ev.world]!.id}.name`), 'sun', 1800)
        break
      case 'crash':
        hint.value = null
        haptic(300)
        showBanner(t('game.crash'), 'berry', 1400)
        setTimeout(finish, 1300)
        break
      case 'won':
        hint.value = null
        haptic([30, 60, 30, 60, 80])
        setTimeout(finish, 1300)
        break
    }
  }
}

let lastDist = -1
function sync(force = false) {
  const e = engine.value
  if (!e) return
  if (phase.value === 'playing' && !paused.value && e.state === 'playing') audio?.hum(e.speed)
  else audio?.stopHum()
  const d = Math.floor(e.dist)
  if (d !== lastDist || force) {
    lastDist = d
    hud.dist = d
    hud.magnet = e.magnetT
    hud.turbo = e.turboT
    hud.shield = e.shield
    hud.world = e.worldIndex
    hud.goals = e.level.goals.map(g => e.goalProgress(g))
  }
  if (e.coins !== hud.coins) {
    if (e.coins > hud.coins && !force) hud.coinBump++
    hud.coins = e.coins
  }
  hud.lives = e.lives
}

function togglePause() {
  if (phase.value !== 'playing' || engine.value?.state !== 'playing') return
  paused.value = !paused.value
  audio?.ui('tap')
  audio?.duck(paused.value)
}

function onKey(event: KeyboardEvent) {
  if (settingsOpen.value) return
  if (event.key === 'Escape' || event.key === 'p' || event.key === 'P') togglePause()
}

function onSettingChange(key: string, value: boolean) {
  if (key === 'music') audio?.setMusic(value, level.value.world)
}

function onVisibility() {
  if (document.hidden && phase.value === 'playing' && !paused.value && engine.value?.state === 'playing') {
    paused.value = true
    audio?.duck(true)
  }
}

watch(() => props.n, init)
onMounted(() => {
  init()
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onVisibility)
})
onBeforeUnmount(() => {
  playing.value = false
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onVisibility)
  clearTimeout(bannerTimer)
  clearInterval(countTimer)
  audio?.stopMusic()
  audio?.stopHum()
})
</script>

<template>
  <div class="fixed inset-0 flex flex-col overflow-hidden">
    <StoryScene
      v-if="phase === 'storyIntro'"
      :world="WORLDS[level.world]!.id"
      part="intro"
      @done="phase = 'briefing'"
    />
    <StoryScene
      v-if="phase === 'storyOutro'"
      world="moon"
      part="outro"
      @done="phase = 'result'"
    />

    <div
      v-if="phase === 'briefing'"
      class="flex-1 overflow-y-auto"
    >
      <GameLevelBriefing
        :level="level"
        @start="start"
        @back="router.push('/map')"
      />
    </div>

    <template v-if="engine && phase !== 'briefing' && phase !== 'storyIntro'">
      <GameSkyBoard
        class="absolute inset-0"
        :engine="engine"
        :paused="paused || phase !== 'playing'"
        :on-events="onEvents"
        :on-frame="sync"
      />

      <!-- Top bar: pause, coins, distance, line strength, the level's goals (or the score), power-ups. -->
      <header class="pointer-events-none relative z-10 flex flex-wrap items-start gap-2 px-[calc(0.5rem+var(--safe-left))] pe-[calc(0.5rem+var(--safe-right))] pt-[calc(0.5rem+var(--safe-top))]">
        <button
          type="button"
          class="btn-icon pointer-events-auto shrink-0"
          :aria-label="t('game.pause')"
          @click="togglePause"
        >
          <UIcon
            name="i-lucide-pause"
            class="size-5"
          />
        </button>
        <div class="hud-pill">
          <ModelIcon
            name="coin"
            class="size-7"
          />
          <motion.span
            :key="hud.coinBump"
            :initial="reduced ? false : { scale: 1.35 }"
            :animate="{ scale: 1 }"
            :transition="{ type: 'spring', stiffness: 500, damping: 18 }"
            class="font-display text-xl leading-none"
          >
            {{ num(hud.coins) }}
          </motion.span>
        </div>
        <div class="hud-pill">
          <UIcon
            name="i-lucide-route"
            class="size-5 text-[#4a2e16]"
          />
          <span class="font-display text-xl leading-none">{{ num(hud.dist) }}<small class="ms-0.5 text-xs">{{ t('game.m') }}</small></span>
        </div>
        <div
          class="hud-pill"
          :aria-label="t('game.lives', { n: num(hud.lives) })"
        >
          <UIcon
            v-for="i in 3"
            :key="i"
            name="i-lucide-heart"
            class="size-4"
            :class="i <= hud.lives ? 'text-[#e8402f]' : 'text-[#4a2e16]/25'"
          />
        </div>
        <div
          v-if="!endless"
          class="ms-auto flex flex-wrap justify-end gap-1.5"
        >
          <div
            v-for="(goal, i) in level.goals"
            :key="i"
            class="hud-pill"
            :class="(hud.goals[i]?.have ?? 0) >= goal.n ? 'done' : ''"
          >
            <UIcon
              :name="goal.kind === 'distance' ? 'i-lucide-flag' : goal.kind === 'coins' ? 'i-lucide-coins' : 'i-lucide-circle-dot'"
              class="size-4"
            />
            <span class="font-display text-base leading-none">
              <template v-if="(hud.goals[i]?.have ?? 0) >= goal.n">✓</template>
              <template v-else>{{ num(hud.goals[i]?.have ?? 0) }}/{{ num(goal.n) }}</template>
            </span>
          </div>
        </div>
        <div
          v-else
          class="ms-auto flex flex-col items-end gap-1"
        >
          <div class="hud-pill">
            <UIcon
              name="i-lucide-trophy"
              class="size-4 text-sun-700"
            />
            <span class="font-display text-xl leading-none">{{ num(hud.dist + hud.coins * 10) }}</span>
          </div>
          <span class="chip text-xs text-sun-200">{{ t(`worlds.${WORLDS[hud.world]!.id}.name`) }}</span>
        </div>
      </header>

      <!-- Power-ups running. -->
      <div class="pointer-events-none relative z-10 mt-2 flex justify-center gap-2">
        <span
          v-if="hud.shield"
          class="hud-pill power"
        ><ModelIcon
          name="shield"
          class="size-6"
        />{{ t('powers.shield') }}</span>
        <span
          v-if="hud.magnet > 0"
          class="hud-pill power"
        ><ModelIcon
          name="magnet"
          class="size-6"
        />{{ num(Math.ceil(hud.magnet)) }}</span>
        <span
          v-if="hud.turbo > 0"
          class="hud-pill power"
        ><ModelIcon
          name="turbo"
          class="size-6"
        />{{ num(Math.ceil(hud.turbo)) }}</span>
      </div>

      <!-- Countdown. -->
      <div
        v-if="phase === 'countdown'"
        class="pointer-events-none absolute inset-0 z-20 flex items-center justify-center"
      >
        <AnimatePresence mode="wait">
          <motion.p
            :key="count"
            :initial="reduced ? false : { scale: 2, opacity: 0 }"
            :animate="{ scale: 1, opacity: 1 }"
            :exit="reduced ? undefined : { scale: 0.5, opacity: 0 }"
            class="text-glow font-display text-8xl"
          >
            {{ count > 0 ? num(count) : t('game.go') }}
          </motion.p>
        </AnimatePresence>
      </div>

      <!-- Announcements. -->
      <div
        class="pointer-events-none absolute inset-x-0 top-1/3 z-20 flex justify-center"
        aria-live="assertive"
      >
        <AnimatePresence>
          <motion.p
            v-if="banner"
            :key="banner.id"
            :initial="reduced ? { opacity: 0 } : { scale: 0.4, opacity: 0, rotate: -6 }"
            :animate="{ scale: 1, opacity: 1, rotate: 0 }"
            :exit="reduced ? { opacity: 0 } : { scale: 1.3, opacity: 0 }"
            :transition="{ type: 'spring', stiffness: 400, damping: 20 }"
            class="px-4 text-center font-display text-4xl leading-tight sm:text-5xl"
            :class="banner.tone === 'berry' ? 'text-[#ffd1dc] [text-shadow:0_4px_0_#7a1030,0_0_30px_rgb(255_77_109/0.7)]'
              : banner.tone === 'leaf' ? 'text-leaf-100 [text-shadow:0_4px_0_#29491c,0_0_30px_rgb(120_204_69/0.7)]'
                : 'text-sun-100 [text-shadow:0_4px_0_#7a340d,0_0_30px_rgb(255_190_31/0.7)]'"
          >
            {{ banner.text }}
          </motion.p>
        </AnimatePresence>
      </div>

      <!-- Coaching on the first levels. -->
      <AnimatePresence>
        <motion.div
          v-if="hint && phase === 'playing'"
          :key="hint"
          :initial="reduced ? false : { y: 30, opacity: 0 }"
          :animate="{ y: 0, opacity: 1 }"
          :exit="{ y: 30, opacity: 0 }"
          class="pointer-events-none absolute inset-x-0 bottom-[calc(1.5rem+var(--safe-bottom))] z-20 mx-auto flex w-fit max-w-[90%] items-center gap-2 rounded-2xl bg-sun-300 px-4 py-2 font-semibold text-sun-950 shadow-xl"
          role="status"
        >
          <UIcon
            name="i-lucide-hand"
            class="size-5 shrink-0"
          />
          {{ t(hint) }}
        </motion.div>
      </AnimatePresence>

      <!-- Pause menu. -->
      <AnimatePresence>
        <motion.div
          v-if="paused && phase === 'playing'"
          :initial="{ opacity: 0 }"
          :animate="{ opacity: 1 }"
          :exit="{ opacity: 0 }"
          class="fixed inset-0 z-40 flex items-center justify-center bg-moss-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          :aria-label="t('pause.title')"
        >
          <div class="glass flex w-full max-w-xs flex-col gap-3 p-6 text-center">
            <h2 class="text-glow font-display text-4xl">
              {{ t('pause.title') }}
            </h2>
            <p class="text-sm text-muted">
              {{ t(`worlds.${world.id}.name`) }} · {{ label }}
            </p>
            <button
              type="button"
              class="btn-game"
              @click="togglePause"
            >
              <UIcon
                name="i-lucide-play"
                class="size-5"
              />
              {{ t('pause.resume') }}
            </button>
            <button
              type="button"
              class="btn-game ghost"
              @click="retry"
            >
              <UIcon
                name="i-lucide-rotate-ccw"
                class="size-5"
              />
              {{ t('pause.restart') }}
            </button>
            <div class="flex gap-3">
              <button
                type="button"
                class="btn-game ghost flex-1"
                @click="router.push(endless ? '/' : '/map')"
              >
                <UIcon
                  :name="endless ? 'i-lucide-house' : 'i-lucide-map'"
                  class="size-5"
                />
                {{ endless ? t('pause.home') : t('pause.quit') }}
              </button>
              <button
                type="button"
                class="btn-game ghost"
                :aria-label="t('settings.title')"
                @click="settingsOpen = true"
              >
                <UIcon
                  name="i-lucide-settings"
                  class="size-5"
                />
              </button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <GameResultSheet
        v-if="phase === 'result'"
        :engine="engine"
        :record="record"
        :goal-text="goalText"
        @next="next"
        @retry="retry"
        @levels="router.push(endless ? '/' : '/map')"
      />
    </template>

    <SettingsModal
      v-model:open="settingsOpen"
      @change="onSettingChange"
    />
  </div>
</template>
