import type { CartItem } from '../types';

// The drawer passes the complete selection for both removal and quantity updates.
export function matchesCartLine(item: CartItem, id: string, spiciness?: 'Normal' | 'Spicy', price?: number, sizeId?: string, modifiersJson?: string) {
  return item.id === id && item.selectedSpiciness === spiciness &&
    (price === undefined || item.price === price) &&
    (sizeId === undefined || item.selectedSize?.id === sizeId) &&
    (modifiersJson === undefined || JSON.stringify(item.selectedModifiers || []) === modifiersJson);
}
