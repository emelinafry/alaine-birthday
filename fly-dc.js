// 3D overview of Washington, DC from above, built from real OpenStreetMap data
// (buildings, water, parks and streets). The data is baked into data/ by
// tools/bake-dc-map.py, so the site doesn't depend on a map service.
// Loaded only when someone presses the fly button on the DC chapter.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const overlay = document.getElementById("fly");
const canvas = overlay.querySelector("canvas");
const placeEl = overlay.querySelector(".fly-place");
const blurbEl = overlay.querySelector(".fly-blurb");
const labelLayer = overlay.querySelector(".fly-labels");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

const [map, groundTex] = await Promise.all([
  fetch("data/dc-map.json").then((r) => r.json()),
  new THREE.TextureLoader().loadAsync("data/dc-ground.jpg"),
]);
const [W, H] = map.size;

// ---------- renderer, scene, light ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate = false; // the city never moves, so draw shadows once

const scene = new THREE.Scene();
const SKY = new THREE.Color("#cfe3f5");
scene.background = SKY;
scene.fog = new THREE.Fog("#e4e4dc", 3200, 9000);

const camera = new THREE.PerspectiveCamera(45, 1, 10, 30000);

scene.add(new THREE.HemisphereLight("#ffffff", "#b9b2a2", 1.9));
const sun = new THREE.DirectionalLight("#fff4e2", 2.2);
sun.position.set(-1800, 2600, 1400);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
Object.assign(sun.shadow.camera, { left: -W / 2, right: W / 2, top: H / 2 + 400, bottom: -H / 2 - 400, near: 100, far: 7000 });
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 1.5;
scene.add(sun);

// ---------- ground: the baked map image, with plain land fading out around it ----------
groundTex.colorSpace = THREE.SRGBColorSpace;
groundTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
const ground = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1 }));
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);
const surround = new THREE.Mesh(new THREE.PlaneGeometry(60000, 60000), new THREE.MeshStandardMaterial({ color: "#e9e3d6", roughness: 1 }));
surround.rotation.x = -Math.PI / 2;
surround.position.y = -0.5;
scene.add(surround);

// ---------- buildings: every footprint extruded to its real height, merged into one mesh ----------
const PALETTE = ["#f3efe6", "#efe9de", "#f6f3ec", "#ebe4d7", "#f1ece2"].map((c) => new THREE.Color(c));
const STONE = new THREE.Color("#fbf8f1");
const DOME = new THREE.Color("#f7f5ef");

function paint(geo, colour) {
  const n = geo.attributes.position.count;
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colour.toArray(c, i * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(c, 3));
  return geo;
}
function shapeFrom(flat) {
  // map z (south) -> shape y = -z, so after rotating the extrusion upright it lands back on z
  const pts = [];
  for (let i = 0; i < flat.length; i += 2) pts.push(new THREE.Vector2(flat[i], -flat[i + 1]));
  return pts;
}

const geos = [];
map.buildings.forEach((b, i) => {
  const base = b.m || 0;
  const dome = b.d || 0;
  const wall = Math.max(1, b.h - dome - base);
  const shape = new THREE.Shape(shapeFrom(b.o));
  (b.i || []).forEach((hole) => shape.holes.push(new THREE.Path(shapeFrom(hole))));
  const g = new THREE.ExtrudeGeometry(shape, { depth: wall, bevelEnabled: false });
  g.rotateX(-Math.PI / 2);
  g.translate(0, base, 0);
  geos.push(paint(g, b.c ? STONE : PALETTE[i % PALETTE.length]));

  if (dome) {
    let cx = 0, cz = 0, n = b.o.length / 2;
    for (let k = 0; k < b.o.length; k += 2) { cx += b.o[k]; cz += b.o[k + 1]; }
    cx /= n; cz /= n;
    let r = 0;
    for (let k = 0; k < b.o.length; k += 2) r += Math.hypot(b.o[k] - cx, b.o[k + 1] - cz);
    r /= n;
    const s = new THREE.SphereGeometry(r, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2).toNonIndexed();
    s.scale(1, dome / r, 1);
    s.translate(cx, base + wall, cz);
    geos.push(paint(s, DOME));
  }
});

