// Emberfall's rules and state, with no drawing and no browser in it: the warden, the Heart
// Tree, the creatures of the gloom, ember bolts, shards, waves, levels and upgrades. step()
// advances one fixed step given an intent ({moveX, moveY, aimX, aimY, firing, dash}) and
// returns what happened as bit flags, so the caller can play sounds and announce events
// without the world knowing about screens or speakers. All randomness comes from the seeded
// generator handed in at creation, so a seed always grows the same night.

import {
  CALM_SECONDS,
  ENEMIES,
  FIELD,
  PLAYER,
  TREE,
  WAVES_TOTAL,
  XP_FIRST,
  XP_GROWTH,
  wavePlan,
} from './config.js';

export const EV_SHOOT = 1;
export const EV_HIT = 2;
export const EV_KILL = 4;
export const EV_PICKUP = 8;
export const EV_HURT = 16;
export const EV_TREE_HURT = 32;
export const EV_LEVEL_UP = 64;
export const EV_WAVE = 128;
export const EV_DASH = 256;
export const EV_OVER = 512;
export const EV_WIN = 1024;
export const EV_BRUTE = 2048;

const TAU = Math.PI * 2;

const UPGRADES = [
  { id: 'might', name: 'Ember Might', blurb: 'Bolts burn +25% hotter.', max: 99 },
  { id: 'swift', name: 'Swift Hands', blurb: 'Fire +20% faster.', max: 99 },
  { id: 'twin', name: 'Twin Flame', blurb: '+1 bolt per volley.', max: 3 },
  { id: 'grace', name: "Warden's Grace", blurb: 'Move +18% faster.', max: 99 },
  { id: 'vital', name: 'Vital Spark', blurb: '+25 max health, and mend 25.', max: 99 },
  { id: 'heartwood', name: 'Heartwood Guard', blurb: 'The Tree gains +40 max health, and mends 40.', max: 99 },
  { id: 'longdash', name: 'Long Dash', blurb: 'Dash recharges 25% sooner.', max: 3 },
  { id: 'magnet', name: 'Magnet Aura', blurb: 'Shards drift to you from +45% farther.', max: 3 },
  { id: 'pierce', name: 'Piercing Embers', blurb: 'Bolts pass through +1 creature.', max: 3 },
];

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const state = {
    phase: 'title', // title | playing | over | win
    time: 0,
    score: 0,
    kills: 0,
    wave: 0,
    wavePhase: 'calm', // calm | wave | done
    waveTimer: CALM_SECONDS,
    spawnLeft: 0,
    spawnTimer: 0,
    brutesLeft: 0,
    plan: wavePlan(1),
    level: 1,
    xp: 0,
    xpNext: XP_FIRST,
    pendingLevels: 0,
    choices: [],
    shake: 0,
    banner: '',
    bannerT: 0,
    overReason: '',
    player: null,
    tree: null,
    enemies: [],
    bolts: [],
    shards: [],
    particles: [],
    texts: [],
  };

  function freshPlayer() {
    return {
      x: TREE.x,
      y: TREE.y + 118,
      vx: 0,
      vy: 0,
      hp: PLAYER.maxHp,
      maxHp: PLAYER.maxHp,
      damage: PLAYER.damage,
      fireRate: PLAYER.fireRate,
      projectiles: 1,
      pierce: 0,
      speed: PLAYER.speed,
      magnet: PLAYER.magnet,
      fireTimer: 0,
      dashTimer: 0,
      dashCd: 0,
      dashBase: PLAYER.dashCooldown,
      dashDirX: 1,
      dashDirY: 0,
      hurtTimer: 0,
      aimAngle: -Math.PI / 2,
    };
  }

  function reset() {
    state.phase = 'title';
    state.time = 0;
    state.score = 0;
    state.kills = 0;
    state.wave = 0;
    state.wavePhase = 'calm';
    state.waveTimer = CALM_SECONDS;
    state.spawnLeft = 0;
    state.spawnTimer = 0;
    state.brutesLeft = 0;
    state.plan = wavePlan(1);
    state.level = 1;
    state.xp = 0;
    state.xpNext = XP_FIRST;
    state.pendingLevels = 0;
    state.choices = [];
    state.shake = 0;
    state.banner = '';
    state.bannerT = 0;
    state.overReason = '';
    state.player = freshPlayer();
    state.tree = { x: TREE.x, y: TREE.y, hp: TREE.maxHp, maxHp: TREE.maxHp, hurtT: 0 };
    state.enemies.length = 0;
    state.bolts.length = 0;
    state.shards.length = 0;
    state.particles.length = 0;
    state.texts.length = 0;
  }

  function startRun() {
    reset();
    state.phase = 'playing';
    state.banner = 'The Long Night begins';
    state.bannerT = 2.4;
  }

  function burst(x, y, count, color, speed, life) {
    for (let i = 0; i < count; i += 1) {
      if (state.particles.length > 420) return;
      const angle = random() * TAU;
      const v = speed * (0.3 + random() * 0.7);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        t: 0,
        life: life * (0.6 + random() * 0.7),
        size: 1.5 + random() * 2.5,
        color,
      });
    }
  }

  function floatText(x, y, text, color) {
    state.texts.push({ x, y, text, color, t: 0, life: 0.9 });
    if (state.texts.length > 24) state.texts.shift();
  }

  function spawnEdge() {
    const side = Math.floor(random() * 4);
    const m = 30;
    if (side === 0) return { x: m + random() * (FIELD.width - 2 * m), y: -m };
    if (side === 1) return { x: m + random() * (FIELD.width - 2 * m), y: FIELD.height + m };
    if (side === 2) return { x: -m, y: m + random() * (FIELD.height - 2 * m) };
    return { x: FIELD.width + m, y: m + random() * (FIELD.height - 2 * m) };
  }

  function spawnEnemy(kind) {
    const base = ENEMIES[kind];
    const pos = spawnEdge();
    state.enemies.push({
      kind,
      x: pos.x,
      y: pos.y,
      hp: base.hp * state.plan.hpScale,
      maxHp: base.hp * state.plan.hpScale,
      speed: base.speed * state.plan.speedScale * (0.85 + random() * 0.3),
      radius: base.radius,
      biteTimer: 0,
      hitT: 0,
      wobble: random() * TAU,
    });
  }

  function beginWave() {
    state.wave += 1;
    state.plan = wavePlan(state.wave);
    state.spawnLeft = state.plan.count;
    state.brutesLeft = state.plan.brutes;
    state.spawnTimer = 0.4;
    state.wavePhase = 'wave';
    state.banner = state.wave === WAVES_TOTAL ? 'The last wave — hold until dawn' : `Wave ${state.wave}`;
    state.bannerT = 2.2;
    return EV_WAVE | (state.brutesLeft > 0 ? EV_BRUTE : 0);
  }

  function gainXp(amount) {
    state.xp += amount;
    while (state.xp >= state.xpNext) {
      state.xp -= state.xpNext;
      state.level += 1;
      state.xpNext = XP_FIRST + (state.level - 1) * XP_GROWTH;
      state.pendingLevels += 1;
    }
  }

  function rollChoices() {
    const owned = state.player.upgradeCounts || {};
    const pool = UPGRADES.filter((u) => (owned[u.id] || 0) < u.max);
    const picks = [];
    const copy = pool.slice();
    while (picks.length < 3 && copy.length > 0) {
      const index = Math.floor(random() * copy.length);
      picks.push(copy.splice(index, 1)[0]);
    }
    state.choices = picks;
  }

  function applyUpgrade(id) {
    const p = state.player;
    p.upgradeCounts = p.upgradeCounts || {};
    p.upgradeCounts[id] = (p.upgradeCounts[id] || 0) + 1;
    if (id === 'might') p.damage *= 1.25;
    else if (id === 'swift') p.fireRate *= 1.2;
    else if (id === 'twin') p.projectiles += 1;
    else if (id === 'grace') p.speed *= 1.18;
    else if (id === 'vital') {
      p.maxHp += 25;
      p.hp = Math.min(p.maxHp, p.hp + 25);
    } else if (id === 'heartwood') {
      state.tree.maxHp += 40;
      state.tree.hp = Math.min(state.tree.maxHp, state.tree.hp + 40);
    } else if (id === 'longdash') p.dashBase *= 0.75;
    else if (id === 'magnet') p.magnet *= 1.45;
    else if (id === 'pierce') p.pierce += 1;
    state.pendingLevels -= 1;
    if (state.pendingLevels > 0) rollChoices();
    else state.choices = [];
    burst(p.x, p.y, 26, '#ffd98a', 190, 0.6);
  }

  function killEnemy(index, events) {
    const e = state.enemies[index];
    const base = ENEMIES[e.kind];
    state.kills += 1;
    state.score += base.score;
    burst(e.x, e.y, e.kind === 'brute' ? 42 : 14, e.kind === 'stinger' ? '#ff9db4' : '#c9bdf0', 210, 0.55);
    floatText(e.x, e.y - e.radius - 4, `+${base.score}`, '#ffd98a');
    for (let s = 0; s < base.xp; s += 1) {
      const angle = random() * TAU;
      const d = 4 + random() * 16;
      state.shards.push({ x: e.x + Math.cos(angle) * d, y: e.y + Math.sin(angle) * d, vx: 0, vy: 0, t: random() * TAU, age: 0 });
    }
    if (e.kind === 'brute') state.shake = Math.max(state.shake, 9);
    state.enemies.splice(index, 1);
    return events | EV_KILL;
  }

  function step(dt, intent) {
    let events = 0;
    const p = state.player;
    const tree = state.tree;
    state.time += dt;
    if (state.bannerT > 0) state.bannerT -= dt;
    state.shake = Math.max(0, state.shake - dt * 26);
    if (tree.hurtT > 0) tree.hurtT -= dt;

    // Particles and floating texts always drift, even on the title screen.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.t += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      if (pt.t >= pt.life) state.particles.splice(i, 1);
    }
    for (let i = state.texts.length - 1; i >= 0; i -= 1) {
      const t = state.texts[i];
      t.t += dt;
      t.y -= 34 * dt;
      if (t.t >= t.life) state.texts.splice(i, 1);
    }
    if (state.phase !== 'playing') return events;

    // --- Waves -------------------------------------------------------------
    if (state.wavePhase === 'calm') {
      state.waveTimer -= dt;
      if (state.waveTimer <= 0) events |= beginWave();
    } else if (state.wavePhase === 'wave') {
      if (state.spawnLeft > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = state.plan.interval * (0.7 + random() * 0.6);
          const wantBrute = state.brutesLeft > 0 && (state.spawnLeft <= state.brutesLeft || random() < 0.08);
          if (wantBrute) {
            spawnEnemy('brute');
            state.brutesLeft -= 1;
            events |= EV_BRUTE;
          } else {
            spawnEnemy(random() < state.plan.stingerShare ? 'stinger' : 'moth');
          }
          state.spawnLeft -= 1;
        }
      } else if (state.enemies.length === 0) {
        state.score += 100 * state.wave;
        floatText(tree.x, tree.y - 70, `Wave ${state.wave} held  +${100 * state.wave}`, '#7ed492');
        if (state.wave >= WAVES_TOTAL) {
          state.phase = 'win';
          state.score += Math.round(tree.hp) * 2 + Math.round(p.hp) * 2;
          state.wavePhase = 'done';
          burst(tree.x, tree.y - 40, 90, '#ffd98a', 320, 1.1);
          return events | EV_WIN;
        }
        state.wavePhase = 'calm';
        state.waveTimer = CALM_SECONDS;
      }
    }

    // --- The warden ----------------------------------------------------------
    p.fireTimer -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.hurtTimer > 0) p.hurtTimer -= dt;
    p.aimAngle = Math.atan2(intent.aimY - p.y, intent.aimX - p.x);

    if (intent.dash && p.dashCd <= 0 && p.dashTimer <= 0) {
      p.dashTimer = PLAYER.dashTime;
      p.dashCd = p.dashBase;
      const dx = intent.moveX || Math.cos(p.aimAngle);
      const dy = intent.moveY || Math.sin(p.aimAngle);
      const len = Math.hypot(dx, dy) || 1;
      p.dashDirX = dx / len;
      p.dashDirY = dy / len;
      events |= EV_DASH;
      burst(p.x, p.y, 10, '#ffd98a', 120, 0.35);
    }
    if (p.dashTimer > 0) {
      p.dashTimer -= dt;
      p.vx = p.dashDirX * PLAYER.dashSpeed;
      p.vy = p.dashDirY * PLAYER.dashSpeed;
    } else {
      p.vx = intent.moveX * p.speed;
      p.vy = intent.moveY * p.speed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.x = Math.min(FIELD.width - PLAYER.radius - 6, Math.max(PLAYER.radius + 6, p.x));
    p.y = Math.min(FIELD.height - PLAYER.radius - 6, Math.max(PLAYER.radius + 6, p.y));
    // The Tree is solid: the warden walks around its trunk, never through it.
    const td = Math.hypot(p.x - tree.x, p.y - tree.y);
    const minTd = TREE.radius + PLAYER.radius - 4;
    if (td < minTd && td > 0.01) {
      p.x = tree.x + ((p.x - tree.x) / td) * minTd;
      p.y = tree.y + ((p.y - tree.y) / td) * minTd;
    }

    // --- Ember bolts ---------------------------------------------------------
    if (intent.firing && p.fireTimer <= 0 && p.dashTimer <= 0) {
      p.fireTimer = 1 / p.fireRate;
      const spread = 0.09;
      for (let i = 0; i < p.projectiles; i += 1) {
        const offset = (i - (p.projectiles - 1) / 2) * spread;
        const angle = p.aimAngle + offset;
        state.bolts.push({
          x: p.x + Math.cos(p.aimAngle) * (PLAYER.radius + 4),
          y: p.y + Math.sin(p.aimAngle) * (PLAYER.radius + 4),
          vx: Math.cos(angle) * PLAYER.boltSpeed,
          vy: Math.sin(angle) * PLAYER.boltSpeed,
          life: PLAYER.boltLife,
          pierce: p.pierce,
          hitSet: null,
        });
      }
      events |= EV_SHOOT;
    }
    for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
      const b = state.bolts[i];
      b.life -= dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        state.bolts.splice(i, 1);
      }
    }
    // Bolt vs creature.
    for (let i = state.bolts.length - 1; i >= 0; i -= 1) {
      const b = state.bolts[i];
      for (let j = state.enemies.length - 1; j >= 0; j -= 1) {
        const e = state.enemies[j];
        if (b.hitSet && b.hitSet.has(e)) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (e.radius + 5) * (e.radius + 5)) {
          e.hp -= p.damage;
          e.hitT = 0.12;
          burst(b.x, b.y, 4, '#ffb347', 150, 0.3);
          events |= EV_HIT;
          if (e.hp <= 0) events = killEnemy(j, events);
          if (b.pierce > 0) {
            b.pierce -= 1;
            b.hitSet = b.hitSet || new Set();
            b.hitSet.add(e);
          } else {
            state.bolts.splice(i, 1);
          }
          break;
        }
      }
    }

    // --- Creatures -------------------------------------------------------------
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      if (e.hitT > 0) e.hitT -= dt;
      if (e.biteTimer > 0) e.biteTimer -= dt;
      const target = e.kind === 'stinger' ? p : tree;
      const dx = target.x - e.x;
      const dy = target.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      const reach = e.radius + (e.kind === 'stinger' ? PLAYER.radius : TREE.radius) - 2;
      if (d > reach) {
        const wob = Math.sin(state.time * 3 + e.wobble) * 0.25;
        const nx = dx / d;
        const ny = dy / d;
        e.x += (nx - ny * wob) * e.speed * dt;
        e.y += (ny + nx * wob) * e.speed * dt;
      } else if (e.biteTimer <= 0) {
        e.biteTimer = ENEMIES[e.kind].biteRate;
        if (e.kind === 'stinger') {
          if (p.dashTimer <= 0 && p.hurtTimer <= 0) {
            p.hp -= ENEMIES.stinger.bite;
            p.hurtTimer = 0.35;
            state.shake = Math.max(state.shake, 5);
            burst(p.x, p.y, 12, '#ff6b6b', 180, 0.4);
            events |= EV_HURT;
          }
        } else {
          tree.hp -= ENEMIES[e.kind].bite;
          tree.hurtT = 0.25;
          state.shake = Math.max(state.shake, e.kind === 'brute' ? 8 : 3);
          burst(tree.x + (e.x - tree.x) * 0.4, tree.y + (e.y - tree.y) * 0.4, 8, '#7ed492', 140, 0.4);
          events |= EV_TREE_HURT;
        }
      }
      // Creatures also jostle the warden aside when they swarm him directly.
      if (e.kind !== 'stinger' && d < e.radius + PLAYER.radius && target === tree) {
        // Moths and brutes are headed for the Tree; they ignore the warden.
      }
    }

    // --- Shards ------------------------------------------------------------------
    for (let i = state.shards.length - 1; i >= 0; i -= 1) {
      const s = state.shards[i];
      s.t += dt * 4;
      s.age += dt;
      const d2 = dist2(s.x, s.y, p.x, p.y);
      if (s.age > 1.1) {
        // A shard left lying soon yearns for the warden: it streams home on its own,
        // faster the longer it has waited, so no kill's worth is ever stranded.
        const d = Math.sqrt(d2) || 1;
        const speed = 300 + s.age * 160;
        s.x += ((p.x - s.x) / d) * speed * dt;
        s.y += ((p.y - s.y) / d) * speed * dt;
      } else if (d2 < p.magnet * p.magnet) {
        const d = Math.sqrt(d2) || 1;
        const pull = 340 * (1 - d / (p.magnet * 1.6)) + 120;
        s.x += ((p.x - s.x) / d) * pull * dt;
        s.y += ((p.y - s.y) / d) * pull * dt;
      }
      if (d2 < PLAYER.pickup * PLAYER.pickup) {
        state.shards.splice(i, 1);
        const before = state.pendingLevels;
        gainXp(1);
        if (state.pendingLevels > before) {
          events |= EV_LEVEL_UP;
          if (state.choices.length === 0) rollChoices();
        }
        events |= EV_PICKUP;
      }
    }

    // --- Endings -------------------------------------------------------------------
    if (p.hp <= 0 || tree.hp <= 0) {
      p.hp = Math.max(0, p.hp);
      tree.hp = Math.max(0, tree.hp);
      state.phase = 'over';
      state.overReason = p.hp <= 0 ? 'The warden’s light went out.' : 'The Heart Tree fell.';
      burst(p.hp <= 0 ? p.x : tree.x, p.hp <= 0 ? p.y : tree.y, 60, '#ff6b6b', 280, 0.9);
      state.shake = 12;
      events |= EV_OVER;
    }
    return events;
  }

  reset();
  return { state, reset, startRun, step, applyUpgrade };
}
