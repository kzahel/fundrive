import { Game } from './engine/Game';
import { CarSelect } from './ui/CarSelect';
import { TouchControls } from './ui/TouchControls';

const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ui = document.getElementById('ui-layer')!;

const game = new Game(canvas);
(window as any).__game = game;

// Touch controls
new TouchControls(ui, game.input);

function enterFullscreenLandscape() {
  const el = document.documentElement;
  const goFullscreen = el.requestFullscreen
    ? el.requestFullscreen()
    : (el as any).webkitRequestFullscreen
      ? (el as any).webkitRequestFullscreen()
      : Promise.resolve();

  Promise.resolve(goFullscreen).then(() => {
    if (screen.orientation && (screen.orientation as any).lock) {
      (screen.orientation as any).lock('landscape').catch(() => {});
    }
  }).catch(() => {});
}

function exitFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => {});
  }
}

// Car selection screen
const carSelect = new CarSelect(ui, (carKey) => {
  enterFullscreenLandscape();
  game.startGame(carKey);
});

// Wire up menu return
game.onMenu = () => {
  exitFullscreen();
  carSelect.show();
  // Clear the canvas so the car select is visible
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
};
