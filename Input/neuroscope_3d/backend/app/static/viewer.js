// NeuroScope 3D viewer: 3D meshes in world mm + linked axial/coronal/sagittal slices with one crosshair.
// Volumes arrive in canonical RAS voxel order (axis0 -> Right, axis1 -> Anterior, axis2 -> Superior), x fastest.
import * as THREE from 'three';
import { OrbitControls } from '/static/vendor/OrbitControls.js';

const studyId = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop());
const $ = (s) => document.querySelector(s);
const API = `/api/viewer/${encodeURIComponent(studyId)}`;

const LABEL_RGB = { 1: [214, 69, 44], 2: [120, 168, 112], 4: [232, 176, 48] };
const LABEL_NAME = { 0: 'background', 1: 'NCR (1)', 2: 'ED (2)', 4: 'ET (4)' };
const AGREE_RGB = { both: [120, 168, 112], fp: [214, 69, 44], fn: [111, 163, 181] };
// how many of the 4 test-time-augmentation passes call a voxel WT
const UNCERT_RGB = { 1: [214, 69, 44], 2: [232, 176, 48], 3: [226, 214, 160], 4: [120, 168, 112] };
const REGION_CODES = { NCR: [1], ED: [2], ET: [4], TC: [1, 4], WT: [1, 2, 4] };

const S = {
  meta: null, X: 0, Y: 0, Z: 0, sp: [1, 1, 1], A: null, Ainv: null, Oinv: null,
  vols: {}, cross: [0, 0, 0], bg: 'flair', overlay: 'pred', alpha: 0.5, codes: new Set([1, 2, 4]),
};

