// 3D fly-through of the National Mall and its museums, for the DC chapter.
// Loaded only when someone presses "Fly through the museums".
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const overlay = document.getElementById("fly");
const canvas = overlay.querySelector("canvas");
const placeEl = overlay.querySelector(".fly-place");
const blurbEl = overlay.querySelector(".fly-blurb");
const barEl = overlay.querySelector(".fly-bar span");
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- where things are (the camera flies toward -z) ----------
const STOPS = [
  { from: 40, to: -28, name: "The National Mall", blurb: "Two little French girls, one very big city." },
  { from: -28, to: -92, name: "National Air and Space Museum", blurb: "Planes over our heads and a rocket taller than everyone." },
  { from: -92, to: -168, name: "Washington Monument", blurb: "The tallest thing we had ever seen." },
  { from: -168, to: -232, name: "National Museum of Natural History", blurb: "Saying hello to the giant elephant." },
  { from: -232, to: -298, name: "Smithsonian Castle", blurb: "A real castle, right in the middle of the city." },
  { from: -298, to: -362, name: "National Gallery of Art", blurb: "Picking our favorite paintings." },
  { from: -362, to: -999, name: "U.S. Capitol", blurb: "The end of the trip, and the start of a lot more." },
];

// outdoor landmarks the camera turns toward as it passes them
const FOCUS = [new THREE.Vector3(0, 20, -132), new THREE.Vector3(-27, 12, -268)];

const PATH = new THREE.CatmullRomCurve3([
  [0, 6, 30], [0, 6, 0], [0, 5.5, -40], [0, 6.5, -80], [-2, 9, -108], [-9, 11, -132],
  [-3, 9, -158], [0, 8, -180], [0, 11, -200], [0, 8, -220], [0, 7, -245], [2, 8, -268],
  [0, 7, -290], [0, 5.5, -315], [0, 5.5, -345], [0, 7, -375], [0, 11, -405], [0, 13, -425],
].map((p) => new THREE.Vector3(...p)));

// ---------- scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color("#bcdcff");
scene.fog = new THREE.Fog("#bcdcff", 60, 260);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);

scene.add(new THREE.HemisphereLight("#ffffff", "#8a9a6a", 2.2));
const sun = new THREE.DirectionalLight("#fff3dd", 1.6);
sun.position.set(40, 80, 30);
scene.add(sun);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const M = {
  stone: mat("#efe9df"),
  marble: mat("#f7f4ee"),
  grass: mat("#8fbf6a"),
  gravel: mat("#e8dcc0"),
  wood: mat("#a87b50"),
  glass: mat("#9fd3ff", { transparent: true, opacity: 0.28, depthWrite: false, roughness: 0.2 }),
  gold: mat("#c9a227", { metalness: 0.5, roughness: 0.4 }),
  brick: mat("#9b4a3c"),
  roof: mat("#5a3a35"),
  leaf: mat("#5e9e4f"),
  trunk: mat("#7a5434"),
  elephant: mat("#9a948c"),
  green: mat("#6f9e8a"),
  white: mat("#ffffff"),
  red: mat("#d62839"),
  navy: mat("#1d3557"),
};

function box(w, h, d, material, x, y, z, parent = scene) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
function cyl(rTop, rBot, h, material, x, y, z, parent = scene, seg = 16) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), material);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

// ground, the gravel walk down the middle, trees along both sides
box(400, 0.2, 900, M.grass, 0, -0.1, -250);
box(18, 0.22, 900, M.gravel, 0, -0.09, -250);
for (let z = 40; z > -440; z -= 18) {
  for (const x of [-24, 24, -34, 34]) {
    if (x < 0 && z < -245 && z > -292) continue; // leave room for the castle
    cyl(0.5, 0.6, 4, M.trunk, x, 2, z);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(3.2, 12, 10), M.leaf);
    crown.position.set(x, 6, z);
    scene.add(crown);
  }
}

// a long hall the path passes straight through, with a doorway at each end
function hall({ z, len = 60, width = 30, height = 14, wall = M.stone, floor = M.stone, ceiling = wall, columns = true }) {
  const g = new THREE.Group();
  const front = z + len / 2, back = z - len / 2, half = width / 2;
  box(width, 0.3, len, floor, 0, 0.05, z, g);
  box(width, 0.5, len, ceiling, 0, height, z, g);
  box(1, height, len, wall, -half, height / 2, z, g);
  box(1, height, len, wall, half, height / 2, z, g);
  const door = 14, doorH = 11, side = (width - door) / 2;
  for (const zz of [front, back]) {
    box(side, height, 1, wall, -(door / 2 + side / 2), height / 2, zz, g);
    box(side, height, 1, wall, door / 2 + side / 2, height / 2, zz, g);
    box(door, height - doorH, 1, wall, 0, doorH + (height - doorH) / 2, zz, g);
  }
  if (columns) {
    for (const x of [-14, -11.5, -9, 9, 11.5, 14]) cyl(0.6, 0.6, height, M.marble, x, height / 2, front + 2.5, g);
    box(width + 2, 1.2, 4, M.marble, 0, height + 0.4, front + 2.5, g);
  }
  scene.add(g);
  return g;
}

