// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The
// game moves between screens — title, play, the level-up choice, paused, fallen and dawn —
// and the world's event flags become sounds and screen-reader announcements here.
//
// ?seed=N fixes the night's pattern. ?shot=start|play|upgrade|end (with &seed=N) stages that
// scene instead of running the loop, paints it and sets window.__shotReady for a screenshot.
import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EV_BRUTE,
  EV_DASH,
  EV_HIT,
  EV_HURT,
  EV_KILL,
  EV_LEVEL_UP,
  EV_OVER,
  EV_PICKUP,
  EV_SHOOT,
  EV_TREE_HURT,
  EV_WAVE,
  EV_WIN,
} from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import {
  createRenderer,
  SCREEN_OVER,
  SCREEN_PAUSED,
  SCREEN_PLAY,
  SCREEN_TITLE,
  SCREEN_UPGRADE,
  SCREEN_WIN,
} from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const input = createInput(canvas);
const renderer = createRenderer(canvas);
const world = createWorld(createRandom(seed));
const state = world.state;

let best = 0;
try {
  best = Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
} catch {
  best = 0;
}

let screen = SCREEN_TITLE;
let lastStatus = '';
function announce(text) {
  if (text === lastStatus) return;
  lastStatus = text;
  status.textContent = text;
}

function saveBest() {
  if (state.score > best) {
    best = state.score;
    try {
      window.localStorage.setItem(BEST_KEY, String(best));
    } catch {
      // A browser that refuses storage just forgets the best between visits.
    }
  }
}

// Sound throttles: a busy fight fires far more events than ears want.
const lastPlayed = new Map();
function play(name, everyMs) {
  const now = performance.now();
  if (now - (lastPlayed.get(name) || 0) < everyMs) return;
  lastPlayed.set(name, now);
  audio[name]();
}

function react(events) {
  if (events & EV_SHOOT) play('shoot', 55);
  if (events & EV_HIT) play('hit', 60);
  if (events & EV_KILL) play('kill', 70);
  if (events & EV_PICKUP) play('pickup', 45);
  if (events & EV_DASH) play('dash', 120);
  if (events & EV_HURT) play('hurt', 150);
  if (events & EV_TREE_HURT) play('treeHurt', 260);
  if (events & EV_WAVE) {
    play('waveHorn', 400);
    announce(state.banner);
  }
  if (events & EV_BRUTE) announce('An Umbral Brute lumbers out of the dark.');
  if (events & EV_LEVEL_UP) play('levelUp', 300);
  if (events & EV_OVER) {
    play('defeat', 1000);
    announce(`The grove has fallen. ${state.overReason} Final score ${state.score}.`);
  }
  if (events & EV_WIN) {
    play('victory', 1000);
    announce(`Dawn breaks. The Heart Tree stands. Final score ${state.score}.`);
  }
}

function startRun() {
  audio.ensure();
  world.startRun();
  screen = SCREEN_PLAY;
  announce('The Long Night begins. Wave 1 is coming.');
}

function clickHits(clicks) {
  for (const click of clicks) {
    const f = renderer.toField(click.x, click.y);
    for (const b of renderer.buttons) {
      if (f.x >= b.x && f.x <= b.x + b.w && f.y >= b.y && f.y <= b.y + b.h) return b.id;
    }
  }
  return null;
}

function handleScreenInput(actions, clicks) {
  if (actions & ACTION_MUTE) audio.toggleMute();
  const hit = clickHits(clicks);
  if (screen === SCREEN_TITLE) {
    if ((actions & ACTION_CONFIRM) || hit === 'start') startRun();
    return;
  }
  if (screen === SCREEN_PLAY) {
    if (actions & ACTION_PAUSE) screen = SCREEN_PAUSED;
    return;
  }
  if (screen === SCREEN_PAUSED) {
    if ((actions & ACTION_PAUSE) || hit === 'resume') screen = SCREEN_PLAY;
    return;
  }
  if (screen === SCREEN_UPGRADE) {
    let id = null;
    if (hit && hit.startsWith('upgrade:')) id = hit.slice('upgrade:'.length);
    for (const digit of ['Digit1', 'Digit2', 'Digit3']) {
      if (input.keys.has(digit)) {
        const choice = state.choices[Number(digit.slice(-1)) - 1];
        if (choice) id = choice.id;
        input.keys.delete(digit);
      }
    }
    if (id) {
      world.applyUpgrade(id);
      play('levelUp', 200);
      if (state.pendingLevels <= 0) {
        screen = SCREEN_PLAY;
        announce('The vigil resumes.');
      }
    }
    return;
  }
  if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
    if (hit === 'restart' || input.keys.has('KeyR')) {
      input.keys.delete('KeyR');
      startRun();
    }
  }
}

if (shot !== null) {
  // Screenshot mode: stage the scene, keep painting it (glows breathe, nothing moves on),
  // and raise the ready flag once two frames are on the canvas.
  const staged = stageShot(shot, world);
  screen = staged.screen;
  if (staged.best > best) best = staged.best;
  let frames = 0;
  const paint = (now) => {
    renderer.draw(state, screen, best, now / 1000, audio.muted);
    frames += 1;
    if (frames === 2) window.__shotReady = true;
    requestAnimationFrame(paint);
  };
  requestAnimationFrame(paint);
} else {
  let last = performance.now();
  let acc = 0;
  const frame = (now) => {
    requestAnimationFrame(frame);
    const dt = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    audio.tick();

    const actions = input.takeActions();
    const clicks = input.takeClicks();
    handleScreenInput(actions, clicks);

    if (screen === SCREEN_PLAY) {
      acc += dt;
      while (acc >= STEP) {
        acc -= STEP;
        const events = world.step(STEP, input.intent(renderer.toField));
        react(events);
        if (state.phase === 'over') {
          saveBest();
          screen = SCREEN_OVER;
          break;
        }
        if (state.phase === 'win') {
          saveBest();
          screen = SCREEN_WIN;
          break;
        }
        if (state.pendingLevels > 0 && state.choices.length > 0) {
          screen = SCREEN_UPGRADE;
          announce(`Level ${state.level}. Choose a gift.`);
          break;
        }
      }
    } else {
      acc = 0;
      // Screens other than play still let particles and banners settle.
      if (screen === SCREEN_TITLE) world.step(STEP, { moveX: 0, moveY: 0, aimX: state.player.x, aimY: 0, firing: false, dash: false });
    }
    renderer.draw(state, screen, best, now / 1000, audio.muted);
  };
  requestAnimationFrame(frame);
}

// The first gesture anywhere opens the audio context, as browsers require.
window.addEventListener('pointerdown', () => audio.ensure(), { once: false });
window.addEventListener('keydown', () => audio.ensure(), { once: false });
