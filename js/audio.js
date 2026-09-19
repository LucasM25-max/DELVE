/* ==========================================================================
   DELVE — audio engine v2: FILES ONLY (no synthesis).
   All sounds load from assets/audio/ via assets/audio/manifest.json, e.g.
     { "files": ["mus_menu_theme.ogg", "sfx_ui_stamp.ogg"] }
   Filenames map to ids through FILES below (see AUDIO_PROMPTS.md for the
   generation prompts and AUDIO_GENERATION_GUIDE.md for the workflow).
   Missing files degrade to silence — every call site is null-safe.
   ========================================================================== */
'use strict';
const DelveAudio = (() => {
  let ctx = null, OK = false;
  let master, musicG, sfxG, ambG, voiceG, themeG, varG;
  let themeSrc = null, varSrc = null;
  const B = {};
  let ambTimers = [];
  const G = { master: 0.9, music: 0.8, sfx: 0.9, voice: 1.0 };

  const FILES = {
    theme: 'mus_menu_theme', 'var': 'mus_menu_theme_var',
    rumble: 'sfx_boot_stone', chime: 'sfx_boot_chime', chisel: 'sfx_boot_chisel', cadence: 'mus_boot_cadence',
    move: 'sfx_ui_move', confirm: 'sfx_ui_confirm', back: 'sfx_ui_back', deny: 'sfx_ui_deny',
    page: 'sfx_ui_page', stamp: 'sfx_ui_stamp',
    gull: 'amb_gull', bell: 'amb_bell', creak: 'amb_creak', clack: 'amb_clack'
  };
  const AMB_IDS = { gull: 1, bell: 1, creak: 1, clack: 1 };

  async function loadFiles(){
    let list = [];
    try {
      const r = await fetch('assets/audio/manifest.json');
      if (!r.ok) return;
      list = ((await r.json()).files) || [];
    } catch (e) { return; }
    const byName = {};
    Object.keys(FILES).forEach(id => { byName[FILES[id]] = id; });
    for (const fname of list){
      const base = fname.replace(/\.(ogg|mp3|wav)$/i, '');
      const id = byName[base];
      if (!id) continue;
      try {
        const r = await fetch('assets/audio/' + fname);
        if (!r.ok) continue;
        B[id] = await ctx.decodeAudioData(await r.arrayBuffer());
      } catch (e) { /* skip unreadable file */ }
    }
  }

  function applyGains(){
    if (!OK) return;
    master.gain.value = G.master;
    musicG.gain.value = G.music;
    sfxG.gain.value = G.sfx;
    voiceG.gain.value = G.voice;
  }

  function init(){
    if (ctx){ if (ctx.state === 'suspended') ctx.resume().catch(()=>{}); return; }
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { OK = false; return; }
    try {
      master = ctx.createGain(); master.connect(ctx.destination);
      musicG = ctx.createGain(); musicG.connect(master);
      sfxG = ctx.createGain(); sfxG.connect(master);
      ambG = ctx.createGain(); ambG.gain.value = 0.5; ambG.connect(master);
      voiceG = ctx.createGain(); voiceG.connect(master);
      themeG = ctx.createGain(); themeG.gain.value = 0; themeG.connect(musicG);
      varG = ctx.createGain(); varG.gain.value = 0; varG.connect(musicG);
      OK = true;
      applyGains();
      loadFiles();
      if (ctx.state === 'suspended') ctx.resume().catch(()=>{});
    } catch (e) { OK = false; }
  }

  function play(id, gain = 1, when = 0, rate = 1){
    if (!OK || !B[id]) return;
    try {
      const src = ctx.createBufferSource(); src.buffer = B[id]; src.playbackRate.value = rate;
      const g = ctx.createGain(); g.gain.value = gain;
      src.connect(g); g.connect(AMB_IDS[id] ? ambG : sfxG);
      src.start(ctx.currentTime + when);
    } catch (e) {}
  }

  function sting(){                      // GDD-02 §1.4 timeline audio
    play('rumble', 0.9, 0);
    play('chime', 0.7, 1.0, 1); play('chime', 0.7, 1.35, 1.12); play('chime', 0.8, 1.7, 1.26);
    for (let i = 0; i < 5; i++) play('chisel', 0.55, 2.0 + i * 0.2);
    play('cadence', 0.9, 3.0);
  }

  function startMenu(){
    if (!OK || themeSrc) return;
    try {
      if (B.theme){
        themeSrc = ctx.createBufferSource(); themeSrc.buffer = B.theme; themeSrc.loop = true;
        themeSrc.connect(themeG); themeSrc.start();
        themeG.gain.setTargetAtTime(0.9, ctx.currentTime, 0.6);
      }
      if (B.var){
        varSrc = ctx.createBufferSource(); varSrc.buffer = B.var; varSrc.loop = true;
        varSrc.connect(varG); varSrc.start();
      }
    } catch (e) {}
  }
  function menuVariant(on){              // §2.2: hum variant on CONTINUE hover with a save
    if (!OK || !themeSrc) return;
    const t = ctx.currentTime;
    themeG.gain.setTargetAtTime(on ? 0.32 : 0.9, t, 0.35);
    varG.gain.setTargetAtTime(on && varSrc ? 0.55 : 0.0, t, 0.35);
  }
  function stopMenu(){
    try { if (themeSrc){ themeSrc.stop(); themeSrc = null; } if (varSrc){ varSrc.stop(); varSrc = null; } } catch (e) {}
    if (themeG) themeG.gain.value = 0;
    if (varG) varG.gain.value = 0;
  }
  function ambStart(){                   // §2.2 harbour-dawn bed (only present ids)
    ambStop();
    if (!OK) return;
    const loop = (id, g, min, max) => {
      if (!B[id]) return;
      const tick = () => { play(id, g); ambTimers.push(setTimeout(tick, (min + Math.random() * (max - min)) * 1000)); };
      ambTimers.push(setTimeout(tick, (min + Math.random() * (max - min)) * 1000));
    };
    loop('bell', 0.5, 20, 24);           // harbour bell ~22 s
    loop('gull', 0.6, 20, 40);
    loop('creak', 0.5, 8, 16);
    loop('clack', 0.35, 5, 9);
  }
  function ambStop(){ ambTimers.forEach(clearTimeout); ambTimers = []; }

  function setGains(g){ Object.assign(G, g); applyGains(); }
  return { init, play, sting, startMenu, stopMenu, menuVariant, ambStart, ambStop, setGains, get ok(){ return OK; } };
})();
