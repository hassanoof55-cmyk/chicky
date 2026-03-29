
import { Product, SiteConfig, Area } from '../types';


export const INITIAL_MENU_DATA: Product[] = [
    {
        id: 'm1',
        name: 'Mega Deal 1',
        nameAr: 'ميجـا ديـل ١',
        price: 350,
        originalPrice: 480,
        category: 'deals',
        description: '2 Sandwiches + 2 Pieces + Large Fries + Liter Cola',
        descriptionAr: '٢ ساندوتش + ٢ قطعة + بطاطس كبير + لتر كولا',
        image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?auto=format&fit=crop&q=80&w=400',
        isSpicy: true,
        tags: ['Best Seller', 'Spicy']
    },
    {
        id: 'm2',
        name: 'Super Dinner',
        nameAr: 'سوبر دينر',
        price: 280,
        originalPrice: 320,
        category: 'deals',
        description: '3 Pieces + Fries + Coleslaw + Bun',
        descriptionAr: '٣ قطع + بطاطس + كول سلو + خبز',
        image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=400',
        tags: ['New']
    },
    {
        id: 'm3',
        name: 'Chicken Burger',
        nameAr: 'تشيكن برجر',
        price: 100,
        category: 'sandwiches',
        description: 'Fresh chicken breast with lettuce and mayo',
        descriptionAr: 'صدر دجاج طازج مع خس ومايونيز',
        image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=400',
        tags: ['Classic']
    },
    {
        id: 'm4',
        name: 'Heavy Hummer',
        nameAr: 'هيفي هامر',
        price: 220,
        originalPrice: 250,
        category: 'sandwiches',
        description: 'Double breast, triple cheese, special sauce',
        descriptionAr: 'صدر مضاعف، جبن ثلاثي، صوص خاص',
        image: 'https://images.unsplash.com/photo-1610440042657-612c34d95e9f?auto=format&fit=crop&q=80&w=400',
        isSpicy: true,
        tags: ['Spicy', 'Heavy']
    }
];

export const INITIAL_SITE_CONFIG: SiteConfig = {
    hero: {
        banners: [
            {
                id: 'b1',
                titleEn: 'CRAVE THE CRUNCH!',
                titleAr: 'اعشق القرمشة!',
                subtitleEn: 'Dinner Box',
                subtitleAr: 'بوكس العشاء',
                image: 'https://images.unsplash.com/photo-1626082927389-6cd097cdc6ec?auto=format&fit=crop&q=80&w=800',
                offerPrice: 150,
                originalPrice: 220,
                promoTagEn: 'Limited Time Offer',
                promoTagAr: 'عرض لفترة محدودة',
                offerLabelEn: 'ORDER THE DEAL',
                offerLabelAr: 'اطلب الآن'
            }
        ]
    },
    header: {
        logoRed: 'https://raw.githubusercontent.com/ai-studio-assets/chicky-logo/main/logo-red.png',
        logoWhite: 'https://raw.githubusercontent.com/ai-studio-assets/chicky-logo/main/logo-white.png',
        phone: '01220062060'
    },
    footer: {
        aboutEn: 'The best fried chicken in Egypt.',
        aboutAr: 'أقوى فرايد تشيكن في مصر.',
        facebook: 'https://facebook.com/chicky',
        instagram: 'https://instagram.com/chicky',
        tiktok: 'https://tiktok.com/@chicky',
        locationUrl: 'https://goo.gl/maps/example',
        addressEn: 'Palm Beach, St 14 corner 29, El Agamy El Bahria, Egypt',
        addressAr: 'شاطئ النخيل شارع ١٤ مع ٢٩، العجمي البحرية، الإسكندرية',
        copyrightEn: '© 2024 Hassan Mohamed',
        copyrightAr: '© ٢٠٢٤ حسن محمد'
    },
    layout: [
        { id: 'deals', nameEn: 'Deals', nameAr: 'العروض' },
        { id: 'sandwiches', nameEn: 'Sandwiches', nameAr: 'سندوتشات' },
        { id: 'family-meals', nameEn: 'Family Meals', nameAr: 'وجبات عائلية' },
        { id: 'sides', nameEn: 'Side Items', nameAr: 'أصناف جانبية' },
        { id: 'kids', nameEn: 'Happy Meal', nameAr: 'وجبات أطفال' }
    ],
    tags: [
        { id: 't1', nameEn: 'Best Seller', nameAr: 'الأكثر مبيعاً' },
        { id: 't2', nameEn: 'New', nameAr: 'جديد' },
        { id: 't3', nameEn: 'Spicy', nameAr: 'حار' },
        { id: 't4', nameEn: 'Vegetarian', nameAr: 'نباتي' },
        { id: 't5', nameEn: 'Classic', nameAr: 'كلاسيك' },
        { id: 't6', nameEn: 'Heavy', nameAr: 'هيفي' }
    ],
    areas: [],
    theme: { primaryColor: '#E4002B' },
    branchStatus: 'open'
};

export const getStoredMenu = (): Product[] => {
    const stored = localStorage.getItem('chicky_menu');
    const parsed = stored ? JSON.parse(stored) : null;
    return (parsed && Array.isArray(parsed) && parsed.length > 0) ? parsed : INITIAL_MENU_DATA;
};

export const getStoredConfig = (): SiteConfig => {
    const stored = localStorage.getItem('chicky_config');
    const parsed = stored ? JSON.parse(stored) : null;
    return (parsed && parsed.hero && parsed.hero.banners && parsed.hero.banners.length > 0) ? parsed : INITIAL_SITE_CONFIG;
};

export const saveMenuToStorage = async (menu: Product[]) => {
    localStorage.setItem('chicky_menu', JSON.stringify(menu));
    // In Supabase, we usually handle individual row updates in the Admin component,
    // but for compatibility with existing code that sends the whole array:
    // (Assuming a 'menu_items' table where each product is a row)
    // This function might be better handled in AdminDashboard now.
};

export const saveConfigToStorage = async (config: SiteConfig) => {
    localStorage.setItem('chicky_config', JSON.stringify(config));
    // Similarly, site_builder updates will be handled in AdminDashboard.
};


