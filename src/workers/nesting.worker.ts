import { runGuillotineNesting, type NestingInput, type NestingResult } from './guillotineNesting';

/**
 * Web Worker for guillotine nesting calculations.
 */
self.onmessage = (event: MessageEvent<NestingInput>): void => {
  try {
    const result: NestingResult = runGuillotineNesting(event.data);
    self.postMessage({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Nesting failed';
    self.postMessage({ success: false, error: message });
  }
};
