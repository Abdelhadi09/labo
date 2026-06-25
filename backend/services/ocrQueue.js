'use strict';

const { Queue } = require('bullmq');

const OCR_QUEUE_NAME = 'ocr-jobs';

/**
 * Build an ioredis-compatible connection config from the Upstash Redis URL.
 *
 * Upstash free tier URL format:
 *   rediss://default:<password>@<host>:<port>
 *
 * The "rediss://" scheme (double-s) means TLS is required.
 * BullMQ passes this object straight to ioredis.
 */
function getRedisConnection() {
  const url = process.env.UPSTASH_REDIS_URL;
  if (!url) {
    throw new Error(
      'UPSTASH_REDIS_URL is not set. ' +
      'Add it to your .env: rediss://default:<password>@<host>:<port>'
    );
  }

  const parsed = new URL(url);
  return {
    host:     parsed.hostname,
    port:     parseInt(parsed.port, 10),
    password: parsed.password || undefined,
    tls:      { rejectUnauthorized: false }, // required by Upstash
    maxRetriesPerRequest: null,              // required by BullMQ
  };
}

/** Singleton queue instance — created once, reused across requests. */
let _queue = null;

/**
 * Returns the shared OCR BullMQ Queue instance.
 * Lazy-initialised on first call.
 * @returns {Queue}
 */
function getOcrQueue() {
  if (!_queue) {
    _queue = new Queue(OCR_QUEUE_NAME, {
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts:  3,                              // retry up to 3 times on failure
        backoff:   { type: 'exponential', delay: 5_000 }, // 5s → 25s → 125s
        removeOnComplete: { count: 100 },          // keep last 100 completed jobs for debugging
        removeOnFail:     { count:  50 },          // keep last 50 failed jobs for inspection
      },
    });

    _queue.on('error', (err) => {
      // Log but don't crash — the queue is non-critical path
      console.error('[OCR Queue] Redis connection error:', err.message);
    });
  }
  return _queue;
}

module.exports = { getOcrQueue, getRedisConnection, OCR_QUEUE_NAME };