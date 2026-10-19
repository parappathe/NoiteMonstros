// Cenários das 3 fases, monstros, chefes, revólver e efeitos. Tudo gerado por código.
import * as THREE from '../vendor/three/three.module.js';
import { STAGES, relPoint, nodeYaw } from './levels.js';

function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}
function rand(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function noiseFill(g, w, h, base, spots, alpha = 0.25) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < w * h / 40; i++) {
    g.fillStyle = spots[i % spots.length].replace('A', String(Math.random() * alpha));
    g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2 + Math.random() * 3);
  }
}

// Distância de um ponto ao caminho (para não pôr túmulo em cima da trilha).
function distToPath(path, x, z) {
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const [ax, az] = path[i], [bx, bz] = path[i + 1];
    const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    best = Math.min(best, Math.hypot(x - (ax + dx * t), z - (az + dz * t)));
  }
  return best;
}

const THEMES = [
  { fog: 0x0b1020, near: 3, far: 30, hemi: [0x5c6c9c, 0x1a1410, 0.55], moon: true },
  { fog: 0x140c08, near: 3, far: 24, hemi: [0x8a6a50, 0x1a100a, 0.8] },
  { fog: 0x06140c, near: 3, far: 24, hemi: [0x5aa080, 0x0a1410, 0.75] },
];

// Monta o cenário de uma fase. Devolve {group, theme, props: Map(id → mesh), update(time)}.
export function buildStage(index, propsData) {
  const S = STAGES[index];
  const T = THEMES[index];
  const g = new THREE.Group();
  const r = rand(100 + index);
  const anim = [];
  g.add(new THREE.HemisphereLight(T.hemi[0], T.hemi[1], T.hemi[2]));

  if (index === 0) buildCemetery(g, S, r, anim);
  else if (index === 1) buildMansion(g, S, r, anim);
  else buildLab(g, S, r, anim);

  // Coisas quebráveis.
  const props = new Map();
  for (const p of propsData) {
    const m = makeProp(p.kind);
    m.position.set(p.x, p.y, p.z);
    g.add(m);
    props.set(p.id, m);
  }
  return { group: g, theme: T, props, update(time) { for (const f of anim) f(time); } };
}

function addWallsAlong(g, S, mat, height, offset, trim) {
  const p = S.path;
  for (let i = 0; i < p.length - 1; i++) {
    const [ax, az] = p[i], [bx, bz] = p[i + 1];
    const len = Math.hypot(bx - ax, bz - az) - trim * 2;
    if (len < 3) continue; // pedaço curto vira "pilar" no meio da visão: melhor sem
    const yaw = Math.atan2(-(bx - ax), -(bz - az));
    const cx = (ax + bx) / 2, cz = (az + bz) / 2;
    for (const side of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(0.3, height, len), mat);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      w.position.set(cx + rx * offset * side, height / 2, cz + rz * offset * side);
      w.rotation.y = yaw;
      g.add(w);
    }
  }
}

