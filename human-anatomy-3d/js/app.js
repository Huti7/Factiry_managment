import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js';
import { loadAnatomy, femaleFrom } from './model.js';
import { INFO, CATEGORIES, REGIONS } from './data.js';

// ---------------------------------------------------------------------------
// constants & state
// ---------------------------------------------------------------------------
const COLORS = { bones: 0xe9dfc6, muscles: 0xb0453a, nerves: 0xe3b23c };
const HI = new THREE.Color(0x2a7f6f);
const HOVER = new THREE.Color(0x7a5a2a);
const CTX_HI = new THREE.Color(0x2f9e88);
const BLACK = new THREE.Color(0x000000);
const GROUPED = new Set(['cervical', 'thoracic', 'lumbar', 'trueRibs', 'falseRibs', 'floatingRibs']);
const CATS = ['bones', 'muscles', 'nerves'];
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const state = {
  sex: 'male',
  view: 'explorer',
  layers: { bones: { on: true, op: 1 }, muscles: { on: true, op: 1 }, nerves: { on: true, op: 1 } },
  selected: null, // part
  isolate: false,
  xray: false,
  atlasCat: 'bones',
  region: 'all',
  query: '',
  ctx: null, // { key, part, zoom }
};

const modelCache = {};
const getParts = (sex) => (modelCache[sex] ||= femaleFrom(modelCache.male));
let KEYS = {};
function indexKeys(parts) {
  KEYS = {};
  for (const p of parts) {
    const k = (KEYS[p.key] ||= { cat: p.cat, pieces: new Set(), sides: new Set() });
    k.pieces.add(p.label);
    if (p.side) k.sides.add(p.side);
  }
}
const sameSelection = (q, p) => q.key === p.key && q.side === p.side && (!GROUPED.has(p.key) || q.label === p.label);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

function material(p) {
  return new THREE.MeshStandardMaterial({
    color: p.color ?? COLORS[p.cat],
    roughness: p.cat === 'bones' ? 0.62 : p.cat === 'muscles' ? 0.5 : 0.42,
    metalness: 0,
  });
}

function addLights(scene) {
  scene.add(new THREE.HemisphereLight(0xfff6e8, 0x8a7458, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.7); key.position.set(1.5, 3, 2.5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffe9cc, 0.6); fill.position.set(-2, 1.5, 1); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 0.9); rim.position.set(0, 2, -3); scene.add(rim);
}

function floorShadow() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grd.addColorStop(0, 'rgba(70,45,20,0.35)'); grd.addColorStop(0.5, 'rgba(70,45,20,0.12)'); grd.addColorStop(1, 'rgba(70,45,20,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.001;
  return m;
}

function easeTween(obj, dur = 650) {
  // obj: { from: [vec...], to: [vec...], targets: [vec...] }
  const start = performance.now();
  tweens.push((now) => {
    const t = Math.min(1, (now - start) / dur);
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    obj.targets.forEach((v, i) => v.lerpVectors(obj.from[i], obj.to[i], e));
    return t < 1;
  });
}
let tweens = [];

// ---------------------------------------------------------------------------
// MAIN 3D EXPLORER
// ---------------------------------------------------------------------------
const viewport = $('#viewport');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
viewport.appendChild(renderer.domElement);
const scene = new THREE.Scene();
addLights(scene);
scene.add(floorShadow());
const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
camera.position.set(0, 1.0, 3.7);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.target.set(0, 0.9, 0);
controls.minDistance = 0.2;
controls.maxDistance = 7;
controls.autoRotateSpeed = 1.6;
const body = new THREE.Group();
scene.add(body);
let meshes = [];

function loadModel() {
  for (const m of meshes) m.material.dispose();
  body.clear();
  const parts = getParts(state.sex);
  indexKeys(parts);
  meshes = parts.map((p) => {
    const m = new THREE.Mesh(p.geo, material(p));
    m.userData.part = p;
    m.userData.base = m.material.color.clone();
    body.add(m);
    return m;
  });
  if (state.selected) {
    const old = state.selected;
    const np = parts.find((q) => sameSelection(q, old));
    state.selected = np || null;
  }
  applyLayers();
  applyHighlight();
  renderLayerList();
  if (state.selected) renderInfo(state.selected);
}

