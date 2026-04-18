
import React, { useState } from 'react';
import { Plus, Flame, CheckCircle, X, Sparkles } from 'lucide-react';
import { Product, Language, CategoryConfig, TagConfig } from '../types';

interface MenuSectionProps {
  category: CategoryConfig;
  items: Product[];
  onAddToCart: (product: Product, spiciness?: 'Normal' | 'Spicy', size?: any, modifiers?: any[]) => void;
  lang: Language;
  tagsConfig: TagConfig[];
}

const MenuSection: React.FC<MenuSectionProps> = ({ category, items, onAddToCart, lang, tagsConfig }) => {
  const [animatingId, setAnimatingId] = useState<string | null>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);
  const [tempSelection, setTempSelection] = useState<{ size?: any, spiciness?: any, modifiers?: any[] }>({});

  const isAr = lang === 'ar';
  const currentItem = items.find(i => i.id === showOptionsId);

  const handleAddClick = (product: Product) => {
    if (product.hasSizes || product.spicinessOption || (product.modifiers && product.modifiers.length > 0)) {
      setTempSelection({ modifiers: [] });
      setShowOptionsId(product.id);
    } else {
      executeAdd(product);
    }
  };

  const executeAdd = (product: Product, spiciness?: 'Normal' | 'Spicy', size?: any, modifiers?: any[]) => {
    onAddToCart(product, spiciness, size, modifiers);
    setAnimatingId(product.id + (spiciness || '') + (size?.id || '') + (modifiers?.length || ''));
    setShowOptionsId(null);
    setTempSelection({});
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
      
      {showOptionsId && currentItem && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xl">
          <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl animate-scale-up text-center relative border-[6px] border-white overflow-y-auto max-h-[90vh]">
            <button 
              onClick={() => setShowOptionsId(null)} 
              className="absolute top-8 right-8 p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400"
            >
              <X size={24} />
            </button>
            
            <div className="mb-8">
              <div className="w-24 h-24 bg-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-red-200">
                <Sparkles size={48} className="text-white animate-pulse" fill="currentColor" />
              </div>
              <h3 className="text-3xl font-black brand-font text-slate-900 uppercase tracking-tight leading-tight">
                {lang === 'en' ? 'CUSTOMIZE' : 'تخصيص الطلب'}
              </h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">{lang === 'en' ? currentItem.name : currentItem.nameAr}</p>
            </div>

            <div className="space-y-8 text-left">
              {/* Size Selection */}
              {currentItem.hasSizes && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] text-center">
                    {lang === 'en' ? 'Choose Size' : 'اختر الحجم'}
                  </p>
                  <div className="grid grid-cols-1 gap-3 text-center">
                    {currentItem.sizes?.map(size => (
                      <button 
                        key={size.id}
                        onClick={() => setTempSelection({ ...tempSelection, size })}
                        className={`w-full py-4 rounded-2xl font-black text-sm transition-all border-2 ${tempSelection.size?.id === size.id ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-slate-50 border-transparent text-slate-900 hover:bg-slate-100'}`}
                      >
                        {lang === 'en' ? size.nameEn : size.nameAr} - {size.price} LE
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Spiciness Selection */}
              {currentItem.spicinessOption && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] text-center">
                    {lang === 'en' ? 'Choose Heat' : 'اختر درجة الحرارة'}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <button 
                      onClick={() => setTempSelection({ ...tempSelection, spiciness: 'Normal' })}
                      className={`py-4 rounded-2xl font-black text-sm transition-all border-2 ${tempSelection.spiciness === 'Normal' ? 'bg-slate-900 border-slate-900 text-white shadow-lg' : 'bg-slate-100 border-transparent text-slate-900'}`}
                    >
                      🍗 {lang === 'en' ? 'Original' : 'عادي'}
                    </button>
                    <button 
                      onClick={() => setTempSelection({ ...tempSelection, spiciness: 'Spicy' })}
                      className={`py-4 rounded-2xl font-black text-sm transition-all border-2 ${tempSelection.spiciness === 'Spicy' ? 'bg-red-600 border-red-600 text-white shadow-lg' : 'bg-slate-100 border-transparent text-slate-900'}`}
                    >
                      🔥 {lang === 'en' ? 'Zinger' : 'حار'}
                    </button>
                  </div>
                </div>
              )}

              {/* Extras Selection */}
              {currentItem.modifiers && currentItem.modifiers.length > 0 && (
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] text-center">
                    {lang === 'en' ? 'Add Extras' : 'إضافات'}
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                     {currentItem.modifiers.map(mod => {
                        const isSelected = tempSelection.modifiers?.some(m => m.id === mod.id);
                        return (
                          <button 
                            key={mod.id}
                            onClick={() => {
                               const nextMod = isSelected 
                                  ? tempSelection.modifiers?.filter(m => m.id !== mod.id)
                                  : [...(tempSelection.modifiers || []), mod];
                               setTempSelection({...tempSelection, modifiers: nextMod});
                            }}
                            className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all ${isSelected ? 'bg-slate-900 border-slate-900 text-white shadow-md' : 'bg-slate-50 border-transparent text-slate-900 hover:bg-slate-100'}`}
                          >
                             <span className="text-xs font-black uppercase">{lang === 'en' ? mod.nameEn : mod.nameAr}</span>
                             <span className={`text-[10px] font-black ${isSelected ? 'text-red-400' : 'text-red-600'}`}>+{mod.price} LE</span>
                          </button>
                        )
                     })}
                  </div>
                </div>
              )}

              <button 
                disabled={(currentItem.hasSizes && !tempSelection.size) || (currentItem.spicinessOption && !tempSelection.spiciness)}
                onClick={() => executeAdd(currentItem, tempSelection.spiciness, tempSelection.size, tempSelection.modifiers)}
                className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] hover:bg-red-600 active:scale-95 transition-all shadow-2xl disabled:opacity-20 mt-4 uppercase tracking-widest text-xs"
              >
                {lang === 'en' ? 'ADD TO BASKET' : 'إضافة للطلب'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-8">
        {items.map((item) => {
          const isAnimating = animatingId?.startsWith(item.id);

          return (
            <div 
              key={item.id} 
              className="group bg-white rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden shadow-soft hover-lift border border-slate-100/50 flex flex-col relative"
            >
              <div className="relative h-40 md:h-64 overflow-hidden bg-white p-3 md:p-6">
                <img 
                   src={item.image} 
                   alt={lang === 'en' ? item.name : item.nameAr} 
                   loading="lazy"
                   decoding="async"
                   className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-700" 
                />
                <div className="absolute top-3 md:top-6 left-3 md:left-6 flex flex-col gap-1 md:gap-2">
                  {item.tags?.map(tag => {
                    const tagObj = tagsConfig?.find(t => t.nameEn.toLowerCase() === tag.toLowerCase());
                    const displayName = isAr ? (tagObj?.nameAr || tag) : (tagObj?.nameEn || tag);
                    return (
                      <span key={tag} className="bg-white/95 backdrop-blur-md text-red-600 text-[8px] md:text-[10px] font-black px-2 md:px-4 py-1 md:py-2 rounded-lg md:rounded-xl uppercase tracking-widest shadow-lg border border-red-50/50">
                        {displayName}
                      </span>
                    );
                  })}
                </div>
                
                {/* Price Tag */}
                <div className="absolute bottom-3 md:bottom-6 right-3 md:right-6 bg-slate-900/95 backdrop-blur-xl text-white px-3 md:px-5 py-1.5 md:py-2.5 rounded-xl md:rounded-2xl shadow-red border border-white/10 flex flex-col items-end">
                  {item.originalPrice !== undefined && item.originalPrice > item.price && item.originalPrice > 0 ? (
                    <span className="text-[8px] md:text-[10px] text-red-400 leading-none mb-0.5 md:mb-1 font-black line-through opacity-80 uppercase">
                       {item.originalPrice}
                    </span>
                  ) : null}
                  <div className="flex items-baseline justify-end gap-1 md:gap-1.5">
                    <span className="text-lg md:text-2xl font-black leading-none text-white tracking-tighter">
                      {item.price}
                    </span>
                    <span className="text-[8px] md:text-[10px] font-black text-white/40 uppercase tracking-widest">{lang === 'en' ? 'LE' : 'ج.م'}</span>
                  </div>
                </div>
              </div>

              <div className="px-4 md:px-8 pb-4 md:pb-8 pt-1 md:pt-2 flex-1 flex flex-col justify-between">
                <div className="space-y-2 md:space-y-3">
                  <div className="flex justify-between items-start gap-2 md:gap-4">
                    <h3 className="font-black text-sm md:text-xl text-slate-900 leading-tight group-hover:text-red-600 transition-colors uppercase brand-font tracking-tight text-balance">
                      {lang === 'en' ? item.name : item.nameAr}
                    </h3>
                    {item.isSpicy && (
                      <div className="bg-red-50 text-red-600 p-1.5 md:p-2 rounded-lg md:rounded-xl shrink-0">
                         <Flame size={14} md:size={16} fill="currentColor" />
                      </div>
                    )}
                  </div>
                  <p className="text-[8px] md:text-[9px] text-slate-300 font-black uppercase tracking-[0.2em] md:tracking-[0.3em]">{lang === 'en' ? item.nameAr : item.name}</p>
                  <p className="text-[10px] md:text-xs text-slate-500 font-medium leading-relaxed line-clamp-2 opacity-80">
                    {lang === 'en' ? item.description : item.descriptionAr}
                  </p>
                </div>

                <div className="mt-4 md:mt-8 flex gap-1 md:gap-2">
                  <button 
                    onClick={() => handleAddClick(item)}
                    className={`flex-1 flex items-center justify-center gap-2 md:gap-3 py-2.5 md:py-4 rounded-xl md:rounded-2xl transition-all font-black uppercase tracking-widest text-[9px] md:text-[10px] active:scale-95 shadow-sm ${
                      isAnimating 
                      ? 'bg-success border-success text-white shadow-lg' 
                      : 'bg-slate-50 border-transparent text-slate-900 group-hover:bg-red-600 group-hover:text-white'
                    }`}
                  >
                    {isAnimating ? (
                      <CheckCircle size={16} md:size={18} />
                    ) : (
                      <>
                        <Plus size={16} md:size={18} strokeWidth={3} />
                        <span>{lang === 'en' ? 'Add' : 'أضف'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

export default MenuSection;
