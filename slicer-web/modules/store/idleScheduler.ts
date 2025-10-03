export type IdleScheduledWork = () => void | Promise<void>;

export interface ScheduleOptions {
  immediate?: boolean;
}

export interface IdleScheduler {
  schedule(work: IdleScheduledWork, options?: ScheduleOptions): Promise<void>;
  flush(): void;
  cancel(): void;
}

const globalObject = typeof globalThis !== 'undefined' ? (globalThis as typeof globalThis & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
}) : undefined;

const requestIdle: (work: () => void) => number | ReturnType<typeof setTimeout> =
  globalObject && typeof globalObject.requestIdleCallback === 'function'
    ? (work) => globalObject.requestIdleCallback(() => work())
    : (work) => setTimeout(work, 16);

const cancelIdle = (handle: number | ReturnType<typeof setTimeout>) => {
  if (globalObject && typeof globalObject.cancelIdleCallback === 'function' && typeof handle === 'number') {
    globalObject.cancelIdleCallback(handle);
    return;
  }

  clearTimeout(handle as ReturnType<typeof setTimeout>);
};

export function createIdleScheduler(): IdleScheduler {
  let handle: number | ReturnType<typeof setTimeout> | null = null;
  let pendingWork: IdleScheduledWork | null = null;
  let resolvePending: (() => void) | null = null;
  let rejectPending: ((error: unknown) => void) | null = null;

  const runWork = () => {
    const work = pendingWork;
    const resolve = resolvePending;
    const reject = rejectPending;

    pendingWork = null;
    resolvePending = null;
    rejectPending = null;

    if (!work) {
      resolve?.();
      return;
    }

    try {
      Promise.resolve(work()).then(
        () => {
          resolve?.();
        },
        (error) => {
          reject?.(error);
        }
      );
    } catch (error) {
      reject?.(error);
    }
  };

  const schedule = (work: IdleScheduledWork, options: ScheduleOptions = {}): Promise<void> => {
    if (handle !== null) {
      cancelIdle(handle);
      handle = null;
    }

    if (resolvePending) {
      resolvePending();
      resolvePending = null;
    }
    rejectPending = null;

    pendingWork = work;

    if (options.immediate) {
      return new Promise<void>((resolve, reject) => {
        resolvePending = resolve;
        rejectPending = reject;
        runWork();
      });
    }

    return new Promise<void>((resolve, reject) => {
      resolvePending = resolve;
      rejectPending = reject;
      handle = requestIdle(() => {
        handle = null;
        runWork();
      });
    });
  };

  const flush = () => {
    if (handle !== null) {
      cancelIdle(handle);
      handle = null;
    }

    if (pendingWork) {
      runWork();
    }
  };

  const cancel = () => {
    if (handle !== null) {
      cancelIdle(handle);
      handle = null;
    }

    pendingWork = null;

    if (resolvePending) {
      resolvePending();
      resolvePending = null;
    }

    rejectPending = null;
  };

  return {
    schedule,
    flush,
    cancel
  };
}
