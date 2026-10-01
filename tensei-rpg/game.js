'use strict';
// 転生林檎 ―めぐる果樹園― : ドット絵RPG (HTML5 Canvas / 依存なし)
// 「転生林檎」(ピノキオピー) の雰囲気にインスパイアされたオリジナルストーリー。歌詞は使用していません。

const W = 320, H = 240, T = 16;
const cv = document.getElementById('g');
const ctx = cv.getContext('2d');
ctx.imageSmoothingEnabled = false;
const FONT = "'DotGothic16','Hiragino Kaku Gothic ProN','Meiryo',monospace";
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = n => { n = Math.sin(n * 127.1 + 311.7) * 43758.5453; return n - Math.floor(n); };
const SAVE_KEY = 'tenseiRpgSave', TRUE_KEY = 'tenseiRpgTrue';

// ================= 入力 =================
const down = {}, hit = {};
const KMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
  KeyZ: 'ok', Enter: 'ok', Space: 'ok', KeyX: 'cancel', ShiftLeft: 'cancel', ShiftRight: 'cancel', Escape: 'cancel', KeyC: 'menu', ControlLeft: 'menu' };
function press(a) { audioInit(); if (!down[a]) hit[a] = 1; down[a] = 1; }
function release(a) { down[a] = 0; }
addEventListener('keydown', e => { const a = KMAP[e.code]; if (a) { e.preventDefault(); if (!e.repeat) press(a); } });
addEventListener('keyup', e => { const a = KMAP[e.code]; if (a) release(a); });
document.querySelectorAll('.pad button').forEach(b => {
  const a = b.dataset.a;
  b.addEventListener('pointerdown', e => { e.preventDefault(); press(a); b.classList.add('on'); });
  const up = () => { release(a); b.classList.remove('on'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('pointerleave', up);
});

// ================= 音 =================
let AC = null, master = null, bgm = null, bgmTimer = null, bgmStep = 0;
function audioInit() {
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.gain.value = .6; master.connect(AC.destination); } catch (e) { return; }
    if (bgm) { const n = bgm; bgm = null; setBgm(n); }
  }
  if (AC.state === 'suspended') AC.resume();
}
function tone(f, d, type = 'square', v = .05, delay = 0) {
  if (!AC) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = f;
  g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.0005, t + d);
  o.connect(g); g.connect(master); o.start(t); o.stop(t + d + .02);
}
const mt = n => 440 * Math.pow(2, (n - 69) / 12);
const blip = () => tone(rand(260, 330), .04, 'square', .025);
function sfx(n) {
  if (n === 'sel') tone(700, .06, 'square', .04);
  else if (n === 'move') tone(520, .03, 'square', .02);
  else if (n === 'hit') { tone(160, .18, 'sawtooth', .1); tone(80, .25, 'square', .08); }
  else if (n === 'atk') { tone(900, .08, 'sawtooth', .08); tone(500, .15, 'sawtooth', .08, .05); }
  else if (n === 'heal') [0, 4, 7, 12].forEach((s, i) => tone(mt(72 + s), .12, 'triangle', .06, i * .07));
  else if (n === 'enc') [0, 1, 0, 1].forEach((s, i) => tone(300 + s * 300, .06, 'square', .06, i * .09));
  else if (n === 'break') { tone(200, .5, 'sawtooth', .1); tone(100, .7, 'square', .1, .1); }
  else if (n === 'rebirth') [0, 4, 7, 11, 14, 19].forEach((s, i) => tone(mt(67 + s), .3, 'sine', .07, i * .12));
}
const TRACKS = {
  title: { root: 60, dur: .34, wave: 'sine', lead: [0, 7, 12, 7, 4, 7, 9, 7, 5, 9, 12, 9, 7, 4, 2, null], bass: [0, 0, 0, 0, -3, -3, -3, -3, 5, 5, 5, 5, -5, -5, -5, -5] },
  hill: { root: 60, dur: .2, wave: 'square', lead: [0, 4, 7, 4, 9, 7, 4, 2, 0, 4, 7, 12, 11, 9, 7, 4], bass: [0, 0, 0, 0, 5, 5, 5, 5, 7, 7, 7, 7, 5, 5, 7, 7] },
  road: { root: 57, dur: .24, wave: 'square', lead: [0, 3, 7, 3, 10, 7, 3, 0, 0, 3, 7, 12, 10, 8, 7, 3], bass: [0, 0, 0, 0, -2, -2, -2, -2, -4, -4, -4, -4, -2, -2, 0, 0] },
  station: { root: 62, dur: .22, wave: 'triangle', lead: [0, null, 3, 5, 7, null, 5, 3, 0, null, 7, 10, 9, 7, 5, 3], bass: [0, 0, 0, 0, 3, 3, 3, 3, 5, 5, 5, 5, 3, 3, 0, 0] },
  tower: { root: 55, dur: .2, wave: 'square', lead: [0, 1, null, 0, 6, null, 5, null, 0, 1, null, 7, 6, null, 3, null], bass: [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 6, 6, 5, 5] },
  tree: { root: 65, dur: .3, wave: 'sine', lead: [0, 7, 12, 7, 4, 7, 9, 7, 5, 9, 12, 9, 7, 4, 2, null], bass: [0, 0, 0, 0, -3, -3, -3, -3, -5, -5, -5, -5, -7, -7, -7, -7] },
  battle: { root: 52, dur: .13, wave: 'square', lead: [0, 0, 12, 0, 10, 0, 8, 0, 7, 7, 5, 7, 3, 5, 7, 0], bass: [0, 0, 0, 0, -2, -2, -2, -2, -4, -4, -4, -4, -2, -2, 0, 0] },
  boss: { root: 50, dur: .11, wave: 'sawtooth', lead: [0, 3, 0, 6, 0, 3, 0, 7, 0, 3, 0, 6, 0, 10, 8, 7], bass: [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 6, 6, 5, 5] },
};
function setBgm(name) {
  if (bgm === name) return;
  bgm = name; clearInterval(bgmTimer); bgmStep = 0;
  if (!name || !AC) return;
  const tr = TRACKS[name];
  bgmTimer = setInterval(() => {
    const i = bgmStep++, l = tr.lead[i % tr.lead.length], b = tr.bass[i % tr.bass.length];
    if (l != null) tone(mt(tr.root + l + 12), tr.dur * 1.6, tr.wave, .035);
    if (i % 2 === 0) tone(mt(tr.root + b - 12), tr.dur * 3, 'triangle', .07);
  }, tr.dur * 1000);
}

