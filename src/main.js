// Safari < 16 lacks CanvasRenderingContext2D.roundRect (used by the procedural textures)
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(x, y, w, h) { this.rect(x, y, w, h); };
}
import { Game } from './game/Game.js';

const canvas = document.getElementById('game-canvas');
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
