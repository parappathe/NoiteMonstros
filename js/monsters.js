// Tipos de monstro e chefes. Não depende de navegador.
// parts: esferas atingíveis no espaço do monstro (pés na origem, frente = para o jogador).
//   mult = dano por bala (0 = armadura: a bala bate e não fere). head: conta como tiro na cabeça.
//   when(m): parte só existe/fere quando a função devolve true (ex.: núcleo aberto).

export const TYPES = {
  zombie: {
    hp: 3, speed: 0.9, range: 1.3, windup: 0.9, recover: 1.6, points: 100, height: 1.75,
    parts: [{ y: 1.62, z: 0.04, r: 0.17, mult: 3, head: true }, { y: 1.15, r: 0.3, mult: 1 }, { y: 0.55, r: 0.24, mult: 1 }],
  },
  runner: {
    hp: 2, speed: 2.8, range: 1.3, windup: 0.6, recover: 1.3, points: 150, height: 1.7,
    parts: [{ y: 1.56, z: 0.1, r: 0.16, mult: 3, head: true }, { y: 1.1, z: 0.05, r: 0.27, mult: 1 }, { y: 0.5, r: 0.22, mult: 1 }],
  },
  bat: {
    hp: 1, speed: 3.2, range: 0.9, windup: 0.25, recover: 1.5, points: 120, fly: true, height: 0.4,
    parts: [{ y: 0, r: 0.24, mult: 1 }],
  },
  spitter: {
    hp: 4, speed: 1.0, range: 1.3, windup: 0.8, recover: 1.8, points: 200, keep: 7, spitEvery: 3.4, height: 1.6,
    parts: [{ y: 1.45, z: 0.05, r: 0.17, mult: 2, head: true }, { y: 0.95, r: 0.42, mult: 1 }],
  },
};

export const BOSSES = {
  coveiro: {
    name: 'O Coveiro', hp: 34, points: 5000, height: 3.6,
    // Lanterna (ponto fraco) na mão esquerda; o resto é couro duro.
    parts: [
      { y: 2.05, x: 0.75, z: 0.45, r: 0.24, mult: 1, weak: true },
      { y: 3.3, r: 0.38, mult: 0 }, { y: 2.3, r: 0.75, mult: 0 }, { y: 1.0, r: 0.55, mult: 0 },
    ],
    keep: 4.5, strafe: 2.2, speed: 1.2, attackEvery: 5, windup: 1.6, staggerHits: 3, summon: ['zombie', 12],
  },
  aranha: {
    name: 'A Aranha do Sótão', hp: 40, points: 6000, height: 1.4,
    parts: [
      { y: 0.25, z: 0.75, r: 0.28, mult: 1, weak: true }, // olhos
      { y: 0, z: 0.1, r: 0.85, mult: 0 }, { y: 0.1, z: -0.9, r: 0.75, mult: 0 },
    ],
    keep: 6, strafe: 2.5, speed: 1.6, attackEvery: 6, windup: 1.3, staggerHits: 4, summon: ['bat', 14], lunge: true,
  },
  criatura: {
    name: 'A Criatura', hp: 44, points: 8000, height: 3.4,
    parts: [
      { y: 2.0, z: 0.82, r: 0.32, mult: 1, weak: true, when: (m) => m.open },
      { y: 3.1, r: 0.4, mult: 0 }, { y: 2.0, r: 0.72, mult: 0 }, { y: 0.9, r: 0.55, mult: 0 },
    ],
    keep: 7, strafe: 2.5, speed: 1.0, attackEvery: 7, windup: 1.4, staggerHits: 3, spitEvery: 2.6, openTime: 3.6, closedTime: 3.2,
  },
};
