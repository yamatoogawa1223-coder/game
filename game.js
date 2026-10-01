'use strict';
// ももんがの夜の森 — 2Dドット絵アクション (HTML5 Canvas)

const W = 480, H = 270;
const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const FONT = "'DotGothic16', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif";
const WATER_Y = 236;   // これより下は湖
const DEATH_Y = 262;

// ---------- ユーティリティ ----------
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };

// ---------- ドット絵スプライト ----------
const PAL = {
  d: '#2a2444', g: '#9c92b6', G: '#7a7098', w: '#f3e6e2', p: '#e8a7ad',
  k: '#0b0b1a', h: '#ffffff',
};
function makeSprite(rows) {
  const c = document.createElement('canvas');
  c.width = rows[0].length; c.height = rows.length;
  const x = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, i) => {
    if (PAL[ch]) { x.fillStyle = PAL[ch]; x.fillRect(i, y, 1, 1); }
  }));
  return c;
}
function flipSprite(c) {
  const f = document.createElement('canvas');
  f.width = c.width; f.height = c.height;
  const x = f.getContext('2d');
  x.translate(c.width, 0); x.scale(-1, 1); x.drawImage(c, 0, 0);
  return f;
}

// 右向き 16x16
const IDLE_TOP = [
  '................',
  '....dd....dd....',
  '...dppd..dppd...',
  '...dpggddggpd...',
  '..dgggggggggwd..',
  '..dgwkhggkhwgd..',
  '..dgwkkwwkkwgd..',
  '..dggwwppwwggd..',
  '...dgwwwwwwgd...',
  '..dgwwwwwwwwgd..',
  'dddgwwwwwwwwgd..',
  'gGdgwwwwwwwwgd..',
  'gGgdwwwwwwwwgd..',
];
const FEET = {
  idle:  ['.dGdpdddddpdGd..', '..dd.dddddd.dd..'],
  walk1: ['.dGdpddddd.dGd..', '..dd.ddddd.pdd..'],
  walk2: ['.dGd.dddddpdGd..', '..dd.dddddd.dd..'],
  jump:  ['dpd.dddddddd.dpd', '.d.............d'],
  land:  ['.dGdpdddddpdGd..', '.dddd.dddd.dddd.'],
};
const mk = feet => makeSprite([...IDLE_TOP, ...feet]);
const SPR = {
  idle: mk(FEET.idle), walk1: mk(FEET.walk1), walk2: mk(FEET.walk2),
  jump: mk(FEET.jump), land: mk(FEET.land),
  glide: makeSprite([
    '..........dd....dd......',
    '.........dppd..dppd.....',
    '........dpggddddggd.....',
    '..dddddddgggggggggwd....',
    '.dGgggwwwwgwkhggkhwgd...',
    'dGgwwwwwwwwwkkwwkkwgd...',
    'dGgwwwwwwwwwwwppwwgd....',
    '.dGgwwwwwwwwwwwwwgd.....',
    '..dGgwwwwwwwwwwwgd......',
    'gg.dGgwwwwwwwwwgd.......',
    'GGgddGgggwwwwgggd.......',
    '.dGGdpdddddddpdGd.......',
    '..dd.dd.......dd........',
  ]),
};
for (const k of Object.keys(SPR)) SPR[k + 'L'] = flipSprite(SPR[k]);

const ROCK = makeSprite([
  '....dddddd....',
  '..ddGGGGGGdd..',
  '.dGGgggggGGGd.',
  'dGgggggGgggggd',
  'dGggggGGggggGd',
  'dGgggggggggGGd',
  'dGGggggggGGGdd',
  '.ddGGGGGGGddd.',
]);

// ---------- サウンド ----------
let ac = null;
function beep(f, d, type = 'square', v = 0.05, slide = 0) {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, ac.currentTime);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), ac.currentTime + d);
    g.gain.setValueAtTime(v, ac.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + d);
    o.connect(g); g.connect(ac.destination); o.start(); o.stop(ac.currentTime + d);
  } catch (e) { /* 音が出せなくても続行 */ }
}
const SFX = {
  jump: () => beep(330, 0.14, 'square', 0.04, 260),
  coin: () => { beep(880, 0.07, 'square', 0.04); setTimeout(() => beep(1320, 0.1, 'square', 0.04), 55); },
  orb: () => { beep(520, 0.25, 'triangle', 0.08, 700); },
  hit: () => beep(160, 0.3, 'sawtooth', 0.07, -110),
  stomp: () => beep(240, 0.12, 'square', 0.05, 200),
  over: () => { beep(330, 0.3, 'triangle', 0.08, -150); setTimeout(() => beep(196, 0.6, 'triangle', 0.08, -90), 250); },
  splash: () => beep(120, 0.3, 'sine', 0.08, -60),
};

