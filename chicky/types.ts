
export interface ProductSize {
  id: string;
  nameEn: string;
  nameAr: string;
  price: number;
}

export interface Modifier {
  id: string;
  nameEn: string;
  nameAr: string;
  price: number;
}

export interface Product {
  id: string;
  name: string;
  nameAr: string;
  price: number;
  originalPrice?: number;
  description: string;
  descriptionAr: string;
  image: string;
  category: string;
  isSpicy?: boolean;
  spicinessOption?: boolean;
  hasSizes?: boolean;
  sizes?: ProductSize[];
  tags?: string[];
  modifiers?: Modifier[];
}

export interface CartItem extends Product {
  quantity: number;
  selectedSpiciness?: 'Normal' | 'Spicy';
  selectedSize?: ProductSize;
  selectedModifiers?: Modifier[];
}

export interface CategoryConfig {
  id: string;
  nameEn: string;
  nameAr: string;
}

export type Language = 'en' | 'ar';
export type ServiceType = 'delivery' | 'pickup' | 'dine-in';

export interface Area {
  id: string;
  nameEn: string;
  nameAr: string;
  fee: number;
  points?: [number, number][];
}

export interface LocationData {
  lat: number;
  lng: number;
  address: string;
  deliveryFee: number;
  areaId?: string;
}

export interface OrderDetails {
  name: string;
  phone: string;
  address: string;
  branch: string;
  location?: LocationData;
  serviceType: ServiceType;
  scheduledTime?: string;
  promoCode?: string;
  discount?: number;
}

export interface HeroBanner {
  id: string;
  titleEn: string;
  titleAr: string;
  subtitleEn: string;
  subtitleAr: string;
  image: string;
  offerPrice: number;
  originalPrice?: number;
  offerLabelEn: string;
  offerLabelAr: string;
  ctaTextEn?: string;
  ctaTextAr?: string;
  promoTagEn?: string;
  promoTagAr?: string;
  targetCategoryId?: string;
}

export interface TagConfig {
  id: string;
  nameEn: string;
  nameAr: string;
}

export interface PromoCode {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
}

export interface UserProfile {
  id: string;
  phone: string;
  name?: string;
  savedAddresses?: LocationData[];
  points: number;
}

export interface SiteConfig {
  hero: {
    banners: HeroBanner[];
  };
  header: {
    logoRed: string;
    logoWhite: string;
    phone: string;
  };
  footer: {
    aboutEn: string;
    aboutAr: string;
    facebook: string;
    instagram: string;
    tiktok: string;
    locationUrl: string;
    addressEn: string;
    addressAr: string;
    copyrightEn: string;
    copyrightAr: string;
  };
  layout: CategoryConfig[];
  tags: TagConfig[];
  filterLabelEn?: string;
  filterLabelAr?: string;
  areas: Area[];
  theme: {
    primaryColor: string;
  };
  branchStatus?: 'open' | 'closed';
}

export interface StoredOrder {
  id: string;
  customerName: string;
  phone: string;
  address: string;
  area: string;
  location: { lat: number; lng: number };
  items: CartItem[];
  totalPrice: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: string;
  serviceType: ServiceType;
  scheduledTime?: string;
}
