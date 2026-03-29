
import { Product, SiteConfig, CategoryConfig } from '../types';
import { initializeApp, getApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';

const INITIAL_MENU_DATA: Product[] = [
  {
    id: 'd1',
    name: 'Mega Deal 1',
    nameAr: 'ميجـا ديـل ١',
    price: 350,
    originalPrice: 480,
    category: 'cat_deals',
    description: '2 Sandwiches + 2 Pieces + Large Fries + Liter Cola',
    descriptionAr: '٢ ساندوتش + ٢ قطعة + بطاطس كبير + لتر كولا',
    image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&q=80&w=400',
    isSpicy: true,
    tags: ['Best Seller']
  },
  {
    id: 'd2',
    name: 'Super Dinner',
    nameAr: 'سوبر دينر',
    price: 280,
    originalPrice: 320,
    category: 'cat_deals',
    description: '3 Pieces + Fries + Coleslaw + Bun',
    descriptionAr: '٣ قطع + بطاطس + كول سلو + خبز',
    image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=400',
    tags: ['New']
  },
  {
    id: 's1',
    name: 'Chicken Burger',
    nameAr: 'تشيكن برجر',
    price: 100,
    category: 'cat_sandwiches',
    description: 'Fresh chicken breast with lettuce and mayo',
    descriptionAr: 'صدر دجاج طازج مع خس ومايونيز',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400',
    tags: ['Classic']
  },
  {
    id: 's2',
    name: 'Heavy Hummer',
    nameAr: 'هيفي هامر',
    price: 220,
    originalPrice: 250,
    category: 'cat_sandwiches',
    description: 'Double breast, triple cheese, special sauce',
    descriptionAr: 'صدر مضاعف، جبن ثلاثي، صوص خاص',
    image: 'https://images.unsplash.com/photo-1610440042657-612c34d95e9f?auto=format&fit=crop&q=80&w=400',
    isSpicy: true,
    tags: ['Heavy']
  }
];

export const INITIAL_SITE_CONFIG: SiteConfig = {
  hero: {
    banners: [
      {
        id: 'b1',
        titleEn: 'CRAVE THE CRUNCH!',
        titleAr: 'اعشق القرمشة!',
        subtitleEn: 'Freshly breaded. Daily prepared. Unbeatable taste. Delivered to your door.',
        subtitleAr: 'دجاج طازج. محضر يومياً. مذاق لا يقاوم. يصلك إلى باب منزلك.',
        image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=800',
        offerPrice: 150,
        originalPrice: 220,
        offerLabelEn: 'Dinner Box',
        offerLabelAr: 'بوكس العشاء',
        ctaTextEn: 'Order the Deal',
        ctaTextAr: 'اطلب العرض الآن',
        promoTagEn: 'Limited Time Offer',
        promoTagAr: 'عرض لفترة محدودة'
      }
    ]
  },
  header: {
    logoRed: 'https://raw.githubusercontent.com/ai-studio-assets/chicky-logo/main/logo-red.png',
    logoWhite: 'https://raw.githubusercontent.com/ai-studio-assets/chicky-logo/main/logo-white.png',
    phone: '01220062060'
  },
  footer: {
    aboutEn: "Egypt's favorite homegrown fried chicken. Perfect crunch, delivered to your location.",
    aboutAr: "دجاج شيكي المفضل في مصر. قرمشة مثالية تصلك أينما كنت.",
    facebook: 'https://facebook.com/chicky',
    instagram: 'https://instagram.com/chicky',
    tiktok: 'https://tiktok.com/@chicky',
    locationUrl: 'https://maps.app.goo.gl/F85HrsUKkaDWy2Ey8',
    addressEn: 'Palm Beach, St 14 corner 29, El Agamy El Bahria, Egypt, 21644',
    addressAr: 'شاطئ النخيل شارع ١٤ مع ٢٩، العجمي البحرية، الإسكندرية 21644',
    copyrightEn: 'Chicky Fried Chicken Egypt. All Rights Reserved.',
    copyrightAr: 'شيكي فرايد تشيكن مصر. جميع الحقوق محفوظة.'
  },
  layout: [
    { id: 'cat_deals', nameEn: 'Deals', nameAr: 'العروض' },
    { id: 'cat_sandwiches', nameEn: 'Sandwiches', nameAr: 'سندوتشات' },
    { id: 'cat_family', nameEn: 'Family Meals', nameAr: 'وجبات عائلية' },
    { id: 'cat_sides', nameEn: 'Side Items', nameAr: 'أصناف جانبية' },
    { id: 'cat_kids', nameEn: 'Happy Meal', nameAr: 'وجبات أطفال' }
  ],
  filterLabelEn: 'Filter By',
  filterLabelAr: 'تصفية حسب',
  tags: [
    { id: 't1', nameEn: 'Best Seller', nameAr: 'الأكثر مبيعاً' },
    { id: 't2', nameEn: 'New', nameAr: 'جديد' },
    { id: 't3', nameEn: 'Spicy', nameAr: 'حار' },
    { id: 't4', nameEn: 'Vegetarian', nameAr: 'نباتي' }
  ],
  areas: [
    { 
      id: 'a1', 
      nameEn: 'Palm Beach (Al Nakhil)', 
      nameAr: 'شاطئ النخيل', 
      fee: 20,
      points: [[29.87, 31.02], [29.89, 31.02], [29.89, 31.05], [29.87, 31.05]] 
    }
  ],
  theme: {
    primaryColor: '#E4002B'
  }
};

const getFirebaseApp = (config: any) => {
  if (getApps().length) return getApp();
  return initializeApp(config);
};

export const getStoredMenu = (): Product[] => {
  const stored = localStorage.getItem('chicky_menu');
  if (stored) return JSON.parse(stored);
  return INITIAL_MENU_DATA;
};

export const getStoredConfig = (): SiteConfig => {
  const stored = localStorage.getItem('chicky_config');
  if (stored) return JSON.parse(stored);
  return INITIAL_SITE_CONFIG;
};

export const saveMenuToStorage = async (menu: Product[]) => {
  localStorage.setItem('chicky_menu', JSON.stringify(menu));
  const config = getStoredConfig();
  if (config.cloudConfig?.projectId) {
    try {
      const db = getFirestore(getFirebaseApp(config.cloudConfig));
      await setDoc(doc(db, 'site_data', 'menu'), { items: menu });
    } catch (e) { console.error('Cloud save failed', e); }
  }
};

export const saveConfigToStorage = async (config: SiteConfig) => {
  localStorage.setItem('chicky_config', JSON.stringify(config));
  if (config.cloudConfig?.projectId) {
    try {
      const db = getFirestore(getFirebaseApp(config.cloudConfig));
      await setDoc(doc(db, 'site_data', 'config'), config);
    } catch (e) { console.error('Cloud save failed', e); }
  }
};

export const subscribeToCloudChanges = (onMenuUpdate: (m: Product[]) => void, onConfigUpdate: (c: SiteConfig) => void) => {
  const config = getStoredConfig();
  if (!config.cloudConfig?.projectId) return () => {};

  const db = getFirestore(getFirebaseApp(config.cloudConfig));
  
  const unsubMenu = onSnapshot(doc(db, 'site_data', 'menu'), (snap) => {
    if (snap.exists()) {
      const data = snap.data().items;
      localStorage.setItem('chicky_menu', JSON.stringify(data));
      onMenuUpdate(data);
    }
  });

  const unsubConfig = onSnapshot(doc(db, 'site_data', 'config'), (snap) => {
    if (snap.exists()) {
      const data = snap.data() as SiteConfig;
      localStorage.setItem('chicky_config', JSON.stringify(data));
      onConfigUpdate(data);
    }
  });

  return () => { unsubMenu(); unsubConfig(); };
};
