// Liga o núcleo à tela, aos controles do Quest (2 revólveres) e ao mouse (1 revólver).
import * as THREE from '../vendor/three/three.module.js';
import { RailGame, GUN } from './game.js';
import { STAGES } from './levels.js';
import { buildStage, makeMonster, makeGoo, makeRevolver, makeEffects } from './scene.js';
import { Panel, Label } from './ui.js';
import { Sfx } from './audio.js';
import { loadSave, storeSave } from './save.js';

const save = loadSave();
const sfx = new Sfx();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const DT = 1 / 120;

// ---------- Render e cena ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation?.(1);
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
const rig = new THREE.Group();        // segue o trilho
const playSpace = new THREE.Group();  // ajuste de recentralizar (VR)
rig.add(playSpace);
scene.add(rig);
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.03, 120);
playSpace.add(camera);
camera.position.set(0, 1.6, 0);

// Lanterna na cabeça.
const flashlight = new THREE.SpotLight(0xfff0d0, 30, 22, 0.55, 0.5, 1.4);
camera.add(flashlight);
flashlight.position.set(0, -0.1, 0);
const flTarget = new THREE.Object3D(); flTarget.position.set(0, -0.6, -5);
camera.add(flTarget); flashlight.target = flTarget;
const muzzleLight = new THREE.PointLight(0xffc070, 0, 8, 2);
scene.add(muzzleLight);

const effects = makeEffects(scene);

// Esferas em volta da cabeça: vermelho ao levar dano, preto no teletransporte.
const hurtSphere = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), new THREE.MeshBasicMaterial({ color: 0xaa0000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false }));
hurtSphere.renderOrder = 20; camera.add(hurtSphere);
const fadeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.BackSide, depthTest: false }));
fadeSphere.renderOrder = 21; camera.add(fadeSphere);

// HUD preso à câmera.
const hud = new Label(0.62, 640, 150);
hud.mesh.position.set(0, -0.36, -0.95);
camera.add(hud.mesh);
const fpsLabel = new Label(0.14);
fpsLabel.mesh.position.set(0.2, 0.2, -0.7);
fpsLabel.mesh.visible = false;
camera.add(fpsLabel.mesh);

const panel = new Panel(1.1);
panel.mesh.position.set(0, 1.5, -1.05);
rig.add(panel.mesh);

// Revólveres.
const guns = [makeRevolver(0x2b2d31), makeRevolver(0x3a2f2a)];

// ---------- Estado ----------
let app = 'menu';   // 'menu' | 'playing' | 'paused' | 'gameover' | 'clear'
let game = null;
let stageIndex = 0;
let stageVis = null;
let runScore = 0;    // soma das fases anteriores quando joga em sequência
let runFromStart = false;
let screen = 'main', optionsBack = 'main';
let time = 0;
let hurtT = 0;
let lastResult = null;
let bossName = '';
const models = new Map();
const goos = new Map();

function setStageVisual(i, gm) {
  if (stageVis) scene.remove(stageVis.group);
  stageVis = buildStage(i, gm.props);
  scene.add(stageVis.group);
  const T = stageVis.theme;
  scene.fog = new THREE.Fog(T.fog, T.near, T.far);
  scene.background = new THREE.Color(T.fog);
  for (const [, mdl] of models) scene.remove(mdl.root);
  models.clear();
  for (const [, g] of goos) scene.remove(g);
  goos.clear();
}

// ---------- VR: controles ----------
const ctrls = [];
for (let i = 0; i < 2; i++) {
  const ctrl = renderer.xr.getController(i);
  playSpace.add(ctrl);
  const laser = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]),
    new THREE.LineBasicMaterial({ color: 0xc0392b }));
  laser.scale.z = 2; laser.visible = false;
  ctrl.add(laser);
  const entry = { ctrl, laser, source: null, hand: null, gun: -1, prevButtons: [], hoverIndex: -1, down: false };
  ctrls.push(entry);
  ctrl.addEventListener('connected', (e) => {
    entry.source = e.data; entry.hand = e.data.handedness;
    entry.gun = entry.hand === 'left' ? 1 : 0;
    attachGuns();
  });
  ctrl.addEventListener('disconnected', () => { entry.source = null; entry.hand = null; entry.gun = -1; attachGuns(); });
  ctrl.addEventListener('selectstart', () => onTrigger(entry));
  ctrl.addEventListener('squeezestart', () => { if (entry.gun >= 0 && game && app === 'playing') game.reload(entry.gun); });
}

