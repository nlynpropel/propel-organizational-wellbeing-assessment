import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const cssPath = resolve(__dirname, '../../index.css');
const css = readFileSync(cssPath, 'utf-8');

describe('Print CSS — @page and page dimensions', () => {
  it('@page uses Letter portrait', () => {
    expect(css).toMatch(/@page\s*\{[^}]*size:\s*Letter\s+portrait/s);
  });

  it('print margins are defined (0.6in)', () => {
    expect(css).toMatch(/@page\s*\{[^}]*margin:\s*0\.6in/s);
  });

  it('print-area has natural height (height: auto, min-height: 0)', () => {
    expect(css).toMatch(/\.print-area\s*\{[^}]*height:\s*auto/s);
    expect(css).toMatch(/\.print-area\s*\{[^}]*min-height:\s*0/s);
  });

  it('no square aspect-ratio rule applies in print mode', () => {
    const printBlock = css.match(/@media print\s*\{([\s\S]*?)^\}/m)?.[1] ?? '';
    expect(printBlock).not.toMatch(/aspect-ratio\s*:\s*1\b/);
    expect(printBlock).not.toMatch(/aspect-ratio\s*:\s*square/);
  });

  it('no fixed pixel page sizes in print', () => {
    const printBlock = css.match(/@media print\s*\{([\s\S]*?)^\}/m)?.[1] ?? '';
    expect(printBlock).not.toMatch(/width:\s*\d+px/);
    expect(printBlock).not.toMatch(/height:\s*\d+px/);
  });

  it('no viewport-based width/height in print', () => {
    const printBlock = css.match(/@media print\s*\{([\s\S]*?)^\}/m)?.[1] ?? '';
    expect(printBlock).not.toMatch(/width:\s*\d+vw/);
    expect(printBlock).not.toMatch(/height:\s*\d+vh/);
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
    const printBlock = css.match(/@media print\s*\{([\s\S]*?)^\}/m)?.[1] ?? '';
    expect(printBlock).toMatch(/box-shadow:\s*none/);
    expect(printBlock).toMatch(/border-radius:\s*0/);
  });

  it('print-graph-container has navy background and fits page width', () => {
    const printBlock = css.match(/@media print\s*\{([\s\S]*?)^\}/m)?.[1] ?? '';
    expect(printBlock).toMatch(/\.print-graph-container/);
    expect(printBlock).toMatch(/width:\s*100%/);
    expect(printBlock).toMatch(/background-color:\s*#031c40/);
  });

  it('print-graph-container has break-inside avoid', () => {
    const printBlock = css.match(/@media print\s*\{([\s\S]*?)^\}/m)?.[1] ?? '';
    expect(printBlock).toMatch(/\.print-graph-container[\s\S]*break-inside:\s*avoid/);
  });

  it('print-color-adjust is enabled for grayscale-safe printing', () => {
    const printBlock = css.match(/@media print\s*\{([\s\S]*?)^\}/m)?.[1] ?? '';
    expect(printBlock).toMatch(/print-color-adjust:\s*exact/);
  });
});
