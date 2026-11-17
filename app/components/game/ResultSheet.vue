<script setup lang="ts">
/** The end of a flight: a finished level's stars, a snapped line, or endless mode's score. */
import { motion } from 'motion-v'
import { LEVELS_PER_WORLD, TOTAL_LEVELS, type Engine, type Goal } from '#shared/game'

const props = defineProps<{ engine: Engine, record: boolean, goalText: (g: Goal) => string }>()
const emit = defineEmits<{ next: [], retry: [], levels: [] }>()
const { locale, t } = useI18n()
const reduced = useReducedMotion()
const mainButton = ref<HTMLButtonElement | null>(null)
const n = (value: number) => localNumber(value, locale.value)

const endless = computed(() => props.engine.endless)
const won = computed(() => props.engine.state === 'won')
const level = computed(() => props.engine.level)
const hasNext = computed(() => !endless.value && level.value.n < TOTAL_LEVELS)
const worldDone = computed(() => won.value && level.value.index === LEVELS_PER_WORLD - 1)
const title = computed(() => endless.value ? (props.record ? t('result.record') : t('result.endless')) : won.value ? t('result.won') : t('result.crashed'))
const missing = computed(() => level.value.goals.filter(g => props.engine.goalProgress(g).have < g.n))
const crashed = computed(() => props.engine.crashedInto)

onMounted(() => setTimeout(() => mainButton.value?.focus(), 400))
</script>

<template>
  <motion.div
    :initial="reduced ? false : { opacity: 0 }"
    :animate="{ opacity: 1 }"
    class="fixed inset-0 z-40 flex items-center justify-center bg-moss-950/70 p-4 backdrop-blur-sm"
    role="alertdialog"
    aria-modal="true"
    :aria-label="title"
  >
    <motion.div
      :initial="reduced ? false : { scale: 0.7, y: 40, opacity: 0 }"
      :animate="{ scale: 1, y: 0, opacity: 1 }"
      :transition="{ type: 'spring', stiffness: 260, damping: 18 }"
      class="glass flex w-full max-w-md flex-col items-center gap-3 p-6 text-center landscape:max-lg:max-w-2xl landscape:max-lg:flex-row landscape:max-lg:flex-wrap landscape:max-lg:justify-center landscape:max-lg:gap-x-6 landscape:max-lg:p-4"
    >
      <div class="flex flex-col items-center gap-2">
        <p
          v-if="worldDone"
          class="chip text-sun-200"
        >
          <UIcon
            name="i-lucide-trophy"
            class="size-4"
          />
          {{ level.n === TOTAL_LEVELS ? t('result.theEnd') : t('result.worldDone', { n: n(Math.ceil(level.n / LEVELS_PER_WORLD)) }) }}
        </p>
        <h2
          class="font-display text-4xl leading-tight"
          :class="won || endless ? 'text-glow' : 'text-berry'"
        >
          {{ title }}
        </h2>
        <StarRow
          v-if="won"
          :count="props.engine.stars"
          size="size-12"
          animate
          :label="t('map.stars', { n: n(props.engine.stars) })"
        />
        <ModelIcon
          v-else-if="crashed"
          :name="crashed"
          class="size-24"
        />
        <p
          v-if="endless"
          class="font-display text-5xl text-sun-100"
        >
          {{ n(props.engine.score) }}
        </p>
      </div>

      <div class="flex flex-col items-center gap-3">
        <ul class="flex flex-wrap justify-center gap-2 text-sm">
          <li class="chip text-sun-200">
            <ModelIcon
              name="coin"
              class="size-5"
            />+{{ n(props.engine.coins) }}
          </li>
          <li class="chip text-moss-100">
            <UIcon
              name="i-lucide-route"
              class="size-4"
            />{{ n(Math.floor(props.engine.dist)) }} {{ t('game.m') }}
          </li>
          <li class="chip text-moss-100">
            <UIcon
              name="i-lucide-circle-dot"
              class="size-4"
            />{{ n(props.engine.rings) }}
          </li>
        </ul>
        <p
          v-if="!won && !endless && missing.length"
          class="text-sm text-moss-200"
        >
          {{ t('result.still') }} {{ missing.map(props.goalText).join(' · ') }}
        </p>
        <p class="text-xs text-muted">
          {{ t('result.banked') }}
        </p>

        <div class="flex flex-wrap justify-center gap-2">
          <button
            v-if="won && hasNext"
            ref="mainButton"
            type="button"
            class="btn-game"
            @click="emit('next')"
          >
            {{ t('result.next') }}
            <UIcon
              name="i-lucide-chevron-right"
              class="size-5"
            />
          </button>
          <button
            :ref="(el) => { if (!(won && hasNext)) mainButton = el as HTMLButtonElement }"
            type="button"
            class="btn-game"
            :class="won && hasNext ? 'ghost' : 'sun'"
            @click="emit('retry')"
          >
            <UIcon
              name="i-lucide-rotate-ccw"
              class="size-5"
            />
            {{ won ? t('result.replay') : t('result.retry') }}
          </button>
          <NuxtLink
            to="/workshop"
            class="btn-game ghost"
          >
            <UIcon
              name="i-lucide-wrench"
              class="size-5"
            />
            {{ t('home.workshop') }}
          </NuxtLink>
          <button
            type="button"
            class="btn-game ghost"
            @click="emit('levels')"
          >
            <UIcon
              :name="endless ? 'i-lucide-house' : 'i-lucide-map'"
              class="size-5"
            />
            {{ endless ? t('pause.home') : t('result.levels') }}
          </button>
        </div>
      </div>
    </motion.div>
  </motion.div>
</template>
