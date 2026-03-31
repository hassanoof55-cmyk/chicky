
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
        {items.map((item) => {
          const isAnimating = animatingId?.startsWith(item.id);

          return (
            <div 
              key={item.id} 
              className="group bg-white rounded-[2.5rem] overflow-hidden shadow-sm hover-lift border border-slate-100 flex flex-col relative"
            >
              <div className="relative h-56 overflow-hidden bg-white">
                <img 
                   src={item.image} 
                   alt={lang === 'en' ? item.name : item.nameAr} 
                   loading="lazy"
                   decoding="async"
                   className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-700" 
                />
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
                <div className="absolute bottom-4 right-4 bg-slate-950/90 backdrop-blur-xl text-white px-5 py-2 rounded-full shadow-2xl border border-white/5 flex flex-col items-end">
                  {item.originalPrice !== undefined && item.originalPrice > item.price && item.originalPrice > 0 ? (
                    <span className="text-[10px] text-white/20 leading-none mb-1 font-bold line-through">
                       {item.originalPrice}
                    </span>
                  ) : null}
                  <div className="flex items-baseline justify-end gap-2">
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-tighter">{lang === 'en' ? 'LE' : 'ج.م'}</span>
                    <span className="text-2xl font-black leading-none text-white tracking-tight">
                      {item.price}
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-7 flex-1 flex flex-col justify-between">
                <div className="space-y-3 text-center md:text-left">
                  <h3 className="font-black text-xl text-slate-900 leading-[1.1] group-hover:text-red-600 transition-colors uppercase brand-font tracking-tight">
                    {lang === 'en' ? item.name : item.nameAr}
                  </h3>
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