function attachGuns() {
  const vr = renderer.xr.isPresenting;
  for (let gi = 0; gi < 2; gi++) {
    const g = guns[gi].group;
    const e = ctrls.find(c => c.gun === gi && c.source);
    if (vr && e) {
      e.ctrl.add(g);
      g.position.set(0, -0.045, 0.06);
      g.rotation.set(0, 0, 0);
      g.visible = true;
    } else if (!vr && gi === 0) {
      camera.add(g);
      g.position.set(0.24, -0.22, -0.55); g.scale.setScalar(0.8);
      g.visible = true;
    } else {
      scene.add(g);
      g.visible = false;
    }
  }
}

function pulse(gi, v, ms) {
  const e = ctrls.find(c => c.gun === gi);
  try { e?.source?.gamepad?.hapticActuators?.[0]?.pulse?.(v, ms); } catch { /* sem vibração */ }
}

function recenter() {
  const e = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
  playSpace.rotation.set(0, -e.y, 0);
  const head = camera.position.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -e.y);
  playSpace.position.set(-head.x, 0, -head.z);
}
let recenterIn = 0;
renderer.xr.addEventListener('sessionstart', () => { recenterIn = 5; attachGuns(); updateHint(); });
renderer.xr.addEventListener('sessionend', () => {
  playSpace.position.set(0, 0, 0); playSpace.rotation.set(0, 0, 0);
  camera.position.set(0, 1.6, 0); camera.quaternion.identity();
  attachGuns(); updateHint();
});

// ---------- Mouse (PC) ----------
const mouse = { ndc: new THREE.Vector2(0, 0), px: [window.innerWidth / 2, window.innerHeight / 2] };
const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3(), tmpQ = new THREE.Quaternion();
const Z_NEG = new THREE.Vector3(0, 0, -1);

function setMouse(e) {
  mouse.px = [e.clientX, e.clientY];
  mouse.ndc.set(e.clientX / window.innerWidth * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
}
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
renderer.domElement.addEventListener('pointermove', setMouse);
renderer.domElement.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  setMouse(e);
  if (panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    doAction(panel.actionAt(panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv)));
    return;
  }
  if (app !== 'playing' || !game) return;
  if (e.button === 2) { game.reload(0); return; }
  if (e.button === 0) {
    raycaster.setFromCamera(mouse.ndc, camera);
    camera.getWorldPosition(tmpV);
    const d = raycaster.ray.direction;
    game.shoot(0, tmpV.x, tmpV.y, tmpV.z, d.x, d.y, d.z);
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') togglePause();
  if ((e.key === 'r' || e.key === 'R') && game && app === 'playing') game.reload(0);
  if (e.key === 'f' || e.key === 'F') { save.fps = !save.fps; storeSave(save); }
});
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Jogo ----------
function startStage(i, { fromRun = false } = {}) {
  stageIndex = i;
  if (!fromRun) { runScore = 0; runFromStart = i === 0; }
  game = new RailGame({ stage: i, comfort: save.comfort, onEvent });
  setStageVisual(i, game);
  bossName = '';
  app = 'playing';
  panel.hide();
  sfx.setMusic(true, 0);
  updateHint();
}

