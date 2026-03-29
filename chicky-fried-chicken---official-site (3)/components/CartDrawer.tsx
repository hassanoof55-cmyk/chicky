
import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, ShoppingBag, Trash2, ArrowRight, Flame } from 'lucide-react';
// Added Language to imports
import { CartItem, Language } from '../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  items: CartItem[];
  onUpdateQuantity: (id: string, delta: number, spiciness?: 'Normal' | 'Spicy') => void;
  onRemove: (id: string, spiciness?: 'Normal' | 'Spicy') => void;
  onCheckout: () => void;
  // Added lang prop to interface
  lang: Language;
}

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose, items, onUpdateQuantity, onRemove, onCheckout }) => {
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [lastActionId, setLastActionId] = useState<string | null>(null);

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const getItemKey = (item: CartItem) => `${item.id}-${item.selectedSpiciness || 'Default'}`;

  const handleRemove = (item: CartItem) => {
    const key = getItemKey(item);
    setRemovingKey(key);
    setTimeout(() => {
      onRemove(item.id, item.selectedSpiciness);
      setRemovingKey(null);
    }, 250); 
  };

  const handleQuantityUpdate = (item: CartItem, delta: number) => {
    setLastActionId(getItemKey(item) + '-' + Date.now());
    onUpdateQuantity(item.id, delta, item.selectedSpiciness);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-md transition-opacity duration-300" 
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-in">
        <div className="p-6 border-b flex items-center justify-between bg-gray-50">
          <div className="flex flex-col">
            <h2 className="text-2xl font-black brand-font text-red-600 flex items-center gap-3">
              <ShoppingBag className="shrink-0" />
              MY BASKET
            </h2>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-9">
              {items.length} {items.length === 1 ? 'Item' : 'Items'} selected
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-xl transition-all active:scale-90">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4 no-scrollbar">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-6 py-12 animate-scale-up">
              <div className="bg-gray-100 p-10 rounded-[2.5rem] shadow-inner">
                <ShoppingBag size={64} className="text-gray-300" />
              </div>
              <div className="text-center">
                <p className="text-xl font-black text-gray-800 uppercase tracking-tighter brand-font">Basket is empty</p>
                <p className="text-sm font-medium mt-1">Start adding deliciousness!</p>
              </div>
              <button 
                onClick={onClose}
                className="bg-red-600 text-white font-black px-8 py-3 rounded-2xl shadow-xl shadow-red-100 hover:scale-105 active:scale-95 transition-all"
              >
                BROWSE MENU
              </button>
            </div>
          ) : (
            items.map((item) => {
              const itemKey = getItemKey(item);
              return (
                <div 
                  key={itemKey} 
                  className={`flex gap-4 p-4 bg-white border border-gray-100 rounded-3xl shadow-sm transition-all duration-300 ${removingKey === itemKey ? 'animate-exit-right opacity-0' : 'animate-scale-up'}`}
                >
                  <div className="relative shrink-0">
                    <img src={item.image} alt={item.name} className="w-24 h-24 object-cover rounded-2xl shadow-sm" />
                    {(item.isSpicy || item.selectedSpiciness === 'Spicy') && (
                      <div className="absolute -top-2 -left-2 bg-red-600 text-white p-1 rounded-lg shadow-lg">
                         <Flame size={12} fill="currentColor" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-black text-gray-800 leading-tight text-sm md:text-base">{item.name}</h4>
                        <div className="flex flex-col">
                          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{item.nameAr}</p>
                          {item.selectedSpiciness && (
                            <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md mt-1 w-fit border ${item.selectedSpiciness === 'Spicy' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
                              {item.selectedSpiciness}
                            </span>
                          )}
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemove(item)} 
                        className="text-gray-300 hover:text-red-600 transition-colors p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    
                    <div className="flex justify-between items-center mt-2">
                      <span 
                        key={`price-${itemKey}-${item.quantity}`} 
                        className={`text-red-600 font-black text-lg ${lastActionId?.startsWith(itemKey) ? 'animate-pop' : ''}`}
                      >
                        {item.price * item.quantity} LE
                      </span>
                      <div className="flex items-center bg-gray-50 border border-gray-200 p-1 rounded-xl shadow-sm">
                        <button 
                          onClick={() => handleQuantityUpdate(item, -1)}
                          className="w-8 h-8 flex items-center justify-center bg-white hover:bg-gray-100 rounded-lg shadow-sm transition-all active:scale-75 disabled:opacity-30 disabled:cursor-not-allowed"
                          disabled={item.quantity <= 1}
                        >
                          <Minus size={14} className="text-gray-600" />
                        </button>
                        <span 
                          key={`qty-${itemKey}-${item.quantity}`} 
                          className={`w-8 text-center font-black text-sm text-gray-800 ${lastActionId?.startsWith(itemKey) ? 'animate-pop' : ''}`}
                        >
                          {item.quantity}
                        </span>
                        <button 
                          onClick={() => handleQuantityUpdate(item, 1)}
                          className="w-8 h-8 flex items-center justify-center bg-white hover:bg-gray-100 rounded-lg shadow-sm transition-all active:scale-75"
                        >
                          <Plus size={14} className="text-red-600" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {items.length > 0 && (
          <div className="p-8 bg-white border-t space-y-6 shadow-[0_-10px_20px_-15px_rgba(0,0,0,0.1)]">
            <div className="space-y-2">
              <div className="flex justify-between items-center text-gray-500 font-bold text-xs uppercase tracking-widest">
                <span>Items Subtotal</span>
                <span className="text-gray-800 font-black">{subtotal} LE</span>
              </div>
              <div className="flex justify-between items-center text-gray-500 font-bold text-xs uppercase tracking-widest">
                <span>Delivery</span>
                <span className="text-green-600 font-black uppercase">Calculated at checkout</span>
              </div>
              <div className="flex justify-between items-center text-2xl font-black brand-font pt-3 border-t border-dashed border-gray-200 mt-2">
                <span>TOTAL ESTIMATE</span>
                <span className="text-red-600 text-3xl animate-pop" key={subtotal}>
                  {subtotal} LE
                </span>
              </div>
            </div>
            <button 
              onClick={onCheckout}
              className="w-full bg-red-600 text-white font-black py-5 rounded-[2rem] shadow-2xl shadow-red-200 hover:bg-red-700 transition-all active:scale-95 text-lg tracking-widest flex items-center justify-center gap-3 group"
            >
              GO TO CHECKOUT 
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CartDrawer;