// ---------- 入力 ----------
const keys = new Set();
let jumpBuf = 0;
const JUMP_KEYS = ['ArrowUp', 'KeyW', 'Space'];
const isDown = (...c) => c.some(k => keys.has(k));
addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (!e.repeat) onPress(e.code);
  keys.add(e.code);
});
addEventListener('keyup', e => keys.delete(e.code));
addEventListener('blur', () => keys.clear());
function onPress(code) {
  if (state === 'battle') return;
  if (state === 'title' || state === 'over') {
    if (code === 'Enter' || code === 'Space' || code === 'KeyZ' || code === 'ArrowUp') { startGame(); return; }
  }
  if (state === 'play' && (code === 'KeyP' || code === 'Escape')) { state = 'pause'; return; }
  if (state === 'pause' && (code === 'KeyP' || code === 'Escape' || code === 'Enter')) { state = 'play'; return; }
  if (state === 'play' && JUMP_KEYS.includes(code)) jumpBuf = 0.12;
}
document.querySelectorAll('.pad button').forEach(b => {
  const k = b.dataset.k;
  const down = e => { e.preventDefault(); b.classList.add('on'); if (!keys.has(k)) onPress(k); keys.add(k); };
  const up = e => { e.preventDefault(); b.classList.remove('on'); keys.delete(k); };
  b.addEventListener('pointerdown', down);
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => b.addEventListener(t, up));
});
cv.addEventListener('pointerdown', e => {
  if (state === 'title' && (e.clientY - cv.getBoundingClientRect().top) / cv.getBoundingClientRect().height > 0.9) return; // 下端はリズム戦闘へ
  if (state === 'title' || state === 'over') startGame();
});

// ---------- ゲーム状態 ----------
let state = 'title';
let cam, player, plats, coins, orbs, rocks, bats, parts, deco;
let genX, lastY, score, coinCount, maxX, time, batTimer, best = 0, shake;
try { best = +localStorage.getItem('momonga_best') || 0; } catch (e) { /* noop */ }

const dist = () => Math.floor(maxX / 12);
const diff = () => Math.min(1, dist() / 700);

function startGame() {
  cam = { x: -140 };
  player = {
    x: 40, y: 200, vx: 0, vy: 0, ground: null, face: 1, hp: 3, inv: 0, coyote: 0,
    stamina: 1, gliding: false, anim: 0, landT: 0, shield: 0, lastPlat: null,
  };
  plats = []; coins = []; orbs = []; rocks = []; bats = []; parts = []; deco = [];
  plats.push({ x: -200, y: 200, w: 520, seed: 1, lastRock: true });
  plats[0].lamp = 140;
  genX = 320; lastY = 200;
  score = 0; coinCount = 0; maxX = 0; time = 0; batTimer = 4; shake = 0; jumpBuf = 0;
  state = 'play';
  SFX.jump();
}

// ---------- ステージ生成 ----------
let seedCounter = 10;
function generate() {
  while (genX < cam.x + W + 240) {
    const d = diff();
    const m = genX / 12;
    const gap = rand(30 + 30 * d, 70 + 130 * d);
    const w = Math.round(rand(110 - 30 * d, 230 - 90 * d));
    const y = clamp(lastY + rand(-42, 30), 150, 218);
    const x = genX + gap;
    const p = { x, y, w, seed: ++seedCounter, bridge: m > 50 && Math.random() < 0.28 };
    plats.push(p);

    // ギャップ上のコインアーク / おたから
    const prev = plats[plats.length - 2];
    const x0 = prev.x + prev.w, x1 = x;
    const yMid = Math.min(prev.y, y) - 46;
    if (Math.random() < 0.7) {
      const n = Math.max(3, Math.min(6, Math.round(gap / 22)));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        coins.push({ x: x0 + (x1 - x0) * t, y: (prev.y + (y - prev.y) * t) - 22 - Math.sin(t * Math.PI) * (yMid ? 26 : 0), ph: Math.random() * 6 });
      }
    }
    if (Math.random() < 0.08 + 0.04 * d) orbs.push({ x: (x0 + x1) / 2, y: yMid - 6, ph: 0 });

    // 足場の上のコイン
    if (Math.random() < 0.6) {
      const n = 3 + Math.floor(Math.random() * 3);
      const sx = x + 20 + Math.random() * Math.max(1, w - 40 - n * 16);
      for (let i = 0; i < n; i++) coins.push({ x: sx + i * 16, y: y - 18, ph: i });
    }
    // 岩
    if (m > 40 && w >= 120 && Math.random() < 0.25 + 0.45 * d) {
      rocks.push({ x: x + rand(50, w - 30), y, w: 14, h: 9 });
    }
    // 飾り
    const r = Math.random();
    if (w >= 140 && r < 0.3) p.lamp = rand(20, w - 20);
    else if (r < 0.6) p.deco = { t: Math.random() < 0.5 ? 'mush' : 'flower', x: rand(8, w - 8) };
    genX = x + w;
    lastY = y;
  }
  // 画面の左に流れたものを削除
  const lim = cam.x - 200;
  plats = plats.filter(p => p.x + p.w > lim);
  coins = coins.filter(c => c.x > lim);
  orbs = orbs.filter(c => c.x > lim);
  rocks = rocks.filter(c => c.x > lim);
}

