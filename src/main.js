// Safari < 16 lacks CanvasRenderingContext2D.roundRect (used by the procedural textures)
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h) { this.rect(x, y, w, h); };
}
import { Game } from './game/Game.js';

const canvas = document.getElementById('game-canvas');

// Surface unexpected runtime errors on screen (there is no console on a phone)
let shownErrors = 0;
function showRuntimeError(msg) {
  if (shownErrors++ > 2) return;
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:999;max-width:70vw;background:rgba(80,0,0,0.85);color:#fff;font:12px monospace;padding:6px 8px;border-radius:4px;pointer-events:none';
  el.textContent = `Error: ${msg}`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 8000);
}
window.addEventListener('error', (e) => showRuntimeError(e.message || String(e.error)));
window.addEventListener('unhandledrejection', (e) => { const r = e.reason; if (r && r.name === 'WrongDocumentError') return; showRuntimeError(r && r.message ? r.message : String(r)); });
const loading = document.getElementById('loading');

function fail(err) {
  console.error(err);
  loading.innerHTML = `<div class="loading-text" style="animation:none;color:#c66">FAILED TO START<br><small style="font-family:Rajdhani;letter-spacing:1px">${String(err && err.message || err)}</small></div>`;
}

try {
  const game = new Game(canvas);
  window.__nightfall = game; // handy for debugging in the console
  // let the loading screen paint before the heavy world generation
  setTimeout(async () => {
    try {
      await game.build();
      loading.classList.add('hidden');
      // ?debug&manual: no animation loop; drive frames with window.__nightfall.step(n)
      if (new URLSearchParams(window.location.search).has('manual')) {
        game.step = (n = 1, dt = 1 / 30) => { for (let i = 0; i < n; i++) game.update(dt); game.render(); };
        game.render();
      } else game.loop();
    } catch (e) { fail(e); }
  }, 60);
} catch (e) { fail(e); }
