import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cssPath = resolve(__dirname, '../../index.css');
const css = readFileSync(cssPath, 'utf-8');

describe('Print CSS — @page and page dimensions', () => {
  it('@page uses Letter portrait', () => {
    expect(css).toMatch(/@page\s*\{[^}]*size:\s*Letter\s+portrait/s);
  });

  it('print margins are 0.55in 0.6in 0.75in', () => {
    expect(css).toMatch(/@page\s*\{[^}]*margin:\s*0\.55in\s+0\.6in\s+0\.75in/s);
  });

  it('print-area has natural height (height: auto, min-height: 0)', () => {
    expect(css).toMatch(/\.print-area\s*\{[^}]*height:\s*auto/s);
    expect(css).toMatch(/\.print-area\s*\{[^}]*min-height:\s*0/s);
  });

  it('no square aspect-ratio rule applies in print mode', () => {
    expect(css).not.toMatch(/aspect-ratio\s*:\s*1\b/);
    expect(css).not.toMatch(/aspect-ratio\s*:\s*square/);
  });

  it('no fixed pixel page sizes in print-area', () => {
    expect(css).not.toMatch(/\.print-area\s*\{[^}]*width:\s*\d+px/);
    expect(css).not.toMatch(/\.print-area\s*\{[^}]*height:\s*\d{3,}px/);
  });

  it('no viewport-based width/height in print-area', () => {
    expect(css).not.toMatch(/\.print-area\s*\{[^}]*width:\s*\d+vw/);
    expect(css).not.toMatch(/\.print-area\s*\{[^}]*height:\s*\d+vh/);
  });
});

describe('Print CSS — page-break rules', () => {
  it('defines print-break-avoid class', () => {
    expect(css).toMatch(/\.print-break-avoid\s*\{[^}]*break-inside:\s*avoid/s);
    expect(css).toMatch(/\.print-break-avoid\s*\{[^}]*page-break-inside:\s*avoid/s);
  });

  it('defines print-break-after-avoid class', () => {
    expect(css).toMatch(/\.print-break-after-avoid\s*\{[^}]*break-after:\s*avoid/s);
    expect(css).toMatch(/\.print-break-after-avoid\s*\{[^}]*page-break-after:\s*avoid/s);
  });
});

describe('Print CSS — hiding web-only controls', () => {
  it('defines print:hidden utility', () => {
    expect(css).toMatch(/\.print\\:hidden\s*\{[^}]*display:\s*none/s);
  });

  it('card chrome (border, shadow, radius) is removed in print', () => {
    expect(css).toMatch(/box-shadow:\s*none/);
    expect(css).toMatch(/border-radius:\s*0/);
  });

  it('print-graph-container has navy background and fits page width', () => {
    expect(css).toMatch(/\.print-graph-container/);
    expect(css).toMatch(/width:\s*100%/);
    expect(css).toMatch(/background-color:\s*#031c40/);
  });

  it('print-graph-container has break-inside avoid', () => {
    expect(css).toMatch(/\.print-graph-container[\s\S]*break-inside:\s*avoid/);
  });

  it('print-color-adjust is enabled for grayscale-safe printing', () => {
    expect(css).toMatch(/print-color-adjust:\s*exact/);
  });
});

describe('Print CSS — footer', () => {
  it('defines a print footer with fixed positioning at the bottom', () => {
    expect(css).toMatch(/\.print-footer\s*\{[^}]*position:\s*fixed/s);
    expect(css).toMatch(/\.print-footer\s*\{[^}]*bottom:\s*0/s);
  });

  it('footer is centered', () => {
    expect(css).toMatch(/\.print-footer\s*\{[^}]*text-align:\s*center/s);
  });

  it('footer reserves bottom margin so content does not overlap', () => {
    expect(css).toMatch(/\.print-area\s*\{[^}]*padding-bottom:\s*0\.5in/s);
  });

  it('footer image preserves proportions (height set, width auto)', () => {
    expect(css).toMatch(/\.print-footer img\s*\{[^}]*height:\s*20px/s);
    expect(css).toMatch(/\.print-footer img\s*\{[^}]*width:\s*auto/s);
  });
});

describe('Print CSS — border removal', () => {
  it('removes borders from sections in print', () => {
    expect(css).toMatch(/\.print-area section[^}]*border:\s*none/);
  });

  it('keeps left accent borders for strengths (green) and opportunities (orange)', () => {
    expect(css).toMatch(/\.border-l-green[^}]*border-left-width:\s*3px/);
    expect(css).toMatch(/\.border-l-orange[^}]*border-left-width:\s*3px/);
  });
});
