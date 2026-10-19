import type { OptimizerInput, Result } from './types';
import type { SearchProgress } from './search';
import { optimize } from './engine';
import type { WorkerInMessage, WorkerOutMessage } from './optimizer.worker';

export interface ExecuteOptimizationOptions {
  onProgress?: (progress: SearchProgress) => void;
  signal?: AbortSignal;
}

/**
 * Executes cutting optimization either in a Web Worker (browser) or directly (Node / fallback).
 * Supports real-time progress callbacks and cooperative cancellation.
 */
export async function executeOptimization(
  input: OptimizerInput,
  options?: ExecuteOptimizationOptions,
): Promise<Result> {
  // If in Node or environments without Worker support, fallback to direct execution
  if (typeof Worker === 'undefined') {
    return new Promise<Result>((resolve) => {
      const isCancelled = () => Boolean(options?.signal?.aborted);
      const res = optimize(input, isCancelled, options?.onProgress);
      resolve(res);
    });
  }

  return new Promise<Result>((resolve, reject) => {
    let worker: Worker | null = null;
    const taskId = `opt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    try {
      worker = new Worker(new URL('./optimizer.worker.ts', import.meta.url), {
        type: 'module',
      });

      if (options?.signal) {
        options.signal.addEventListener('abort', () => {
          if (worker) {
            worker.postMessage({ type: 'CANCEL', id: taskId } as WorkerInMessage);
            // Fallback hard terminate after 200ms if cooperative cancel doesn't stop it
            setTimeout(() => {
              if (worker) {
                worker.terminate();
                worker = null;
              }
            }, 200);
          }
        });
      }

      worker.onmessage = (event: MessageEvent<WorkerOutMessage>) => {
        const msg = event.data;
        if (msg.id !== taskId) return;

        if (msg.type === 'PROGRESS') {
          options?.onProgress?.(msg.progress);
        } else if (msg.type === 'DONE') {
          if (worker) {
            worker.terminate();
            worker = null;
          }
          resolve(msg.result);
        } else if (msg.type === 'ERROR') {
          if (worker) {
            worker.terminate();
            worker = null;
          }
          reject(new Error(msg.error));
        }
      };

      worker.onerror = (err) => {
        if (worker) {
          worker.terminate();
          worker = null;
        }
        reject(err);
      };

      worker.postMessage({ type: 'START', id: taskId, input } as WorkerInMessage);
    } catch {
      // Fallback to direct execution if worker initialization fails
      if (worker) {
        worker.terminate();
        worker = null;
      }
      const isCancelled = () => Boolean(options?.signal?.aborted);
      resolve(optimize(input, isCancelled, options?.onProgress));
    }
  });
}
