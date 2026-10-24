/** Tiny state holder so transitions are explicit and observable. */
export class GameState {
  constructor() { this.current = 'loading'; this.listeners = []; }
  set(s) { const prev = this.current; this.current = s; for (const l of this.listeners) l(s, prev); }
  is(s) { return this.current === s; }
  on(fn) { this.listeners.push(fn); }
}