const shotOrigin = new THREE.Vector3();
function onEvent(type, d) {
  const pan = (x, z) => {
    if (!game) return 0;
    const rx = Math.cos(game.yaw), rz = -Math.sin(game.yaw);
    return clamp(((x - game.pos.x) * rx + (z - game.pos.z) * rz) / 6, -1, 1);
  };
  switch (type) {
    case 'shot': {
      const gun = guns[d.gun];
      gun.fire();
      gun.muzzle.getWorldPosition(shotOrigin);
      muzzleLight.position.copy(shotOrigin); muzzleLight.intensity = 6;
      sfx.shot(d.gun === 1 ? -0.3 : 0.3);
      pulse(d.gun, 0.7, 45);
      let end = d.point;
      if (!end) {
        tmpV2.set(0, 0, -30).applyQuaternion(gun.muzzle.getWorldQuaternion(tmpQ)).add(shotOrigin);
        end = { x: tmpV2.x, y: tmpV2.y, z: tmpV2.z };
      }
      effects.tracer(d.gun, shotOrigin, end);
      if (d.point) {
        const p = d.point;
        if (d.outcome === 'armor') { effects.burst(p.x, p.y, p.z, 0xffd040, 6, 3); sfx.armor(pan(p.x, p.z)); }
        else if (d.outcome === 'proj') effects.burst(p.x, p.y, p.z, 0x70ff50, 10, 2);
        else if (d.outcome === 'prop') effects.burst(p.x, p.y, p.z, 0x9a7040, 12, 3);
        else if (d.outcome !== 'miss') { effects.burst(p.x, p.y, p.z, 0x5a1a7a, d.outcome.includes('head') ? 14 : 8, 2.5); sfx.hit(pan(p.x, p.z)); }
      }
      break;
    }
    case 'empty': sfx.empty(); pulse(d.gun, 0.15, 20); break;
    case 'reload': sfx.reload(d.gun === 1 ? -0.3 : 0.3); pulse(d.gun, 0.3, 60); break;
    case 'kill': sfx.kill(); break;
    case 'spawn': {
      const m = game.monsters.find(x => x.id === d.id);
      if (!m) break;
      if (d.type === 'bat') { if (Math.random() < 0.6) sfx.screech(pan(m.x, m.z)); }
      else if (Math.random() < 0.5) sfx.groan(pan(m.x, m.z));
      break;
    }
    case 'windup': if (Math.random() < 0.5) sfx.groan(0); break;
    case 'spit': sfx.spit(0); break;
    case 'playerHit':
      sfx.hurt(); hurtT = 0.6;
      pulse(0, 1, 200); pulse(1, 1, 200);
      break;
    case 'prop': {
      const mesh = stageVis?.props.get(d.id);
      if (mesh) { mesh.visible = false; effects.burst(mesh.position.x, mesh.position.y, mesh.position.z, 0x9a7040, 16, 3); }
      if (d.drop === 'life') sfx.pickup();
      break;
    }
    case 'boss': bossName = d.name; sfx.roar(); sfx.setMusic(true, 1); break;
    case 'bossStagger': sfx.armor(0); break;
    case 'bossDead': {
      sfx.roar();
      const b = game.boss;
      if (b) effects.burst(b.x, b.y + 1.5, b.z, 0x5a1a7a, 30, 4);
      sfx.setMusic(true, 0);
      break;
    }
    case 'gameover':
      sfx.sting(false);
      setTimeout(() => { if (app === 'playing') { app = 'gameover'; showScreen('gameover'); } }, 1500);
      break;
    case 'clear': {
      const total = runScore + d.score;
      lastResult = { ...d, stage: stageIndex, total, fullRun: runFromStart && stageIndex === STAGES.length - 1 };
      save.best[stageIndex] = Math.max(save.best[stageIndex] || 0, d.score);
      save.unlocked = Math.max(save.unlocked, Math.min(STAGES.length, stageIndex + 2));
      if (lastResult.fullRun) save.bestRun = Math.max(save.bestRun, total);
      storeSave(save);
      sfx.sting(true);
      sfx.setMusic(false);
      setTimeout(() => { if (app === 'playing') { app = 'clear'; showScreen('clear'); } }, 1200);
      break;
    }
  }
}

function togglePause() {
  if (app === 'playing') { app = 'paused'; showScreen('pause'); sfx.setMusic(false); }
  else if (app === 'paused' && screen === 'pause') { app = 'playing'; panel.hide(); sfx.setMusic(true, game?.boss ? 1 : 0); }
}

// ---------- Telas ----------
const PW = 1024;
function showScreen(name) { screen = name; panel.show((p) => SCREENS[name](p)); updateHint(); }