// ================= ドット絵 =================
// 16x16 グリッド上の矩形リスト [色,x,y,w,h]
const SPR = {
  seed: [['#a8743a', 4, 3, 8, 11], ['#a8743a', 5, 2, 6, 1], ['#a8743a', 5, 14, 6, 1], ['#f2f2f2', 5, 10, 6, 4], ['#f2f2f2', 4, 11, 1, 2], ['#f2f2f2', 11, 11, 1, 2],
    ['#222', 6, 6, 1, 2], ['#222', 9, 6, 1, 2], ['#f2f2f2', 5, 5, 3, 1], ['#f2f2f2', 9, 5, 3, 1], ['#3a9a3a', 7, 0, 1, 3], ['#7cc87c', 8, 0, 3, 1], ['#7cc87c', 8, 1, 2, 1]],
  mushi: [['#7ed957', 1, 9, 4, 5], ['#7ed957', 5, 9, 4, 5], ['#6cc84a', 9, 6, 6, 8], ['#7ed957', 10, 5, 4, 1], ['#fff', 10, 8, 2, 2], ['#fff', 13, 8, 2, 2], ['#222', 11, 8, 1, 2], ['#222', 14, 8, 1, 2],
    ['#f66', 11, 12, 3, 1], ['#3a9a3a', 10, 2, 1, 3], ['#3a9a3a', 13, 2, 1, 3], ['#fff', 9, 14, 1, 1], ['#3a7a3a', 2, 14, 1, 1], ['#3a7a3a', 6, 14, 1, 1]],
  nashi: [['#c9d46a', 6, 3, 4, 4], ['#c9d46a', 5, 6, 6, 1], ['#c9d46a', 4, 7, 8, 7], ['#c9d46a', 5, 14, 6, 1], ['#8a6a2a', 5, 9, 1, 1], ['#8a6a2a', 10, 11, 1, 1], ['#8a6a2a', 7, 12, 1, 1],
    ['#5a3a24', 8, 0, 1, 3], ['#4a9a4a', 9, 1, 3, 1], ['#222', 6, 4, 1, 2], ['#222', 9, 4, 1, 2], ['#222', 7, 7, 2, 1], ['#8cf', 6, 6, 1, 2]],
  momo: [['#ffb0b8', 4, 4, 8, 9], ['#ffb0b8', 5, 3, 6, 1], ['#ffb0b8', 5, 13, 6, 1], ['#4a9a4a', 7, 1, 4, 2], ['#4a9a4a', 7, 2, 1, 2], ['#f2f2f2', 5, 9, 6, 4], ['#222', 6, 6, 1, 2], ['#222', 9, 6, 1, 2],
    ['#d04060', 7, 8, 2, 1], ['#ff7090', 5, 8, 1, 1], ['#ff7090', 10, 8, 1, 1]],
  cherry: [['#d02040', 2, 9, 5, 5], ['#d02040', 3, 8, 3, 1], ['#d02040', 9, 10, 5, 5], ['#d02040', 10, 9, 3, 1], ['#4a9a4a', 4, 2, 1, 7], ['#4a9a4a', 5, 2, 5, 1], ['#4a9a4a', 10, 2, 1, 8],
    ['#fff', 3, 10, 1, 1], ['#fff', 10, 11, 1, 1], ['#222', 4, 11, 1, 1], ['#222', 11, 12, 1, 1], ['#222', 5, 11, 1, 1], ['#222', 12, 12, 1, 1]],
  gardener: [['#d8b860', 1, 3, 14, 2], ['#d8b860', 4, 0, 8, 4], ['#f0d0b0', 5, 5, 6, 5], ['#222', 6, 7, 1, 1], ['#222', 9, 7, 1, 1], ['#e8e8e8', 5, 9, 6, 2], ['#3a6a3a', 3, 10, 10, 5], ['#c8a060', 5, 11, 6, 4],
    ['#f0d0b0', 2, 11, 1, 3], ['#f0d0b0', 13, 11, 1, 3], ['#5a3a24', 4, 15, 3, 1], ['#5a3a24', 9, 15, 3, 1]],
  sapling: [['#6a4a2a', 7, 8, 2, 7], ['#3aa04a', 3, 2, 10, 7], ['#3aa04a', 5, 1, 6, 1], ['#5ac060', 4, 3, 3, 2], ['#e8283c', 5, 6, 1, 1], ['#e8283c', 10, 4, 1, 1], ['#ffe27a', 7, 0, 2, 1], ['#ffe27a', 6, 4, 1, 1], ['#ffe27a', 9, 7, 1, 1]],
  sign: [['#6a4a2a', 7, 9, 2, 6], ['#b08a54', 2, 3, 12, 7], ['#8a6a3a', 2, 3, 12, 1], ['#8a6a3a', 2, 9, 12, 1], ['#3a2a1a', 4, 5, 8, 1], ['#3a2a1a', 4, 7, 6, 1]],
  uro: (c, x, y, s) => {  // 自分の尾をくわえた時計蛇 (16x16)
    for (let a = 0; a < 6.283; a += .12) {
      const px = 8 + Math.cos(a) * 6, py = 8 + Math.sin(a) * 6;
      c.fillStyle = (Math.floor(a * 4) % 2) ? '#5a6a9a' : '#6a7aaa';
      c.fillRect(Math.round(x + (px - 1.5) * s), Math.round(y + (py - 1.5) * s), Math.ceil(3 * s), Math.ceil(3 * s));
    }
    const R = (col, rx, ry, rw, rh) => { c.fillStyle = col; c.fillRect(Math.round(x + rx * s), Math.round(y + ry * s), Math.ceil(rw * s), Math.ceil(rh * s)); };
    R('#7a8aba', 11, 5, 5, 5); R('#ffd860', 12, 6, 2, 2); R('#222', 12, 7, 1, 1); R('#d04060', 15, 8, 1, 2);
    R('#ffd860', 7, 7, 2, 2); R('#fff', 8, 4, 1, 3); R('#fff', 8, 8, 3, 1);   // 中央の時計の針
  },
};
function spr(name, x, y, s = 1, flip = false) {
  const d = SPR[name];
  if (typeof d === 'function') return d(ctx, x, y, s);
  for (const [c, rx, ry, rw, rh] of d) {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x + (flip ? 16 - rx - rw : rx) * s), Math.round(y + ry * s), rw * s, rh * s);
  }
}
function disc(cx, cy, r, col) { ctx.fillStyle = col; for (let dy = -r; dy <= r; dy++) { const w = Math.floor(Math.sqrt(r * r - dy * dy)); ctx.fillRect(Math.round(cx - w), Math.round(cy + dy), w * 2 + 1, 1); } }

// 主人公「リン」: 転生するたびに姿(色)が変わる
const FORMS = [
  { n: '赤い林檎', c: ['#e8283c', '#a81830', '#ff8a98'] },
  { n: '青い林檎', c: ['#6cc85a', '#3f9a3a', '#b8f0a0'] },
  { n: '金の林檎', c: ['#ffc83a', '#d89a10', '#fff0a0'] },
  { n: '黒い林檎', c: ['#4a3a5a', '#2a1e38', '#8a7aa0'] },
  { n: '白い林檎', c: ['#f4eef2', '#cfc4d0', '#ffffff'] },
];
const BODY = ['......s.ll...', '.....ss.lll..', '..rrrrrrrrr..', '.rrrrrrrrrrr.', 'rrhhrrrrrrrRR', 'rrhrrrrrrrrRR', 'rrrrrrrrrrrRR', 'rrrrrrrrrrRRR', 'rrrrrrrrrrRRR', '.rrrrrrrrRRR.', '.rrrrrrrRRR..', '..rrrrrrRR...'];
function drawApple(fx, fy, dir, frame, form, alpha = 1) {
  const col = FORMS[form % FORMS.length].c, x0 = fx - 6.5 | 0, y0 = fy - 14;
  ctx.globalAlpha = alpha;
  BODY.forEach((row, j) => [...row].forEach((ch, i) => {
    const m = { r: col[0], R: col[1], h: col[2], s: '#5a3a24', l: '#4fbf5a' }[ch];
    if (m) { ctx.fillStyle = m; ctx.fillRect(x0 + i, y0 + j, 1, 1); }
  }));
  ctx.fillStyle = '#3a2418';
  const fo = frame ? 1 : 0;
  ctx.fillRect(x0 + 3, y0 + 12 + (fo ? 0 : 1), 3, 2 - (fo ? 0 : 1)); ctx.fillRect(x0 + 7, y0 + 12 + (fo ? 1 : 0), 3, 2 - (fo ? 1 : 0));
  const eye = form === 3 ? '#fff' : '#2a1020';
  ctx.fillStyle = eye;
  if (dir === 'down') { ctx.fillRect(x0 + 3, y0 + 6, 1, 2); ctx.fillRect(x0 + 8, y0 + 6, 1, 2); ctx.fillStyle = '#ff8a98'; ctx.fillRect(x0 + 2, y0 + 8, 2, 1); ctx.fillRect(x0 + 9, y0 + 8, 2, 1); }
  else if (dir === 'left') { ctx.fillRect(x0 + 1, y0 + 6, 1, 2); ctx.fillRect(x0 + 4, y0 + 6, 1, 2); }
  else if (dir === 'right') { ctx.fillRect(x0 + 7, y0 + 6, 1, 2); ctx.fillRect(x0 + 10, y0 + 6, 1, 2); }
  ctx.globalAlpha = 1;
}

// ================= ゲーム状態 =================
const G = {};
function newGame() {
  Object.assign(G, { room: 'hill', px: 56, py: 128, dir: 'right', hp: 24, maxhp: 24, gold: 0, juice: 1, kills: 0, deaths: 0, form: 0, flags: {}, cp: { room: 'hill', x: 56, y: 128, dir: 'right' }, safe: 0 });
}
const hasSave = () => { try { return !!localStorage[SAVE_KEY]; } catch (e) { return false; } };
function saveGame() { try { localStorage[SAVE_KEY] = JSON.stringify(G); } catch (e) {} }
function loadGame() { try { Object.assign(G, JSON.parse(localStorage[SAVE_KEY])); return true; } catch (e) { return false; } }
newGame();
let M = 'title', time = 0, wt = 0, tsel = 0, WM = { open: false };
const fade = { a: 0, d: 0, cb: null };
function fadeTo(cb) { fade.d = 1; fade.cb = cb; }

