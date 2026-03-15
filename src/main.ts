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
  // Request fullscreen + landscape on game start (requires user gesture)
  const el = document.documentElement;
  const goFullscreen = el.requestFullscreen
    ? el.requestFullscreen()
    : (el as any).webkitRequestFullscreen
      ? (el as any).webkitRequestFullscreen()
      : Promise.resolve();

  Promise.resolve(goFullscreen).then(() => {
    // Lock to landscape if supported (only works in fullscreen on mobile)
    if (screen.orientation && (screen.orientation as any).lock) {
      (screen.orientation as any).lock('landscape').catch(() => {});
    }
  }).catch(() => {});

  game.startGame(carKey);
});
