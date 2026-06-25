'use strict';

/**
 * Lightweight in-memory TTL cache.
 *
 * Suitable for a single-instance Node.js process (Render Starter or higher).
 * On Render free tier the process spins down after 15 min of inactivity, which
 * wipes the cache — acceptable, since a cache miss just falls back to Supabase.
 *
 * If you later add multiple backend instances, swap this for the Upstash Redis
 * client (already installed for the OCR queue) so all instances share one cache.
 */

const store = new Map();

/**
 * Retrieve a cached value.
 * Returns null on miss or expiry.
 * @param {string} key
 * @returns {any|null}
 */
function get(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Store a value with a TTL.
 * @param {string} key
 * @param {any}    value
 * @param {number} ttlMs  Default: 5 minutes
 */
function set(key, value, ttlMs = 5 * 60 * 1000) {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

/**
 * Immediately evict one key.
 * Call this after any mutation that would stale the cached data.
 * @param {string} key
 */
function invalidate(key) {
  store.delete(key);
}

/**
 * Evict all keys that start with a given prefix.
 * Useful when a single logical cache (e.g. "services:*") must be cleared.
 * @param {string} prefix
 */
function invalidatePattern(prefix) {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

module.exports = { get, set, invalidate, invalidatePattern };