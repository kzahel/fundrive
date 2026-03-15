import { MAX_FUEL } from '../utils/constants';
import type { GameState } from '../gameplay/GameState';

export class HUD {
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
    ctx.fillText('GAME OVER', screenW / 2, screenH / 2 - 40);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(`Distance: ${state.distance}m`, screenW / 2, screenH / 2 + 10);
    ctx.fillText(`Coins: ${state.coins}`, screenW / 2, screenH / 2 + 40);
    ctx.fillText(`Score: ${state.score}`, screenW / 2, screenH / 2 + 70);

    ctx.font = '18px sans-serif';
    ctx.fillStyle = '#CCC';
    ctx.fillText('Press SPACE or tap to restart', screenW / 2, screenH / 2 + 110);

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
}
