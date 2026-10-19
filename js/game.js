// Núcleo de uma fase: andar no trilho, encontros, monstros, chefe, tiros, munição, vidas e
// pontos. Não depende de navegador (os testes rodam com um robô atirando).
import { STAGES, relPoint, yawTo, nodeYaw } from './levels.js';
import { TYPES, BOSSES } from './monsters.js';

export const GUN = { ammo: 6, reload: 0.75, cooldown: 0.14 };
export const MAX_LIVES = 7;
const MOVE_SPEED = 1.8;     // m/s andando no trilho
const TURN_SPEED = 0.9;     // rad/s girando nas curvas
const FADE = 0.7;           // s do escurecer/clarear no modo conforto
const HEAD_Y = 1.6;

const wrap = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// Distância ao longo do raio (origem o, direção d unitária) até a esfera; Infinity se não acerta.
export function raySphere(ox, oy, oz, dx, dy, dz, cx, cy, cz, r) {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tca = lx * dx + ly * dy + lz * dz;
  const d2 = lx * lx + ly * ly + lz * lz - tca * tca;
  if (d2 > r * r) return Infinity;
  const thc = Math.sqrt(r * r - d2);
  const t0 = tca - thc, t1 = tca + thc;
  if (t1 < 0) return Infinity;
  return t0 >= 0 ? t0 : t1;
}

let nextId = 1;

export class RailGame {
  constructor({ stage = 0, rng = Math.random, comfort = false, lives = 5, onEvent = null } = {}) {
    this.stageIndex = stage;
    this.S = STAGES[stage];
    this.rng = rng;
    this.comfort = comfort;
    this.onEvent = onEvent;
    const p = this.S.path;
    this.pos = { x: p[0][0], z: p[0][1] };
    this.yaw = yawTo(p[0][0], p[0][1], p[1][0], p[1][1]);
    this.node = 0;
    this.time = 0;
    this.lives = lives;
    this.inv = 0;
    this.guns = [0, 1].map(() => ({ ammo: GUN.ammo, reloading: 0, cd: 0 }));
    this.monsters = [];
    this.projectiles = [];
    this.props = this.S.props.map(([n, ang, dist, h, drop, kind]) => {
      const q = relPoint(p[n][0], p[n][1], nodeYaw(this.S, n), ang, dist);
      return { x: q.x, y: h, z: q.z, r: kind === 'chandelier' ? 0.55 : 0.42, drop, kind, alive: true, id: nextId++ };
    });
    this.score = 0;
    this.stats = { shots: 0, hits: 0, heads: 0, kills: 0 };
    this.head = null;
    this.enc = null;
    this.boss = null;
    this.fade = 0;          // 0..1 (modo conforto: tela escura)
    this.state = 'intro';
    this.timer = 1.5;
    this.result = null;
  }

  emit(type, data = {}) { this.onEvent?.(type, data); }

  // Posição da cabeça do jogador (o VR informa a real; sem isso, altura padrão no trilho).
  setHead(x, y, z) { this.head = { x, y, z }; }
  headPos() { return this.head || { x: this.pos.x, y: HEAD_Y, z: this.pos.z }; }
  get bossNode() { return this.S.boss[0]; }
  get playing() { return this.state !== 'gameover' && this.state !== 'clear'; }

  // ---------- Laço ----------
  step(dt) {
    this.time += dt;
    if (this.inv > 0) this.inv -= dt;
    for (const g of this.guns) {
      if (g.cd > 0) g.cd -= dt;
      if (g.reloading > 0) { g.reloading -= dt; if (g.reloading <= 0) { g.reloading = 0; g.ammo = GUN.ammo; this.emit('reloaded', { gun: this.guns.indexOf(g) }); } }
    }
    if (this.state === 'gameover' || this.state === 'clear') return;

    switch (this.state) {
      case 'intro':
        this.timer -= dt;
        if (this.timer <= 0) this._leave();
        break;
      case 'moving': this._move(dt); break;
      case 'fade': this._fadeStep(dt); break;
      case 'encounter': this._encounterStep(dt); break;
      case 'boss': break;
      case 'bossDead':
        this.timer -= dt;
        if (this.timer <= 0) this._clear();
        break;
    }
    this._monsters(dt);
    this._projectiles(dt);
  }

