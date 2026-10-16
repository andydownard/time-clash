// Base class for the thin scenes. A scene paints a backdrop, runs one step from steps.ts,
// then follows the route that step returns. All the thinking is in flow.ts and steps.ts.
import Phaser from 'phaser';
import { WORLD } from '../game/config';
import { drawBackdrop } from './backdrop';
import { PALETTE } from './palette';
import {
  SCENE_KEYS,
  servicesOf,
  type AppServices,
  type SceneKey,
  type SceneRoute,
} from './registry';

export abstract class FlowScene extends Phaser.Scene {
  readonly sceneKey: SceneKey;

  protected constructor(key: SceneKey) {
    super(key);
    this.sceneKey = key;
  }

  protected services(): AppServices {
    return servicesOf(this.registry);
  }

  protected paintBackdrop(): void {
    this.cameras.main.setBackgroundColor(PALETTE.night);
    drawBackdrop(this.add.graphics(), WORLD);
  }

  /**
   * Runs a step and goes to the route it returns. If the scene shuts down first, it does
   * nothing. If the step fails, go back to the tap screen so the game never freezes.
   */
  protected follow(run: () => Promise<SceneRoute>): void {
    let alive = true;
    this.events.once('shutdown', () => {
      alive = false;
    });
    run().then(
      (route) => {
        if (alive) this.scene.start(route.key, route.data as object | undefined);
      },
      () => {
        if (alive && this.sceneKey !== SCENE_KEYS.tap) this.scene.start(SCENE_KEYS.tap);
      },
    );
  }
}
