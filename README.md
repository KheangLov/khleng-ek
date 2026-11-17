# Khleng Ek (ខ្លែងឯក)

A 3D kite-flying game from Cambodia. Dara flies Grandpa Sok's khleng ek, the traditional Khmer kite
with a bow (the "ek") that hums in the wind, through the dry-season kite festival: over rice fields,
sugar palms, the Tonle Sap, Angkor, the Royal Palace and a full-moon night festival. Steer round egrets,
rival kites on their lines, festival bunting, storm clouds, palm crowns and sky lanterns, fly through
rings and collect coins. **120 levels in six places**, with a short story between them, plus an
**endless sky** that changes place every kilometre. All the art is 3D, built in code: no image or
model files.

- **Khmer and English**: Khmer by default, with Khmer digits.
- **Made for phones**: drag anywhere on the screen and the kite follows your finger (two-thirds of the
  screen sweeps the whole sky). Keyboard: arrows or W/A/S/D, held; P or Escape to pause.
- **Line strength**: three knocks and the line snaps, with a moment of safety after each.
- **Power-ups**: a magnet pulls coins in, a shield takes a knock, a gust races ahead and blows
  through anything.
- **The workshop**: coins are saved between flights and buy longer-lasting magnets and gusts, a shield
  at the start of every flight, and six kite designs.
- **Stars for coins**: each level's two- and three-star coin targets come from a simple flyer's runs,
  so they're always reachable.
- **The ek's hum** is synthesised and rises with the wind, along with the rest of the sound and music.
- **Saved on the device**: progress, coins, upgrades and settings stay in the browser (localStorage).
- **Installable and offline**: once opened, it plays with no connection.
- **Plays inside the [gaming gateway](https://github.com/KheangLov/gaming-gateway)**, loaded with
  Module Federation (`modules/gateway-remote/`, the same folder as in the other games).

Built with Nuxt 4, Nuxt UI, [three.js](https://threejs.org) and [Motion for Vue](https://motion.dev/docs/vue),
on the same base as [remork](https://github.com/KheangLov/remork) and
[chamkar](https://github.com/KheangLov/chamkar).

## How it's built

- **The rules are separate from the drawing** (`shared/game/engine.ts`): a plain TypeScript engine,
  stepped at a fixed 60 steps a second, flies the kite through a course of hazards and pickups
  (`course.ts`), with gusts of side wind, and emits events (coins, rings, power-ups, knocks) that drive
  the effects, sounds and top bar. Deterministic, so tests fly whole levels.
- **The sky is real 3D, in plain three.js** (`app/game/three/`): a chase camera behind the kite, soft
  shadows, and every kite, bird, house, palm, temple and the palace built from shapes in code
  (`models.ts`). The countryside is made in 40 m pieces per place, each merged into a few meshes and
  reused as you fly (`sky.ts`); the flying lane is kept clear of scenery so only hazards are ever in the
  way. The full-moon night has the moon, stars and lanterns. Settings → high-quality graphics turns
  shadows and sharp pixels off for older phones.
- **The interface uses the same models**: each is rendered once into a picture (`icons.ts`) for the
  briefing, the workshop and the story; the menus have the kite flying behind them.
- **Vue stays out of the frame loop**: the top bar's values update only when they change.

## Development

```bash
pnpm install
pnpm dev          # http://localhost:3000
```

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server |
| `pnpm lint` / `pnpm lint:fix` | ESLint (includes code style) |
| `pnpm typecheck` | Type-check the app and the unit tests |
| `pnpm test` | Unit tests (`test/unit`: course, engine, a simple flyer that flies all 120 levels, star targets) and Nuxt tests (`test/nuxt`) |
| `pnpm par` | Flies every level with the simple flyer and writes the star targets (`shared/game/par.ts`) |
| `pnpm build` | Production build (Cloudflare Workers; Vercel's preset on Vercel) |
| `pnpm build:federation` | The gaming gateway's remote (`/mf/remoteEntry.js`), copied into the site's build |
| `pnpm run deploy` | Build both and deploy to Cloudflare |
| `pnpm layout [base URL] [folder]` | Screenshots at four screen sizes in both languages, failing on sideways scrolling or a sky that doesn't fit |
| `pnpm icons [chromium]` | Regenerate the PNG icons from `public/icon.svg` |

## Project layout

```
shared/game/      The game: numbers (data.ts), the course generator (course.ts), the 120 levels and the
                  places (levels.ts), star targets (par.ts), the story, the engine
app/game/         The three.js sky, models and icons, and the synthesised audio
app/pages/        Home, levels (/map), a level (/play/<n>), the endless sky (/endless), the workshop
app/components/   Story scenes, the flight screen, briefing and result, settings
app/stores/       Progress, coins, upgrades and settings, saved in localStorage
modules/          gateway-remote: the gaming gateway's Module Federation remote
test/             unit/ and nuxt/ tests (test/unit/helpers/autoplay.ts is the simple flyer)
```

## Levels and balance

Levels are generated from their number with a seeded random generator (`shared/game/levels.ts`), so
they're the same everywhere. Each asks for a distance, and often coins or rings too; wind speed and
the number of hazards grow through each place, and each place has its own sky (palms in the palm
groves, gusty side winds over the Tonle Sap, crowds of rival kites at the palace, lanterns under the
full moon). Tuning numbers are in `shared/game/data.ts`. After changing the course, levels or numbers,
run `pnpm par` to remake the star targets, then `pnpm test` (the simple flyer must still finish every
level).

## Deploying

- **Vercel**: import the repository; `vercel.json` builds the site and the gateway remote.
- **Cloudflare Workers**: `pnpm run deploy`, or push to `main` with the `CLOUDFLARE_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` secrets set.

Then set the game's `siteUrl` in the gateway's registry entry (`khleng-ek` in `app/games/registry.ts`)
to the deployed address.

## Credits

- Fonts: [Kantumruy Pro](https://fonts.google.com/specimen/Kantumruy+Pro) and [Koulen](https://fonts.google.com/specimen/Koulen) (SIL Open Font License 1.1), bundled via Fontsource
- Icons: [Lucide](https://lucide.dev) (ISC License)
- An original game; all characters, art, names and story are its own. The khleng ek is a traditional
  Khmer kite.
