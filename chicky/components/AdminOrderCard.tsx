import React, { useState } from 'react';
import { Copy, Phone, Printer, MapPin, ChevronDown } from 'lucide-react';
import type { StoredOrder } from '../types';
import { shortOrderId, orderPhones, orderAddress, orderPayment, orderMoney, orderTimestamp, orderStatus, orderService, printOrderReceipt } from '../lib/orderPresentation';

export default function AdminOrderCard({ order, onStatus }: { key?: string; order: StoredOrder; onStatus: (id: string, status: StoredOrder['status']) => Promise<void> }) {
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const money = orderMoney(order);
  const phones = orderPhones(order.phone || '');
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); setMessage('تم النسخ.'); }
    catch { setMessage('تعذر النسخ؛ يمكنك تحديد النص ونسخه يدويًا.'); }
  };
  const update = async (status: StoredOrder['status']) => {
    setBusy(true);
    try { await onStatus(order.id, status); } finally { setBusy(false); }
  };
  return <article className="admin-order-card" dir="rtl" aria-label={`طلب ${shortOrderId(order.id)}`}>
    <div className="admin-order-card__header">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-bold text-lg text-slate-900 break-words">{order.customerName}</h4>
          <span className={`admin-order-status admin-order-status--${order.status}`}>{orderStatus(order.status)}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-slate-600">
          <button type="button" onClick={() => void copy(order.id)} title={`نسخ الرقم الكامل: ${order.id}`} className="inline-flex items-center gap-2 font-bold text-red-700" aria-label={`نسخ رقم الطلب ${shortOrderId(order.id)}`}><bdi>{shortOrderId(order.id)}</bdi><Copy size={14} /></button>
          <time dateTime={order.createdAt}>{orderTimestamp(order.createdAt)}</time>
        </div>
      </div>
      <strong className="text-xl text-slate-900 whitespace-nowrap">{order.totalPrice} <span className="text-sm">ج.م</span></strong>
    </div>
    <div className="flex flex-wrap gap-x-5 gap-y-2 my-3 text-sm text-slate-600">
      <span>{orderService(order)} · {order.area || 'المنطقة غير مسجّلة'}</span>
      <span>الدفع: {orderPayment(order)}</span>
      <span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} قطعة</span>
      {order.scheduledTime && <strong className="text-red-700">موعد مجدول: <bdi>{order.scheduledTime}</bdi></strong>}
    </div>
    <p className="text-sm text-slate-700 leading-7 break-words">{order.items.map(item => `${item.quantity} × ${item.name}`).join(' · ')}</p>
    <details className="mt-3">
      <summary className="admin-order-details-summary">تفاصيل الطلب <ChevronDown size={16} /></summary>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-4">
        <section aria-label="بيانات التوصيل" className="space-y-3 min-w-0">
          <h5 className="font-bold">بيانات التوصيل</h5>
          <p className="text-sm leading-7 break-words">{orderAddress(order) || 'العنوان غير مسجّل'}</p>
          <p dir="ltr" className="text-right text-sm break-words">{order.phone}</p>
          <div className="flex flex-wrap gap-2">
            {phones.map((phone, index) => <a key={`${phone}-${index}`} className="admin-order-action" href={`tel:${phone.replace(/[^+\d]/g, '')}`}><Phone size={15} />{phones.length > 1 ? `اتصال ${index + 1}` : 'اتصال'}</a>)}
            <button className="admin-order-action" onClick={() => void copy([orderAddress(order), order.area].filter(Boolean).join(' — '))}><Copy size={15} /> نسخ العنوان</button>
            {order.location && Number.isFinite(order.location.lat) && Number.isFinite(order.location.lng) && <a className="admin-order-action" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${order.location.lat},${order.location.lng}`}><MapPin size={15} /> الخريطة</a>}
          </div>
          <p className="text-xs text-slate-500 break-all">الرقم الكامل: <bdi>{order.id}</bdi></p>
        </section>
        <section aria-label="أصناف الطلب" className="min-w-0">
          <h5 className="font-bold mb-3">أصناف الطلب</h5>
          <ul className="space-y-3">
            {order.items.map((item, index) => <li key={index} className="flex justify-between gap-3 text-sm border-b border-slate-100 pb-2">
              <div><strong>{item.quantity} × {item.name}</strong>
                <p className="text-slate-600">{[item.selectedSize?.nameAr || item.selectedSize?.nameEn, item.selectedSpiciness === 'Spicy' ? 'حار' : item.selectedSpiciness === 'Normal' ? 'عادي' : item.selectedSpiciness].filter(Boolean).join(' · ')}</p>
                {item.selectedModifiers?.map(modifier => <p key={modifier.id} className="text-slate-600">+ {modifier.nameAr || modifier.nameEn}</p>)}
              </div><span className="whitespace-nowrap">{item.price * item.quantity} ج.م</span>
            </li>)}
          </ul>
          <dl className="text-sm space-y-2 mt-4">
            <div className="flex justify-between gap-3"><dt>قيمة الأصناف</dt><dd>{money.subtotal} ج.م</dd></div>
            {money.breakdown ? <>
              <div className="flex justify-between gap-3"><dt>التوصيل</dt><dd>{money.breakdown.deliveryFee} ج.م</dd></div>
              <div className="flex justify-between gap-3"><dt>الخصم</dt><dd>{money.breakdown.discountAmount} ج.م</dd></div>
            </> : <div><div className="flex justify-between gap-3"><dt>صافي التوصيل / الخصم</dt><dd>{money.adjustment} ج.م</dd></div><p className="text-xs text-slate-500 mt-2">التوصيل والخصم غير محفوظين بشكل منفصل في هذا الطلب.</p></div>}
            <div className="flex justify-between gap-3 font-bold"><dt>الإجمالي</dt><dd>{order.totalPrice} ج.م</dd></div>
          </dl>
        </section>
      </div>
      <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-100">
        <button className="admin-order-action" onClick={() => printOrderReceipt(order, () => setMessage('تعذرت الطباعة؛ حاول مرة أخرى.'))}><Printer size={16} /> طباعة بون</button>
        <button disabled={busy} className="admin-order-action admin-order-action--complete" onClick={() => void update('completed')}>{busy ? 'جاري الحفظ…' : 'تحديد كمكتمل'}</button>
        <button disabled={busy} className="admin-order-action text-red-700" onClick={() => void update('cancelled')}>إلغاء الطلب</button>
      </div>
    </details>
    {message && <p role="status" className="text-sm mt-3 text-slate-700">{message}</p>}
  </article>;
}
