export class Camera {
  x = 0;
  y = 0;
  zoom = 1;
  private targetX = 0;
  private targetY = 0;
  private smoothing = 0.08;
  width: number;
  height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
  }

  follow(worldX: number, worldY: number) {
    // Position camera so the car is at left-center-ish
    this.targetX = worldX - this.width * 0.35;
    this.targetY = worldY - this.height * 0.5;
  }

  update(_dt: number) {
    this.x += (this.targetX - this.x) * this.smoothing;
    this.y += (this.targetY - this.y) * this.smoothing;
  }

  applyTransform(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x, -this.y);
  }

  restore(ctx: CanvasRenderingContext2D) {
    ctx.restore();
  }

  /** Convert screen coords to world coords */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: sx / this.zoom + this.x,
      y: sy / this.zoom + this.y,
    };
  }

  /** World-space visible bounds */
  get visibleBounds() {
    return {
      left: this.x,
      right: this.x + this.width / this.zoom,
      top: this.y,
      bottom: this.y + this.height / this.zoom,
    };
  }
}
