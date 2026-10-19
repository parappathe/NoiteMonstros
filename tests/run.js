// Testes automáticos: node tests/run.js  (tem que terminar com "Tudo certo")
import { RailGame, raySphere, GUN } from '../js/game.js';
import { STAGES, relPoint, yawTo } from '../js/levels.js';
import { TYPES, BOSSES } from '../js/monsters.js';

let fails = 0, count = 0;
function ok(cond, msg) { count++; if (!cond) { fails++; console.log('  FALHOU: ' + msg); } }
const section = (n) => console.log(n);
function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const DT = 1 / 120;

// Robô: mira no alvo sugerido com erro (m) e atira com as 2 armas, recarregando quando vazia.
function runBot(g, { shoot = true, err = 0, rate = 4, maxTime = 1200, rng = Math.random } = {}) {
  let t = 0, cd = [0, 0.12];
  while (g.playing && t < maxTime) {
    g.step(DT); t += DT;
    if (!shoot) continue;
    for (let gi = 0; gi < 2; gi++) {
      cd[gi] -= DT;
      const gun = g.guns[gi];
      if (gun.ammo === 0 && gun.reloading === 0) { g.reload(gi); continue; }
      if (cd[gi] > 0) continue;
      const tg = g.autoTarget();
      if (!tg) continue;
      cd[gi] = 1 / rate;
      const h = g.headPos();
      const ex = (rng() - 0.5) * 2 * err, ey = (rng() - 0.5) * 2 * err;
      let dx = tg.x + ex - h.x, dy = tg.y + ey - h.y, dz = tg.z - h.z;
      const l = Math.hypot(dx, dy, dz);
      g.shoot(gi, h.x, h.y, h.z, dx / l, dy / l, dz / l);
    }
  }
  return t;
}

section('Tiro e munição');
{
  ok(raySphere(0, 0, 0, 0, 0, -1, 0, 0, -5, 0.5) === 4.5, 'raio acerta a esfera na frente');
  ok(raySphere(0, 0, 0, 0, 0, -1, 0, 0, 5, 0.5) === Infinity, 'raio não acerta o que está atrás');
  ok(raySphere(0, 0, 0, 0, 0, -1, 0.6, 0, -5, 0.5) === Infinity, 'raio passa ao lado');
}
{
  const g = new RailGame({ stage: 0, rng: seeded(1) });
  g.state = 'encounter'; g.enc = { node: 0, waves: [], wi: 0, queue: [], gap: 0 };
  const a = g.spawn('zombie', 0, -6), b = g.spawn('zombie', 0, -9);
  const h = g.headPos();
  // Atira na cabeça do da frente: mata ele (cabeça = 3 de dano) e não fere o de trás.
  const head = g.partsOf(a).find(q => q.part.head);
  let dx = head.x - h.x, dy = head.y - h.y, dz = head.z - h.z; let l = Math.hypot(dx, dy, dz);
  const r = g.shoot(0, h.x, h.y, h.z, dx / l, dy / l, dz / l);
  ok(r.outcome === 'headkill' && a.state === 'dying', 'tiro na cabeça do zumbi mata na hora');
  ok(b.hp === TYPES.zombie.hp, 'o monstro de trás não leva o tiro');
  // Corpo: precisa de 3 tiros.
  const body = () => g.partsOf(b).find(q => !q.part.head && q.y > 1);
  let outs = [];
  for (let i = 0; i < 3; i++) {
    g.guns[0].cd = 0;
    const q = body(); dx = q.x - h.x; dy = q.y - h.y; dz = q.z - h.z; l = Math.hypot(dx, dy, dz);
    outs.push(g.shoot(0, h.x, h.y, h.z, dx / l, dy / l, dz / l).outcome);
  }
  ok(outs.join(',') === 'hit,hit,kill', `3 tiros no corpo matam (${outs.join(',')})`);
  ok(g.guns[0].ammo === GUN.ammo - 4, 'cada tiro gasta uma bala');
  g.guns[0].cd = 0; g.shoot(0, h.x, h.y, h.z, 0, 1, 0); g.guns[0].cd = 0; g.shoot(0, h.x, h.y, h.z, 0, 1, 0);
  g.guns[0].cd = 0;
  ok(g.shoot(0, h.x, h.y, h.z, 0, 1, 0).empty === true, 'arma vazia depois de 6 tiros');
  ok(g.reload(0) && g.guns[0].reloading > 0, 'recarga começa');
  for (let t = 0; t < GUN.reload - 0.05; t += DT) g.step(DT);
  ok(g.guns[0].ammo === 0, 'recarga ainda não terminou antes do tempo');
  for (let t = 0; t < 0.1; t += DT) g.step(DT);
  ok(g.guns[0].ammo === GUN.ammo, 'recarga enche a arma');
  ok(g.guns[1].ammo === GUN.ammo, 'a outra arma não foi usada');
}
{
  // Monstro que chega ataca e tira vida.
  const g = new RailGame({ stage: 0, rng: seeded(2) });
  g.state = 'encounter'; g.enc = { node: 0, waves: [], wi: 0, queue: [{ m: ['zombie', 0, 99, 999], t: 999 }], gap: 0 };
  g.spawn('runner', 0, -3);
  const lives = g.lives;
  for (let t = 0; t < 3; t += DT) g.step(DT);
  ok(g.lives === lives - 1, `monstro que chega tira 1 vida (${lives} → ${g.lives})`);
}
{
  // Gosma do cuspidor pode ser acertada no ar.
  const g = new RailGame({ stage: 0, rng: seeded(3) });
  g.state = 'encounter'; g.enc = { node: 0, waves: [], wi: 0, queue: [{ m: ['zombie', 0, 99, 999], t: 999 }], gap: 0 };
  const s = g.spawn('spitter', 0, -7);
  let t = 0;
  while (!g.projectiles.length && t < 6) { g.step(DT); t += DT; }
  ok(g.projectiles.length === 1, 'cuspidor joga gosma');
  for (let i = 0; i < 30; i++) g.step(DT);
  const p = g.projectiles[0], h = g.headPos();
  const dx = p.x - h.x, dy = p.y - h.y, dz = p.z - h.z, l = Math.hypot(dx, dy, dz);
  ok(g.shoot(1, h.x, h.y, h.z, dx / l, dy / l, dz / l).outcome === 'proj' && g.projectiles.length === 0, 'tiro destrói a gosma');
}