// ================= テキストエンジン =================
let D = null;
function say(lines, cb, opts, narr) { D = { lines: [].concat(lines), i: 0, n: 0, cb, opts, sel: 0, narr: !!narr }; }
function narr(lines, cb) { M = 'narr'; say(lines, cb, null, true); }
function updText(dt) {
  const L = D.lines[D.i];
  if (D.n < L.length) {
    const old = Math.floor(D.n);
    D.n = Math.min(L.length, D.n + dt * 38);
    if (hit.ok || hit.cancel) D.n = L.length;
    if (Math.floor(D.n) !== old && !/\s/.test(L[Math.floor(D.n) - 1] || '')) blip();
    return;
  }
  const last = D.i === D.lines.length - 1;
  if (last && D.opts) {
    if (hit.left || hit.up) { D.sel = (D.sel + D.opts.length - 1) % D.opts.length; sfx('move'); }
    if (hit.right || hit.down) { D.sel = (D.sel + 1) % D.opts.length; sfx('move'); }
    if (hit.ok) { const s = D.sel, cb = D.cb; D = null; sfx('sel'); cb && cb(s); }
    return;
  }
  if (hit.ok) {
    if (last) { const cb = D.cb; D = null; cb && cb(); } else { D.i++; D.n = 0; }
  }
}
function wrapText(s, maxW) {
  ctx.font = `13px ${FONT}`;
  const rows = [];
  for (const para of s.split('\n')) {
    let r = '';
    for (const ch of para) { if (ctx.measureText(r + ch).width > maxW) { rows.push(r); r = ch; } else r += ch; }
    rows.push(r);
  }
  return rows;
}
function typed(s, x, y, maxW, lh, n, col = '#fff', align = 'left') {
  const rows = wrapText(s, maxW); let c = 0;
  ctx.fillStyle = col; ctx.textBaseline = 'top'; ctx.textAlign = align; ctx.font = `13px ${FONT}`;
  rows.forEach((r, i) => { const take = Math.max(0, Math.min(r.length, n - c)); ctx.fillText(r.slice(0, take), x, y + i * lh); c += r.length; });
}
function box(x, y, w, h) { ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 3, w + 6, h + 6); ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h); }
function heart(x, y, col = '#e8283c') {
  ctx.fillStyle = col;
  ctx.fillRect(x, y + 1, 2, 2); ctx.fillRect(x + 4, y + 1, 2, 2); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x + 4, y, 1, 1);
  ctx.fillRect(x + 1, y + 1, 4, 3); ctx.fillRect(x + 2, y + 4, 2, 1); ctx.fillRect(x, y + 1, 6, 2);
}
function drawText() {
  if (!D) return;
  const L = D.lines[D.i], n = Math.floor(D.n);
  if (D.narr) {
    typed(L, W / 2, 96, 260, 20, n, '#fff', 'center');
    if (D.n >= L.length && !D.opts) { ctx.fillStyle = '#888'; ctx.font = `10px ${FONT}`; ctx.textAlign = 'center'; ctx.fillText('▼', W / 2, 200); }
  } else {
    const bx = M === 'battle' ? { x: 16, y: 112, w: 288, h: 64 } : { x: 14, y: 150, w: 292, h: 76 };
    box(bx.x, bx.y, bx.w, bx.h);
    typed('＊ ' + L, bx.x + 10, bx.y + 8, bx.w - 20, 16, n + 2);
    if (D.n >= L.length && !D.opts && Math.sin(time * 8) > 0) { ctx.fillStyle = '#fff'; ctx.fillRect(bx.x + bx.w - 14, bx.y + bx.h - 12, 6, 4); }
  }
  if (D.opts && D.n >= L.length) {
    const bx = D.narr ? { x: 0, y: 130 } : (M === 'battle' ? { x: 16, y: 112 + 64 - 22 } : { x: 14, y: 150 + 76 - 22 });
    D.opts.forEach((o, i) => {
      const ox = D.narr ? W / 2 - 100 + i * 120 : bx.x + 24 + i * 134;
      if (i === D.sel) heart(ox - 12, bx.y + 3);
      typed(o, ox, bx.y, 120, 14, 99, i === D.sel ? '#ffe040' : '#fff');
    });
  }
}

// ================= マップ =================
// obs: [tx,ty,tw,th,kind]
const ROOMS = {
  hill: { n: '芽吹きの丘', bgm: 'hill', seed: 1, g: ['#3f8f4c', '#3a8747'], dc: ['#ffd0e0', '#fff', '#ffe27a'], path: [[0, 7, 20, 2]], pc: '#c4a46c', tc: ['#1f5a2f', '#2c7a3c', '#4a9a58'],
    obs: [[0, 0, 20, 2], [0, 14, 20, 1], [0, 2, 1, 12], [19, 2, 1, 5], [19, 9, 1, 5], [3, 9, 4, 3, 'water'], [11, 2, 3, 4], [11, 10, 3, 4], [3, 3, 2, 2], [15, 11, 2, 2]],
    exits: [{ side: 'right', y0: 104, y1: 150, to: 'road', x: 24, y: 128, dir: 'right' }],
    npcs: [{ id: 'seed', tx: 7, ty: 5, spr: 'seed' }, { id: 'sapling', tx: 16, ty: 4, spr: 'sapling' }],
    foes: [{ id: 'mushi', tx: 12, ty: 7, spr: 'mushi', e: 'mushi' }] },
  road: { n: 'かすれ道', bgm: 'road', seed: 2, g: ['#8a6b3b', '#84673a'], dc: ['#c0602a', '#e0a040', '#a04020'], path: [[0, 7, 20, 2]], pc: '#b08a54', tc: ['#5a2a10', '#a85a20', '#d88a30'],
    obs: [[0, 0, 20, 3], [0, 12, 20, 3], [0, 3, 1, 3], [0, 9, 1, 3], [19, 3, 1, 3], [19, 9, 1, 3], [6, 3, 2, 3, 'rock'], [6, 9, 2, 3, 'rock'], [13, 3, 2, 3, 'rock'], [13, 9, 2, 3, 'rock']],
    exits: [{ side: 'left', y0: 96, y1: 150, to: 'hill', x: 288, y: 128, dir: 'left' }, { side: 'right', y0: 96, y1: 150, to: 'station', x: 24, y: 128, dir: 'right' }],
    npcs: [{ id: 'sign1', tx: 3, ty: 6, spr: 'sign' }, { id: 'sign2', tx: 16, ty: 6, spr: 'sign' }],
    foes: [{ id: 'nashi', tx: 10, ty: 7, spr: 'nashi', e: 'nashi' }] },
  station: { n: '輪廻駅', bgm: 'station', seed: 3, g: ['#33405f', '#36446a'], dc: ['#fff', '#aac', '#ffe27a'], path: [[0, 6, 20, 5]], pc: '#4a5a80', tc: ['#222', '#444', '#666'],
    obs: [[0, 0, 9, 3, 'wall'], [11, 0, 9, 3, 'wall'], [0, 11, 20, 4, 'rail'], [0, 3, 1, 3], [0, 9, 1, 2], [19, 3, 1, 8], [12, 6, 3, 1, 'stall']],
    exits: [{ side: 'left', y0: 96, y1: 150, to: 'road', x: 288, y: 128, dir: 'left' }, { side: 'up', x0: 140, x1: 180, to: 'tower', x: 160, y: 216, dir: 'up' }],
    npcs: [{ id: 'momo', tx: 13, ty: 5, spr: 'momo' }, { id: 'cherry', tx: 5, ty: 8, spr: 'cherry' }], foes: [] },
  tower: { n: '時計塔', bgm: 'tower', seed: 4, g: ['#2c2c40', '#303046'], dc: ['#6a6a9a', '#ffd860'], path: [], pc: '#000', tc: ['#222', '#444', '#666'],
    obs: [[0, 0, 9, 2, 'wall'], [11, 0, 9, 2, 'wall'], [0, 2, 1, 12, 'wall'], [19, 2, 1, 12, 'wall'], [0, 14, 9, 1, 'wall'], [11, 14, 9, 1, 'wall'], [9, 0, 2, 2, 'gate']],
    exits: [{ side: 'down', x0: 140, x1: 180, to: 'station', x: 160, y: 62, dir: 'down' }, { side: 'up', x0: 140, x1: 180, to: 'tree', x: 160, y: 216, dir: 'up', need: 'd_uro' }],
    npcs: [], foes: [{ id: 'uro', tx: 10, ty: 5, spr: 'uro', e: 'uro', big: 2 }] },
  tree: { n: 'はじまりの樹', bgm: 'tree', seed: 5, g: ['#2b5a47', '#2f6050'], dc: ['#ffd0e0', '#fff', '#ffe27a'], path: [[9, 5, 2, 9]], pc: '#3a6a58', tc: ['#0a2a1a', '#1a4a2a', '#2a6a3a'],
    obs: [[0, 0, 20, 2], [0, 2, 1, 13], [19, 2, 1, 13], [0, 14, 20, 1], [9, 4, 2, 2, 'trunk']],
    exits: [], npcs: [{ id: 'gardener', tx: 10, ty: 7, spr: 'gardener' }], foes: [] },
};
const room = () => ROOMS[G.room];
const alive = f => !G.flags['d_' + f.id];
function obsRects() {
  const r = room();
  return r.obs.filter(o => !(o[4] === 'gate' && G.flags.d_uro)).map(o => [o[0] * T, o[1] * T, o[2] * T, o[3] * T]).concat(r.npcs.map(n => [n.tx * T + 2, n.ty * T + 8, 12, 8]));
}
function blocked(x, y) {
  const bx = x - 5, by = y - 5, bw = 10, bh = 5;
  return obsRects().some(([rx, ry, rw, rh]) => bx < rx + rw && bx + bw > rx && by < ry + rh && by + bh > ry);
}

