import { bootApp } from './boot';
import { FlowScene } from './FlowScene';
import { SCENE_KEYS } from './registry';

export class BootScene extends FlowScene {
  constructor() {
    super(SCENE_KEYS.boot);
  }

  create(): void {
    bootApp(this.services(), document, this.game.canvas);
    this.scene.start(SCENE_KEYS.tap);
  }
}