// ---------- Fase 1: cemitério ----------
function buildCemetery(g, S, r, anim) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), new THREE.MeshLambertMaterial({
    map: canvasTex(256, 256, (c, w, h) => noiseFill(c, w, h, '#1e2416', ['rgba(60,50,30,A)', 'rgba(10,20,10,A)', 'rgba(80,90,60,A)'], 0.5), [30, 30]),
  }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(0, 0, -30);
  g.add(ground);
  // Trilha de terra.
  const dirt = new THREE.MeshLambertMaterial({ color: 0x3a2c1c });
  for (let i = 0; i < S.path.length - 1; i++) {
    const [ax, az] = S.path[i], [bx, bz] = S.path[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.2, len + 2.2), dirt);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.atan2(-(bx - ax), -(bz - az));
    m.position.set((ax + bx) / 2, 0.01, (az + bz) / 2);
    g.add(m);
  }
  // Túmulos (instanciados).
  const spots = [];
  for (let i = 0; i < 400 && spots.length < 140; i++) {
    const x = -20 + r() * 44, z = 6 - r() * 76;
    const d = distToPath(S.path, x, z);
    if (d < 2.2 || d > 16) continue;
    spots.push([x, z]);
  }
  const stoneMat = new THREE.MeshLambertMaterial({ color: 0x7d7d78 });
  const graveGeo = new THREE.BoxGeometry(0.6, 0.9, 0.14); graveGeo.translate(0, 0.45, 0);
  const capGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.14, 12, 1, false, 0, Math.PI); capGeo.rotateX(Math.PI / 2); capGeo.rotateZ(Math.PI / 2); capGeo.translate(0, 0.9, 0);
  const graves = new THREE.InstancedMesh(graveGeo, stoneMat, spots.length);
  const caps = new THREE.InstancedMesh(capGeo, stoneMat, spots.length);
  const o = new THREE.Object3D();
  spots.forEach(([x, z], i) => {
    o.position.set(x, 0, z); o.rotation.set((r() - 0.5) * 0.25, (r() - 0.5) * 0.6, (r() - 0.5) * 0.2);
    o.scale.setScalar(0.8 + r() * 0.5); o.updateMatrix();
    graves.setMatrixAt(i, o.matrix); caps.setMatrixAt(i, o.matrix);
  });
  g.add(graves, caps);
  // Árvores secas.
  const bark = new THREE.MeshLambertMaterial({ color: 0x2a2018 });
  for (let i = 0; i < 26; i++) {
    const x = -24 + r() * 52, z = 4 - r() * 80;
    if (distToPath(S.path, x, z) < 4) continue;
    const t = new THREE.Group();
    const h = 3 + r() * 3;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.25, h, 6), bark);
    trunk.position.y = h / 2; t.add(trunk);
    for (let k = 0; k < 4; k++) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.08, 1.6, 5), bark);
      b.position.y = h * (0.55 + r() * 0.4);
      b.rotation.set(0, r() * 6.28, 0.7 + r() * 0.5);
      b.translateY(0.7);
      t.add(b);
    }
    t.position.set(x, 0, z); t.rotation.y = r() * 6;
    g.add(t);
  }
  // Mansão no fundo, depois do chefe.
  const end = S.path[S.path.length - 1];
  const house = new THREE.Group();
  const wall = new THREE.MeshLambertMaterial({ color: 0x2b2630 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(22, 10, 8), wall); body.position.y = 5; house.add(body);
  const roof = new THREE.Mesh(new THREE.ConeGeometry(15, 6, 4), new THREE.MeshLambertMaterial({ color: 0x1b1820 }));
  roof.position.y = 13; roof.rotation.y = Math.PI / 4; roof.scale.z = 0.45; house.add(roof);
  const lit = new THREE.MeshBasicMaterial({ color: 0xffc860 }), dark = new THREE.MeshBasicMaterial({ color: 0x0c0a10 });
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.8), r() < 0.4 ? lit : dark);
    win.position.set(-8.5 + i * 3.4, 3 + j * 4, 4.01); house.add(win);
  }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.6), new THREE.MeshLambertMaterial({ color: 0x3a2414 }));
  door.position.set(0, 1.8, 4.02); house.add(door);
  house.position.set(end[0], 0, end[1] - 17);
  g.add(house);
  // Lua.
  const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xe8ecff, fog: false }));
  moon.position.set(-30, 40, -90);
  g.add(moon);
  const moonLight = new THREE.DirectionalLight(0x8090c0, 0.5);
  moonLight.position.set(-30, 40, -60);
  g.add(moonLight);
}