const SCREENS = {
  main(p) {
    p.title('Noite dos Monstros', 62);
    p.text('Você anda sozinho; atire nos monstros e recarregue. Tiro na cabeça mata mais rápido.', PW / 2, 112, { size: 24, color: '#a8968e' });
    STAGES.forEach((S, i) => {
      const open = i < save.unlocked;
      const best = save.best[i];
      p.row(140 + i * 100, {
        num: i + 1, name: S.short, style: S.name, desc: ['Túmulos, neblina e o Coveiro', 'Corredores, biblioteca e a Aranha do Sótão', 'Tubos verdes e a Criatura'][i],
        status: open ? 'open' : 'locked', action: 'play:' + i, color: ['#5c6c9c', '#8a4a30', '#30a070'][i],
        tag: open ? (best ? `recorde ${best}` : 'Jogar ▶') : null,
      });
    });
    const vr = renderer.xr.isPresenting;
    p.text(vr ? 'Gatilho atira. Aponte a arma para o chão (ou aperte o botão de agarrar) para recarregar.'
      : 'PC: clique atira, botão direito ou R recarrega. No Quest, use "Entrar em VR".', PW / 2, 460, { size: 22, color: '#a8968e' });
    if (save.bestRun) p.text(`Melhor noite completa: ${save.bestRun} pontos`, PW / 2, 500, { size: 22, color: '#c0392b' });
    p.button('Opções', 'options', PW / 2 - 160, 580, 320, 76);
  },
  options(p) {
    p.title('Opções', 58);
    const line = (y, label, items, current, key) => {
      p.text(label, 50, y + 34, { size: 30, align: 'left', bold: true });
      const x0 = 420, w = (PW - 50 - x0 - (items.length - 1) * 10) / items.length;
      items.forEach(([val, txt], i) => p.button(txt, `set:${key}:${val}`, x0 + i * (w + 10), y, w, 68, { on: String(current) === String(val), size: 28 }));
    };
    line(140, 'Movimento (VR)', [[0, 'Andar'], [1, 'Teletransporte']], save.comfort ? 1 : 0, 'comfort');
    line(240, 'Mostrar FPS', [[1, 'Sim'], [0, 'Não']], save.fps ? 1 : 0, 'fps');
    p.text('Se o andar automático der enjoo no óculos, use Teletransporte:', PW / 2, 380, { size: 24, color: '#a8968e' });
    p.text('a tela escurece e você aparece na próxima parada. Vale na próxima fase.', PW / 2, 414, { size: 24, color: '#a8968e' });
    p.button('Voltar', 'back', PW / 2 - 160, 580, 320, 76, { on: true });
  },
  pause(p) {
    p.title('Pausa', 70);
    p.text(`${STAGES[stageIndex].name} · ${game.score} pontos`, PW / 2, 140, { size: 34 });
    const vr = renderer.xr.isPresenting;
    const items = [['Continuar', 'resume'], ...(vr ? [['Recentralizar', 'recenter']] : []), ['Opções', 'options'], ['Sair para o menu', 'menu']];
    items.forEach(([t, a], i) => p.button(t, a, PW / 2 - 230, 200 + i * 104, 460, 84, { on: i === 0 }));
  },
  gameover(p) {
    p.title('Os monstros te pegaram', 110);
    p.text(`${STAGES[stageIndex].name} · ${game.score} pontos`, PW / 2, 190, { size: 34 });
    p.text('Continuar recomeça esta fase com as vidas cheias.', PW / 2, 250, { size: 26, color: '#a8968e' });
    p.button('Continuar', 'retry', PW / 2 - 250, 320, 500, 90, { on: true });
    p.button('Menu', 'menu', PW / 2 - 250, 430, 500, 90);
  },
  clear(p) {
    const r = lastResult;
    const last = r.stage === STAGES.length - 1;
    p.title(last ? 'Você sobreviveu à noite!' : `${STAGES[r.stage].short}: concluída!`, 70);
    const lines = [
      `Pontos da fase: ${r.score}  (bônus ${r.bonus})`,
      `Precisão: ${Math.round(r.accuracy * 100)}%  ·  Tiros na cabeça: ${r.heads}  ·  Monstros: ${r.kills}`,
      `Vidas restantes: ${r.lives}`,
    ];
    if (runScore > 0 || r.fullRun) lines.push(`Total da noite: ${r.total}${r.fullRun && r.total >= save.bestRun ? '  (recorde!)' : ''}`);
    lines.forEach((t, i) => p.text(t, PW / 2, 150 + i * 50, { size: 30 }));
    if (!last) p.button(`Próxima: ${STAGES[r.stage + 1].short}`, 'next', PW / 2 - 260, 400, 520, 90, { on: true });
    p.button('Menu', 'menu', PW / 2 - 260, last ? 400 : 510, 520, 90, { on: last });
  },
};