// ------------------------------------------------------------------ helpers
function status(msg, err = false) { const el = $('#status'); el.textContent = msg; el.classList.toggle('err', err); }
async function getJSON(url, opts) {
  const r = await fetch(url, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || `${r.status} ${r.statusText}`);
  return j;
}
async function getVol(name) {
  if (S.vols[name]) return S.vols[name];
  const r = await fetch(`${API}/volume/${name}`);
  if (!r.ok) throw new Error(`Could not load ${name} volume (${r.status})`);
  const a = new Uint8Array(await r.arrayBuffer());
  if (a.length !== S.X * S.Y * S.Z) throw new Error(`${name}: size ${a.length} != ${S.X}x${S.Y}x${S.Z}`);
  return (S.vols[name] = a);
}
const mv = (M, v) => M.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2] + row[3] * v[3]);
function inv4(m) {
  const a = m.map((r, i) => [...r, ...[0, 1, 2, 3].map((j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < 4; c++) {
    let p = c; for (let r = c + 1; r < 4; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    [a[c], a[p]] = [a[p], a[c]];
    const d = a[c][c]; for (let j = 0; j < 8; j++) a[c][j] /= d;
    for (let r = 0; r < 4; r++) if (r !== c) { const f = a[r][c]; for (let j = 0; j < 8; j++) a[r][j] -= f * a[c][j]; }
  }
  return a.map((r) => r.slice(4));
}
const idx = (x, y, z) => x + S.X * (y + S.Y * z);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const fmt = (v, d = 1) => (v === null || v === undefined ? '—' : Number(v).toFixed(d));
const toWorld = (v) => mv(S.A, [v[0], v[1], v[2], 1]).slice(0, 3);

// ------------------------------------------------------------------ slice views
// Radiological display: axial/coronal show patient Right on screen-left; sagittal shows Anterior on the left.
const VIEWS = {
  axial: { axis: 2, labels: ['R', 'L', 'A', 'P'], wh: () => [S.X, S.Y], mm: () => [S.X * S.sp[0], S.Y * S.sp[1]],
    toVox: (u, v) => [S.X - 1 - u, S.Y - 1 - v, S.cross[2]], fromVox: (c) => [S.X - 1 - c[0], S.Y - 1 - c[1]] },
  coronal: { axis: 1, labels: ['R', 'L', 'S', 'I'], wh: () => [S.X, S.Z], mm: () => [S.X * S.sp[0], S.Z * S.sp[2]],
    toVox: (u, v) => [S.X - 1 - u, S.cross[1], S.Z - 1 - v], fromVox: (c) => [S.X - 1 - c[0], S.Z - 1 - c[2]] },
  sagittal: { axis: 0, labels: ['A', 'P', 'S', 'I'], wh: () => [S.Y, S.Z], mm: () => [S.Y * S.sp[1], S.Z * S.sp[2]],
    toVox: (u, v) => [S.cross[0], S.Y - 1 - u, S.Z - 1 - v], fromVox: (c) => [S.Y - 1 - c[1], S.Z - 1 - c[2]] },
};

function buildSlicePanels() {
  for (const panel of document.querySelectorAll('.panel.slice')) {
    const name = panel.dataset.view, V = VIEWS[name], box = panel.querySelector('.sbox');
    box.innerHTML = '';
    const stack = document.createElement('div'); stack.className = 'stack';
    const img = document.createElement('canvas'), cross = document.createElement('canvas');
    const [w, h] = V.wh(); img.width = w; img.height = h;
    stack.append(img, cross); box.append(stack);
    ['l', 'r', 't', 'b'].forEach((p, i) => {
      const s = document.createElement('span'); s.className = `olabel ${p}`; s.textContent = V.labels[i]; box.append(s);
    });
    Object.assign(V, { panel, box, stack, img, cross, ctx: img.getContext('2d'), cctx: cross.getContext('2d'),
      imageData: img.getContext('2d').createImageData(w, h) });

    let dragging = false;
    const pick = (ev) => {
      const r = cross.getBoundingClientRect();
      const u = clamp(Math.floor(((ev.clientX - r.left) / r.width) * w), 0, w - 1);
      const v = clamp(Math.floor(((ev.clientY - r.top) / r.height) * h), 0, h - 1);
      setCross(V.toVox(u, v));
    };
    cross.addEventListener('pointerdown', (ev) => { dragging = true; cross.setPointerCapture(ev.pointerId); pick(ev); });
    cross.addEventListener('pointermove', (ev) => { if (dragging) pick(ev); });
    cross.addEventListener('pointerup', () => { dragging = false; });
    cross.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const c = [...S.cross]; c[V.axis] += ev.deltaY < 0 ? 1 : -1; setCross(c);
    }, { passive: false });
  }
  layoutSlices();
}

function layoutSlices() {
  for (const V of Object.values(VIEWS)) {
    if (!V.box) continue;
    const [mw, mh] = V.mm();
    const bw = V.box.clientWidth - 8, bh = V.box.clientHeight - 30;
    const k = Math.max(0.1, Math.min(bw / mw, bh / mh));
    V.stack.style.width = `${mw * k}px`; V.stack.style.height = `${mh * k}px`;
    V.cross.width = Math.round(mw * k * devicePixelRatio); V.cross.height = Math.round(mh * k * devicePixelRatio);
    drawCross(V);
  }
}

function overlayLUTs() {
  const inCodes = new Uint8Array(256); for (const c of S.codes) inCodes[c] = 1;
  const region = new Uint8Array(256);
  if (S.overlay.startsWith('agree-')) for (const c of REGION_CODES[S.overlay.slice(6)]) region[c] = 1;
  return { inCodes, region };
}

function renderSlice(V) {
  const [w, h] = V.wh(), d = V.imageData.data, bg = S.vols[S.bg];
  const pred = S.vols.pred, expert = S.vols.expert, a = S.alpha, mode = S.overlay;
  const { inCodes, region } = overlayLUTs();
  let p = 0;
  for (let v = 0; v < h; v++) {
    for (let u = 0; u < w; u++, p += 4) {
      const [x, y, z] = V.toVox(u, v), i = idx(x, y, z), g = bg ? bg[i] : 0;
      let c = null;
      if (mode === 'uncert') { const u = S.vols.uncert; c = u && u[i] ? UNCERT_RGB[u[i]] : null; }
      else if (mode === 'pred' && pred && inCodes[pred[i]]) c = LABEL_RGB[pred[i]];
      else if (mode === 'expert' && expert && inCodes[expert[i]]) c = LABEL_RGB[expert[i]];
      else if (mode.startsWith('agree-') && pred && expert) {
        const pm = region[pred[i]], em = region[expert[i]];
        c = pm && em ? AGREE_RGB.both : pm ? AGREE_RGB.fp : em ? AGREE_RGB.fn : null;
      }
      if (c) { d[p] = g + (c[0] - g) * a; d[p + 1] = g + (c[1] - g) * a; d[p + 2] = g + (c[2] - g) * a; }
      else { d[p] = d[p + 1] = d[p + 2] = g; }
      d[p + 3] = 255;
    }
  }
  V.ctx.putImageData(V.imageData, 0, 0);
  V.panel.querySelector('.idx').textContent = `slice ${S.cross[V.axis] + 1} / ${[S.X, S.Y, S.Z][V.axis]}`;
  drawCross(V);
}

function drawCross(V) {
  if (!V.cctx) return;
  const [w, h] = V.wh(), [u, v] = V.fromVox(S.cross), cw = V.cross.width, ch = V.cross.height;
  const px = ((u + 0.5) / w) * cw, py = ((v + 0.5) / h) * ch, g = V.cctx;
  g.clearRect(0, 0, cw, ch);
  g.strokeStyle = 'rgba(242,237,227,0.8)'; g.lineWidth = Math.max(1, devicePixelRatio);
  g.beginPath(); g.moveTo(px, 0); g.lineTo(px, ch); g.moveTo(0, py); g.lineTo(cw, py); g.stroke();
}

const renderAllSlices = () => Object.values(VIEWS).forEach((V) => V.ctx && renderSlice(V));

// ------------------------------------------------------------------ crosshair
function setCross(c) {
  S.cross = [clamp(Math.round(c[0]), 0, S.X - 1), clamp(Math.round(c[1]), 0, S.Y - 1), clamp(Math.round(c[2]), 0, S.Z - 1)];
  renderAllSlices();
  update3DCross();
  const w = toWorld(S.cross), o = mv(S.Oinv, [...w, 1]).map((x) => Math.round(x));
  const i = idx(...S.cross);
  $('#c-vox').textContent = `i ${o[0]}, j ${o[1]}, k ${o[2]}`;
  $('#c-world').textContent = `x ${fmt(w[0])}, y ${fmt(w[1])}, z ${fmt(w[2])}`;
  $('#c-pred').textContent = S.vols.pred ? LABEL_NAME[S.vols.pred[i]] ?? S.vols.pred[i] : '—';
  if (S.vols.expert) $('#c-expert').textContent = LABEL_NAME[S.vols.expert[i]] ?? S.vols.expert[i];
  $('#c-int').textContent = S.vols[S.bg] ? `${S.bg.toUpperCase()} display value ${S.vols[S.bg][i]} / 255` : '—';
}

// ------------------------------------------------------------------ 3D
const T = { meshes: {} };

function init3D() {
  const el = $('#view3d');
  T.renderer = new THREE.WebGLRenderer({ antialias: true });
  T.renderer.setPixelRatio(devicePixelRatio);
  el.append(T.renderer.domElement);
  T.scene = new THREE.Scene(); T.scene.background = new THREE.Color(0x0a0908);
  T.camera = new THREE.PerspectiveCamera(35, 1, 1, 5000); T.camera.up.set(0, 0, 1);
  T.scene.add(T.camera);
  T.scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 0.9); key.position.set(0.3, 0.4, 1); T.camera.add(key);
  T.controls = new OrbitControls(T.camera, T.renderer.domElement);
  T.controls.enableDamping = true;

  const mat = new THREE.MeshBasicMaterial({ color: 0xf2ede3, depthTest: false });
  T.dot = new THREE.Mesh(new THREE.SphereGeometry(2.2, 16, 12), mat); T.dot.renderOrder = 10; T.scene.add(T.dot);
  T.lines = new THREE.LineSegments(new THREE.BufferGeometry(),
    new THREE.LineBasicMaterial({ color: 0xf2ede3, transparent: true, opacity: 0.7, depthTest: false }));
  T.lines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(18), 3));
  T.lines.renderOrder = 10; T.scene.add(T.lines);

  new ResizeObserver(() => {
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    T.renderer.setSize(r.width, r.height, false); T.camera.aspect = r.width / r.height; T.camera.updateProjectionMatrix();
  }).observe(el);

  // Click (not drag) on a visible surface sets the crosshair
  let down = null;
  T.renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
  T.renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4) return;
    const r = T.renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), T.camera);
    const targets = Object.values(T.meshes).filter((m) => m.visible);
    const hit = ray.intersectObjects(targets, false)[0];
    if (hit) setCross(mv(S.Ainv, [hit.point.x, hit.point.y, hit.point.z, 1]));
  });

  (function loop() { requestAnimationFrame(loop); T.controls.update(); T.renderer.render(T.scene, T.camera); })();
}

