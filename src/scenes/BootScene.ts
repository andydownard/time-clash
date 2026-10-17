import { bootApp } from './boot';
import { routeAtBoot } from './flow';
import { FlowScene } from './FlowScene';
import { SCENE_KEYS } from './registry';

export class BootScene extends FlowScene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    bootApp(this.services(), document, this.game.canvas);
    // A returning family goes straight to the Camp. A new family sees the Tap to Play front door.
    const route = routeAtBoot(this.services().storage);
    this.scene.start(route.key, route.data as object | undefined);
  }
}
