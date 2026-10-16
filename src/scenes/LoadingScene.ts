import { FlowScene } from './FlowScene';
import { SCENE_KEYS } from './registry';
import { runLoadingStep } from './steps';

/** Receives LoadingData: where to go once the load is done. */
export class LoadingScene extends FlowScene {
  constructor() {
    super(SCENE_KEYS.loading);
  }

  create(data?: unknown): void {
    this.paintBackdrop();
    this.follow(() => runLoadingStep(this.services(), data));
  }
}
