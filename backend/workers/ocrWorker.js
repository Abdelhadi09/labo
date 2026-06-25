'use strict';

const https  = require('https');
const http   = require('http');
const { Worker } = require('bullmq');
const { getPool }                           = require('../config/database');
const { extractTextFromImage, matchServicesFromText } = require('../services/ocrService');
const { getRedisConnection, OCR_QUEUE_NAME }          = require('../services/ocrQueue');

/**
 * Download a remote image into a Buffer.
 * Works for both http:// and https:// URLs (Cloudinary uses https).
 */
function fetchImageBuffer(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(`Image fetch failed with HTTP ${res.statusCode}: ${url}`));
      }
      const chunks = [];
      res.on('data',  (chunk) => chunks.push(chunk));
      res.on('end',   ()      => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

/**
 * Start the background OCR worker.
 *
 * This runs in the same Node.js process as the Express server.
 * BullMQ Workers use a separate ioredis connection and process jobs
 * on the event loop between requests — they do NOT block incoming HTTP
 * traffic the way the old synchronous Tesseract call did.
 *
 * concurrency: 2 means at most 2 OCR jobs run in parallel.
 * Adjust down to 1 if memory pressure is observed on Render.
 */
function startOcrWorker() {
  const worker = new Worker(
    OCR_QUEUE_NAME,

    async (job) => {
      const { demandId, fileUrl } = job.data;
      const supabase = getPool();

      console.log(`[OCR Worker] Starting job ${job.id} → demand ${demandId}`);

      // ── Guard: skip if demand was already processed (safe retry) ──────────
      const { data: demand } = await supabase
        .from('demands')
        .select('status')
        .eq('id', demandId)
        .single();

      if (!demand) {
        throw new Error(`Demand ${demandId} not found — cannot run OCR`);
      }
      if (demand.status !== 'pending') {
        console.log(`[OCR Worker] Demand ${demandId} is already "${demand.status}" — skipping`);
        return { skipped: true, reason: 'already processed' };
      }

      // ── 1. Download ordonnance image from Cloudinary ───────────────────────
      await job.updateProgress(10);
      const imageBuffer = await fetchImageBuffer(fileUrl);

      // ── 2. Run Tesseract OCR ───────────────────────────────────────────────
      // extractTextFromImage already wraps Tesseract with a 60-second timeout.
      await job.updateProgress(30);
      const ocrText = await extractTextFromImage(imageBuffer);

      // ── 3. Fetch all active services ───────────────────────────────────────
      await job.updateProgress(70);
      const { data: allServices, error: svcsErr } = await supabase
        .from('analysis_services')
        .select('*')
        .eq('is_active', true);

      if (svcsErr) {
        throw new Error(`Failed to fetch services: ${svcsErr.message}`);
      }

      // ── 4. Match services from OCR text ────────────────────────────────────
      const matchedServices = matchServicesFromText(ocrText, allServices || []);
      const totalPrice      = matchedServices.reduce((sum, s) => sum + parseFloat(s.price), 0);
      const newStatus       = matchedServices.length > 0 ? 'ocr_processed' : 'ocr_no_match';

      // ── 5. Persist results ────────────────────────────────────────────────
      await job.updateProgress(85);

      if (matchedServices.length > 0) {
        // Batch-insert demand_items (demand was created with zero items)
        const { error: itemsErr } = await supabase
          .from('demand_items')
          .insert(
            matchedServices.map((s) => ({
              demand_id:  demandId,
              service_id: s.id,
              price:      s.price,
            }))
          );
        if (itemsErr) throw new Error(`Failed to insert demand items: ${itemsErr.message}`);
      }

      // Update the demand — only if still 'pending' (prevents double-write on retry)
      const { error: updateErr } = await supabase
        .from('demands')
        .update({
          status:      newStatus,
          ocr_text:    ocrText,
          total_price: matchedServices.length > 0 ? totalPrice : null,
          updated_at:  new Date().toISOString(),
        })
        .eq('id', demandId)
        .eq('status', 'pending'); // safety: don't overwrite if already updated

      if (updateErr) throw new Error(`Failed to update demand: ${updateErr.message}`);

      await job.updateProgress(100);
      console.log(
        `[OCR Worker] Job ${job.id} done — ` +
        `demand ${demandId} → ${newStatus} (${matchedServices.length} services matched)`
      );

      return { status: newStatus, matchedCount: matchedServices.length };
    },

    {
      connection:  getRedisConnection(),
      concurrency: 2, // max 2 Tesseract jobs running in parallel
    }
  );

  // ── Worker event hooks ─────────────────────────────────────────────────────
  worker.on('failed', async (job, err) => {
    console.error(`[OCR Worker] Job ${job?.id} failed (attempt ${job?.attemptsMade}):`, err.message);

    // After all retries are exhausted, mark the demand as ocr_no_match so
    // workers can still process it manually via the dashboard.
    if (job && job.attemptsMade >= (job.opts?.attempts ?? 3)) {
      const supabase = getPool();
      await supabase
        .from('demands')
        .update({ status: 'ocr_no_match', updated_at: new Date().toISOString() })
        .eq('id', job.data.demandId)
        .eq('status', 'pending')
        .then(() =>
          console.log(`[OCR Worker] Demand ${job.data.demandId} marked as ocr_no_match after all retries exhausted`)
        )
        .catch((e) =>
          console.error(`[OCR Worker] Could not mark demand as ocr_no_match:`, e.message)
        );
    }
  });

  worker.on('error', (err) => {
    // ioredis connection errors — log but don't crash the server
    console.error('[OCR Worker] Worker error:', err.message);
  });

  console.log(`✅ OCR worker started (queue: "${OCR_QUEUE_NAME}", concurrency: 2)`);
  return worker;
}

module.exports = { startOcrWorker };