// the Washington Monument: a tapered marble shaft with a pyramid on top
for (const o of map.obelisks) {
  const half = o.w / 2, cap = o.h * 0.1;
  const shaft = new THREE.CylinderGeometry(half * 0.7 * Math.SQRT2, half * Math.SQRT2, o.h - cap, 4, 1).toNonIndexed();
  shaft.rotateY(Math.PI / 4);
  shaft.translate(o.x, (o.h - cap) / 2, o.z);
  const top = new THREE.ConeGeometry(half * 0.7 * Math.SQRT2, cap, 4).toNonIndexed();
  top.rotateY(Math.PI / 4);
  top.translate(o.x, o.h - cap / 2, o.z);
  geos.push(paint(shaft, STONE), paint(top, STONE));
}

for (const g of geos) { g.deleteAttribute("uv"); }
const city = new THREE.Mesh(mergeGeometries(geos), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
city.castShadow = city.receiveShadow = true;
scene.add(city);
geos.forEach((g) => g.dispose());
renderer.shadowMap.needsUpdate = true;

// ---------- landmark labels: HTML tags that follow their spot on the map ----------
const labels = map.labels.map((l) => {
  const el = document.createElement("div");
  el.className = "fly-tag";
  el.textContent = l.name;
  labelLayer.append(el);
  const y = l.name === "Washington Monument" ? 185 : l.name === "U.S. Capitol" ? 95 : 40;
  return { el, p: new THREE.Vector3(l.x, y, l.z) };
});
const v = new THREE.Vector3();
function placeLabels() {
  const w = overlay.clientWidth, h = overlay.clientHeight;
  for (const l of labels) {
    v.copy(l.p).project(camera);
    const visible = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    l.el.style.opacity = visible ? 1 : 0;
    if (visible) l.el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
  }
}

// ---------- camera: swoop down from high above, then drift slowly around the Mall ----------
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 250;
controls.maxDistance = 4500;
controls.maxPolarAngle = 1.25; // never go below the rooftops
controls.autoRotate = !reduceMotion;
controls.autoRotateSpeed = 0.35;
controls.screenSpacePanning = false;
const LIMIT_X = W / 2, LIMIT_Z = H / 2;
controls.addEventListener("change", () => {
  controls.target.x = THREE.MathUtils.clamp(controls.target.x, -LIMIT_X, LIMIT_X);
  controls.target.z = THREE.MathUtils.clamp(controls.target.z, -LIMIT_Z, LIMIT_Z);
  controls.target.y = 0;
});
controls.addEventListener("start", () => (intro = null));

const FROM = new THREE.Vector3(0, 7500, 600);
const TO = new THREE.Vector3(-350, 1750, 1450);
const LOOK = new THREE.Vector3(-150, 0, 0); // just east of the Washington Monument, the middle of the Mall
let intro = null;

function resize() {
  const w = overlay.clientWidth, h = overlay.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // phones are tall and narrow: pull back so the whole Mall still fits across
  camera.fov = w < h ? 60 : 45;
  camera.updateProjectionMatrix();
}
addEventListener("resize", () => running && resize());

let running = false;
function frame(now) {
  if (!running) return;
  if (intro) {
    const k = Math.min(1, (now - intro) / 4500);
    const e = 1 - Math.pow(1 - k, 3);
    camera.position.lerpVectors(FROM, TO, e);
    controls.target.copy(LOOK);
    if (k === 1) intro = null;
  }
  controls.update();
  renderer.render(scene, camera);
  placeLabels();
  requestAnimationFrame(frame);
}

overlay.querySelector(".fly-close").addEventListener("click", close);
addEventListener("keydown", (e) => { if (!overlay.hidden && e.key === "Escape") close(); });

export function open() {
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  placeEl.textContent = "Washington, DC";
  blurbEl.textContent = "Where our first big trip together began.";
  placeEl.parentElement.classList.remove("show");
  void placeEl.offsetWidth;
  placeEl.parentElement.classList.add("show");
  resize();
  controls.target.copy(LOOK);
  if (reduceMotion) { camera.position.copy(TO); intro = null; }
  else { camera.position.copy(FROM); intro = performance.now(); }
  running = true;
  requestAnimationFrame(frame);
  overlay.querySelector(".fly-close").focus();
}

function close() {
  running = false;
  overlay.hidden = true;
  document.body.style.overflow = "";
}
