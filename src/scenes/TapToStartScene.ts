import { FlowScene } from './FlowScene';
import { SCENE_KEYS } from './registry';
import { runTapStep } from './steps';

/** Sound stays off until the player taps. The DOM screen unlocks audio inside the tap. */
export class TapToStartScene extends FlowScene {
  constructor() {
    super(SCENE_KEYS.tap);
  }

  create(): void {
    this.paintBackdrop();
    this.follow(() => runTapStep(this.services()));
  }
}
