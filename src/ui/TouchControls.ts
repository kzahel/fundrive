import type { InputManager } from '../engine/InputManager';

export class TouchControls {
  private container: HTMLDivElement;

  constructor(parent: HTMLElement, inputManager: InputManager) {
    this.container = document.createElement('div');
    this.container.id = 'touch-controls';
    this.container.innerHTML = `
      <style>
        #touch-controls {
          position: absolute;
          bottom: 20px;
          left: 0;
          right: 0;
          display: none;
          justify-content: space-between;
          padding: 0 20px;
          pointer-events: none;
          z-index: 50;
        }
        @media (pointer: coarse) {
          #touch-controls { display: flex; }
        }
        .touch-btn {
          width: 70px;
          height: 70px;
          border-radius: 50%;
          background: rgba(255,255,255,0.4);
          border: 2px solid rgba(255,255,255,0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          user-select: none;
          -webkit-user-select: none;
          pointer-events: auto;
          touch-action: none;
        }
        .touch-btn:active {
          background: rgba(255,255,255,0.7);
        }
        .touch-btn.active {
          background: rgba(255,200,0,0.5);
          border-color: rgba(255,200,0,0.8);
        }
        .touch-group {
          display: flex;
          gap: 10px;
          align-items: flex-end;
        }
        .touch-btn-small {
          width: 50px;
          height: 50px;
          border-radius: 50%;
          background: rgba(255,255,255,0.3);
          border: 2px solid rgba(255,255,255,0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: bold;
          user-select: none;
          -webkit-user-select: none;
          pointer-events: auto;
          touch-action: none;
        }
      </style>
      <div class="touch-group">
        <div class="touch-btn" data-btn="brake">&larr;</div>
        <div class="touch-btn" data-btn="leanBack">&uarr;</div>
      </div>
      <div class="touch-group" style="flex-direction:column;align-items:center;gap:8px;">
        <div class="touch-btn" data-btn="boost" style="font-size:16px;font-weight:bold;">BOOST</div>
        <div class="touch-btn-small" id="tilt-toggle">TILT</div>
      </div>
      <div class="touch-group">
        <div class="touch-btn" data-btn="leanForward">&darr;</div>
        <div class="touch-btn" data-btn="gas">&rarr;</div>
      </div>
    `;

    const buttons = this.container.querySelectorAll('.touch-btn');
    buttons.forEach((btn) => {
      const name = (btn as HTMLElement).dataset.btn;
      if (!name) return;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        inputManager.setTouchButton(name, true);
      });
      btn.addEventListener('touchend', (e) => {
        e.preventDefault();
        inputManager.setTouchButton(name, false);
      });
      btn.addEventListener('touchcancel', () => {
        inputManager.setTouchButton(name, false);
      });
    });

    // Tilt toggle
    const tiltBtn = this.container.querySelector('#tilt-toggle')!;
    tiltBtn.addEventListener('click', () => {
      if (inputManager.tiltEnabled) {
        inputManager.tiltEnabled = false;
        tiltBtn.classList.remove('active');
      } else {
        inputManager.enableTilt();
        tiltBtn.classList.add('active');
      }
    });

    parent.appendChild(this.container);
  }
}
