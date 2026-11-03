import { describe, expect, it } from 'vitest';

import { RequestTimeoutError, createFetchWithTimeout } from '@/lib/fetchWithTimeout';

/** Resolves after `ms` unless its signal aborts first — no real network involved. */
function slowFetch(ms: number): typeof fetch {
  return (_input, init) =>
    new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response('ok')), ms);
      init?.signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
}

describe('createFetchWithTimeout', () => {
  it('returns responses that finish in time', async () => {
    const response = await createFetchWithTimeout(slowFetch(5), 200)('http://local.test');
    expect(await response.text()).toBe('ok');
  });

  it('aborts slow requests with a timeout error', async () => {
    await expect(createFetchWithTimeout(slowFetch(500), 20)('http://local.test')).rejects.toBeInstanceOf(
      RequestTimeoutError,
    );
  });

  it('propagates caller cancellation as an abort, not a timeout', async () => {
    const controller = new AbortController();
    const pending = createFetchWithTimeout(slowFetch(500), 1000)('http://local.test', {
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });
});
