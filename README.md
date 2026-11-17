# Emberfall

**Ten waves of gloom. One Heart Tree. Hold the grove until dawn.**

Emberfall is an original arena-defense game for the browser. You are the warden of a grove:
a small spirit of ember-light sworn to protect the Heart Tree through the Long Night.
Creatures of the gloom — Gloam Moths that gnaw the Tree, Hex Stingers that hunt you, and
the towering Umbral Brutes — pour in from the dark in ten growing waves. Scatter them with
ember bolts, gather the shards they drop, level up and choose your gifts wisely. If the
warden falls, or the Tree falls, the night wins. Survive the tenth wave and dawn breaks.

## Play

Open `game/index.html` in any desktop browser (or serve the folder with any static file
server). There is no build step and the game makes no network requests.

| Input | Action |
| --- | --- |
| W A S D / arrow keys | Move |
| Mouse | Aim |
| Hold left mouse button (or F) | Loose ember bolts |
| Space / Shift | Dash (briefly untouchable) |
| 1 · 2 · 3 or click | Choose a level-up gift |
| P / Esc | Pause |
| M | Mute |
| R | Restart after the end |

## Features

- A complete arc: title screen, ten waves with a calm before each, a last-wave stand,
  victory at dawn, defeat, scoring with a persistent best, and instant restart.
- Level-ups with a choice of three gifts from a pool of nine (extra bolts, piercing
  embers, dash and magnet upgrades, mending for you and for the Tree, and more).
- Three enemy kinds with different targets and behaviours, plus boss brutes with their
  own health bar.
- Synthesised sound throughout — bolts, bites, level-up chimes, a wave horn and a slow
  ambient pad — generated with WebAudio at runtime. No audio files.
- Juice where it counts: particles, screen shake, dash trails, floating score text,
  a breathing Heart Tree, and a sky that warms as dawn comes.
- Screen-reader announcements for waves, level-ups and the ending, via a live status line.
- Deterministic screenshot scenes (`?shot=start|play|upgrade|end&seed=N`) that replay the
  real rules with an autopilot, used to produce the images in `screenshots/`.

## Layout

- `game/` — the game itself: `index.html` plus ES modules under `src/` (`config`,
  `random`, `input`, `audio`, `world`, `render`, `shots`, `main`). No dependencies.
- `screenshots/` — four real renders of the game in a browser; the first is the cover.
- `main.ts` — the handover program: copies `game/` and `screenshots/` to the output
  directory and writes `dossier.json` with the vendored library in `vendor/`.
- `serve.ts` — a tiny local server for playing the game during development
  (`node serve.ts`, then open http://localhost:8080).

## Licence

MIT — see `LICENSE`.
