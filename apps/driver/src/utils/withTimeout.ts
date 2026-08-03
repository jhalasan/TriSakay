export function withTimeout<T>(promise: Promise<T>, ms: number, message = 'Request timed out'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export const REQUEST_TIMEOUT_MS = 10_000;
