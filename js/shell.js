/* ==========================================================================
   DELVE — web shell state machine v1.2 (GDD-02 §1.4, §2.1–2.5, §2.8, §4).
   Boot: legal → logo sting → main menu. PLAY → First Run → signed end card.
   OPTIONS → full options tree (§2.5) with persistence + live application.
   CODEX / CREDITS remain sealed stubs; loading screen not in this build.
   Test hooks: ?s=legal|sting|menu|new|firstrun|end|options|stub3|stub4
              ?save=1  ?still=1  ?t=<ms hold sting>
   ========================================================================== */
'use strict';
(() => {
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const P = new URLSearchParams(location.search);

/* ---------- §4 string master ---------- */
const STR = {
  MENU_NOSAVE: 'No contracts signed yet.',
  NEW_TITLE: 'Begin a new contract?',
  NEW_BODY: 'A signed contract already exists: "{0} — {1}, {2}, {3}". Starting anew will not erase it; up to 8 contracts may rest in the ledger.',
  BACK: 'BACK',
  STUB_CODEX: 'The codex awaits the full build.',
  CODEX_LORE_EMPTY: 'The ledger is blank. Lore earns itself.',
  CODEX_BEST_EMPTY: 'No creatures catalogued yet.',
  STUB_CREDITS: 'The credits scroll awaits the full build.',
  CREDITS_END: 'Made with love for the table. Never for sale.',
  LOAD_TITLE_YRD: 'NEVERWINTER — THE ROCKSEEKER CONTRACT',
  LOAD_TITLE_CH1: 'CHAPTER 1 — A DANGEROUS JOURNEY',
  LOAD_ERR: 'The road is washed out. (Asset load failed: {0}). Retry?',
  LOAD_SLOW: 'Still packing the wagon… large loads take a moment on first visit.',
  RETRY: 'RETRY',
  QUIT_MENU: 'QUIT TO MENU',
  END_SIGNED_T: 'CONTRACT SIGNED',
  END_SIGNED_B: 'The wax is set, {0}. The yard gate opens in the full build — this shell ends at the threshold.',
  END_RESUME_T: 'CONTRACT RESTORED',
  END_RESUME_B: 'Your contract rests safely in the ledger, {0}. The yard gate opens in the full build.',
  END_BACK: 'RETURN TO MENU',
  FAST_HELP: 'The road is part of the story. The map opens in later chapters.'
};

/* ---------- options store (§2.5, defaults verbatim from spec) ---------- */
const OPT_DEFAULTS = {
  gfx:  { res: 'Native', fps: '60', quality: 'High', rt: 'On', foliage: 'High' },
  cam:  { view: 'Third person', fov: 95, boom: 3.8, bob: 'Off', shake: 70, snap: 'Off', framing: 'Auto two-shot', reduced: 'Off' },
  play: { hitch: 'On', grid: 'Off', pace: 'Cinematic', react: 'Ask always', rtimer: '6 s', autoend: 'Off', tells: 'On', diff: 'Balanced', combat: 'Table Mode (turn-based)', fast: 'Off' },
  acc:  { subs: 'On', subsize: 'M', names: 'On', cb: 'Off', hc: 'Off', sr: 'Off', dt: 'Subtle', cover: 'On-hover' },
  aud:  { master: 90, music: 80, sfx: 90, voice: 100, mute: 'On' },
  binds:{ sprint: 'ShiftLeft', jump: 'Space', interact: 'KeyF', view: 'KeyV', folio: 'Tab', journal: 'KeyJ', codex: 'KeyC', hide: 'KeyH', endturn: 'Space', pause: 'Escape' },
  pad: 'Standard'
};
const OPT_KEY = 'delve.options.v1';
const Opt = (() => {
  let o = JSON.parse(JSON.stringify(OPT_DEFAULTS));
  try { const r = localStorage.getItem(OPT_KEY); if (r) o = Object.assign(o, JSON.parse(r)); } catch (e) {}
  const save = () => { try { localStorage.setItem(OPT_KEY, JSON.stringify(o)); } catch (e) {} };
  return {
    get: (path) => path.split('.').reduce((a, k) => a && a[k], o),
    set(path, v){ path.split('.').reduce((a, k, i, arr) => i === arr.length - 1 ? (a[k] = v) : a[k], o); save(); apply(path); },
    all: o, save,
    resetBinds(){ o.binds = JSON.parse(JSON.stringify(OPT_DEFAULTS.binds)); save(); }
  };
})();
function apply(path){
  if (!path || path.startsWith('cam.reduced')) document.body.classList.toggle('rm', Opt.get('cam.reduced') === 'On' || matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (!path || path.startsWith('acc.hc')) document.body.classList.toggle('hc', Opt.get('acc.hc') === 'On');
  if (!path || path.startsWith('acc.cb')){
    document.body.classList.remove('cb-off', 'cb-prot', 'cb-deut', 'cb-trit');
    const cb = Opt.get('acc.cb');
    document.body.classList.add('cb-' + ({ 'Off': 'off', 'Protanopia': 'prot', 'Deuteranopia': 'deut', 'Tritanopia': 'trit' }[cb] || 'off'));
  }
  if (!path || path.startsWith('aud.')){
    DelveAudio.setGains({ master: Opt.get('aud.master') / 100 * 1.11, music: Opt.get('aud.music') / 100, sfx: Opt.get('aud.sfx') / 100, voice: Opt.get('aud.voice') / 100 });
  }
}

/* ---------- save (contract) ---------- */
const SAVE_KEY = 'delve.contract.v1';
function loadSave(){ try { const r = localStorage.getItem(SAVE_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function storeSave(s){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {} }
let save = loadSave();
if (P.get('save') === '1' && !save){
  save = { slot: 'Contract I', name: 'Recruit', cls: 'Recruit', lvl: 1, chap: 'Prologue', ts: Date.now() };
  storeSave(save);
}

/* ---------- wax seal SVG (GDD-02 §1.5 save-stamp lockup) ---------- */
function sealSVG(){
  return `<svg viewBox="0 0 100 100" role="img" aria-label="Contract seal">
    <circle cx="50" cy="50" r="47" fill="#8E2F26"/>
    <circle cx="50" cy="50" r="47" fill="none" stroke="#5e1d17" stroke-width="3" opacity=".7"/>
    <g transform="translate(21,22) scale(0.58)" stroke="#E9DFC8" fill="none" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
      <path d="M3 3 H97 L50 84.4 Z"/>
      <path d="M64 30 H42 V50"/><path d="M42 50 H58 V70"/><path d="M58 70 H46 V78"/>
    </g>
    <circle cx="50" cy="60" r="4" fill="#E9DFC8"/>
  </svg>`;
}

/* ---------- FX canvas: embers + chisel dust (§1.4) ---------- */
const FX = (() => {
  const cv = $('#fx'), cx = cv.getContext('2d');
  let parts = [], emberUntil = 0, emberTarget = { x: 0, y: 0 }, raf = 0;
  function resize(){ cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; cx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0); }
  addEventListener('resize', resize); resize();
  function tick(){
    cx.clearRect(0, 0, innerWidth, innerHeight);
    const now = performance.now();
    if (now < emberUntil && parts.length < 220){
      for (let i = 0; i < 3; i++){
        const a = Math.random() * Math.PI * 2, r = 120 + Math.random() * 260;
        parts.push({ x: emberTarget.x + Math.cos(a) * r, y: emberTarget.y + Math.sin(a) * r * .7 + 60,
                     tx: emberTarget.x, ty: emberTarget.y, life: 1, kind: 'e', s: .6 + Math.random() * .8 });
      }
    }
    parts = parts.filter(p => p.life > 0);
    for (const p of parts){
      if (p.kind === 'e'){
        p.x += (p.tx - p.x) * .045 * p.s; p.y += (p.ty - p.y) * .05 * p.s - .3;
        p.life -= .016;
        cx.fillStyle = `rgba(116,224,180,${(p.life * .8).toFixed(3)})`;
        cx.beginPath(); cx.arc(p.x, p.y, 1.6 * p.s, 0, 7); cx.fill();
      } else {
        p.x += p.vx; p.y += p.vy; p.vy += .12; p.life -= .05;
        cx.fillStyle = `rgba(210,196,168,${(p.life * .5).toFixed(3)})`;
        cx.fillRect(p.x, p.y, 2, 2);
      }
    }
    if (parts.length || performance.now() < emberUntil) raf = requestAnimationFrame(tick);
    else { raf = 0; cx.clearRect(0, 0, innerWidth, innerHeight); }
  }
  function kick(){ if (!raf) raf = requestAnimationFrame(tick); }
  return {
    embers(rect, until){ emberTarget = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }; emberUntil = until; kick(); },
    dust(x, y){ for (let i = 0; i < 14; i++) parts.push({ x, y, vx: (Math.random() - .5) * 4, vy: -Math.random() * 2.4, life: 1, kind: 'd' }); kick(); }
  };
})();

/* ---------- screens ---------- */
const screens = { legal: $('#screen-legal'), sting: $('#screen-sting'), menu: $('#screen-menu'), firstrun: $('#page-firstrun'), options: $('#page-options'), codex: $('#page-codex'), credits: $('#page-credits'), loading: $('#page-loading') };
let current = 'legal';
function show(name, instant){
  const go = () => { for (const k in screens) screens[k].classList.toggle('active', k === name); current = name; };
  if (instant){ go(); return; }
  const f = $('#fade'); f.classList.add('on');
  setTimeout(() => { go(); setTimeout(() => f.classList.remove('on'), 60); }, 260);
}

/* ---------- boot: legal → sting ---------- */
let legalDone = false;
function leaveLegal(){
  if (legalDone) return; legalDone = true;
  DelveAudio.init();
  show('sting');
  setTimeout(startSting, 80);
}
$('#screen-legal').addEventListener('pointerdown', leaveLegal);
addEventListener('keydown', e => { if (current === 'legal' && !e.repeat) leaveLegal(); });

/* ---------- logo sting timeline (§1.4) ---------- */
let stingT0 = 0, stingDone = false;
const holdAt = P.get('t') ? +P.get('t') : 0;
const fired = {};
function startSting(){
  stingT0 = performance.now();
  DelveAudio.sting();
  requestAnimationFrame(stingTick);
}
function stingTick(){
  let el = performance.now() - stingT0;
  if (holdAt) el = Math.min(el, holdAt);
  const at = (ms, fn) => { if (el >= ms && !fired[ms]){ fired[ms] = 1; fn(); } };
  at(800, () => { $('#sting-emblem').classList.add('reveal');
                  const r = $('#sting-emblem').getBoundingClientRect(); FX.embers(r, performance.now() + 1200); });
  at(1900, () => $('#pipflash').classList.add('go'));
  at(2000, () => $('#sting-word').classList.add('wipe'));
  for (let i = 0; i < 5; i++) at(2000 + i * 200, () => {
    const r = $('#sting-word img').getBoundingClientRect();
    FX.dust(r.x + r.width * (i + .5) / 5, r.y + r.height * .85);
  });
  at(3000, () => { $('#sting-sub').classList.add('in'); $('#sting-word').classList.add('sweep'); });
  at(4000, () => { if (!holdAt) gotoMenu(); });
  if (!holdAt || el < holdAt) requestAnimationFrame(stingTick);
}
function skipSting(){ if (current === 'sting' && performance.now() - stingT0 > 1500 && !stingDone) gotoMenu(); }
addEventListener('keydown', skipSting);
addEventListener('pointerdown', skipSting);

/* ---------- main menu ---------- */
const items = $$('.mitem');
let sel = 0;
function updateContinue(){
  const c = $('#mi-continue');
  c.classList.toggle('dim', !save);
  c.setAttribute('aria-disabled', save ? 'false' : 'true');
}
function select(i, silent){
  if (i === sel && !silent) return;
  sel = i;
  items.forEach((b, k) => b.classList.toggle('sel', k === i));
  if (!silent) DelveAudio.play('move', .8);
  if (save && i === 1) DelveAudio.menuVariant(true); else DelveAudio.menuVariant(false);
}
function tipShow(){
  if (save) return;
  const tip = $('#menu-tip'), r = $('#mi-continue').getBoundingClientRect();
  tip.textContent = STR.MENU_NOSAVE; tip.hidden = false;
  tip.style.left = (r.right + 18) + 'px';
  tip.style.top = (r.top + r.height / 2 - 16) + 'px';
}
function tipHide(){ $('#menu-tip').hidden = true; }
items.forEach((b, i) => {
  b.addEventListener('mouseenter', () => { select(i); if (i === 1) tipShow(); });
  b.addEventListener('mouseleave', tipHide);
  b.addEventListener('focus', () => { select(i); if (i === 1) tipShow(); });
  b.addEventListener('blur', tipHide);
  b.addEventListener('click', () => activate(i));
});
function emblemFlicker(){
  const e = $('#menu-emblem'); e.classList.remove('flicker'); void e.offsetWidth; e.classList.add('flicker');
}
function activate(i){
  DelveAudio.play('confirm', .9); emblemFlicker();
  if (i === 0){ save ? openNew() : show('firstrun'); }
  else if (i === 1){ if (save) startLoad('yrd', 'menu'); else { DelveAudio.play('deny', .9); tipShow(); setTimeout(tipHide, 1600); } }
  else if (i === 2){ syncOptionsUI(); show('options'); }
  else if (i === 3){ openCodex(); }
  else if (i === 4){ openCredits(); }
  else openStub(i);
}
addEventListener('keydown', e => {
  if (current !== 'menu') return;
  if (e.key === 'ArrowDown' || e.key === 's'){ select((sel + 1) % items.length); e.preventDefault(); }
  else if (e.key === 'ArrowUp' || e.key === 'w'){ select((sel - 1 + items.length) % items.length); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === ' '){ if (document.activeElement && document.activeElement.classList.contains('mitem')) return; activate(sel); e.preventDefault(); }
  else if (e.code === Opt.get('binds.codex') && !e.repeat){ openCodex(); e.preventDefault(); }
});
function gotoMenu(instant){
  stingDone = true;
  const m = $('#screen-menu'); m.classList.remove('live-in'); void m.offsetWidth; m.classList.add('live-in');
  show('menu', instant);
  $('#bg').classList.add('live');
  updateContinue(); select(0, true);
  $('#menu-br').textContent = 'DELVE v1.6.0-shell · fan work · 2026-09-19';
  DelveAudio.startMenu(); DelveAudio.ambStart();
}

/* ---------- overlays: new contract / stubs / end card ---------- */
function openNew(){
  $('#new-body').textContent = STR.NEW_BODY
    .replace('{0}', save.slot).replace('{1}', save.cls).replace('{2}', 'Level ' + save.lvl).replace('{3}', save.chap);
  $('#modal-new').hidden = false; $('#new-begin').focus();
}
$('#new-begin').addEventListener('click', () => { DelveAudio.play('confirm', .9); $('#modal-new').hidden = true; syncFirstRunUI(); show('firstrun'); });
$('#new-back').addEventListener('click', () => { DelveAudio.play('back', .8); $('#modal-new').hidden = true; });

const STUBS = {};
function openStub(i){
  $('#stub-title').textContent = STUBS[i][0];
  $('#stub-body').textContent = STUBS[i][1];
  $('#modal-stub').hidden = false; $('#stub-back').focus();
}
$('#stub-back').addEventListener('click', () => { DelveAudio.play('back', .8); $('#modal-stub').hidden = true; });

function openEnd(mode){
  const name = (save && save.name) || 'Recruit';
  $('#end-seal').innerHTML = sealSVG();
  $('#end-title').textContent = mode === 'signed' ? STR.END_SIGNED_T : STR.END_RESUME_T;
  $('#end-body').textContent = (mode === 'signed' ? STR.END_SIGNED_B : STR.END_RESUME_B).replace('{0}', name);
  $('#end-settings').textContent =
    `Difficulty ${Opt.get('play.diff')} · Pacing ${Opt.get('play.combat')} · Subtitles ${Opt.get('acc.subs')} · Motion ${Opt.get('cam.reduced') === 'On' ? 'Reduced motion' : 'Standard'}`;
  DelveAudio.play('stamp', 1);
  $('#modal-end').hidden = false; $('#end-back').focus();
}
$('#end-back').addEventListener('click', () => { DelveAudio.play('back', .8); $('#modal-end').hidden = true; updateContinue(); });

function writeSave(){
  save = { slot: 'Contract I', name: 'Recruit', cls: 'Recruit', lvl: 1, chap: 'Prologue', ts: Date.now() };
  storeSave(save); updateContinue();
}

/* ---------- first run (§2.4.2) — writes into the shared options store ---------- */
const FR_MAP = { 'fr-diff': 'play.diff', 'fr-pace': 'play.combat', 'fr-subs': 'acc.subs', 'fr-comfort': 'fr-comfort' };
function wireGroup(groupId, key){
  const box = document.getElementById(groupId);
  box.querySelectorAll('.opt').forEach(op => {
    op.addEventListener('click', () => {
      box.querySelectorAll('.opt').forEach(o => o.setAttribute('aria-checked', 'false'));
      op.setAttribute('aria-checked', 'true');
      if (key === 'fr-comfort') Opt.set('cam.reduced', op.dataset.v === 'Reduced motion' ? 'On' : 'Off');
      else Opt.set(key, op.dataset.v);
      DelveAudio.play('move', .7);
    });
  });
}
for (const gid in FR_MAP) wireGroup(gid, FR_MAP[gid]);
function setGroupUI(groupId, value){
  const box = document.getElementById(groupId);
  box.querySelectorAll('.opt').forEach(o => o.setAttribute('aria-checked', String(o.dataset.v === value)));
}
function syncFirstRunUI(){
  setGroupUI('fr-diff', Opt.get('play.diff'));
  setGroupUI('fr-pace', Opt.get('play.combat'));
  setGroupUI('fr-subs', Opt.get('acc.subs'));
  setGroupUI('fr-comfort', Opt.get('cam.reduced') === 'On' ? 'Reduced motion' : 'Standard');
}
$('#fr-go').addEventListener('click', () => { DelveAudio.play('stamp', .9); writeSave(); startLoad('yrd', 'menu'); });
$('#fr-back').addEventListener('click', () => { DelveAudio.play('back', .8); show('menu'); });

/* ---------- OPTIONS PAGE (§2.5) ---------- */
$$('.rbtn').forEach(b => b.addEventListener('click', () => {
  $$('.rbtn').forEach(x => x.classList.toggle('on', x === b));
  $$('.osec').forEach(s => s.classList.toggle('on', s.id === 'sec-' + b.dataset.sec));
  DelveAudio.play('page', .6);
}));
/* segmented controls (value = data-v or visible label) */
const optVal = o => o.dataset.v !== undefined ? o.dataset.v : o.textContent.trim();
$$('.opts[data-key]').forEach(box => {
  const key = box.dataset.key;
  box.querySelectorAll('.opt').forEach(op => {
    op.addEventListener('click', () => {
      if (op.dataset.locked){ DelveAudio.play('deny', .9); return; }
      box.querySelectorAll('.opt').forEach(o => o.setAttribute('aria-checked', 'false'));
      op.setAttribute('aria-checked', 'true');
      Opt.set(key, optVal(op));
      DelveAudio.play('move', .7);
    });
  });
});
/* sliders */
const setFill = sl => { const mn = +sl.min || 0, mx = +sl.max || 100; sl.style.setProperty('--fill', (((+sl.value - mn) / (mx - mn)) * 100).toFixed(1) + '%'); };
$$('input[type="range"][data-key]').forEach(sl => {
  const out = document.querySelector(`output[data-for="${sl.dataset.key}"]`);
  const fmt = v => sl.dataset.unit === 'm' ? (+v).toFixed(1) + ' m' : sl.dataset.unit === '%' ? v + '%' : v;
  sl.addEventListener('input', () => { if (out) out.textContent = fmt(sl.value); Opt.set(sl.dataset.key, +sl.value); setFill(sl); });
});
/* keybinds */
const KEY_LABEL = c => ({ Space: 'Space', Escape: 'Esc', Tab: 'Tab', ShiftLeft: 'L-Shift', ShiftRight: 'R-Shift' }[c] || (c || '').replace('Key', '').replace('Digit', '').replace('Arrow', '↑↓←→→') || c);
let listening = null;
$$('.keycap[data-bind]').forEach(kc => {
  kc.addEventListener('click', () => {
    if (listening) stopListen(true);
    listening = kc; kc.classList.add('listening'); kc.textContent = 'PRESS A KEY';
  });
});
function stopListen(commit, code){
  if (!listening) return;
  if (commit && code){ Opt.set('binds.' + listening.dataset.bind, code); }
  listening.classList.remove('listening');
  listening = null;
  syncBindsUI();
}
function syncBindsUI(){
  $$('.keycap[data-bind]').forEach(kc => { if (kc !== listening) kc.textContent = KEY_LABEL(Opt.get('binds.' + kc.dataset.bind)); });
}
addEventListener('keydown', e => {
  if (listening){ e.preventDefault(); e.stopPropagation(); if (e.code !== 'Escape') stopListen(true, e.code); else stopListen(false); return; }
}, true);
$('#opt-reset-binds').addEventListener('click', () => { Opt.resetBinds(); syncBindsUI(); DelveAudio.play('confirm', .8); });
/* pad swap */
$$('#sec-controls .opts[data-key="pad"] .opt').forEach(op => op.addEventListener('click', () => {
  $$('#sec-controls .opts[data-key="pad"] .opt').forEach(o => o.setAttribute('aria-checked', String(o === op)));
}));
function syncOptionsUI(){
  $$('.opts[data-key]').forEach(box => {
    const v = Opt.get(box.dataset.key);
    box.querySelectorAll('.opt').forEach(o => o.setAttribute('aria-checked', String(optVal(o) === String(v))));
  });
  $$('input[type="range"][data-key]').forEach(sl => {
    sl.value = Opt.get(sl.dataset.key);
    const out = document.querySelector(`output[data-for="${sl.dataset.key}"]`);
    if (out) out.textContent = sl.dataset.unit === 'm' ? (+sl.value).toFixed(1) + ' m' : sl.dataset.unit === '%' ? sl.value + '%' : sl.value;
    setFill(sl);
  });
  syncBindsUI();
  setGroupUI('fr-diff', Opt.get('play.diff'));
  setGroupUI('fr-pace', Opt.get('play.combat'));
  setGroupUI('fr-subs', Opt.get('acc.subs'));
  setGroupUI('fr-comfort', Opt.get('cam.reduced') === 'On' ? 'Reduced motion' : 'Standard');
}
$('#opt-back').addEventListener('click', () => { DelveAudio.play('back', .8); show('menu'); });

/* ---------- global escape ---------- */
addEventListener('keydown', e => {
  if (e.key !== 'Escape' || listening) return;
  if (!$('#modal-new').hidden){ $('#modal-new').hidden = true; return; }
  if (!$('#modal-stub').hidden){ $('#modal-stub').hidden = true; return; }
  if (!$('#modal-end').hidden){ $('#end-back').click(); return; }
  if (current === 'firstrun' || current === 'options' || current === 'codex'){ show('menu'); return; }
  if (current === 'credits'){ stopCredits(); show('menu'); return; }
  if (current === 'loading'){ quitLoad(); return; }
});

/* ---------- mute when unfocused (§2.5 Audio) ---------- */
const setMute = () => { if (Opt.get('aud.mute') === 'On') DelveAudio.setGains({ master: document.hidden ? 0 : Opt.get('aud.master') / 100 * 1.11 }); };
document.addEventListener('visibilitychange', setMute);
addEventListener('blur', setMute); addEventListener('focus', setMute);

/* ---------- gamepad (stick/d-pad support, §2.3) ---------- */
let gpPrev = [], gpAxPrev = 0;
function pollGamepad(){
  const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
  if (gp){
    const b = gp.buttons.map(x => x.pressed);
    const edge = i => b[i] && !gpPrev[i];
    const ax = gp.axes[1] || 0;
    if (current === 'menu'){
      if (edge(12) || (ax < -0.6 && gpAxPrev >= -0.6)) select((sel - 1 + items.length) % items.length);
      else if (edge(13) || (ax > 0.6 && gpAxPrev <= 0.6)) select((sel + 1) % items.length);
      if (edge(0)) activate(sel);
    } else {
      if (edge(1)){
        if (!$('#modal-new').hidden) $('#new-back').click();
        else if (!$('#modal-stub').hidden) $('#stub-back').click();
        else if (!$('#modal-end').hidden) $('#end-back').click();
        else if (current === 'firstrun' || current === 'options') show('menu');
      }
    }
    gpPrev = b; gpAxPrev = ax;
  }
  requestAnimationFrame(pollGamepad);
}
requestAnimationFrame(pollGamepad);


/* ---------- codex (§2.6): rules folio, ledger, bestiary ---------- */
const hasContract = () => !!localStorage.getItem(SAVE_KEY);
const CX_P = t => `<p>${t}</p>`;
const CX_RULES = [
{ k:'Core mechanic · PHB 2024, ch. 1', t:'The D20 Test', b:
  CX_P('When the outcome of an action is uncertain, the game uses a d20 roll to determine success or failure. These rolls are called D20 Tests, and they come in three kinds: ability checks, saving throws, and attack rolls. They follow these steps:') +
  '<ul><li><b>Roll 1d20.</b> You always want to roll high. If the roll has Advantage or Disadvantage, you roll two d20s, but you use the number from only one of them—the higher one if you have Advantage or the lower one if you have Disadvantage.</li>' +
  '<li><b>Add Modifiers.</b> The relevant ability modifier; your Proficiency Bonus if relevant; and any circumstantial bonuses or penalties from a class feature, a spell, or another rule.</li>' +
  '<li><b>Compare the Total to a Target Number.</b> If the total of the d20 and its modifiers equals or exceeds the target number, the D20 Test succeeds. Otherwise, it fails.</li></ul>' +
  CX_P('The target number for an ability check or a saving throw is called a Difficulty Class (DC). The target number for an attack roll is called an Armor Class (AC).') },
{ k:'Core mechanic · PHB 2024, ch. 1', t:'Advantage & Disadvantage', b:
  CX_P('Advantage reflects the positive circumstances surrounding a d20 roll, while Disadvantage reflects negative circumstances. You usually acquire them through the use of special abilities and actions; the DM can also decide that circumstances grant Advantage or impose Disadvantage.') +
  CX_P('<b>Roll Two D20s.</b> When a roll has either Advantage or Disadvantage, roll a second d20 when you make the roll. Use the higher of the two rolls if you have Advantage, and use the lower roll if you have Disadvantage. For example, if you have Disadvantage and roll an 18 and a 3, use the 3.') +
  CX_P('<b>They Don’t Stack.</b> If multiple situations affect a roll and they all grant Advantage on it, you still roll only two d20s. If circumstances cause a roll to have both Advantage and Disadvantage, the roll has neither of them, and you roll one d20.') },
{ k:'Combat · PHB 2024, ch. 1', t:'Attack Rolls & Armor Class', b:
  CX_P('An attack roll determines whether an attack hits a target. An attack roll hits if the roll equals or exceeds the target’s Armor Class.') +
  CX_P('A creature’s Armor Class represents how well the creature avoids being wounded in combat. All creatures start with the same base AC calculation:') +
  '<blockquote class="cx-note"><p><b>Base AC</b> = 10 + the creature’s Dexterity modifier</p></blockquote>' +
  CX_P('A creature’s AC can then be modified by armor, magic items, spells, and more. Melee weapon attacks use Strength; ranged weapon attacks use Dexterity; spell attacks use the ability determined by the spellcasting feature.') },
{ k:'Core mechanic · PHB 2024, ch. 1', t:'Ability Checks & Difficulty Classes', b:
  CX_P('An ability check represents a creature using talent and training to try to overcome a challenge, such as forcing open a stuck door, picking a lock, entertaining a crowd, or deciphering a cipher. The DM and the rules often call for an ability check when a creature attempts something other than an attack that has a chance of meaningful failure.') +
  CX_P('The Difficulty Class of an ability check represents the task’s difficulty. The more difficult the task, the higher its DC. The rules provide DCs for certain checks, but the DM ultimately sets them.') +
  '<table class="cx-table"><thead><tr><th>Task Difficulty</th><th>DC</th></tr></thead><tbody>' +
  '<tr><td>Very easy</td><td>5</td></tr><tr><td>Easy</td><td>10</td></tr><tr><td>Medium</td><td>15</td></tr>' +
  '<tr><td>Hard</td><td>20</td></tr><tr><td>Very hard</td><td>25</td></tr><tr><td>Nearly impossible</td><td>30</td></tr></tbody></table>' },
{ k:'Core mechanic · PHB 2024, ch. 1', t:'Passive Scores', b:
  CX_P('Sometimes the DM determines whether your character notices something without asking for a Wisdom (Perception) check; the DM uses your Passive Perception instead. Passive Perception is a score that reflects a general awareness of your surroundings when you’re not actively looking for something.') +
  '<blockquote class="cx-note"><p><b>Passive Perception</b> = 10 + Wisdom (Perception) check modifier</p></blockquote>' +
  CX_P('Include all modifiers that apply to your Wisdom (Perception) checks. For example, if your character has a Wisdom of 15 and proficiency in the Perception skill, you have a Passive Perception of 14 (10 + 2 for your Wisdom modifier + 2 for proficiency).') },
{ k:'Combat · PHB 2024, ch. 1', t:'Surprise', b:
  CX_P('If a combatant is surprised by combat starting, that combatant has Disadvantage on their Initiative roll. For example, if an ambusher starts combat while hidden from a foe who is unaware that combat is starting, that foe is surprised.') +
  CX_P('On the trail to Phandalin, an unseen bowstring is the whole difference between a story and a funeral. Watch the treeline.') },
{ k:'Exploration · PHB 2024, ch. 1', t:'Hiding & Unseen Foes', b:
  CX_P('Adventurers and monsters often hide, whether to spy on one another, sneak past a guardian, or set an ambush. The Dungeon Master decides when circumstances are appropriate for hiding. When you try to hide, you take the Hide action.') +
  '<blockquote class="cx-note"><p>When you make an attack roll against a target you can’t see, you have Disadvantage on the roll. When a creature can’t see you, you have Advantage on attack rolls against it. If you are hidden when you make an attack roll, you give away your location when the attack hits or misses.</p></blockquote>' },
{ k:'Combat · PHB 2024, ch. 1', t:'Cover', b:
  CX_P('Walls, trees, creatures, and other obstacles can provide cover, making a target more difficult to harm. There are three degrees of cover, each of which gives a different benefit to a target.') +
  CX_P('A target can benefit from cover only when an attack or other effect originates on the opposite side of the cover. If a target is behind multiple sources of cover, only the most protective degree of cover applies; the degrees aren’t added together.') +
  '<table class="cx-table"><thead><tr><th>Degree</th><th>Benefit to Target</th><th>Offered By…</th></tr></thead><tbody>' +
  '<tr><td>Half</td><td>+2 bonus to AC and Dex saves</td><td>Another creature or an object that covers at least half of the target</td></tr>' +
  '<tr><td>Three-Quarters</td><td>+5 bonus to AC and Dex saves</td><td>An object that covers at least three-quarters of the target</td></tr>' +
  '<tr><td>Total</td><td>Can’t be targeted directly</td><td>An object that covers the whole target</td></tr></tbody></table>' },
{ k:'Movement · PHB 2024, ch. 1', t:'Difficult Terrain', b:
  CX_P('Combatants are often slowed down by Difficult Terrain. Low furniture, rubble, undergrowth, steep stairs, snow, and shallow bogs are examples of Difficult Terrain.') +
  CX_P('Every foot of movement in Difficult Terrain costs 1 extra foot, even if multiple things in a space count as Difficult Terrain.') },
{ k:'Rules glossary · PHB 2024', t:'Conditions Glossary', b:
  CX_P('Many effects impose a condition, a temporary state that alters the recipient’s capabilities. The following conditions are defined in the rules glossary:') +
  '<ul><li>Blinded</li><li>Charmed</li><li>Deafened</li><li>Exhaustion</li><li>Frightened</li><li>Grappled</li><li>Incapacitated</li><li>Invisible</li><li>Paralyzed</li><li>Petrified</li><li>Poisoned</li><li>Prone</li><li>Restrained</li><li>Stunned</li><li>Unconscious</li></ul>' +
  '<blockquote class="cx-note"><p>Table note: conditions don’t stack — if two effects impose the same condition, the recipient has it once; and a creature reduced to 0 hit points is dying, not merely unconscious, unless a foe chose mercy (see Knocking Out a Creature).</p></blockquote>' },
{ k:'Combat · PHB 2024, ch. 1', t:'Anatomy of a Turn', b:
  CX_P('On your turn, you can move a distance up to your Speed and take one action. You decide whether to move first or take your action first.') +
  CX_P('You can communicate however you are able—through brief utterances and gestures—as you take your turn. Doing so uses neither your action nor your move. Extended communication, such as a detailed explanation or an attempt to persuade a foe, requires an action.') +
  CX_P('In Table Mode the yard bell keeps this rhythm: your turn, their turn, no arguments. In Skirmish Mode the same anatomy flows in real time, pausable at a raised hand.') },
{ k:'Combat · PHB 2024, ch. 1', t:'Reactions & Opportunity Attacks', b:
  CX_P('Certain special abilities, spells, and situations allow you to take a special action called a Reaction: an instant response to a trigger of some kind, which can occur on your turn or on someone else’s. When you take a Reaction, you can’t take another one until the start of your next turn.') +
  CX_P('You can make an Opportunity Attack when a creature that you can see leaves your reach. To make the attack, take a Reaction to make one melee attack with a weapon or an Unarmed Strike against that creature. The attack occurs right before it leaves your reach.') +
  CX_P('You can avoid provoking an Opportunity Attack by taking the Disengage action. You also don’t provoke when you Teleport or when you are moved without using your movement, action, Bonus Action, or Reaction.') },
{ k:'Recovery · PHB 2024, ch. 1', t:'Resting', b:
  CX_P('Adventurers can’t spend every hour adventuring. They need rest. Any creature can take hour-long Short Rests in the midst of a day and an 8-hour Long Rest to end it. Regaining Hit Points is one of the main benefits of a rest.') +
  CX_P('You can spend Hit Dice during a Short Rest to recover Hit Points. Temporary Hit Points last until they’re depleted or you finish a Long Rest.') },
{ k:'Mercy · PHB 2024, ch. 1', t:'Knocking Out a Creature', b:
  CX_P('When you would reduce a creature to 0 Hit Points with a melee attack, you can instead reduce the creature to 1 Hit Point and give it the Unconscious condition. It then starts a Short Rest, at the end of which that condition ends on it.') +
  CX_P('The condition ends early if the creature regains any Hit Points or if someone takes an action to administer first aid to it, making a successful DC 10 Wisdom (Medicine) check. A live prisoner answers questions; a dead one only haunts them.') },
{ k:'Weapon properties · PHB 2024, ch. 6', t:'Weapon Masteries', b:
  CX_P('Each weapon has a mastery property, usable only by a character who has a feature, such as Weapon Mastery, that unlocks the property for the character. The properties are defined below.') +
  '<dl class="cx-dl">' +
  '<dt>Cleave</dt><dd>If you hit a creature with a melee attack roll using this weapon, you can make a melee attack roll with the weapon against a second creature within 5 feet of the first that is also within your reach. On a hit, the second creature takes the weapon’s damage, but don’t add your ability modifier to that damage unless that modifier is negative. Once per turn.</dd>' +
  '<dt>Graze</dt><dd>If your attack roll with this weapon misses a creature, you can deal damage to that creature equal to the ability modifier you used to make the attack roll. This damage is the same type dealt by the weapon.</dd>' +
  '<dt>Nick</dt><dd>When you make the extra attack of the Light property, you can make it as part of the Attack action instead of as a Bonus Action. Once per turn.</dd>' +
  '<dt>Push</dt><dd>If you hit a creature with this weapon, you can push the creature up to 10 feet straight away from yourself if it is Large or smaller.</dd>' +
  '<dt>Sap</dt><dd>If you hit a creature with this weapon, that creature has Disadvantage on its next attack roll before the start of your next turn.</dd>' +
  '<dt>Slow</dt><dd>If you hit a creature with this weapon and deal damage to it, you can reduce its Speed by 10 feet until the start of your next turn.</dd>' +
  '<dt>Topple</dt><dd>If you hit a creature with this weapon, you can force it to make a Constitution saving throw (DC 8 + the ability modifier used for the attack roll + your Proficiency Bonus). On a failed save, the creature has the Prone condition.</dd>' +
  '<dt>Vex</dt><dd>If you hit a creature with this weapon and deal damage to it, you have Advantage on your next attack roll against that creature before the end of your next turn.</dd>' +
  '</dl>' },
];
const CX_LORE = [
{ k:'Prologue · earned at signing', t:'The Rockseeker Contract', b:
  CX_P('Three lines of ink and a wax seal: escort the supplies, report the road, ask no wages beyond the dwarf’s promise. Gundren Rockseeker signs without hesitation, which tells you either that the road is safe or that he needs you badly enough to pretend it is.') +
  CX_P('Contracts of this kind are the oldest magic in the Sword Coast. Nothing is enchanted about them; and still, once signed, they pull a body south like a hook in the lip.') },
{ k:'Prologue · earned at signing', t:'The Muster-Yard at Dawn', b:
  CX_P('Neverwinter keeps its training yard between the wall and the water: five straw dummies in a row, a bell that counts the watch, gulls arguing over the fish market. Every blade in the city learned its first cut here, including yours.') +
  CX_P('The yardmaster’s rule is written over the gate in chipped paint: <i>slow is smooth, smooth is fast.</i> The dummies have never disagreed.') },
];
const CX_TABS = {
  rules: ['Rules of Engagement', 'Player’s Handbook 2024 · verbatim excerpts'],
  lore:  ['The Ledger', 'lore earns itself in play'],
  best:  ['Bestiary', 'catalogued on first encounter'],
};
const CX_EMPTY_SVG = '<svg viewBox="0 0 72 72" fill="none" stroke="#7a5428" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 14h34a6 6 0 0 1 6 6v38H22a6 6 0 0 1-6-6Z"/><path d="M16 14a6 6 0 0 0-6 6v32a6 6 0 0 0 6 6"/><path d="M46 14v44"/><circle cx="51" cy="36" r="4.5"/><path d="M51 40.5v6M28 26h10M28 33h10"/></svg>';
function codexEntries(tab){
  if (tab === 'rules') return CX_RULES;
  if (tab === 'lore') return hasContract() ? CX_LORE : [];
  return [];
}
function renderCodex(tab){
  const f = $('#codex-folio');
  const meta = CX_TABS[tab];
  const list = codexEntries(tab);
  let html = `<div class="cfol-head"><h3>${meta[0]}</h3><span class="cfol-sub">${meta[1]}</span><div class="rule"><i></i></div></div><div class="cfol-inner">`;
  if (!list.length){
    const str = tab === 'lore' ? STR.CODEX_LORE_EMPTY : STR.CODEX_BEST_EMPTY;
    const help = tab === 'lore'
      ? 'Sign the Rockseeker Contract and walk the road; the ledger fills as you learn.'
      : 'Creatures are catalogued the first time you meet them in play.';
    html += `<div class="cx-empty">${CX_EMPTY_SVG}<p class="cx-empty-str">${str}</p><p class="cx-empty-help">${help}</p></div>`;
  } else {
    list.forEach((en, i) => {
      html += `<article class="cx-entry" style="animation-delay:${Math.min(i * 45, 400)}ms"><span class="cx-kick">${en.k}</span><h4>${en.t}</h4>${en.b}</article>`;
    });
  }
  f.innerHTML = html + '</div>';
  f.scrollTop = 0;
  $('#cx-count-rules').textContent = CX_RULES.length;
  $('#cx-count-lore').textContent = hasContract() ? CX_LORE.length : 0;
  $('#cx-count-best').textContent = 0;
}
let cxTab = 'rules';
function syncCodexTabs(){ $$('.ctab').forEach(t => t.classList.toggle('on', t.dataset.tab === cxTab)); }
function openCodex(instant){ syncCodexTabs(); renderCodex(cxTab); show('codex', instant); }
$$('.ctab').forEach(t => t.addEventListener('click', () => {
  if (t.dataset.tab === cxTab) return;
  cxTab = t.dataset.tab; syncCodexTabs();
  const f = $('#codex-folio'); f.classList.remove('turning'); void f.offsetWidth; f.classList.add('turning');
  DelveAudio.play('page', .7);
  renderCodex(cxTab);
}));
$('#cx-back').addEventListener('click', () => { DelveAudio.play('back', .8); show('menu'); });


/* ---------- credits crawl (§2.7): 60 px/s, hold to hasten ×3 ---------- */
let credRaf = 0, credPos = 0, credMult = 1, credLast = 0, credDone = false;
const credEndAt = () => { const st = $('#cred-stage'), sc = $('#cred-scroll'); return st.clientHeight + sc.scrollHeight - st.clientHeight * .5; };
function credTick(now){
  const dt = Math.min((now - credLast) / 1000, .1); credLast = now;
  const sc = $('#cred-scroll'), st = $('#cred-stage');
  credPos += 60 * credMult * dt;
  const endAt = credEndAt();
  if (credPos >= endAt){ sc.style.transform = `translate(-50%, ${st.clientHeight - endAt}px)`; finishCredits(); return; }
  sc.style.transform = `translate(-50%, ${st.clientHeight - credPos}px)`;
  credRaf = requestAnimationFrame(credTick);
}
function finishCredits(){
  credDone = true; cancelAnimationFrame(credRaf);
  $('#cred-end').hidden = false; DelveAudio.play('stamp', .9);
}
function stopCredits(){ cancelAnimationFrame(credRaf); credMult = 1; document.querySelector('#page-credits').classList.remove('holding'); }
function openCredits(instant){
  stopCredits(); credDone = false; credPos = 0;
  $('#cred-end').hidden = true;
  show('credits', instant);
  const sc = $('#cred-scroll'), st = $('#cred-stage');
  sc.style.transform = `translate(-50%, ${st.clientHeight}px)`;
  credLast = performance.now();
  cancelAnimationFrame(credRaf); credRaf = requestAnimationFrame(credTick);
}
const credStage = $('#cred-stage');
credStage.addEventListener('pointerdown', () => { if (!credDone){ credMult = 3; credStage.parentElement.classList.add('holding'); } });
addEventListener('pointerup', () => { credMult = 1; document.querySelector('#page-credits').classList.remove('holding'); });
credStage.addEventListener('wheel', e => {
  if (credDone) return;
  e.preventDefault();
  credPos = Math.max(0, Math.min(credPos + e.deltaY, credEndAt()));
}, { passive: false });
addEventListener('keydown', e => { if (current === 'credits' && !credDone && (e.code === 'Space' || e.code === 'ShiftLeft') && !e.repeat){ credMult = 3; document.querySelector('#page-credits').classList.add('holding'); } });
addEventListener('keyup', e => { if (e.code === 'Space' || e.code === 'ShiftLeft'){ credMult = 1; document.querySelector('#page-credits').classList.remove('holding'); } });
$('#cred-back').addEventListener('click', () => { DelveAudio.play('back', .8); stopCredits(); show('menu'); });


/* ---------- loading screen (§3): ink-drawn map, real weighted progress ---------- */
const LD_TIPS = [
  'Goblins fight to the death until only one remains — and that one runs. Catch it, and the trail is yours.',
  'Half cover adds +2 to AC and Dexterity saves; three-quarters cover adds +5. Shoot through thickets at your peril.',
  'A surprised creature skips its first turn entirely. Stealth is a weapon — spend it well.',
  'Weapon masteries: Push shoves 10 feet. Topple knocks Prone. Vex grants Advantage on your next hit. Learn their manners.',
  'Falling Prone costs half your Speed to stand, and attacks from Prone have Disadvantage. Mind the fire pit.',
  'You can knock a creature unconscious instead of killing it with any bludgeoning hit that would drop it — prisoners talk.',
  'High ground grants Advantage on ranged attacks; low ground imposes Disadvantage. The archery loft exists for a reason.',
  'Reactions refresh at the start of YOUR turn, not the round’s. Budget them like coins.',
  'Difficult terrain costs double movement. Briars, rubble and knee-deep streams all bite.',
  'A short rest lets you spend Hit Dice to heal. A long rest returns everything — if the place is safe. The cave mouth is not.',
  'Darkvision is not daylight: beyond 60 feet even dwarves guess. Carry a lantern, or carry a wizard.',
  'Hiding beats passive Perception, not eyes: break line of sight first, then roll.',
  'Concentration breaks on damage unless you pass a Constitution save. Protect your casters’ focus.',
  'The die is the truth: every roll in DELVE is a real d20 simulation. Watch the dice theatre — it never lies.',
  'Press V to see the world through your hero’s own eyes. Press it again to shoulder the camera back.',
  'Turn-based is the intended rhythm. Skirmish Mode waits in Options for the impatient.',
];
const LD = { raf: 0, real: 0, shown: 0, t0: 0, done: false, dest: 'menu', title: 'yrd',
  tipI: -1, tipTimer: 0, slowTimer: 0, slow: false, len: 0, failNext: false };
function ldSetTip(i){
  const el = $('#ld-tip');
  el.classList.add('fade');
  setTimeout(() => { $('#ld-tip-text').textContent = LD_TIPS[i]; el.classList.remove('fade'); }, 400);
}
function ldNextTip(){ LD.tipI = (LD.tipI + 1) % LD_TIPS.length; ldSetTip(LD.tipI); }
function ldSlowTip(){
  if (LD.slow) return; LD.slow = true;
  clearInterval(LD.tipTimer);
  const el = $('#ld-tip');
  el.classList.add('fade');
  setTimeout(() => { $('#ld-tip-text').textContent = STR.LOAD_SLOW; el.classList.remove('fade'); }, 400);
}
function ldTasks(){
  const imgs = ['yard_dawn_panorama.png', 'parchment.jpg', 'logo_wordmark.png', 'logo_emblem.png', 'sword_coast_map.png'];
  const tasks = imgs.map((n, k) => ({ w: 70 / imgs.length, id: n, run: () =>
    fetch('assets/img/' + n).then(r => { if (!r.ok) throw new Error(n); return r.blob(); })
      .then(b => (window.createImageBitmap ? createImageBitmap(b) : b)) }));
  tasks.push({ w: 20, id: 'typefaces', run: () => (document.fonts ? document.fonts.ready : Promise.resolve()) });
  tasks.push({ w: 10, id: 'rules-grid', run: () => new Promise(res => {
    Opt.get('play.diff'); void document.querySelector('#screen-menu').offsetHeight;
    requestAnimationFrame(() => requestAnimationFrame(res)); }) });
  return tasks;
}
function ldTick(now){
  const dt = Math.min((now - (LD.last || now)) / 1000, .1); LD.last = now;
  LD.shown = Math.max(LD.shown, LD.shown + (LD.real - LD.shown) * Math.min(1, dt * 3.4));
  const p = Math.min(LD.shown, 1);
  $('#ld-pct').textContent = Math.floor(p * 100);
  if (LD.len){ const path = $('#ld-path'); path.style.strokeDashoffset = LD.len * (1 - p);
    const pt = path.getPointAtLength(p * LD.len); const nib = $('#ld-nib');
    nib.setAttribute('cx', pt.x); nib.setAttribute('cy', pt.y); nib.style.opacity = p > .004 && p < .996 ? 1 : 0; }
  const pips = $$('#ld-sealwrap .ld-pips i');
  [ .33, .66, .995 ].forEach((t, i) => pips[i].classList.toggle('lit', p >= t));
  const elapsed = now - LD.t0;
  if (LD.real >= 1 && LD.shown >= .999 && elapsed >= 1200){ ldComplete(); return; }
  LD.raf = requestAnimationFrame(ldTick);
}
function ldComplete(){
  LD.done = true; cancelAnimationFrame(LD.raf); clearInterval(LD.tipTimer); clearTimeout(LD.slowTimer);
  $('#ld-pct').textContent = '100';
  $$('#ld-sealwrap .ld-pips i').forEach(i => i.classList.add('lit'));
  $('#ld-sealwrap').classList.add('stamped');
  DelveAudio.play('stamp', 1);
  setTimeout(() => {
    const f = $('#fade'); f.classList.add('slow', 'on');
    setTimeout(() => { show(LD.dest, true); f.classList.remove('on'); setTimeout(() => f.classList.remove('slow'), 80); }, 620);
  }, 500);
}
function ldError(id){
  cancelAnimationFrame(LD.raf); clearInterval(LD.tipTimer); clearTimeout(LD.slowTimer);
  $('#ld-tip').style.display = 'none';
  $('#ld-err-text').textContent = STR.LOAD_ERR.replace('{0}', id);
  $('#ld-retry').textContent = STR.RETRY; $('#ld-quit').textContent = STR.QUIT_MENU;
  $('#ld-err').hidden = false;
  DelveAudio.play('deny', .9);
}
function quitLoad(){
  cancelAnimationFrame(LD.raf); clearInterval(LD.tipTimer); clearTimeout(LD.slowTimer);
  LD.done = true; show('menu');
}
function startLoad(title, dest){
  cancelAnimationFrame(LD.raf); clearInterval(LD.tipTimer); clearTimeout(LD.slowTimer);
  Object.assign(LD, { real: 0, shown: 0, done: false, dest: dest || 'menu', title: title || 'yrd',
    tipI: -1, slow: false, last: 0 });
  $('#ld-title').textContent = title === 'ch1' ? STR.LOAD_TITLE_CH1 : STR.LOAD_TITLE_YRD;
  $('#ld-err').hidden = true; $('#ld-tip').style.display = '';
  $('#ld-sealwrap').classList.remove('stamped');
  $$('#ld-sealwrap .ld-pips i').forEach(i => i.classList.remove('lit'));
  $('#ld-pct').textContent = '0';
  const path = $('#ld-path'); LD.len = path.getTotalLength();
  path.style.strokeDasharray = LD.len; path.style.strokeDashoffset = LD.len;
  show('loading', true);
  LD.t0 = performance.now();
  $('#ld-tip-text').textContent = LD_TIPS[0]; LD.tipI = 0;
  LD.tipTimer = setInterval(ldNextTip, 5000);
  LD.slowTimer = setTimeout(ldSlowTip, 45000);
  let doneW = 0;
  ldTasks().forEach(t => {
    const run = () => (LD.failNext && t.id.endsWith('.png') ? (LD.failNext = false, Promise.reject(new Error(t.id))) : t.run());
    run().then(() => { if (LD.done) return; doneW += t.w; LD.real = Math.min(1, doneW / 100); })
         .catch(() => { if (!LD.done) ldError(t.id); });
  });
  LD.raf = requestAnimationFrame(ldTick);
}
$('#ld-retry').addEventListener('click', () => { DelveAudio.play('confirm', .9); startLoad(LD.title, LD.dest); });
$('#ld-quit').addEventListener('click', () => { DelveAudio.play('back', .8); quitLoad(); });
window.DelveLoad = { start: startLoad, failNext: () => { LD.failNext = true; }, slow: ldSlowTip, nextTip: ldNextTip };

/* ---------- boot ---------- */
document.querySelectorAll('[data-seal]').forEach(el => { el.innerHTML = sealSVG(); });
if (P.get('still') === '1') document.body.classList.add('still');
apply(null);
syncOptionsUI();

switch (P.get('s')){
  case 'sting': show('sting', true); setTimeout(startSting, 50); break;
  case 'menu': gotoMenu(); break;
  case 'new': gotoMenu(); openNew(); break;
  case 'firstrun': gotoMenu(true); syncFirstRunUI(); show('firstrun', true); break;
  case 'options': gotoMenu(true); syncOptionsUI(); show('options', true); break;
  case 'codex': gotoMenu(true); openCodex(true); break;
  case 'credits': gotoMenu(true); openCredits(true); break;
  case 'load': gotoMenu(true); startLoad('yrd', 'menu'); break;
  case 'load1': gotoMenu(true); startLoad('ch1', 'menu'); break;
  case 'end': gotoMenu(); openEnd('signed'); break;
  case 'stub3': gotoMenu(); openStub(3); break;
  case 'stub4': gotoMenu(); openStub(4); break;
  default: break;
}
})();