// ================= ワールド更新 =================
function enterRoom(id, x, y, dir) {
  fadeTo(() => {
    G.room = id; G.px = x; G.py = y; G.dir = dir; G.cp = { room: id, x, y, dir };
    setBgm(ROOMS[id].bgm); G.safe = .6;
    if (id === 'tree' && !G.flags.met4) { G.flags.met4 = 1; M = 'cut'; setTimeout(cut4, 600); }
  });
}
function updateWorld(dt) {
  if (fade.d) return;
  if (WM.open) { updMenu(); return; }
  if (hit.menu) { WM = { open: true }; sfx('sel'); return; }
  let dx = (down.right ? 1 : 0) - (down.left ? 1 : 0), dy = (down.down ? 1 : 0) - (down.up ? 1 : 0);
  if (dx && dy) { dx *= .72; dy *= .72; }
  if (dx || dy) {
    G.dir = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    const sp = 72 * dt;
    if (!blocked(G.px + dx * sp, G.py)) G.px += dx * sp;
    if (!blocked(G.px, G.py + dy * sp)) G.py += dy * sp;
    G.px = clamp(G.px, 0, W); G.py = clamp(G.py, 0, H);
    wt += dt;
  }
  G.safe = Math.max(0, G.safe - dt);
  // 調べる
  if (hit.ok) {
    const fx = G.px + (G.dir === 'right' ? 12 : G.dir === 'left' ? -12 : 0), fy = G.py - 6 + (G.dir === 'down' ? 12 : G.dir === 'up' ? -12 : 0);
    let best = null, bd = 22;
    for (const n of room().npcs) { const d = Math.hypot(n.tx * T + 8 - fx, n.ty * T + 8 - fy); if (d < bd) { bd = d; best = n; } }
    if (best) { sfx('sel'); TALK[best.id](); return; }
  }
  // 敵との遭遇
  if (G.safe <= 0) for (const f of room().foes) {
    if (!alive(f)) continue;
    const fxp = f.tx * T + 8, fyp = f.ty * T + 16;
    if (Math.hypot(fxp - G.px, fyp - 6 - (G.py - 6)) < (f.big ? 34 : 18)) { startBattle(f.e, f); return; }
  }
  // 出口
  for (const e of room().exits) {
    if (e.need && !G.flags[e.need]) continue;
    const inx = e.side === 'right' ? G.px >= W - 3 && G.py >= e.y0 && G.py <= e.y1 : e.side === 'left' ? G.px <= 3 && G.py >= e.y0 && G.py <= e.y1
      : e.side === 'up' ? G.py <= 20 && G.px >= e.x0 && G.px <= e.x1 : G.py >= H - 3 && G.px >= e.x0 && G.px <= e.x1;
    if (inx) { enterRoom(e.to, e.x, e.y, e.dir); return; }
  }
}
function updMenu() {
  if (hit.cancel || hit.menu) { WM.open = false; return; }
  if (hit.ok && G.juice > 0 && G.hp < G.maxhp) { G.juice--; G.hp = Math.min(G.maxhp, G.hp + 12); sfx('heal'); }
}

// ================= 会話・イベント =================
function saveTalk() {
  G.hp = G.maxhp; sfx('heal'); saveGame();
  say(['あたたかい光が　リンを　つつんだ。\nHPが　かいふくした。', '（はじまりの苗に　きおくを　きざんだ）']);
}
const TALK = {
  seed() {
    if (!G.flags.seedTalk) {
      G.flags.seedTalk = 1;
      say(['…おお、目が　さめたか。', 'ここは　『めぐる果樹園』。\n落ちた実は　土に還り、また　実をむすぶ。\nそういう場所じゃ。',
        'じゃが　おまえさん　（リン）だけは　ちがう。\n落ちるたびに　姿を　かえて　またここへ　もどってくる。', '東へ　ゆきなされ。\n『はじまりの樹』に　園丁がおる。\nおまえさんの　ことを　知っとるはずじゃ。',
        'それとな…ここの連中は　こわがりなだけじゃ。\n『たたかう』だけが　こたえとは　かぎらんぞ。', '（Cキーでメニュー。戦闘では　こうどう　で\n　なかよくなれる。　Xキー長押しで　ゆっくり動ける）']);
    } else say('気をつけて　ゆくんじゃぞ、リン。\n……なぜか　おまえさんを　見ていると\nなつかしい気持ちに　なるのう。');
  },
  sapling: saveTalk,
  sign1() { say('「←　芽吹きの丘\n　→　輪廻駅」'); },
  sign2() { say('「この先　輪廻駅。\n　時計塔の主は　時間に　きびしい。\n　遅刻は　ゆるされない」'); },
  momo() {
    const intro = G.flags.momoTalk ? [] : ['いらっしゃい！　ここは　輪廻駅の　売店さ。', '転生ってのはさ、終点じゃなくて\n乗りかえ駅みたいなもんだよ。'];
    G.flags.momoTalk = 1;
    say(intro.concat('りんごジュース　12G。\nのむと　HPが　12　かいふくするよ。　どうする？'), i => {
      if (i === 1) return say('またおいで！');
      if (G.gold >= 12) { G.gold -= 12; G.juice++; sfx('heal'); say('まいどあり！'); } else say('おっと…　Gが　たりないねえ。\n（ともだちに　なると　もらえるよ）');
    }, ['かう', 'やめる']);
  },
  cherry() {
    say(['きゃっ！　…あ、林檎さん。', '塔の環蛇は　時間を　かじって　生きてるの。', 'こわい顔　してるけど…\nあの人（ウロって　いうの）\nほんとは　すごく　さびしがりやなんだよ。',
      '名前を　よんであげると　きっと　喜ぶよ。']);
  },
  gardener() { say('…おまえの　ことは　ずっと　見ているよ。'); },
};

function cut4() {
  M = 'cut';
  say(['…よく　きたね、リン。', 'ずっと　待っていたよ。　おまえが　ここへ　戻ってくるのを。'], () => G.kills > 0 ? neutralRoute() : trueRoute());
}
function neutralRoute() {
  say(['…その手は　だれかの　命を　おとしてきたんだね。', 'すまない。　まだ　おまえを　送りだせない。', 'すこし　ねむりなさい。\n目がさめたら　また　あの丘だ。'], () => {
    narr(['園丁は　やさしく　ほほえんだ。', 'リンの　きおくは　ふたたび　しずかに　とけていく…', 'NEUTRAL END　『終わらない輪廻』', '（だれも　きずつけずに　すすんだら…？）'], () => { newGame(); toTitle(); });
  });
}
function trueRoute() {
  const d = G.deaths;
  say([d ? `おまえは　${d}回　たおれ　そのたびに　ここへ　もどってきた。\n…ぜんぶ　おぼえて　いるよ。` : '今回は　いちども　たおれずに　ここまで　きたんだね。\nやさしい　子だ。',
    'おまえはね　わたしが　さいしょに　そだてた\nたったひとつの　実なんだ。',
    '実は落ちて　土に還れば　種になって　あたらしい木に　なる。\n…それが　こわかった。\nおまえが　べつの　だれかに　なって　しまうのが。',
    'だから　時計蛇に　命じた。\n「リンが　落ちるたび　記憶を　食べて\n　この果樹園に　よびもどせ」と。',
    'おまえは　とめどなく　転生した。\nわたしの　ために。　わたしの　わがままの　ために。',
    '…さあ　こたえを　聞かせて、リン。'], () => {
    say('どうする？', i => {
      if (i === 0) leaveEnd(); else stayEnd();
    }, ['種になる（旅立つ）', 'ここに　のこる']);
  });
}
function stayEnd() {
  say(['リン「…うん。　ここに　いるよ。」', '園丁「…ありがとう、リン。」'], () => {
    narr(['こうして　ふたりは　変わらない　毎日を　くりかえした。', 'あたたかくて　しずかで　でも　どこにも　つづかない　ところ。', 'STAY END　『とまった時計』', '（もういちど　はなしを　きいてあげたら　どうなる…？）'], () => { newGame(); toTitle(); });
  });
}
function leaveEnd() {
  say(['リン「だいじょうぶ。\n　わたしは　わたしの　ままで　つづいていくから。」', '園丁「…ああ。\n　そうか。　そう　だったね。」', '園丁「ありがとう、リン。\n　いってらっしゃい。」'], () => {
    M = 'end'; E = { t: 0 }; setBgm('title'); sfx('rebirth');
    try { localStorage[TRUE_KEY] = 1; } catch (e) {}
  });
}
let E = { t: 0 };
const ENDTXT = [[0, 'リンは　ぽとりと　やさしく　土に　落ちた。'], [4, 'ながい　ながい　ねむりの　あと　ちいさな　芽が　ひらいた。'],
  [8, 'ムシ丸は　ちょうちょになって　その芽に　ひらひらと　とまり'], [11, 'ナシ子は　だれかの　しあわせな　おやつに　なり'], [14, 'ウロは　とまっていた　時計を　やっと　うごかした。'],
  [17, '園丁は　あたらしい木の　そばで　わらっていた。'], [21, '「転生は　おわりじゃない。\n　つづき　なんだ。」'], [26, 'TRUE END　『転生林檎』']];