function b64(s, Type) { const bin = atob(s), u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i); return new Type(u8.buffer); }

function textSprite(text) {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); g.font = '500 40px "IBM Plex Mono", monospace'; g.fillStyle = '#f2ede3'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 32, 34);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false }));
  s.scale.set(14, 14, 1); s.renderOrder = 11; return s;
}

function buildMeshes(data) {
  for (const m of Object.values(T.meshes)) { T.scene.remove(m); m.geometry.dispose(); m.material.dispose(); }
  T.meshes = {};
  for (const [key, d] of Object.entries(data)) {
    if (!d.vertices) continue;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(b64(d.vertices, Float32Array), 3));
    g.setIndex(new THREE.BufferAttribute(b64(d.faces, Uint32Array), 1));
    g.computeVertexNormals();
    const isBrain = key === 'brain';
    const mat = new THREE.MeshPhongMaterial({ color: d.color, transparent: true, opacity: d.opacity, side: THREE.DoubleSide,
      depthWrite: !isBrain && d.opacity > 0.6, shininess: 25 });
    const mesh = new THREE.Mesh(g, mat); mesh.renderOrder = isBrain ? 5 : 1;
    mesh.visible = d.source !== 'expert';
    T.scene.add(mesh); T.meshes[key] = mesh;
  }
  buildLayerControls(data);
  if (!T.framed) frameCamera();
}

