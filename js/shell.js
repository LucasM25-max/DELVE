/* ==========================================================================
   DELVE — web shell state machine (GDD-02 §1.4, §2.1–2.4, §2.8, §4).
   Boot: legal → logo sting → main menu. PLAY → First Run → signed end card.
   Excluded from this build (per product decision): options tree, codex
   contents, credits scroll, loading screen — stubbed gracefully.
   Test hooks: ?s=legal|sting|menu|new|firstrun|end|stub2|stub3|stub4
              ?save=1  ?still=1  ?rm=1  ?t=<ms hold sting>
   ========================================================================== */
'use strict';
(() => {
const $ = s => document.querySelector(s);
const P = new URLSearchParams(location.search);

/* ---------- §4 string master (strings used by this build; loading strings
   retained as comments for the full build) ---------- */
const STR = {
  MENU_PLAY: 'PLAY', MENU_CONTINUE: 'CONTINUE', MENU_OPTIONS: 'OPTIONS',
  MENU_CODEX: 'CODEX', MENU_CREDITS: 'CREDITS',
  MENU_NOSAVE: 'No contracts signed yet.',
  NEW_TITLE: 'Begin a new contract?',
  NEW_BODY: 'A signed contract already exists: "{0} — {1}, {2}, {3}". Starting anew will not erase it; up to 8 contracts may rest in the ledger.',
  NEW_BEGIN: 'BEGIN NEW', BACK: 'BACK',
  FR_TITLE: 'Sign the contract', FR_GO: 'SIGN & DESCEND',
  // STR_LOAD_TITLE_YRD / STR_LOAD_TITLE_CH1 / STR_LOAD_ERR / STR_LOAD_SLOW /
  // STR_RETRY / STR_QUIT_MENU — loading screen not in this build.
  STR_CODEX_LORE_EMPTY: 'The ledger is blank. Lore earns itself.',
  STR_CODEX_BEST_EMPTY: 'No creatures catalogued yet.',
  STUB_OPTIONS: 'The options ledger is sealed in this build.',
  STUB_CODEX: 'The codex awaits the full build.',
  STUB_CREDITS: 'The credits scroll awaits the full build.',
  END_SIGNED_T: 'CONTRACT SIGNED',
  END_SIGNED_B: 'The wax is set, {0}. The yard gate opens in the full build — this shell ends at the threshold.',
  END_RESUME_T: 'CONTRACT RESTORED',
  END_RESUME_B: 'Your contract rests safely in the ledger, {0}. The yard gate opens in the full build.',
  END_BACK: 'RETURN TO MENU'
};

/* ---------- save (localStorage, persists across sessions) ---------- */
const SAVE_KEY = 'delve.contract.v1';
function loadSave(){ try { const r = localStorage.getItem(SAVE_KEY); return r ? JSON.parse(r) : null; } catch (e) { return null; } }
function storeSave(s){ try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) {} }
let save = loadSave();
if (P.get('save') === '1' && !save){
  save = { slot: 'Contract I', name: 'Recruit', cls: 'Recruit', lvl: 1, chap: 'Prologue',
           settings: { diff: 'Balanced', pace: 'Table Mode (turn-based)', subs: 'On', comfort: 'Standard' }, ts: Date.now() };
  storeSave(save);
}
const pending = { diff: 'Balanced', pace: 'Table Mode (turn-based)', subs: 'On', comfort: 'Standard' };

/* ---------- emblem / seal SVG (GDD-02 §1.3, §1.5) ---------- */
function emblemSVG(settled){
  return `<svg viewBox="0 0 100 92" role="img" aria-label="Delve emblem" class="${settled ? 'settled' : ''}">
    <path class="emblem-outline${settled ? ' draw' : ''}" pathLength="1" d="M3 3 H97 L50 84.4 Z"/>
    <path class="emblem-step s1${settled ? ' lit-s' : ''}" pathLength="1" d="M64 30 H42 V50"/>
    <path class="emblem-step s2${settled ? ' lit-s' : ''}" pathLength="1" d="M42 50 H58 V70"/>
    <path class="emblem-step s3${settled ? ' lit-s' : ''}" pathLength="1" d="M58 70 H46 V78"/>
    <circle class="emblem-pip" cx="50" cy="60" r="5"/>
  </svg>`;
}
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

/* ---------- screen helper ---------- */
const screens = { legal: $('#screen-legal'), sting: $('#screen-sting'), menu: $('#screen-menu'), firstrun: $('#page-firstrun') };
let current = 'legal';
function show(name, instant){
  const go = () => {
    for (const k in screens) screens[k].classList.toggle('active', k === name);
    current = name;
  };
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
let stingT0 = 0, stingRaf = 0, stingDone = false, holdAt = P.get('t') ? +P.get('t') : 0;
const fired = {};
function startSting(){
  $('#sting-emblem').innerHTML = emblemSVG(false);
  stingT0 = performance.now();
  DelveAudio.sting();
  stingRaf = requestAnimationFrame(stingTick);
}
function stingTick(){
  let el = performance.now() - stingT0;
  if (holdAt) el = Math.min(el, holdAt);
  const at = (ms, fn) => { if (el >= ms && !fired[ms]){ fired[ms] = 1; fn(); } };
  at(800, () => { const o = document.querySelector('#sting-emblem .emblem-outline'); if (o) o.classList.add('draw');
                  const r = $('#sting-emblem').getBoundingClientRect(); FX.embers(r, performance.now() + 1200); });
  at(1000, () => lightStep('.s1')); at(1350, () => lightStep('.s2')); at(1700, () => lightStep('.s3'));
  at(1900, () => { const p = document.querySelector('#sting-emblem .emblem-pip'); if (p) p.classList.add('lit'); });
  const letters = document.querySelectorAll('#sting-word span');
  letters.forEach((sp, i) => at(2000 + i * 200, () => {
    sp.classList.add('in');
    const r = sp.getBoundingClientRect(); FX.dust(r.x + r.width / 2, r.y + r.height * .8);
  }));
  at(3000, () => { $('#sting-sub').classList.add('in'); $('#sting-word').classList.add('sweep'); });
  at(4000, () => { if (!holdAt) gotoMenu(); });
  if (!holdAt || el < holdAt) stingRaf = requestAnimationFrame(stingTick);
}
function lightStep(sel){ const s = document.querySelector('#sting-emblem ' + sel); if (s) s.classList.add('lit'); }
function skipSting(){
  const el = performance.now() - stingT0;
  if (current === 'sting' && el > 1500 && !stingDone){ gotoMenu(); }   // skippable after 1.5 s
}
addEventListener('keydown', skipSting);
addEventListener('pointerdown', skipSting);

/* ---------- main menu ---------- */
const items = Array.from(document.querySelectorAll('.mitem'));
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
  const c = $('#mi-continue');
  if (save && i === 1) DelveAudio.menuVariant(true); else DelveAudio.menuVariant(false);
}
function tipShow(){
  if (save) return;
  const tip = $('#menu-tip'), r = $('#mi-continue').getBoundingClientRect();
  tip.textContent = STR.MENU_NOSAVE;
  tip.hidden = false;
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
  else openStub(i);
}
addEventListener('keydown', e => {
  if (current !== 'menu') return;
  if (e.key === 'ArrowDown' || e.key === 's'){ select((sel + 1) % items.length); e.preventDefault(); }
  else if (e.key === 'ArrowUp' || e.key === 'w'){ select((sel - 1 + items.length) % items.length); e.preventDefault(); }
  else if (e.key === 'Enter' || e.key === ' '){ if (document.activeElement && document.activeElement.classList.contains('mitem')) return; activate(sel); e.preventDefault(); }
  else if (e.key === 'Escape'){ /* §2.3: ESC does nothing on menu */ }
});
function gotoMenu(){
  stingDone = true;
  show('menu');
  $('#bg').classList.add('live');
  updateContinue(); select(0, true);
  $('#menu-br').textContent = 'DELVE v0.1.0-shell · fan work · 2026-09-19';
  DelveAudio.startMenu(); DelveAudio.ambStart();
}

/* ---------- overlays ---------- */
function openNew(){
  $('#new-body').textContent = STR.NEW_BODY
    .replace('{0}', save.slot).replace('{1}', save.cls).replace('{2}', 'Level ' + save.lvl).replace('{3}', save.chap);
  $('#modal-new').hidden = false; $('#new-begin').focus();
}
$('#new-begin').addEventListener('click', () => { DelveAudio.play('confirm', .9); $('#modal-new').hidden = true; show('firstrun'); });
$('#new-back').addEventListener('click', () => { DelveAudio.play('back', .8); $('#modal-new').hidden = true; });

const STUBS = { 2: ['OPTIONS', STR.STUB_OPTIONS], 3: ['CODEX', STR.STUB_CODEX], 4: ['CREDITS', STR.STUB_CREDITS] };
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
  const s = mode === 'signed' ? pending : (save ? save.settings : pending);
  $('#end-settings').textContent = `Difficulty ${s.diff} · Pacing ${s.pace} · Subtitles ${s.subs} · Motion ${s.comfort}`;
  DelveAudio.play('stamp', 1);
  $('#modal-end').hidden = false; $('#end-back').focus();
}
$('#end-back').addEventListener('click', () => {
  DelveAudio.play('back', .8); $('#modal-end').hidden = true;
  updateContinue();
});

