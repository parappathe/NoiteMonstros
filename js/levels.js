// As 3 fases. Não depende de navegador.
// path: pontos [x, z] do caminho no chão. O jogador anda de ponto em ponto.
// stops: nos pontos com encontro o jogador para; cada encontro tem ondas de monstros.
// Cada monstro da onda: [tipo, ângulo (graus, 0 = em frente, + = direita), distância (m), atraso (s), 'rise'?]
//   'rise' = sai da terra.
// Uma onda só começa quando a anterior acabou.
// props: coisas quebráveis a tiro [ponto do caminho, ângulo, distância, altura, 'life' | 'points', tipo visual]
// boss: [ponto do caminho, tipo do chefe, distância]

export const STAGES = [
  {
    id: 'cemiterio', name: 'Fase 1 · Cemitério', short: 'Cemitério',
    path: [[0, 0], [0, -9], [4, -18], [4, -30], [-3, -41], [-3, -52], [0, -62]],
    stops: {
      1: [
        [['zombie', -25, 9, 0], ['zombie', 20, 10, 0.6], ['zombie', 0, 12, 1.5]],
        [['zombie', -40, 6, 0, 'rise'], ['zombie', 35, 6.5, 0.4, 'rise'], ['runner', 5, 14, 1.4]],
      ],
      2: [
        [['bat', -30, 10, 0], ['bat', 30, 10, 0.5], ['bat', 0, 12, 1]],
        [['zombie', -15, 8, 0, 'rise'], ['zombie', 18, 8, 0.3, 'rise'], ['spitter', 0, 12, 0.6]],
      ],
      3: [
        [['runner', -30, 12, 0], ['runner', 30, 12, 0.6], ['zombie', 0, 9, 1.1]],
        [['zombie', -50, 6, 0, 'rise'], ['zombie', 50, 6, 0.3, 'rise'], ['bat', 0, 10, 1], ['bat', 20, 11, 1.4]],
      ],
      4: [
        [['spitter', -25, 12, 0], ['spitter', 25, 12, 0.5], ['zombie', 0, 8, 1, 'rise']],
        [['runner', -10, 13, 0], ['runner', 10, 13, 0.4], ['runner', 0, 15, 0.8]],
      ],
      5: [
        [['zombie', -30, 7, 0, 'rise'], ['zombie', 30, 7, 0.2, 'rise'], ['zombie', -10, 10, 0.6], ['zombie', 10, 10, 0.8], ['bat', 0, 12, 1.6]],
      ],
    },
    props: [[2, 40, 5, 0.45, 'life', 'crate'], [4, -45, 6, 0.45, 'points', 'crate'], [5, 25, 6, 0.45, 'life', 'crate']],
    boss: [6, 'coveiro', 10],
  },
  {
    id: 'mansao', name: 'Fase 2 · Mansão', short: 'Mansão',
    path: [[0, 0], [0, -8], [0, -16], [7, -16], [15, -16], [15, -27], [15, -35], [7, -35], [7, -44]],
    stops: {
      1: [
        [['zombie', -35, 8, 0], ['zombie', 35, 8, 0.3], ['zombie', 0, 11, 0.8]],
        [['runner', -20, 10, 0], ['runner', 20, 10, 0.4], ['bat', 0, 9, 0.8], ['bat', 15, 10, 1.1]],
      ],
      3: [
        [['zombie', 0, 8, 0], ['zombie', -10, 11, 0.5], ['zombie', 10, 11, 0.7]],
        [['spitter', 0, 12, 0], ['runner', -8, 10, 0.5], ['runner', 8, 10, 0.8]],
      ],
      4: [
        [['bat', -40, 8, 0], ['bat', 40, 8, 0.2], ['bat', -20, 10, 0.4], ['bat', 20, 10, 0.6]],
        [['zombie', -30, 7, 0], ['spitter', 30, 11, 0.3], ['zombie', 0, 9, 0.6], ['runner', 0, 13, 1.2]],
      ],
      5: [
        [['runner', -25, 12, 0], ['runner', 25, 12, 0.3], ['runner', 0, 14, 0.6], ['zombie', -40, 6, 0.9], ['zombie', 40, 6, 1.1]],
        [['spitter', -20, 12, 0], ['spitter', 20, 12, 0.4]],
      ],
      7: [
        [['zombie', -20, 8, 0], ['zombie', 20, 8, 0.3], ['runner', 0, 12, 0.6], ['bat', -10, 10, 1], ['bat', 10, 10, 1.2]],
      ],
    },
    props: [[1, 0, 6, 3.1, 'life', 'chandelier'], [5, 30, 5, 0.6, 'points', 'vase'], [7, -30, 5, 0.6, 'life', 'vase']],
    boss: [8, 'aranha', 9],
  },
  {
    id: 'laboratorio', name: 'Fase 3 · Laboratório', short: 'Laboratório',
    path: [[0, 0], [0, -10], [-6, -18], [-6, -30], [2, -40], [2, -52]],
    stops: {
      1: [
        [['runner', -20, 12, 0], ['runner', 20, 12, 0.3], ['zombie', 0, 9, 0.6]],
        [['spitter', -30, 12, 0], ['spitter', 30, 12, 0.3], ['bat', 0, 10, 0.9]],
      ],
      2: [
        [['zombie', -40, 7, 0], ['zombie', 40, 7, 0.2], ['zombie', -15, 9, 0.4], ['zombie', 15, 9, 0.6], ['runner', 0, 14, 1]],
        [['bat', -30, 9, 0], ['bat', 30, 9, 0.3], ['bat', 0, 11, 0.6], ['spitter', 0, 13, 1]],
      ],
      3: [
        [['runner', -30, 13, 0], ['runner', 30, 13, 0.2], ['runner', -10, 14, 0.4], ['runner', 10, 14, 0.6]],
        [['spitter', -25, 12, 0], ['spitter', 25, 12, 0.3], ['zombie', 0, 8, 0.6]],
      ],
      4: [
        [['zombie', -45, 6, 0], ['zombie', 45, 6, 0.2], ['bat', -15, 10, 0.5], ['bat', 15, 10, 0.7], ['runner', 0, 13, 1], ['runner', 10, 14, 1.3]],
        [['spitter', -30, 12, 0], ['spitter', 0, 13, 0.3], ['spitter', 30, 12, 0.6]],
      ],
    },
    props: [[2, -35, 5, 0.5, 'life', 'barrel'], [4, 40, 6, 0.5, 'points', 'barrel'], [3, 30, 5, 0.5, 'life', 'barrel']],
    boss: [5, 'criatura', 9],
  },
];

// Direção (yaw) para olhar de a para b. yaw 0 = olhando para -Z (padrão do Three.js).
export function yawTo(ax, az, bx, bz) { return Math.atan2(-(bx - ax), -(bz - az)); }

// Ponto a partir de uma posição/yaw, num ângulo (graus, + = direita) e distância.
export function relPoint(x, z, yaw, angDeg, dist) {
  const a = angDeg * Math.PI / 180;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // frente
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);    // direita
  return { x: x + (fx * Math.cos(a) + rx * Math.sin(a)) * dist, z: z + (fz * Math.cos(a) + rz * Math.sin(a)) * dist };
}

// Yaw de chegada em cada ponto do caminho (direção do trecho anterior).
export function nodeYaw(stage, i) {
  const p = stage.path;
  if (i === 0) return yawTo(p[0][0], p[0][1], p[1][0], p[1][1]);
  return yawTo(p[i - 1][0], p[i - 1][1], p[i][0], p[i][1]);
}
