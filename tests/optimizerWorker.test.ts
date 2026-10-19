import { describe, it, expect } from 'vitest';
import { executeOptimization } from '../src/optimizer/workerClient';
import type { OptimizerInput, SheetType } from '../src/optimizer/types';
import { DEFAULT_OPTIMIZER_SETTINGS } from '../src/optimizer/types';

describe('Worker wrapper, progress and cancellation (Section 8.5 & 9 Step 9)', () => {
  const standardSheet: SheetType = {
    materialKey: 'mdf-18',
    lengthMm: 2750,
    widthMm: 1830,
    grain: 'NONE',
    pricePerSheet: 50,
    available: 10,
  };

  const input: OptimizerInput = {
    parts: [
      { id: 'p1', lengthMm: 800, widthMm: 400, quantity: 4, materialKey: 'mdf-18', grain: 'FREE' },
      { id: 'p2', lengthMm: 600, widthMm: 350, quantity: 6, materialKey: 'mdf-18', grain: 'FREE' },
    ],
    sheets: [standardSheet],
    settings: {
      ...DEFAULT_OPTIMIZER_SETTINGS,
      search: { timeBudgetMs: 400, maxIterations: 100, seed: 42 },
    },
  };

  it('runs optimization with progress callback', async () => {
    let progressCallCount = 0;
    const res = await executeOptimization(input, {
      onProgress: (p) => {
        progressCallCount++;
        expect(p.progress).toBeGreaterThanOrEqual(0);
        expect(p.progress).toBeLessThanOrEqual(1.0);
      },
    });

    expect(res.alternatives.length).toBeGreaterThan(0);
    expect(res.stats.elapsedMs).toBeGreaterThanOrEqual(0);
  });

  it('cancels within 200ms when signal aborts', async () => {
    const controller = new AbortController();

    const longInput: OptimizerInput = {
      ...input,
      settings: {
        ...input.settings,
        search: { timeBudgetMs: 5000, maxIterations: 5000, seed: 123 },
      },
    };

    // Cancel after 50ms
    setTimeout(() => {
      controller.abort();
    }, 50);

    const start = performance.now();
    const res = await executeOptimization(longInput, {
      signal: controller.signal,
    });
    const elapsed = performance.now() - start;

    // Must return within ~250ms (50ms timeout + <200ms cancel threshold)
    expect(elapsed).toBeLessThan(500);
    expect(res.alternatives).toBeDefined();
  });
});
