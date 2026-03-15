import { MAX_FUEL } from '../utils/constants';
import type { GameState } from '../gameplay/GameState';

export class HUD {
  // Menu button hit area (screen coords)
  menuButtonRect = { x: 0, y: 0, w: 0, h: 0 };
  // Game over button hit areas
  restartButtonRect = { x: 0, y: 0, w: 0, h: 0 };
  menuButtonGameOverRect = { x: 0, y: 0, w: 0, h: 0 };

  draw(ctx: CanvasRenderingContext2D, state: GameState, screenW: number, _screenH: number) {
    ctx.save();

    // Distance
    ctx.fillStyle = '#FFF';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    const distText = `${state.distance}m`;
    ctx.strokeText(distText, 20, 35);
    ctx.fillText(distText, 20, 35);

    // Coins
    ctx.textAlign = 'right';
    const coinText = `${state.coins}`;
    ctx.strokeText(coinText, screenW - 20, 35);
    ctx.fillText(coinText, screenW - 20, 35);

    // Coin icon
    ctx.beginPath();
    ctx.arc(screenW - ctx.measureText(coinText).width - 35, 28, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();
    ctx.strokeStyle = '#DAA520';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Fuel bar
    const barW = 150;
    const barH = 18;
    const barX = 20;
    const barY = 50;
    const fuelPct = state.fuel / MAX_FUEL;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);

    const fuelColor = fuelPct > 0.3 ? '#00CC00' : fuelPct > 0.1 ? '#FFAA00' : '#FF0000';
    ctx.fillStyle = fuelColor;
    ctx.fillRect(barX + 2, barY + 2, (barW - 4) * fuelPct, barH - 4);

    ctx.strokeStyle = '#FFF';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, barH);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.engineOn ? 'FUEL' : 'ENGINE OFF', barX + barW / 2, barY + 13);

    // Score
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFF';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 2;
    const scoreText = `Score: ${state.score}`;
    ctx.strokeText(scoreText, 20, 90);
    ctx.fillText(scoreText, 20, 90);

    // Menu button (top-right area, below coins)
    const mbW = 60;
    const mbH = 28;
    const mbX = screenW - mbW - 10;
    const mbY = 48;
    this.menuButtonRect = { x: mbX, y: mbY, w: mbW, h: mbH };

    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    this.roundRect(ctx, mbX, mbY, mbW, mbH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    this.roundRect(ctx, mbX, mbY, mbW, mbH, 6);
    ctx.stroke();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('MENU', mbX + mbW / 2, mbY + mbH / 2);
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }

  drawPopups(ctx: CanvasRenderingContext2D, state: GameState) {
    for (const p of state.popups) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.time);
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = p.color;
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 3;
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  drawGameOver(ctx: CanvasRenderingContext2D, state: GameState, screenW: number, screenH: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, screenW, screenH);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 48px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GAME OVER', screenW / 2, screenH / 2 - 60);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`Distance: ${state.distance}m`, screenW / 2, screenH / 2 - 10);
    ctx.fillText(`Coins: ${state.coins}`, screenW / 2, screenH / 2 + 20);
    ctx.fillText(`Score: ${state.score}`, screenW / 2, screenH / 2 + 50);

    // Restart button
    const btnW = 160;
    const btnH = 44;
    const restartX = screenW / 2 - btnW - 10;
    const restartY = screenH / 2 + 75;
    this.restartButtonRect = { x: restartX, y: restartY, w: btnW, h: btnH };

    ctx.fillStyle = '#4CAF50';
    this.roundRect(ctx, restartX, restartY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = '#388E3C';
    ctx.lineWidth = 2;
    this.roundRect(ctx, restartX, restartY, btnW, btnH, 8);
    ctx.stroke();

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 18px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.fillText('PLAY AGAIN', restartX + btnW / 2, restartY + btnH / 2);

    // Menu button
    const menuX = screenW / 2 + 10;
    const menuY = restartY;
    this.menuButtonGameOverRect = { x: menuX, y: menuY, w: btnW, h: btnH };

    ctx.fillStyle = '#666';
    this.roundRect(ctx, menuX, menuY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    this.roundRect(ctx, menuX, menuY, btnW, btnH, 8);
    ctx.stroke();

    ctx.fillStyle = '#FFF';
    ctx.fillText('MENU', menuX + btnW / 2, menuY + btnH / 2);
    ctx.textBaseline = 'alphabetic';

    ctx.restore();
  }

  drawDead(ctx: CanvasRenderingContext2D, screenW: number, screenH: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,0,0,0.15)';
    ctx.fillRect(0, 0, screenW, screenH);

    ctx.fillStyle = '#FFF';
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 3;
    ctx.strokeText('CRASHED! Respawning...', screenW / 2, screenH / 2);
    ctx.fillText('CRASHED! Respawning...', screenW / 2, screenH / 2);
    ctx.restore();
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
