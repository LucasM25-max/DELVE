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
  STUB_CREDITS: 'The credits scroll awaits the full build.',
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
const screens = { legal: $('#screen-legal'), sting: $('#screen-sting'), menu: $('#screen-menu'), firstrun: $('#page-firstrun'), options: $('#page-options') };
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
  else if (i === 1){ if (save) openEnd('resume'); else { DelveAudio.play('deny', .9); tipShow(); setTimeout(tipHide, 1600); } }
  else if (i === 2){ syncOptionsUI(); show('options'); }
  else openStub(i);
}
addEventListener('keydown', e => {
  if (current !== 'menu') return;
  if (e.key === 'ArrowDown' || e.key === 's'){ select((sel + 1) % items.length); e.preventDefault(); }
  else if (e.key === 'ArrowUp' || e.key === 'w'){ select((sel - 1 + items.length) % items.length); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === ' '){ if (document.activeElement && document.activeElement.classList.contains('mitem')) return; activate(sel); e.preventDefault(); }
});
function gotoMenu(instant){
  stingDone = true;
  const m = $('#screen-menu'); m.classList.remove('live-in'); void m.offsetWidth; m.classList.add('live-in');
  show('menu', instant);
  $('#bg').classList.add('live');
  updateContinue(); select(0, true);
  $('#menu-br').textContent = 'DELVE v1.2.0-shell · fan work · 2026-09-19';
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

const STUBS = { 3: ['CODEX', STR.STUB_CODEX], 4: ['CREDITS', STR.STUB_CREDITS] };
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
$('#fr-go').addEventListener('click', () => {
  save = { slot: 'Contract I', name: 'Recruit', cls: 'Recruit', lvl: 1, chap: 'Prologue', ts: Date.now() };
  storeSave(save);
  show('menu', true);
  openEnd('signed');
});
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
$$('input[type="range"][data-key]').forEach(sl => {
  const out = document.querySelector(`output[data-for="${sl.dataset.key}"]`);
  const fmt = v => sl.dataset.unit === 'm' ? (+v).toFixed(1) + ' m' : sl.dataset.unit === '%' ? v + '%' : v;
  sl.addEventListener('input', () => { if (out) out.textContent = fmt(sl.value); Opt.set(sl.dataset.key, +sl.value); });
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
  if (current === 'firstrun' || current === 'options'){ show('menu'); return; }
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
  case 'end': gotoMenu(); openEnd('signed'); break;
  case 'stub3': gotoMenu(); openStub(3); break;
  case 'stub4': gotoMenu(); openStub(4); break;
  default: break;
}
})();
