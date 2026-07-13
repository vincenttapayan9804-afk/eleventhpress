/**
 * pdfjs-dist's legacy Node build references `DOMMatrix`/`Path2D` at module
 * top level (e.g. `const SCALE_MATRIX = new DOMMatrix();`) — unconditionally,
 * even when only extracting text with no canvas rendering involved. It tries
 * to polyfill these from the optional native `@napi-rs/canvas` package, but
 * that's a per-platform native binary that isn't reliably bundled into a
 * Vercel serverless function (confirmed: present locally as an incidental
 * transitive install, absent in the deployed bundle) — without it, pdfjs
 * throws `ReferenceError: DOMMatrix is not defined` at import time, crashing
 * every route that transitively imports it, not just PDF-manuscript ones.
 *
 * These stand-ins are only ever touched by pdfjs's canvas-rendering code
 * paths, which text extraction (getTextContent) never exercises — their
 * actual numeric behavior doesn't matter here, only that they exist so
 * module evaluation doesn't crash. Must be imported before pdfjs-dist
 * itself; side-effect imports execute in source order, so put this import
 * first in any file that imports pdfjs-dist.
 */
class DOMMatrixPolyfill {
  a = 1;
  b = 0;
  c = 0;
  d = 1;
  e = 0;
  f = 0;
  constructor(init?: number[] | string) {
    if (Array.isArray(init) && init.length >= 6) {
      [this.a, this.b, this.c, this.d, this.e, this.f] = init;
    }
  }
  multiply(): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill();
  }
  translate(): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill();
  }
  scale(): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill();
  }
  invertSelf(): this {
    return this;
  }
}

class Path2DPolyfill {
  constructor(_path?: unknown) {}
  moveTo() {}
  lineTo() {}
  closePath() {}
  rect() {}
  addPath() {}
}

if (typeof (globalThis as any).DOMMatrix === "undefined") {
  (globalThis as any).DOMMatrix = DOMMatrixPolyfill;
}
if (typeof (globalThis as any).Path2D === "undefined") {
  (globalThis as any).Path2D = Path2DPolyfill;
}

export {};
