// Server only. Consent, catalogue provenance and delivery leases are enforced by
// the private SQL outbox. Never import this module from storefront code.
const TRANSACTION = /^CH-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const digits = value => typeof value === 'string' && /^\d{1,20}$/.test(value);
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const token = value => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(value);
// Names originate in the catalogue RPC, never order notes or customer input.
// Bound even those names and reject common contact/URL/free-text delimiters.
const catalogName = value => typeof value === 'string' && value.length <= 100
  && value.trim().length > 0 && /^[\p{L}\p{M}\p{N} ()&+'.,\/-]+$/u.test(value)
  && !/(?:\d[\s().-]*){7}|(?:https?|www)[.:/]/i.test(value);

function whitelistPayload(payload, orderId) {
  if (!record(payload) || typeof payload.client_id !== 'string'
      || !/^\d{1,20}\.\d{1,20}$/.test(payload.client_id)
      || !Array.isArray(payload.events) || payload.events.length !== 1) return null;
  const event = payload.events[0];
  if (!record(event) || event.name !== 'purchase' || !record(event.params)) return null;
  const p = event.params;
  // The RPC supplies session identity but no duration. A fixed minimum is the
  // only extra parameter; never derive engagement from customer/order fields.
  const engagement = p.engagement_time_msec === undefined ? 1 : p.engagement_time_msec;
  if (typeof p.transaction_id !== 'string' || !TRANSACTION.test(p.transaction_id)
      || (orderId !== undefined && p.transaction_id !== orderId)
      || p.currency !== 'EGP' || !positive(p.value) || !nonnegative(p.shipping)
      || !digits(p.session_id) || !Number.isSafeInteger(engagement) || engagement <= 0
      || !Array.isArray(p.items) || p.items.length < 1 || p.items.length > 100) return null;
  const items = [];
  for (const item of p.items) {
    if (!record(item) || !token(item.item_id) || !catalogName(item.item_name)
        || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 999
        || !positive(item.price)) return null;
    items.push({ item_id: item.item_id, item_name: item.item_name, quantity: item.quantity, price: item.price });
  }
  return { client_id: payload.client_id, events: [{ name: 'purchase', params: {
    transaction_id: p.transaction_id, currency: 'EGP', value: p.value, shipping: p.shipping,
    session_id: p.session_id, engagement_time_msec: engagement, items,
  } }] };
}

const nonempty = value => typeof value === 'string' && value.trim().length > 0;
function analyticsConfigured(config) {
  return /^G-[A-Z0-9]{10}$/.test(config.measurementId ?? '') && nonempty(config.apiSecret);
}
function configured(config) {
  if (!analyticsConfigured(config) || !nonempty(config.serviceKey) || !nonempty(config.supabaseUrl)) return false;
  try {
    const url = new URL(config.supabaseUrl);
    return url.protocol === 'https:' && !url.username && !url.password && !url.search && !url.hash && url.pathname === '/';
  } catch { return false; }
}

// Bound response consumption as well as connection time. Race explicitly so an
// injected/custom fetcher ignoring AbortSignal cannot hold the worker forever.
async function request(fetcher, url, options, consume = async response => response) {
  const controller = new AbortController();
  let timer;
  const timeout = new Promise((resolve, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error('Conversion request timed out'));
    }, 10000);
  });
  try {
    return await Promise.race([
      Promise.resolve(fetcher(url, { ...options, signal: controller.signal, redirect: 'error' })).then(consume),
      timeout,
    ]);
  } finally { clearTimeout(timer); }
}