function frameCamera() {
  const box = new THREE.Box3();
  const ref = T.meshes.brain || Object.values(T.meshes)[0];
  if (ref) box.setFromObject(ref); else box.setFromPoints([new THREE.Vector3(...toWorld([0, 0, 0])), new THREE.Vector3(...toWorld([S.X, S.Y, S.Z]))]);
  const c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()), r = size.length() / 2;
  T.center = c; T.radius = r;
  T.controls.target.copy(c);
  T.camera.position.set(c.x - r * 0.9, c.y + r * 2.2, c.z + r * 0.9); // anterior-left-superior view
  T.camera.near = r / 50; T.camera.far = r * 20; T.camera.updateProjectionMatrix();
  if (!T.orient) {
    T.orient = new THREE.Group();
    const e = size.clone().multiplyScalar(0.5).addScalar(14);
    [['R', [e.x, 0, 0]], ['L', [-e.x, 0, 0]], ['A', [0, e.y, 0]], ['P', [0, -e.y, 0]], ['S', [0, 0, e.z]], ['I', [0, 0, -e.z]]]
      .forEach(([t, p]) => { const s = textSprite(t); s.position.set(c.x + p[0], c.y + p[1], c.z + p[2]); T.orient.add(s); });
    T.scene.add(T.orient);
  }
  T.framed = true;
}

function update3DCross() {
  if (!T.dot) return;
  const w = toWorld(S.cross); T.dot.position.set(...w);
  const [x, y, z] = S.cross, pts = [
    [0, y, z], [S.X - 1, y, z], [x, 0, z], [x, S.Y - 1, z], [x, y, 0], [x, y, S.Z - 1]].map(toWorld).flat();
  T.lines.geometry.attributes.position.array.set(pts); T.lines.geometry.attributes.position.needsUpdate = true;
  T.lines.geometry.computeBoundingSphere();
}

function buildLayerControls(data) {
  const box = $('#layers'); box.innerHTML = '';
  for (const [key, mesh] of Object.entries(T.meshes)) {
    const d = data[key], row = document.createElement('div'); row.className = 'layer';
    row.innerHTML = `<input type="checkbox" ${mesh.visible ? 'checked' : ''} aria-label="Show ${d.label}">
      <span><i style="background:${d.color}"></i> ${d.label}</span>
      <input type="range" min="0" max="1" step="0.05" value="${mesh.material.opacity}" aria-label="Opacity of ${d.label}">`;
    const [cb, , range] = row.children;
    cb.addEventListener('change', () => { mesh.visible = cb.checked; });
    range.addEventListener('input', () => {
      mesh.material.opacity = Number(range.value);
      mesh.material.depthWrite = key !== 'brain' && mesh.material.opacity > 0.6; mesh.material.needsUpdate = true;
    });
    box.append(row);
  }
  if (!Object.keys(T.meshes).length) box.textContent = 'No surfaces available.';
}

