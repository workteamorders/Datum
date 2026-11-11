export type Motion = "full" | "reduced" | "off";

export interface FieldDebug {
  frames: number;
  x: number;
  y: number;
}

declare global {
  interface Window { __fx?: FieldDebug }
}

export class FrameGovernor {
  density = 0;
  stopped = false;
  private elapsed = 0;
  private frames = 0;

  sample(ms: number) {
    this.elapsed += ms;
    this.frames++;
    if (this.elapsed < 2000) return;
    const mean = this.elapsed / this.frames;
    this.elapsed = 0;
    this.frames = 0;
    if (mean > 1000 / 30 && this.density === 2) this.stopped = true;
    else if (mean > 20) this.density = Math.min(2, this.density + 1);
  }

  resetWindow() {
    this.elapsed = 0;
    this.frames = 0;
  }
}
