import React, { useState } from 'react';
import { Home, Search, ShoppingCart, LayoutGrid, Menu, X, ChevronRight } from 'lucide-react';
import { Language, CategoryConfig } from '../types';

interface MobileBottomNavProps {
  onOpenCart: () => void;
  cartCount: number;
  lang: Language;
  onHomeClick: () => void;
  onSearchClick: () => void;
  onMenuClick: () => void;
  categories: CategoryConfig[];
  onCategoryClick: (id: string) => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenCart,
  cartCount,
  lang,
  onHomeClick,
  onSearchClick,
  onMenuClick,
  categories,
  onCategoryClick
}) => {
  const [isCatsOpen, setIsCatsOpen] = useState(false);
  const isAr = lang === 'ar';

  const handleCatClick = (id: string) => {
    onCategoryClick(id);
    setIsCatsOpen(false);
  };

  return (
    <>
      {/* Category Selection Popup */}
      {isCatsOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex items-end justify-center px-4 pb-24">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsCatsOpen(false)} />
          <div className="relative bg-white w-full rounded-[2.5rem] p-6 shadow-2xl animate-slide-up border-4 border-slate-900/5 overflow-hidden">
            <div className="flex items-center justify-between mb-6 px-2">
               <div>
                 <h3 className="text-xl font-black brand-font text-slate-900 uppercase leading-none">{isAr ? 'الأقسام' : 'CATEGORIES'}</h3>
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{isAr ? 'اختر القسم المفضل' : 'PICK YOUR FAVORITE'}</p>
               </div>
               <button onClick={() => setIsCatsOpen(false)} className="p-3 bg-slate-100 text-slate-400 rounded-2xl">
                 <X size={20} />
               </button>
            </div>
            
            <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto no-scrollbar pb-4">
              {categories?.map(cat => (
                <button 
                  key={cat.id}
                  onClick={() => handleCatClick(cat.id)}
                  className="flex items-center justify-between p-4 bg-slate-50 hover:bg-red-50 rounded-2xl group transition-all"
                >
                  <span className="font-black text-slate-900 text-sm uppercase group-hover:text-red-600 transition-colors">
                    {isAr ? cat.nameAr : cat.nameEn}
                  </span>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-red-600 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 px-4 pb-6 pt-2 pointer-events-none">
        <div className="glass bg-slate-950/90 border-white/10 rounded-[2rem] shadow-2xl flex items-center justify-around p-2 pointer-events-auto">
          <button 
            onClick={onHomeClick}
            className="flex flex-col items-center justify-center p-3 text-slate-400 hover:text-white transition-colors"
          >
            <Home size={22} />
            <span className="text-[9px] font-black uppercase mt-1 tracking-widest">{isAr ? 'الرئيسية' : 'Home'}</span>
          </button>

          <button 
            onClick={onSearchClick}
            className="flex flex-col items-center justify-center p-3 text-slate-400 hover:text-white transition-colors"
          >
            <Search size={22} />
            <span className="text-[9px] font-black uppercase mt-1 tracking-widest">{isAr ? 'بحث' : 'Search'}</span>
          </button>

          <button 
            onClick={onOpenCart}
            className="relative flex flex-col items-center justify-center p-3 bg-red-600 text-white rounded-[1.5rem] shadow-xl shadow-red-900/40 -translate-y-4 scale-125 transition-transform"
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-black text-white text-[9px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-slate-950 animate-pop">
                {cartCount}
              </span>
            )}
          </button>

          <button 
            onClick={onMenuClick}
            className="flex flex-col items-center justify-center p-3 text-slate-400 hover:text-white transition-colors"
          >
            <Menu size={22} />
            <span className="text-[9px] font-black uppercase mt-1 tracking-widest">{isAr ? 'المنيو' : 'Menu'}</span>
          </button>

          <button 
            onClick={() => setIsCatsOpen(!isCatsOpen)}
            className={`flex flex-col items-center justify-center p-3 transition-colors ${isCatsOpen ? 'text-red-500' : 'text-slate-400 hover:text-white'}`}
          >
            <LayoutGrid size={22} />
            <span className="text-[9px] font-black uppercase mt-1 tracking-widest">{isAr ? 'الأقسام' : 'Cats'}</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default MobileBottomNav;