function rpc(config, name, body, consume) {
  const publicWorker = !!config.publicKey;
  const endpoint = publicWorker ? ({claim_chicky_analytics_batch:'claim_chicky_analytics_worker',finish_chicky_analytics_event:'finish_chicky_analytics_worker'}[name]) : name;
  return request(config.fetcher, `${config.supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/${endpoint}`, {
    method: 'POST', headers: { apikey: config.publicKey || config.serviceKey, Authorization: `Bearer ${config.publicKey || config.serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(publicWorker ? {...body,p_worker_token:config.serviceKey} : body),
  }, async response => {
    if (!response.ok) throw new Error('Conversion outbox request failed');
    return consume ? consume(response) : undefined;
  });
}

function googleUrl(config, debug) {
  const url = new URL(debug ? 'https://www.google-analytics.com/debug/mp/collect' : 'https://www.google-analytics.com/mp/collect');
  url.searchParams.set('measurement_id', config.measurementId);
  url.searchParams.set('api_secret', config.apiSecret);
  return url.href;
}

/** Validate without ingesting a sale or reading/acknowledging the outbox.
 * Returned diagnostics may contain input values; callers must not log them.
 */
export async function validateConversionPayload({ measurementId, apiSecret, payload, fetcher = fetch } = {}) {
  const config = { measurementId, apiSecret, fetcher };
  if (!analyticsConfigured(config)) return { valid: false, validationMessages: [], error: 'missing_config' };
  const safe = whitelistPayload(payload);
  if (!safe) return { valid: false, validationMessages: [], error: 'invalid_payload' };
  try {
    return await request(fetcher, googleUrl(config, true), {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...safe, validation_behavior: 'ENFORCE_RECOMMENDATIONS' }),
    }, async response => {
      if (!response.ok) throw new Error('Conversion validation failed');
      const data = await response.json();
      if (!Array.isArray(data?.validationMessages)) throw new Error('Invalid validation response');
      return { valid: data.validationMessages.length === 0, validationMessages: data.validationMessages };
    });
  } catch { return { valid: false, validationMessages: [], error: 'validation_request_failed' }; }
}

/** A 2xx/204 is transport acceptance, not proof of GA server validation.
 * Uncertain sends retain the transaction_id on retry; the SQL lease prevents
 * ordinary concurrent delivery, and GA transaction dedup handles that retry.
 */
export async function runConversionBatch({ supabaseUrl, serviceKey, publicKey, measurementId, apiSecret, fetcher = fetch, debug = false } = {}) {
  const config = { supabaseUrl, serviceKey, publicKey, measurementId, apiSecret, fetcher };
  if (!configured(config)) return { skipped: 'missing_config' };
  // Validation must never consume production work or mark it as delivered.
  if (debug) return { skipped: 'debug_mode' };
  const result = { claimed: 0, sent: 0, failed: 0 };
  let rows;
  try { rows = await rpc(config, 'claim_chicky_analytics_batch', { p_limit: 20 }, response => response.json()); }
  catch { return { ...result, error: 'claim_failed' }; }
  if (!Array.isArray(rows) || rows.length > 20) return { ...result, error: 'invalid_claim_response' };
  result.claimed = rows.length;
  // At most twenty parallel sends keep all work within the SQL five-minute
  // lease, even if each send and acknowledgement reaches its ten-second cap.
  await Promise.all(rows.map(async row => {
    let success = false;
    const safe = whitelistPayload(row?.payload, row?.order_id);
    // A missing outbox identity must not bypass payload/order matching.
    if (typeof row?.order_id === 'string' && TRANSACTION.test(row.order_id) && safe) {
      try {
        success = await request(fetcher, googleUrl(config, false), {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(safe),
        }, response => response.ok);
      } catch { /* Retry without exposing request URLs, secrets or payloads. */ }
    }
    try {
      if (typeof row?.order_id !== 'string' || !TRANSACTION.test(row.order_id)) throw new Error('Invalid outbox identity');
      await rpc(config, 'finish_chicky_analytics_event', { p_order_id: row.order_id, p_success: success });
    } catch {
      // Leave the lease to expire on acknowledgement failure. Never log the
      // underlying error, which can contain secrets from a request URL.
      result.failed++;
      return;
    }
    if (success) result.sent++; else result.failed++;
  }));
  return result;
}

/** Start only at server startup. Importing this module has no side effects. */
export function startConversionWorker(config = {}) {
  if (!configured(config) || config.debug) return null;
  let running = false;
  let stopped = false;
  const tick = async () => {
    if (running || stopped) return;
    running = true;
    try { await runConversionBatch(config); }
    catch { /* Keep future ticks alive without logging private errors. */ }
    finally { running = false; }
  };
  const timer = setInterval(tick, 30000);
  timer.unref();
  void tick();
  return { timer, stop() { stopped = true; clearInterval(timer); } };
}
