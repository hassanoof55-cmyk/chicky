import type { Product, ProductSize } from '../types';

export type AnalyticsConsent = 'unknown' | 'accepted' | 'rejected';
export type CommerceEvent = 'view_item_list' | 'select_item' | 'view_item' | 'add_to_cart'
  | 'remove_from_cart' | 'view_cart' | 'begin_checkout' | 'add_shipping_info' | 'add_payment_info';
export interface AnalyticsItem {
  readonly item_id: string;
  readonly item_name: string;
  readonly item_category?: string;
  readonly item_variant?: string;
  readonly price: number;
  readonly quantity: number;
}
export interface AnalyticsContext { client_id: string; session_id: string }

declare global {
  interface Window { chickyAnalyticsLayer?: IArguments[] }
}

export const ANALYTICS_CONSENT_EVENT = 'chicky:analytics-consent';
const CONSENT_KEY = 'chicky.analytics-consent';
const events = new Set<string>([
  'view_item_list', 'select_item', 'view_item', 'add_to_cart', 'remove_from_cart',
  'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info',
]);
// Accept only frozen snapshots made from catalog products, never arbitrary checkout objects.
const catalogItems = new WeakSet<object>();
const catalogProductIds = new Set<string>();
const catalogCategoryIds = new Set<string>();
const catalogSizeIds = new Map<string, Set<string>>();
const PUBLIC_ORIGIN = 'https://chickyfc.com';
let lastPageViewLocation: string | undefined;
let consent: AnalyticsConsent = 'unknown';
let readConsent = false;
let listening = false;
let measurementId: string | undefined;
let tag: HTMLScriptElement | undefined;
let loaded = false;
let revision = 0;
const pendingContexts = new Set<() => void>();

const browser = () => typeof window !== 'undefined' && typeof document !== 'undefined';
const normalizeConsent = (value: unknown): AnalyticsConsent =>
  value === 'accepted' || value === 'rejected' ? value : 'unknown';
const money = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;
const identifier = (value: unknown): value is string => typeof value === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(value);
const catalogName = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
  && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);

export function getAnalyticsConsent(): AnalyticsConsent {
  if (!browser()) return 'unknown';
  if (!readConsent) {
    readConsent = true;
    try { consent = normalizeConsent(window.localStorage.getItem(CONSENT_KEY)); } catch { /* Session-only choice if storage is blocked. */ }
  }
  return consent;
}

function command(..._args: unknown[]) {
  (window.chickyAnalyticsLayer ??= []).push(arguments);
}

function publicCatalogPath(pathname: unknown): string | undefined {
  if (pathname === '/') return '/';
  if (typeof pathname !== 'string') return undefined;
  const route = /^\/(products|categories)\/([a-zA-Z0-9][a-zA-Z0-9._-]{0,127})$/.exec(pathname);
  if (!route) return undefined;
  const ids = route[1] === 'products' ? catalogProductIds : catalogCategoryIds;
  return ids.has(route[2]) ? pathname : undefined;
}

function pageParameters(pathname: string): Record<string, string> {
  const parameters: Record<string, string> = {
    page_location: `${PUBLIC_ORIGIN}${pathname}`, page_referrer: '', page_title: 'CHICKY',
  };
  // Never copy href, referrer, document title, search terms or arbitrary query data.
  const search = window.location.search;
  if (typeof search === 'string' && search.length <= 2048) {
    const query = new URLSearchParams(search);
    const sizes = query.getAll('size');
    const productId = pathname.startsWith('/products/') ? pathname.slice('/products/'.length) : undefined;
    if (productId && sizes.length === 1 && identifier(sizes[0]) && catalogSizeIds.get(productId)?.has(sizes[0])) {
      parameters.page_location += `?size=${encodeURIComponent(sizes[0])}`;
    }
    for (const [utm, field] of [['utm_source', 'campaign_source'], ['utm_medium', 'campaign_medium'], ['utm_campaign', 'campaign_name']]) {
      const values = query.getAll(utm);
      if (values.length === 1 && /^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(values[0])) parameters[field] = values[0];
    }
  }
  return parameters;
}

/**
 * Explicit current-page views only, after opt-in and configuration. Call on SPA
 * navigation if needed. Catalog paths and size SKUs must first be registered through analyticsItem;
 * otherwise the automatic view uses '/' without exposing unknown path text.
 */
export function trackPageView(pathname?: string): void {
  if (!browser() || !tag || !measurementId || getAnalyticsConsent() !== 'accepted') return;
  const current = window.location.pathname;
  if (pathname !== undefined && (pathname !== current || !publicCatalogPath(pathname))) return;
  const path = publicCatalogPath(current) ?? '/';
  const parameters = pageParameters(path);
  if (lastPageViewLocation === parameters.page_location) return;
  command('event', 'page_view', parameters);
  lastPageViewLocation = parameters.page_location;
}

