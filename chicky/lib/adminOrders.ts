import { mapStoredOrder } from './orderDetails.ts';
import type { StoredOrder } from '../types';

export interface AdminOrderStats {
  totalOrders: number;
  totalRevenue: number;
  areaStats: Record<string, { count: number; revenue: number }>;
  topArea?: [string, { count: number; revenue: number }];
  topItem?: [string, number];
}
export const ORDER_PAGE_SIZE = 25;
export const EMPTY_ORDER_STATS: AdminOrderStats = { totalOrders: 0, totalRevenue: 0, areaStats: {} };
const ORDER_COLUMNS = 'id,customer_name,phone,address,area,location,items,total_price,status,created_at,order_details';
const EXPORT_COLUMNS = 'id,created_at,customer_name,phone,area,total_price,status,items';
export type OrderRange = { from: string; until: string };

// Preserve the UTC date-prefix semantics used by the original reports.
export function orderDateRange(kind: 'day' | 'month' | 'year', value: string): OrderRange {
  const pattern = kind === 'day' ? /^\d{4}-\d{2}-\d{2}$/ : kind === 'month' ? /^\d{4}-\d{2}$/ : kind === 'year' ? /^\d{4}$/ : null;
  if (!pattern?.test(value)) throw new Error('Invalid reporting period');
  const date = kind === 'year' ? `${value}-01-01` : kind === 'month' ? `${value}-01` : value;
  const start = new Date(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(start.getTime()) || start.toISOString().slice(0, 10) !== date) throw new Error('Invalid reporting period');
  const end = new Date(start);
  if (kind === 'day') end.setUTCDate(end.getUTCDate() + 1);
  else if (kind === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCFullYear(end.getUTCFullYear() + 1);
  return { from: start.toISOString(), until: end.toISOString() };
}

export async function fetchOrdersPage(client: any, page: number, signal?: AbortSignal): Promise<{ orders: StoredOrder[]; total: number }> {
  if (!Number.isSafeInteger(page) || page < 0) throw new Error('Invalid page');
  let query = client.from('orders').select(ORDER_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false }).order('id', { ascending: false })
    .range(page * ORDER_PAGE_SIZE, (page + 1) * ORDER_PAGE_SIZE - 1);
  if (signal) query = query.abortSignal(signal);
  const { data, count, error } = await query;
  if (error || !Array.isArray(data) || !Number.isSafeInteger(count) || count < 0) throw new Error('Orders unavailable');
  return { orders: data.map(mapStoredOrder), total: count };
}

export async function fetchOrderStats(client: any, range: OrderRange, signal?: AbortSignal): Promise<AdminOrderStats> {
  let query = client.rpc('get_chicky_order_stats', { p_from: range.from, p_until: range.until });
  if (signal) query = query.abortSignal(signal);
  const { data, error } = await query;
  if (error || !data || !Number.isSafeInteger(data.totalOrders) || data.totalOrders < 0 ||
      !Number.isFinite(data.totalRevenue) || !data.areaStats || typeof data.areaStats !== 'object') throw new Error('Statistics unavailable');
  const { areaOrder, ...stats } = data;
  if (Array.isArray(areaOrder)) stats.areaStats = Object.fromEntries(areaOrder.map(name => [name, data.areaStats[name]]));
  return { ...stats, topArea: data.topArea ?? undefined, topItem: data.topItem ?? undefined };
}

export function csvCell(value: unknown): string {
  let text = String(value ?? '');
  if (typeof value !== 'number' && (/^\s*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text))) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function exportOrdersCsv(client: any, range: OrderRange, signal?: AbortSignal): Promise<string> {
  const lines = [['Order ID', 'Date', 'Customer', 'Phone', 'Area', 'Total Price', 'Status', 'Items'].map(csvCell).join(',')];
  let beforeAt: string | null = null, beforeId: string | null = null;
  for (;;) {
    signal?.throwIfAborted();
    let query = client.rpc('export_chicky_orders_page', {
      p_from: range.from, p_until: range.until, p_before_at: beforeAt, p_before_id: beforeId, p_limit: 250,
    }).select(EXPORT_COLUMNS);
    if (signal) query = query.abortSignal(signal);
    const { data, error } = await query;
    signal?.throwIfAborted();
    if (error || !Array.isArray(data) || data.length > 250) throw new Error('Export unavailable');
    for (const row of data) {
      const status = row.status === 'pending' ? 'قيد التنفيذ' : row.status === 'completed' ? 'تم التوصيل' : 'ملغي';
      const items = Array.isArray(row.items) ? row.items.map((item: any) => `${item?.name ?? ''} (x${item?.quantity ?? ''})`).join(' | ') : '';
      lines.push([String(row.id).slice(-6), new Date(row.created_at).toLocaleString('ar-EG'), row.customer_name,
        row.phone, row.area || 'N/A', row.total_price, status, items].map(csvCell).join(','));
    }
    if (data.length < 250) break;
    const last = data[data.length - 1];
    if (typeof last.id !== 'string' || typeof last.created_at !== 'string' ||
        (last.id === beforeId && last.created_at === beforeAt)) throw new Error('Invalid export cursor');
    beforeId = last.id; beforeAt = last.created_at;
  }
  return '\uFEFF' + lines.join('\r\n');
}
