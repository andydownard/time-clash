import { FlowScene } from './FlowScene';
import { SCENE_KEYS } from './registry';
import { runIntroStep } from './steps';

export class IntroScene extends FlowScene {
  constructor() {
    super(SCENE_KEYS.intro);
  }

  create(): void {
    this.paintBackdrop();
    this.follow(() => runIntroStep(this.services()));
  }
}
