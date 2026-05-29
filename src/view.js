// Canvas + viewport. Owns the device-pixel-ratio scaling and letterboxing math.
// `view` holds the live transform values (mutated by resize); `cv`/`ctx` are the canvas handles.
import { VIEW_W, VIEW_H } from './config.js';

export const cv = document.getElementById('c');
export const ctx = cv.getContext('2d');

export const view = { scale: 1, offX: 0, offY: 0, dpr: 1 };

export function resize() {
  view.dpr = Math.min(window.devicePixelRatio || 1, 2);
  const ww = window.innerWidth, wh = window.innerHeight;
  view.scale = Math.min(ww / VIEW_W, wh / VIEW_H);
  const dw = Math.round(VIEW_W * view.scale), dh = Math.round(VIEW_H * view.scale);
  cv.style.width = dw + 'px'; cv.style.height = dh + 'px';
  cv.width = Math.round(dw * view.dpr); cv.height = Math.round(dh * view.dpr);
  view.offX = 0; view.offY = 0;
}

window.addEventListener('resize', resize);
