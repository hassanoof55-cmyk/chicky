
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
  tags, activeTag, onTagToggle, filterLabelEn, filterLabelAr
}) => {
  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-md">
      {/* Main Nav Row */}
      <div className="px-4 py-3 md:px-8 max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button className="md:hidden text-gray-600">
            <Menu size={24} />
          </button>
          <div 
            className="flex items-center cursor-pointer" 
            onClick={() => window.scrollTo({top: 0, behavior: 'smooth'})}
          >
            <Logo src={logoSrc} className="h-10 md:h-12" />
          </div>
        </div>

        <div className="hidden md:flex flex-1 max-w-lg mx-4">
          <div className="relative w-full group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-red-500 transition-colors" size={20} />
            <input
              type="text"
              placeholder={lang === 'en' ? "What are you craving?" : "بماذا تشعر بالجوع؟"}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-gray-100 border-2 border-transparent rounded-2xl py-3 pl-12 pr-4 focus:bg-white focus:border-red-500 focus:ring-4 focus:ring-red-100 outline-none transition-all text-base font-bold text-slate-900 placeholder:text-slate-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <button 
            onClick={() => onSetLang(lang === 'en' ? 'ar' : 'en')}
            className="flex items-center gap-2 text-slate-700 hover:text-red-600 font-black text-xs uppercase transition-colors tracking-widest"
          >
            <Globe size={18} />
            <span>{lang === 'en' ? 'AR' : 'EN'}</span>
          </button>
          


          <button 
            onClick={onOpenCart}
            className="group relative p-3 bg-red-600 text-white rounded-2xl hover:bg-red-700 transition-all shadow-xl shadow-red-200 hover:scale-105 active:scale-95"
          >
            <ShoppingCart size={22} />
            {cartCount > 0 && (
              <span className="absolute -top-2 -right-2 bg-black text-white text-[10px] font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white animate-pop">
                {cartCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tags Filter Row */}
      <div className="bg-gray-50/50 border-t border-gray-100 px-4 py-2 overflow-x-auto no-scrollbar">
        <div className="max-w-7xl mx-auto flex items-center gap-2">
          <div className="flex items-center gap-2 pr-4 border-r border-gray-200 shrink-0">
             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
               {lang === 'en' ? (filterLabelEn || 'Filter By') : (filterLabelAr || 'تصفية حسب')}
             </span>
          </div>
          {tags.map(tag => (
            <button
              key={tag.id}
              onClick={() => onTagToggle(tag.nameEn)}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-black transition-all whitespace-nowrap border-2 ${
                activeTag === tag.nameEn 
                ? 'bg-red-600 border-red-600 text-white shadow-md scale-105' 
                : 'bg-white border-gray-200 text-slate-600 hover:border-red-200 hover:text-red-600'
              }`}
            >
              {getTagIcon(tag.nameEn)}
              {lang === 'en' ? tag.nameEn : tag.nameAr}
            </button>
          ))}
          {activeTag && (
            <button 
              onClick={() => onTagToggle('')}
              className="text-[10px] font-black text-red-600 uppercase tracking-widest hover:underline ml-2 shrink-0"
            >
              {lang === 'en' ? 'Clear' : 'مسح'}
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