function doAction(a) {
  if (!a) return;
  sfx.unlock();
  sfx.click();
  if (a.startsWith('play:')) { startStage(Number(a.slice(5))); return; }
  if (a.startsWith('set:')) {
    const [, key, val] = a.split(':');
    if (key === 'comfort') save.comfort = val === '1';
    else if (key === 'fps') save.fps = val === '1';
    storeSave(save);
    showScreen('options');
    return;
  }
  switch (a) {
    case 'options': optionsBack = screen; showScreen('options'); break;
    case 'back': showScreen(optionsBack === 'options' ? 'main' : optionsBack); break;
    case 'resume': app = 'playing'; panel.hide(); sfx.setMusic(true, game?.boss ? 1 : 0); updateHint(); break;
    case 'recenter': recenter(); break;
    case 'retry': startStage(stageIndex, { fromRun: true }); break;
    case 'next': runScore = lastResult.total; startStage(stageIndex + 1, { fromRun: true }); break;
    case 'menu': goMenu(); break;
  }
}

function goMenu() {
  app = 'menu';
  sfx.setMusic(false);
  game = new RailGame({ stage: 0 });   // só para o cenário de fundo
  setStageVisual(0, game);
  game = null;
  rig.position.set(0, 0, 0); rig.rotation.set(0, 0, 0);
  showScreen('main');
}

function onTrigger(entry) {
  sfx.unlock();
  if (panel.visible) { if (entry.hoverIndex >= 0) doAction(panel.actionAt(entry.hoverIndex)); return; }
  if (app !== 'playing' || !game || entry.gun < 0) return;
  const gun = guns[entry.gun];
  gun.muzzle.getWorldPosition(tmpV);
  entry.ctrl.getWorldQuaternion(tmpQ);
  tmpV2.set(0, 0, -1).applyQuaternion(tmpQ);
  game.shoot(entry.gun, tmpV.x, tmpV.y, tmpV.z, tmpV2.x, tmpV2.y, tmpV2.z);
}

function pollVR() {
  for (const e of ctrls) {
    const gp = e.source?.gamepad;
    if (gp) {
      if (gp.buttons[5]?.pressed && !e.prevButtons[5]) togglePause();
      e.prevButtons = gp.buttons.map(b => b.pressed);
    }
    // Recarregar apontando para o chão.
    if (e.gun >= 0 && game && app === 'playing') {
      e.ctrl.getWorldQuaternion(tmpQ);
      tmpV2.set(0, 0, -1).applyQuaternion(tmpQ);
      const down = tmpV2.y < -0.8;
      if (down && !e.down && game.guns[e.gun].ammo < GUN.ammo) game.reload(e.gun);
      e.down = down;
    }
  }
}

// ---------- Raio do menu ----------
const rayOrigin = new THREE.Vector3(), rayDir = new THREE.Vector3();
function updateMenuRays() {
  const vr = renderer.xr.isPresenting;
  let hover = -1;
  for (const e of ctrls) {
    e.hoverIndex = -1;
    e.laser.visible = vr && panel.visible && !!e.source;
    if (!e.laser.visible) continue;
    e.ctrl.getWorldPosition(rayOrigin);
    e.ctrl.getWorldQuaternion(tmpQ);
    rayDir.set(0, 0, -1).applyQuaternion(tmpQ);
    raycaster.set(rayOrigin, rayDir);
    const hit = raycaster.intersectObject(panel.mesh)[0];
    e.laser.scale.z = hit ? hit.distance : 2;
    e.hoverIndex = panel.pick(hit?.uv);
    if (e.hoverIndex >= 0) hover = e.hoverIndex;
  }
  if (!vr && panel.visible) {
    raycaster.setFromCamera(mouse.ndc, camera);
    hover = panel.pick(raycaster.intersectObject(panel.mesh)[0]?.uv);
    renderer.domElement.style.cursor = hover >= 0 && panel.actionAt(hover) ? 'pointer' : 'default';
  } else renderer.domElement.style.cursor = app === 'playing' && !vr ? 'none' : 'default';
  if (panel.visible) panel.setHover(hover);
}