function applyLayers() {
  const sel = state.selected;
  for (const m of meshes) {
    const p = m.userData.part;
    const L = state.layers[p.cat];
    let vis = L.on && L.op > 0.02;
    let op = L.op;
    if (state.isolate && sel) { vis = sameSelection(p, sel); op = 1; }
    m.visible = vis;
    m.material.opacity = op;
    if (m.material.transparent !== op < 0.999) m.material.needsUpdate = true;
    m.material.transparent = op < 0.999;
    m.material.depthWrite = op >= 0.999;
    m.renderOrder = op < 0.999 ? 1 : 0;
  }
}

let hovered = null;
function applyHighlight() {
  for (const m of meshes) {
    const p = m.userData.part;
    const isSel = state.selected && sameSelection(p, state.selected);
    const isHov = hovered && sameSelection(p, hovered) && !isSel;
    m.material.color.copy(m.userData.base);
    if (isSel) m.material.color.lerp(HI, 0.7);
    m.material.emissive.copy(isSel ? HI : isHov ? HOVER : BLACK);
    m.material.emissiveIntensity = isSel ? 0.45 : isHov ? 0.35 : 0;
  }
}

// --- picking ---
const ray = new THREE.Raycaster();
const ndc = new THREE.Vector2();
function pickFrom(ev, dom, cam, list, layerAware) {
  const r = dom.getBoundingClientRect();
  ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
  ray.setFromCamera(ndc, cam);
  const hits = ray.intersectObjects(list.filter((m) => m.visible), false);
  for (const h of hits) {
    const p = h.object.userData.part;
    if (!layerAware || state.isolate || state.layers[p.cat].op >= 0.35) return h.object;
  }
  return null;
}

const tooltip = $('#tooltip');
let lastMove = null;
renderer.domElement.addEventListener('pointermove', (ev) => { lastMove = ev; });
renderer.domElement.addEventListener('pointerleave', () => { lastMove = null; setHover(null); tooltip.classList.remove('show'); });
function processHover() {
  if (!lastMove || state.view !== 'explorer') return;
  const ev = lastMove; lastMove = null;
  if (ev.buttons) { tooltip.classList.remove('show'); return; }
  const m = pickFrom(ev, renderer.domElement, camera, meshes, true);
  setHover(m ? m.userData.part : null);
  if (m) {
    const p = m.userData.part;
    const side = p.side === 'L' ? ' (left)' : p.side === 'R' ? ' (right)' : '';
    tooltip.textContent = (GROUPED.has(p.key) ? p.label : INFO[p.key].name) + side;
    const r = viewport.getBoundingClientRect();
    tooltip.style.left = ev.clientX - r.left + 'px';
    tooltip.style.top = ev.clientY - r.top + 'px';
    tooltip.classList.add('show');
    renderer.domElement.style.cursor = 'pointer';
  } else {
    tooltip.classList.remove('show');
    renderer.domElement.style.cursor = '';
  }
}
function setHover(p) {
  if (p === hovered) return;
  hovered = p;
  applyHighlight();
}

let downAt = null;
renderer.domElement.addEventListener('pointerdown', (ev) => { downAt = { x: ev.clientX, y: ev.clientY }; });
renderer.domElement.addEventListener('pointerup', (ev) => {
  if (!downAt || Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) > 5 || ev.button !== 0) return;
  const m = pickFrom(ev, renderer.domElement, camera, meshes, true);
  if (m) select(m.userData.part);
  else if (!state.isolate) deselect();
});

function select(part, focus = false) {
  state.selected = part;
  applyLayers();
  applyHighlight();
  renderInfo(part);
  openPanel('infoPanel');
  if (focus) focusOn(meshes.filter((m) => sameSelection(m.userData.part, part)));
}
function deselect() {
  state.selected = null;
  state.isolate = false;
  applyLayers();
  applyHighlight();
  closePanel('infoPanel');
}

