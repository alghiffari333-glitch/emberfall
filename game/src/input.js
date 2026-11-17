// Keyboard, mouse and touch, gathered in one place. The game reads an "intent" each step —
// which way to move, where to aim, whether to fire or dash — so the autopilot that stages
// the screenshot scenes can hand the world exactly the same shape a player's hands would.
// One-shot presses (confirm, pause, mute) are queued and taken once by the loop, so a press
// between frames is never lost and never counted twice.
//
// Touch is twin-stick: a thumb landing on the left half of the field becomes the move stick
// where it lands, a thumb on the right half the aim stick (push it to loose bolts that way),
// and two fixed buttons — DASH and pause — are hit-tested first. A tap anywhere also queues
// a click, so the menu buttons work by touch exactly as by mouse.

import { FIELD, TOUCH } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_MUTE = 4;

const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const MUTE = new Set(['KeyM']);

export function createInput(canvas) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, down: false };
  let actions = 0;
  let clicks = [];
  let mapper = null;

  // Touch state, in field coordinates once the mapper is set.
  let touchSeen = false;
  let moveStick = null; // {id, ox, oy, x, y}
  let aimStick = null;
  const dashTouches = new Set();
  const ignoredTouches = new Set();
  let lastAim = null; // last aim point in field coordinates, kept while the aim thumb rests

  function canvasPoint(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
      y: ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height,
    };
  }

  function fieldPoint(clientX, clientY) {
    const p = canvasPoint(clientX, clientY);
    if (mapper) return mapper(p.x, p.y);
    return { x: (p.x / Math.max(1, canvas.width)) * FIELD.width, y: (p.y / Math.max(1, canvas.height)) * FIELD.height };
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
      return;
    }
    keys.add(event.code);
    if (CONFIRM.has(event.code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(event.code)) actions |= ACTION_PAUSE;
    else if (MUTE.has(event.code)) actions |= ACTION_MUTE;
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouse.down = false;
    moveStick = null;
    aimStick = null;
    dashTouches.clear();
    ignoredTouches.clear();
  });

  canvas.addEventListener('mousemove', (event) => {
    const p = canvasPoint(event.clientX, event.clientY);
    mouse.x = p.x;
    mouse.y = p.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button !== 0) return;
    mouse.down = true;
    clicks.push(canvasPoint(event.clientX, event.clientY));
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  canvas.addEventListener('touchstart', (event) => {
    event.preventDefault();
    touchSeen = true;
    for (const touch of event.changedTouches) {
      clicks.push(canvasPoint(touch.clientX, touch.clientY));
      const f = fieldPoint(touch.clientX, touch.clientY);
      if (Math.hypot(f.x - TOUCH.dashX, f.y - TOUCH.dashY) <= TOUCH.dashR + 18) {
        dashTouches.add(touch.identifier);
      } else if (Math.hypot(f.x - TOUCH.pauseX, f.y - TOUCH.pauseY) <= TOUCH.pauseR + 16) {
        actions |= ACTION_PAUSE;
        ignoredTouches.add(touch.identifier);
      } else if (f.x < FIELD.width / 2 && !moveStick) {
        moveStick = { id: touch.identifier, ox: f.x, oy: f.y, x: f.x, y: f.y };
      } else if (!aimStick) {
        aimStick = { id: touch.identifier, ox: f.x, oy: f.y, x: f.x, y: f.y };
      } else {
        ignoredTouches.add(touch.identifier);
      }
    }
  }, { passive: false });
  canvas.addEventListener('touchmove', (event) => {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      const f = fieldPoint(touch.clientX, touch.clientY);
      if (moveStick && touch.identifier === moveStick.id) {
        moveStick.x = f.x;
        moveStick.y = f.y;
      } else if (aimStick && touch.identifier === aimStick.id) {
        aimStick.x = f.x;
        aimStick.y = f.y;
      }
    }
  }, { passive: false });
  const endTouch = (event) => {
    for (const touch of event.changedTouches) {
      if (moveStick && touch.identifier === moveStick.id) moveStick = null;
      if (aimStick && touch.identifier === aimStick.id) aimStick = null;
      dashTouches.delete(touch.identifier);
      ignoredTouches.delete(touch.identifier);
    }
  };
  canvas.addEventListener('touchend', endTouch);
  canvas.addEventListener('touchcancel', endTouch);

  /** Stick vector: direction and tilt (0..1) of a stick, or null while it rests centred. */
  function stickVector(stick) {
    if (!stick) return null;
    const dx = stick.x - stick.ox;
    const dy = stick.y - stick.oy;
    const len = Math.hypot(dx, dy);
    if (len < 6) return null;
    return { x: dx / len, y: dy / len, tilt: Math.min(1, len / TOUCH.stickRadius), len };
  }

  return {
    keys,
    mouse,
    /** Give the input its canvas→field mapper (the renderer's), for touch hit-tests. */
    setMapper(fn) {
      mapper = fn;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Clicks since the last call, in canvas pixel coordinates. */
    takeClicks() {
      const taken = clicks;
      clicks = [];
      return taken;
    },
    /** What the renderer needs to draw the touch controls, or an inactive stub. */
    touchUI(coarsePointer) {
      return {
        active: touchSeen || !!coarsePointer,
        move: moveStick,
        aim: aimStick,
        dash: dashTouches.size > 0,
      };
    },
    /** Build the intent for one step. `toField` maps canvas pixels to field coordinates;
     *  `anchor` is the warden's field position, the point touch aim is measured from. */
    intent(toField, anchor) {
      const origin = anchor || { x: FIELD.width / 2, y: FIELD.height / 2 };
      let moveX = 0;
      let moveY = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) moveX -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) moveX += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) moveY -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) moveY += 1;
      const length = Math.hypot(moveX, moveY) || 1;
      moveX /= length;
      moveY /= length;

      const moveVec = stickVector(moveStick);
      if (moveVec) {
        moveX = moveVec.x * moveVec.tilt;
        moveY = moveVec.y * moveVec.tilt;
      }

      let aimX;
      let aimY;
      let firing = mouse.down || keys.has('KeyF');
      const aimVec = stickVector(aimStick);
      if (aimVec) {
        lastAim = { x: origin.x + aimVec.x * 280, y: origin.y + aimVec.y * 280 };
        aimX = lastAim.x;
        aimY = lastAim.y;
        firing = aimVec.len > 20;
      } else if (moveStick || aimStick || dashTouches.size > 0) {
        // Touch is driving: hold the last aim (or straight up at the start), no fire.
        if (!lastAim) lastAim = { x: origin.x, y: origin.y - 280 };
        aimX = lastAim.x;
        aimY = lastAim.y;
        firing = false;
      } else {
        const aim = toField(mouse.x, mouse.y);
        aimX = aim.x;
        aimY = aim.y;
      }

      return {
        moveX,
        moveY,
        aimX,
        aimY,
        firing,
        dash: keys.has('Space') || keys.has('ShiftLeft') || keys.has('ShiftRight') || dashTouches.size > 0,
      };
    },
  };
}