// ---------- National Air and Space Museum ----------
{
  const z = -60;
  hall({ z, wall: M.glass, ceiling: M.glass, floor: M.stone, columns: false });
  function plane(color, x, y, zz, bank) {
    const p = new THREE.Group();
    const body = mat(color);
    const fus = cyl(0.8, 0.6, 9, body, 0, 0, 0, p);
    fus.rotation.z = Math.PI / 2;
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.8, 1.6, 16), body);
    nose.rotation.z = -Math.PI / 2;
    nose.position.x = 5.3;
    p.add(nose);
    box(2.4, 0.2, 12, body, 0.5, 0, 0, p);
    box(1.2, 0.2, 4, body, -4, 0.2, 0, p);
    box(1.2, 1.8, 0.2, body, -4, 1, 0, p);
    p.position.set(x, y, zz);
    p.rotation.set(bank, 0.5, 0);
    scene.add(p);
  }
  plane("#f2c14e", -5, 10.5, z + 12, 0.25);
  plane("#d62839", 6, 9.5, z - 14, -0.2);
  // standing rocket
  cyl(0.9, 0.9, 9, M.white, 10, 4.5, z - 2);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 16), M.red);
  tip.position.set(10, 10.2, z - 2);
  scene.add(tip);
  for (let i = 0; i < 4; i++) {
    const fin = box(0.15, 2, 1.4, M.navy, 10, 1, z - 2);
    fin.geometry.translate(0, 0, 0.9);
    fin.rotation.y = (i * Math.PI) / 2;
  }
  // hanging earth
  const earth = new THREE.Mesh(new THREE.SphereGeometry(2, 24, 16), mat("#3d7bd9", { emissive: "#123a7a", emissiveIntensity: 0.4 }));
  earth.position.set(-9, 6, z - 16);
  scene.add(earth);
}

// ---------- Washington Monument ----------
{
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 2.8, 52, 4), M.marble);
  shaft.rotation.y = Math.PI / 4;
  shaft.position.set(0, 26, -132);
  scene.add(shaft);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(1.8 * Math.SQRT1_2 * 1.42, 4, 4), M.marble);
  cap.rotation.y = Math.PI / 4;
  cap.position.set(0, 54, -132);
  scene.add(cap);
  // ring of flags
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const x = Math.cos(a) * 7, zz = -132 + Math.sin(a) * 7;
    cyl(0.08, 0.08, 6, M.white, x, 3, zz, scene, 6);
    box(1.6, 0.9, 0.05, i % 2 ? M.red : M.navy, x + 0.8, 5.4, zz);
  }
}

// ---------- National Museum of Natural History ----------
{
  const z = -200;
  hall({ z, height: 18, wall: M.stone, floor: mat("#c9b99a") });
  // green dome on the roof, seen on the way in
  cyl(8, 8, 3, M.stone, 0, 19.5, z);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.green);
  dome.position.set(0, 21, z);
  scene.add(dome);
  // the elephant, in the middle of the rotunda
  const e = new THREE.Group();
  box(6, 3.6, 3.4, M.elephant, 0, 4.6, 0, e);
  for (const [x, zz] of [[-2.2, -1.1], [-2.2, 1.1], [2.2, -1.1], [2.2, 1.1]]) cyl(0.6, 0.6, 3, M.elephant, x, 1.5, zz, e);
  box(2.2, 2.4, 2.4, M.elephant, 3.8, 5.6, 0, e);
  for (const zz of [-1.6, 1.6]) box(1.6, 2.2, 0.15, M.elephant, 3.4, 5.6, zz, e);
  const trunk = cyl(0.35, 0.5, 3.4, M.elephant, 5.1, 3.8, 0, e);
  trunk.rotation.z = 0.2;
  for (const zz of [-0.7, 0.7]) {
    const tusk = cyl(0.12, 0.2, 1.6, M.white, 5, 4.4, zz, e, 8);
    tusk.rotation.z = 1.1;
  }
  box(8, 0.6, 5, M.marble, 0, 0.3, 0, e); // pedestal
  e.position.set(0, 0.3, z);
  e.rotation.y = Math.PI / 2;
  scene.add(e);
  // glass cases with gems along the walls
  const gemColors = ["#e6399b", "#3fd0c9", "#8f5cff", "#ffd23f"];
  for (let i = 0; i < 4; i++) {
    for (const x of [-12, 12]) {
      const zz = z + 20 - i * 13;
      box(3, 2, 3, M.wood, x, 1, zz);
      box(3, 2, 3, M.glass, x, 3, zz);
      const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.7), mat(gemColors[i], { emissive: gemColors[i], emissiveIntensity: 0.5, roughness: 0.2 }));
      gem.position.set(x, 3, zz);
      gem.userData.spin = true;
      scene.add(gem);
    }
  }
}

