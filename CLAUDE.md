# NoiteMonstros

"Noite dos Monstros": tiro em trilho no estilo The House of the Dead para o Meta Quest 3, no
navegador do óculos (WebXR). O jogador anda sozinho por 3 fases cheias de monstros, com um
revólver em cada mão, atirando e recarregando; cada fase termina num chefe. Também joga no PC
com o mouse (um revólver). Tudo em português. Nome próprio, sem usar a marca do jogo original;
monstros estilizados, sem sangue realista.

## Como rodar / jogar

**No Quest:** abrir **https://parappathe.github.io/NoiteMonstros/** (ou a página inicial
https://parappathe.github.io/) e apertar "Entrar em VR". Para atualizar o site: commitar e rodar
`python publicar.py NoiteMonstros` na pasta `C:\claude code`.

**No PC:** `python serve.py` nesta pasta e abrir `http://localhost:8769` (`.claude/launch.json`).
Use o `serve.py` (sem cache), não o `python -m http.server`.

### Controles

| | VR (Quest) | PC |
|---|---|---|
| Atirar | Gatilho de cada mão (cada uma tem seu revólver) | Clique esquerdo (mira onde está o mouse) |
| Recarregar | Apontar a arma para o chão, ou o botão de agarrar (grip) | Botão direito ou R |
| Pausa | B ou Y | Esc ou P |
| Menu | Apontar com o controle e gatilho | Clique |
| FPS | Opções → Mostrar FPS | Tecla F |

As balas de cada arma aparecem no tambor do revólver e no HUD. Arma vazia faz clique e o HUD
pisca "RECARREGUE!". Ao entrar no VR o jogador é posicionado sozinho; "Recentralizar" está na pausa.

### Regras

- 6 balas por arma, recarga de 0,75 s. Tiro na cabeça mata zumbi na hora e vale 1,5× os pontos.
- 5 vidas (até 7 com as que caem de caixas, vasos, lustres e barris quebrados a tiro). Monstro
  que chega ataca e tira 1 vida; atirar nele durante o ataque interrompe. A gosma do cuspidor
  pode ser destruída no ar.
- Perdeu todas: "Continuar" recomeça a fase com vidas cheias.
- Fim de fase: bônus de precisão (até 2000) + 300 por vida. Fases liberam em sequência; recorde
  por fase e da noite inteira (3 fases seguidas) ficam salvos (localStorage `noitemonstros.v1`).
- Monstros: zumbi, corredor, morcego, cuspidor. Chefes: o Coveiro (acerte a lanterna), a Aranha
  do Sótão (os olhos vermelhos) e a Criatura (o núcleo azul, só quando o peito abre). Acertar o
  ponto fraco várias vezes enquanto o chefe prepara o golpe cancela o golpe.
- Movimento no VR: "Andar" (padrão, devagar) ou "Teletransporte" (tela escurece e você aparece
  na próxima parada), nas Opções, para quem enjoar.

## Como testar

- `node tests/run.js` (ou `npm test`): raio acerta a esfera certa e o monstro da frente protege o
  de trás, cabeça x corpo, munição e tempo de recarga, monstro que chega tira vida, gosma pode ser
  destruída, as 3 fases terminam com um robô que mira bem (andando e no teletransporte), chefes
  aparecem e morrem, quem não atira perde, e quem mira mal perde vidas. Tem que dar "Tudo certo".
- No navegador (console): `ppvr.startStage(0); ppvr.dev.autoplay = true; ppvr.dev.advance(60)`
  joga 60 s na hora com a arma do mouse mirando sozinha. `advance` existe porque o painel de
  visualização escondido não anima a página.
- **Só dá para testar no óculos:** mira das armas na mão, recarregar apontando para baixo, enjoo
  com o andar automático (e o teletransporte), vibração, FPS.

## Estrutura

| Arquivo | O que tem |
|---|---|
| `index.html`, `css/style.css` | Página, botão "Entrar em VR", mira do PC |
| `js/levels.js` | As 3 fases: caminho, paradas com ondas de monstros (ângulo/distância relativos à parada), quebráveis e chefe. Sem navegador |
| `js/monsters.js` | Tipos de monstro e chefes: vida, velocidade, partes atingíveis (esferas), ataques. Sem navegador |
| `js/game.js` | `RailGame`: trilho, encontros, comportamento dos monstros e chefes, tiro (raio x esferas), munição, vidas, pontos, `autoTarget` para o robô. Sem navegador |
| `js/main.js` | Render, 2 revólveres no VR, mouse no PC, menus, HUD, sons, laço principal |
| `js/scene.js` | Cenários (cemitério, mansão, laboratório), modelos dos monstros e chefes, revólver, faíscas e rastro de bala |
| `js/ui.js` | Painel de menu 3D (mesmo dos outros jogos, cores de terror) |
| `js/audio.js` | Sons e música ambiente sintetizados |
| `js/save.js` | Fases liberadas, recordes e opções |
| `serve.py` | Servidor local sem cache |
| `tests/run.js` | Testes automáticos |
| `vendor/three/three.module.js` | Three.js r170 (cópia local) |

Coordenadas: metros, Y para cima; `yaw` 0 = olhando para -Z. O `rig` segue o trilho; dentro dele
o `playSpace` guarda o ajuste de recentralizar do VR.

## Regras e convenções do projeto

- `levels.js`, `monsters.js` e `game.js` não usam navegador nem Three.js (testes no Node).
- Fase nova ou mudança de ondas/monstros/chefes: rodar `node tests/run.js` (o robô tem que
  terminar todas as fases).
- Modelos em `scene.js` são montados olhando para -Z; as partes atingíveis em `monsters.js`
  usam z positivo = para a frente (para o jogador). Mexeu num, confira o outro.

## Decisões

- Mesma base dos outros jogos (WebXR no navegador, GitHub Pages).
- Tiro instantâneo (raio) contra esferas; paredes não bloqueiam tiro.
- Recarga no VR apontando para baixo (equivalente ao "atirar fora da tela" do fliperama) e também
  pelo grip.
- Andar devagar (1,8 m/s) com curva suave como padrão; teletransporte opcional para conforto.
- Cada fase recomeça com 5 vidas; "Continuar" no game over recomeça só a fase.

## Pendências / problemas conhecidos

- Nada testado no Quest ainda: posição do revólver na mão (preso ao raio de mira do controle),
  recarga apontando para baixo, enjoo, FPS com muitos monstros.
- Com um robô de mira perfeita cada fase dura ~1 minuto; com gente deve passar de 3. Se ficar
  curto, acrescentar ondas em `levels.js`.
- Monstros atravessam paredes (não há colisão com o cenário); as paradas foram feitas em áreas
  abertas para disfarçar.
