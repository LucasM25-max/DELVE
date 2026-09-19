/* ==========================================================================
   DELVE — runtime audio synthesis (GDD-02 §1.4, §2.2, §2.8).
   Every music loop and SFX in the shell is synthesized in-browser at init:
   Karplus-Strong plucks (bouzouki), frame-drum thumps, hum pads, bells,
   gulls, creaks and the UI one-shots. No audio files, no licensing.
   All entry points are safe no-ops if Web Audio is unavailable.
   ========================================================================== */
'use strict';
const DelveAudio = (() => {
  const SR = 44100;
  const LOOP_SEC = 90;                 // §2.2 theme loop length
  const BEAT = 10 / 3;                 // 72 bpm → 27 beats per loop (seamless)
  let ctx = null, OK = false;
  let master, musicG, sfxG, ambG, themeG, varG;
  let themeSrc = null, varSrc = null;
  const B = {};                        // buffers
  let ambTimers = [];

  /* ---------- tiny deterministic rng ---------- */
  function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

  /* ---------- sample-level helpers ---------- */
  function ks(arr, t0, f, amp, dur){          // Karplus-Strong pluck
    const start = Math.floor(t0 * SR);
    const N = Math.max(2, Math.round(SR / f));
    const len = Math.min(Math.floor(dur * SR), arr.length - start);
    if (len <= N || N < 2) return;
    const d = new Float32Array(N + 1);
    const r = mulberry32(Math.floor(f * 97) + start);
    for (let i = 0; i < N; i++) d[i] = (r() * 2 - 1) * amp * (0.5 + 0.5 * Math.sin(Math.PI * i / N));
    let i = N;
    const decay = 0.996;
    while (i < len){ d[i % (N + 1)] = d[i % (N + 1)] * 0.0 + decay * 0.5 * (d[(i - N) % (N + 1)] + d[(i - N + 1) % (N + 1)]); arr[start + i] += d[i % (N + 1)]; i++; }
  }
  function thump(arr, t0, amp){               // frame-drum body
    const start = Math.floor(t0 * SR), len = Math.floor(0.4 * SR);
    let ph = 0;
    for (let k = 0; k < len && start + k < arr.length; k++){
      const t = k / SR;
      const f = 88 * Math.exp(-t / 0.09) + 46;
      ph += 2 * Math.PI * f / SR;
      arr[start + k] += amp * Math.exp(-t / 0.085) * Math.sin(ph);
    }
    const r = mulberry32(start + 7);          // slap transient
    let lp = 0;
    for (let k = 0; k < Math.floor(0.05 * SR); k++){
      lp += 0.35 * ((r() * 2 - 1) - lp);
      arr[start + k] += amp * 0.5 * Math.exp(-k / (0.012 * SR)) * lp;
    }
  }
  function noiseSlap(arr, t0, amp, dur){
    const start = Math.floor(t0 * SR), len = Math.floor(dur * SR);
    const r = mulberry32(start + 13); let lp = 0;
    for (let k = 0; k < len && start + k < arr.length; k++){
      lp += 0.25 * ((r() * 2 - 1) - lp);
      arr[start + k] += amp * Math.exp(-k / (0.03 * SR)) * lp;
    }
  }

  /* ---------- the 90-second dwarf-march theme ---------- */
  function synthTheme(withHum){
    const n = SR * LOOP_SEC;
    const arr = new Float32Array(n);
    const q = k => k / LOOP_SEC;              // loop-periodic LFO frequencies (seamless loop)
    // pad: D2 / A2 / D3 with slow periodic LFOs
    const p1 = 6608 / LOOP_SEC / 1.0, p2 = 9900 / LOOP_SEC / 1.0, p3 = 13215 / LOOP_SEC / 1.0;
    for (let i = 0; i < n; i++){
      const t = i / SR;
      arr[i] = 0.050 * Math.sin(2 * Math.PI * (p1 * t) + 0.30 * Math.sin(2 * Math.PI * q(8) * t))
             + 0.034 * Math.sin(2 * Math.PI * (p2 * t) + 0.25 * Math.sin(2 * Math.PI * q(6) * t))
             + 0.011 * Math.sin(2 * Math.PI * (p3 * t)) * (0.6 + 0.4 * Math.sin(2 * Math.PI * q(5) * t));
    }
    // frame drum: pulse every beat, accent every 4th, half-time slap fill
    for (let b = 0; b * BEAT < LOOP_SEC - 0.5; b++){
      thump(arr, b * BEAT, b % 4 === 0 ? 0.55 : 0.38);
      if (b % 8 === 6) noiseSlap(arr, b * BEAT + BEAT / 2, 0.16, 0.07);
    }
    // bouzouki pluck phrases (D minor pentatonic air), seeded = deterministic
    const pent = [146.83, 174.61, 196.00, 220.00, 261.63, 293.66, 349.23];
    const r = mulberry32(20260919);
    let t = 1.6;
    while (t < LOOP_SEC - 2.6){
      const phrase = 2 + Math.floor(r() * 3);
      for (let j = 0; j < phrase; j++){
        const f = pent[Math.floor(r() * pent.length)];
        const amp = 0.16 + r() * 0.08;
        ks(arr, t, f, amp, 2.4);
        ks(arr, t + 0.008, f * 1.004, amp * 0.55, 2.4);   // double course
        t += BEAT * (r() < 0.3 ? 0.5 : 1);
      }
      t += BEAT * (1 + Math.floor(r() * 3));              // breath
    }
    if (withHum){
      for (let i = 0; i < n; i++) arr[i] *= 0.5;           // §2.2: variant at 50% intensity
      const hum = [146.83, 174.61, 220.00, 196.00, 146.83, 261.63, 220.00, 174.61];
      const seg = LOOP_SEC / hum.length;
      for (let sN = 0; sN < hum.length; sN++){
        const f = hum[sN], st = Math.floor(sN * seg * SR), en = Math.floor((sN + 1) * seg * SR);
        let ph = 0, ph2 = 0;
        for (let i = st; i < en && i < n; i++){
          const lt = (i - st) / SR;
          const env = Math.min(1, lt / 0.4) * Math.min(1, (seg - lt) / 0.5);
          const vib = 1 + 0.006 * Math.sin(2 * Math.PI * 5.1 * lt);
          ph  += 2 * Math.PI * f * vib / SR;
          ph2 += 2 * Math.PI * f * 1.003 * vib / SR;
          arr[i] += 0.055 * env * (Math.sin(ph) + 0.6 * Math.sin(ph2))
                  + 0.018 * env * Math.sin(ph * 2.01);    // chest formant
        }
      }
    }
    return arr;
  }

  /* ---------- one-shot builders ---------- */
  function makeBuf(dur, fn){
    const len = Math.floor(dur * SR), arr = new Float32Array(len);
    for (let i = 0; i < len; i++) arr[i] = fn(i / SR, i);
    return arr;
  }
  const env = (t, a, d) => Math.min(1, t / a) * Math.exp(-Math.max(0, t - a) / d);
  function buildOneShots(){
    B.move = makeBuf(0.06, (t) => 0.22 * env(t, 0.002, 0.02) * Math.sin(2 * Math.PI * 1500 * t) + 0.1 * env(t, 0.001, 0.008) * (Math.random() * 2 - 1));
    B.confirm = (() => { const arr = new Float32Array(Math.floor(0.4 * SR)); ks(arr, 0, 196, 0.5, 0.4); noiseSlap(arr, 0, 0.12, 0.03); return arr; })();
    B.back = makeBuf(0.28, (t) => 0.14 * env(t, 0.004, 0.09) * Math.sin(2 * Math.PI * (900 - 1600 * t) * t) * (0.6 + 0.4 * (Math.random() * 2 - 1)));
    B.deny = makeBuf(0.24, (t) => 0.4 * Math.exp(-t / 0.07) * Math.sin(2 * Math.PI * 82 * t) + 0.1 * Math.exp(-t / 0.03) * (Math.random() * 2 - 1));
    B.page = makeBuf(0.2, (t) => 0.1 * env(t, 0.01, 0.06) * (Math.random() * 2 - 1) * (0.4 + 0.6 * Math.sin(2 * Math.PI * 9 * t)));
    B.stamp = (() => { const arr = new Float32Array(Math.floor(0.4 * SR)); thump(arr, 0, 0.8); noiseSlap(arr, 0, 0.25, 0.05); ks(arr, 0.02, 147, 0.3, 0.35); return arr; })();
    B.chisel = makeBuf(0.07, (t) => 0.3 * Math.exp(-t / 0.012) * (Math.random() * 2 - 1));
    B.rumble = makeBuf(1.0, (t) => { let s = Math.random() * 2 - 1; return 0.5 * Math.sin(2 * Math.PI * 46 * t) * Math.sin(Math.PI * t) * 0.4 + 0.35 * s * Math.sin(Math.PI * t) * 0.12; });
    B.cadence = (() => { const arr = new Float32Array(Math.floor(1.4 * SR)); ks(arr, 0, 146.83, 0.42, 0.6); ks(arr, 0.55, 110.0, 0.46, 0.8); return arr; })();
    // bells / chimes (partial stacks)
    const bell = (f, dur, amp) => makeBuf(dur, (t) => amp * (
        Math.exp(-t / (dur * 0.62)) * Math.sin(2 * Math.PI * f * t)
      + 0.5 * Math.exp(-t / (dur * 0.4)) * Math.sin(2 * Math.PI * f * 2.01 * t)
      + 0.26 * Math.exp(-t / (dur * 0.28)) * Math.sin(2 * Math.PI * f * 2.98 * t)
      + 0.14 * Math.exp(-t / (dur * 0.2)) * Math.sin(2 * Math.PI * f * 4.2 * t)));
    B.chime = bell(880, 0.9, 0.3);
    B.bell = bell(180, 6.0, 0.34);
    B.gull = makeBuf(0.6, (t) => {
      const c1 = t < 0.18 ? Math.sin(2 * Math.PI * (1500 - 3000 * t) * t) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 26 * t)) : 0;
      const u = t - 0.26;
      const c2 = (u > 0 && u < 0.16) ? Math.sin(2 * Math.PI * (1400 - 2800 * u) * u) * (0.6 + 0.4 * Math.sin(2 * Math.PI * 24 * u)) : 0;
      return 0.16 * (c1 + c2) + 0.02 * (Math.random() * 2 - 1) * (c1 || c2 ? 1 : 0);
    });
    B.creak = makeBuf(0.7, (t) => {
      const f = 92 + 48 * t + 6 * Math.sin(2 * Math.PI * 7 * t);
      const saw = 2 * ((f * t) % 1) - 1;
      return 0.05 * saw * (0.5 + 0.5 * Math.sin(2 * Math.PI * 3.3 * t)) * Math.min(1, t / 0.08) * Math.min(1, (0.7 - t) / 0.2);
    });
    B.clack = (() => { const arr = new Float32Array(Math.floor(0.16 * SR)); ks(arr, 0, 620, 0.16, 0.14); noiseSlap(arr, 0, 0.06, 0.015); return arr; })();
  }

  function toBuffer(arr){ const b = ctx.createBuffer(1, arr.length, SR); b.copyToChannel(arr, 0); return b; }

  /* ---------- public ---------- */
  function init(){
    if (ctx) { if (ctx.state === 'suspended') ctx.resume().catch(()=>{}); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { OK = false; return; }
    try {
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      musicG = ctx.createGain(); musicG.gain.value = 0.8; musicG.connect(master);
      sfxG = ctx.createGain(); sfxG.gain.value = 0.9; sfxG.connect(master);
      ambG = ctx.createGain(); ambG.gain.value = 0.5; ambG.connect(master);
      themeG = ctx.createGain(); themeG.gain.value = 0; themeG.connect(musicG);
      varG = ctx.createGain(); varG.gain.value = 0; varG.connect(musicG);
      B.theme = toBuffer(synthTheme(false));
      B.var = toBuffer(synthTheme(true));
      buildOneShots();
      for (const k of Object.keys(B)) if (B[k] instanceof Float32Array) B[k] = toBuffer(B[k]);
      OK = true;
      if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
    } catch (e) { OK = false; }
  }
  const AMB_IDS = { gull: 1, bell: 1, creak: 1, clack: 1 };
  function play(id, gain = 1, when = 0){
    if (!OK || !B[id]) return;
    try {
      const src = ctx.createBufferSource(); src.buffer = B[id];
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(g); g.connect(AMB_IDS[id] ? ambG : sfxG);
      src.start(ctx.currentTime + when);
    } catch (e) {}
  }
  function sting(){                      // §1.4 timeline audio
    play('rumble', 0.9, 0);
    play('chime', 0.7, 1.0); play('chime', 0.7, 1.35); play('chime', 0.8, 1.7);
    for (let i = 0; i < 5; i++) play('chisel', 0.55, 2.0 + i * 0.2);
    play('cadence', 0.9, 3.0);
  }
  function startMenu(){
    if (!OK || themeSrc) return;
    try {
      themeSrc = ctx.createBufferSource(); themeSrc.buffer = B.theme; themeSrc.loop = true;
      themeSrc.connect(themeG); themeSrc.start();
      varSrc = ctx.createBufferSource(); varSrc.buffer = B.var; varSrc.loop = true;
      varSrc.connect(varG); varSrc.start();
      themeG.gain.setTargetAtTime(0.9, ctx.currentTime, 0.6);
    } catch (e) {}
  }
  function menuVariant(on){              // §2.2/§2.8: VAR on CONTINUE hover with a save
    if (!OK) return;
    const t = ctx.currentTime;
    themeG.gain.setTargetAtTime(on ? 0.32 : 0.9, t, 0.35);
    varG.gain.setTargetAtTime(on ? 0.55 : 0.0, t, 0.35);
  }
  function stopMenu(){
    try { if (themeSrc){ themeSrc.stop(); themeSrc = null; } if (varSrc){ varSrc.stop(); varSrc = null; } } catch (e) {}
    if (themeG) themeG.gain.value = 0;
    if (varG) varG.gain.value = 0;
  }
  function ambStart(){                   // §2.2 menu bed scheduler
    ambStop();
    const loop = (fn, min, max) => { const t = setTimeout(() => { fn(); loop(fn, min, max); }, (min + Math.random() * (max - min)) * 1000); ambTimers.push(t); };
    loop(() => play('bell', 0.5), 20, 24);        // harbour bell ~22 s
    loop(() => play('gull', 0.6), 20, 40);
    loop(() => play('creak', 0.5), 8, 16);
    loop(() => play('clack', 0.35), 5, 9);        // distant blade-clacks from the spar
  }
  function ambStop(){ ambTimers.forEach(clearTimeout); ambTimers = []; }
  return { init, play, sting, startMenu, stopMenu, menuVariant, ambStart, ambStop, get ok(){ return OK; } };
})();