// ---------- Fase 2: mansão ----------
function buildMansion(g, S, r, anim) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({
    map: canvasTex(256, 256, (c, w, h) => {
      for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#3d2516' : '#46301e'; c.fillRect(0, i * 32, w, 32); }
      c.strokeStyle = 'rgba(0,0,0,0.5)'; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(0, i * 32); c.lineTo(w, i * 32); c.stroke(); }
    }, [30, 30]),
  }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(8, 0, -22);
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: 0x1a120c }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(8, 4.4, -22);
  g.add(ceil);
  const paper = new THREE.MeshLambertMaterial({
    map: canvasTex(128, 256, (c, w, h) => {
      c.fillStyle = '#3b1f2a'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#4c2a36'; for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 * 16; x < w; x += 32) { c.beginPath(); c.arc(x, y, 6, 0, 6.28); c.fill(); }
      c.fillStyle = '#2a1510'; c.fillRect(0, h - 50, w, 50);
    }, [4, 1]),
  });
  addWallsAlong(g, S, paper, 4.4, 3.2, 4.5);
  // Pilares, quadros, velas e estantes perto das paradas.
  const wood = new THREE.MeshLambertMaterial({ color: 0x3a2214 });
  const flame = new THREE.MeshBasicMaterial({ color: 0xffb040 });
  const books = new THREE.MeshLambertMaterial({
    map: canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = '#2a1a10'; c.fillRect(0, 0, w, h);
      for (let row = 0; row < 4; row++) for (let x = 2; x < w - 4;) {
        const bw = 5 + Math.random() * 7;
        c.fillStyle = `hsl(${Math.random() * 360},40%,${20 + Math.random() * 20}%)`;
        c.fillRect(x, row * 32 + 4, bw, 26); x += bw + 1;
      }
    }),
  });
  Object.keys(S.stops).map(Number).concat([S.boss[0]]).forEach((n) => {
    const [x, z] = S.path[n];
    const yaw = nodeYaw(S, n);
    for (const ang of [-70, -35, 35, 70]) {
      const q = relPoint(x, z, yaw, ang, 8.5);
      const pil = new THREE.Mesh(new THREE.BoxGeometry(0.6, 4.4, 0.6), wood);
      pil.position.set(q.x, 2.2, q.z); g.add(pil);
      const candle = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), flame);
      candle.position.set(q.x, 1.9, q.z); candle.translateX(0.38); g.add(candle);
      anim.push((t) => candle.scale.setScalar(0.8 + Math.sin(t * 13 + q.x) * 0.2));
    }
    for (const ang of [-55, 55]) {
      const q = relPoint(x, z, yaw, ang, 10);
      const shelf = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3, 0.5), [wood, wood, wood, wood, books, wood]);
      shelf.position.set(q.x, 1.5, q.z); shelf.rotation.y = Math.atan2(x - q.x, z - q.z);
      g.add(shelf);
    }
  });
  const warm = new THREE.PointLight(0xff9040, 6, 14, 1.6);
  warm.position.set(15, 3.2, -20);
  g.add(warm);
}