function pieceLabel(part) {
  const I = INFO[part.key];
  const bits = [];
  if (part.label && part.label !== I.name) bits.push(part.label);
  if (part.side) bits.push(part.side === 'L' ? 'Left side' : 'Right side');
  return bits.join(' · ');
}

function infoHTML(part, actions = '') {
  const I = INFO[part.key];
  const C = CATEGORIES[part.cat];
  const piece = pieceLabel(part);
  const note = I.female
    ? `<div class="sexnote ${state.sex}"><b>${state.sex === 'female' ? '♀ Female anatomy note' : '♂/♀ Male vs female'}</b>${I.female}</div>`
    : '';
  return `
    <div class="badges">
      <span class="badge"><i style="background:${C.color}"></i>${C.system}</span>
      <span class="badge">${REGIONS[I.region]}</span>
      <span class="badge">${state.sex === 'female' ? '♀ Female' : '♂ Male'} model</span>
    </div>
    <h2>${I.name}</h2>
    <p class="latin">${I.latin}</p>
    ${piece ? `<p class="piece">Selected: ${piece}</p>` : ''}
    <p class="desc">${I.desc}</p>
    <h3>Key facts</h3>
    <ul class="facts">${I.facts.map((f) => `<li>${f}</li>`).join('')}</ul>
    ${note}
    ${actions}`;
}

function renderInfo(part) {
  $('#infoBody').innerHTML = infoHTML(part, `
    <div class="actions">
      <button class="btn" data-act="focus">Zoom to part</button>
      <button class="btn ghost" data-act="isolate">${state.isolate ? 'Show whole body' : 'Isolate part'}</button>
      <button class="btn ghost" data-act="atlas">Open in Parts Atlas</button>
    </div>`);
}
$('#infoBody').addEventListener('click', (ev) => {
  const act = ev.target.closest('[data-act]')?.dataset.act;
  if (!act || !state.selected) return;
  const sel = meshes.filter((m) => sameSelection(m.userData.part, state.selected));
  if (act === 'focus') focusOn(sel);
  if (act === 'isolate') {
    state.isolate = !state.isolate;
    applyLayers();
    renderInfo(state.selected);
    if (state.isolate) focusOn(sel); else setCam('reset');
  }
  if (act === 'atlas') {
    const p = state.selected;
    state.atlasCat = p.cat; state.region = 'all'; state.query = ''; $('#atlasSearch').value = '';
    switchView('atlas');
    openContext(p.key, p);
  }
});

function focusOn(list, cam = camera, ctl = controls) {
  if (!list.length) return;
  const box = new THREE.Box3();
  list.forEach((m) => box.expandByObject(m));
  const sph = box.getBoundingSphere(new THREE.Sphere());
  const dist = Math.max(0.3, (sph.radius / Math.sin(THREE.MathUtils.degToRad(cam.fov / 2))) * 1.25);
  const dir = cam.position.clone().sub(ctl.target).normalize();
  easeTween({
    from: [cam.position.clone(), ctl.target.clone()],
    to: [sph.center.clone().add(dir.multiplyScalar(dist)), sph.center.clone()],
    targets: [cam.position, ctl.target],
  });
}

function camPreset(name, cam = camera, ctl = controls) {
  const h = state.sex === 'female' ? 0.93 : 1;
  const ty = 0.88 * h, d = 3.7 * h, y = 1.0 * h;
  const pos = { front: [0, y, d], back: [0, y, -d], left: [d, y, 0], right: [-d, y, 0], reset: [0, y, d] }[name];
  easeTween({ from: [cam.position.clone(), ctl.target.clone()], to: [new THREE.Vector3(...pos), new THREE.Vector3(0, ty, 0)], targets: [cam.position, ctl.target] });
}
function setCam(name) { camPreset(name); }
$$('.toolbar [data-cam]').forEach((b) => b.addEventListener('click', () => setCam(b.dataset.cam)));
$('#btnRotate').addEventListener('click', (e) => { controls.autoRotate = !controls.autoRotate; e.currentTarget.classList.toggle('on', controls.autoRotate); });