// ---------- 更新 ----------
function burst(x, y, color, n = 6, sp = 60, life = 0.5) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, s = rand(sp * 0.3, sp);
    parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20, life: rand(life * 0.5, life), max: life, color, size: Math.random() < 0.5 ? 1 : 2 });
  }
}

function hurt() {
  if (player.inv > 0) return;
  if (player.shield > 0) return;
  player.hp--; player.inv = 1.8; player.vy = -170; shake = 0.25;
  SFX.hit(); burst(player.x, player.y - 8, '#ff7b9a', 8, 80);
  if (player.hp <= 0) gameOver();
}
function gameOver() {
  state = 'over'; SFX.over();
  const s = totalScore();
  if (s > best) { best = s; try { localStorage.setItem('momonga_best', best); } catch (e) { /* noop */ } }
}
const totalScore = () => score + dist();

function respawn() {
  const p = player.lastPlat && plats.includes(player.lastPlat) ? player.lastPlat : plats[0];
  player.x = p.x + Math.min(p.w * 0.5, Math.max(20, cam.x + 140 - p.x));
  player.x = clamp(player.x, p.x + 10, p.x + p.w - 10);
  player.y = p.y - 2; player.vx = 0; player.vy = 0; player.ground = p; player.inv = 2; player.stamina = 1;
  bats.length = 0;
}

