// Starts the Phaser game, builds the shared services, and installs the e2e hook (only when
// the URL has ?e2e=1 and the build is not a production build).
import Phaser from 'phaser';
import './styles/index.css';
import { WORLD } from './game/config';
import { PALETTE } from './scenes/palette';
import { SERVICES_KEY } from './scenes/registry';
import { SCENES } from './scenes';
import { createServices } from './scenes/services';
import { installTestHook, type ActiveScene, type TimeClashHook } from './scenes/testHook';

const { services, seeds, faults } = createServices({ doc: document, win: window });

const game = new Phaser.Game({
  // The e2e build draws on a 2D canvas: CI has no GPU, and software WebGL is far slower.
  type: import.meta.env.MODE === 'e2e' ? Phaser.CANVAS : Phaser.AUTO,
  // No console banner, and so no third-party address in the bundle's start-up path.
  banner: false,
  parent: 'game',
  width: WORLD.width,
  height: WORLD.height,
  backgroundColor: PALETTE.night,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  // All sound goes through our AudioManager, which waits for the first tap.
  // Phaser's own audio would open an audio context at boot.
  audio: { noAudio: true },
  scene: SCENES,
  callbacks: {
    preBoot: (g) => g.registry.set(SERVICES_KEY, services),
  },
});

// Left out of production builds entirely: Vite folds the MODE check and drops the hook code.
if (import.meta.env.MODE !== 'production') {
  installTestHook(window as unknown as { __timeclash?: TimeClashHook }, {
    search: window.location.search,
    mode: import.meta.env.MODE,
    seeds,
    faults,
    storage: services.storage,
    session: services.session,
    activeScenes: () => game.scene.getScenes(true) as unknown as ActiveScene[],
  });
}

export default game;
