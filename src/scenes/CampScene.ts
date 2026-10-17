import { FlowScene } from './FlowScene';
import { SCENE_KEYS } from './registry';
import { runCampStep } from './steps';

export class CampScene extends FlowScene {
  constructor() {
    super(SCENE_KEYS.camp);
  }

  create(): void {
    this.paintBackdrop();
    this.follow(() => runCampStep(this.services()));
  }
}
