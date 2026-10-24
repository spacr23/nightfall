/**
 * Keyboard + mouse input with Pointer Lock.
 * Game logic reads `keys`, `mouseDelta`, and one-shot `pressed` events each frame.
 */
export class InputManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressedThisFrame = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseButtons = new Set();
    this.mousePressedThisFrame = new Set();
    this.wheelDelta = 0;
    this.locked = false;
    this.enabled = false;
    this.onLockChange = null;
    this.onEscape = null;
    this._wantLock = false;
    // ?debug: treat the page as pointer-locked (for automated testing without a real mouse lock)
    this.debug = new URLSearchParams(window.location.search).has('debug');

    document.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const code = e.code;
      this.keys.add(code);
      this.pressedThisFrame.add(code);
      if (this.enabled && ['Space', 'Tab', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(code)) e.preventDefault();
      if (code === 'Escape' && this.onEscape) this.onEscape();
    });
    document.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseButtons.clear(); });

    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX || 0;
      this.mouseDY += e.movementY || 0;
    });
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      this.mouseButtons.add(e.button);
      this.mousePressedThisFrame.add(e.button);
      e.preventDefault();
    });
    document.addEventListener('mouseup', (e) => this.mouseButtons.delete(e.button));
    document.addEventListener('contextmenu', (e) => { if (this.locked) e.preventDefault(); });
    document.addEventListener('wheel', (e) => { if (this.locked) this.wheelDelta += Math.sign(e.deltaY); }, { passive: true });

    document.addEventListener('pointerlockchange', () => {
      if (this.debug) return;
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) { this.keys.clear(); this.mouseButtons.clear(); }
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      if (this.debug) return;
      this.locked = false;
      if (this.onLockChange) this.onLockChange(false);
    });
  }

  async requestLock() {
    if (this.debug) { this.locked = true; return true; }
    if (this.locked) return true;
    try {
      const p = this.canvas.requestPointerLock({ unadjustedMovement: true });
      if (p && p.catch) await p.catch(() => this.canvas.requestPointerLock());
      return true;
    } catch (e) {
      try { this.canvas.requestPointerLock(); } catch (e2) { /* ignore */ }
      return false;
    }
  }

  releaseLock() {
    if (this.debug) { this.locked = false; return; }
    if (document.pointerLockElement) document.exitPointerLock();
  }

  isDown(code) { return this.keys.has(code); }
  wasPressed(code) { return this.pressedThisFrame.has(code); }
  mouseDown(btn) { return this.mouseButtons.has(btn); }
  mousePressed(btn) { return this.mousePressedThisFrame.has(btn); }

  /** Consume mouse delta for this frame. */
  consumeMouse() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0; this.mouseDY = 0;
    return d;
  }

  consumeWheel() { const w = this.wheelDelta; this.wheelDelta = 0; return w; }

  endFrame() {
    this.pressedThisFrame.clear();
    this.mousePressedThisFrame.clear();
    this.mouseDX = 0; this.mouseDY = 0;
    this.wheelDelta = 0;
  }
}