// --- layer panel ---
function renderLayerList() {
  const counts = {};
  for (const k in KEYS) counts[KEYS[k].cat] = (counts[KEYS[k].cat] || 0) + 1;
  $('#layerList').innerHTML = CATS.map((c) => {
    const L = state.layers[c];
    return `<div class="layer" data-cat="${c}">
      <label class="switch"><input type="checkbox" ${L.on ? 'checked' : ''} data-toggle="${c}"><span></span></label>
      <div class="name"><i style="background:${CATEGORIES[c].color}"></i>${CATEGORIES[c].label}</div>
      <div class="count">${counts[c] || 0} parts</div>
      <input type="range" min="0" max="1" step="0.05" value="${L.op}" data-op="${c}" aria-label="${CATEGORIES[c].label} opacity" title="Opacity">
    </div>`;
  }).join('');
}
$('#layerList').addEventListener('input', (ev) => {
  const t = ev.target;
  if (t.dataset.toggle) state.layers[t.dataset.toggle].on = t.checked;
  if (t.dataset.op) state.layers[t.dataset.op].op = +t.value;
  applyLayers();
});
$('#panelMore').addEventListener('click', (e) => {
  const on = $('#layerPanel').classList.toggle('expanded');
  e.currentTarget.textContent = on ? 'Less ▴' : 'More ▾';
  e.currentTarget.setAttribute('aria-expanded', on);
});
$('#btnShowAll').addEventListener('click', () => {
  CATS.forEach((c) => (state.layers[c] = { on: true, op: 1 }));
  state.isolate = false; state.xray = false;
  $('#btnXray').classList.remove('on');
  applyLayers(); renderLayerList();
  if (state.selected) renderInfo(state.selected);
  setCam('reset');
});
$('#btnXray').addEventListener('click', (e) => {
  state.xray = !state.xray;
  e.currentTarget.classList.toggle('on', state.xray);
  const v = state.xray ? { bones: 0.55, muscles: 0.18, nerves: 1 } : { bones: 1, muscles: 1, nerves: 1 };
  CATS.forEach((c) => { state.layers[c].op = v[c]; state.layers[c].on = true; });
  applyLayers(); renderLayerList();
});

// --- search ---
const searchInput = $('#search');
searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim().toLowerCase();
  const ul = $('#searchResults');
  if (!q) { ul.innerHTML = ''; return; }
  const res = Object.entries(INFO).filter(([k, I]) => KEYS[k] && (I.name.toLowerCase().includes(q) || I.latin.toLowerCase().includes(q))).slice(0, 12);
  ul.innerHTML = res.length
    ? res.map(([k, I]) => `<li data-key="${k}"><i style="background:${CATEGORIES[KEYS[k].cat].color}"></i>${I.name}</li>`).join('')
    : '<li style="cursor:default;color:var(--muted)">No match</li>';
});
$('#searchResults').addEventListener('click', (ev) => {
  const key = ev.target.closest('li')?.dataset.key;
  if (!key) return;
  const part = meshes.map((m) => m.userData.part).find((p) => p.key === key && p.side !== 'R');
  const L = state.layers[part.cat];
  if (!L.on || L.op < 0.35) { L.on = true; L.op = 1; renderLayerList(); }
  select(part, true);
  searchInput.value = ''; $('#searchResults').innerHTML = '';
});