function update(dt) {
  time += dt;
  const P = player;
  const left = isDown('ArrowLeft', 'KeyA'), right = isDown('ArrowRight', 'KeyD');
  const glideKey = isDown('KeyZ', 'KeyX', 'ShiftLeft', 'ShiftRight');
  const dir = (right ? 1 : 0) - (left ? 1 : 0);
  if (dir) P.face = dir;

  jumpBuf -= dt;
  P.inv = Math.max(0, P.inv - dt);
  P.shield = Math.max(0, P.shield - dt);
  P.landT = Math.max(0, P.landT - dt);
  if (P.ground) P.coyote = 0.09; else P.coyote -= dt;

  // 水平移動
  P.gliding = !P.ground && P.vy > 0 && glideKey && P.stamina > 0;
  const speed = P.gliding ? 150 : 110;
  const target = dir * speed;
  const acc = P.ground ? 900 : 500;
  P.vx += clamp(target - P.vx, -acc * dt, acc * dt);

  // ジャンプ
  if (jumpBuf > 0 && P.coyote > 0) {
    P.vy = -300; P.ground = null; P.coyote = 0; jumpBuf = 0; SFX.jump();
    burst(P.x, P.y, '#cfc8e8', 4, 30, 0.3);
  }
  if (!P.ground && P.vy < -100 && !isDown(...JUMP_KEYS)) P.vy += 1400 * dt; // 短押しで低く

  // 重力 / 滑空
  if (P.gliding) {
    P.vy = Math.min(P.vy + 300 * dt, 32);
    P.stamina = Math.max(0, P.stamina - dt / 1.5);
    if (Math.random() < 0.3) parts.push({ x: P.x - P.face * 8, y: P.y - 6, vx: 0, vy: 8, life: 0.4, max: 0.4, color: '#9fb4ff', size: 1 });
  } else {
    P.vy = Math.min(P.vy + 900 * dt, 420);
  }

  const prevY = P.y;
  P.x += P.vx * dt;
  P.y += P.vy * dt;
  P.x = Math.max(P.x, cam.x + 10, 4);

  // 足場との当たり判定 (上からのみ)
  let landed = null;
  if (P.vy >= 0) {
    for (const p of plats) {
      if (P.x > p.x - 3 && P.x < p.x + p.w + 3 && prevY <= p.y + 1 && P.y >= p.y) { landed = p; break; }
    }
  }
  if (landed) {
    if (!P.ground && P.vy > 150) { P.landT = 0.12; burst(P.x, landed.y, '#cfc8e8', 4, 35, 0.3); }
    P.y = landed.y; P.vy = 0; P.ground = landed; P.stamina = 1;
    if (landed.w > 60) P.lastPlat = landed;
  } else if (P.ground) {
    const p = P.ground;
    if (!(P.x > p.x - 3 && P.x < p.x + p.w + 3)) P.ground = null;
    else P.y = p.y;
  }

  // 落下 (湖ポチャ)
  if (P.y > DEATH_Y) {
    SFX.splash(); burst(P.x, WATER_Y, '#8fb4ff', 12, 90, 0.7);
    P.hp--; shake = 0.3;
    if (P.hp <= 0) { gameOver(); return; }
    respawn();
  }

  P.anim += dt * (Math.abs(P.vx) / 110) * 9;
  maxX = Math.max(maxX, P.x);

  // カメラ
  const wantX = P.x - 150;
  cam.x += (wantX - cam.x) * Math.min(1, dt * 5);
  if (cam.x < wantX - 60) cam.x = wantX - 60;
  generate();

  // コイン
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    if (Math.abs(c.x - P.x) < 11 && Math.abs(c.y - (P.y - 8)) < 13) {
      coins.splice(i, 1); score += 10; coinCount++; SFX.coin(); burst(c.x, c.y, '#ffd44a', 5, 40, 0.4);
    }
  }
  // おたから
  for (let i = orbs.length - 1; i >= 0; i--) {
    const o = orbs[i];
    if (Math.abs(o.x - P.x) < 13 && Math.abs(o.y - (P.y - 8)) < 15) {
      orbs.splice(i, 1); score += 100; SFX.orb(); burst(o.x, o.y, '#7f8dff', 12, 90, 0.7);
      if (P.hp < 3) P.hp++; else P.shield = 6;
      P.shield = Math.max(P.shield, 3);
    }
  }
  // 岩
  for (const r of rocks) {
    if (Math.abs(r.x - P.x) < 9 && P.y > r.y - r.h && P.y - 12 < r.y) hurt();
  }
  // コウモリ
  batTimer -= dt;
  if (dist() > 80 && batTimer <= 0) {
    batTimer = rand(3.5 - 1.8 * diff(), 6 - 2.5 * diff());
    bats.push({ x: cam.x + W + 20, y0: rand(90, 190), t: rand(0, 6), vx: -(38 + 35 * diff()) });
  }
  for (let i = bats.length - 1; i >= 0; i--) {
    const b = bats[i];
    b.t += dt; b.x += b.vx * dt; b.y = b.y0 + Math.sin(b.t * 2.4) * 22;
    if (b.x < cam.x - 40) { bats.splice(i, 1); continue; }
    if (Math.abs(b.x - P.x) < 11 && Math.abs(b.y - (P.y - 8)) < 11) {
      if (P.vy > 40 && P.y - 6 < b.y) {
        bats.splice(i, 1); P.vy = -240; P.stamina = 1; score += 50; SFX.stomp(); burst(b.x, b.y, '#b98cff', 8, 70, 0.5);
      } else if (P.inv <= 0 && P.shield <= 0) {
        hurt();
      }
    }
  }

  // パーティクル
  for (let i = parts.length - 1; i >= 0; i--) {
    const q = parts[i];
    q.life -= dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt;
    if (q.life <= 0) parts.splice(i, 1);
  }
  shake = Math.max(0, shake - dt);
}

// ---------- 描画: 背景 ----------
const STARS = Array.from({ length: 70 }, (_, i) => ({ x: hash(i) * W, y: hash(i + 99) * 150, s: hash(i + 5) }));
const FLIES = Array.from({ length: 22 }, (_, i) => ({ x: hash(i + 300) * W, y: 90 + hash(i + 400) * 140, p: hash(i + 500) * 6 }));
const glowCache = {};
function glow(r, color) {
  const k = r + color;
  if (glowCache[k]) return glowCache[k];
  const c = document.createElement('canvas'); c.width = c.height = r * 2;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, r * 2, r * 2);
  return (glowCache[k] = c);
}