  _nextStop(from) {
    for (let j = from + 1; j < this.S.path.length; j++) if (this.S.stops[j] || j === this.bossNode) return j;
    return this.S.path.length - 1;
  }

  _leave() {
    if (this.comfort) { this.state = 'fade'; this.timer = 0; this.fadeTarget = this._nextStop(this.node); }
    else this.state = 'moving';
    this.emit('move', {});
  }

  _move(dt) {
    const p = this.S.path;
    const target = p[this.node + 1];
    const dx = target[0] - this.pos.x, dz = target[1] - this.pos.z;
    const d = Math.hypot(dx, dz);
    const want = yawTo(this.pos.x, this.pos.z, target[0], target[1]);
    const dy = wrap(want - this.yaw);
    this.yaw = wrap(this.yaw + clamp(dy, -TURN_SPEED * dt, TURN_SPEED * dt));
    const step = MOVE_SPEED * dt;
    if (d <= step) {
      this.pos.x = target[0]; this.pos.z = target[1];
      this._arrive(this.node + 1);
    } else { this.pos.x += dx / d * step; this.pos.z += dz / d * step; }
  }

  _fadeStep(dt) {
    this.timer += dt;
    const half = FADE / 2;
    this.fade = this.timer < half ? this.timer / half : Math.max(0, 1 - (this.timer - half) / half);
    if (this.timer >= half && this.fadeTarget != null) {
      const n = this.fadeTarget;
      this.fadeTarget = null;
      this.pos.x = this.S.path[n][0]; this.pos.z = this.S.path[n][1];
      this.yaw = nodeYaw(this.S, n);
      this.node = n;
      this.emit('teleport', {});
    }
    if (this.timer >= FADE) { this.fade = 0; this._arrive(this.node, true); }
  }

  _arrive(n, already = false) {
    if (!already) this.node = n;
    if (n === this.bossNode) return this._startBoss();
    if (this.S.stops[n]) return this._startEncounter(n);
    if (n >= this.S.path.length - 1) return this._clear();
    this.state = 'moving';
  }

  // ---------- Encontros ----------
  _startEncounter(n) {
    this.enc = { node: n, waves: this.S.stops[n], wi: -1, queue: [], gap: 0 };
    this.state = 'encounter';
    this._nextWave();
    this.emit('encounter', { node: n });
  }

  _nextWave() {
    const e = this.enc;
    e.wi++;
    e.queue = e.wi < e.waves.length ? e.waves[e.wi].map(m => ({ m, t: m[3] || 0 })) : [];
  }

  _encounterStep(dt) {
    const e = this.enc;
    for (const q of e.queue) {
      q.t -= dt;
      if (q.t <= 0 && !q.done) { q.done = true; this._spawnRel(q.m); }
    }
    e.queue = e.queue.filter(q => !q.done);
    const alive = this.monsters.some(m => m.state !== 'dying');
    if (e.queue.length || alive) { e.gap = 0; return; }
    e.gap += dt;
    if (e.gap < 0.7) return;
    e.gap = 0;
    if (e.wi + 1 < e.waves.length) { this._nextWave(); this.emit('wave', { index: e.wi }); return; }
    this.enc = null;
    this.emit('encounterClear', {});
    this._leave();
  }

  _stopPose() {
    const n = this.node;
    return { x: this.S.path[n][0], z: this.S.path[n][1], yaw: nodeYaw(this.S, n) };
  }

  _spawnRel([type, ang, dist, , mode]) {
    const s = this._stopPose();
    const q = relPoint(s.x, s.z, s.yaw, ang, dist);
    return this.spawn(type, q.x, q.z, mode);
  }

  spawn(type, x, z, mode = null) {
    const def = TYPES[type];
    const m = {
      id: nextId++, type, def, boss: false, x, z, y: 0, yaw: 0, hp: def.hp, maxHp: def.hp,
      state: 'walk', t: 0, phase: this.rng() * 6.28, flash: 0, spitT: 1 + this.rng() * 1.5, killedBy: null,
    };
    if (def.fly) { m.y = 1.7 + this.rng() * 0.7; m.zig = (this.rng() < 0.5 ? -1 : 1); }
    if (mode === 'rise') { m.state = 'rise'; m.t = 1.1; m.y = -def.height; }
    m.yaw = yawTo(x, z, this.pos.x, this.pos.z);
    this.monsters.push(m);
    this.emit('spawn', { id: m.id, type, rise: mode === 'rise' });
    return m;
  }