// ---------------------------------------------------------------------------
// PANELS & VIEWS
// ---------------------------------------------------------------------------
function openPanel(id) { const el = document.getElementById(id); el.classList.add('open'); el.setAttribute('aria-hidden', 'false'); if (id === 'contextPanel') $('#backdrop').classList.add('show'); }
function closePanel(id) {
  const el = document.getElementById(id); el.classList.remove('open'); el.setAttribute('aria-hidden', 'true');
  if (id === 'contextPanel') { $('#backdrop').classList.remove('show'); state.ctx = null; $$('.card.selected').forEach((c) => c.classList.remove('selected')); }
}
$$('[data-close]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.close === 'infoPanel') deselect(); else closePanel(b.dataset.close);
}));
$('#backdrop').addEventListener('click', () => closePanel('contextPanel'));
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (state.ctx) closePanel('contextPanel'); else if (state.selected) deselect();
});

function switchView(v) {
  state.view = v;
  $$('.tab').forEach((t) => t.classList.toggle('active', t.dataset.view === v));
  $$('.view').forEach((el) => el.classList.toggle('active', el.id === v));
  if (v === 'atlas') renderAtlas();
  if (v === 'explorer') resize();
}
$$('.tab').forEach((t) => t.addEventListener('click', () => switchView(t.dataset.view)));

$$('.sex-btn').forEach((b) => b.addEventListener('click', () => {
  if (state.sex === b.dataset.sex) return;
  $$('.sex-btn').forEach((x) => x.classList.toggle('active', x === b));
  setLoading(true);
  setTimeout(() => {
    state.sex = b.dataset.sex;
    loadModel();
    camPreset('reset');
    if (state.view === 'atlas') renderAtlas();
    if (state.ctx) openContext(state.ctx.key, state.ctx.part, true);
    setLoading(false);
  }, 30);
}));

function setLoading(on) { $('#loading').classList.toggle('hide', !on); }

// ---------------------------------------------------------------------------
// PARTS ATLAS (every piece shown separately)
// ---------------------------------------------------------------------------
const thumbR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
thumbR.setPixelRatio(1);
thumbR.setSize(300, 300);
const thumbScene = new THREE.Scene();
addLights(thumbScene);
const thumbCam = new THREE.PerspectiveCamera(30, 1, 0.001, 20);
const thumbMats = {};
const thumbCache = new Map();
let thumbQueue = [];
let thumbBusy = false;
const VIEW_DIRS = { front: new THREE.Vector3(0.35, 0.15, 1), back: new THREE.Vector3(-0.35, 0.15, -1), side: new THREE.Vector3(1, 0.12, 0.3) };

function renderThumb(key, sex) {
  const ps = getParts(sex).filter((p) => p.key === key && p.side !== 'R');
  const g = new THREE.Group();
  for (const p of ps) {
    const c = p.color ?? COLORS[p.cat];
    const mat = (thumbMats[c] ||= new THREE.MeshStandardMaterial({ color: c, roughness: 0.55 }));
    g.add(new THREE.Mesh(p.geo, mat));
  }
  thumbScene.add(g);
  const box = new THREE.Box3().setFromObject(g);
  const sph = box.getBoundingSphere(new THREE.Sphere());
  const dir = VIEW_DIRS[INFO[key].view || 'front'].clone().normalize();
  const dist = (sph.radius / Math.sin(THREE.MathUtils.degToRad(thumbCam.fov / 2))) * 1.02;
  thumbCam.position.copy(sph.center).add(dir.multiplyScalar(dist));
  thumbCam.near = dist / 50; thumbCam.far = dist * 4; thumbCam.updateProjectionMatrix();
  thumbCam.lookAt(sph.center);
  thumbR.render(thumbScene, thumbCam);
  thumbScene.remove(g);
  return thumbR.domElement.toDataURL('image/png');
}

function requestThumb(key, img) {
  const id = state.sex + ':' + key;
  if (thumbCache.has(id)) { img.src = thumbCache.get(id); img.parentElement.querySelector('.spinner')?.remove(); return; }
  thumbQueue.push({ key, id, sex: state.sex, img });
  if (!thumbBusy) { thumbBusy = true; requestAnimationFrame(pumpThumbs); }
}
function pumpThumbs() {
  const t0 = performance.now();
  while (thumbQueue.length && performance.now() - t0 < 24) {
    const j = thumbQueue.shift();
    if (!j.img.isConnected || j.sex !== state.sex) continue;
    if (!thumbCache.has(j.id)) thumbCache.set(j.id, renderThumb(j.key, j.sex));
    j.img.src = thumbCache.get(j.id);
    j.img.parentElement.querySelector('.spinner')?.remove();
  }
  if (thumbQueue.length) requestAnimationFrame(pumpThumbs); else thumbBusy = false;
}

