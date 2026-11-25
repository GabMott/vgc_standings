import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyTournament } from '../src/core/schema.js';
import { MemoryTournamentStore, LocalStorageTournamentStore } from '../src/adapters/storage.js';

function createMockStorage({ throwOnSet = false } = {}) {
  const map = new Map();
  return {
    get length() { return map.size; },
    key(i) { return [...map.keys()][i] ?? null; },
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) {
      if (throwOnSet) throw new Error('QuotaExceededError');
      map.set(k, String(v));
    },
    removeItem(k) { map.delete(k); },
    clear() { map.clear(); },
  };
}

describe('MemoryTournamentStore', () => {
  it('saves, retrieves, lists, deletes, and clears tournaments with cloning', async () => {
    const store = new MemoryTournamentStore();
    const t1 = createEmptyTournament({ id: 'tourney-1', event: { location: 'Portland' } });
    const t2 = createEmptyTournament({ id: 'tourney-2', event: { location: 'Seattle' } });

    await store.save(t1);
    await store.save(t2);

    const fetched = await store.get('tourney-1');
    assert.equal(fetched.event.location, 'Portland');
    // Mutating returned object does not mutate stored copy
    fetched.event.location = 'Mutated';
    assert.equal((await store.get('tourney-1')).event.location, 'Portland');

    const all = await store.list();
    assert.equal(all.length, 2);

    assert.equal(await store.delete('tourney-1'), true);
    assert.equal(await store.delete('missing'), false);
    assert.equal(await store.get('tourney-1'), null);

    await store.clear();
    assert.deepEqual(await store.list(), []);
  });
});

describe('LocalStorageTournamentStore', () => {
  it('persists, lists, deletes, and ignores unrelated keys', async () => {
    const mock = createMockStorage();
    mock.setItem('unrelated-key', 'hello');
    const store = new LocalStorageTournamentStore({ storage: mock });

    const t = createEmptyTournament({ id: 'cup-1', event: { location: 'Wyndon' } });
    const saved = await store.save(t);
    assert.equal(saved.id, 'cup-1');

    const loaded = await store.get('cup-1');
    assert.equal(loaded.event.location, 'Wyndon');

    const list = await store.list();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, 'cup-1');

    assert.equal(await store.delete('cup-1'), true);
    assert.equal(await store.delete('cup-1'), false);
    assert.equal(mock.getItem('unrelated-key'), 'hello');
  });

  it('recovers gracefully from corrupt JSON in storage', async () => {
    const mock = createMockStorage();
    mock.setItem('vgc-standings:tournament:bad', '{not-valid-json');
    const store = new LocalStorageTournamentStore({ storage: mock });

    assert.equal(await store.get('bad'), null);
    assert.deepEqual(await store.list(), []);
  });

  it('returns null on QuotaExceededError and when storage is unavailable', async () => {
    const fullStore = new LocalStorageTournamentStore({ storage: createMockStorage({ throwOnSet: true }) });
    const t = createEmptyTournament({ id: 'q1' });
    assert.equal(await fullStore.save(t), null);

    const noStorage = new LocalStorageTournamentStore({ storage: null });
    assert.equal(await noStorage.save(t), null);
    assert.equal(await noStorage.get('q1'), null);
    assert.deepEqual(await noStorage.list(), []);
    assert.equal(await noStorage.delete('q1'), false);
  });
});