/* ---------- first run radios (§2.4.2) ---------- */
const GROUPS = { 'fr-diff': 'diff', 'fr-pace': 'pace', 'fr-subs': 'subs', 'fr-comfort': 'comfort' };
for (const gid in GROUPS){
  const box = document.getElementById(gid);
  box.querySelectorAll('.opt').forEach(op => {
    op.addEventListener('click', () => {
      box.querySelectorAll('.opt').forEach(o => o.setAttribute('aria-checked', 'false'));
      op.setAttribute('aria-checked', 'true');
      pending[GROUPS[gid]] = op.dataset.v;
      DelveAudio.play('move', .7);
    });
  });
}
$('#fr-go').addEventListener('click', () => {
  save = { slot: 'Contract I', name: 'Recruit', cls: 'Recruit', lvl: 1, chap: 'Prologue',
           settings: Object.assign({}, pending), ts: Date.now() };
  storeSave(save);
  show('menu', true);           // sheet closes behind the end card
  openEnd('signed');
});
$('#fr-back').addEventListener('click', () => { DelveAudio.play('back', .8); show('menu'); });

/* ---------- global escape: overlays/sheet close, menu no-op ---------- */
addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (!$('#modal-new').hidden){ $('#modal-new').hidden = true; return; }
  if (!$('#modal-stub').hidden){ $('#modal-stub').hidden = true; return; }
  if (!$('#modal-end').hidden){ $('#end-back').click(); return; }
  if (current === 'firstrun'){ show('menu'); return; }
});

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
        else if (current === 'firstrun') show('menu');
      }
    }
    gpPrev = b; gpAxPrev = ax;
  }
  requestAnimationFrame(pollGamepad);
}
requestAnimationFrame(pollGamepad);

/* ---------- inject emblems, seals, boot ---------- */
$('#menu-emblem').innerHTML = emblemSVG(true);
document.querySelectorAll('[data-seal]').forEach(el => { el.innerHTML = sealSVG(); });
if (P.get('still') === '1') document.body.classList.add('still');
if (P.get('rm') === '1' || matchMedia('(prefers-reduced-motion: reduce)').matches) document.body.classList.add('rm');

switch (P.get('s')){
  case 'sting': show('sting', true); setTimeout(startSting, 50); break;
  case 'menu': gotoMenu(); break;
  case 'new': gotoMenu(); openNew(); break;
  case 'firstrun': gotoMenu(); show('firstrun', true); break;
  case 'end': gotoMenu(); openEnd('signed'); break;
  case 'stub2': gotoMenu(); openStub(2); break;
  case 'stub3': gotoMenu(); openStub(3); break;
  case 'stub4': gotoMenu(); openStub(4); break;
  default: break; // legal screen already active
}
})();