function drawBackground(cx) {
  const g = ctx.createLinearGradient(0, 0, 0, WATER_Y);
  g.addColorStop(0, '#070c2b'); g.addColorStop(0.6, '#132257'); g.addColorStop(1, '#25397f');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  for (const s of STARS) {
    const tw = 0.5 + 0.5 * Math.sin(time * 2 + s.s * 20);
    ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.6 * tw * s.s})`;
    ctx.fillRect(Math.floor(s.x), Math.floor(s.y), 1, 1);
  }
  // 月
  ctx.drawImage(glow(60, 'rgba(255,240,190,0.45)'), 320 - 60, 56 - 60);
  ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(320, 56, 22, 0, 6.283); ctx.fill();
  ctx.fillStyle = '#e8d9a0';
  [[312, 50, 4], [326, 62, 3], [325, 46, 2]].forEach(([x, y, r]) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.fill(); });

  // 雲
  ctx.fillStyle = 'rgba(70,90,170,0.35)';
  for (let i = 0; i < 4; i++) {
    const x = ((i * 190 - cx * 0.05 - time * 3) % (W + 160) + W + 160) % (W + 160) - 80;
    ctx.fillRect(x, 40 + i * 22, 60, 5); ctx.fillRect(x + 10, 36 + i * 22, 36, 5);
  }

  // 遠くの山
  ctx.fillStyle = '#16225a';
  ctx.beginPath(); ctx.moveTo(0, WATER_Y);
  for (let x = 0; x <= W; x += 4) {
    const wx = x + cx * 0.08;
    ctx.lineTo(x, 172 + Math.sin(wx * 0.011) * 22 + Math.sin(wx * 0.027 + 1) * 10);
  }
  ctx.lineTo(W, WATER_Y); ctx.fill();

  // 湖畔の小屋
  const hk = 0.18;
  for (let i = -1; i < W / 150 + 2; i++) {
    const wi = Math.floor(cx * hk / 150) + i;
    if (hash(wi + 77) < 0.55) continue;
    const x = wi * 150 + 40 - cx * hk, y = 220;
    ctx.fillStyle = '#0d1440'; ctx.fillRect(x, y - 8, 16, 8); ctx.fillRect(x + 2, y - 11, 12, 3);
    ctx.fillStyle = '#ffcf5a'; ctx.fillRect(x + 3, y - 6, 2, 2); ctx.fillRect(x + 10, y - 6, 2, 2);
  }
  // 森 (遠)
  drawPines(cx, 0.28, 24, 28, 46, '#0c1a3e', 232);
  // 森 (近)
  drawPines(cx, 0.55, 44, 60, 100, '#08162a', 240, true);
}

function drawPines(cx, k, step, hMin, hMax, color, base, big) {
  ctx.fillStyle = color;
  const off = cx * k;
  const first = Math.floor(off / step) - 1;
  for (let i = first; i < first + W / step + 3; i++) {
    const h = hMin + hash(i * (big ? 3 : 1) + (big ? 9 : 2)) * (hMax - hMin);
    const x = i * step - off;
    const tiers = big ? 5 : 4;
    for (let t = 0; t < tiers; t++) {
      const ty = base - h + (h / tiers) * t;
      const tw = (step * 0.9) * ((t + 1) / tiers);
      ctx.fillRect(Math.round(x - tw / 2), Math.round(ty), Math.round(tw), Math.ceil(h / tiers) + 1);
    }
    if (big) ctx.fillRect(Math.round(x - 3), base - 4, 6, 40);
  }
  ctx.fillRect(0, base, W, 60);
}

function drawWater() {
  const g = ctx.createLinearGradient(0, WATER_Y, 0, H);
  g.addColorStop(0, '#1b3a8c'); g.addColorStop(1, '#0a1240');
  ctx.fillStyle = g; ctx.fillRect(0, WATER_Y, W, H - WATER_Y);
  // 月の反射
  for (let y = WATER_Y + 2; y < H; y += 4) {
    const w = 10 + 8 * Math.sin(time * 2 + y * 0.5);
    ctx.fillStyle = `rgba(255,240,190,${0.5 - (y - WATER_Y) / 90})`;
    ctx.fillRect(320 - w / 2, y, w, 1);
  }
  // さざなみ
  ctx.fillStyle = 'rgba(140,170,255,0.25)';
  for (let i = 0; i < 16; i++) {
    const x = ((i * 47 - cam.x * 0.6 + Math.sin(time + i) * 6) % (W + 40) + W + 40) % (W + 40) - 20;
    ctx.fillRect(x, WATER_Y + 4 + (i * 7) % 26, 12, 1);
  }
}

// ---------- 描画: オブジェクト ----------
function drawPlatform(p) {
  const x = Math.round(p.x - cam.x), y = p.y, w = p.w;
  if (x > W + 10 || x + w < -10) return;
  if (p.bridge) {
    ctx.fillStyle = '#3a2416';
    for (let px = 14; px < w - 6; px += 46) ctx.fillRect(x + px, y + 5, 5, H - y);
    ctx.fillStyle = '#7a5230'; ctx.fillRect(x, y, w, 6);
    ctx.fillStyle = '#a4703f'; ctx.fillRect(x, y, w, 2);
    ctx.fillStyle = '#4a2f1a';
    for (let px = 8; px < w; px += 10) ctx.fillRect(x + px, y, 1, 6);
    return;
  }
  // 木の柱
  ctx.fillStyle = '#2b1f2e';
  const t1 = x + Math.floor(w * 0.28), t2 = x + Math.floor(w * 0.72);
  [t1, t2].forEach((tx, i) => {
    if (i === 1 && w < 130) return;
    ctx.fillRect(tx - 7, y + 12, 14, H - y);
    ctx.fillStyle = '#3f2c34'; ctx.fillRect(tx - 7, y + 12, 3, H - y);
    ctx.fillStyle = '#2b1f2e';
  });
  // 土
  ctx.fillStyle = '#4b3324'; ctx.fillRect(x, y + 4, w, 12);
  ctx.fillStyle = '#5f4330';
  for (let i = 0; i < w; i += 9) ctx.fillRect(x + i + (hash(p.seed + i) * 4 | 0), y + 8 + (i % 3) * 3, 3, 2);
  ctx.fillStyle = '#4b3324';
  for (let i = 0; i < w; i += 6) ctx.fillRect(x + i, y + 16, 5, 2 + (hash(p.seed * 3 + i) * 5 | 0));
  // 草
  ctx.fillStyle = '#2e7a35'; ctx.fillRect(x - 2, y, w + 4, 6);
  ctx.fillStyle = '#4fae45'; ctx.fillRect(x - 2, y, w + 4, 2);
  ctx.fillStyle = '#7ad160';
  for (let i = 0; i < w; i += 7) ctx.fillRect(x + i, y - 1 - (hash(p.seed + i * 2) * 2 | 0), 1, 2);
  // つた
  ctx.fillStyle = '#2e7a35';
  for (let i = 4; i < w - 4; i += 11) {
    if (hash(p.seed + i) > 0.5) ctx.fillRect(x + i, y + 6, 2, 8 + (hash(i + p.seed) * 14 | 0));
  }
  // 飾り
  if (p.lamp) {
    const lx = x + p.lamp;
    ctx.drawImage(glow(34, 'rgba(255,190,80,0.55)'), lx - 34, y - 42 - 34 + 12);
    ctx.fillStyle = '#4a3324'; ctx.fillRect(lx, y - 40, 3, 40); ctx.fillRect(lx, y - 40, 12, 3);
    ctx.fillStyle = '#c98b2b'; ctx.fillRect(lx + 8, y - 37, 6, 9);
    ctx.fillStyle = '#ffd36a'; ctx.fillRect(lx + 9, y - 35, 4, 6);
  }
  if (p.deco) {
    const dx = x + p.deco.x;
    if (p.deco.t === 'mush') {
      ctx.fillStyle = '#e8dcc8'; ctx.fillRect(dx, y - 4, 2, 4);
      ctx.fillStyle = '#e0435a'; ctx.fillRect(dx - 2, y - 7, 6, 3); ctx.fillRect(dx - 1, y - 8, 4, 1);
      ctx.fillStyle = '#fff'; ctx.fillRect(dx, y - 6, 1, 1);
    } else {
      ctx.fillStyle = '#4fae45'; ctx.fillRect(dx, y - 5, 1, 5);
      ctx.fillStyle = '#fff5d6'; ctx.fillRect(dx - 2, y - 8, 5, 3); ctx.fillRect(dx - 1, y - 9, 3, 5);
      ctx.fillStyle = '#ffd44a'; ctx.fillRect(dx, y - 7, 1, 1);
    }
  }
}

function drawCoin(c) {
  const x = Math.round(c.x - cam.x), y = Math.round(c.y + Math.sin(time * 3 + c.ph) * 2);
  if (x < -10 || x > W + 10) return;
  const w = Math.max(2, Math.round(7 * Math.abs(Math.cos(time * 4 + c.ph))));
  ctx.fillStyle = '#a86b12'; ctx.fillRect(x - w / 2 - 1, y - 5, w + 2, 10);
  ctx.fillStyle = '#ffd44a'; ctx.fillRect(x - w / 2, y - 4, w, 8);
  ctx.fillStyle = '#fff0a0'; ctx.fillRect(x - w / 2, y - 4, Math.max(1, w / 3), 4);
}
function drawOrb(o) {
  const x = Math.round(o.x - cam.x), y = Math.round(o.y + Math.sin(time * 2.5) * 3);
  if (x < -20 || x > W + 20) return;
  ctx.drawImage(glow(22, 'rgba(110,130,255,0.7)'), x - 22, y - 22);
  ctx.fillStyle = '#3a3fc2'; ctx.fillRect(x - 5, y - 6, 10, 12); ctx.fillRect(x - 6, y - 4, 12, 8);
  ctx.fillStyle = '#7f8dff'; ctx.fillRect(x - 4, y - 5, 8, 10);
  ctx.fillStyle = '#d6dcff'; ctx.fillRect(x - 2, y - 4, 3, 4);
}
function drawRock(r) {
  const x = Math.round(r.x - cam.x - 7), y = r.y - 9;
  if (x < -20 || x > W + 20) return;
  ctx.drawImage(ROCK, x, y);
}
function drawBat(b) {
  const x = Math.round(b.x - cam.x), y = Math.round(b.y);
  const up = Math.sin(b.t * 14) > 0;
  ctx.fillStyle = '#5a3c9a';
  const wy = up ? -6 : 1;
  ctx.fillRect(x - 12, y + wy, 8, 3); ctx.fillRect(x - 9, y + wy - 2, 5, 2);
  ctx.fillRect(x + 4, y + wy, 8, 3); ctx.fillRect(x + 4, y + wy - 2, 5, 2);
  ctx.fillRect(x - 6, y - 1, 4, 3); ctx.fillRect(x + 2, y - 1, 4, 3);
  ctx.fillStyle = '#7a56c4'; ctx.fillRect(x - 4, y - 4, 8, 9);
  ctx.fillStyle = '#3a2470'; ctx.fillRect(x - 4, y - 7, 2, 3); ctx.fillRect(x + 2, y - 7, 2, 3);
  ctx.fillStyle = '#ffdd55'; ctx.fillRect(x - 3, y - 2, 2, 2); ctx.fillRect(x + 1, y - 2, 2, 2);
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 2, y + 2, 1, 1); ctx.fillRect(x + 1, y + 2, 1, 1);
}

function drawPlayer() {
  const P = player;
  if (P.inv > 0 && Math.floor(time * 16) % 2 === 0) return;
  let key = 'idle', bob = 0;
  if (P.gliding) key = 'glide';
  else if (!P.ground) key = 'jump';
  else if (P.landT > 0) key = 'land';
  else if (Math.abs(P.vx) > 15) { key = Math.floor(P.anim) % 2 ? 'walk1' : 'walk2'; bob = Math.floor(P.anim) % 2 ? 0 : -1; }
  else bob = Math.sin(time * 3) > 0.6 ? -1 : 0;
  const img = SPR[key + (P.face < 0 ? 'L' : '')];
  const x = Math.round(P.x - cam.x - img.width / 2), y = Math.round(P.y - img.height + bob + 1);
  if (P.shield > 0) {
    ctx.globalAlpha = 0.5 + 0.2 * Math.sin(time * 10);
    ctx.drawImage(glow(26, 'rgba(120,150,255,0.9)'), P.x - cam.x - 26, P.y - 8 - 26);
    ctx.globalAlpha = 1;
  }
  if (key === 'land') ctx.drawImage(img, x - 2, y + 2, img.width + 4, img.height - 2);
  else ctx.drawImage(img, x, y);
  // スタミナ表示
  if (!P.ground && P.stamina < 1) {
    const bx = Math.round(P.x - cam.x - 8), by = Math.round(P.y - 24);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(bx - 1, by - 1, 18, 4);
    ctx.fillStyle = P.stamina > 0.3 ? '#8fb4ff' : '#ff8fa0'; ctx.fillRect(bx, by, Math.round(16 * P.stamina), 2);
  }
}

function drawParticles() {
  for (const q of parts) {
    ctx.globalAlpha = clamp(q.life / q.max, 0, 1);
    ctx.fillStyle = q.color; ctx.fillRect(Math.round(q.x - cam.x), Math.round(q.y), q.size, q.size);
  }
  ctx.globalAlpha = 1;
  // ホタル
  for (const f of FLIES) {
    const x = ((f.x - cam.x * 0.7 + Math.sin(time * 0.6 + f.p) * 14) % W + W) % W;
    const y = f.y + Math.sin(time * 0.9 + f.p * 2) * 10;
    const a = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.4 + f.p));
    ctx.fillStyle = `rgba(190,255,150,${a})`; ctx.fillRect(Math.round(x), Math.round(y), 2, 2);
    ctx.globalAlpha = a * 0.5; ctx.drawImage(glow(6, 'rgba(190,255,150,0.6)'), x - 5, y - 5); ctx.globalAlpha = 1;
  }
}

// ---------- 描画: HUD ----------
const HEART = ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'];
function drawHeart(x, y, full) {
  HEART.forEach((row, j) => [...row].forEach((c, i) => {
    if (c !== 'r') return;
    ctx.fillStyle = full ? (j < 2 && i < 3 ? '#ff8fa0' : '#f0455f') : '#3a2f52';
    ctx.fillRect(x + i * 3, y + j * 3, 3, 3);
  }));
}
function text(s, x, y, size, color = '#fff', align = 'left') {
  ctx.font = `${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = 'rgba(5,8,30,0.85)'; ctx.fillText(s, x + 1, y + 1);
  ctx.fillStyle = color; ctx.fillText(s, x, y);
}
function drawHUD() {
  for (let i = 0; i < 3; i++) drawHeart(10 + i * 26, 10, i < player.hp);
  text(dist() + 'm', W - 12, 30, 24, '#fff', 'right');
  text(`${score}`, W - 12, 48, 12, '#ffe58a', 'right');
  ctx.fillStyle = '#ffd44a'; ctx.fillRect(W - 20 - Math.ceil(ctx.measureText(`${score}`).width), 39, 6, 8);
  if (player.shield > 0) text('★ムテキ', 12, 48, 11, '#a9b6ff');
}