function disableFlag(disabled: boolean) {
  if (measurementId) (window as unknown as Record<string, unknown>)[`ga-disable-${measurementId}`] = disabled;
}

function clearAnalyticsCookies() {
  // Host-only plus parent-domain cookies, at root and each current path scope.
  // HttpOnly cookies and cookies on other hosts/paths cannot be removed by JS.
  try {
    const host = window.location.hostname;
    const domains = new Set(['', host, `.${host}`]);
    const labels = host.split('.');
    for (let i = 1; i < labels.length - 1; i++) {
      const parent = labels.slice(i).join('.');
      domains.add(parent); domains.add(`.${parent}`);
    }
    const paths = new Set(['/']);
    let path = '';
    for (const part of (window.location.pathname || '/').split('/').filter(Boolean)) {
      path += `/${part}`; paths.add(path); paths.add(`${path}/`);
    }
    for (const cookie of document.cookie.split(';')) {
      const name = cookie.split('=')[0].trim();
      if (!/^(_ga(?:_|$)|_gid$|_gat(?:_|$)|_gac_)/.test(name)) continue;
      for (const domain of domains) for (const scope of paths) {
        document.cookie = `${name}=; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=${scope};${domain ? ` Domain=${domain};` : ''}`;
      }
    }
  } catch { /* Cookie access can be blocked independently of storage. */ }
}

