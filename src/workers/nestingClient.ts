import {
  runGuillotineNesting,
  type NestingInput,
  type NestingResult,
} from './guillotineNesting';

/**
 * Execute nesting either in a Web Worker or directly if Worker is unavailable.
 */
export async function executeNesting(input: NestingInput): Promise<NestingResult> {
  if (typeof Worker === 'undefined') {
    return runGuillotineNesting(input);
  }

  return new Promise<NestingResult>((resolve, reject) => {
    try {
      const worker = new Worker(
        new URL('./nesting.worker.ts', import.meta.url),
        { type: 'module' },
      );

      worker.onmessage = (
        event: MessageEvent<{ success: boolean; result?: NestingResult; error?: string }>,
      ) => {
        worker.terminate();
        if (event.data.success && event.data.result) {
          resolve(event.data.result);
        } else {
          reject(new Error(event.data.error ?? 'Worker execution failed'));
        }
      };

      worker.onerror = (error) => {
        worker.terminate();
        reject(error);
      };

      worker.postMessage(input);
    } catch {
      // Fallback to direct calculation if worker creation fails
      resolve(runGuillotineNesting(input));
    }
  });
}
