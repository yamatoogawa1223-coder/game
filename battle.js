'use strict';
// リズム戦闘モード — 曲の音符（音程・リズム）に合わせて弾が届く、8bitチップチューン風の弾幕回避戦闘。
// 曲データ（SONG）の lead の音符1つ＝弾1つ。音程で弾の位置が決まり、音が鳴る瞬間に弾が到達する。
// 曲データは JSON を画面にドラッグ＆ドロップするか Battle.loadSong(obj) で差し替えられる。

const Battle = (() => {
  // ---------- 曲データ形式 ----------
  // { title, bpm, lead: [[音名, 拍数], ...], bass: [...], loops: 1 }
  //   音名: "A4" "C#5" "Bb3"、休符は "R"。拍数: 1 = 四分音符。
  // ※同梱の曲はこのゲーム用のオリジナル仮曲。好きな曲の音符データは自分で用意して差し替える。
  let SONG = {
    title: 'オリジナル仮曲',
    bpm: 150,
    lead: [
      ['A4', .5], ['C5', .5], ['E5', 1], ['D5', .5], ['C5', .5], ['B4', 1],
      ['C5', .5], ['D5', .5], ['E5', 1], ['A5', 1], ['G5', 1],
      ['F5', .5], ['E5', .5], ['D5', 1], ['C5', .5], ['D5', .5], ['E5', 1],
      ['A4', 2], ['E4', 1], ['R', 1],
      ['E5', .5], ['G5', .5], ['A5', 1], ['G5', .5], ['E5', .5], ['D5', 1],
      ['C5', .5], ['E5', .5], ['G5', 1], ['F5', 1], ['E5', 1],
      ['D5', .5], ['F5', .5], ['A5', 1], ['G5', .5], ['F5', .5], ['E5', 1],
      ['A4', 2], ['R', 2],
    ],
    bass: [
      ['A2', 2], ['E2', 2], ['A2', 2], ['A2', 2], ['F2', 2], ['C3', 2], ['E2', 2], ['E2', 2],
      ['A2', 2], ['E2', 2], ['C3', 2], ['G2', 2], ['D3', 2], ['A2', 2], ['E2', 2], ['E2', 2],
    ],
    loops: 2,
  };

  const BOX = { x: 165, y: 138, w: 150, h: 88 };
  const MAX_HP = 20, LEAD_IN = 1.2;
  const TRAVEL = 0.9;           // 弾が出現してから音が鳴る位置に着くまでの秒数
  const PAL_ADD = { R: '#d6293e', H: '#ff8a96', L: '#4caf50', b: '#6b3a1e', e: '#2a1020' };
  Object.assign(PAL, PAL_ADD);
  const APPLE = makeSprite([
    '.......bb.LLL...',
    '.......bLLLL....',
    '....RRRbRRRRR...',
    '..RRRRRRRRRRRRR.',
    '.RRHHRRRRRRRRRRR',
    'RRRHRRRRRRRRRRRR',
    'RRRRReRRRReRRRRR',
    'RRRRReRRRReRRRRR',
    'RRRRRRRRRRRRRRRR',
    'RRRRRReeeeRRRRRR',
    'RRRRRRRRRRRRRRRR',
    '.RRRRRRRRRRRRRR.',
    '..RRRRRRRRRRRR..',
    '...RRRRRRRRRR...',
    '.....RRRRRR.....',
  ]);

  // ---------- 音名 → 周波数 ----------
  const NOTE_IDX = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function midiOf(name) {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return null;
    return 12 * (+m[3] + 1) + NOTE_IDX[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  }
  const freqOf = midi => 440 * Math.pow(2, (midi - 69) / 12);

  // ---------- 8bit シンセ ----------
  let actx = null, master = null, noiseBuf = null;
  const waves = {};
  function audio() {
    if (!actx) {
      actx = (typeof ac !== 'undefined' && ac) || new (window.AudioContext || window.webkitAudioContext)();
      master = actx.createGain(); master.gain.value = 0.5; master.connect(actx.destination);
      const n = actx.sampleRate;
      noiseBuf = actx.createBuffer(1, n, n);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (actx.state === 'suspended') actx.resume();
    return actx;
  }
  function pulse(duty) {
    if (!waves[duty]) {
      const N = 48, re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) re[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
      waves[duty] = actx.createPeriodicWave(re, im);
    }
    return waves[duty];
  }
  function tone(t, f, dur, kind, vol) {
    const o = actx.createOscillator(), g = actx.createGain();
    if (kind === 'tri') o.type = 'triangle'; else o.setPeriodicWave(pulse(kind === 'p12' ? 0.125 : 0.25));
    o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.setValueAtTime(vol, t + Math.max(0.01, dur * 0.6));
    g.gain.linearRampToValueAtTime(0.0001, t + dur * 0.97);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur);
    scheduled.push(o);
  }
  function noise(t, dur, vol, hp) {
    const s = actx.createBufferSource(), g = actx.createGain(), f = actx.createBiquadFilter();
    s.buffer = noiseBuf; f.type = 'highpass'; f.frequency.value = hp;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(master); s.start(t); s.stop(t + dur);
    scheduled.push(s);
  }
  function kick(t) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    g.gain.setValueAtTime(0.35, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.16);
    scheduled.push(o);
  }

  // ---------- 譜面（音符→時刻・弾）の構築 ----------
  let scheduled = [], events = [], endT = 0, spb = 0.4, t0 = 0;
  function buildChart() {
    spb = 60 / SONG.bpm;
    events = [];
    const loops = SONG.loops || 1;
    const midis = SONG.lead.map(n => midiOf(n[0])).filter(m => m !== null);
    const lo = Math.min(...midis), hi = Math.max(...midis);
    let beat = 0;
    const leadBeats = SONG.lead.reduce((s, n) => s + n[1], 0);
    for (let l = 0; l < loops; l++) {
      for (const [name, len] of SONG.lead) {
        const m = midiOf(name);
        if (m !== null) {
          const bar = Math.floor(beat / 4);
          events.push({ t: beat * spb, dur: len * spb, midi: m, pos: hi === lo ? 0.5 : (m - lo) / (hi - lo), bar, long: len >= 1, fired: false });
        }
        beat += len;
      }
    }
    endT = beat * spb;
    return { leadBeats, loops };
  }
  function playSong(start) {
    audio();
    scheduled = [];
    const loops = SONG.loops || 1;
    let beat = 0;
    for (let l = 0; l < loops; l++) for (const [name, len] of SONG.lead) {
      const m = midiOf(name);
      if (m !== null) tone(start + beat * spb, freqOf(m), len * spb, 'p25', 0.16);
      beat += len;
    }
    beat = 0;
    if (SONG.bass) {
      const bassLen = SONG.bass.reduce((s, n) => s + n[1], 0);
      const reps = Math.ceil(endT / spb / bassLen);
      for (let r = 0; r < reps; r++) for (const [name, len] of SONG.bass) {
        const m = midiOf(name);
        if (m !== null && beat * spb < endT) tone(start + beat * spb, freqOf(m), len * spb, 'tri', 0.3);
        beat += len;
      }
    }
    for (let b = 0; b * 0.5 * spb < endT; b++) {
      const t = start + b * 0.5 * spb;
      if (b % 4 === 0) kick(t);
      else if (b % 4 === 2) noise(t, 0.09, 0.2, 1800);
      else noise(t, 0.03, 0.08, 6000);
    }
  }
  function stopSong() { scheduled.forEach(n => { try { n.stop(); } catch (e) { /* noop */ } }); scheduled = []; }

  // ---------- 戦闘状態 ----------
  let heart, bullets, hp, over, won, clock, flash, shakeB, appleBob, popups;
  const inBox = (x, y, r) => x - r >= BOX.x && x + r <= BOX.x + BOX.w && y - r >= BOX.y && y + r <= BOX.y + BOX.h;

  function start() {
    audio();
    buildChart();
    heart = { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h / 2, inv: 0 };
    bullets = []; popups = []; hp = MAX_HP; over = false; won = false; flash = 0; shakeB = 0; appleBob = 0;
    t0 = actx.currentTime + LEAD_IN;
    playSong(t0);
    state = 'battle';
  }
  function quit() { stopSong(); state = 'title'; }
  function loadSong(obj) {
    if (!obj || !Array.isArray(obj.lead) || !obj.bpm) throw new Error('曲データには bpm と lead が必要です');
    SONG = Object.assign({ loops: 1 }, obj);
  }

  // 小節ごとに弾の来る向きを変える。音が鳴る瞬間に、音程で決まる位置を通過する。
  function spawn(ev) {
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const d = dirs[ev.bar % 4];
    const cx = BOX.x + 8 + ev.pos * (BOX.w - 16);
    const cy = BOX.y + 8 + (1 - ev.pos) * (BOX.h - 16);
    const tx = d[0] === 0 ? cx : BOX.x + BOX.w / 2;
    const ty = d[0] === 0 ? BOX.y + BOX.h / 2 : cy;
    const reach = (d[0] === 0 ? BOX.h : BOX.w) / 2 + 40;
    const sp = reach / TRAVEL;
    bullets.push({
      x: tx - d[0] * reach, y: ty - d[1] * reach, vx: d[0] * sp, vy: d[1] * sp,
      r: ev.long ? 6 : 4, long: ev.long, born: clock,
    });
  }

  function update(dt) {
    clock = actx.currentTime - t0;
    if (over || won) { if (won && actx.currentTime - t0 > endT + 1) stopSong(); return; }
    // 移動
    let dx = (isDown('ArrowRight', 'KeyD') ? 1 : 0) - (isDown('ArrowLeft', 'KeyA') ? 1 : 0);
    let dy = (isDown('ArrowDown', 'KeyS') ? 1 : 0) - (isDown('ArrowUp', 'KeyW') ? 1 : 0);
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    const sp = isDown('KeyX', 'ShiftLeft') ? 45 : 95;
    const nx = heart.x + dx * sp * dt, ny = heart.y + dy * sp * dt;
    if (inBox(nx, heart.y, 4)) heart.x = nx;
    if (inBox(heart.x, ny, 4)) heart.y = ny;
    heart.inv = Math.max(0, heart.inv - dt);
    // 弾の出現
    for (const ev of events) {
      if (!ev.fired && clock >= ev.t - TRAVEL) { ev.fired = true; ev.hit = false; spawn(ev); }
      if (ev.fired && !ev.hit && clock >= ev.t) { ev.hit = true; flash = 1; appleBob = 1; }
    }
    flash = Math.max(0, flash - dt * 5); appleBob = Math.max(0, appleBob - dt * 4);
    // 弾の移動・当たり判定
    for (const b of bullets) {
      b.x += b.vx * dt; b.y += b.vy * dt;
      const ddx = b.x - heart.x, ddy = b.y - heart.y;
      if (heart.inv <= 0 && ddx * ddx + ddy * ddy < (b.r + 2.5) * (b.r + 2.5)) {
        hp -= b.long ? 4 : 3; heart.inv = 1; shakeB = 0.25; SFX.hit();
        popups.push({ x: heart.x, y: heart.y - 8, s: '-' + (b.long ? 4 : 3), life: 0.6 });
        if (hp <= 0) { hp = 0; over = true; stopSong(); SFX.over(); }
      }
    }
    bullets = bullets.filter(b => b.x > -30 && b.x < W + 30 && b.y > -30 && b.y < H + 30);
    popups.forEach(p => { p.life -= dt; p.y -= 20 * dt; }); popups = popups.filter(p => p.life > 0);
    shakeB = Math.max(0, shakeB - dt);
    if (clock > endT + 0.5 && !bullets.length) { won = true; stopSong(); }
  }

  // ---------- 描画 ----------
  function render() {
    ctx.save();
    if (shakeB > 0) ctx.translate(Math.round(rand(-2, 2)), Math.round(rand(-1, 1)));
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    // りんご（音の瞬間に跳ねる）
    const bob = Math.sin(performance.now() / 400) * 2 - appleBob * 6;
    ctx.drawImage(APPLE, W / 2 - 32, 30 + bob, 64, 60);
    text(SONG.title, W / 2, 20, 11, '#8b93d8', 'center');
    // 箱（ビートでふちが光る）
    ctx.lineWidth = 3; ctx.strokeStyle = flash > 0 ? `rgb(255,255,${Math.round(255 - flash * 120)})` : '#fff';
    ctx.strokeRect(BOX.x - 1.5, BOX.y - 1.5, BOX.w + 3, BOX.h + 3);
    // 弾
    for (const b of bullets) {
      ctx.fillStyle = b.long ? '#ffd44a' : '#fff';
      ctx.beginPath(); ctx.arc(Math.round(b.x), Math.round(b.y), b.r, 0, Math.PI * 2); ctx.fill();
    }
    // ハート
    if (!over && (heart.inv <= 0 || Math.floor(heart.inv * 12) % 2 === 0)) {
      const spr = SPR[(isDown('ArrowLeft', 'KeyA') ? 'walk1L' : isDown('ArrowRight', 'KeyD') ? 'walk1' : 'idle')];
      ctx.drawImage(spr, Math.round(heart.x) - 8, Math.round(heart.y) - 9);
      ctx.fillStyle = '#ff4d6a'; ctx.fillRect(Math.round(heart.x) - 1, Math.round(heart.y) - 1, 3, 3); // 当たり判定
    }
    popups.forEach(p => text(p.s, p.x, p.y, 12, '#ff6a6a', 'center'));
    // HP
    text('HP', 165, 248, 12, '#fff');
    ctx.fillStyle = '#c4162a'; ctx.fillRect(190, 238, MAX_HP * 3, 10);
    ctx.fillStyle = '#ffe14a'; ctx.fillRect(190, 238, hp * 3, 10);
    text(`${hp} / ${MAX_HP}`, 190 + MAX_HP * 3 + 8, 248, 12, '#fff');
    // 進行バー
    ctx.fillStyle = '#222'; ctx.fillRect(BOX.x, 256, BOX.w, 3);
    ctx.fillStyle = '#8b93d8'; ctx.fillRect(BOX.x, 256, BOX.w * clamp(clock / endT, 0, 1), 3);
    ctx.restore();
    if (clock < 0) text('準備…', W / 2, 120, 16, '#fff', 'center');
    if (over) {
      ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
      text('ゲームオーバー', W / 2, 110, 28, '#ff8fa0', 'center');
      text('Enter でもう一度 / Esc でタイトル', W / 2, 150, 13, '#b9c4f0', 'center');
    }
    if (won) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, 0, W, H);
      text('クリア！', W / 2, 110, 30, '#ffe58a', 'center');
      text(`のこりHP ${hp}   Enter でもう一度 / Esc でタイトル`, W / 2, 150, 13, '#b9c4f0', 'center');
    }
  }

  // ---------- 入力 ----------
  addEventListener('keydown', e => {
    if (state === 'title' && e.code === 'KeyB' && !e.repeat) { start(); return; }
    if (state !== 'battle' || e.repeat) return;
    if (e.code === 'Escape') quit();
    else if (e.code === 'Enter' && (over || won)) { stopSong(); start(); }
  });
  // タッチ：画面をドラッグするとハートが相対移動
  let drag = null;
  cv.addEventListener('pointerdown', e => {
    if (state === 'title') {
      const r = cv.getBoundingClientRect();
      if ((e.clientY - r.top) / r.height > 0.9) start();
    } else if (state === 'battle') {
      if (over || won) { stopSong(); start(); return; }
      drag = { x: e.clientX, y: e.clientY };
    }
  });
  addEventListener('pointermove', e => {
    if (state !== 'battle' || !drag || over || won) return;
    const r = cv.getBoundingClientRect(), k = W / r.width;
    const nx = heart.x + (e.clientX - drag.x) * k, ny = heart.y + (e.clientY - drag.y) * k;
    heart.x = clamp(nx, BOX.x + 4, BOX.x + BOX.w - 4); heart.y = clamp(ny, BOX.y + 4, BOX.y + BOX.h - 4);
    drag = { x: e.clientX, y: e.clientY };
  });
  addEventListener('pointerup', () => { drag = null; });
  // 曲データ(JSON)のドラッグ＆ドロップ
  addEventListener('dragover', e => e.preventDefault());
  addEventListener('drop', e => {
    e.preventDefault();
    const f = e.dataTransfer && e.dataTransfer.files[0];
    if (!f) return;
    f.text().then(s => { loadSong(JSON.parse(s)); if (state === 'battle') { stopSong(); } start(); })
      .catch(err => alert('曲データを読み込めませんでした: ' + err.message));
  });

  return { start, quit, update, render, loadSong, get song() { return SONG; } };
})();