// ================= 敵データ =================
const ENEMIES = {
  mushi: { name: 'ムシ丸', spr: 'mushi', maxhp: 24, gold: 10, need: 2, dmg: 3, dur: 5, pat: 'rain', scale: 5,
    intro: 'ムシ丸が　あらわれた！',
    check: 'ムシ丸　ATK 3　DEF 0\nさなぎに　なれない　イモムシ。\nほんとうは　ちょうちょに　なりたい。',
    acts: [['はげます', '「きっと　ちょうちょに　なれるよ」\nムシ丸は　ほほを　あかくした。'], ['いっしょに　うたう', '♪〜\nムシ丸は　ごきげんに　からだを　ゆらした！'], ['さなぎを　ほめる', '「かっこいい　さなぎに　なるよ」\nムシ丸は　もじもじしている。']],
    talk: ['「ぼく　ちょうちょに　なりたいんだ」', '「でも　さなぎに　なれないんだ…」', '「ぼくなんかが　とべるのかな」', '「…きみは　やさしいね」'],
    flavor: ['ムシ丸は　もぞもぞ　している。', 'ムシ丸は　空を　見あげている。', 'あまい　におい。　ムシ丸の　おなかが　なった。'],
    spare: 'ムシ丸は　まるまって　ねむった。\nいつか　羽ばたく日まで。', kill: 'ムシ丸は　ちりに　なった…。\n風が　ちいさく　ふるえた。' },
  nashi: { name: 'ナシ子', spr: 'nashi', maxhp: 30, gold: 15, need: 2, dmg: 3, dur: 5.5, pat: 'wave', scale: 5,
    intro: 'ナシ子が　くずれそうに　たたずんでいる。',
    check: 'ナシ子　ATK 4　DEF 0\n熟れすぎて　だれにも　たべてもらえなかった　梨。',
    acts: [['なぐさめる', '「だいじょうぶ」\nナシ子は　目を　ぱちくりさせた。'], ['「あまい」と　ほめる', '「とっても　あまい　にほい」\nナシ子の　ほほが　ほんのり　あかい。'], ['となりに　すわる', 'リンは　だまって　となりに　すわった。\nナシ子は　すこし　よりかかった。']],
    talk: ['「どうせ　わたしなんて　くさっていくだけ…」', '「みんな　きれいな　実ばかり　えらぶの」', '「…あなたは　ちがうの？」', '「…すこし　あったかい」'],
    flavor: ['ナシ子の　足もとに　しずくが　おちる。', 'ナシ子は　うつむいている。', 'どこからか　おちばが　ひらひら　まってきた。'],
    spare: 'ナシ子は　なみだを　ふいた。\n「…ありがとう。\n　すこしだけ　あまく　なれた気が　する」', kill: 'ナシ子は　くずれて　土に　かえった…。\nあまい　におい　だけが　のこった。' },
  uro: { name: 'ウロ', spr: 'uro', maxhp: 56, gold: 30, need: 3, dmg: 4, dur: 6.5, pat: 'ring', scale: 6, boss: true,
    intro: '時計蛇　ウロが　とぐろを　まいて　まちぶせていた。',
    check: 'ウロ　ATK 5　DEF 2\n自分の尾を　くわえた　時計蛇。\n止まった時間の中で　ずっと　待ちつづけている。',
    acts: [['なまえを　よぶ', '「ウロ。」\nウロの　目が　ゆれた。\n「…その名で　よばれたのは　いつぶりか」'], ['とけいを　みせる', 'リンは　針の止まった　時計を　さしだした。\nウロは　そっと　目を　そらした。'], ['おもいだす', 'リンは　目を　とじた。\n赤、青、金、黒、白…\n何度も　ここを　通った　記憶が　よみがえる。']],
    talk: ['「おまえは　また　来たのか」', '「わたしは　何度も　おまえの　記憶を　食べた」', '「園丁の　命令だった。…いや、わたしも　のぞんだ」', '「おまえが　わすれれば　もういちど　会えるから」', '「…さびしかったのだ」'],
    flavor: ['ウロの　しっぽが　かちかちと　時を　きざむ。', '塔の　鐘が　どこかで　なっている。', '時計の針が　ぎゅるりと　さかまわりした。'],
    spare: 'ウロは　とぐろを　ほどいた。\n「…もう　食べない。\n　おまえの　記憶は　おまえの　ものだ」\n（道が　ひらいた）', kill: 'ウロは　時計のように　こなごなに　くだけた。\n時間が　ゆがむ　音が　した…。' },
};

