/**
 * The star targets. `pnpm par` flies every level with the simple flyer and writes
 * shared/game/par.ts (the coins it collects); run it after changing the course or the levels.
 * Otherwise this checks the table is up to date.
 */
import { describe, expect, it } from 'vitest'
import { PAR, TOTAL_LEVELS, getLevel } from '../../shared/game'
import { autoplay } from './helpers/autoplay'

// Node's own globals, without pulling Node's types into the shared tsconfig.
declare const process: { env: Record<string, string | undefined> }
const update = !!process.env.UPDATE_PAR

describe('star targets', () => {
  it('match the simple flyer', async () => {
    const coins: number[] = []
    for (let n = 1; n <= TOTAL_LEVELS; n++) {
      const r = autoplay(getLevel(n))
      expect(r.won, `level ${n}`).toBe(true)
      coins.push(r.coins)
    }
    if (update) {
      const { writeFileSync } = await import(/* @vite-ignore */ `node:${'fs'}`) as { writeFileSync: (path: URL, data: string) => void }
      const rows: string[] = []
      for (let i = 0; i < coins.length; i += 20) rows.push(`  ${coins.slice(i, i + 20).join(', ')},`)
      writeFileSync(new URL('../../shared/game/par.ts', import.meta.url), `/** Coins the simple flyer (test/unit/helpers/autoplay.ts) collects on each level, one row per world. Made by \`pnpm par\`. */\nexport const PAR: number[] = [\n${rows.join('\n')}\n]\n`)
    }
    else expect(PAR).toEqual(coins)
  }, 300_000)
})
