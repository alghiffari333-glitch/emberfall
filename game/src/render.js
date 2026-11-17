// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 field
// is scaled to fit the window and centred; the margin stays the night colour. Everything is
// drawn with canvas shapes — the warden is a small hooded figure of light, the Heart Tree a
// trunk with a breathing canopy, the gloom's creatures winged silhouettes — no images at all.

import { COLORS, FIELD, FONT, PLAYER, TREE, WAVES_TOTAL } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_UPGRADE = 'upgrade';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

const TAU = Math.PI * 2;

function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0, w: 0, h: 0 };
  /** Buttons drawn by the last frame, in field coordinates: {id, x, y, w, h}. */
  const buttons = [];

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.floor(window.innerWidth * dpr);
    const h = Math.floor(window.innerHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    view.w = w;
    view.h = h;
    view.scale = Math.min(w / FIELD.width, h / FIELD.height);
    view.ox = (w - FIELD.width * view.scale) / 2;
    view.oy = (h - FIELD.height * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function toField(px, py) {
    return { x: (px - view.ox) / view.scale, y: (py - view.oy) / view.scale };
  }

  function bar(x, y, w, h, frac, fill, label) {
    ctx.fillStyle = 'rgba(6,8,20,0.72)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = '#2a3358';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = fill;
    ctx.fillRect(x, y, w * Math.max(0, Math.min(1, frac)), h);
    if (label) {
      ctx.fillStyle = COLORS.text;
      ctx.font = `600 12px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 6, y + h / 2 + 1);
    }
  }

  function hpColor(frac) {
    return frac > 0.5 ? '#7ed492' : frac > 0.25 ? '#ffc46b' : COLORS.danger;
  }

  function drawBackground(state, t) {
    const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
    const dawn = state.phase === 'win' ? 0.55 : 0;
    g.addColorStop(0, dawn ? '#3a4470' : COLORS.night);
    g.addColorStop(1, dawn ? '#6b5a6e' : COLORS.nightLow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    // Stars / drifting spores.
    for (let i = 0; i < 70; i += 1) {
      const x = hash(i) * FIELD.width;
      const y = hash(i + 500) * FIELD.height;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.7 + i));
      ctx.globalAlpha = 0.25 * tw;
      ctx.fillStyle = '#cdd8ff';
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.globalAlpha = 1;
    // Ground rings around the grove.
    ctx.strokeStyle = COLORS.groundLine;
    ctx.lineWidth = 1.5;
    for (const r of [90, 170, 260, 360]) {
      ctx.beginPath();
      ctx.arc(TREE.x, TREE.y, r, 0, TAU);
      ctx.stroke();
    }
    // Fireflies: slow embers that belong to the grove, not the fight.
    for (let i = 0; i < 14; i += 1) {
      const a = t * (0.05 + hash(i + 900) * 0.08) + i * 2.4;
      const r = 60 + hash(i + 950) * 300;
      const x = TREE.x + Math.cos(a) * r;
      const y = TREE.y + Math.sin(a * 1.3) * r * 0.6;
      ctx.globalAlpha = 0.35 + 0.3 * Math.sin(t * 2 + i * 1.7);
      ctx.fillStyle = COLORS.ember;
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (dawn) {
      const dg = ctx.createLinearGradient(0, FIELD.height, 0, FIELD.height * 0.35);
      dg.addColorStop(0, 'rgba(255,166,88,0.35)');
      dg.addColorStop(1, 'rgba(255,166,88,0)');
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }
  }

  function drawTree(state, t) {
    const tree = state.tree;
    const sway = Math.sin(t * 0.8) * 3;
    const hurt = tree.hurtT > 0;
    // Roots and trunk.
    ctx.strokeStyle = COLORS.treeTrunk;
    ctx.lineWidth = 13;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tree.x, tree.y + 26);
    ctx.quadraticCurveTo(tree.x + sway * 0.4, tree.y, tree.x + sway, tree.y - 34);
    ctx.stroke();
    ctx.lineWidth = 7;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(tree.x + sway * 0.5, tree.y - 12);
      ctx.quadraticCurveTo(tree.x + s * 22, tree.y - 26, tree.x + s * 34 + sway, tree.y - 40);
      ctx.stroke();
    }
    // Canopy: layered circles breathing with the night; greyer as the Tree fades.
    const frac = tree.hp / tree.maxHp;
    const blobs = [
      [0, -58, 40], [-30, -42, 30], [30, -44, 32], [-14, -70, 28], [16, -72, 26], [0, -40, 30],
    ];
    for (const [bx, by, br] of blobs) {
      const pulse = 1 + Math.sin(t * 1.4 + bx) * 0.03;
      const grad = ctx.createRadialGradient(tree.x + bx + sway, tree.y + by, 2, tree.x + bx + sway, tree.y + by, br * pulse);
      grad.addColorStop(0, hurt ? '#e88f7a' : COLORS.treeLeafHot);
      grad.addColorStop(1, hurt ? '#8a4a3d' : COLORS.treeLeaf);
      ctx.globalAlpha = 0.55 + frac * 0.45;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(tree.x + bx + sway, tree.y + by, br * pulse, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The heart ember at the trunk's core.
    const hg = ctx.createRadialGradient(tree.x, tree.y - 6, 1, tree.x, tree.y - 6, 20);
    hg.addColorStop(0, 'rgba(255,217,138,0.95)');
    hg.addColorStop(1, 'rgba(255,120,71,0)');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.arc(tree.x, tree.y - 6, 20, 0, TAU);
    ctx.fill();
  }

  function drawWarden(state, t) {
    const p = state.player;
    const blink = p.hurtTimer > 0 && Math.floor(t * 18) % 2 === 0;
    // Soft light pool.
    const lg = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, 64);
    lg.addColorStop(0, 'rgba(255,180,80,0.30)');
    lg.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = lg;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 64, 0, TAU);
    ctx.fill();
    // Dash trail.
    if (p.dashTimer > 0) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = COLORS.ember;
      ctx.beginPath();
      ctx.arc(p.x - p.dashDirX * 18, p.y - p.dashDirY * 18, 10, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Cloak: a teardrop turned toward the aim.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aimAngle + Math.PI / 2);
    ctx.fillStyle = blink ? '#fff3f3' : '#31437c';
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.quadraticCurveTo(13, 2, 9, 15);
    ctx.quadraticCurveTo(0, 20, -9, 15);
    ctx.quadraticCurveTo(-13, 2, 0, -16);
    ctx.fill();
    ctx.fillStyle = blink ? '#ffe1e1' : COLORS.warden;
    ctx.beginPath();
    ctx.arc(0, -6, 7.5, 0, TAU);
    ctx.fill();
    ctx.restore();
    // The ember staff's tip, at the aim side.
    const sx = p.x + Math.cos(p.aimAngle) * 20;
    const sy = p.y + Math.sin(p.aimAngle) * 20;
    ctx.fillStyle = COLORS.emberHot;
    ctx.beginPath();
    ctx.arc(sx, sy, 3.4 + Math.sin(t * 9) * 0.7, 0, TAU);
    ctx.fill();
  }

  function drawEnemy(state, e, t) {
    const flash = e.hitT > 0;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.kind === 'moth' || e.kind === 'brute') {
      const flap = Math.sin(t * 16 + e.wobble) * 0.5;
      ctx.fillStyle = flash ? '#ffffff' : e.kind === 'brute' ? '#4a3870' : COLORS.moth;
      for (const s of [-1, 1]) {
        ctx.save();
        ctx.rotate(s * (0.5 + flap * 0.4));
        ctx.beginPath();
        ctx.ellipse(s * e.radius * 0.85, -e.radius * 0.2, e.radius * 0.8, e.radius * 0.42, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = flash ? '#ffffff' : e.kind === 'brute' ? COLORS.brute : '#6f5fa3';
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 0.62, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#ffb3c1';
      ctx.beginPath();
      ctx.arc(-e.radius * 0.22, -e.radius * 0.1, 2.2, 0, TAU);
      ctx.arc(e.radius * 0.22, -e.radius * 0.1, 2.2, 0, TAU);
      ctx.fill();
      if (e.kind === 'brute') {
        ctx.strokeStyle = '#d8ccff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-e.radius * 0.4, -e.radius * 0.5);
        ctx.lineTo(-e.radius * 0.7, -e.radius * 0.95);
        ctx.moveTo(e.radius * 0.4, -e.radius * 0.5);
        ctx.lineTo(e.radius * 0.7, -e.radius * 0.95);
        ctx.stroke();
      }
    } else {
      // Stinger: a sharp dart of a creature, aimed at the warden.
      const ang = Math.atan2(state.player.y - e.y, state.player.x - e.x);
      ctx.rotate(ang + Math.PI / 2);
      ctx.fillStyle = flash ? '#ffffff' : COLORS.stinger;
      ctx.beginPath();
      ctx.moveTo(0, -e.radius - 4);
      ctx.quadraticCurveTo(e.radius, e.radius * 0.6, 0, e.radius * 0.4);
      ctx.quadraticCurveTo(-e.radius, e.radius * 0.6, 0, -e.radius - 4);
      ctx.fill();
      ctx.fillStyle = '#ffe3ec';
      ctx.beginPath();
      ctx.arc(0, -2, 2.4, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    if (e.hp < e.maxHp) {
      const w = e.radius * 2;
      ctx.fillStyle = 'rgba(6,8,20,0.7)';
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 11, w, 4);
      ctx.fillStyle = COLORS.danger;
      ctx.fillRect(e.x - e.radius, e.y - e.radius - 11, w * Math.max(0, e.hp / e.maxHp), 4);
    }
  }

  function drawWorld(state, t) {
    drawBackground(state, t);
    // Shards.
    for (const s of state.shards) {
      const bob = Math.sin(s.t * 2.2) * 2;
      ctx.save();
      ctx.translate(s.x, s.y + bob);
      ctx.rotate(Math.PI / 4);
      ctx.fillStyle = COLORS.shard;
      ctx.fillRect(-4, -4, 8, 8);
      ctx.restore();
    }
    drawTree(state, t);
    for (const e of state.enemies) drawEnemy(state, e, t);
    // Bolts.
    for (const b of state.bolts) {
      const grad = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, 9);
      grad.addColorStop(0, '#fff2cf');
      grad.addColorStop(0.4, COLORS.ember);
      grad.addColorStop(1, 'rgba(255,120,71,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(b.x, b.y, 9, 0, TAU);
      ctx.fill();
    }
    drawWarden(state, t);
    // Particles.
    for (const pt of state.particles) {
      ctx.globalAlpha = Math.max(0, 1 - pt.t / pt.life);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Floating texts.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const tx of state.texts) {
      ctx.globalAlpha = Math.max(0, 1 - tx.t / tx.life);
      ctx.font = `700 15px ${FONT}`;
      ctx.fillStyle = tx.color;
      ctx.fillText(tx.text, tx.x, tx.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawHud(state, best, muted) {
    const p = state.player;
    const tree = state.tree;
    ctx.textBaseline = 'middle';
    bar(24, 20, 250, 16, p.hp / p.maxHp, hpColor(p.hp / p.maxHp), `Warden  ${Math.ceil(p.hp)} / ${p.maxHp}`);
    bar(24, 44, 250, 16, tree.hp / tree.maxHp, hpColor(tree.hp / tree.maxHp), `Heart Tree  ${Math.ceil(tree.hp)} / ${tree.maxHp}`);
    // Wave and remaining gloom.
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 22px ${FONT}`;
    const waveLabel = state.wave === 0 ? 'The Long Night' : `Wave ${state.wave} of ${WAVES_TOTAL}`;
    ctx.fillText(waveLabel, FIELD.width / 2, 30);
    ctx.font = `500 13px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    const left = state.spawnLeft + state.enemies.length;
    const sub = state.wavePhase === 'calm' && state.phase === 'playing'
      ? `Next wave in ${Math.max(0, state.waveTimer).toFixed(0)}…`
      : left > 0 ? `${left} creatures in the dark` : 'The grove holds';
    ctx.fillText(sub, FIELD.width / 2, 54);
    // Brute bar.
    const brute = state.enemies.find((e) => e.kind === 'brute');
    if (brute) {
      bar(FIELD.width / 2 - 190, 66, 380, 10, brute.hp / brute.maxHp, '#b79cff', '');
      ctx.font = `600 11px ${FONT}`;
      ctx.fillStyle = '#d8ccff';
      ctx.fillText('UMBRAL BRUTE', FIELD.width / 2, 88);
    }
    // Score.
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 22px ${FONT}`;
    ctx.fillText(`${state.score}`, FIELD.width - 24, 30);
    ctx.font = `500 13px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`Best ${Math.max(best, state.score)}`, FIELD.width - 24, 54);
    // Level and experience.
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.text;
    ctx.font = `700 15px ${FONT}`;
    ctx.fillText(`Level ${state.level}`, 24, FIELD.height - 44);
    bar(24, FIELD.height - 32, 220, 10, state.xp / state.xpNext, COLORS.ember, '');
    // Dash readiness.
    const ready = p.dashCd <= 0;
    ctx.fillStyle = ready ? COLORS.ember : '#3a4470';
    ctx.beginPath();
    ctx.arc(FIELD.width - 40, FIELD.height - 34, 11, 0, TAU);
    ctx.fill();
    ctx.fillStyle = COLORS.textDim;
    ctx.font = `500 12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(ready ? 'Dash ready (Space)' : 'Dash…', FIELD.width - 60, FIELD.height - 34);
    ctx.textAlign = 'left';
    ctx.fillText(muted ? 'Sound off (M)' : 'M — mute', 24, FIELD.height - 62);
  }

  function drawBanner(state) {
    if (state.bannerT <= 0 || !state.banner) return;
    const alpha = Math.min(1, state.bannerT / 0.5, (2.4 - state.bannerT) / 0.4 + 0.4);
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.textAlign = 'center';
    ctx.font = `800 40px ${FONT}`;
    ctx.fillStyle = COLORS.text;
    ctx.shadowColor = 'rgba(255,160,70,0.65)';
    ctx.shadowBlur = 24;
    ctx.fillText(state.banner, FIELD.width / 2, 150);
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
  }

  function panel(w, h) {
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    ctx.fillStyle = 'rgba(5,7,18,0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = 'rgba(16,22,48,0.94)';
    ctx.strokeStyle = '#33427a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 16);
    ctx.fill();
    ctx.stroke();
    return { x, y, w, h };
  }

  function button(id, x, y, w, h, label, primary) {
    ctx.fillStyle = primary ? '#e07b39' : '#232c52';
    ctx.strokeStyle = primary ? '#ffb347' : '#46538c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#fff6e8';
    ctx.font = `700 19px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + w / 2, y + h / 2 + 1);
    buttons.push({ id, x, y, w, h });
  }

  function stats(state, cx, y) {
    const lines = [
      `Score  ${state.score}`,
      `Waves held  ${state.phase === 'win' ? WAVES_TOTAL : Math.max(0, state.wave - (state.wavePhase === 'wave' ? 1 : 0))} of ${WAVES_TOTAL}`,
      `Creatures scattered  ${state.kills}`,
      `Warden level  ${state.level}`,
    ];
    ctx.font = `500 17px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.textAlign = 'center';
    lines.forEach((line, i) => ctx.fillText(line, cx, y + i * 26));
    return y + lines.length * 26;
  }

  function draw(state, screen, best, t, muted) {
    resize();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.night;
    ctx.fillRect(0, 0, view.w, view.h);
    const sx = state.shake ? (hash(Math.floor(t * 40)) - 0.5) * state.shake : 0;
    const sy = state.shake ? (hash(Math.floor(t * 40) + 77) - 0.5) * state.shake : 0;
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox + sx * view.scale, view.oy + sy * view.scale);
    buttons.length = 0;

    drawWorld(state, t);
    if (screen !== SCREEN_TITLE) drawHud(state, best, muted);
    if (screen === SCREEN_PLAY || screen === SCREEN_UPGRADE) drawBanner(state);

    if (screen === SCREEN_TITLE) {
      ctx.fillStyle = 'rgba(5,7,18,0.45)';
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 84px ${FONT}`;
      ctx.shadowColor = 'rgba(255,150,60,0.55)';
      ctx.shadowBlur = 34;
      ctx.fillText('EMBERFALL', FIELD.width / 2, 208);
      ctx.shadowBlur = 0;
      ctx.font = `500 19px ${FONT}`;
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText('Ten waves of gloom. One Heart Tree. Hold the grove until dawn.', FIELD.width / 2, 258);
      const lines = [
        'Move — W A S D or arrow keys',
        'Aim — mouse · Hold click (or F) — loose ember bolts',
        'Space / Shift — dash through danger',
        'Gather ember shards, level up, choose your gifts',
        'If the warden falls, or the Tree falls, the night wins',
      ];
      ctx.font = `500 16px ${FONT}`;
      ctx.fillStyle = COLORS.text;
      lines.forEach((line, i) => ctx.fillText(line, FIELD.width / 2, 316 + i * 27));
      button('start', FIELD.width / 2 - 130, 486, 260, 54, 'Begin the vigil', true);
      ctx.font = `500 14px ${FONT}`;
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(best > 0 ? `Best score so far: ${best} · or press Enter` : 'or press Enter', FIELD.width / 2, 574);
    } else if (screen === SCREEN_UPGRADE) {
      const box = panel(880, 300);
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 30px ${FONT}`;
      ctx.fillText('The ember grows', FIELD.width / 2, box.y + 52);
      ctx.font = `500 15px ${FONT}`;
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText(`Level ${state.level} — choose a gift (click, or press 1 · 2 · 3)`, FIELD.width / 2, box.y + 82);
      state.choices.forEach((choice, i) => {
        const w = 256;
        const h = 150;
        const x = box.x + 28 + i * (w + 18);
        const y = box.y + 112;
        ctx.fillStyle = '#1b2450';
        ctx.strokeStyle = '#ffb347';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, 12);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = COLORS.ember;
        ctx.font = `800 26px ${FONT}`;
        ctx.fillText(`${i + 1}`, x + w / 2, y + 34);
        ctx.fillStyle = COLORS.text;
        ctx.font = `700 19px ${FONT}`;
        ctx.fillText(choice.name, x + w / 2, y + 72);
        ctx.fillStyle = COLORS.textDim;
        ctx.font = `500 14px ${FONT}`;
        const words = choice.blurb.split(' ');
        let line = '';
        let ly = y + 100;
        for (const word of words) {
          if ((line + ' ' + word).trim().length > 30 && line) {
            ctx.fillText(line.trim(), x + w / 2, ly);
            ly += 19;
            line = '';
          }
          line += ' ' + word;
        }
        if (line.trim()) ctx.fillText(line.trim(), x + w / 2, ly);
        buttons.push({ id: `upgrade:${choice.id}`, x, y, w, h });
      });
    } else if (screen === SCREEN_PAUSED) {
      const box = panel(440, 210);
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.text;
      ctx.font = `800 32px ${FONT}`;
      ctx.fillText('Paused', FIELD.width / 2, box.y + 62);
      ctx.font = `500 15px ${FONT}`;
      ctx.fillStyle = COLORS.textDim;
      ctx.fillText('The night waits with you.', FIELD.width / 2, box.y + 96);
      button('resume', FIELD.width / 2 - 110, box.y + 122, 220, 48, 'Resume (P)', true);
    } else if (screen === SCREEN_OVER) {
      const box = panel(560, 430);
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.danger;
      ctx.font = `800 40px ${FONT}`;
      ctx.fillText('The grove has fallen', FIELD.width / 2, box.y + 66);
      ctx.font = `500 17px ${FONT}`;
      ctx.fillStyle = COLORS.text;
      ctx.fillText(state.overReason, FIELD.width / 2, box.y + 104);
      const endY = stats(state, FIELD.width / 2, box.y + 148);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `500 14px ${FONT}`;
      ctx.fillText(`Best ${Math.max(best, state.score)}`, FIELD.width / 2, endY + 12);
      button('restart', FIELD.width / 2 - 120, box.y + box.h - 84, 240, 52, 'Try again (R)', true);
    } else if (screen === SCREEN_WIN) {
      const box = panel(560, 446);
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.ember;
      ctx.font = `800 44px ${FONT}`;
      ctx.fillText('Dawn breaks', FIELD.width / 2, box.y + 68);
      ctx.font = `500 17px ${FONT}`;
      ctx.fillStyle = COLORS.text;
      ctx.fillText('The Heart Tree still stands. The grove is yours again.', FIELD.width / 2, box.y + 106);
      const endY = stats(state, FIELD.width / 2, box.y + 150);
      ctx.fillStyle = COLORS.textDim;
      ctx.font = `500 14px ${FONT}`;
      ctx.fillText(`Survival bonus included · Best ${Math.max(best, state.score)}`, FIELD.width / 2, endY + 12);
      button('restart', FIELD.width / 2 - 120, box.y + box.h - 84, 240, 52, 'New night (R)', true);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, toField, buttons, view };
}
