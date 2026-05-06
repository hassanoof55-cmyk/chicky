
import React from 'react';
import { ShoppingCart, Menu, Search, Globe, Flame, Star, Zap, Leaf, Award } from 'lucide-react';
import { Language, TagConfig } from '../types';
import Logo from './Logo';

interface NavbarProps {
  onOpenCart: () => void;
  cartCount: number;
  lang: Language;
  onSetLang: (lang: Language) => void;
  onSearchChange: (q: string) => void;
  logoSrc: string;
  tags: TagConfig[];
  activeTag: string | null;
  onTagToggle: (tagEn: string) => void;
  filterLabelEn?: string;
  filterLabelAr?: string;
  // Sticky Nav Props
  showSticky?: boolean;
  categories?: { id: string, nameEn: string, nameAr: string }[];
  activeCategory?: string;
  onCategoryClick?: (id: string) => void;
  hasItemsInCategory?: (catId: string) => boolean;
}

const getTagIcon = (tagEn: string) => {
  const t = tagEn.toLowerCase();
  if (t.includes('spicy') || t.includes('hot')) return <Flame size={14} className="text-orange-500" />;
  if (t.includes('best') || t.includes('seller')) return <Star size={14} className="text-yellow-500" />;
  if (t.includes('new')) return <Zap size={14} className="text-blue-500" />;
  if (t.includes('veg')) return <Leaf size={14} className="text-green-500" />;
  return <Award size={14} className="text-red-500" />;
};

const Navbar: React.FC<NavbarProps> = ({
  onOpenCart, cartCount, lang, onSetLang, onSearchChange, logoSrc,
  tags, activeTag, onTagToggle, filterLabelEn, filterLabelAr,
  showSticky, categories, activeCategory, onCategoryClick, hasItemsInCategory
}) => {
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  return (
    <nav className={`sticky top-0 z-50 glass border-b border-white/20 shadow-lg shadow-slate-200/50 ${showSticky ? 'animate-slide-down' : ''}`}>
      {/* Main Nav Row - Hidden when sticky to only show categories */}
      {!showSticky && (
        <div className="px-4 py-3 md:px-8 max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div
            className="flex items-center cursor-pointer hover:scale-105 transition-transform"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <Logo src={logoSrc} className="h-10 md:h-12" />
          </div>

          {/* Desktop Search */}
          <div className="hidden md:flex flex-1 max-w-lg mx-4">
            <div className="relative w-full group">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder={lang === 'en' ? "What are you craving?" : "بماذا تشعر بالجوع؟"}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full bg-slate-100/50 border-2 border-transparent rounded-2xl py-2.5 pl-11 pr-4 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-500/10 outline-none transition-all text-sm font-bold text-slate-900 placeholder:text-slate-400"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Mobile Search Toggle */}
            <button
              onClick={() => setIsSearchOpen(!isSearchOpen)}
              className="md:hidden p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              <Search size={22} />
            </button>

            <button
              onClick={() => onSetLang(lang === 'en' ? 'ar' : 'en')}
              className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:text-red-600 font-black text-[10px] uppercase transition-all tracking-widest shrink-0 bg-slate-100 md:bg-transparent rounded-xl"
            >
              <Globe size={16} />
              <span>{lang === 'en' ? 'AR' : 'EN'}</span>
            </button>

            <button
              id="cart-btn"
              onClick={onOpenCart}
              className="group relative p-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-200 hover:scale-105 active:scale-95 shrink-0"
            >
              <ShoppingCart size={20} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-black text-white text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full border-2 border-white animate-pop">
                  {cartCount}
                </span>
              )}
            </button>

            <button className="md:hidden text-slate-600 p-2.5 hover:bg-slate-100 rounded-xl transition-colors">
              <Menu size={22} />
            </button>
          </div>
        </div>
      )}

      {/* Mobile Search Expandable */}
      {isSearchOpen && (
        <div className="md:hidden px-4 pb-4 animate-reveal">
          <div className="relative w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              autoFocus
              type="text"
              placeholder={lang === 'en' ? "Search..." : "بحث..."}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-slate-100 border-2 border-transparent rounded-2xl py-3 pl-11 pr-4 focus:bg-white focus:border-red-500 outline-none transition-all text-base font-bold text-slate-900"
            />
          </div>
        </div>
      )}

      {/* Dynamic Bottom Row: Tags or Categories */}
      <div className="bg-white/50 border-t border-slate-100 px-4 py-3 overflow-x-auto no-scrollbar mask-edge">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          {!showSticky ? (
            <>
              <div className="flex items-center gap-2 px-3 border-e border-slate-200 shrink-0">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">
                  {lang === 'en' ? (filterLabelEn || 'Filters') : (filterLabelAr || 'تصفية')}
                </span>
              </div>
              <div className="flex items-center gap-2 min-w-max">
                {tags?.map(tag => (
                  <button
                    key={tag.id}
                    onClick={() => onTagToggle(tag.nameEn)}
                    className={`flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black transition-all whitespace-nowrap border-2 ${activeTag === tag.nameEn
                      ? 'bg-red-600 border-red-600 text-white shadow-lg shadow-red-100 scale-105'
                      : 'bg-white border-slate-100 text-slate-500 hover:border-red-100 hover:text-red-600'
                      }`}
                  >
                    {getTagIcon(tag.nameEn)}
                    {lang === 'en' ? tag.nameEn : tag.nameAr}
                  </button>
                ))}
                {activeTag && (
                  <button
                    onClick={() => onTagToggle('')}
                    className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:underline px-3 shrink-0"
                  >
                    {lang === 'en' ? 'Clear' : 'مسح'}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex gap-3 min-w-max items-center">
              {categories?.map(cat => {
                const hasItems = hasItemsInCategory ? hasItemsInCategory(cat.id) : true;
                if (!hasItems) return null;
                return (
                  <button 
                    key={cat.id} 
                    onClick={() => onCategoryClick?.(cat.id)} 
                    className={`px-6 py-2 rounded-xl text-[10px] md:text-xs font-black uppercase tracking-wider transition-all border-2 ${
                      activeCategory === cat.id 
                        ? 'bg-red-600 border-red-600 text-white shadow-xl scale-105' 
                        : 'bg-white border-gray-100 text-slate-500 hover:text-red-600 hover:border-red-100'
                    }`}
                  >
                    {lang === 'ar' ? cat.nameAr : cat.nameEn}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