// ---------- Smithsonian Castle ----------
{
  const g = new THREE.Group();
  box(34, 10, 10, M.brick, 0, 5, 0, g);
  const towers = [[-17, 18, 3.6], [-8, 14, 3], [0, 22, 4], [9, 15, 3], [17, 17, 3.4]];
  for (const [x, h, w] of towers) {
    box(w, h, w, M.brick, x, h / 2, 0, g);
    const top = new THREE.Mesh(new THREE.ConeGeometry(w * 0.75, w * 1.3, 4), M.roof);
    top.rotation.y = Math.PI / 4;
    top.position.set(x, h + w * 0.65, 0);
    g.add(top);
  }
  g.position.set(-27, 0, -268);
  g.rotation.y = Math.PI / 2;
  scene.add(g);
}

// ---------- National Gallery of Art ----------
{
  const z = -330;
  hall({ z, wall: mat("#f4efe6"), floor: M.wood, ceiling: mat("#fbf8f2") });
  const palettes = [
    ["#264653", "#e9c46a", "#f4a261", "#e76f51"], ["#ffcad4", "#b0d0d3", "#c08497", "#f7af9d"],
    ["#003049", "#d62828", "#f77f00", "#fcbf49"], ["#2b9348", "#80b918", "#d4d700", "#55a630"],
    ["#5f0f40", "#9a031e", "#fb8b24", "#e36414"], ["#03045e", "#0077b6", "#00b4d8", "#90e0ef"],
    ["#ffbe0b", "#fb5607", "#ff006e", "#8338ec"], ["#ccd5ae", "#e9edc9", "#faedcd", "#d4a373"],
  ];
  palettes.forEach((pal, i) => {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 192;
    const x = c.getContext("2d");
    x.fillStyle = pal[0]; x.fillRect(0, 0, 256, 192);
    let seed = i * 97 + 13;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let k = 0; k < 14; k++) {
      x.fillStyle = pal[1 + (k % 3)];
      x.globalAlpha = 0.85;
      if (k % 2) { x.beginPath(); x.arc(rnd() * 256, rnd() * 192, 10 + rnd() * 40, 0, Math.PI * 2); x.fill(); }
      else x.fillRect(rnd() * 256, rnd() * 192, 20 + rnd() * 80, 10 + rnd() * 50);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const left = i % 2 === 0;
    const zz = z + 21 - Math.floor(i / 2) * 14;
    const xw = left ? -14.4 : 14.4;
    const frame = box(0.3, 4.6, 6, M.gold, xw, 6, zz);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 4), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
    art.position.set(left ? xw + 0.2 : xw - 0.2, 6, zz);
    art.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
    scene.add(art);
  });
  for (const zz of [z + 14, z, z - 14]) box(5, 0.8, 1.6, M.wood, 0, 0.6, zz);
}

// ---------- U.S. Capitol ----------
{
  const g = new THREE.Group();
  box(90, 12, 26, M.marble, 0, 6, 0, g);
  box(36, 16, 30, M.marble, 0, 8, 0, g);
  for (let i = 0; i < 10; i++) cyl(0.7, 0.7, 14, M.white, -13.5 + i * 3, 7, 16, g);
  cyl(11, 11, 9, M.marble, 0, 20.5, 0, g, 32);
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    cyl(0.4, 0.4, 7, M.white, Math.cos(a) * 11.6, 20, Math.sin(a) * 11.6, g, 8);
  }
  const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.marble);
  dome.position.y = 25;
  dome.scale.y = 1.25;
  g.add(dome);
  cyl(1.8, 2.2, 5, M.white, 0, 39, 0, g);
  const tipCap = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 8), M.white);
  tipCap.position.y = 42;
  g.add(tipCap);
  g.position.set(0, 0, -480);
  scene.add(g);
}

