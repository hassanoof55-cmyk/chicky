import type { CartItem, Language, StoredOrder } from '../types';

export function orderItems(items: CartItem[], language: Language) {
  return items.map(item => ({
    id: item.id, category: item.category,
    name: language === 'ar' ? item.nameAr : item.name,
    quantity: item.quantity, price: item.price, spiciness: item.selectedSpiciness,
    size: item.selectedSize ? (language === 'ar' ? item.selectedSize.nameAr : item.selectedSize.nameEn) : null,
    size_id: item.selectedSize?.id || null,
    modifier_ids: (item.selectedModifiers || []).map(modifier => modifier.id)
  }));
}

// Both the initial query and realtime INSERT use the same persisted shape.
// Keep older order labels readable without changing historical records.
export function mapStoredOrder(row: any): StoredOrder {
  return {
    id: row.id, customerName: row.customer_name, phone: row.phone,
    address: row.address, area: row.area, location: row.location,
    items: (row.items || []).map((item: any) => ({
      ...item,
      selectedSpiciness: item.selectedSpiciness ?? item.spiciness,
      selectedSize: item.selectedSize ?? (item.size ? { nameEn: item.size, nameAr: item.size } : undefined),
      selectedModifiers: item.selectedModifiers || []
    })),
    totalPrice: row.total_price, status: row.status, createdAt: row.created_at,
    serviceType: row.order_details?.service_type ?? row.service_type,
    scheduledTime: row.order_details?.scheduled_time ?? row.scheduled_time,
    paymentMethod: row.payment_method ?? undefined,
    pricing: row.order_details?.pricing ?? undefined
  };
}