  // ---------- Chefe ----------
  _startBoss() {
    const [, type, dist] = this.S.boss;
    const def = BOSSES[type];
    const s = this._stopPose();
    const q = relPoint(s.x, s.z, s.yaw, 0, dist);
    const b = {
      id: nextId++, type, def, boss: true, x: q.x, z: q.z, y: type === 'aranha' ? 3.4 : 0, yaw: 0,
      hp: def.hp, maxHp: def.hp, state: 'enter', t: 2.2, phase: 0, flash: 0,
      dist, ang: 0, attackT: def.attackEvery, summonT: def.summon ? def.summon[1] : 0, weakHits: 0,
      open: !def.openTime, openT: def.closedTime || 0, spitT: def.spitEvery || 0,
    };
    this.boss = b;
    this.monsters.push(b);
    this.state = 'boss';
    this.emit('boss', { type, name: def.name });
  }

  _bossStep(b, dt) {
    const def = b.def, s = this._stopPose();
    b.yaw = yawTo(b.x, b.z, this.pos.x, this.pos.z);
    if (b.state === 'dying') return;
    if (b.state === 'enter') {
      b.t -= dt;
      if (b.type === 'aranha') b.y = Math.max(1.0, b.y - dt * 1.2);
      if (b.t <= 0) b.state = 'walk';
    }
    // Abre/fecha o núcleo (Criatura).
    if (def.openTime) {
      b.openT -= dt;
      if (b.openT <= 0) { b.open = !b.open; b.openT = b.open ? def.openTime : def.closedTime; this.emit('bossOpen', { open: b.open }); }
    }
    // Distância desejada e passos de lado.
    let wantDist = def.keep;
    if (b.state === 'windup') wantDist = b.type === 'aranha' ? 1.6 : 2.3;
    if (b.state === 'stagger') wantDist = def.keep + 1.2;
    b.dist += clamp(wantDist - b.dist, -def.speed * dt * (b.state === 'windup' ? 2.2 : 1), def.speed * dt);
    const lateral = b.state === 'walk' ? Math.sin(this.time * 0.55) * def.strafe : 0;
    b.ang += clamp(Math.asin(clamp(lateral / Math.max(1, b.dist), -0.9, 0.9)) * 57.3 - b.ang, -25 * dt, 25 * dt);
    const q = relPoint(s.x, s.z, s.yaw, b.ang, b.dist);
    b.x = q.x; b.z = q.z;
    if (b.type === 'aranha' && b.state !== 'enter') {
      const wantY = b.state === 'recover' ? 2.4 : 1.0;
      b.y += clamp(wantY - b.y, -dt * 1.5, dt * 1.5);
    }
    if (b.state === 'enter') return;

    switch (b.state) {
      case 'walk':
        if (def.openTime && !b.open && def.spitEvery) {
          b.spitT -= dt;
          if (b.spitT <= 0) { b.spitT = def.spitEvery; this._spit(b, 2.2, -0.6); this._spit(b, 2.2, 0.6); }
        }
        b.attackT -= dt;
        if (b.attackT <= 0 && (!def.openTime || b.open)) {
          b.state = 'windup'; b.t = def.windup; b.weakHits = 0;
          this.emit('bossWindup', {});
        }
        break;
      case 'windup':
        b.t -= dt;
        if (b.t <= 0) { this._hurtPlayer(b); b.state = 'recover'; b.t = 1.6; }
        break;
      case 'recover': case 'stagger':
        b.t -= dt;
        if (b.t <= 0) { b.state = 'walk'; b.attackT = def.attackEvery; }
        break;
    }
    if (def.summon) {
      b.summonT -= dt;
      const minions = this.monsters.filter(m => !m.boss && m.state !== 'dying').length;
      if (b.summonT <= 0) {
        b.summonT = def.summon[1];
        if (minions < 3) {
          for (const side of [-1, 1]) {
            const p2 = relPoint(s.x, s.z, s.yaw, b.ang + side * 28, Math.max(4, b.dist - 1));
            this.spawn(def.summon[0], p2.x, p2.z, def.summon[0] === 'zombie' ? 'rise' : null);
          }
        }
      }
    }
  }

