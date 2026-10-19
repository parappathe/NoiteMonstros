// Progresso e opções, salvos no navegador.
const KEY = 'noitemonstros.v1';
const DEFAULTS = {
  unlocked: 1,     // fases liberadas (1 a 3)
  best: {},        // melhor pontuação por fase: { 0: 12000, ... }
  bestRun: 0,      // melhor total jogando as 3 fases seguidas
  comfort: false,  // VR: teletransporte entre as paradas em vez de andar
  fps: false,
};

export function loadSave() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
  catch { return { ...DEFAULTS }; }
}

export function storeSave(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* sem armazenamento */ }
}
