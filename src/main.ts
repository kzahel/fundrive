import { Game } from './engine/Game';
import { CarSelect } from './ui/CarSelect';
import { TouchControls } from './ui/TouchControls';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ui = document.getElementById('ui-layer')!;

const game = new Game(canvas);
(window as any).__game = game;

// Touch controls
new TouchControls(ui, game.input);

// Car selection screen
new CarSelect(ui, (carKey) => {
  game.startGame(carKey);
});