// ---------- the two little girls, flying just ahead of the camera ----------
const GIRLS = [
  { skin: "#f6d2b8", hair: "#6b3e26", dress: "#ff7aa2", shoe: "#c2185b", beret: "#d62839" },
  { skin: "#f3c9a8", hair: "#f2c14e", dress: "#6fb6ff", shoe: "#1565c0", beret: "#1d3557" },
];
const girlSprites = [];
const art = document.getElementById("girl").innerHTML;
GIRLS.forEach((colors, i) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 120" width="240" height="480">${art.replace(/var\(--(\w+)\)/g, (_, k) => colors[k] || "#000")}</svg>`;
  const img = new Image();
  const c = document.createElement("canvas");
  c.width = 240; c.height = 480;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  img.onload = () => { c.getContext("2d").drawImage(img, 0, 0, 240, 480); tex.needsUpdate = true; };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sprite.scale.set(1.5, 3, 1);
  scene.add(sprite);
  girlSprites.push(sprite);
});

// ---------- flying ----------
let t = 0, target = 0, lastInput = -1e9, running = false, lastFrame = 0, currentStop = null;
const nudge = (d) => { target = Math.min(1, Math.max(0, target + d)); lastInput = performance.now(); };

overlay.addEventListener("wheel", (e) => {
  e.preventDefault();
  const px = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
  nudge(px * 0.00015);
}, { passive: false });
let dragY = null;
overlay.addEventListener("pointerdown", (e) => { if (e.target === canvas) dragY = e.clientY; });
addEventListener("pointermove", (e) => {
  if (dragY === null) return;
  nudge((dragY - e.clientY) * 0.0008);
  dragY = e.clientY;
});
addEventListener("pointerup", () => (dragY = null));
addEventListener("keydown", (e) => {
  if (overlay.hidden) return;
  if (["ArrowUp", "ArrowRight", " "].includes(e.key)) { e.preventDefault(); nudge(0.02); }
  if (["ArrowDown", "ArrowLeft"].includes(e.key)) { e.preventDefault(); nudge(-0.02); }
  if (e.key === "Escape") close();
});
overlay.querySelector(".fly-close").addEventListener("click", close);

function resize() {
  const w = overlay.clientWidth, h = overlay.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
addEventListener("resize", () => running && resize());

const pos = new THREE.Vector3(), tan = new THREE.Vector3(), look = new THREE.Vector3();
const side = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const smoothLook = new THREE.Vector3(), toFocus = new THREE.Vector3();

function frame(now) {
  if (!running) return;
  const dt = Math.min(50, now - (lastFrame || now)) / 16.7;
  lastFrame = now;

  // drift forward on its own unless someone is steering
  if (!reduceMotion && now - lastInput > 2500 && target < 1) target = Math.min(1, target + 0.00042 * dt);
  t += (target - t) * Math.min(1, 0.08 * dt);

  PATH.getPointAt(t, pos);
  PATH.getTangentAt(t, tan);
  camera.position.copy(pos);
  look.copy(pos).addScaledVector(tan, 10);
  look.y -= 0.8;
  for (const f of FOCUS) {
    const near = Math.max(0, 1 - Math.abs(pos.z - 32 - f.z) / 45); // peaks just before passing it
    if (!near) continue;
    toFocus.subVectors(f, pos).setLength(10).add(pos);
    look.lerp(toFocus, 0.45 * near * near * (3 - 2 * near));
  }
  if (!smoothLook.lengthSq()) smoothLook.copy(look);
  smoothLook.lerp(look, Math.min(1, 0.1 * dt));
  camera.lookAt(smoothLook);

  // girls side by side, a little ahead, bobbing as they fly
  const ahead = Math.min(1, t + 0.03);
  const gp = PATH.getPointAt(ahead);
  side.crossVectors(PATH.getTangentAt(ahead), up).normalize();
  girlSprites.forEach((s, i) => {
    s.position.copy(gp).addScaledVector(side, i ? 1.1 : -1.1);
    s.position.y += -1.2 + Math.sin(now / 400 + i * 1.7) * 0.25;
  });

  scene.traverse((o) => { if (o.userData.spin) o.rotation.y += 0.02 * dt; });

  const stop = STOPS.find((s) => pos.z <= s.from && pos.z > s.to) || STOPS[STOPS.length - 1];
  if (stop !== currentStop) {
    currentStop = stop;
    placeEl.textContent = stop.name;
    blurbEl.textContent = stop.blurb;
    placeEl.parentElement.classList.remove("show");
    void placeEl.offsetWidth; // restart the fade-in
    placeEl.parentElement.classList.add("show");
  }
  barEl.style.width = (t * 100).toFixed(1) + "%";

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

export function open() {
  overlay.hidden = false;
  document.body.style.overflow = "hidden";
  t = target = 0;
  smoothLook.set(0, 0, 0);
  lastInput = -1e9;
  currentStop = null;
  resize();
  running = true;
  lastFrame = 0;
  requestAnimationFrame(frame);
  overlay.querySelector(".fly-close").focus();
}

function close() {
  running = false;
  overlay.hidden = true;
  document.body.style.overflow = "";
}