// ================= 戦闘 =================
let B = null;
const BX = { x: 110, y: 112, w: 100, h: 64 };
function startBattle(key, foe) {
  const e = ENEMIES[key];
  B = { k: key, e, foe, hp: e.maxhp, ph: 'intro', t: 0, sel: 0, sub: 0, mercy: 0, used: {}, turn: 0, ft: 0, flav: '', bul: [], inv: 0, shake: 0, dmgShow: 0, showHp: 0, soul: { x: 160, y: 144 }, bar: 0, gone: 0, gk: '', a: 0, b: 0, n: 0, ang: 0, pieces: [] };
  M = 'battleIntro'; setBgm(null); sfx('enc');
}
function beginBattle() {
  M = 'battle'; setBgm(B.e.boss ? 'boss' : 'battle'); B.ph = 'wait';
  say(B.e.intro, () => toMenu(true));
}
function toMenu(first) { B.ph = 'menu'; B.ft = 0; B.flav = B.e.flavor[B.turn % B.e.flavor.length]; if (!first) B.sel = B.sel; }
const spareable = () => B.mercy >= B.e.need;
function enemyTurn() {
  B.ph = 'wait';
  const e = B.e;
  say(e.talk[Math.min(B.turn, e.talk.length - 1)], () => { B.ph = 'dodge'; B.t = 0; B.bul = []; B.soul = { x: BX.x + BX.w / 2, y: BX.y + BX.h / 2 }; B.a = .5; B.b = 1; B.n = 0; B.ang = rand(0, 6); });
  B.turn++;
}
function endBattle(kind) {
  const f = B.foe;
  if (kind === 'flee') {
    const ex = f.tx * T + 8, ey = f.ty * T + 16; let vx = G.px - ex, vy = G.py - ey; const l = Math.hypot(vx, vy) || 1;
    const nx = G.px + vx / l * 30, ny = G.py + vy / l * 30; if (!blocked(nx, ny)) { G.px = nx; G.py = ny; }
    G.safe = 2;
  } else {
    G.flags['d_' + f.id] = 1; G.gold += B.e.gold;
    if (kind === 'kill') G.kills++;
  }
  M = 'world'; B = null; setBgm(room().bgm);
}
function winBattle(kind) {
  B.ph = 'wait'; B.gk = kind; B.gone = .001;
  if (kind === 'kill') sfx('break'); else sfx('rebirth');
  say([kind === 'kill' ? B.e.kill : B.e.spare, kind === 'kill' ? `${B.e.gold}G　を　てにいれた。` : `ともだちに　なった！\n${B.e.gold}G　を　てにいれた。`], () => endBattle(kind));
}
function hurt(d) {
  G.hp -= d; B.inv = 1; B.shake = .25; sfx('hit');
  if (G.hp <= 0) { G.hp = 0; B.ph = 'dead'; B.t = 0; B.pieces = Array.from({ length: 8 }, () => ({ x: B.soul.x, y: B.soul.y, vx: rand(-60, 60), vy: rand(-90, -10) })); sfx('break'); setBgm(null); }
}
function respawn() {
  G.deaths++; G.form = (G.form + 1) % FORMS.length; G.hp = G.maxhp;
  const cp = G.cp; G.room = cp.room; G.px = cp.x; G.py = cp.y; G.dir = cp.dir; G.safe = 1.5;
  B = null; M = 'world'; setBgm(room().bgm); sfx('rebirth');
}
function actList() { return [['みる', B.e.check]].concat(B.e.acts); }
function updateBattle(dt) {
  B.t += dt; B.shake = Math.max(0, B.shake - dt); B.inv = Math.max(0, B.inv - dt);
  if (B.gone) { B.gone += dt; }
  const ph = B.ph;
  if (ph === 'menu') {
    B.ft += dt * 38;
    if (hit.left) { B.sel = (B.sel + 3) % 4; sfx('move'); }
    if (hit.right) { B.sel = (B.sel + 1) % 4; sfx('move'); }
    if (hit.ok) {
      sfx('sel');
      if (B.sel === 0) { B.ph = 'bar'; B.bar = 0; }
      else if (B.sel === 1) { B.ph = 'act'; B.sub = 0; }
      else if (B.sel === 2) { if (G.juice > 0) { B.ph = 'item'; B.sub = 0; } else { B.ph = 'wait'; say('もっている　アイテムが　ない。', () => toMenu()); } }
      else { B.ph = 'mercy'; B.sub = spareable() ? 0 : 0; }
    }
  } else if (ph === 'act') {
    const L = actList();
    if (hit.up) { B.sub = (B.sub + L.length - 1) % L.length; sfx('move'); }
    if (hit.down) { B.sub = (B.sub + 1) % L.length; sfx('move'); }
    if (hit.cancel) { B.ph = 'menu'; B.ft = 99; }
    if (hit.ok) {
      const s = B.sub; sfx('sel'); B.ph = 'wait';
      if (s > 0 && !B.used[s]) { B.used[s] = 1; B.mercy++; }
      say(L[s][1] + (s > 0 && B.mercy >= B.e.need && !B.said ? (B.said = 1, '\n（' + B.e.name + 'は　もう　たたかう　気が　ないようだ）') : ''), enemyTurn);
    }
  } else if (ph === 'item') {
    if (hit.cancel) { B.ph = 'menu'; B.ft = 99; }
    if (hit.ok) { G.juice--; G.hp = Math.min(G.maxhp, G.hp + 12); sfx('heal'); B.ph = 'wait'; say('りんごジュースを　のんだ。\nHPが　12　かいふくした！', enemyTurn); }
  } else if (ph === 'mercy') {
    const n = B.e.boss ? 1 : 2;
    if (hit.up || hit.down) { B.sub = (B.sub + 1) % n; sfx('move'); }
    if (hit.cancel) { B.ph = 'menu'; B.ft = 99; }
    if (hit.ok) {
      sfx('sel');
      if (B.sub === 0) { if (spareable()) winBattle('spare'); else { B.ph = 'wait'; say(`${B.e.name}は　まだ　あなたを　信じていない。\n（こうどう　で　なかよく　なろう）`, enemyTurn); } }
      else { B.ph = 'wait'; say('リンは　にげだした！', () => endBattle('flee')); }
    }
  } else if (ph === 'bar') {
    B.bar += dt * 1.15;
    if (hit.ok || B.bar >= 1.02) {
      const acc = B.bar >= 1.02 ? 0 : 1 - Math.abs(B.bar - .5) * 2;
      B.dmgShow = acc < .08 ? 0 : Math.round(4 + acc * 11);
      B.hp -= B.dmgShow; B.showHp = 1.4; B.shake = B.dmgShow ? .3 : 0; B.ph = 'dmg'; B.t = 0; sfx(B.dmgShow ? 'atk' : 'move');
      B.hpAnim = B.hp + B.dmgShow;
    }
  } else if (ph === 'dmg') {
    B.hpAnim = Math.max(B.hp, B.hpAnim - dt * 30);
    if (B.t > 1.1) { if (B.hp <= 0) winBattle('kill'); else enemyTurn(); }
  } else if (ph === 'dodge') updDodge(dt);
  else if (ph === 'dead') {
    for (const p of B.pieces) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; }
    if (B.t > 2) { M = 'narr'; B.ph = 'over'; say(['…ちからが　ぬけていく。', 'でも　これは　おわりじゃない。\n輪廻は　つづく。', 'リンは　あたらしい姿で　転生した。'], respawn, null, true); }
  }
  B.showHp = Math.max(0, B.showHp - dt);
}
const PAT = {
  rain(b, dt) {
    b.a -= dt; if (b.a <= 0) { b.bul.push({ x: BX.x + rand(6, BX.w - 6), y: BX.y - 4, vx: 0, vy: rand(45, 75), r: 3, c: '#8e8' }); b.a = .17; }
    b.b -= dt; if (b.b <= 0) { const y = rand(BX.y + 10, BX.y + BX.h - 10); for (let i = 0; i < 3; i++) b.bul.push({ x: BX.x - 4 - i * 9, y, vx: 80, vy: 0, r: 2.5, c: '#fff' }); b.b = 1.5; }
  },
  wave(b, dt) {
    b.a -= dt; if (b.a <= 0) { const s = b.n++ % 2; b.bul.push({ x: s ? BX.x + BX.w + 4 : BX.x - 4, y: BX.y + rand(8, BX.h - 8), vx: s ? -62 : 62, vy: 0, w: rand(0, 6), r: 4, c: '#d8e070', sine: 1 }); b.a = .3; }
    b.b -= dt; if (b.b <= 0) { for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .2; b.bul.push({ x: BX.x + BX.w / 2, y: BX.y + 4, vx: Math.cos(a) * 38, vy: Math.sin(a) * 38, r: 3, c: '#b8c060' }); } b.b = 2.3; }
  },
  ring(b, dt) {
    b.a -= dt; if (b.a <= 0) { b.ang += .65; const cx = BX.x + BX.w / 2, cy = BX.y + BX.h / 2; b.bul.push({ x: cx + Math.cos(b.ang) * 90, y: cy + Math.sin(b.ang) * 90, vx: -Math.cos(b.ang) * 46, vy: -Math.sin(b.ang) * 46, r: 3, c: '#ffd860' }); b.a = .11; }
    b.b -= dt; if (b.b <= 0) { const gap = Math.floor(rand(0, 5)); for (let k = 0; k < 7; k++) { if (k === gap || k === gap + 1) continue; b.bul.push({ x: BX.x - 4, y: BX.y + 5 + k * 9, vx: 56, vy: 0, r: 3, c: '#fff' }); } b.b = 1.8; }
  },
};
function updDodge(dt) {
  const s = B.soul, sp = (down.cancel ? 38 : 82) * dt;
  s.x = clamp(s.x + ((down.right ? 1 : 0) - (down.left ? 1 : 0)) * sp, BX.x + 5, BX.x + BX.w - 5);
  s.y = clamp(s.y + ((down.down ? 1 : 0) - (down.up ? 1 : 0)) * sp, BX.y + 5, BX.y + BX.h - 5);
  PAT[B.e.pat](B, dt);
  for (const b of B.bul) {
    b.x += b.vx * dt; b.y += b.vy * dt + (b.sine ? Math.sin(B.t * 4 + b.w) * 30 * dt : 0);
    if (B.inv <= 0 && Math.hypot(b.x - s.x, b.y - s.y) < b.r + 2.5) { hurt(B.e.dmg); if (B.ph === 'dead') return; }
  }
  B.bul = B.bul.filter(b => b.x > BX.x - 110 && b.x < BX.x + BX.w + 110 && b.y > BX.y - 110 && b.y < BX.y + BX.h + 110);
  if (B.t > B.e.dur) { B.ph = 'menu'; B.ft = 0; B.flav = B.e.flavor[B.turn % B.e.flavor.length]; B.bul = []; }
}

