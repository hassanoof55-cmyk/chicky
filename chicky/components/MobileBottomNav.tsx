import React from 'react';
import { Home, Search, ShoppingCart, User, Menu } from 'lucide-react';
import { Language } from '../types';

interface MobileBottomNavProps {
  onOpenCart: () => void;
  cartCount: number;
  lang: Language;
  onHomeClick: () => void;
  onSearchClick: () => void;
  onMenuClick: () => void;
}

const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  onOpenCart,
  cartCount,
  lang,
  onHomeClick,
  onSearchClick,
  onMenuClick
}) => {
  const isAr = lang === 'ar';

  return (
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
          <span className="text-[9px] font-black uppercase mt-1 tracking-widest">{isAr ? 'القائمة' : 'Menu'}</span>
        </button>

        <button 
          className="flex flex-col items-center justify-center p-3 text-slate-400 hover:text-white transition-colors"
        >
          <User size={22} />
          <span className="text-[9px] font-black uppercase mt-1 tracking-widest">{isAr ? 'حسابي' : 'User'}</span>
        </button>
      </div>
    </div>
  );
};

export default MobileBottomNav;
