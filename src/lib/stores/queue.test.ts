import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/api/endpoints', async (orig) => ({
  ...(await orig<typeof import('$lib/api/endpoints')>()),
  getQueuedEpisodes: vi.fn(),
  reorderQueue: vi.fn().mockResolvedValue({}),
  clearQueue: vi.fn().mockResolvedValue({})
}));

const E = await import('$lib/api/endpoints');
const { queue } = await import('./queue.svelte');
const { episodeStatus } = await import('./app.svelte');

const ep = (id: number, pos: number, dur = 600) => E.normEpisode({ episodeid: id, queueposition: pos, episodeduration: dur, queued: true });

beforeEach(async () => {
  vi.mocked(E.getQueuedEpisodes).mockResolvedValue([ep(3, 3), ep(1, 1), ep(2, 2)]);
  await queue.refresh();
});

describe('queue store', () => {
  it('sorts by queue position on refresh', () => {
    expect(queue.episodes.map((e) => e.episodeid)).toEqual([1, 2, 3]);
  });

  it('moves an episode and saves the new order', async () => {
    await queue.move(3, 1);
    expect(queue.episodes.map((e) => e.episodeid)).toEqual([3, 1, 2]);
    expect(vi.mocked(E.reorderQueue).mock.calls.at(-1)![0].map((e) => e.episodeid)).toEqual([3, 1, 2]);
  });

  it('refetches the server order if saving fails', async () => {
    vi.mocked(E.reorderQueue).mockRejectedValueOnce(new Error('nope'));
    await queue.move(1, 3);
    await new Promise((r) => setTimeout(r, 0));
    expect(queue.episodes.map((e) => e.episodeid)).toEqual([1, 2, 3]);
  });

  it('totals the queue length', () => {
    expect(queue.totalLabel).toBe('30m');
  });

  it('clear() empties it and un-queues the episodes', async () => {
    await queue.clear();
    expect(queue.episodes).toEqual([]);
    expect(episodeStatus.queued.has(1)).toBe(false);
  });
});