function drawOverlayPanel() {
  ctx.fillStyle = 'rgba(4,6,24,0.6)'; ctx.fillRect(0, 0, W, H);
}

function drawTitle() {
  drawOverlayPanel();
  const bounce = Math.sin(time * 2) * 4;
  ctx.drawImage(glow(50, 'rgba(120,150,255,0.35)'), W / 2 - 50, 70 + bounce - 20);
  const img = SPR.glide;
  ctx.drawImage(img, W / 2 - img.width * 1.5, 60 + bounce, img.width * 3, img.height * 3);
  text('ももんがの夜の森', W / 2, 150, 34, '#dfe6ff', 'center');
  text('Enter / Space / タップ でスタート', W / 2, 190, 14, '#ffe58a', 'center');
  text('← → 移動    ↑ ジャンプ    Z 滑空(空中で押し続ける)    P ポーズ', W / 2, 220, 11, '#b9c4f0', 'center');
  text('コインを集めて、どこまで飛べるかな？  ベスト: ' + best, W / 2, 242, 11, '#b9c4f0', 'center');
  text('B / 下端タップ: リズム戦闘モード', W / 2, 262, 10, '#ff8fa0', 'center');
}
function drawOver() {
  drawOverlayPanel();
  text('ゲームオーバー', W / 2, 100, 30, '#ff8fa0', 'center');
  text(`きょり ${dist()}m   コイン ${coinCount}`, W / 2, 138, 16, '#fff', 'center');
  text(`スコア ${totalScore()}    ベスト ${best}`, W / 2, 164, 16, '#ffe58a', 'center');
  text('Enter / タップ でもう一度', W / 2, 208, 14, '#b9c4f0', 'center');
}

