// Emberfall — shared constants: the field, the warden, the Heart Tree, the gloom's creatures
// and the ten waves of the Long Night. Everything the world and the renderer need to agree on
// lives here so a tuned number changes the game in exactly one place.

export const FIELD = { width: 1280, height: 720 };

/** Fixed simulation step, in seconds: the world advances in these and only these. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 16,
  speed: 265,
  maxHp: 100,
  damage: 12,
  fireRate: 5.5, // ember bolts per second
  boltSpeed: 640,
  boltLife: 1.05,
  dashSpeed: 880,
  dashTime: 0.16,
  dashCooldown: 1.6,
  magnet: 110, // ember shards drift to the warden inside this radius
  pickup: 30, // and are gathered inside this one
};

export const TREE = {
  x: FIELD.width / 2,
  y: FIELD.height / 2,
  radius: 36,
  maxHp: 300,
};

export const WAVES_TOTAL = 10;

/** How many creatures a wave sends, and how fast they arrive. */
export function wavePlan(wave) {
  return {
    count: 7 + wave * 6,
    interval: Math.max(0.34, 1.15 - wave * 0.08),
    brutes: wave === 5 || wave === 8 ? 1 : wave === 10 ? 2 : 0,
    stingerShare: Math.min(0.5, 0.12 + wave * 0.04),
    hpScale: 1 + (wave - 1) * 0.11,
    speedScale: 1 + (wave - 1) * 0.045,
  };
}

export const ENEMIES = {
  moth: { radius: 14, hp: 22, speed: 74, bite: 6, biteRate: 0.8, xp: 1, score: 10 },
  stinger: { radius: 12, hp: 16, speed: 122, bite: 8, biteRate: 0.65, xp: 2, score: 15 },
  brute: { radius: 30, hp: 300, speed: 40, bite: 22, biteRate: 1.1, xp: 8, score: 150 },
};

export const CALM_SECONDS = 3.2; // the hush between waves
export const XP_FIRST = 6; // shards to reach level 2
export const XP_GROWTH = 5; // extra shards per level after that

export const COLORS = {
  night: '#0b1026',
  nightLow: '#131a3a',
  ground: '#16213f',
  groundLine: '#1d2a52',
  ember: '#ffb347',
  emberHot: '#ff7847',
  warden: '#ffd98a',
  treeTrunk: '#6b4a2f',
  treeLeaf: '#3f9e63',
  treeLeafHot: '#7ed492',
  moth: '#8d7fb8',
  stinger: '#c65b7c',
  brute: '#5d4a8a',
  shard: '#ffc46b',
  text: '#f3ead8',
  textDim: '#aab3d6',
  danger: '#ff6b6b',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall.best';
