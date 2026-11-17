/**
 * The story: Dara learns to fly Grandpa Ta Sok's khleng ek, the humming kite he made, across the
 * dry season from the rice fields to the full-moon festival. A short scene plays before each world's
 * first level, and a last one after the final level. The words are in i18n/locales/*.json under
 * `story.<world>.<intro|outro>`, one line per speaker below, in order.
 */
import type { WorldId } from './levels'

export type Speaker = 'dara' | 'tasok'

export const STORY: Record<WorldId, { intro: Speaker[], outro: Speaker[] }> = {
  paddies: { intro: ['tasok', 'dara', 'tasok'], outro: [] },
  palms: { intro: ['dara', 'tasok', 'dara'], outro: [] },
  tonlesap: { intro: ['tasok', 'dara', 'tasok'], outro: [] },
  angkor: { intro: ['dara', 'tasok', 'dara'], outro: [] },
  palace: { intro: ['tasok', 'dara', 'tasok'], outro: [] },
  moon: { intro: ['dara', 'tasok', 'dara'], outro: ['tasok', 'dara', 'tasok'] },
}
