import fs from 'fs';
import Redis from 'ioredis';

// Key-value store: every record is stored under a unique key (e.g. "menu:<id>", "order:<id>") with a JSON value.
function redisStore(url) {
  const r = new Redis(url, { maxRetriesPerRequest: 3 });
  return {
    kind: 'redis',
    async get(k) { const v = await r.get(k); return v ? JSON.parse(v) : null; },
    async set(k, v) { await r.set(k, JSON.stringify(v)); },
    async del(k) { return (await r.del(k)) > 0; },
    async list(prefix) {
      const keys = [];
      let cursor = '0';
      do {
        const [next, batch] = await r.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 100);
        cursor = next;
        keys.push(...batch);
      } while (cursor !== '0');
      if (!keys.length) return [];
      const vals = await r.mget(keys);
      return vals.filter(Boolean).map((v) => JSON.parse(v));
    },
    async incr(k) { return r.incr(k); },
    async ping() { return (await r.ping()) === 'PONG'; },
  };
}

// Local-development fallback that still persists across restarts.
function fileStore(file) {
  let data = {};
  try { data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch { /* new file */ }
  const save = () => fs.writeFileSync(file, JSON.stringify(data, null, 2));
  return {
    kind: 'file',
    async get(k) { return data[k] ?? null; },
    async set(k, v) { data[k] = v; save(); },
    async del(k) { const had = k in data; delete data[k]; save(); return had; },
    async list(prefix) { return Object.keys(data).filter((k) => k.startsWith(prefix)).map((k) => data[k]); },
    async incr(k) { data[k] = (data[k] || 0) + 1; save(); return data[k]; },
    async ping() { return true; },
  };
}

export function createStore() {
  return process.env.REDIS_URL ? redisStore(process.env.REDIS_URL) : fileStore(process.env.DATA_FILE || './data.json');
}
