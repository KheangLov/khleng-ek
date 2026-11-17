<script setup lang="ts">
/** Before a level: the world, what to do, and the coins for each star. */
import { motion } from 'motion-v'
import { WORLDS, levelLabel, type Goal, type HazardKind, type LevelDef } from '#shared/game'

const props = defineProps<{ level: LevelDef }>()
const emit = defineEmits<{ start: [], back: [] }>()
const { locale, t } = useI18n()
const progress = useProgressStore()
const reduced = useReducedMotion()

const n = (value: number) => localNumber(value, locale.value)
const world = computed(() => WORLDS[props.level.world]!)
const label = computed(() => localDigits(levelLabel(props.level.n), locale.value))
const best = computed(() => progress.stars[props.level.n] ?? 0)

const icon = (g: Goal) => g.kind === 'distance' ? 'i-lucide-flag' : g.kind === 'coins' ? 'i-lucide-coins' : 'i-lucide-circle-dot'
function text(g: Goal) {
  if (g.kind === 'distance') return t('goals.distance', { n: n(g.n) })
  if (g.kind === 'coins') return t('goals.coins', { n: n(g.n) })
  return t('goals.rings', { n: n(g.n) })
}

const tips = computed(() => {
  const list: { key: string, model: HazardKind | 'ring' }[] = []
  if (props.level.goals.some(g => g.kind === 'rings')) list.push({ key: 'ring', model: 'ring' })
  // The world's commonest hazards first.
  const hazards = (Object.entries(world.value.hazards) as [HazardKind, number][]).sort((a, b) => b[1] - a[1])
  for (const [kind] of hazards) list.push({ key: kind, model: kind })
  return list.slice(0, 2)
})

const pop = (delay: number) => reduced.value
  ? {}
  : { initial: { opacity: 0, y: 16, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, transition: { type: 'spring' as const, stiffness: 240, damping: 20, delay } }
</script>

<template>
  <div class="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-3 p-[calc(0.75rem+var(--safe-top))_calc(1rem+var(--safe-right))_calc(1rem+var(--safe-bottom))_calc(1rem+var(--safe-left))]">
    <motion.header
      v-bind="pop(0)"
      class="flex items-center gap-3"
    >
      <button
        type="button"
        class="btn-icon"
        :aria-label="t('map.back')"
        @click="emit('back')"
      >
        <UIcon
          name="i-lucide-arrow-left"
          class="size-5"
        />
      </button>
      <div class="me-auto">
        <p class="text-xs font-semibold text-moss-300">
          {{ t(`worlds.${world.id}.name`) }}
        </p>
        <h1 class="text-glow font-display text-3xl leading-tight">
          {{ t('map.level', { label }) }}
        </h1>
      </div>
      <StarRow
        :count="best"
        size="size-5"
        :label="t('map.stars', { n: n(best) })"
      />
    </motion.header>

    <div class="grid gap-3 sm:grid-cols-2 landscape:grid-cols-2">
      <motion.section
        v-bind="pop(0.05)"
        class="glass flex flex-col gap-3 p-4"
      >
        <h2 class="font-display text-xl text-sun-100">
          {{ t('briefing.mission') }}
        </h2>
        <ul class="flex flex-col gap-2">
          <li
            v-for="(goal, i) in props.level.goals"
            :key="i"
            class="flex items-center gap-3 rounded-xl bg-[#fff7e0] p-2.5 text-[#4a2e16] shadow-[0_3px_0_#2e1a0a]"
          >
            <UIcon
              :name="icon(goal)"
              class="size-6 shrink-0 text-sun-700"
            />
            <span class="font-semibold leading-tight">{{ text(goal) }}</span>
          </li>
        </ul>
        <div class="flex flex-wrap gap-2 text-sm">
          <span class="chip text-moss-200">
            <StarRow
              :count="2"
              size="size-3.5"
            />
            <ModelIcon
              name="coin"
              class="size-4"
            />{{ n(props.level.stars[0]) }}
          </span>
          <span class="chip text-sun-200">
            <StarRow
              :count="3"
              size="size-3.5"
            />
            <ModelIcon
              name="coin"
              class="size-4"
            />{{ n(props.level.stars[1]) }}
          </span>
        </div>
      </motion.section>

      <motion.section
        v-bind="pop(0.1)"
        class="glass flex flex-col gap-3 p-4"
      >
        <h2 class="font-display text-xl text-leaf-200">
          {{ t('briefing.tips') }}
        </h2>
        <div
          v-for="tip in tips"
          :key="tip.key"
          class="flex items-center gap-3"
        >
          <ModelIcon
            :name="tip.model"
            class="size-14 shrink-0"
          />
          <p class="text-sm leading-relaxed text-moss-100">
            {{ t(`tips.${tip.key}`) }}
          </p>
        </div>
      </motion.section>
    </div>

    <motion.div
      v-bind="pop(0.15)"
      class="mt-auto flex justify-center pt-2"
    >
      <button
        type="button"
        class="btn-game lg"
        autofocus
        @click="emit('start')"
      >
        <UIcon
          name="i-lucide-play"
          class="size-7"
        />
        {{ t('briefing.start') }}
      </button>
    </motion.div>
  </div>
</template>
