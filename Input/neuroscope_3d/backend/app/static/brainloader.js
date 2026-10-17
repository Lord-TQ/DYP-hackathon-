// Loading illustration for the analyse page: a stylised brain that builds up slab by slab as the run progresses.
// Procedural geometry only (two hemispheres, temporal lobes, cerebellum, brainstem). It is not drawn from any scan.
import * as THREE from '/static/vendor/three.module.js';

const Z0 = -0.75, Z1 = 0.62, N = 72;                    // vertical extent and number of slabs
const H = (Z1 - Z0) / N;
const ACCENT = new THREE.Color('#c8402a');
const TONE = { cerebrum: '#e9dccb', temporal: '#e3d3bd', cerebellum: '#d6c0a2', stem: '#c9b293' };

// closed outline of an ellipse-like lobe, with optional ripples for gyri
function lobe(cx, cy, ax, ay, ripple, z, n = 2.3, pts = 110) {
  const out = [];
  for (let k = 0; k < pts; k++) {
    const t = (k / pts) * 2 * Math.PI, c = Math.cos(t), s = Math.sin(t);
    let r = Math.pow(Math.pow(Math.abs(c) / ax, n) + Math.pow(Math.abs(s) / ay, n), -1 / n);
    if (ripple) r *= 1 + ripple * (0.6 * Math.sin(13 * t + 9 * z) + 0.4 * Math.sin(23 * t - 14 * z + 1.3));
    out.push(new THREE.Vector2(cx + r * c, cy + r * s));
  }
  return new THREE.Shape(out);
}

// cross-sections at height z: [{ region, shape }]
function sections(z) {
  const out = [];
  const u = (z + 0.3) / 0.92;                              // cerebrum: z in [-0.3, 0.62]
  if (u >= 0 && u < 1) {
    const s = Math.sqrt(Math.max(0, 1 - ((u - 0.45) / 0.6) ** 2));
    const ax = 0.355 * s, ay = 0.84 * s;
    for (const side of [-1, 1]) out.push({ region: 'cerebrum', shape: lobe(side * (0.016 + ax * 0.97), 0.02, ax, ay, 0.045, z) });
  }
  if (z >= -0.48 && z < -0.3) {                            // temporal lobes, low and forward
    const s = Math.sqrt(Math.max(0, 1 - ((z + 0.3) / 0.18) ** 2));
    for (const side of [-1, 1]) out.push({ region: 'temporal', shape: lobe(side * 0.34, 0.1, 0.24 * s, 0.4 * s, 0.035, z) });
  }
  if (z >= -0.6 && z < -0.27) {                            // cerebellum, low and behind
    const s = Math.sqrt(Math.max(0, 1 - ((z + 0.435) / 0.165) ** 2));
    out.push({ region: 'cerebellum', shape: lobe(0, -0.5, 0.46 * s, 0.26 * s, 0, z) });
  }
  if (z < -0.32) {                                         // brainstem
    const r = 0.1 + 0.03 * ((z + 0.75) / 0.43);
    out.push({ region: 'stem', shape: lobe(0, -0.2 + 0.12 * (z + 0.32), r, r * 0.9, 0, z, 2, 48) });
  }
  return out;
}

export function createBrain(canvas) {
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); } catch { return null; }
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(3.15, 1.75, 3.35);
  camera.lookAt(0, -0.06, 0);
  scene.add(new THREE.HemisphereLight(0xfff1e0, 0x1b1a17, 1.15));
  const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(2, 3, 2); scene.add(key);
  const rim = new THREE.DirectionalLight(0xc8402a, 0.7); rim.position.set(-2, 1, -2.5); scene.add(rim);

  const group = new THREE.Group();
  group.position.y = -(Z0 + Z1) / 2;
  scene.add(group);

  // slabs, bottom to top; each grows upward from its own floor
  const layers = [];
  for (let i = 0; i < N; i++) {
    const y = Z0 + i * H, mats = [];
    const node = new THREE.Group(); node.position.y = y; node.visible = false;
    for (const { region, shape } of sections(y + H / 2)) {
      const g = new THREE.ExtrudeGeometry(shape, { depth: H * 0.8, bevelEnabled: false, curveSegments: 4 });
      g.rotateX(-Math.PI / 2);
      const m = new THREE.MeshStandardMaterial({ color: TONE[region], roughness: 0.78, metalness: 0, emissive: ACCENT, emissiveIntensity: 0 });
      mats.push(m);
      node.add(new THREE.Mesh(g, m));
    }
    group.add(node);
    layers.push({ node, mats });
  }

  // the build plane: a faint disc with an accent rim that rides on top of the newest slab
  const plane = new THREE.Group();
  plane.add(new THREE.Mesh(new THREE.CircleGeometry(1.1, 72).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.08, depthWrite: false, side: THREE.DoubleSide })));
  const ring = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 97 }, (_, k) => {
    const t = (k / 96) * 2 * Math.PI; return new THREE.Vector3(1.1 * Math.cos(t), 0, 1.1 * Math.sin(t));
  }));
  const ringMat = new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.7 });
  plane.add(new THREE.Line(ring, ringMat));
  group.add(plane);
  const floor = new THREE.PolarGridHelper(1.1, 12, 4, 72, 0x4a443b, 0x2c2924);
  floor.position.y = Z0 - 0.002;
  group.add(floor);

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fit() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    const dpr = renderer.getPixelRatio();
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
  }

  // p in [0, 1]: fraction of the brain built; t: time in ms (for the slow turn)
  function draw(p, t) {
    fit();
    const built = p * N;
    for (let i = 0; i < N; i++) {
      const { node, mats } = layers[i], f = Math.min(1, Math.max(0, built - i));
      node.visible = f > 0.02;
      node.scale.y = Math.max(0.001, f);
      const glow = f <= 0 ? 0 : Math.max(0, 1 - (built - i - 1) / 3) * 0.55;      // newest slabs glow, then cool
      for (const m of mats) m.emissiveIntensity = p >= 0.999 ? 0 : glow;
    }
    plane.position.y = Z0 + Math.min(N, built) * H * 1.0 + 0.004;
    plane.visible = p < 0.999;
    ringMat.opacity = 0.35 + 0.35 * Math.sin(t / 260) ** 2;
    if (!still) group.rotation.y = t * 0.00032;
    renderer.render(scene, camera);
  }

  return { draw };
}