function stopAnalytics() {
  revision++;
  disableFlag(true);
  for (const cancel of pendingContexts) cancel();
  // No denied-consent pings: disable before updating any already loaded tag.
  if (tag) command('consent', 'update', { analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  tag?.remove();
  tag = undefined;
  loaded = false;
  lastPageViewLocation = undefined;
  // Discard queued consented hits too; never replay them after a later opt-in.
  if (window.chickyAnalyticsLayer) window.chickyAnalyticsLayer.length = 0;
  clearAnalyticsCookies();
}

function startAnalytics() {
  if (!browser() || !measurementId || getAnalyticsConsent() !== 'accepted' || tag) return;
  disableFlag(false);
  command('consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  command('consent', 'update', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' });
  command('js', new Date());
  command('config', measurementId, {
    send_page_view: false, allow_google_signals: false, allow_ad_personalization_signals: false,
    // URLs, query strings, document titles and referrers may contain customer input.
    ...pageParameters(publicCatalogPath(window.location.pathname) ?? '/'), ignore_referrer: true,
    cookie_path: '/', cookie_flags: 'SameSite=Lax;Secure',
  });
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}&l=chickyAnalyticsLayer`;
  script.referrerPolicy = 'no-referrer';
  script.onload = () => { if (tag === script && getAnalyticsConsent() === 'accepted') loaded = true; };
  script.onerror = () => { if (tag === script) stopAnalytics(); };
  tag = script;
  document.head.appendChild(script);
  trackPageView();
}

function watchConsent() {
  if (listening || !browser()) return;
  listening = true;
  window.addEventListener('storage', event => {
    if (event.key !== CONSENT_KEY && event.key !== null) return;
    // Ignore sessionStorage changes; storage access itself may throw.
    try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch { return; }
    consent = normalizeConsent(event.key === null ? null : event.newValue);
    readConsent = true;
    if (consent === 'accepted') startAnalytics(); else stopAnalytics();
    window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
  });
}

export function setAnalyticsConsent(value: AnalyticsConsent): void {
  if (!browser() || !['accepted', 'rejected', 'unknown'].includes(value)) return;
  consent = value;
  readConsent = true;
  try { window.localStorage.setItem(CONSENT_KEY, consent); } catch { /* Keep the choice for this tab. */ }
  watchConsent();
  if (consent === 'accepted') startAnalytics(); else stopAnalytics();
  window.dispatchEvent(new Event(ANALYTICS_CONSENT_EVENT));
}

/**
 * Supply a real GA4 measurement ID from configuration. Invalid/absent IDs do nothing.
 * Before activation, disable Enhanced Measurement and user-provided data collection
 * in the GA4 property: provider-controlled automatic events are outside this allowlist.
 */
export function initializeAnalytics(id?: string): void {
  if (!browser() || typeof id !== 'string' || !/^G-[A-Z0-9]{10}$/.test(id)) return;
  // A single property per page lifecycle; repeated React effects are harmless.
  if (measurementId && measurementId !== id) return;
  measurementId = id;
  watchConsent();
  if (getAnalyticsConsent() === 'accepted') startAnalytics(); else stopAnalytics();
}

/**
 * Registers this valid catalog product/category/SKU without emitting analytics.
 * Register all base/size entries before initializeAnalytics after menu data is ready.
 * Optionally pass the final cart unit price (including modifiers); never notes.
 */
export function analyticsItem(product: Product, quantity = 1, size?: ProductSize, unitPriceOverride?: number): AnalyticsItem | null {
  if (!product || !identifier(product.id) || !catalogName(product.name)
    || !Number.isSafeInteger(quantity) || quantity < 1) return null;
  const selected = size ? product.sizes?.find(candidate => candidate.id === size.id) : undefined;
  if (size && (!selected || !identifier(selected.id) || !catalogName(selected.nameEn))) return null;
  if (unitPriceOverride !== undefined && (!money(unitPriceOverride) || unitPriceOverride <= 0)) return null;
  const price = unitPriceOverride ?? (selected ? selected.price : product.price);
  if (!money(price) || !Number.isFinite(price * quantity)) return null;
  const item: AnalyticsItem = Object.freeze({
    item_id: selected ? `${product.id}--${selected.id}` : product.id,
    item_name: product.name,
    ...(catalogName(product.category) ? { item_category: product.category } : {}),
    ...(selected ? { item_variant: selected.nameEn } : {}),
    price, quantity,
  });
  catalogItems.add(item);
  catalogProductIds.add(product.id);
  if (selected) {
    const sizes = catalogSizeIds.get(product.id) ?? new Set<string>();
    sizes.add(selected.id);
    catalogSizeIds.set(product.id, sizes);
  }
  if (identifier(product.category)) catalogCategoryIds.add(product.category);
  return item;
}

export function trackCommerce(event: CommerceEvent, items: readonly (AnalyticsItem | null)[], extra: Record<string, unknown> = {}): void {
  if (!browser() || !tag || !measurementId || getAnalyticsConsent() !== 'accepted' || !events.has(event) || !Array.isArray(items)) return;
  const safeItems = items.filter((item): item is AnalyticsItem => !!item && catalogItems.has(item)).slice(0, 200);
  if (!safeItems.length) return;
  const value = safeItems.reduce((total, item) => total + item.price * item.quantity, 0);
  if (!Number.isFinite(value)) return;
  const payload: Record<string, unknown> = { currency: 'EGP', value, items: safeItems.map(item => ({ ...item })) };
  for (const key of ['value', 'tax', 'shipping']) if (money(extra?.[key])) payload[key] = extra[key];
  if (['delivery', 'pickup', 'dine-in'].includes(extra?.shipping_tier as string)) payload.shipping_tier = extra.shipping_tier;
  if (['cash', 'instapay', 'wallet'].includes(extra?.payment_type as string)) payload.payment_type = extra.payment_type;
  // Category display names are not supplied separately to this API. Only permit
  // the exact catalog category on these items, never arbitrary list labels.
  if (identifier(extra?.item_list_id) && safeItems.some(item => item.item_category === extra.item_list_id)) payload.item_list_id = extra.item_list_id;
  if (catalogName(extra?.item_list_name) && safeItems.some(item => item.item_category === extra.item_list_name)) payload.item_list_name = extra.item_list_name;
  command('event', event, payload);
}

/** Optional future server-conversion context. Never reads cookies or creates identifiers. */
export async function getAnalyticsContext(): Promise<AnalyticsContext | undefined> {
  if (!browser() || !measurementId || !loaded || getAnalyticsConsent() !== 'accepted') return undefined;
  const currentRevision = revision;
  return new Promise(resolve => {
    let done = false;
    let clientId: string | undefined;
    let sessionId: string | undefined;
    const finish = (context?: AnalyticsContext) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      pendingContexts.delete(cancel);
      resolve(context);
    };
    const cancel = () => finish();
    const timeout = setTimeout(cancel, 1500);
    pendingContexts.add(cancel);
    const receive = (field: 'client_id' | 'session_id', value: unknown) => {
      if (done) return;
      if (revision !== currentRevision || getAnalyticsConsent() !== 'accepted') return finish();
      const id = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : value;
      if (typeof id !== 'string' || !(field === 'client_id' ? /^\d{1,30}\.\d{1,30}$/ : /^\d{1,30}$/).test(id)) return finish();
      if (field === 'client_id') clientId = id; else sessionId = id;
      if (clientId && sessionId) finish({ client_id: clientId, session_id: sessionId });
    };
    command('get', measurementId, 'client_id', (value: unknown) => receive('client_id', value));
    command('get', measurementId, 'session_id', (value: unknown) => receive('session_id', value));
  });
}
