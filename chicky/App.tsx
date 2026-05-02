import React, { useState, useEffect, useMemo, useRef } from 'react';
import Navbar from './components/Navbar';
import MenuSection from './components/MenuSection';
import RecommendedSection from './components/RecommendedSection';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';

import AdminDashboard from './components/AdminDashboard';
import AdminAuthModal from './components/AdminAuthModal';
import Footer from './components/Footer';
import WhatsAppFloat from './components/WhatsAppFloat';
import HeroCarousel from './components/HeroCarousel';
import MobileBottomNav from './components/MobileBottomNav';
import { getStoredMenu, saveMenuToStorage, getStoredConfig, saveConfigToStorage } from './data/menuData';
import { Product, CartItem, Language, OrderDetails, SiteConfig, ServiceType, PromoCode } from './types';
import { supabase } from './lib/supabase';
// Added Search to the lucide-react imports
import { ArrowRight, Sparkles, Zap, Tag, Tag as TagIcon, X, Search, Flame } from 'lucide-react';

const App: React.FC = () => {
  const [menu, setMenu] = useState<Product[]>(getStoredMenu());
  const [config, setConfig] = useState<SiteConfig>(getStoredConfig());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>('delivery');
  const [promoCode, setPromoCode] = useState<PromoCode | null>(null);
  const [scheduledTime, setScheduledTime] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string>(config.layout[0]?.id || 'cat_deals');
  const [lang, setLang] = useState<Language>('ar'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);

  const isAr = lang === 'ar';




  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Menu Items
        const { data: menuData, error: menuError } = await supabase
          .from('menu_items')
          .select('*')
          .order('created_at', { ascending: true });
        
        if (!menuError && menuData) {
          setMenu(menuData);
        }

        // 2. Fetch Site Config
        const { data: configData, error: configError } = await supabase
          .from('site_settings')
          .select('config_data')
          .eq('id', 'active_config')
          .single();
        
        if (!configError && configData?.config_data) {
          setConfig(configData.config_data as SiteConfig);
        }
      } catch (err) {
        console.error('Initial fetch failed:', err);
      }
    };

    fetchData();

    // 3. Real-time Subscription for Site Settings
    const channel = supabase
      .channel('site_settings_changes')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'site_settings', filter: 'id=eq.active_config' }, 
        (payload) => {
          if (payload.new && payload.new.config_data) {
            setConfig(payload.new.config_data as SiteConfig);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update document properties when config or language changes
  useEffect(() => {
    document.documentElement.style.setProperty('--brand-red', config.theme.primaryColor);
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
    
    // Update Favicon dynamically
    const link: any = document.querySelector("link[rel*='icon']") || document.createElement('link');
    link.type = 'image/png';
    link.rel = 'shortcut icon';
    link.href = config.header.logoRed;
    if (!document.querySelector("link[rel*='icon']")) {
       document.getElementsByTagName('head')[0].appendChild(link);
    }
    
    // Update Title
    document.title = isAr ? 'تشيكي فرايد تشيكن | أقوى فرايد تشيكن' : 'Chicky Fried Chicken | Egypt\'s #1';
  }, [config.theme.primaryColor, isAr, config.header.logoRed]);



  const updateMenu = (newMenu: Product[]) => {
    setMenu(newMenu);
    saveMenuToStorage(newMenu);
  };

  const updateConfig = (newConfig: SiteConfig) => {
    setConfig(newConfig);
    saveConfigToStorage(newConfig);
  };

  const filteredMenu = useMemo(() => {
    let result = menu;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(q) || 
        item.nameAr.includes(q) ||
        item.tags?.some(tag => tag.toLowerCase().includes(q))
      );
    }
    if (activeTag) {
      const targetTag = activeTag.toLowerCase();
      result = result.filter(item => 
        item.tags?.some(t => t.toLowerCase() === targetTag) || 
        (targetTag === 'spicy' && item.isSpicy)
      );
    }
    return result;
  }, [searchQuery, menu, activeTag]);

  const recommendations = useMemo(() => {
    // If cart is empty, show Best Sellers
    if (cart.length === 0) {
      const bestSellers = menu.filter(p => p.tags?.some(t => t.toLowerCase().includes('best') || t.toLowerCase().includes('seller')));
      if (bestSellers.length > 0) return bestSellers.slice(0, 6);
      return menu.filter(p => p.category === 'deals' || p.category === 'cat_deals').slice(0, 4);
    }
    
    // Cross-sell logic
    const cartCategories = new Set(cart.map(item => item.category));
    const hasMainMeal = cartCategories.has('sandwiches') || cartCategories.has('cat_sandwiches') || 
                        cartCategories.has('family-meals') || cartCategories.has('cat_family') || 
                        cartCategories.has('deals') || cartCategories.has('cat_deals');
    
    if (hasMainMeal && !cartCategories.has('sides') && !cartCategories.has('cat_sides')) {
      return menu.filter(p => p.category === 'sides' || p.category === 'cat_sides').slice(0, 4);
    }
    
    return menu.filter(p => !cart.some(c => c.id === p.id)).slice(0, 4);
  }, [cart, menu]);

  const recommendationTitle = useMemo(() => {
    if (cart.length === 0) return isAr ? 'الأكثر طلباً' : 'MOST POPULAR';
    return isAr ? 'نقترح لك أيضاً' : 'YOU MIGHT ALSO LIKE';
  }, [cart, isAr]);

  const addToCart = (product: Product, spiciness?: 'Normal' | 'Spicy', size?: any, modifiers?: any[]) => {
    const modifierTotal = (modifiers || []).reduce((acc, m) => acc + m.price, 0);
    const basePrice = size ? size.price : product.price;
    const finalPrice = basePrice + modifierTotal;

    const cartBtn = document.getElementById('cart-btn');
    if (cartBtn) {
      cartBtn.classList.add('animate-bounce');
      setTimeout(() => cartBtn.classList.remove('animate-bounce'), 1000);
    }

    setCart(prev => {
      // Find matching item by ID, Spiciness, Size ID, and Modifiers (simplified comparison)
      const existing = prev.find(item => 
        item.id === product.id && 
        item.selectedSpiciness === spiciness && 
        item.selectedSize?.id === size?.id &&
        JSON.stringify(item.selectedModifiers || []) === JSON.stringify(modifiers || [])
      );

      if (existing) {
        return prev.map(item => 
          (item.id === product.id && 
           item.selectedSpiciness === spiciness && 
           item.selectedSize?.id === size?.id &&
           JSON.stringify(item.selectedModifiers || []) === JSON.stringify(modifiers || [])) 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      }
      return [...prev, { 
        ...product, 
        price: finalPrice, 
        quantity: 1, 
        selectedSpiciness: spiciness, 
        selectedSize: size, 
        selectedModifiers: modifiers 
      }];
    });
  };

  const updateQuantity = (id: string, delta: number, spiciness?: 'Normal' | 'Spicy', price?: number, sizeId?: string, modifiersJson?: string) => {
    setCart(prev => prev.map(item => {
      if (item.id === id && 
          item.selectedSpiciness === spiciness && 
          (price === undefined || item.price === price) &&
          (sizeId === undefined || item.selectedSize?.id === sizeId) &&
          (modifiersJson === undefined || JSON.stringify(item.selectedModifiers || []) === modifiersJson)) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string, spiciness?: 'Normal' | 'Spicy', price?: number) => {
    setCart(prev => prev.filter(item => !(item.id === id && item.selectedSpiciness === spiciness && (price === undefined || item.price === price))));
  };

  const handleConfirmOrder = (details: OrderDetails) => {
    console.log('Order processed visually.', details, cart);
  };

  const cartSubtotal = cart.reduce((s, i) => s + (i.price * i.quantity), 0);
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);

  const scrollToCategory = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      const offset = 180;
      const elementPosition = element.getBoundingClientRect().top + window.pageYOffset - offset;
      window.scrollTo({ top: elementPosition, behavior: 'smooth' });
      setActiveCategory(id);
    }
  };

  const handleTagToggle = (tagEn: string) => {
    if (!tagEn) setActiveTag(null);
    else setActiveTag(prev => prev === tagEn ? null : tagEn);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAdmin = () => {
    if (isAdminAuthenticated) {
      setIsAdminOpen(true);
    } else {
      setIsAdminAuthOpen(true);
    }
  };

  const handleAdminAuthenticated = () => {
    setIsAdminAuthenticated(true);
    setIsAdminAuthOpen(false);
    setIsAdminOpen(true);
  };

  return (
    <div className={`min-h-screen bg-mesh ${isAr ? 'font-arabic' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
      <Navbar lang={lang} onSetLang={setLang} onOpenCart={() => setIsCartOpen(true)} cartCount={cartCount} onSearchChange={setSearchQuery} logoSrc={config.header.logoRed} tags={config.tags} activeTag={activeTag} onTagToggle={handleTagToggle} filterLabelEn={config.filterLabelEn} filterLabelAr={config.filterLabelAr} />
      
      {!activeTag && !searchQuery && (
        <HeroCarousel banners={config.hero.banners} isAr={isAr} onCategoryClick={scrollToCategory} />
      )}

      {isMobileSearchOpen && (
        <div className="md:hidden sticky top-[140px] z-[45] px-4 py-4 animate-reveal glass border-b border-slate-100">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            <input
              autoFocus
              type="text"
              placeholder={isAr ? "عن ماذا تبحث؟" : "Search items..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-100 border-2 border-transparent rounded-[1.5rem] py-3 pl-12 pr-4 focus:bg-white focus:border-red-500 outline-none transition-all text-base font-bold text-slate-900"
            />
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-6 md:px-12 py-16 mb-24 md:mb-0">
        
        {/* ACTIVE FILTER HEADER */}
        {(activeTag || searchQuery) && (
          <div className="mb-12 animate-reveal flex flex-col items-center text-center">
            <div className="bg-red-50 p-6 rounded-[3rem] border-2 border-red-100 mb-6 flex items-center gap-6 shadow-xl shadow-red-100/50">
               <div className="w-16 h-16 bg-red-600 text-white rounded-[1.5rem] flex items-center justify-center shadow-xl">
                  {activeTag ? <TagIcon size={32} /> : <Zap size={32} />}
               </div>
               <div className={isAr ? 'text-right' : 'text-left'}>
                  <h2 className="text-3xl font-black brand-font text-slate-900 uppercase leading-none mb-2">
                    {isAr ? 'نتائج التصفية' : 'FILTERED RESULTS'}
                  </h2>
                  <p className="text-[10px] font-black text-red-600 uppercase tracking-[0.4em]">
                    {activeTag ? (isAr ? `وسم: ${config.tags.find(t => t.nameEn === activeTag)?.nameAr || activeTag}` : `TAG: ${activeTag}`) : (isAr ? `بحث عن: ${searchQuery}` : `SEARCHING: ${searchQuery}`)}
                  </p>
               </div>
               <button onClick={() => { setActiveTag(null); setSearchQuery(''); }} className="ml-4 p-4 bg-white text-slate-300 hover:text-red-600 rounded-full shadow-sm hover:shadow-md transition-all">
                 <X size={20} />
               </button>
            </div>
            <div className="w-16 h-1 bg-red-600 rounded-full opacity-20" />
          </div>
        )}

        {!activeTag && !searchQuery && (
          <RecommendedSection title={recommendationTitle} items={recommendations} onAddToCart={addToCart} lang={lang} />
        )}
        
        {config.layout.length > 0 && (
          <div className="sticky top-[73px] md:top-[88px] z-40 bg-white/90 glass -mx-6 px-6 py-5 md:-mx-12 md:px-12 border-b border-gray-100 mb-12 overflow-x-auto no-scrollbar shadow-sm">
            <div className="flex gap-4 min-w-max items-center">
              {config.layout.map(cat => {
                const hasItems = filteredMenu.some(p => p.category === cat.id);
                if (!hasItems) return null;
                return (
                  <button 
                    key={cat.id} 
                    onClick={() => scrollToCategory(cat.id)} 
                    className={`px-7 py-3 rounded-[1.25rem] text-[11px] md:text-xs font-black uppercase tracking-wider transition-all border-2 ${
                      activeCategory === cat.id 
                        ? 'bg-red-600 border-red-600 text-white shadow-xl scale-105' 
                        : 'bg-white border-gray-100 text-slate-500 hover:text-red-600 hover:border-red-100'
                    }`}
                  >
                    {isAr ? cat.nameAr : cat.nameEn}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {config.layout.map((cat) => {
          const catItems = filteredMenu.filter(p => p.category === cat.id);
          if (catItems.length === 0) return null;
          return <MenuSection key={cat.id} category={cat} items={catItems} onAddToCart={addToCart} lang={lang} tagsConfig={config.tags} />;
        })}
        
        {filteredMenu.length === 0 && (
          <div className="py-20 text-center animate-reveal">
             <div className="w-32 h-32 bg-slate-100 rounded-[3rem] flex items-center justify-center mx-auto mb-8 text-slate-300">
                <Search size={64} />
             </div>
             <h3 className="text-3xl font-black brand-font uppercase text-slate-900 mb-4">{isAr ? 'عذراً، لم نجد نتائج' : 'NO ITEMS FOUND'}</h3>
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{isAr ? 'جرب البحث عن شيء آخر أو تغيير الفلتر' : 'Try searching for something else or clearing the filters'}</p>
          </div>
        )}
      </main>

      <Footer config={config} lang={lang} onOpenAdmin={handleOpenAdmin} scrollToCategory={scrollToCategory} />
      <WhatsAppFloat phone={config.header.phone} lang={lang} />
      <MobileBottomNav 
        onOpenCart={() => setIsCartOpen(true)} 
        cartCount={cartCount} 
        lang={lang} 
        onHomeClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} 
        onSearchClick={() => setIsMobileSearchOpen(!isMobileSearchOpen)}
        onMenuClick={() => scrollToCategory(config.layout[0]?.id)}
      />

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} items={cart} onUpdateQuantity={updateQuantity} onRemove={removeFromCart} onCheckout={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }} lang={lang} />
      <CheckoutModal 
        isOpen={isCheckoutOpen} 
        onClose={() => setIsCheckoutOpen(false)} 
        subtotal={cartSubtotal} 
        onConfirm={handleConfirmOrder} 
        cartItems={cart} 
        onClearCart={() => setCart([])} 
        lang={lang} 
        serviceType={serviceType || 'delivery'}
        config={config}
      />

      <AdminAuthModal isOpen={isAdminAuthOpen} onClose={() => setIsAdminAuthOpen(false)} onAuthenticated={handleAdminAuthenticated} />
      <AdminDashboard isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} menu={menu} onUpdateMenu={updateMenu} config={config} onUpdateConfig={updateConfig} />
    </div>
  );
};

export default App;