// ---------- Fase 3: laboratório ----------
function buildLab(g, S, r, anim) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({
    map: canvasTex(128, 128, (c, w, h) => {
      c.fillStyle = '#23272a'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#3a4045'; c.lineWidth = 3; c.strokeRect(2, 2, w - 4, h - 4);
      for (let i = 0; i < 30; i++) { c.fillStyle = 'rgba(0,0,0,0.3)'; c.beginPath(); c.arc(Math.random() * w, Math.random() * h, 1.5, 0, 6.28); c.fill(); }
    }, [40, 40]),
  }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -26);
  g.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshLambertMaterial({ color: 0x101414 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.set(0, 4.2, -26);
  g.add(ceil);
  const concrete = new THREE.MeshLambertMaterial({
    map: canvasTex(128, 128, (c, w, h) => {
      noiseFill(c, w, h, '#3a3e3c', ['rgba(0,0,0,A)', 'rgba(90,100,90,A)'], 0.3);
      c.fillStyle = '#c9a227'; for (let x = -h; x < w; x += 24) { c.beginPath(); c.moveTo(x, h - 18); c.lineTo(x + 12, h - 18); c.lineTo(x + 30, h); c.lineTo(x + 18, h); c.fill(); }
    }, [4, 1]),
  });
  addWallsAlong(g, S, concrete, 4.2, 3, 4.5);
  const pipeMat = new THREE.MeshLambertMaterial({ color: 0x4d5a52 });
  const glow = new THREE.MeshBasicMaterial({ color: 0x40ff90, transparent: true, opacity: 0.55 });
  const glass = new THREE.MeshLambertMaterial({ color: 0x8fd8b0, transparent: true, opacity: 0.25 });
  Object.keys(S.stops).map(Number).concat([S.boss[0]]).forEach((n) => {
    const [x, z] = S.path[n];
    const yaw = nodeYaw(S, n);
    for (const ang of [-60, 60, -30, 30]) {
      const q = relPoint(x, z, yaw, ang, 9.5);
      const tank = new THREE.Group();
      const liquid = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 2.4, 14), glow);
      liquid.position.y = 1.3; tank.add(liquid);
      const shell = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 2.7, 14, 1, true), glass);
      shell.position.y = 1.35; tank.add(shell);
      const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.2, 14), pipeMat);
      capTop.position.y = 2.75; tank.add(capTop);
      const capBot = capTop.clone(); capBot.position.y = 0.1; tank.add(capBot);
      tank.position.set(q.x, 0, q.z);
      g.add(tank);
      anim.push((t) => { glow.opacity = 0.45 + Math.sin(t * 2) * 0.12; });
    }
  });
  // Canos ao longo do caminho, no alto.
  for (let i = 0; i < S.path.length - 1; i++) {
    const [ax, az] = S.path[i], [bx, bz] = S.path[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(-(bx - ax), -(bz - az));
    for (const side of [-1, 1]) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, len, 8), pipeMat);
      pipe.rotation.set(Math.PI / 2, 0, 0);
      const holder = new THREE.Group(); holder.add(pipe);
      holder.rotation.y = yaw;
      holder.position.set((ax + bx) / 2 + Math.cos(yaw) * 2.6 * side, 3.6, (az + bz) / 2 - Math.sin(yaw) * 2.6 * side);
      g.add(holder);
    }
  }
  const green = new THREE.PointLight(0x40ff90, 5, 16, 1.6);
  green.position.set(-6, 3, -24);
  g.add(green);
}

// ---------- Quebráveis ----------
function makeProp(kind) {
  const g = new THREE.Group();
  if (kind === 'crate') {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), new THREE.MeshLambertMaterial({
      map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#7a5a30'; c.fillRect(0, 0, w, h); c.strokeStyle = '#4a3418'; c.lineWidth = 6; c.strokeRect(3, 3, w - 6, h - 6); c.beginPath(); c.moveTo(0, 0); c.lineTo(w, h); c.stroke(); }),
    }));
    g.add(m);
  } else if (kind === 'vase') {
    const pts = [[0, -0.4], [0.18, -0.4], [0.3, -0.15], [0.25, 0.15], [0.12, 0.3], [0.16, 0.4]].map(([x, y]) => new THREE.Vector2(x, y));
    g.add(new THREE.Mesh(new THREE.LatheGeometry(pts, 14), new THREE.MeshLambertMaterial({ color: 0x3c5aa0 })));
  } else if (kind === 'chandelier') {
    const gold = new THREE.MeshLambertMaterial({ color: 0xb08a3a });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 20), gold);
    ring.rotation.x = Math.PI / 2; g.add(ring);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.3, 4), gold);
    chain.position.y = 0.65; g.add(chain);
    const fl = new THREE.MeshBasicMaterial({ color: 0xffc060 });
    for (let i = 0; i < 6; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), fl);
      c.position.set(Math.cos(i) * 0.45, 0.1, Math.sin(i) * 0.45); g.add(c);
    }
  } else { // barrel
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 12), new THREE.MeshLambertMaterial({ color: 0x3d6b3a })));
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 12), new THREE.MeshBasicMaterial({ color: 0xffd040 }));
    g.add(band);
  }
  return g;
}

