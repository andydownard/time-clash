import { FlowScene } from './FlowScene';
import { SCENE_KEYS } from './registry';
import { runSetupStep } from './steps';

export class SetupScene extends FlowScene {
  constructor() {
    super(SCENE_KEYS.setup);
  }

  create(): void {
    this.paintBackdrop();
    this.follow(() => runSetupStep(this.services()));
  }
}
