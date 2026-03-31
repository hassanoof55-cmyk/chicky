import React, { useState } from 'react';
import { Plus, Sparkles, X, Flame } from 'lucide-react';
import { Product } from '../types';

interface RecommendedSectionProps {
  title: string;
  items: Product[];
  onAddToCart: (product: Product, spiciness?: 'Normal' | 'Spicy') => void;
  lang: 'en' | 'ar';
}

const RecommendedSection: React.FC<RecommendedSectionProps> = ({ title, items, onAddToCart, lang }) => {
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);

  if (items.length === 0) return null;

  const handleAddClick = (product: Product) => {
    if (product.spicinessOption) {
      setShowOptionsId(product.id);
    } else {
      onAddToCart(product);
    }
  };

  const executeAdd = (product: Product, spiciness?: 'Normal' | 'Spicy') => {
    onAddToCart(product, spiciness);
    setShowOptionsId(null);
  };

  return (
    <section className="py-8 animate-scale-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-black brand-font tracking-tight flex items-center gap-2">
          <Sparkles className="text-yellow-500" size={24} />
          {title}
        </h3>
      </div>

      {/* Spiciness Modal Overlay for Recommendations */}
      {showOptionsId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-scale-up text-center relative">
            <button 
              onClick={() => setShowOptionsId(null)} 
              className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
            >
              <X size={20} />
            </button>
            
            <div className="mb-6">
              <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Flame size={40} className="text-red-600 animate-pulse" fill="currentColor" />
              </div>
              <h4 className="text-2xl font-black brand-font text-gray-800 uppercase tracking-tight">
                {lang === 'en' ? 'QUICK CHOICE' : 'اختيار سريع'}
              </h4>
              <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mt-1">
                {lang === 'en' ? 'Normal or Spicy?' : 'عادي أم حار؟'}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => {
                  const item = items.find(i => i.id === showOptionsId);
                  if (item) executeAdd(item, 'Normal');
                }}
                className="w-full bg-gray-100 text-gray-800 font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-200 transition-all text-lg"
              >
                🍗 {lang === 'en' ? 'NORMAL' : 'عادي'}
              </button>
              <button 
                onClick={() => {
                  const item = items.find(i => i.id === showOptionsId);
                  if (item) executeAdd(item, 'Spicy');
                }}
                className="w-full bg-red-600 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 hover:bg-red-700 transition-all shadow-xl shadow-red-200 text-lg"
              >
                🔥 {lang === 'en' ? 'SPICY' : 'حار'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
        {items.map((item) => (
          <div 
            key={item.id} 
            className="shrink-0 w-64 bg-white rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all p-3 flex flex-col group relative overflow-hidden"
          >
            <div className="relative h-32 rounded-2xl overflow-hidden mb-3">
              <img 
                src={item.image} 
                alt={item.name} 
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
              />
              <div className="absolute top-2 right-2 bg-white/90 backdrop-blur px-2 py-1 rounded-lg shadow-sm flex flex-col items-end">
                {item.originalPrice && (
                  <span className="text-[8px] text-gray-400 line-through leading-none">
                    {item.originalPrice} LE
                  </span>
                )}
                <span className="text-[10px] font-black text-red-600 leading-none">
                  {item.price} LE
                </span>
              </div>
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-gray-800 text-sm line-clamp-1">{lang === 'en' ? item.name : item.nameAr}</h4>
              <p className="text-[10px] text-gray-400 font-medium line-clamp-1">
                {lang === 'en' ? item.description : item.descriptionAr}
              </p>
            </div>
            <button 
              onClick={() => handleAddClick(item)}
              className="mt-3 w-full bg-gray-50 hover:bg-red-600 text-gray-700 hover:text-white font-black py-2 rounded-xl text-xs transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus size={14} />
              {lang === 'en' ? 'Quick Add' : 'أضف سريعاً'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

export default RecommendedSection;