// ---------- Monstros ----------
// Todos montados olhando para -Z (frente), pés na origem.
function mat(color, emissive = 0x000000) { return new THREE.MeshLambertMaterial({ color, emissive }); }
const EYE_Y = new THREE.MeshBasicMaterial({ color: 0xfff060 });
const EYE_R = new THREE.MeshBasicMaterial({ color: 0xff3020 });
const EYE_G = new THREE.MeshBasicMaterial({ color: 0x60ff80 });

function limb(r, len, material) {
  const pivot = new THREE.Group();
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 3, 6), material);
  m.position.y = -len / 2 - r;
  pivot.add(m);
  return pivot;
}

function humanoid({ skin, cloth, eyes, scale = 1, lean = 0.25, thin = 1 }) {
  const g = new THREE.Group();
  const body = new THREE.Group(); g.add(body);
  const legs = [-1, 1].map(s => { const l = limb(0.08 * thin, 0.55, cloth.pants); l.position.set(s * 0.12, 0.85, 0); body.add(l); return l; });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22 * thin, 0.45, 4, 8), cloth.shirt);
  torso.position.y = 1.15; torso.rotation.x = -lean; body.add(torso);
  const head = new THREE.Group();
  head.position.set(0, 1.62, -0.04 - lean * 0.2);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), skin));
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyes); e.position.set(s * 0.06, 0.03, -0.14); head.add(e); }
  body.add(head);
  const arms = [-1, 1].map(s => { const a = limb(0.06 * thin, 0.5, skin); a.position.set(s * 0.27 * thin, 1.4, -0.05); a.rotation.x = 1.3; body.add(a); return a; });
  g.scale.setScalar(scale);
  return { g, body, legs, arms, head, torso };
}

