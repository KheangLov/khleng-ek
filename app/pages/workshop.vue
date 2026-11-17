<script setup lang="ts">
/** The workshop: spend coins on longer power-ups, a shield to start with, and kite designs. */
import { motion } from 'motion-v'
import { PAINTS, POWER, UPGRADE_MAX, type PaintId } from '#shared/game'

const { locale, t } = useI18n()
const progress = useProgressStore()
const reduced = useReducedMotion()
const audio = useUiSound()
const n = (value: number) => localNumber(value, locale.value)

onMounted(() => progress.load())

const upgrades = computed(() => ([
  { kind: 'magnet', model: 'magnet', level: progress.upgrades.magnet, secs: POWER.magnet.base + progress.upgrades.magnet * POWER.magnet.perLevel },
  { kind: 'turbo', model: 'turbo', level: progress.upgrades.turbo, secs: POWER.turbo.base + progress.upgrades.turbo * POWER.turbo.perLevel },
] as const))

function buy(kind: 'magnet' | 'turbo' | 'shield') {
  audio.ui(progress.buyUpgrade(kind) ? 'unlock' : 'nope')
}
function pick(id: PaintId) {
  audio.ui(progress.buyPaint(id) ? 'select' : 'nope')
}
const secs = (value: number) => (Math.round(value * 10) / 10).toString()
</script>

<template>
  <main class="mx-auto flex min-h-dvh w-full max-w-4xl flex-col gap-4 pb-[calc(1.5rem+var(--safe-bottom))] pe-[calc(1rem+var(--safe-right))] ps-[calc(1rem+var(--safe-left))] pt-[calc(1rem+var(--safe-top))]">
    <header class="flex items-center gap-3">
      <NuxtLink
        to="/"
        class="btn-icon"
        :aria-label="t('map.back')"
      >
        <UIcon
          name="i-lucide-arrow-left"
          class="size-5"
        />
      </NuxtLink>
      <h1 class="text-glow font-display text-4xl leading-tight">
        {{ t('workshop.title') }}
      </h1>
      <span class="hud-pill ms-auto">
        <ModelIcon
          name="coin"
          class="size-7"
        />
        <span class="font-display text-xl leading-none">{{ n(progress.wallet) }}</span>
      </span>
    </header>

    <section class="glass flex flex-col gap-3 p-4">
      <h2 class="font-display text-2xl text-sun-100">
        {{ t('workshop.upgrades') }}
      </h2>
      <div class="grid gap-3 sm:grid-cols-3">
        <div
          v-for="u in upgrades"
          :key="u.kind"
          class="flex flex-col gap-2 rounded-2xl bg-moss-950/50 p-3"
        >
          <div class="flex items-center gap-2">
            <ModelIcon
              :name="u.model"
              class="size-14 shrink-0"
            />
            <div>
              <p class="font-display text-lg leading-tight">
                {{ t(`powers.${u.kind}`) }}
              </p>
              <p class="text-xs text-muted">
                {{ t('workshop.lasts', { n: localDigits(secs(u.secs), locale) }) }}
              </p>
            </div>
          </div>
          <div
            class="flex gap-1"
            role="img"
            :aria-label="t('workshop.level', { n: n(u.level), max: n(UPGRADE_MAX) })"
          >
            <span
              v-for="i in UPGRADE_MAX"
              :key="i"
              class="h-2 flex-1 rounded-full"
              :class="i <= u.level ? 'bg-leaf-400' : 'bg-moss-700'"
            />
          </div>
          <button
            type="button"
            class="btn-game sun"
            :disabled="u.level >= UPGRADE_MAX || progress.wallet < progress.upgradeCostOf(u.kind)"
            @click="buy(u.kind)"
          >
            <template v-if="u.level >= UPGRADE_MAX">
              {{ t('workshop.max') }}
            </template>
            <template v-else>
              <ModelIcon
                name="coin"
                class="size-5"
              />{{ n(progress.upgradeCostOf(u.kind)) }}
            </template>
          </button>
        </div>
        <div class="flex flex-col gap-2 rounded-2xl bg-moss-950/50 p-3">
          <div class="flex items-center gap-2">
            <ModelIcon
              name="shield"
              class="size-14 shrink-0"
            />
            <div>
              <p class="font-display text-lg leading-tight">
                {{ t('workshop.startShield') }}
              </p>
              <p class="text-xs text-muted">
                {{ t('workshop.startShieldText') }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="btn-game sun mt-auto"
            :disabled="progress.upgrades.shield || progress.wallet < progress.upgradeCostOf('shield')"
            @click="buy('shield')"
          >
            <template v-if="progress.upgrades.shield">
              <UIcon
                name="i-lucide-check"
                class="size-5"
              />{{ t('workshop.owned') }}
            </template>
            <template v-else>
              <ModelIcon
                name="coin"
                class="size-5"
              />{{ n(progress.upgradeCostOf('shield')) }}
            </template>
          </button>
        </div>
      </div>
    </section>

    <section class="glass flex flex-col gap-3 p-4">
      <h2 class="font-display text-2xl text-sun-100">
        {{ t('workshop.paints') }}
      </h2>
      <ul class="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <motion.li
          v-for="(p, i) in PAINTS"
          :key="p.id"
          :initial="reduced ? false : { opacity: 0, y: 12 }"
          :animate="{ opacity: 1, y: 0 }"
          :transition="{ delay: i * 0.04 }"
        >
          <button
            type="button"
            class="flex w-full flex-col items-center gap-1 rounded-2xl p-2 ring-3 transition"
            :class="progress.paint === p.id ? 'bg-sun-300/20 ring-sun-300' : 'bg-moss-950/50 ring-transparent'"
            :aria-pressed="progress.paint === p.id"
            @click="pick(p.id)"
          >
            <ModelIcon
              :name="`kite:${p.id}`"
              class="size-24"
            />
            <span class="font-display text-lg">{{ t(`paints.${p.id}`) }}</span>
            <span
              v-if="progress.paints.includes(p.id)"
              class="text-xs text-leaf-200"
            >{{ progress.paint === p.id ? t('workshop.flying') : t('workshop.owned') }}</span>
            <span
              v-else
              class="flex items-center gap-1 text-sm font-semibold"
              :class="progress.wallet >= p.price ? 'text-sun-200' : 'text-moss-400'"
            ><ModelIcon
              name="coin"
              class="size-4"
            />{{ n(p.price) }}</span>
          </button>
        </motion.li>
      </ul>
    </section>
  </main>
</template>