function keysOf(cat) { return Object.keys(INFO).filter((k) => KEYS[k]?.cat === cat); }

function renderAtlas() {
  // category tabs
  $('#catTabs').innerHTML = CATS.map((c) => `<button class="cat-tab ${state.atlasCat === c ? 'active' : ''}" data-cat="${c}">
    <i style="background:${CATEGORIES[c].color}"></i>${CATEGORIES[c].label} <small>${keysOf(c).length}</small></button>`).join('');
  const keys = keysOf(state.atlasCat);
  const regions = ['all', ...Object.keys(REGIONS).filter((r) => keys.some((k) => INFO[k].region === r))];
  if (!regions.includes(state.region)) state.region = 'all';
  $('#regionChips').innerHTML = regions.map((r) => `<button class="chip ${state.region === r ? 'active' : ''}" data-region="${r}">${r === 'all' ? 'All regions' : REGIONS[r]}</button>`).join('');
  const q = state.query.toLowerCase();
  const list = keys.filter((k) => (state.region === 'all' || INFO[k].region === state.region) && (!q || INFO[k].name.toLowerCase().includes(q) || INFO[k].latin.toLowerCase().includes(q)));
  $('#atlasSub').textContent = `${list.length} ${CATEGORIES[state.atlasCat].label.toLowerCase()} shown piece by piece · ${state.sex === 'female' ? '♀ female' : '♂ male'} body · click a part to see where it sits in the full ${state.atlasCat === 'bones' ? 'skeleton' : state.atlasCat === 'muscles' ? 'muscular system' : 'nervous system'}`;
  thumbQueue = [];
  $('#grid').innerHTML = list.length ? list.map((k) => {
    const K = KEYS[k];
    const n = K.pieces.size;
    const pill = K.sides.size ? (n > 1 ? `${n} pairs` : 'Pair · L & R') : n > 1 ? `${n} pieces` : 'Single';
    return `<button class="card ${state.ctx?.key === k ? 'selected' : ''}" data-key="${k}">
      <div class="thumb"><span class="pill">${pill}</span><div class="spinner"></div><img alt="${INFO[k].name}"></div>
      <div class="meta"><b>${INFO[k].name}</b><span>${REGIONS[INFO[k].region]}</span></div></button>`;
  }).join('') : '<div class="empty">No parts match your filter.</div>';
  $$('#grid .card').forEach((c) => requestThumb(c.dataset.key, $('img', c)));
}
$('#catTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; state.atlasCat = b.dataset.cat; state.region = 'all'; renderAtlas(); });
$('#regionChips').addEventListener('click', (e) => { const b = e.target.closest('[data-region]'); if (!b) return; state.region = b.dataset.region; renderAtlas(); });
$('#atlasSearch').addEventListener('input', (e) => { state.query = e.target.value.trim(); renderAtlas(); });
$('#grid').addEventListener('click', (e) => { const c = e.target.closest('.card'); if (c) openContext(c.dataset.key); });

// --- context slide: the selected part inside the full body of its system only ---
const ctxViewport = $('#ctxViewport');
const ctxR = new THREE.WebGLRenderer({ antialias: true, alpha: true });
ctxR.setPixelRatio(Math.min(window.devicePixelRatio, 2));
ctxViewport.appendChild(ctxR.domElement);
const ctxScene = new THREE.Scene();
addLights(ctxScene);
ctxScene.add(floorShadow());
const ctxCam = new THREE.PerspectiveCamera(30, 1, 0.01, 50);
const ctxControls = new OrbitControls(ctxCam, ctxR.domElement);
ctxControls.enableDamping = true;
ctxControls.minDistance = 0.15;
ctxControls.maxDistance = 6;
const ctxGroup = new THREE.Group();
ctxScene.add(ctxGroup);
let ctxMeshes = [];
let ctxBuilt = null; // sex:cat

function buildCtxScene(cat) {
  const id = state.sex + ':' + cat;
  if (ctxBuilt === id) return;
  for (const m of ctxMeshes) m.material.dispose();
  ctxGroup.clear();
  ctxMeshes = getParts(state.sex).filter((p) => p.cat === cat).map((p) => {
    const m = new THREE.Mesh(p.geo, material(p));
    m.userData.part = p;
    m.userData.base = m.material.color.clone();
    ctxGroup.add(m);
    return m;
  });
  ctxBuilt = id;
}

function ctxFrame(zoom, instant = false) {
  const hiMeshes = ctxMeshes.filter((m) => m.userData.hi);
  let center, dist;
  const dirFor = { front: new THREE.Vector3(0.25, 0.08, 1), back: new THREE.Vector3(-0.25, 0.08, -1), side: new THREE.Vector3(1, 0.08, 0.35) };
  const view = state.ctx ? INFO[state.ctx.key].view || 'front' : 'front';
  const dir = dirFor[view].clone().normalize();
  if (zoom && hiMeshes.length) {
    const box = new THREE.Box3();
    hiMeshes.forEach((m) => box.expandByObject(m));
    const sph = box.getBoundingSphere(new THREE.Sphere());
    center = sph.center;
    dist = Math.max(0.25, (sph.radius / Math.sin(THREE.MathUtils.degToRad(ctxCam.fov / 2))) * 1.3);
  } else {
    const h = state.sex === 'female' ? 0.93 : 1;
    center = new THREE.Vector3(0, 0.87 * h, 0);
    dist = 3.9 * h;
  }
  const pos = center.clone().add(dir.multiplyScalar(dist));
  if (instant) { ctxCam.position.copy(pos); ctxControls.target.copy(center); }
  else easeTween({ from: [ctxCam.position.clone(), ctxControls.target.clone()], to: [pos, center.clone()], targets: [ctxCam.position, ctxControls.target] });
  $('#ctxZoom').classList.toggle('active', !!zoom);
  $('#ctxFull').classList.toggle('active', !zoom);
}

function openContext(key, part = null, keepCam = false) {
  const cat = KEYS[key].cat;
  const wasOpen = !!state.ctx;
  buildCtxScene(cat);
  // map part to current sex model
  if (part) part = getParts(state.sex).find((q) => sameSelection(q, part)) || null;
  state.ctx = { key, part, zoom: state.ctx?.zoom ?? false };
  for (const m of ctxMeshes) {
    const p = m.userData.part;
    const hi = part ? sameSelection(p, part) : p.key === key;
    m.userData.hi = hi;
    m.material.color.copy(hi ? CTX_HI : m.userData.base);
    m.material.emissive.copy(hi ? CTX_HI : BLACK);
    m.material.emissiveIntensity = hi ? 0.35 : 0;
  }
  const I = INFO[key];
  const C = CATEGORIES[cat];
  const sys = cat === 'bones' ? 'skeleton' : cat === 'muscles' ? 'muscular system' : 'nervous system';
  $('#ctxHead').innerHTML = `<small>Location in the full ${sys}</small><h2>${I.name}</h2>`;
  $('#ctxLegend').innerHTML = `<span><i style="background:${hex(CTX_HI.getHex())}"></i>${part ? pieceLabel(part) || I.name : I.name}</span><span><i style="background:${C.color}"></i>Rest of the ${sys}</span>`;
  const shown = part || { ...getParts(state.sex).find((p) => p.key === key && p.side !== 'R'), side: null, label: I.name };
  $('#ctxBody').innerHTML = infoHTML(shown, `<div class="actions"><button class="btn" data-ctx="explore">View in 3D Body Explorer</button></div>`);
  $$('.card').forEach((c) => c.classList.toggle('selected', c.dataset.key === key));
  openPanel('contextPanel');
  resizeCtx();
  if (!wasOpen) ctxFrame(state.ctx.zoom, true);
  else if (!keepCam) ctxFrame(state.ctx.zoom);
}
$('#ctxZoom').addEventListener('click', () => { if (state.ctx) { state.ctx.zoom = true; ctxFrame(true); } });
$('#ctxFull').addEventListener('click', () => { if (state.ctx) { state.ctx.zoom = false; ctxFrame(false); } });
$('#ctxBody').addEventListener('click', (e) => {
  if (e.target.closest('[data-ctx="explore"]') && state.ctx) {
    const key = state.ctx.key;
    const part = state.ctx.part || getParts(state.sex).find((p) => p.key === key && p.side !== 'R');
    closePanel('contextPanel');
    switchView('explorer');
    const L = state.layers[part.cat];
    if (!L.on || L.op < 0.35) { L.on = true; L.op = 1; renderLayerList(); }
    select(meshes.find((m) => sameSelection(m.userData.part, part)).userData.part, true);
  }
});
let ctxDown = null;
ctxR.domElement.addEventListener('pointerdown', (e) => { ctxDown = { x: e.clientX, y: e.clientY }; });
ctxR.domElement.addEventListener('pointerup', (e) => {
  if (!ctxDown || Math.hypot(e.clientX - ctxDown.x, e.clientY - ctxDown.y) > 5) return;
  const m = pickFrom(e, ctxR.domElement, ctxCam, ctxMeshes, false);
  if (m) openContext(m.userData.part.key, m.userData.part, true);
});
ctxR.domElement.addEventListener('pointermove', (e) => {
  if (e.buttons) return;
  const m = pickFrom(e, ctxR.domElement, ctxCam, ctxMeshes, false);
  ctxR.domElement.style.cursor = m ? 'pointer' : '';
  ctxR.domElement.title = m ? (GROUPED.has(m.userData.part.key) ? m.userData.part.label : INFO[m.userData.part.key].name) : '';
});

// ---------------------------------------------------------------------------
// render loop & resize
// ---------------------------------------------------------------------------
function resize() {
  const w = viewport.clientWidth, h = viewport.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
function resizeCtx() {
  const w = ctxViewport.clientWidth, h = ctxViewport.clientHeight;
  if (!w || !h) return;
  ctxR.setSize(w, h);
  ctxCam.aspect = w / h;
  ctxCam.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(viewport);
new ResizeObserver(resizeCtx).observe(ctxViewport);

function loop(now) {
  requestAnimationFrame(loop);
  tweens = tweens.filter((f) => f(now));
  if (state.view === 'explorer') {
    processHover();
    controls.update();
    renderer.render(scene, camera);
  }
  if (state.ctx) {
    const k = 0.25 + 0.2 * Math.sin(now / 260);
    for (const m of ctxMeshes) if (m.userData.hi) m.material.emissiveIntensity = k;
    ctxControls.update();
    ctxR.render(ctxScene, ctxCam);
  }
}

// ---------------------------------------------------------------------------
// boot
// ---------------------------------------------------------------------------
(async () => {
  try {
    modelCache.male = await loadAnatomy('model/', (f) => { $('#loading p').textContent = `Loading the human body… ${Math.round(f * 100)}%`; });
  } catch (err) {
    $('#loading p').textContent = 'Could not load the 3D model. Please serve this folder with a web server (see README).';
    console.error(err);
    return;
  }
  loadModel();
  resize();
  requestAnimationFrame(loop);
  setLoading(false);
  window.appReady = true;
  // prepare the female model in the background so switching is instant
  setTimeout(() => getParts('female'), 1500);
})();

// test hooks
window.__anatomy = { state, select: (key) => select(meshes.map((m) => m.userData.part).find((p) => p.key === key && p.side !== 'R'), true), openContext, switchView, meshes: () => meshes };