// ------------------------------------------------------------------ tables
function renderTables() {
  const m = S.meta, sp = m.spacing_mm, vox = m.voxel_volume_mm3, mvols = m.volumes.model, ev = m.volumes.expert;
  const wt = mvols ? mvols.WT : null;
  $('#formula').innerHTML =
    `V = N × (Δx × Δy × Δz) = N × (${sp.map((s) => s.toFixed(3)).join(' × ')}) mm³ = N × ${vox.toFixed(3)} mm³ ; ` +
    `mL = mm³ ÷ 1000 (1 mL = 1,000 mm³)` +
    (wt ? `<br>Example, WT: ${wt.voxels.toLocaleString()} × ${vox.toFixed(3)} mm³ = ${wt.mm3.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm³ = ${wt.mL.toFixed(2)} mL` : '');
  const head = ['Region', 'BraTS codes', 'Model N', 'Model mm³', 'Model mL (est.)']
    .concat(ev ? ['Expert N', 'Expert mm³', 'Expert mL', 'Model − expert mL'] : []);
  let html = `<tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr>`;
  for (const r of ['NCR', 'ED', 'ET', 'TC', 'WT']) {
    const a = mvols ? mvols[r] : null, b = ev ? ev[r] : null;
    html += `<tr><td>${r}</td><td>${REGION_CODES[r].join(', ')}</td><td>${a ? a.voxels.toLocaleString() : '—'}</td>` +
      `<td>${a ? a.mm3.toLocaleString(undefined, { maximumFractionDigits: 1 }) : '—'}</td><td><b>${a ? a.mL.toFixed(2) : '—'}</b></td>` +
      (ev ? `<td>${b.voxels.toLocaleString()}</td><td>${b.mm3.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>` +
        `<td><b>${b.mL.toFixed(2)}</b></td><td>${(a.mL - b.mL).toFixed(2)}</td>` : '') + '</tr>';
  }
  $('#vol-table').innerHTML = html;
  const ag = m.agreement;
  $('#agreement').innerHTML = ag ? `<h2 style="margin-top:14px">Agreement with the supplied expert mask (this case)</h2>
    <div class="tablewrap"><table class="grid"><tr><th>Region</th><th>Dice</th><th>Sensitivity</th><th>HD95 (mm)</th></tr>
    ${Object.entries(ag).map(([r, v]) => `<tr><td>${r}</td><td>${fmt(v.dice, 3)}</td><td>${fmt(v.sensitivity, 3)}</td><td>${fmt(v.hd95_mm, 1)}</td></tr>`).join('')}
    </table></div>` : '';
}

function renderTrust(m) {
  const u = m.uncertainty, parts = [];
  if (u) {
    const row = (r) => { const x = u.regions[r]; const dmin = Math.min(...x.dice_vs_main_per_pass);
      return `<tr><td>${r}</td><td>${x.volume_mL_min.toFixed(1)}–${x.volume_mL_max.toFixed(1)}</td><td>${dmin.toFixed(3)}</td></tr>`; };
    parts.push(`<p>Test-time augmentation: the model was re-run on the scan mirrored along each axis (${u.passes} passes).
      <b>${(u.wt_uncertain_fraction * 100).toFixed(1)}%</b> of WT voxels are disputed between passes.</p>
      <table class="kv"><tr><td>Region</td><td>mL range</td><td>min Dice</td></tr>${['WT', 'TC', 'ET'].map(row).join('')}</table>
      <p class="muted">Choose “Uncertainty (TTA, WT)” under Slices to see where.</p>`);
  } else {
    parts.push('<p class="muted">No test-time-augmentation result for this study.</p>');
  }
  if (m.agreement) parts.push(`<p>Against the supplied expert mask: WT Dice <b>${m.agreement.WT.dice.toFixed(3)}</b>.</p>`);
  $('#trust').innerHTML = parts.join('');
  renderAblation(m.ablation);
}

function renderAblation(a) {
  if (!a) { $('#ablation').innerHTML = ''; return; }
  $('#run-ablation').hidden = true;
  const rows = Object.entries(a.removed_sequence).map(([s, v]) =>
    `<tr><td>without ${s.toUpperCase()}</td>${['WT', 'TC', 'ET'].map((r) => `<td>${v[r].dice_vs_full.toFixed(2)}</td>`).join('')}</tr>`).join('');
  $('#ablation').innerHTML = `<p style="margin-top:10px"><b>${a.label}</b></p>
    <table class="kv"><tr><td>Dice vs full input</td><td>WT</td><td>TC</td><td>ET</td></tr>${rows}</table>
    <p class="muted">${a.method}</p>`;
}

