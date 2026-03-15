import { CAR_DEFS, type CarDef } from '../entities/CarDefinitions';

export type CarSelectCallback = (carKey: string) => void;

export class CarSelect {
  private container: HTMLDivElement;
  private callback: CarSelectCallback;
  visible = true;

  constructor(parent: HTMLElement, callback: CarSelectCallback) {
    this.callback = callback;

    this.container = document.createElement('div');
    this.container.id = 'car-select';
    this.container.innerHTML = `
      <style>
        #car-select {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, #87CEEB 0%, #E0F0FF 100%);
          z-index: 100;
          font-family: sans-serif;
        }
        #car-select.hidden { display: none; }
        #car-select h1 {
          font-size: 48px;
          color: #333;
          margin-bottom: 10px;
          text-shadow: 2px 2px 0 #FFF;
        }
        #car-select .subtitle {
          font-size: 18px;
          color: #666;
          margin-bottom: 30px;
        }
        .car-grid {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
          justify-content: center;
          max-width: 800px;
        }
        .car-card {
          background: white;
          border-radius: 12px;
          padding: 20px;
          width: 160px;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          border: 3px solid transparent;
          text-align: center;
        }
        .car-card:hover {
          transform: scale(1.05);
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          border-color: #FFD700;
        }
        .car-card .car-preview {
          width: 100px;
          height: 60px;
          margin: 0 auto 10px;
          border-radius: 8px;
        }
        .car-card h3 { margin: 0 0 5px; font-size: 16px; }
        .car-card .drive-type {
          font-size: 12px;
          color: #888;
          text-transform: uppercase;
          font-weight: bold;
        }
        .car-card p {
          font-size: 12px;
          color: #666;
          margin: 8px 0 0;
        }
      </style>
      <h1>FunDrive</h1>
      <div class="subtitle">Choose your ride!</div>
      <div class="car-grid"></div>
    `;

    const grid = this.container.querySelector('.car-grid')!;
    for (const [key, def] of Object.entries(CAR_DEFS)) {
      const card = document.createElement('div');
      card.className = 'car-card';
      card.innerHTML = `
        <div class="car-preview" style="background: ${def.color}; display:flex;align-items:center;justify-content:center;">
          <span style="font-size:30px;">&#128663;</span>
        </div>
        <h3>${def.name}</h3>
        <div class="drive-type">${def.driveType.toUpperCase()}</div>
        <p>${def.description}</p>
      `;
      card.addEventListener('click', () => {
        this.hide();
        this.callback(key);
      });
      grid.appendChild(card);
    }

    parent.appendChild(this.container);
  }

  hide() {
    this.visible = false;
    this.container.classList.add('hidden');
  }

  show() {
    this.visible = true;
    this.container.classList.remove('hidden');
  }
}
