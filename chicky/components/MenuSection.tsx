
import React, { useState } from 'react';
import { Plus, Flame, CheckCircle, X, Star } from 'lucide-react';
import { Product, Language, CategoryConfig, TagConfig } from '../types';

interface MenuSectionProps {
  category: CategoryConfig;
  items: Product[];
  onAddToCart: (product: Product, spiciness?: 'Normal' | 'Spicy') => void;
  lang: Language;
  tagsConfig: TagConfig[];
}

const MenuSection: React.FC<MenuSectionProps> = ({ category, items, onAddToCart, lang, tagsConfig }) => {
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);

  const isAr = lang === 'ar';

  const handleAddClick = (product: Product) => {
    if (product.spicinessOption) {
      setShowOptionsId(product.id);
    } else {
      executeAdd(product);
    }
  };

  const executeAdd = (product: Product, spiciness?: 'Normal' | 'Spicy') => {
    onAddToCart(product, spiciness);
    setAnimatingId(product.id + (spiciness || ''));
    setShowOptionsId(null);
    setTimeout(() => setAnimatingId(null), 800);
  };

  return (
    <section id={category.id} className="py-12 scroll-mt-32">
      <div className="flex items-center gap-6 mb-10">
        <h2 className="text-4xl font-black brand-font tracking-tight uppercase text-slate-900">
          {lang === 'en' ? category.nameEn : category.nameAr}
        </h2>
        <div className="h-1 flex-1 bg-gradient-to-r from-slate-100 to-transparent rounded-full"></div>
      </div>
      
      {showOptionsId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-scale-up text-center relative border-[6px] border-white">
            <button 
              onClick={() => setShowOptionsId(null)} 
              className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
            >
              <X size={24} />
            </button>
            
            <div className="mb-8">
              <div className="w-24 h-24 bg-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-red-200">
                <Flame size={48} className="text-white animate-pulse" fill="currentColor" />
              </div>
              <h3 className="text-3xl font-black brand-font text-slate-900 uppercase tracking-tight">
                {lang === 'en' ? 'PICK YOUR FIRE' : 'اختر درجة الحرارة'}
              </h3>
              <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.2em] mt-2">
                {lang === 'en' ? 'Customise your crunch level' : 'خصص درجة القرمشة المفضلة لديك'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <button 
                onClick={() => {
                  const item = items.find(i => i.id === showOptionsId);
                  if (item) executeAdd(item, 'Normal');
                }}
                className="w-full bg-slate-100 text-slate-900 font-black py-6 rounded-[2rem] flex items-center justify-center gap-3 hover:bg-slate-200 active:scale-95 transition-all text-xl"
              >
                🍗 {lang === 'en' ? 'ORIGINAL' : 'عادي'}
              </button>
              <button 
                onClick={() => {
                  const item = items.find(i => i.id === showOptionsId);
                  if (item) executeAdd(item, 'Spicy');
                }}
                className="w-full bg-red-600 text-white font-black py-6 rounded-[2rem] flex items-center justify-center gap-3 hover:bg-red-700 active:scale-95 transition-all shadow-2xl shadow-red-200 text-xl"
              >
                🔥 {lang === 'en' ? 'ZINGER' : 'حار'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {items.map((item) => {
          const isAnimating = animatingId?.startsWith(item.id);

          return (
            <div 
              key={item.id} 
              className="group bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover-lift border border-slate-100 flex flex-col relative"
            >
              <div className="relative h-56 overflow-hidden">
                <img 
                  src={item.image} 
                  alt={lang === 'en' ? item.name : item.nameAr} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="absolute top-4 left-4 flex flex-col gap-2">
                  {item.tags?.map(tag => {
                    const tagObj = tagsConfig?.find(t => t.nameEn.toLowerCase() === tag.toLowerCase());
                    const displayName = isAr ? (tagObj?.nameAr || tag) : (tagObj?.nameEn || tag);
                    return (
                      <span key={tag} className="bg-white/90 backdrop-blur-md text-red-600 text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg border border-white/20">
                        {displayName}
                      </span>
                    );
                  })}
                  {item.isSpicy && (
                    <span className="bg-red-600/90 backdrop-blur-md text-white text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-lg flex items-center gap-2">
                       <Flame size={10} fill="currentColor" /> {isAr ? 'حار' : 'SPICY'}
                    </span>
                  )}
                </div>

                <div className="absolute bottom-4 right-4 bg-slate-900/80 backdrop-blur-xl text-white px-4 py-2 rounded-2xl shadow-xl border border-white/10 flex flex-col items-end">
                  {item.originalPrice && item.originalPrice > item.price && (
                    <span className="text-[10px] text-white/50 leading-none mb-1 font-bold">
                       {isAr ? 'بدلاً من ' : 'Instead of '} 
                       <span className="line-through">{item.originalPrice}</span>
                    </span>
                  )}
                  <span className="text-xl font-black leading-none">
                    {item.price} <span className="text-[10px] opacity-60 uppercase">{lang === 'en' ? 'LE' : 'ج.م'}</span>
                  </span>
                </div>
              </div>

              <div className="p-7 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <h3 className="font-black text-xl text-slate-900 leading-[1.1] group-hover:text-red-600 transition-colors uppercase brand-font tracking-tight">
                      {lang === 'en' ? item.name : item.nameAr}
                    </h3>
                  </div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">{lang === 'en' ? item.nameAr : item.name}</p>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed line-clamp-2 min-h-[40px]">
                    {lang === 'en' ? item.description : item.descriptionAr}
                  </p>
                </div>

                <button 
                  onClick={() => handleAddClick(item)}
                  className={`mt-8 w-full flex items-center justify-center gap-3 py-4 rounded-2xl transition-all font-black uppercase tracking-widest text-xs active:scale-95 border-2 ${
                    isAnimating 
                    ? 'bg-green-600 border-green-600 text-white shadow-xl shadow-green-100' 
                    : 'bg-slate-50 border-transparent text-slate-900 group-hover:bg-red-600 group-hover:text-white group-hover:shadow-2xl group-hover:shadow-red-200'
                  }`}
                >
                  {isAnimating ? (
                    <>
                      <CheckCircle size={18} />
                      <span>{lang === 'en' ? 'DONE!' : 'تم!'}</span>
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      <span>{lang === 'en' ? 'ADD TO BASKET' : 'أضف للسلة'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default MenuSection;