function applyMeta(m) {
  S.meta = m;
  [S.X, S.Y, S.Z] = m.canonical_shape; S.sp = m.canonical_spacing_mm;
  S.A = m.canonical_affine; S.Ainv = inv4(S.A); S.Oinv = inv4(m.original_affine);
  $('#backup').hidden = !m.backup;
  if (m.backup) {
    $('#backup').textContent = `PRECOMPUTED BACKUP CASE — ${m.backup.case}, generated ${m.backup.generated_utc} by this ` +
      'pipeline. This is NOT a live run on an uploaded case.';
  }
  const w = m.suitability?.warnings || [];
  $('#warnings').hidden = !w.length;
  $('#warnings').innerHTML = w.length ? `<b>Input suitability warnings</b><ul>${w.map((x) => `<li>${x}</li>`).join('')}</ul>` : '';
  for (const o of $('#overlay').options) {
    if (o.value === 'uncert') o.disabled = !m.has_uncertainty;
    else if (o.value !== 'pred' && o.value !== 'none') o.disabled = !m.has_expert;
  }
  renderTrust(m);
  $('#c-expert-row').hidden = !m.has_expert;
  $('#disclaimer').textContent = m.disclaimer;
  renderTables();
}

// ------------------------------------------------------------------ boot
async function main() {
  $('#study').textContent = studyId;
  $('#lnk-report').href = `/report/${studyId}`; $('#lnk-pdf').href = `/api/report/${studyId}.pdf`;
  $('#lnk-nifti').href = `/api/segmentation/prediction/${studyId}`;
  try {
    applyMeta(await getJSON(`${API}/meta`));
    if (!S.meta.has_prediction) status('No prediction yet — run segmentation from the upload page first.', true);
    status('Loading volumes…');
    await Promise.all([getVol('flair'), S.meta.has_prediction ? getVol('pred') : null, S.meta.has_expert ? getVol('expert') : null]);
    buildSlicePanels();
    init3D();
    setCross(S.meta.lesion_centroid_canonical || [S.X >> 1, S.Y >> 1, S.Z >> 1]);
    status('Building surfaces…');
    buildMeshes(await getJSON(`${API}/meshes`));
    update3DCross();
    status('Ready. Click or drag in any slice, scroll to change slice, or click a 3D surface.');
  } catch (e) { status(`Error: ${e.message}`, true); console.error(e); }
}

$('#bg-seq').addEventListener('change', async (e) => {
  try { status('Loading sequence…'); await getVol(e.target.value); S.bg = e.target.value; setCross(S.cross); status('Ready.'); }
  catch (err) { status(err.message, true); }
});
$('#overlay').addEventListener('change', async (e) => {
  if (e.target.value === 'uncert') {
    try { await getVol('uncert'); } catch (err) { status(err.message, true); return; }
  }
  S.overlay = e.target.value; $('#agree-legend').hidden = !S.overlay.startsWith('agree-');
  $('#uncert-legend').hidden = S.overlay !== 'uncert';
  $('#label-toggles').style.opacity = S.overlay.startsWith('agree-') ? 0.4 : 1; renderAllSlices();
});
$('#ov-alpha').addEventListener('input', (e) => { S.alpha = Number(e.target.value); renderAllSlices(); });
document.querySelectorAll('#label-toggles input').forEach((cb) => cb.addEventListener('change', () => {
  const c = Number(cb.dataset.code); cb.checked ? S.codes.add(c) : S.codes.delete(c); renderAllSlices();
}));
$('#goto-lesion').addEventListener('click', () => S.meta?.lesion_centroid_canonical && setCross(S.meta.lesion_centroid_canonical));
$('#reset-cam').addEventListener('click', () => { T.framed = false; frameCamera(); });
$('#expert-file').addEventListener('change', async (e) => {
  const f = e.target.files[0]; if (!f) return;
  const msg = $('#expert-msg'); msg.textContent = 'Uploading and validating…';
  try {
    const fd = new FormData(); fd.append('file', f);
    await getJSON(`${API}/expert`, { method: 'POST', body: fd });
    delete S.vols.expert;
    applyMeta(await getJSON(`${API}/meta`));
    await getVol('expert');
    buildMeshes(await getJSON(`${API}/meshes`));
    setCross(S.cross);
    msg.textContent = 'Expert mask attached. Choose "Expert mask" or "Agreement" under Slices; expert surfaces are in 3D layers.';
  } catch (err) { msg.textContent = `Rejected: ${err.message}`; }
  e.target.value = '';
});
$('#run-ablation').addEventListener('click', async (e) => {
  e.target.disabled = true; e.target.textContent = 'Running 5 passes…';
  try { renderAblation(await getJSON(`${API}/ablation`, { method: 'POST' })); }
  catch (err) { $('#ablation').textContent = err.message; e.target.disabled = false; e.target.textContent = 'Run modality ablation'; }
});
window.addEventListener('resize', layoutSlices);
main();
