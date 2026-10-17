import { WORLD } from '../game/config';
import type { MatchController } from '../game/types';
import { sceneReducedMotion } from './battle/reducedMotion';
import { paintVictory, type VictoryArt } from './battle/victoryArt';
import { controllerFrom, victoryFrom } from './flow';
import { FlowScene } from './FlowScene';
import { SCENE_KEYS } from './registry';
import { runVictoryStep } from './steps';

/** Receives the finished MatchController (or { controller }) from BattleScene. */
export class VictoryScene extends FlowScene {
  /** Read by the e2e hook. */
  controller: MatchController | null = null;
  private art: VictoryArt | null = null;

  constructor() {
    super(SCENE_KEYS.victory);
  }

  create(data?: unknown): void {
    this.controller = controllerFrom(data);
    this.paintBackdrop();
    this.paintPodium(data);
    this.follow(() => runVictoryStep(this.services(), data));
  }

  /** The podium is decoration. If it cannot be drawn, the Rematch screen still works. */
  private paintPodium(data: unknown): void {
    try {
      const winner = victoryFrom(data)?.options.winner;
      if (!winner) return;
      this.art = paintVictory(this, winner, WORLD, sceneReducedMotion(this.registry, window));
      this.events.once('shutdown', () => {
        this.art?.destroy();
        this.art = null;
      });
    } catch {
      this.art = null;
    }
  }
}
