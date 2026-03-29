
import React, { useState, useEffect, useMemo } from 'react';
import Navbar from './components/Navbar';
import MenuSection from './components/MenuSection';
import RecommendedSection from './components/RecommendedSection';
import CartDrawer from './components/CartDrawer';
import CheckoutModal from './components/CheckoutModal';
import LoginModal from './components/LoginModal';
import AdminDashboard from './components/AdminDashboard';
import AdminAuthModal from './components/AdminAuthModal';
import Footer from './components/Footer';
import WhatsAppFloat from './components/WhatsAppFloat';
import { getStoredMenu, saveMenuToStorage, getStoredConfig, saveConfigToStorage, subscribeToCloudChanges } from './data/menuData';
import { Product, CartItem, Language, OrderDetails, SiteConfig } from './types';
// Added Search to the lucide-react imports
import { ArrowRight, Sparkles, Zap, Tag, Tag as TagIcon, X, Search } from 'lucide-react';

const App: React.FC = () => {
  const [menu, setMenu] = useState<Product[]>(getStoredMenu());
  const [config, setConfig] = useState<SiteConfig>(getStoredConfig());
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [isAdminAuthOpen, setIsAdminAuthOpen] = useState(false);
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(config.layout[0]?.id || 'cat_deals');
  const [lang, setLang] = useState<Language>('ar'); 
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [currentBannerIdx, setCurrentBannerIdx] = useState(0);

  const isAr = lang === 'ar';

  useEffect(() => {
    const unsub = subscribeToCloudChanges(
      (newMenu) => setMenu(newMenu),
      (newConfig) => setConfig(newConfig)
    );
    return () => unsub();
  }, [config.cloudConfig?.projectId]);

  useEffect(() => {
    if (config.hero.banners.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentBannerIdx(prev => (prev + 1) % config.hero.banners.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [config.hero.banners.length]);

  useEffect(() => {
    document.documentElement.style.setProperty('--brand-red', config.theme.primaryColor);
    document.documentElement.dir = isAr ? 'rtl' : 'ltr';
  }, [config.theme.primaryColor, isAr]);

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
      result = result.filter(item => 
        item.tags?.includes(activeTag) || (activeTag === 'Spicy' && item.isSpicy)
      );
    }
    return result;
  }, [searchQuery, menu, activeTag]);

  const recommendations = useMemo(() => {
    if (cart.length === 0) return menu.filter(p => p.category === 'cat_deals').slice(0, 4);
    const cartCategories = new Set(cart.map(item => item.category));
    const hasMainMeal = cartCategories.has('cat_sandwiches') || cartCategories.has('cat_family') || cartCategories.has('cat_deals');
    if (hasMainMeal && !cartCategories.has('cat_sides')) {
      return menu.filter(p => p.category === 'cat_sides').slice(0, 4);
    }
    return menu.filter(p => !cart.some(c => c.id === p.id)).slice(0, 4);
  }, [cart, menu]);

  const recommendationTitle = useMemo(() => {
    if (cart.length === 0) return isAr ? 'الأكثر طلباً' : 'TRENDING NOW';
    return isAr ? 'قد يعجبك أيضاً' : 'YOU MIGHT ALSO LIKE';
  }, [cart, isAr]);

  const addToCart = (product: Product, spiciness?: 'Normal' | 'Spicy') => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id && item.selectedSpiciness === spiciness);
      if (existing) {
        return prev.map(item => 
          (item.id === product.id && item.selectedSpiciness === spiciness) 
          ? { ...item, quantity: item.quantity + 1 } 
          : item
        );
      }
      return [...prev, { ...product, quantity: 1, selectedSpiciness: spiciness }];
    });
  };

  const updateQuantity = (id: string, delta: number, spiciness?: 'Normal' | 'Spicy') => {
    setCart(prev => prev.map(item => {
      if (item.id === id && item.selectedSpiciness === spiciness) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string, spiciness?: 'Normal' | 'Spicy') => {
    setCart(prev => prev.filter(item => !(item.id === id && item.selectedSpiciness === spiciness)));
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

  const activeBanner = config.hero.banners[currentBannerIdx] || config.hero.banners[0];

  return (
    <div className={`min-h-screen ${isAr ? 'font-arabic' : ''}`} dir={isAr ? 'rtl' : 'ltr'}>
      <Navbar lang={lang} onSetLang={setLang} onOpenCart={() => setIsCartOpen(true)} onOpenLogin={() => setIsLoginOpen(true)} cartCount={cartCount} onSearchChange={setSearchQuery} logoSrc={config.header.logoRed} tags={config.tags} activeTag={activeTag} onTagToggle={handleTagToggle} filterLabelEn={config.filterLabelEn} filterLabelAr={config.filterLabelAr} />
      
      {!activeTag && !searchQuery && (
        <section className="relative h-[85vh] md:h-[95vh] overflow-hidden bg-slate-950 flex items-center">
          <div className="absolute inset-0 z-0">
            <div className={`absolute inset-0 bg-gradient-to-${isAr ? 'l' : 'r'} from-slate-950 via-slate-950/40 to-transparent z-10`} />
            <div className="absolute inset-0 opacity-20 bg-stripes animate-pulse" style={{ backgroundColor: config.theme.primaryColor }} />
          </div>
          {activeBanner && (
            <div key={activeBanner.id} className="container mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-2 gap-12 items-center relative z-20 h-full">
              <div className={`space-y-10 text-center ${isAr ? 'md:text-right' : 'md:text-left'} animate-reveal`}>
                <div className="space-y-6">
                   {(activeBanner.promoTagEn || activeBanner.promoTagAr) && (
                     <div className={`w-fit mx-auto ${isAr ? 'md:mr-0 md:ml-auto' : 'md:ml-0 md:mr-auto'} flex items-center gap-3 bg-white text-slate-900 px-6 py-2.5 rounded-full text-[11px] font-black uppercase tracking-[0.3em] shadow-2xl border-4 border-slate-950 animate-bounce`}>
                       <Sparkles size={14} className="text-yellow-500" fill="currentColor" />
                       {isAr ? activeBanner.promoTagAr : activeBanner.promoTagEn}
                     </div>
                   )}
                   <h1 className={`text-6xl sm:text-8xl md:text-[140px] font-black ${isAr ? 'font-arabic leading-[1.2]' : 'brand-font leading-[0.75]'} tracking-tight text-white uppercase`}>
                     {isAr ? activeBanner.titleAr : activeBanner.titleEn}
                   </h1>
                   
                   <div className="flex flex-col gap-4">
                      <p className="text-xl md:text-3xl font-medium text-slate-300 max-w-2xl mx-auto md:mx-0 leading-tight">
                        {isAr ? activeBanner.offerLabelAr : activeBanner.offerLabelEn}
                      </p>
                      <div className="flex items-center gap-6 justify-center md:justify-start">
                         <span className="text-5xl md:text-7xl font-black text-red-600 drop-shadow-2xl">
                            {activeBanner.offerPrice} <span className="text-2xl opacity-80 uppercase">{isAr ? 'ج.م' : 'LE'}</span>
                         </span>
                         {activeBanner.originalPrice && activeBanner.originalPrice > activeBanner.offerPrice && (
                            <div className="flex flex-col items-start leading-none">
                               <span className="text-slate-400 text-sm font-black uppercase tracking-widest mb-1">{isAr ? 'بدلاً من' : 'Instead of'}</span>
                               <span className="text-slate-500 text-3xl font-black line-through">{activeBanner.originalPrice}</span>
                            </div>
                         )}
                      </div>
                   </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-10 pt-4 justify-center md:justify-start">
                   <button onClick={() => scrollToCategory(config.layout[0]?.id || '')} className="group relative bg-red-600 text-white font-black px-12 py-6 rounded-[2rem] shadow-2xl hover:-translate-y-2 active:scale-95 transition-all text-xl tracking-widest uppercase">
                     <span className="relative z-10 flex items-center gap-4">{isAr ? 'اطلب الآن' : 'ORDER THE DEAL'} <ArrowRight size={28} className={isAr ? 'rotate-180' : ''} /></span>
                   </button>
                </div>
              </div>
              <div className="relative flex items-center justify-center h-full">
                 <img src={activeBanner.image} className="relative w-full max-w-2xl object-contain drop-shadow-[0_60px_100px_rgba(0,0,0,0.9)] animate-float" />
              </div>
            </div>
          )}
        </section>
      )}

      <main className="max-w-7xl mx-auto px-6 md:px-12 py-16">
        
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
        
        {!activeTag && !searchQuery && (
          <div className="sticky top-[73px] md:top-[88px] z-40 bg-white/90 glass -mx-6 px-6 py-5 md:-mx-12 md:px-12 border-b border-gray-100 mb-12 overflow-x-auto no-scrollbar shadow-sm">
            <div className="flex gap-4 min-w-max items-center">
              {config.layout.map(cat => (
                <button key={cat.id} onClick={() => scrollToCategory(cat.id)} className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border-2 ${activeCategory === cat.id ? 'bg-red-600 border-red-600 text-white shadow-xl scale-105' : 'bg-white border-slate-100 text-slate-500 hover:text-red-600'}`}>
                  {isAr ? cat.nameAr : cat.nameEn}
                </button>
              ))}
            </div>
          </div>
        )}

        {config.layout.map((cat) => {
          const catItems = filteredMenu.filter(p => p.category === cat.id);
          if (catItems.length === 0) return null;
          return <MenuSection key={cat.id} category={cat} items={catItems} onAddToCart={addToCart} lang={lang} />;
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

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} items={cart} onUpdateQuantity={updateQuantity} onRemove={removeFromCart} onCheckout={() => { setIsCartOpen(false); setIsCheckoutOpen(true); }} lang={lang} />
      <CheckoutModal isOpen={isCheckoutOpen} onClose={() => setIsCheckoutOpen(false)} subtotal={cartSubtotal} onConfirm={handleConfirmOrder} cartItems={cart} onClearCart={() => setCart([])} lang={lang} />
      <LoginModal isOpen={isLoginOpen} onClose={() => setIsLoginOpen(false)} lang={lang} />
      <AdminAuthModal isOpen={isAdminAuthOpen} onClose={() => setIsAdminAuthOpen(false)} onAuthenticated={handleAdminAuthenticated} />
      <AdminDashboard isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)} menu={menu} onUpdateMenu={updateMenu} config={config} onUpdateConfig={updateConfig} />
    </div>
  );
};

export default App;