export function makeMonster(m, rng = Math.random) {
  const type = m.type;
  const mats = [];
  const track = (x) => { mats.push(x); return x; };
  const root = new THREE.Group();
  let parts;
  let animate;
  if (type === 'zombie' || type === 'runner') {
    const skin = track(mat(type === 'zombie' ? 0x6d8a5a : 0x8a7d6a));
    const shirtCol = [0x5a4030, 0x34405a, 0x504a3a, 0x5a3040][Math.floor(rng() * 4)];
    const h = humanoid({ skin, cloth: { shirt: track(mat(shirtCol)), pants: track(mat(0x2a2a30)) }, eyes: type === 'zombie' ? EYE_Y : EYE_R, lean: type === 'runner' ? 0.45 : 0.22, thin: type === 'runner' ? 0.85 : 1 });
    root.add(h.g);
    const speed = type === 'runner' ? 9 : 4;
    animate = (st, t, dt) => {
      const walk = st === 'walk' ? Math.sin(t * speed) : 0;
      h.legs[0].rotation.x = walk * 0.6; h.legs[1].rotation.x = -walk * 0.6;
      const up = st === 'windup' ? 2.6 : 1.3;
      for (const [i, a] of h.arms.entries()) a.rotation.x += (up + Math.sin(t * 3 + i) * 0.15 - a.rotation.x) * Math.min(1, dt * 10);
      h.body.rotation.x = st === 'stagger' ? 0.3 : 0;
      h.head.rotation.z = Math.sin(t * 1.3) * 0.2;
    };
  } else if (type === 'bat') {
    const body = track(mat(0x1a1418));
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), body); root.add(b);
    for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.025, 5, 5), EYE_R); e.position.set(s * 0.05, 0.04, -0.11); root.add(e); }
    const wingGeo = new THREE.BufferGeometry();
    wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.08, 0.5, 0.05, 0, 0, 0, 0.12, 0.5, 0.05, 0, 0.35, -0.1, 0.12, 0, 0, 0.12], 3));
    wingGeo.computeVertexNormals();
    const wingMat = track(new THREE.MeshLambertMaterial({ color: 0x2a2026, side: THREE.DoubleSide }));
    const wings = [-1, 1].map(s => { const w = new THREE.Mesh(wingGeo, wingMat); w.scale.x = s; root.add(w); return w; });
    animate = (st, t) => { const f = Math.sin(t * 22) * 0.8; wings[0].rotation.z = -f; wings[1].rotation.z = f; };
  } else if (type === 'spitter') {
    const skin = track(mat(0x6a5a7a));
    const belly = new THREE.Mesh(new THREE.SphereGeometry(0.45, 14, 10), skin); belly.position.y = 0.95; belly.scale.set(1, 1.05, 0.9); root.add(belly);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin); head.position.set(0, 1.45, -0.05); root.add(head);
    const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), EYE_G); mouth.position.set(0, 1.4, -0.2); root.add(mouth);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), EYE_Y); e.position.set(s * 0.07, 1.5, -0.17); root.add(e);
      const leg = limb(0.09, 0.3, skin); leg.position.set(s * 0.18, 0.5, 0); root.add(leg);
    }
    animate = (st, t) => {
      belly.scale.y = 1.05 + Math.sin(t * 3) * 0.04 + (st === 'spit' ? 0.12 : 0);
      mouth.scale.setScalar(st === 'spit' ? 1.8 : 1);
    };
  } else if (type === 'coveiro') {
    const skin = track(mat(0x6a7a5a));
    const h = humanoid({ skin, cloth: { shirt: track(mat(0x2a2420)), pants: track(mat(0x1d1a18)) }, eyes: EYE_Y, scale: 2.1, lean: 0.15 });
    root.add(h.g);
    const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.25, 12), track(mat(0x141210))); hat.position.y = 0.2; h.head.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.03, 14), hat.material); brim.position.y = 0.08; h.head.add(brim);
    // Pá na mão esquerda (lado -X), lanterna (ponto fraco) na direita (+X).
    const shovel = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6), track(mat(0x5a3a1a))); handle.position.y = -0.3; shovel.add(handle);
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.03), track(mat(0x707478))); blade.position.y = -1.1; shovel.add(blade);
    h.arms[0].add(shovel); shovel.position.y = -0.62;
    const lantern = new THREE.Group();
    lantern.add(new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), track(mat(0x302a20))));
    const glowMat = new THREE.MeshBasicMaterial({ color: 0xffa030 });
    const lg = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), glowMat); lantern.add(lg);
    root.add(lantern);
    lantern.position.set(0.75, 2.05, -0.45);
    animate = (st, t, dt) => {
      const walk = Math.sin(t * 2.5);
      h.legs[0].rotation.x = walk * 0.35; h.legs[1].rotation.x = -walk * 0.35;
      const up = st === 'windup' ? 3.0 : 0.6;
      h.arms[0].rotation.x += (up - h.arms[0].rotation.x) * Math.min(1, dt * 5);
      h.arms[1].rotation.x = 0.9;
      lg.scale.setScalar(1 + Math.sin(t * 9) * 0.15);
      h.body.rotation.x = st === 'stagger' ? 0.25 : 0;
    };
  } else if (type === 'aranha') {
    const shell = track(mat(0x2a1a22));
    const front = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), shell); front.position.z = -0.1; root.add(front);
    const back = new THREE.Mesh(new THREE.SphereGeometry(0.75, 14, 10), track(mat(0x3a1a2a))); back.position.set(0, 0.1, 0.9); back.scale.set(1, 0.9, 1.2); root.add(back);
    for (let i = 0; i < 6; i++) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.07 + (i < 2 ? 0.04 : 0), 8, 6), EYE_R);
      e.position.set((i % 3 - 1) * 0.14, 0.25 + Math.floor(i / 3) * 0.12, -0.78); root.add(e);
    }
    const legMat = track(mat(0x1e1218));
    const legs = [];
    for (let i = 0; i < 8; i++) {
      const s = i < 4 ? -1 : 1, k = i % 4;
      const hip = new THREE.Group(); hip.position.set(s * 0.5, 0, -0.4 + k * 0.35); root.add(hip);
      const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 1.2, 5), legMat); upper.rotation.z = s * -1.0; upper.position.set(s * 0.5, 0.35, 0); hip.add(upper);
      const lower = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.02, 1.4, 5), legMat); lower.position.set(s * 1.1, -0.35, 0); lower.rotation.z = s * 0.4; hip.add(lower);
      legs.push({ hip, k, s });
    }
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 6, 4), new THREE.MeshBasicMaterial({ color: 0xcccccc }));
    thread.position.set(0, 3.5, 0.6); root.add(thread);
    animate = (st, t) => {
      for (const l of legs) l.hip.rotation.y = Math.sin(t * (st === 'windup' ? 14 : 6) + l.k * 1.4) * 0.3;
      thread.visible = st === 'enter' || st === 'recover';
    };
  } else { // criatura
    const skin = track(mat(0x4a5a6a));
    const g2 = new THREE.Group(); root.add(g2);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.6, 0.9), skin); torso.position.y = 2.0; g2.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), skin); head.position.set(0, 3.1, -0.1); g2.add(head);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), EYE_R); e.position.set(s * 0.12, 3.15, -0.38); g2.add(e);
      const leg = limb(0.2, 0.8, skin); leg.position.set(s * 0.4, 1.25, 0); g2.add(leg);
      const arm = limb(0.16, 1.3, skin); arm.position.set(s * 0.95, 2.7, 0); arm.rotation.z = s * 0.2; g2.add(arm);
    }
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), new THREE.MeshBasicMaterial({ color: 0x50e8ff }));
    core.position.set(0, 2.0, -0.75); g2.add(core);
    const plates = [-1, 1].map(s => { const p = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.9, 0.12), track(mat(0x2a333c))); p.position.set(s * 0.21, 2.0, -1.06); g2.add(p); return { p, s }; });
    animate = (st, t, dt, m) => {
      for (const { p, s } of plates) {
        const want = m.open ? s * 0.62 : s * 0.21;
        p.position.x += (want - p.position.x) * Math.min(1, dt * 6);
      }
      core.scale.setScalar(1 + Math.sin(t * 7) * 0.08);
      g2.rotation.x = st === 'stagger' ? 0.15 : st === 'windup' ? -0.12 : 0;
    };
  }

  let dyingT = 0;
  return {
    root, mats,
    update(mon, time, dt) {
      root.position.set(mon.x, mon.y, mon.z);
      root.rotation.y = mon.yaw;
      animate(mon.state, time + mon.phase, dt, mon);
      const flash = mon.flash > 0 ? 1 : 0;
      for (const x of mats) x.emissive.setRGB(0.45 * flash, 0.08 * flash, 0.05 * flash);
      if (mon.state === 'dying') {
        dyingT += dt;
        const k = Math.min(1, dyingT / 0.7);
        root.rotation.x = -k * (mon.boss ? 0.4 : 1.3);
        root.position.y = mon.y - k * (mon.boss ? 1.2 : 0.3);
        root.scale.setScalar(1 - k * (mon.def.fly ? 1 : 0.15));
      }
    },
  };
}

