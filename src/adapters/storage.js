import { serializeTournament, deserializeTournament } from '../core/schema.js';

/** Store interface: async list(), get(id), save(tournament), delete(id), clear(). */
export class MemoryTournamentStore {
  constructor() {
    this._items = new Map();
  }

  async list() {
    return [...this._items.values()].map((s) => deserializeTournament(s));
  }

  async get(id) {
    const raw = this._items.get(id);
    return raw ? deserializeTournament(raw) : null;
  }

  async save(tournament) {
    const raw = serializeTournament(tournament);
    const record = deserializeTournament(raw);
    this._items.set(record.id, raw);
    return record;
  }

  async delete(id) {
    return this._items.delete(id);
  }

  async clear() {
    this._items.clear();
  }
}

export class LocalStorageTournamentStore {
  constructor({ storage, prefix = 'vgc-standings:tournament:' } = {}) {
    this.prefix = prefix;
    this._storage = storage;
  }

  get storage() {
    if (this._storage) return this._storage;
    try {
      return globalThis.localStorage ?? null;
    } catch {
      return null;
    }
  }

  _keys() {
    const s = this.storage;
    if (!s) return [];
    const keys = [];
    try {
      for (let i = 0; i < s.length; i++) {
        const k = s.key(i);
        if (typeof k === 'string' && k.startsWith(this.prefix)) keys.push(k);
      }
    } catch {
      /* ignore */
    }
    return keys;
  }

  _read(key) {
    try {
      const raw = this.storage?.getItem(key);
      return raw ? deserializeTournament(raw) : null;
    } catch {
      return null; // corrupt JSON or unsupported schema
    }
  }

  async list() {
    return this._keys().map((k) => this._read(k)).filter(Boolean);
  }

  async get(id) {
    return this._read(this.prefix + id);
  }

  /** Returns the saved record, or null if storage is unavailable or full. */
  async save(tournament) {
    try {
      const raw = serializeTournament(tournament);
      const record = deserializeTournament(raw);
      const s = this.storage;
      if (!s) return null;
      s.setItem(this.prefix + record.id, raw);
      return record;
    } catch {
      return null;
    }
  }

  async delete(id) {
    try {
      const s = this.storage;
      if (!s || s.getItem(this.prefix + id) == null) return false;
      s.removeItem(this.prefix + id);
      return true;
    } catch {
      return false;
    }
  }

  async clear() {
    try {
      for (const k of this._keys()) this.storage.removeItem(k);
    } catch {
      /* ignore */
    }
  }
}
