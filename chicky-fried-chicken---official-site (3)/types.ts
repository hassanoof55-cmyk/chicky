
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
  tags?: string[];
}

export interface CartItem extends Product {
  quantity: number;
  selectedSpiciness?: 'Normal' | 'Spicy';
}

export interface CategoryConfig {
  id: string;
  nameEn: string;
  nameAr: string;
}

export type Language = 'en' | 'ar';

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
}

export interface TagConfig {
  id: string;
  nameEn: string;
  nameAr: string;
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
  cloudConfig?: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    storageBucket: string;
    messagingSenderId: string;
    appId: string;
  };
}