function drawBattle() {
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  const e = B.e, sc = e.scale, ox = B.shake > 0 ? rand(-3, 3) : 0;
  // 敵
  const ex = W / 2 - 8 * sc + ox, ey = 8 + Math.sin(B.t * 2) * 2;
  ctx.save();
  if (B.gone) {
    ctx.globalAlpha = Math.max(0, 1 - B.gone * .7);
    if (B.gk === 'spare') ctx.filter = 'grayscale(1)';
    if (B.gk === 'kill') for (let i = 0; i < 24; i++) { ctx.fillStyle = '#fff'; ctx.fillRect(W / 2 + rand(-40, 40), 70 + B.gone * 30 + rand(-30, 30), 2, 2); }
  }
  if (!(B.gone > 1.5)) spr(e.spr, ex, ey, sc);
  ctx.restore();
  if (B.showHp > 0) {
    const bw = 80, bx = W / 2 - 40, by = ey + 16 * sc + 2 > 106 ? 104 : ey + 16 * sc + 2;
    ctx.fillStyle = '#f00'; ctx.fillRect(bx, by, bw, 6); ctx.fillStyle = '#0f0'; ctx.fillRect(bx, by, bw * Math.max(0, (B.hpAnim ?? B.hp)) / e.maxhp, 6);
    if (B.ph === 'dmg') { ctx.fillStyle = B.dmgShow ? '#f33' : '#aaa'; ctx.font = `bold 18px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(B.dmgShow || 'MISS', W / 2, by - 24 - Math.min(10, B.t * 30)); }
  }
  // ボックス
  const dodge = B.ph === 'dodge' || B.ph === 'dead' || (B.ph === 'wait' && B.turn > 0 && D && M === 'battle' && false);
  if (B.ph === 'dodge' || B.ph === 'dead') {
    box(BX.x, BX.y, BX.w, BX.h);
    if (B.ph === 'dodge') {
      ctx.save(); ctx.beginPath(); ctx.rect(BX.x, BX.y, BX.w, BX.h); ctx.clip();
      for (const b of B.bul) disc(b.x, b.y, b.r, b.c);
      ctx.restore();
    }
  } else if (B.ph !== 'intro') {
    const bx = { x: 16, y: 112, w: 288, h: 64 };
    if (!D) box(bx.x, bx.y, bx.w, bx.h);
    if (!D) {
      if (B.ph === 'menu') typed('＊ ' + B.flav, bx.x + 10, bx.y + 8, bx.w - 20, 16, Math.floor(B.ft) + 2);
      else if (B.ph === 'act') actList().forEach((a, i) => { if (i === B.sub) heart(bx.x + 8, bx.y + 8 + i * 13 + 3); typed(a[0], bx.x + 24, bx.y + 6 + i * 13, 250, 12, 99, i === B.sub ? '#ffe040' : '#fff'); });
      else if (B.ph === 'item') { heart(bx.x + 8, bx.y + 11); typed(`りんごジュース　×${G.juice}`, bx.x + 24, bx.y + 8, 250, 12, 99, '#ffe040'); }
      else if (B.ph === 'mercy') {
        const ops = [['みのがす', spareable() ? '#ffe040' : '#fff']]; if (!e.boss) ops.push(['にげる', '#fff']);
        ops.forEach((o, i) => { if (i === B.sub) heart(bx.x + 8, bx.y + 11 + i * 16); typed(o[0], bx.x + 24, bx.y + 8 + i * 16, 250, 12, 99, o[1]); });
      } else if (B.ph === 'bar' || B.ph === 'dmg') {
        ctx.fillStyle = '#3a2a1a'; ctx.fillRect(bx.x + 14, bx.y + 18, 260, 28);
        ctx.fillStyle = '#ffd060'; ctx.fillRect(bx.x + 14 + 100, bx.y + 18, 60, 28); ctx.fillStyle = '#fff'; ctx.fillRect(bx.x + 14 + 126, bx.y + 18, 8, 28);
        if (B.ph === 'bar') { ctx.fillStyle = '#fff'; ctx.fillRect(bx.x + 14 + B.bar * 260 - 2, bx.y + 12, 4, 40); ctx.fillStyle = '#e8283c'; ctx.fillRect(bx.x + 14 + B.bar * 260 - 1, bx.y + 14, 2, 36); }
      }
    }
  }
  // 主人公ステータス
  ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.font = `12px ${FONT}`; ctx.fillStyle = '#fff'; ctx.fillText('リン', 18, 184);
  ctx.fillStyle = '#c00'; ctx.fillRect(100, 184, 60, 10); ctx.fillStyle = B.inv > 0 && Math.floor(B.t * 20) % 2 ? '#fff' : '#ff0'; ctx.fillRect(100, 184, 60 * G.hp / G.maxhp, 10);
  ctx.fillStyle = '#fff'; ctx.fillText(`HP ${G.hp}/${G.maxhp}`, 168, 184);
  ctx.fillStyle = FORMS[G.form].c[0]; ctx.fillText('● ' + FORMS[G.form].n, 232, 184);
  // コマンド
  ['たたかう', 'こうどう', 'アイテム', 'みのがす'].forEach((l, i) => {
    const x = 14 + i * 76, sel = B.ph === 'menu' && B.sel === i, hot = B.ph === ['', 'act', 'item', 'mercy'][i] || (i === 0 && (B.ph === 'bar' || B.ph === 'dmg'));
    ctx.fillStyle = sel || hot ? '#ffe040' : '#ff7a00'; ctx.fillRect(x, 206, 68, 26); ctx.fillStyle = '#000'; ctx.fillRect(x + 2, 208, 64, 22);
    ctx.fillStyle = sel || hot ? '#ffe040' : '#ff7a00'; ctx.textAlign = 'center'; ctx.fillText(l, x + 36 + (sel ? 6 : 0), 213);
    if (sel) heart(x + 8, 215, FORMS[G.form].c[0]);
  });
  // ソウル
  if (B.ph === 'dodge') { if (!(B.inv > 0 && Math.floor(B.t * 20) % 2)) heart(B.soul.x - 3, B.soul.y - 3, FORMS[G.form].c[0]); }
  if (B.ph === 'dead') for (const p of B.pieces) { ctx.fillStyle = '#e8283c'; ctx.fillRect(p.x, p.y, 3, 3); }
  if (B.ph === 'dead' && B.t < .6) heart(B.soul.x - 3, B.soul.y - 3, '#e8283c');
}

// ================= ワールド描画 =================
function drawRoom() {
  const r = room();
  for (let y = 0; y < 15; y++) for (let x = 0; x < 20; x++) { ctx.fillStyle = ((x + y) & 1) ? r.g[0] : r.g[1]; ctx.fillRect(x * T, y * T, T, T); }
  ctx.fillStyle = r.pc; for (const p of r.path) ctx.fillRect(p[0] * T, p[1] * T, p[2] * T, p[3] * T);
  for (let i = 0; i < 46; i++) { ctx.fillStyle = r.dc[i % r.dc.length]; ctx.fillRect(hash(i + r.seed * 13) * W | 0, hash(i * 3 + r.seed) * H | 0, 2, 2); }
  if (G.room === 'tower') {   // 床の大時計
    disc(160, 138, 52, '#1a1a2a'); disc(160, 138, 48, '#3a3a5a'); disc(160, 138, 44, '#24243a');
    for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; ctx.fillStyle = '#ffd860'; ctx.fillRect(160 + Math.sin(a) * 38 - 1, 138 - Math.cos(a) * 38 - 1, 3, 3); }
    const tt = G.flags.d_uro ? 0 : -time * 2; ctx.strokeStyle = '#ffd860'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(160, 138); ctx.lineTo(160 + Math.sin(tt) * 30, 138 - Math.cos(tt) * 30); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(160, 138); ctx.lineTo(160 + Math.sin(tt / 12) * 20, 138 - Math.cos(tt / 12) * 20); ctx.stroke();
  }
  if (G.room === 'tree') {   // 巨大な林檎の樹
    ctx.fillStyle = '#5a3a24'; ctx.fillRect(144, 40, 32, 62); ctx.fillStyle = '#7a5a3a'; ctx.fillRect(148, 40, 6, 62);
    disc(160, 34, 66, '#2a7a40'); disc(104, 46, 38, '#2a7a40'); disc(216, 46, 38, '#2a7a40'); disc(160, 20, 46, '#3a9a52');
    for (let i = 0; i < 18; i++) disc(60 + hash(i * 7) * 200, 10 + hash(i * 5) * 60, 3, i % 3 ? '#e8283c' : '#ffd8e0');
    for (let i = 0; i < 20; i++) { const x = (hash(i) * W + Math.sin(time + i) * 14), y = (time * (14 + i % 5 * 4) + hash(i + 9) * H) % H; ctx.fillStyle = '#ffd8e0'; ctx.fillRect(x | 0, y | 0, 2, 2); }
  }
  for (const o of r.obs) {
    const k = o[4] || 'tree';
    if (k === 'gate' && G.flags.d_uro) continue;
    for (let tx = o[0]; tx < o[0] + o[2]; tx++) for (let ty = o[1]; ty < o[1] + o[3]; ty++) {
      const x = tx * T, y = ty * T;
      if (k === 'tree') {
        if (G.room === 'tree' && ty < 2) continue;
        ctx.fillStyle = r.tc[0]; ctx.fillRect(x, y, T, T); ctx.fillStyle = r.tc[1]; ctx.fillRect(x + 1, y + 1, 14, 12); ctx.fillRect(x + 3, y, 10, 15); ctx.fillStyle = r.tc[2]; ctx.fillRect(x + 4, y + 2, 4, 3);
        if (hash(tx * 31 + ty * 17) > .75) { ctx.fillStyle = '#e8283c'; ctx.fillRect(x + 9, y + 7, 3, 3); }
      } else if (k === 'rock') { ctx.fillStyle = '#6a5a4a'; ctx.fillRect(x, y + 2, T, 13); ctx.fillStyle = '#8a7a6a'; ctx.fillRect(x + 1, y + 2, 12, 5); ctx.fillStyle = '#4a3a2a'; ctx.fillRect(x, y + 13, T, 2); }
      else if (k === 'water') { ctx.fillStyle = '#2a6ac8'; ctx.fillRect(x, y, T, T); ctx.fillStyle = '#6aa8ff'; ctx.fillRect(x + 3 + Math.sin(time * 2 + tx) * 3 | 0, y + 5, 6, 1); ctx.fillRect(x + 7 + Math.cos(time * 2 + ty) * 3 | 0, y + 11, 5, 1); }
      else if (k === 'wall') { ctx.fillStyle = '#50507a'; ctx.fillRect(x, y, T, T); ctx.fillStyle = '#3a3a5a'; ctx.fillRect(x, y + 7, T, 1); ctx.fillRect(x, y + 15, T, 1); ctx.fillRect(x + (ty & 1 ? 4 : 10), y, 1, 8); ctx.fillRect(x + (ty & 1 ? 10 : 4), y + 8, 1, 8); }
      else if (k === 'rail') { ctx.fillStyle = '#1a2038'; ctx.fillRect(x, y, T, T); ctx.fillStyle = '#6a5a4a'; ctx.fillRect(x + 6, y, 4, T); if ((ty - o[1]) % 2 === 0) { ctx.fillStyle = '#aab'; ctx.fillRect(x, y + 4, T, 2); ctx.fillRect(x, y + 11, T, 2); } }
      else if (k === 'stall') { ctx.fillStyle = '#8a5a2a'; ctx.fillRect(x, y + 4, T, 12); ctx.fillStyle = (tx & 1) ? '#e8283c' : '#fff'; ctx.fillRect(x, y, T, 5); ctx.fillStyle = '#c0803a'; ctx.fillRect(x, y + 6, T, 2); }
      else if (k === 'trunk') { }
      else if (k === 'gate') { ctx.fillStyle = `rgba(150,100,255,${.35 + Math.sin(time * 4 + tx) * .15})`; ctx.fillRect(x, y, T, T); }
    }
  }
}
function drawWorld() {
  drawRoom();
  const r = room(), ents = [];
  for (const n of r.npcs) ents.push({ y: n.ty * T + 16, f: () => spr(n.spr, n.tx * T, n.ty * T) });
  for (const f of r.foes) if (alive(f)) ents.push({ y: f.ty * T + 16, f: () => { const s = f.big || 1; spr(f.spr, f.tx * T + 8 - 8 * s, f.ty * T + 16 - 16 * s + Math.sin(time * 3 + f.tx) * 1.5, s); } });
  ents.push({ y: G.py, f: () => drawApple(Math.round(G.px), Math.round(G.py), G.dir, Math.floor(wt * 6) % 2, G.form, G.safe > 0 && Math.floor(time * 16) % 2 ? .5 : 1) });
  ents.sort((a, b) => a.y - b.y).forEach(e => e.f());
  // 部屋名
  if (time - (G.rt || 0) < 0 || G.rn !== G.room) { G.rn = G.room; G.rt = time; }
  const a = 1 - (time - G.rt - 1.5) / .8;
  if (a > 0 && !D) { ctx.globalAlpha = Math.min(1, a); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 320, 14); ctx.fillStyle = '#fff'; ctx.font = `11px ${FONT}`; ctx.textBaseline = 'top'; ctx.textAlign = 'center'; ctx.fillText(room().n, W / 2, 1); ctx.globalAlpha = 1; }
  if (WM.open) {
    box(12, 12, 140, 104);
    ctx.font = `12px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillStyle = '#fff';
    ctx.fillText('リン', 22, 20); ctx.fillText(`HP ${G.hp}/${G.maxhp}`, 22, 38); ctx.fillText(`G　${G.gold}`, 22, 54);
    ctx.fillStyle = FORMS[G.form].c[0]; ctx.fillText('● ' + FORMS[G.form].n, 22, 70);
    ctx.fillStyle = '#fff'; ctx.fillText(`転生　${G.deaths}回`, 22, 86);
    ctx.fillStyle = G.juice > 0 && G.hp < G.maxhp ? '#ffe040' : '#888'; ctx.fillText(`Z: りんごジュース ×${G.juice}`, 22, 100);
  }
}

// ================= タイトル / エンディング =================
function toTitle() { M = 'title'; tsel = 0; D = null; WM.open = false; setBgm('title'); }
function drawStars(n = 50) { for (let i = 0; i < n; i++) { ctx.fillStyle = Math.sin(time * 2 + i) > 0 ? '#fff' : '#889'; ctx.fillRect(hash(i) * W | 0, hash(i + .5) * H * .8 | 0, 1, 1); } }
function drawTitle() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a0a2a'); g.addColorStop(1, '#6a1a3a'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  drawStars();
  for (let i = 0; i < 9; i++) { const y = (time * (14 + i * 3) + i * 40) % (H + 30) - 15, x = 20 + i * 35 + Math.sin(time + i) * 10; drawApple(x | 0, y | 0, 'down', 0, i % FORMS.length, .35); }
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillStyle = '#6a0a20'; ctx.font = `36px ${FONT}`; ctx.fillText('転生林檎', W / 2 + 2, 52); ctx.fillStyle = '#fff'; ctx.fillText('転生林檎', W / 2, 50);
  ctx.font = `12px ${FONT}`; ctx.fillStyle = '#ffc0d8'; ctx.fillText('― めぐる果樹園の　リン ―', W / 2, 96);
  drawApple(W / 2, 148 + Math.sin(time * 2) * 3 | 0, 'down', Math.floor(time * 4) % 2, Math.floor(time / 2) % FORMS.length);
  const items = hasSave() ? ['はじめから', 'つづきから'] : ['はじめから'];
  items.forEach((it, i) => { ctx.font = `14px ${FONT}`; ctx.fillStyle = i === tsel ? '#ffe040' : '#fff'; ctx.fillText(it, W / 2, 172 + i * 20); if (i === tsel) heart(W / 2 - 62, 175 + i * 20); });
  ctx.font = `10px ${FONT}`; ctx.fillStyle = '#aaa'; ctx.fillText('十字キー: うごく　Z: けってい　X: キャンセル　C: メニュー', W / 2, 218);
  let t = false; try { t = !!localStorage[TRUE_KEY]; } catch (e) {}
  if (t) { ctx.fillStyle = '#ffe040'; ctx.fillText('★ TRUE END 到達', W / 2, 228); }
}
function updTitle() {
  const n = hasSave() ? 2 : 1;
  if (hit.up || hit.down) { tsel = (tsel + 1) % n; sfx('move'); }
  if (hit.ok) {
    sfx('sel');
    if (tsel === 0) { newGame(); narr(['なんど目の　目ざめだろう。', 'あまい　におい。\nとおくで　だれかが　うたっている。', 'わたしは　林檎。\n名前は…　リン、だったような　気がする。'], () => { M = 'world'; setBgm('hill'); G.rn = ''; }); setBgm('tree'); }
    else { if (loadGame()) { M = 'world'; setBgm(room().bgm); G.rn = ''; } }
  }
}
function drawEnd() {
  const t = E.t;
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, t < 8 ? '#0a0a22' : '#2a5a8a'); g.addColorStop(1, t < 8 ? '#1a1a3a' : '#a8d8f0'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (t < 12) drawStars(60);
  ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, 190, W, 50); ctx.fillStyle = '#4a3a2a'; ctx.fillRect(0, 190, W, 4);
  if (t < 4) drawApple(160, Math.min(190, 20 + t * t * 14) | 0, 'down', 0, G.form);
  else if (t < 8) { ctx.fillStyle = '#4fbf5a'; const h = Math.min(14, (t - 4) * 4) | 0; ctx.fillRect(159, 190 - h, 2, h); if (h > 6) { ctx.fillRect(160, 186 - h + 4, 5, 2); } }
  else {
    const gr = Math.min(1, (t - 8) / 8), tr = 6 + 40 * gr | 0, th = 12 + 80 * gr | 0;
    ctx.fillStyle = '#5a3a24'; ctx.fillRect(156, 190 - th, 8, th);
    disc(160, 190 - th - 6, tr, '#3a9a52'); disc(160 - tr * .6, 190 - th + 4, tr * .6 | 0, '#2a7a40'); disc(160 + tr * .6, 190 - th + 4, tr * .6 | 0, '#2a7a40');
    if (gr > .4) for (let i = 0; i < 8; i++) disc(160 + (hash(i) - .5) * tr * 1.6, 190 - th - 6 + (hash(i + 3) - .5) * tr * 1.2, 2, '#e8283c');
    for (let i = 0; i < 20; i++) { const x = (hash(i) * W + Math.sin(time + i) * 14), y = (time * (14 + i % 5 * 4) + hash(i + 9) * H) % H; ctx.fillStyle = '#ffd8e0'; ctx.fillRect(x | 0, y | 0, 2, 2); }
    if (t > 11) { ctx.save(); ctx.translate(250 + Math.sin(time * 2) * 20, 120 + Math.cos(time * 3) * 10); ctx.fillStyle = '#ffb040'; ctx.fillRect(-4, 0, 3, 3); ctx.fillRect(1, 0, 3, 3); ctx.restore(); }
  }
  let line = ''; for (const [a, s] of ENDTXT) if (t >= a) line = s;
  ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(0, 196, W, 44);
  typed(line, W / 2, 204, 290, 16, 999, t > 26 ? '#ffe040' : '#fff', 'center');
  if (t > 30) { ctx.font = `10px ${FONT}`; ctx.fillStyle = '#ccc'; ctx.textAlign = 'center'; ctx.fillText('PRESS Z', W / 2, 228); }
}