// ---------- HUD ----------
let hudKey = '';
function drawHUD() {
  const vr = renderer.xr.isPresenting;
  if (!game || app === 'menu' || panel.visible) { hud.mesh.visible = false; hudKey = ''; return; }
  hud.mesh.visible = true;
  const g = game;
  const ammo = g.guns.map(x => x.reloading > 0 ? -1 : x.ammo);
  const boss = g.boss && g.boss.state !== 'dying' ? Math.max(0, g.boss.hp / g.boss.maxHp) : null;
  const blink = Math.floor(time * 3) % 2;
  const key = [g.lives, g.score, ammo.join(','), boss?.toFixed(2), blink, vr].join('|');
  if (key === hudKey) return;
  hudKey = key;
  const c = hud.ctx, w = hud.canvas.width, h = hud.canvas.height;
  c.clearRect(0, 0, w, h);
  c.textBaseline = 'middle';
  // Vidas
  c.font = 'bold 34px sans-serif'; c.textAlign = 'left';
  for (let i = 0; i < Math.max(g.lives, 0); i++) { c.fillStyle = '#e03030'; c.fillText('♥', 12 + i * 30, 112); }
  // Pontos
  c.fillStyle = '#f2e6d8'; c.font = 'bold 38px monospace'; c.textAlign = 'center';
  c.shadowColor = '#000'; c.shadowBlur = 6;
  c.fillText(String(g.score).padStart(6, '0'), w / 2, 112);
  // Munição (PC: arma 0; VR: as duas, que também aparecem no tambor)
  const shown = vr ? [1, 0] : [0];
  shown.forEach((gi, k) => {
    const x0 = w - 20 - (shown.length - 1 - k) * 150;
    if (ammo[gi] === -1) { c.fillStyle = '#ffd060'; c.font = 'bold 26px sans-serif'; c.textAlign = 'right'; c.fillText('recarregando', x0, 112); return; }
    if (ammo[gi] === 0) { if (blink) { c.fillStyle = '#ff4030'; c.font = 'bold 28px sans-serif'; c.textAlign = 'right'; c.fillText('RECARREGUE!', x0, 112); } return; }
    for (let i = 0; i < GUN.ammo; i++) { c.fillStyle = i < ammo[gi] ? '#ffd060' : '#3a3028'; c.fillRect(x0 - 16 - i * 20, 96, 12, 32); }
  });
  // Chefe
  if (boss != null) {
    c.fillStyle = '#f2e6d8'; c.font = 'bold 26px sans-serif'; c.textAlign = 'center';
    c.fillText(bossName, w / 2, 22);
    c.fillStyle = 'rgba(0,0,0,0.6)'; c.fillRect(120, 42, w - 240, 18);
    c.fillStyle = '#c0392b'; c.fillRect(120, 42, (w - 240) * boss, 18);
  }
  c.shadowBlur = 0;
  hud.tex.needsUpdate = true;
}

// ---------- HTML (PC) ----------
const hintEl = document.getElementById('hint');
const fpsEl = document.getElementById('fps');
const crossEl = document.getElementById('cross');
function updateHint() {
  if (renderer.xr.isPresenting) { hintEl.textContent = ''; return; }
  hintEl.textContent = app === 'playing'
    ? 'Clique atira · botão direito ou R recarrega · Esc pausa'
    : 'Clique nas opções do painel · No Quest, use o botão "Entrar em VR"';
}

const vrBtn = document.getElementById('vr');
async function setupVR() {
  const ok = navigator.xr && await navigator.xr.isSessionSupported('immersive-vr').catch(() => false);
  if (!ok) {
    vrBtn.textContent = window.isSecureContext ? 'VR não disponível neste navegador' : 'VR precisa de HTTPS';
    vrBtn.disabled = true;
    return;
  }
  vrBtn.textContent = 'Entrar em VR';
  vrBtn.disabled = false;
  vrBtn.onclick = async () => {
    sfx.unlock();
    if (renderer.xr.isPresenting) { renderer.xr.getSession()?.end(); return; }
    try {
      const session = await navigator.xr.requestSession('immersive-vr', { optionalFeatures: ['local-floor', 'bounded-floor'] });
      await renderer.xr.setSession(session);
      vrBtn.textContent = 'Sair do VR';
      session.addEventListener('end', () => { vrBtn.textContent = 'Entrar em VR'; });
    } catch (err) {
      vrBtn.textContent = 'Erro ao entrar em VR';
      console.error(err);
    }
  };
}
setupVR();

// ---------- Laço principal ----------
let acc = 0, lastT = performance.now();
let fpsFrames = 0, fpsTime = 0;
const camLocalDir = new THREE.Vector3();