// ---------- メインループ ----------
function render() {
  if (state === 'battle') { Battle.render(); return; }
  const cx = cam ? cam.x : time * 30;
  ctx.save();
  if (state !== 'title' && shake > 0) ctx.translate(Math.round(rand(-2, 2)), Math.round(rand(-2, 2)));
  drawBackground(cx);
  drawWater();
  if (state !== 'title') {
    plats.forEach(drawPlatform);
    // 湖に沈む柱の見た目
    ctx.fillStyle = 'rgba(20,48,120,0.55)'; ctx.fillRect(0, WATER_Y, W, H - WATER_Y);
    coins.forEach(drawCoin); orbs.forEach(drawOrb); rocks.forEach(drawRock); bats.forEach(drawBat);
    if (state !== 'over') drawPlayer();
    drawParticles();
    drawHUD();
  } else {
    drawParticles();
  }
  ctx.restore();
  if (state === 'title') drawTitle();
  if (state === 'over') drawOver();
  if (state === 'pause') { drawOverlayPanel(); text('ポーズ中  (P で再開)', W / 2, H / 2, 20, '#fff', 'center'); }
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (state === 'battle') Battle.update(dt);
  else if (state === 'play') update(dt);
  else { time += dt; if (state === 'over') for (const q of parts) { q.life -= dt; } }
  render();
  requestAnimationFrame(frame);
}
// タイトル背景用の初期状態
cam = { x: 0 }; plats = []; coins = []; orbs = []; rocks = []; bats = []; parts = []; score = 0; maxX = 0; time = 0;
player = { hp: 3, shield: 0 };
if (document.fonts && document.fonts.load) document.fonts.load(`16px 'DotGothic16'`).catch(() => {});
requestAnimationFrame(frame);

// テスト用フック
window.__game = { get state() { return state; }, startGame, get player() { return player; }, dist };