  // ---------- Monstros ----------
  _monsters(dt) {
    const h = this.headPos();
    for (const m of this.monsters) {
      if (m.flash > 0) m.flash -= dt;
      if (m.state === 'dying') { m.t -= dt; continue; }
      if (m.boss) { this._bossStep(m, dt); continue; }
      const def = m.def;
      const dx = this.pos.x - m.x, dz = this.pos.z - m.z;
      const dist = Math.hypot(dx, dz);
      m.yaw = yawTo(m.x, m.z, this.pos.x, this.pos.z);
      if (def.fly) { this._bat(m, dt, h); continue; }
      switch (m.state) {
        case 'rise':
          m.t -= dt;
          m.y = -def.height * Math.max(0, m.t / 1.1);
          if (m.t <= 0) { m.y = 0; m.state = 'walk'; }
          break;
        case 'walk': {
          const keep = def.keep || 0;
          if (dist > def.range && dist > keep) {
            const sp = def.speed * dt;
            m.x += dx / dist * sp; m.z += dz / dist * sp;
          } else if (dist <= def.range) { m.state = 'windup'; m.t = def.windup; this.emit('windup', { id: m.id }); }
          if (def.spitEvery && dist <= keep + 0.3) {
            m.spitT -= dt;
            if (m.spitT <= 0) { m.state = 'spit'; m.t = 0.7; }
          }
          break;
        }
        case 'spit':
          m.t -= dt;
          if (m.t <= 0) { this._spit(m, 1.45, 0); m.spitT = def.spitEvery; m.state = 'walk'; }
          break;
        case 'windup':
          m.t -= dt;
          if (m.t <= 0) {
            if (dist <= def.range + 0.5) this._hurtPlayer(m);
            m.state = 'recover'; m.t = def.recover;
          }
          break;
        case 'recover': case 'stagger':
          m.t -= dt;
          if (m.state === 'stagger') { m.x -= dx / Math.max(dist, 0.01) * dt * 0.8; m.z -= dz / Math.max(dist, 0.01) * dt * 0.8; }
          if (m.t <= 0) m.state = 'walk';
          break;
      }
    }
    // Afasta monstros grudados.
    const ground = this.monsters.filter(m => !m.boss && !m.def.fly && m.state !== 'dying');
    for (let i = 0; i < ground.length; i++) for (let j = i + 1; j < ground.length; j++) {
      const a = ground[i], b = ground[j];
      const dx = b.x - a.x, dz = b.z - a.z, d = Math.hypot(dx, dz);
      if (d < 0.75 && d > 1e-4) {
        const push = (0.75 - d) / 2;
        a.x -= dx / d * push; a.z -= dz / d * push; b.x += dx / d * push; b.z += dz / d * push;
      }
    }
    this.monsters = this.monsters.filter(m => !(m.state === 'dying' && m.t <= 0));
  }

  _bat(m, dt, h) {
    const def = m.def;
    const dx = h.x - m.x, dy = (h.y - 0.1) - m.y, dz = h.z - m.z;
    const d = Math.hypot(dx, dy, dz);
    if (m.state === 'walk') {
      // Zigue-zague que fecha conforme chega perto.
      const side = Math.sin(this.time * 3 + m.phase) * Math.min(1.4, d * 0.25) * m.zig;
      const rx = -dz / Math.max(d, 0.01), rz = dx / Math.max(d, 0.01);
      const tx = dx + rx * side, ty = dy + Math.sin(this.time * 4 + m.phase) * 0.3, tz = dz + rz * side;
      const tl = Math.hypot(tx, ty, tz);
      const sp = def.speed * dt;
      m.x += tx / tl * sp; m.y += ty / tl * sp; m.z += tz / tl * sp;
      if (d < def.range) { m.state = 'windup'; m.t = def.windup; }
    } else if (m.state === 'windup') {
      m.t -= dt;
      if (m.t <= 0) { if (d < def.range + 0.4) this._hurtPlayer(m); m.state = 'recover'; m.t = def.recover; }
    } else if (m.state === 'recover' || m.state === 'stagger') {
      // Foge para longe e volta.
      const sp = def.speed * dt;
      m.x -= dx / d * sp; m.z -= dz / d * sp; m.y += (2.3 - m.y) * dt;
      m.t -= dt;
      if (m.t <= 0) m.state = 'walk';
    }
  }