function frame() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  time += dt;
  const vr = renderer.xr.isPresenting;
  if (recenterIn > 0 && --recenterIn === 0) recenter();
  if (vr) pollVR();
  if (dev.autoplay) autoplay(dt);

  if (game) {
    rig.position.set(game.pos.x, 0, game.pos.z);
    rig.rotation.y = game.yaw;
    camera.getWorldPosition(tmpV);
    game.setHead(tmpV.x, tmpV.y, tmpV.z);
  }

  if (app === 'playing' && game) {
    acc += dt;
    const n = Math.min(12, Math.floor(acc / DT));
    for (let i = 0; i < n; i++) game.step(DT);
    acc -= n * DT;
  } else acc = 0;

  // Monstros e gosmas
  if (game) {
    const seen = new Set();
    for (const m of game.monsters) {
      seen.add(m.id);
      let mdl = models.get(m.id);
      if (!mdl) { mdl = makeMonster(m); models.set(m.id, mdl); scene.add(mdl.root); }
      mdl.update(m, time, dt);
    }
    for (const [id, mdl] of models) if (!seen.has(id)) { scene.remove(mdl.root); models.delete(id); }
    const seenG = new Set();
    for (const p of game.projectiles) {
      seenG.add(p.id);
      let gm = goos.get(p.id);
      if (!gm) { gm = makeGoo(); goos.set(p.id, gm); scene.add(gm); }
      gm.position.set(p.x, p.y, p.z);
      gm.scale.setScalar(1 + Math.sin(time * 20) * 0.1);
    }
    for (const [id, gm] of goos) if (!seenG.has(id)) { scene.remove(gm); goos.delete(id); }
  }

  // Revólveres
  for (let gi = 0; gi < 2; gi++) {
    const st = game ? game.guns[gi] : { ammo: GUN.ammo, reloading: 0 };
    guns[gi].update(dt, st.ammo, st.reloading);
  }
  if (!vr) {
    // A arma do PC aponta para onde o mouse mira.
    raycaster.setFromCamera(mouse.ndc, camera);
    camLocalDir.copy(raycaster.ray.direction).applyQuaternion(camera.getWorldQuaternion(tmpQ).invert());
    guns[0].group.quaternion.setFromUnitVectors(Z_NEG, camLocalDir);
    const showCross = app === 'playing' && !panel.visible;
    crossEl.style.display = showCross ? 'block' : 'none';
    crossEl.style.transform = `translate(${mouse.px[0]}px, ${mouse.px[1]}px)`;
  } else crossEl.style.display = 'none';

  muzzleLight.intensity = Math.max(0, muzzleLight.intensity - dt * 60);
  hurtT = Math.max(0, hurtT - dt);
  hurtSphere.material.opacity = hurtT * 0.7;
  fadeSphere.material.opacity = game ? game.fade : 0;
  effects.update(dt);
  stageVis?.update(time);
  drawHUD();
  updateMenuRays();

  fpsFrames++; fpsTime += dt;
  if (fpsTime >= 0.5) {
    const f = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0; fpsTime = 0;
    fpsEl.style.display = save.fps && !vr ? 'block' : 'none';
    fpsEl.textContent = `${f} FPS`;
    fpsLabel.mesh.visible = save.fps && vr;
    fpsLabel.set(`${f} FPS`);
  }
  renderer.render(scene, camera);
}

// Para testes no console: ppvr.startStage(0); ppvr.dev.autoplay = true; ppvr.dev.advance(60)
const dev = { autoplay: false, cd: 0 };
function autoplay(dt) {
  if (!game || app !== 'playing') return;
  dev.cd -= dt;
  const g = game.guns[0];
  if (g.ammo === 0 && g.reloading === 0) { game.reload(0); return; }
  if (dev.cd > 0) return;
  const t = game.autoTarget();
  if (!t) return;
  dev.cd = 0.3;
  const h = game.headPos();
  const dx = t.x - h.x, dy = t.y - h.y, dz = t.z - h.z, l = Math.hypot(dx, dy, dz);
  game.shoot(0, h.x, h.y, h.z, dx / l, dy / l, dz / l);
}
dev.advance = (sec) => { for (let i = 0; i < sec * 72; i++) { lastT = performance.now() - 1000 / 72; frame(); } };
window.ppvr = { get game() { return game; }, save, startStage, doAction, dev, camera };

attachGuns();
goMenu();
renderer.setAnimationLoop(frame);
