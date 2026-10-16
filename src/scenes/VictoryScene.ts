import type { MatchController } from '../game/types';
import { controllerFrom } from './flow';
import { FlowScene } from './FlowScene';
import { SCENE_KEYS } from './registry';
import { runVictoryStep } from './steps';

/** Receives the finished MatchController (or { controller }) from BattleScene. */
export class VictoryScene extends FlowScene {
  /** Read by the e2e hook. */
  controller: MatchController | null = null;

  constructor() {
    super(SCENE_KEYS.victory);
  }

  create(data?: unknown): void {
    this.controller = controllerFrom(data);
    this.paintBackdrop();
    this.follow(() => runVictoryStep(this.services(), data));
  }
}