// Gosma (projétil).
export function makeGoo() {
  return new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshBasicMaterial({ color: 0x70ff50 }));
}

// ---------- Revólver ----------
// Cabo na origem, cano para -Z. Indicadores de bala no tambor.
export function makeRevolver(tint = 0x2b2d31) {
  const g = new THREE.Group();
  const metal = new THREE.MeshLambertMaterial({ color: tint });
  const woodM = new THREE.MeshLambertMaterial({ color: 0x5a3418 });
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.11, 0.05), woodM);
  grip.rotation.x = 0.35; grip.position.set(0, -0.05, 0.02); g.add(grip);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.12), metal); frame.position.set(0, 0.015, -0.05); g.add(frame);
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 6), metal);
  cyl.rotation.x = Math.PI / 2; cyl.position.set(0, 0.02, -0.07); g.add(cyl);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.2, 8), metal);
  barrel.rotation.x = Math.PI / 2; barrel.position.set(0, 0.035, -0.2); g.add(barrel);
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: 0xff5030 }));
  sight.position.set(0, 0.052, -0.29); g.add(sight);
  const bulletOn = new THREE.MeshBasicMaterial({ color: 0xffd060 }), bulletOff = new THREE.MeshBasicMaterial({ color: 0x302820 });
  const bullets = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.006, 6, 4), bulletOn);
    const a = i / 6 * Math.PI * 2;
    b.position.set(0.032, 0.02 + Math.cos(a) * 0.018, -0.07 + Math.sin(a) * 0.018);
    g.add(b); bullets.push(b);
  }
  const flash = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.9 }));
  flash.position.set(0, 0.035, -0.32); flash.visible = false; g.add(flash);
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, 0.035, -0.3); g.add(muzzle);
  let flashT = 0, kick = 0, spin = 0;
  return {
    group: g, muzzle,
    fire() { flashT = 0.05; kick = 1; },
    update(dt, ammo, reloading) {
      flashT -= dt; flash.visible = flashT > 0;
      kick = Math.max(0, kick - dt * 9);
      g.rotation.x = kick * 0.35;
      spin = reloading > 0 ? spin + dt * 14 : 0;
      cyl.rotation.y = spin;
      bullets.forEach((b, i) => { b.material = i < ammo ? bulletOn : bulletOff; });
    },
  };
}