  _spit(m, mouthY, spread) {
    const h = this.headPos();
    const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw);
    const rx = Math.cos(m.yaw), rz = -Math.sin(m.yaw);
    const sx = m.x + fx * 0.4 + rx * spread, sy = m.y + mouthY, sz = m.z + fz * 0.4 + rz * spread;
    const dx = h.x - sx, dy = h.y - 0.1 - sy, dz = h.z - sz;
    const d = Math.hypot(dx, dy, dz);
    const speed = 4.2;
    this.projectiles.push({ id: nextId++, x: sx, y: sy, z: sz, vx: dx / d * speed, vy: dy / d * speed, vz: dz / d * speed, r: 0.22, life: 0 });
    this.emit('spit', { id: m.id });
  }

  _projectiles(dt) {
    const h = this.headPos();
    for (const p of this.projectiles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.life += dt;
      if (Math.hypot(h.x - p.x, h.y - 0.1 - p.y, h.z - p.z) < 0.45) { p.dead = true; this._hurtPlayer(null); }
      if (p.life > 5) p.dead = true;
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);
  }

  _hurtPlayer(src) {
    if (this.inv > 0 || !this.playing) return;
    this.lives--;
    this.inv = 1.3;
    this.emit('playerHit', { lives: this.lives, from: src?.type });
    if (this.lives <= 0) { this.state = 'gameover'; this.emit('gameover', {}); }
  }

  // ---------- Tiro ----------
  partsOf(m) {
    const out = [];
    const rx = Math.cos(m.yaw), rz = -Math.sin(m.yaw);
    const fx = -Math.sin(m.yaw), fz = -Math.cos(m.yaw);
    for (const p of m.def.parts) {
      if (p.when && !p.when(m)) continue;
      const x = p.x || 0, z = p.z || 0;
      out.push({ part: p, x: m.x + rx * x + fx * z, y: m.y + p.y, z: m.z + rz * x + fz * z, r: p.r });
    }
    return out;
  }

  // Raio contra tudo que pode levar tiro; devolve o mais perto.
  raycast(ox, oy, oz, dx, dy, dz) {
    let best = { t: Infinity };
    for (const m of this.monsters) {
      if (m.state === 'dying') continue;
      for (const q of this.partsOf(m)) {
        const t = raySphere(ox, oy, oz, dx, dy, dz, q.x, q.y, q.z, q.r);
        if (t < best.t) best = { t, kind: 'monster', m, part: q.part };
      }
    }
    for (const p of this.projectiles) {
      const t = raySphere(ox, oy, oz, dx, dy, dz, p.x, p.y, p.z, p.r + 0.05);
      if (t < best.t) best = { t, kind: 'proj', p };
    }
    for (const p of this.props) {
      if (!p.alive) continue;
      const t = raySphere(ox, oy, oz, dx, dy, dz, p.x, p.y, p.z, p.r);
      if (t < best.t) best = { t, kind: 'prop', p };
    }
    return best;
  }

  canShoot(gi) { const g = this.guns[gi]; return this.playing && g.reloading === 0 && g.cd <= 0; }

  // Atira com a arma gi a partir de o na direção d (unitária).
  shoot(gi, ox, oy, oz, dx, dy, dz) {
    const g = this.guns[gi];
    if (!this.playing || g.reloading > 0 || g.cd > 0) return { fired: false };
    if (g.ammo <= 0) { g.cd = 0.25; this.emit('empty', { gun: gi }); return { fired: false, empty: true }; }
    g.ammo--; g.cd = GUN.cooldown;
    this.stats.shots++;
    const hit = this.raycast(ox, oy, oz, dx, dy, dz);
    const point = hit.t < Infinity ? { x: ox + dx * hit.t, y: oy + dy * hit.t, z: oz + dz * hit.t } : null;
    let outcome = 'miss';
    if (hit.kind === 'monster') outcome = this._damage(hit.m, hit.part);
    else if (hit.kind === 'proj') { hit.p.dead = true; this.projectiles = this.projectiles.filter(p => p !== hit.p); this.stats.hits++; this.score += 50; outcome = 'proj'; }
    else if (hit.kind === 'prop') { this._breakProp(hit.p); outcome = 'prop'; }
    this.emit('shot', { gun: gi, outcome, point, id: hit.m?.id });
    if (g.ammo === 0) this.emit('lastBullet', { gun: gi });
    return { fired: true, outcome, point, hit };
  }

  reload(gi) {
    const g = this.guns[gi];
    if (g.reloading > 0 || g.ammo === GUN.ammo) return false;
    g.reloading = GUN.reload;
    this.emit('reload', { gun: gi });
    return true;
  }

  _damage(m, part) {
    if (part.mult === 0) { this.emit('armor', { id: m.id }); return 'armor'; }
    this.stats.hits++;
    m.flash = 0.12;
    if (m.boss) {
      m.hp -= part.mult;
      if (m.state === 'windup') {
        m.weakHits++;
        if (m.weakHits >= m.def.staggerHits) { m.state = 'stagger'; m.t = 1.3; this.emit('bossStagger', {}); }
      }
      if (m.hp <= 0) {
        m.state = 'dying'; m.t = 2.6;
        this.score += m.def.points;
        this.stats.kills++;
        for (const o of this.monsters) if (!o.boss && o.state !== 'dying') { o.state = 'dying'; o.t = 0.8; }
        this.projectiles = [];
        this.state = 'bossDead'; this.timer = 2.8;
        this.emit('bossDead', {});
        return 'kill';
      }
      return 'weak';
    }
    const head = !!part.head;
    if (head) this.stats.heads++;
    m.hp -= part.mult;
    if (m.hp <= 0) {
      m.state = 'dying'; m.t = 0.8; m.killedBy = head ? 'head' : 'body';
      const pts = Math.round(m.def.points * (head ? 1.5 : 1));
      this.score += pts;
      this.stats.kills++;
      this.emit('kill', { id: m.id, type: m.type, head, points: pts });
      return head ? 'headkill' : 'kill';
    }
    m.state = 'stagger'; m.t = 0.35;
    return head ? 'head' : 'hit';
  }

  _breakProp(p) {
    p.alive = false;
    this.stats.hits++;
    if (p.drop === 'life') this.lives = Math.min(MAX_LIVES, this.lives + 1);
    else this.score += 500;
    this.emit('prop', { id: p.id, drop: p.drop, lives: this.lives });
  }

  _clear() {
    const acc = this.stats.shots ? this.stats.hits / this.stats.shots : 0;
    const bonus = Math.round(acc * 2000) + this.lives * 300;
    this.score += bonus;
    this.result = { score: this.score, bonus, accuracy: acc, ...this.stats, lives: this.lives };
    this.state = 'clear';
    this.emit('clear', this.result);
  }

  // Alvo sugerido (para o autoplay e os testes): projétil mais perto, senão o monstro mais
  // perto, mirando o ponto fraco/cabeça.
  autoTarget() {
    const h = this.headPos();
    let best = null, bd = Infinity;
    for (const p of this.projectiles) {
      const d = Math.hypot(p.x - h.x, p.y - h.y, p.z - h.z) - 5;
      if (d < bd) { bd = d; best = { x: p.x, y: p.y, z: p.z }; }
    }
    for (const m of this.monsters) {
      if (m.state === 'dying') continue;
      const parts = this.partsOf(m).filter(q => q.part.mult > 0);
      if (!parts.length) continue;
      const q = parts.find(q => q.part.weak || q.part.head) || parts[0];
      const d = Math.hypot(q.x - h.x, q.z - h.z);
      if (d < bd) { bd = d; best = { x: q.x, y: q.y, z: q.z }; }
    }
    for (const p of this.props) {
      if (!p.alive || bd < Infinity) continue;
      const d = Math.hypot(p.x - h.x, p.z - h.z);
      if (d < 7) { bd = d; best = { x: p.x, y: p.y, z: p.z }; }
    }
    return best;
  }
}
