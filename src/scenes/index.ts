import type { Types } from 'phaser';
import { BattleScene } from './BattleScene';
import { BootScene } from './BootScene';
import { IntroScene } from './IntroScene';
import { LoadingScene } from './LoadingScene';
import { SetupScene } from './SetupScene';
import { TapToStartScene } from './TapToStartScene';
import { VictoryScene } from './VictoryScene';

/** Boot runs first. */
export const SCENES: Types.Scenes.SceneType[] = [
  BootScene,
  TapToStartScene,
  IntroScene,
  LoadingScene,
  SetupScene,
  BattleScene,
  VictoryScene,
];