// ================= メインループ =================
let last = performance.now();
function frame(now) {
  const dt = clamp((now - last) / 1000, 0, .05); last = now; time += dt;
  // フェード
  if (fade.d) {
    fade.a += fade.d * dt * 3.2;
    if (fade.d > 0 && fade.a >= 1) { fade.a = 1; fade.d = -1; const cb = fade.cb; fade.cb = null; cb && cb(); }
    else if (fade.d < 0 && fade.a <= 0) { fade.a = 0; fade.d = 0; }
  }
  // 更新
  const hadD = !!D;
  if (hadD) updText(dt);
  else {
    if (M === 'title') updTitle();
    else if (M === 'world') updateWorld(dt);
    else if (M === 'battleIntro') { B.t += dt; if (B.t > 1) { B.t = 0; beginBattle(); } }
    else if (M === 'battle') updateBattle(dt);
    else if (M === 'end') { E.t += dt; if (E.t > 30 && hit.ok) { newGame(); toTitle(); } }
  }
  if (M === 'battle' && D) { B.t += dt; B.shake = Math.max(0, B.shake - dt); }
  // 描画
  ctx.save();
  if (M === 'title') drawTitle();
  else if (M === 'world' || M === 'cut') drawWorld();
  else if (M === 'battleIntro') { drawWorld(); if (Math.floor(B.t * 10) % 2) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); } heart(G.px - 3, G.py - 14 + B.t * 10, FORMS[G.form].c[0]); }
  else if (M === 'battle') drawBattle();
  else if (M === 'narr') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); }
  else if (M === 'end') drawEnd();
  ctx.restore();
  if (M !== 'narr') drawText(); else drawText();
  if (fade.a > 0) { ctx.fillStyle = `rgba(0,0,0,${fade.a})`; ctx.fillRect(0, 0, W, H); }
  for (const k in hit) hit[k] = 0;
  requestAnimationFrame(frame);
}
toTitle();
requestAnimationFrame(frame);