// ---------- Efeitos: faíscas e rastro de bala ----------
export function makeEffects(scene) {
  const N = 90;
  const geo = new THREE.BoxGeometry(0.035, 0.035, 0.035);
  const mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }), N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  scene.add(mesh);
  const ps = Array.from({ length: N }, () => ({ life: 0, x: 0, y: -99, z: 0, vx: 0, vy: 0, vz: 0 }));
  const col = new THREE.Color();
  let next = 0;
  const o = new THREE.Object3D();
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe0a0, transparent: true, opacity: 0.8 });
  const tracers = [0, 1].map(() => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), tracerMat);
    l.visible = false; l.frustumCulled = false; scene.add(l); return { l, t: 0 };
  });
  return {
    burst(x, y, z, color, n = 8, speed = 2.5) {
      for (let i = 0; i < n; i++) {
        const p = ps[next]; next = (next + 1) % N;
        p.life = 0.35 + Math.random() * 0.25;
        p.x = x; p.y = y; p.z = z;
        p.vx = (Math.random() - 0.5) * speed; p.vy = Math.random() * speed; p.vz = (Math.random() - 0.5) * speed;
        mesh.setColorAt(ps.indexOf(p), col.setHex(color));
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    },
    tracer(i, a, b) {
      const tr = tracers[i];
      const pos = tr.l.geometry.attributes.position;
      pos.setXYZ(0, a.x, a.y, a.z); pos.setXYZ(1, b.x, b.y, b.z); pos.needsUpdate = true;
      tr.t = 0.05; tr.l.visible = true;
    },
    update(dt) {
      ps.forEach((p, i) => {
        if (p.life > 0) {
          p.life -= dt; p.vy -= 9 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
          o.position.set(p.x, p.y, p.z); o.scale.setScalar(p.life > 0 ? 1 : 0);
        } else { o.position.set(0, -99, 0); o.scale.setScalar(0); }
        o.updateMatrix(); mesh.setMatrixAt(i, o.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      for (const tr of tracers) { tr.t -= dt; tr.l.visible = tr.t > 0; }
    },
  };
}