section('Fases');
{
  for (const S of STAGES) {
    const stopNodes = Object.keys(S.stops).map(Number);
    ok(stopNodes.every(n => n > 0 && n < S.path.length - 1) && S.boss[0] === S.path.length - 1, `${S.short}: encontros no meio do caminho e chefe no fim`);
  }
  // Robô que não atira perde.
  const g = new RailGame({ stage: 0, rng: seeded(4) });
  runBot(g, { shoot: false, maxTime: 400 });
  ok(g.state === 'gameover', 'quem não atira perde todas as vidas');
}
const summary = [];
for (const comfort of [false, true]) {
  STAGES.forEach((S, i) => {
    const rng = seeded(10 + i);
    let bossSeen = false, bossDead = false;
    const g = new RailGame({ stage: i, rng, comfort, onEvent: (t) => { if (t === 'boss') bossSeen = true; if (t === 'bossDead') bossDead = true; } });
    const t = runBot(g, { err: 0.04, rate: 3.5, rng });
    ok(g.state === 'clear', `${S.short}${comfort ? ' (conforto)' : ''}: robô que mira bem termina a fase (estado ${g.state}, ${t.toFixed(0)} s, vidas ${g.lives})`);
    ok(bossSeen && bossDead, `${S.short}: chefe aparece e morre`);
    if (!comfort) summary.push(`${S.short}: ${(t / 60).toFixed(1)} min, vidas ${g.lives}/5, precisão ${Math.round((g.result?.accuracy || 0) * 100)}%, pontos ${g.score}`);
  });
}
console.log('  ' + summary.join('\n  '));
{
  // Robô lento e que mira mal (erro de 35 cm) sofre mais: perde mais vidas que o que mira bem.
  let lost = 0;
  STAGES.forEach((S, i) => {
    const rng = seeded(50 + i);
    const g = new RailGame({ stage: i, rng });
    runBot(g, { err: 0.35, rate: 1.2, rng, maxTime: 900 });
    lost += 5 - Math.max(0, g.lives);
  });
  console.log(`  robô que mira mal perdeu ${lost} vidas nas 3 fases`);
  ok(lost >= 3, 'mirar mal tem que custar vidas');
}

console.log(fails ? `\n${fails} de ${count} verificações falharam.` : `\nTudo certo (${count} verificações).`);
process.exit(fails ? 1 : 0);
