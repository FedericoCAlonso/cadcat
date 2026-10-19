import { optimize } from './engine';
import type { OptimizerInput, Result } from './types';
import type { SearchProgress } from './search';

export type WorkerInMessage =
  | { type: 'START'; id: string; input: OptimizerInput }
  | { type: 'CANCEL'; id: string };

export type WorkerOutMessage =
  | { type: 'PROGRESS'; id: string; progress: SearchProgress }
  | { type: 'DONE'; id: string; result: Result }
  | { type: 'ERROR'; id: string; error: string };

let cancelledId: string | null = null;

self.onmessage = (event: MessageEvent<WorkerInMessage>): void => {
  const msg = event.data;

  if (msg.type === 'CANCEL') {
    cancelledId = msg.id;
    return;
  }

  if (msg.type === 'START') {
    const id = msg.id;
    cancelledId = null;

    try {
      const result = optimize(
        msg.input,
        () => cancelledId === id,
        (progress) => {
          self.postMessage({ type: 'PROGRESS', id, progress } as WorkerOutMessage);
        },
      );

      self.postMessage({ type: 'DONE', id, result } as WorkerOutMessage);
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Optimization failed';
      self.postMessage({ type: 'ERROR', id, error } as WorkerOutMessage);
    }
  }
};
