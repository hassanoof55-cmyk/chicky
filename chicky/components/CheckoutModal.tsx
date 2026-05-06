import React, { useState, useEffect, useRef, useMemo } from 'react';
import { X, CheckCircle, Truck, MapPin, Phone, User, Loader2, AlertCircle, LayoutList, Map as MapIcon, ChevronRight, ChevronLeft, MessageSquare, Send, Navigation, ShoppingBag, Utensils, Clock, Tag, Sparkles, Search, Wallet, Coins, Smartphone, ArrowUp, LocateFixed } from 'lucide-react';
import { OrderDetails, LocationData, Area, CartItem, Language, ServiceType, PromoCode, SiteConfig } from '../types';
import { getStoredConfig } from '../data/menuData';
import { supabase } from '../lib/supabase';

declare var L: any;

const isPointInPolygon = (point: [number, number], polygon: [number, number][]) => {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

interface CheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  subtotal: number;
  onConfirm: (details: OrderDetails) => void;
  cartItems: CartItem[];
  onClearCart: () => void;
  lang: Language;
  serviceType: ServiceType;
  config: SiteConfig;
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ 
  isOpen, onClose, subtotal, onConfirm, cartItems, onClearCart, lang, serviceType: initialServiceType, config 
}) => {
  if (!isOpen) return null;

  const [step, setStep] = useState(1); // Step 1: Service Choice, Step 2: Details/Location, Step 3: Summary
  const [orderId, setOrderId] = useState('');
  const [locationMethod, setLocationMethod] = useState<'map' | 'list'>('map');
  const [details, setDetails] = useState<OrderDetails>({
    name: '',
    phone: '',
    address: '',
    branch: 'Main Branch',
    serviceType: initialServiceType || 'delivery',
    phone2: ''
  });
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'wallet' | null>(null);

  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number}>({ lat: 30.0444, lng: 31.2357 }); 
  const [isCalculating, setIsCalculating] = useState(false);
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [mapSearch, setMapSearch] = useState('');
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const [mapSearchResults, setMapSearchResults] = useState<any[]>([]);
  const [showMapResults, setShowMapResults] = useState(false);

  useEffect(() => {
    if (isScheduling) {
      // Small timeout to ensure the element is rendered and positioned in DOM
      const timer = setTimeout(() => {
        if (timeInputRef.current) {
          if ('showPicker' in HTMLInputElement.prototype) {
            try { timeInputRef.current.showPicker(); } catch (e) { timeInputRef.current.focus(); }
          } else {
            timeInputRef.current.focus();
          }
        }
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isScheduling]);
  
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const timeInputRef = useRef<HTMLInputElement>(null);
  const areas = config?.areas || [];

  const isAr = lang === 'ar';

  const t = {
    title: isAr ? 'إتمام الطلب' : 'CHICKY CHECKOUT',
    chooseService: isAr ? 'كيف تود استلام طلبك؟' : 'HOW TO GET YOUR FOOD?',
    recipient: isAr ? 'بيانات المستلم' : 'Delivery Recipient',
    name: isAr ? 'الاسم بالكامل' : 'Full Name',
    phone: isAr ? 'رقم الموبايل' : 'Mobile Number',
    location: isAr ? 'اختر موقعك' : 'Choose Location',
    areaList: isAr ? 'قائمة المناطق' : 'Area List',
    mapPin: isAr ? 'تحديد على الخريطة' : 'Map Pin',
    fee: isAr ? 'خدمة التوصيل' : 'Delivery Fee',
    total: isAr ? 'الإجمالي النهائي' : 'GRAND TOTAL',
    instructions: isAr ? 'تفاصيل العنوان' : 'Delivery Instructions',
    addressPlaceholder: isAr ? 'مثال: رقم العمارة، الطابق، رقم الشقة، علامة مميزة...' : 'e.g. Building 12, Floor 3, Apt 15, Landmark...',
    placeOrder: isAr ? 'إتمام الطلب الآن' : 'PLACE MY ORDER',
    successTitle: isAr ? 'يا سلاااام!' : 'YAHOO!',
    successSub: isAr ? 'استلمنا طلبك وجاري التحضير' : 'Order received & cooking',
    orderRef: isAr ? 'رقم الطلب' : 'Order Reference',
    trackFood: isAr ? 'تأكيد وتتبع الطلب' : 'Confirmation & Tracking',
    sendOrder: isAr ? 'إرسال الطلب للمطعم' : 'Send Order to Restaurant',
    trackWa: isAr ? 'تتبع عبر واتساب' : 'Track on WhatsApp',
    backMenu: isAr ? 'العودة للقائمة' : 'BACK TO MENU',
    outOfRange: isAr ? 'المنطقة خارج التغطية' : 'ZONE NOT COVERED',
    outOfRangeSub: isAr ? 'حاول نقل الدبوس إلى شارع رئيسي قريب.' : 'Try moving the pin to a main street nearby.',
    validating: isAr ? 'جاري التحقق...' : 'Validating...',
    pinMap: isAr ? 'ثبت الدبوس على موقعك' : 'PIN YOUR ADDRESS ON THE MAP',
    autoDetect: isAr ? 'تحديد موقعي تلقائياً' : 'Use Current Location',
    mapSearchPlaceholder: isAr ? 'ابحث عن منطقتك أو شارعك...' : 'Search for your area or street...',
    searchButton: isAr ? 'بحث' : 'Search',
    orderSummary: isAr ? 'ملخص الطلب' : 'ORDER SUMMARY',
    apply: isAr ? 'تطبيق' : 'APPLY',
    scheduleTitle: isAr ? 'جدولة الطلب لوقت لاحق؟' : 'SCHEDULE FOR LATER?',
    timeSelected: isAr ? 'الوقت المحدد' : 'TIME SELECTED',
    basketTotal: isAr ? 'إجمالي السلة' : 'BASKET TOTAL',
    itemsInBasket: isAr ? 'الأصناف في السلة' : 'ITEMS IN BASKET',
    products: isAr ? 'أصناف' : 'Products'
  };

  const EgyptianPhoneRegex = /^01[0125][0-9]{8}$/;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.startsWith('20') && val.length > 10) val = val.substring(2);
    if (val.startsWith('1') && val.length === 10) val = '0' + val;
    val = val.slice(0, 11);
    
    setDetails({...details, phone: val});
    if (val.length === 11 && !EgyptianPhoneRegex.test(val)) {
      setPhoneError(isAr ? 'رقم مصري غير صحيح' : 'Invalid Egyptian number');
    } else {
      setPhoneError(null);
    }
  };

  const validatePosition = (lat: number, lng: number) => {
    setIsCalculating(true);
    let matched: Area | null = null;
    
    for (const area of areas) {
      if (area.points && isPointInPolygon([lat, lng], area.points)) {
        matched = area;
        break;
      }
    }

    setSelectedArea(matched);
    setIsOutOfRange(!matched);
    setIsCalculating(false);
  };

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setIsDetecting(true);
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude, longitude } = pos.coords;
      const newLoc = { lat: latitude, lng: longitude };
      setLocation(newLoc);
      
      if (markerRef.current) markerRef.current.setLatLng([latitude, longitude]);
      if (mapRef.current) mapRef.current.setView([latitude, longitude], 16);
      
      validatePosition(latitude, longitude);
      setIsDetecting(false);
    }, (err) => {
      console.error(err);
      setIsDetecting(false);
    });
  };

  const searchLocation = async () => {
    if (!mapSearch) return;
    setIsSearchingMap(true);
    try {
      const langParam = lang === 'ar' ? 'ar' : 'en';
      const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearch + ', Alexandria, Egypt')}&limit=1&accept-language=${langParam}&viewbox=29.7,30.8,30.2,31.4`);
      const data = await resp.json();
      if (data && data.length > 0) {
        selectSearchResult(data[0]);
      }
    } catch (e) {
      console.error('Search failed:', e);
    }
    setIsSearchingMap(false);
  };

  // Debounced search for suggestions
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (mapSearch.length >= 2) {
        try {
          const langParam = lang === 'ar' ? 'ar' : 'en';
          const resp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(mapSearch + ', Alexandria, Egypt')}&limit=5&accept-language=${langParam}&viewbox=29.7,30.8,30.2,31.4`);
          const data = await resp.json();
          setMapSearchResults(data);
          setShowMapResults(true);
        } catch (e) {
          console.error('Autocomplete failed:', e);
        }
      } else {
        setMapSearchResults([]);
        setShowMapResults(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [mapSearch]);

  const selectSearchResult = (result: any) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setLocation({ lat, lng: lon });
    if (mapRef.current) mapRef.current.setView([lat, lon], 16);
    validatePosition(lat, lon);
    setShowMapResults(false);
    setMapSearch(result.display_name.split(',')[0]);
  };

  useEffect(() => {
    if (step === 2 && details.serviceType === 'delivery' && locationMethod === 'map' && isOpen) {
      const timer = setTimeout(() => {
        if (!mapRef.current) {
          mapRef.current = L.map('map-container', { zoomControl: false, center: [location.lat, location.lng], zoom: 13 });
          L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}').addTo(mapRef.current);

          mapRef.current.on('moveend', () => {
            const center = mapRef.current.getCenter();
            const newLoc = { lat: center.lat, lng: center.lng };
            setLocation(newLoc);
            validatePosition(newLoc.lat, newLoc.lng);
          });
          
          areas.forEach(area => {
            if (area.points) {
              L.polygon(area.points, { color: '#E4002B', weight: 0, fillOpacity: 0 }).addTo(mapRef.current);
            }
          });

          validatePosition(location.lat, location.lng);
        } else {
          mapRef.current.invalidateSize();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [step, locationMethod, isOpen, details.serviceType]);

  const handleAreaSelect = (area: Area) => {
    try {
      setSelectedArea(area);
      setIsOutOfRange(false);
      if (area.points && area.points.length > 0) {
        const center = area.points[0];
        setLocation({ lat: center[0], lng: center[1] });
        // Only update map if we are in map mode and container exists
        if (locationMethod === 'map' && mapRef.current && document.getElementById('map-container')) {
          mapRef.current.setView(center, 14);
        }
      }
    } catch (e) {
      console.error('Area selection error:', e);
    }
  };

  const currentFee = details.serviceType === 'delivery' ? (selectedArea?.fee || 0) : 0;
  
  const discountAmount = useMemo(() => {
    if (!appliedPromo) return 0;
    
    // If no specific categories are restricted, apply to the whole subtotal
    if (!appliedPromo.applicableCategories || appliedPromo.applicableCategories.length === 0) {
      return appliedPromo.discountType === 'percentage' 
        ? (subtotal * appliedPromo.discountValue / 100) 
        : appliedPromo.discountValue;
    }

    // Calculate subtotal for eligible items only
    const eligibleSubtotal = cartItems?.reduce((acc, item) => {
      const isCategoryEligible = appliedPromo.applicableCategories?.includes(item.category);
      const isProductEligible = appliedPromo.applicableProducts?.includes(item.id);
      
      if (isCategoryEligible || isProductEligible) {
        return acc + (item.price * item.quantity);
      }
      return acc;
    }, 0) || 0;

    return appliedPromo.discountType === 'percentage'
      ? (eligibleSubtotal * appliedPromo.discountValue / 100)
      : Math.min(appliedPromo.discountValue, eligibleSubtotal); // Don't discount more than the eligible total
  }, [appliedPromo, subtotal, cartItems]);

  const finalTotal = subtotal + currentFee - discountAmount;

  const handleApplyPromo = async () => {
     setPromoError(null);
     const upcaseCode = promoInput.toUpperCase();
     
     try {
       const { data, error } = await supabase
         .from('promo_codes')
         .select('*')
         .eq('code', upcaseCode)
         .eq('is_active', true)
         .single();

       if (error || !data) {
         setPromoError(isAr ? 'كود غير صحيح' : 'Invalid code');
         return;
       }

       if (data.min_order_value && subtotal < data.min_order_value) {
         setPromoError(isAr ? `الحد الأدنى للطلب ${data.min_order_value} ج.م` : `Min order of ${data.min_order_value} LE required`);
         return;
       }

       setAppliedPromo({ 
         code: data.code, 
         discountType: data.discount_type as any, 
         discountValue: data.discount_value,
         applicableCategories: data.applicable_categories || [],
         applicableProducts: data.applicable_products || []
       });
       setPromoInput('');
     } catch (err) {
       setPromoError(isAr ? 'خطأ في التحقق' : 'Verification error');
     }
  }

  const handleFinalConfirm = async () => {
    if (step < 3) {
       setStep(3);
       return;
    }

    if (!paymentMethod) {
      alert(isAr ? 'برجاء اختيار وسيلة الدفع أولاً' : 'Please select a payment method first');
      return;
    }
    
    const newOrderId = 'CH-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    setOrderId(newOrderId);

    // 1. Save to Supabase
    try {
      await supabase.from('orders').insert([{
        id: newOrderId,
        customer_name: details.name,
        phone: details.phone2 ? `${details.phone} / ${details.phone2}` : details.phone,
        address: `${details.address} [Payment: ${paymentMethod?.toUpperCase()}]`,
        area: selectedArea ? (isAr ? selectedArea.nameAr : selectedArea.nameEn) : 'Pickup/Dine-In',
        location: details.serviceType === 'delivery' ? location : {},
        items: cartItems?.map(item => ({
          name: isAr ? item.nameAr : item.name,
          quantity: item.quantity,
          price: item.price,
          spiciness: item.selectedSpiciness,
          size: item.selectedSize ? (isAr ? item.selectedSize.nameAr : item.selectedSize.nameEn) : null
        })) || [],
        total_price: finalTotal,
        status: 'pending'
      }]);
    } catch(e) { console.error('Supabase Save Error:', e); }

    onConfirm({
      ...details,
      location: details.serviceType === 'delivery' ? { ...location, deliveryFee: currentFee, areaId: selectedArea?.id, address: details.address } : undefined,
      scheduledTime: isScheduling ? scheduledTime : 'Now',
      promoCode: appliedPromo?.code,
      discount: discountAmount
    });

    // 2. Automatically trigger WhatsApp message
    sendOrderToRestaurant(newOrderId);

    // 3. Move to Success Screen
    setStep(4);
  };

  const formatWhatsAppNumber = (num: string) => {
    let cleaned = num.replace(/\D/g, '');
    if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    if (!cleaned.startsWith('20')) cleaned = '20' + cleaned;
    return cleaned;
  };

  const sendOrderToRestaurant = (customId?: string) => {
    const currentOrderId = customId || orderId;
    const targetNumber = formatWhatsAppNumber(config.header.phone);
    let msg = `*NEW ORDER FROM CHICKY WEB*\n`;
    msg += `--------------------------\n`;
    msg += `*Order ID:* ${currentOrderId}\n`;
    msg += `*Customer:* ${details.name}\n`;
    msg += `*Phone:* ${details.phone}${details.phone2 ? ` / ${details.phone2}` : ''}\n`;
    msg += `*Payment:* ${paymentMethod === 'cash' ? 'CASH' : paymentMethod === 'instapay' ? 'InstaPay 💳' : paymentMethod === 'wallet' ? 'Smart Wallet 📱' : 'NOT SELECTED'}\n`;
    msg += `*Service:* ${details.serviceType.toUpperCase()}\n`;
    
    if (details.serviceType === 'delivery') {
      msg += `*Area:* ${isAr ? selectedArea?.nameAr : selectedArea?.nameEn}\n`;
      msg += `*Address:* ${details.address}\n`;
      if (location.lat && location.lng) {
        msg += `*Location Map:* https://www.google.com/maps?q=${location.lat},${location.lng}\n`;
      }
    }
    
    if (isScheduling) {
      msg += `*Schedule:* ${scheduledTime}\n`;
    } else {
      msg += `*Schedule:* ASAP (Now)\n`;
    }

    msg += `\n*Items:*\n`;
    cartItems?.forEach(item => {
      const sizeStr = item.selectedSize ? ` [${item.selectedSize.nameEn}]` : '';
      const spicyStr = item.selectedSpiciness ? ` (${item.selectedSpiciness})` : '';
      const extrasStr = (item.selectedModifiers || [])?.length > 0 ? ` + ${item.selectedModifiers?.map(m => m.nameEn).join(', ')}` : '';
      msg += `• ${item.quantity}x ${item.name}${sizeStr}${spicyStr}${extrasStr}\n`;
    });

    msg += `\n*${isAr ? 'المجموع الفرعي' : 'Subtotal'}:* ${subtotal} ${isAr ? 'ج.م' : 'LE'}\n`;
    if (discountAmount > 0) msg += `*${isAr ? 'الخصم' : 'Discount'}:* -${discountAmount} ${isAr ? 'ج.م' : 'LE'} (${appliedPromo?.code})\n`;
    if (details.serviceType === 'delivery') msg += `*${isAr ? 'توصيل' : 'Delivery'}:* ${currentFee} ${isAr ? 'ج.م' : 'LE'}\n`;
    msg += `\n*${isAr ? 'الإجمالي النهائي' : 'GRAND TOTAL'}: ${finalTotal} ${isAr ? 'ج.م' : 'LE'}* 💰\n`;

    window.open(`https://wa.me/${targetNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const trackOrderOnWhatsApp = () => {
    const targetNumber = formatWhatsAppNumber(config.header.phone);
    const msg = isAr 
      ? `أهلاً تشيكي! أريد تتبع طلبي رقم: ${orderId}`
      : `Hi Chicky! I want to track my order: ${orderId}`;
    window.open(`https://wa.me/${targetNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleFinish = () => {
    onClearCart();
    onClose();
    setStep(1);
    setDetails({...details, serviceType: 'delivery'});
    setAppliedPromo(null);
  };

  const inputClass = `w-full ${isAr ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-white border-2 border-slate-200 rounded-2xl focus:border-red-600 transition-all outline-none font-black text-slate-900 text-base shadow-sm`;
  const labelClass = `text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-2.5 block ${isAr ? 'mr-1' : 'ml-1'}`;

  // STEP RENDERING LOGIC
  const renderStep = () => {
    switch(step) {
      case 1:
        return (
          <div className="space-y-12 animate-reveal py-10">
            <div className="text-center">
               <h3 className="text-3xl font-black brand-font text-slate-900 uppercase tracking-tight leading-tight">
                 {t.chooseService}
               </h3>
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-4">Select how you want to receive your order</p>
            </div>
            
            <div className="grid grid-cols-1 gap-6">
              {[
                { type: 'delivery' as ServiceType, icon: Truck, titleEn: 'Home Delivery', titleAr: 'توصيل للمنزل', descEn: 'Fast & Hot to your door', descAr: 'طلباتك هتوصلك لحد البيت', color: 'bg-red-600' },
                { type: 'pickup' as ServiceType, icon: ShoppingBag, titleEn: 'Self Pickup', titleAr: 'استلام من الفرع', descEn: 'Ready within 15 minutes', descAr: 'اطلب وجهز طلبك واستلمه', color: 'bg-slate-900' },
                { type: 'dine-in' as ServiceType, icon: Utensils, titleEn: 'Dine-In', titleAr: 'تناول بالمطعم', descEn: 'Enjoy our fresh meals inside', descAr: 'هنجهزلك طاولتك ووجبتك', color: 'bg-slate-700' }
              ].map(opt => (
                <button
                  key={opt.type}
                  onClick={() => { setDetails({...details, serviceType: opt.type}); setStep(2); }}
                  className="flex items-center gap-6 p-6 bg-slate-50 rounded-[2.5rem] border-4 border-transparent hover:border-red-600 hover:bg-white transition-all group shadow-sm hover:shadow-xl"
                >
                  <div className={`${opt.color} p-5 rounded-2xl text-white shadow-lg group-hover:scale-110 transition-transform`}>
                    <opt.icon size={28} />
                  </div>
                  <div className="text-left flex-1">
                    <h4 className={`text-xl font-black uppercase ${isAr ? 'font-arabic' : 'brand-font'}`}>{isAr ? opt.titleAr : opt.titleEn}</h4>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{isAr ? opt.descAr : opt.descEn}</p>
                  </div>
                  <ChevronRight className={`text-slate-300 group-hover:text-red-600 ${isAr ? 'rotate-180' : ''}`} />
                </button>
              ))}
            </div>
          </div>
        );
      case 2:
        return (
          <div className="space-y-8 animate-reveal py-4">
             <div className="space-y-6">
                <h3 className={`text-xl font-black ${isAr ? 'font-arabic border-r-4' : 'brand-font border-l-4'} border-red-600 ${isAr ? 'pr-4' : 'pl-4'}`}>{t.recipient}</h3>
                <div>
                  <label className={labelClass}>{t.name}</label>
                  <div className="relative">
                    <User className={`absolute ${isAr ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-300`} size={20} />
                    <input className={inputClass} value={details.name} onChange={e => setDetails({...details, name: e.target.value})} placeholder="e.g. Ahmed Ali" />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{t.phone}</label>
                  <div className="relative">
                    <Phone className={`absolute ${isAr ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-300`} size={20} />
                    <input className={inputClass} type="tel" value={details.phone} onChange={handlePhoneChange} placeholder="01XXXXXXXXX" />
                    {phoneError && <span className="absolute -bottom-6 left-1 text-[10px] font-bold text-red-600 uppercase italic">{phoneError}</span>}
                  </div>
                </div>
                <div>
                  <label className={labelClass}>{isAr ? 'رقم موبايل إضافي (اختياري)' : 'Additional Phone (Optional)'}</label>
                  <div className="relative">
                    <Phone className={`absolute ${isAr ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-300`} size={20} />
                    <input 
                      className={inputClass} 
                      type="tel" 
                      value={details.phone2} 
                      onChange={e => setDetails({...details, phone2: e.target.value.replace(/\D/g, '')})} 
                      placeholder={isAr ? 'رقم آخر للتواصل' : 'Secondary contact number'} 
                    />
                  </div>
                </div>
             </div>

             {details.serviceType === 'delivery' && (
                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-xl font-black ${isAr ? 'font-arabic border-r-4' : 'brand-font border-l-4'} border-red-600 ${isAr ? 'pr-4' : 'pl-4'}`}>{t.location}</h3>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setLocationMethod('map')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${locationMethod === 'map' ? 'bg-white shadow-md' : 'text-slate-400'}`}>
                         {t.mapPin}
                      </button>
                      <button onClick={() => setLocationMethod('list')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${locationMethod === 'list' ? 'bg-white shadow-md' : 'text-slate-400'}`}>
                         {t.areaList}
                      </button>
                    </div>
                  </div>

                  {locationMethod === 'list' ? (
                    <div className="grid grid-cols-2 gap-3 max-h-[250px] overflow-y-auto no-scrollbar p-1">
                      {areas?.map(area => (
                        <button key={area.id} onClick={() => handleAreaSelect(area)} className={`p-4 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-2 group cursor-pointer pointer-events-auto ${selectedArea?.id === area.id ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-50 border-slate-100 hover:border-red-600'}`}>
                           <span className="text-[10px] font-black uppercase tracking-widest">{isAr ? area.nameAr : area.nameEn}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Search Bar for Map */}
                      <div className="relative group">
                        <Search className={`absolute ${isAr ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-600 transition-colors`} size={20} />
                        <input
                          type="text"
                          placeholder={t.mapSearchPlaceholder}
                          value={mapSearch}
                          onChange={(e) => setMapSearch(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && searchLocation()}
                          onFocus={() => mapSearch.length > 2 && setShowMapResults(true)}
                          onBlur={() => setTimeout(() => setShowMapResults(false), 200)}
                          className={inputClass}
                        />

                        {/* Suggestions Dropdown */}
                        {showMapResults && mapSearchResults.length > 0 && (
                          <div className="absolute top-full left-0 right-0 z-[100] mt-2 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-reveal">
                            {mapSearchResults?.map((res, i) => (
                              <button
                                key={i}
                                onClick={() => selectSearchResult(res)}
                                className="w-full px-6 py-4 text-left hover:bg-slate-50 transition-all border-b border-slate-50 last:border-none flex items-start gap-4 group"
                              >
                                <MapPin size={18} className="text-slate-400 group-hover:text-red-600 shrink-0 mt-1" />
                                <div className={isAr ? 'text-right flex-1' : 'text-left flex-1'}>
                                  <p className="text-sm font-black text-slate-900 truncate">
                                    {res.display_name.split(',')[0]}
                                  </p>
                                  <p className="text-[10px] font-bold text-slate-400 truncate uppercase tracking-widest mt-0.5">
                                    {res.display_name.split(',').slice(1, 3).join(',')}
                                  </p>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="relative w-full h-[300px] rounded-[2.5rem] overflow-hidden border-4 border-slate-100 shadow-inner group">
                        <div id="map-container" className="w-full h-full z-0" />
                        
                        {/* Fixed Center Pin Overlay */}
                        <div className="absolute inset-0 pointer-events-none z-10 flex items-center justify-center">
                          <div className="relative flex flex-col items-center">
                            <div className="absolute bottom-full mb-4 px-4 py-2 bg-slate-800/90 text-white text-[10px] font-bold rounded-lg whitespace-nowrap shadow-xl backdrop-blur-sm animate-bounce">
                               {isAr ? 'حرك الخريطة لتحديد الموقع' : 'Move map to set location'}
                            </div>
                            <div className="w-10 h-10 bg-red-600 rounded-full border-4 border-white shadow-2xl flex items-center justify-center transform -translate-y-1/2">
                               <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                                 <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                               </svg>
                            </div>
                          </div>
                        </div>

                        {/* Detect Location Button - Top Right */}
                        <div className="absolute top-6 right-6 z-10">
                           <button onClick={detectLocation} className="bg-slate-50 p-4 rounded-2xl shadow-2xl text-red-600 hover:bg-white transition-all active:scale-90 flex items-center justify-center border-2 border-slate-200">
                              {isDetecting ? <Loader2 className="animate-spin" size={24} /> : <LocateFixed size={24} />}
                           </button>
                        </div>

                        {isCalculating && (
                          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-20 flex items-center justify-center">
                            <Loader2 className="text-red-600 animate-spin" size={32} />
                          </div>
                        )}
                        {isOutOfRange && (
                           <div className="absolute inset-x-4 bottom-4 z-20 bg-red-600 text-white p-4 rounded-2xl shadow-2xl animate-reveal flex items-center gap-3">
                              <AlertCircle size={20} />
                              <div>
                                 <p className="text-[10px] font-black uppercase tracking-widest">{t.outOfRange}</p>
                                 <p className="text-[9px] font-medium opacity-80">{t.outOfRangeSub}</p>
                              </div>
                           </div>
                        )}
                      </div>
                      <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest italic">{t.pinMap}</p>
                    </div>
                  )}

                  <div>
                     <label className={labelClass}>{t.instructions}</label>
                     <textarea 
                        className={inputClass + " h-24 py-4 resize-none " + (details.serviceType === 'delivery' && !details.address ? 'border-red-300' : '')} 
                        placeholder={t.addressPlaceholder}
                        value={details.address}
                        onChange={e => setDetails({...details, address: e.target.value})}
                     />
                  </div>
                </div>
             )}

             <button 
                disabled={!details.name || details.phone.length < 11 || phoneError || (details.serviceType === 'delivery' && (!selectedArea || !details.address))}
                onClick={() => setStep(3)}
                className="w-full bg-slate-900 text-white font-black py-6 rounded-[2rem] shadow-2xl hover:bg-red-600 transition-all flex items-center justify-center gap-4 uppercase tracking-widest text-xs disabled:opacity-20 mt-4 active:scale-95"
             >
                {lang === 'en' ? 'CONTINUE TO SUMMARY' : 'متابعة لملخص الطلب'} <ChevronRight size={18} className={isAr ? 'rotate-180' : ''} />
             </button>
          </div>
        );
      case 3:
        return (
          <div className="space-y-10 animate-reveal py-4">
             <div className="bg-slate-50 p-8 rounded-[3rem] space-y-6">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                   <h3 className="text-lg font-black brand-font text-slate-900 uppercase">{t.orderSummary}</h3>
                   <span className="bg-red-100 text-red-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {details.serviceType === 'delivery' ? (isAr ? 'توصيل' : 'DELIVERY') : 
                       details.serviceType === 'pickup' ? (isAr ? 'استلام' : 'PICKUP') : 
                       (isAr ? 'داخل المطعم' : 'DINE-IN')}
                   </span>
                </div>
                <div className="space-y-4 max-h-[200px] overflow-y-auto no-scrollbar px-2">
                   {cartItems?.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start">
                         <div>
                            <p className="text-sm font-black text-slate-900 uppercase leading-none">{item.quantity}x {isAr ? item.nameAr : item.name}</p>
                            <div className="flex gap-2 mt-1">
                               {item.selectedSize && <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-lg border border-slate-100 uppercase">{isAr ? item.selectedSize.nameAr : item.selectedSize.nameEn}</span>}
                               {item.selectedSpiciness && <span className="text-[10px] font-bold text-red-600 bg-white px-2 py-0.5 rounded-lg border border-slate-100 uppercase italic">{isAr ? 'حار' : 'Spicy'}</span>}
                            </div>
                         </div>
                         <span className="text-xs font-black text-slate-900">{item.price * item.quantity} {isAr ? 'ج.م' : 'LE'}</span>
                      </div>
                   ))}
                </div>
             </div>

             <div className="space-y-6">
                  {/* Promo Code */}
                  <div className="relative">
                     <Tag className={`absolute ${isAr ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-300`} size={20} />
                     <input 
                        className={inputClass} 
                        value={promoInput} 
                        placeholder={isAr ? 'كود الخصم (مثال: WELCOME10)' : 'PROMO CODE (e.g. WELCOME10)'} 
                        onChange={e => setPromoInput(e.target.value)}
                     />
                     <button 
                       onClick={handleApplyPromo}
                       className={`absolute ${isAr ? 'left-2' : 'right-2'} top-1/2 -translate-y-1/2 bg-slate-900 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all`}
                     >
                        {t.apply}
                     </button>
                     {appliedPromo && <span className="absolute -bottom-6 left-1 text-[10px] font-bold text-green-600 uppercase italic">{isAr ? `تم تطبيق خصم: -${discountAmount} ج.م` : `Code Applied: -${discountAmount} LE!`}</span>}
                     {promoError && <span className="absolute -bottom-6 left-1 text-[10px] font-bold text-red-600 uppercase italic">{promoError}</span>}
                  </div>

                  {/* Payment Method */}
                  <div className="bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100 space-y-4">
                     <div className="flex items-center gap-3 mb-2">
                        <Wallet size={18} className="text-red-600" />
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{isAr ? 'طريقة الدفع' : 'PAYMENT METHOD'}</h4>
                     </div>
                     <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'cash', img: 'https://cdn-icons-png.flaticon.com/512/2331/2331941.png', labelAr: 'كاش', labelEn: 'Cash' },
                          { id: 'instapay', labelAr: 'انستا باي', labelEn: 'InstaPay', color: '#4B0082' },
                          { id: 'wallet', icon: Wallet, labelAr: 'محفظة إلكترونية', labelEn: 'E-Wallet', color: 'text-red-500', subAr: '(فودافون كاش، اورانج، اتصالات، وي باي، محافظ البنوك)' }
                        ].map(m => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => setPaymentMethod(m.id as any)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${paymentMethod === m.id ? 'bg-slate-950 border-slate-950 text-white shadow-lg' : 'bg-white border-slate-100 text-slate-400 hover:border-red-600'}`}
                          >
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${paymentMethod === m.id ? 'bg-white/10' : 'bg-slate-50'}`}>
                               {m.id === 'cash' ? (
                                 <img src={m.img} alt={m.labelEn} className="w-full h-full object-contain p-1" />
                               ) : m.id === 'instapay' ? (
                                 <div className={`w-11 h-14 border-2 rounded-lg flex flex-col items-center justify-center gap-0.5 relative overflow-hidden bg-white shadow-inner ${paymentMethod === m.id ? 'border-white' : 'border-[#4B0082]'}`}>
                                    {/* Notch / Dynamic Island */}
                                    <div className={`w-4 h-1 rounded-full absolute top-1 ${paymentMethod === m.id ? 'bg-[#4B0082]' : 'bg-[#4B0082]'}`} />
                                    
                                    <span className={`text-[8px] font-black leading-tight ${paymentMethod === m.id ? 'text-[#4B0082]' : 'text-[#4B0082]'}`}>INSTA</span>
                                    <span className={`text-[9px] font-black leading-tight ${paymentMethod === m.id ? 'text-[#4B0082]' : 'text-orange-500'}`}>PAY</span>
                                    
                                    {/* Home Indicator */}
                                    <div className={`w-5 h-0.5 rounded-full absolute bottom-1 ${paymentMethod === m.id ? 'bg-[#4B0082]' : 'bg-slate-200'}`} />
                                 </div>
                               ) : (
                                 <m.icon size={24} className={paymentMethod === m.id ? 'text-white' : m.color} />
                               )}
                            </div>
                            <div className="flex flex-col items-center gap-1">
                               <span className={`text-[11px] font-black uppercase tracking-wider text-center leading-tight ${paymentMethod === m.id ? 'text-white' : 'text-slate-900'}`}>{isAr ? m.labelAr : m.labelEn}</span>
                               {isAr && m.subAr && (
                                 <span className={`text-[7px] font-bold text-center leading-tight ${paymentMethod === m.id ? 'text-white/60' : 'text-slate-400'}`}>
                                   {m.subAr}
                                 </span>
                               )}
                            </div>
                          </button>
                        ))}
                     </div>
                  </div>

                  {/* Scheduling Section */}
                  <div className={`p-6 rounded-[2.5rem] border-2 transition-all space-y-4 ${isScheduling ? 'bg-white border-red-600 shadow-lg' : 'bg-slate-50 border-slate-100 hover:border-red-600'}`}>
                    
                    {/* Header with Toggle */}
                    <div className="flex items-center justify-between w-full">
                       <div className="flex items-center gap-4">
                          <Clock className={isScheduling ? 'text-red-600' : 'text-slate-300'} size={24} />
                          <div className={isAr ? 'text-right' : 'text-left'}>
                             <h4 className="text-sm font-black text-slate-900 uppercase">{t.scheduleTitle}</h4>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                               {isScheduling ? t.timeSelected : (isAr ? 'اطلب الآن (بأسرع وقت)' : 'Order for ASAP (Now)')}
                             </p>
                          </div>
                       </div>
                       <button 
                         type="button"
                         onClick={() => setIsScheduling(!isScheduling)} 
                         className={`w-12 h-6 rounded-full transition-all flex items-center p-1 ${isScheduling ? 'bg-red-600' : 'bg-slate-200'}`}
                       >
                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all ${isScheduling ? (isAr ? 'translate-x-0' : 'translate-x-6') : (isAr ? 'translate-x-6' : 'translate-x-0')}`} />
                       </button>
                    </div>

                    {/* Time Input - Only shown when active */}
                    {isScheduling && (
                      <div className="animate-reveal">
                        <label htmlFor="time-input" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">
                          {isAr ? 'اختر الموعد المناسب:' : 'CHOOSE YOUR TIME:'}
                        </label>
                        <input 
                           ref={timeInputRef}
                           id="time-input"
                           type="time" 
                           className={inputClass} 
                           value={scheduledTime} 
                           onChange={e => setScheduledTime(e.target.value)}
                        />
                        <p className="text-[9px] font-medium text-slate-400 mt-2 italic px-1">
                          {isAr ? '* يمكنك الضغط على الساعة لاختيار الموعد' : '* Tap the clock icon to select time'}
                        </p>
                      </div>
                    )}
                  </div>
             </div>

             <div className="bg-slate-900 p-10 rounded-[3rem] text-white space-y-4 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600 rounded-bl-[100px] opacity-10 group-hover:scale-150 transition-transform duration-700" />
                <div className="flex justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">
                   <span>{isAr ? 'الإجمالي' : 'SUBTOTAL'}</span>
                   <span>{subtotal} {isAr ? 'ج.م' : 'LE'}</span>
                </div>
                {discountAmount > 0 && (
                   <div className="flex justify-between items-center text-green-400 text-[10px] font-black uppercase tracking-[0.2em] animate-reveal">
                      <span>{isAr ? 'الخصم' : 'DISCOUNT'}</span>
                      <span>-{discountAmount} {isAr ? 'ج.م' : 'LE'}</span>
                   </div>
                )}
                {details.serviceType === 'delivery' && (
                  <div className="flex justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">
                    <span>{isAr ? 'التوصيل' : 'DELIVERY'}</span>
                    <span>{currentFee} {isAr ? 'ج.م' : 'LE'}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 border-t border-white/10">
                   <h4 className="text-2xl font-black brand-font uppercase">{t.total}</h4>
                   <h4 className="text-3xl font-black text-red-500">{finalTotal} {isAr ? 'ج.م' : 'LE'}</h4>
                </div>
             </div>

             <button 
                onClick={handleFinalConfirm}
                className="w-full bg-red-600 text-white font-black py-8 rounded-[2.5rem] shadow-2xl hover:scale-105 active:scale-95 transition-all text-xl tracking-widest uppercase flex items-center justify-center gap-4 group"
             >
                <Sparkles size={24} className="group-hover:animate-spin" />
                {t.placeOrder}
             </button>
          </div>
        );
      case 4:
        return (
          <div className="text-center py-20 space-y-10 animate-scale-up">
            <div className="w-40 h-40 bg-green-100 text-green-600 rounded-[4rem] flex items-center justify-center mx-auto shadow-2xl relative animate-bounce">
              <CheckCircle size={80} strokeWidth={3} />
              <div className="absolute -top-4 -right-4 bg-slate-900 text-white p-4 rounded-[2rem] shadow-xl border-4 border-white rotate-12">
                 <Sparkles size={24} className="text-yellow-400" />
              </div>
            </div>
            
            <div className="space-y-4">
              <h2 className="text-5xl font-black brand-font text-slate-900 uppercase tracking-tighter">{t.successTitle}</h2>
              <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em]">{t.successSub}</p>
            </div>

            <div className="bg-slate-50 p-8 rounded-[3rem] border-4 border-white shadow-inner max-w-xs mx-auto">
               <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2 block">{t.orderRef}</span>
               <h4 className="text-3xl font-black text-slate-950 uppercase tracking-widest">{orderId}</h4>
            </div>

            <div className="bg-slate-50/50 p-6 rounded-[3rem] border-2 border-slate-100 space-y-4">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em]">{t.trackFood}</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => sendOrderToRestaurant()} className="w-full bg-slate-950 text-white font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-4 uppercase tracking-widest text-[10px] hover:bg-red-600 transition-all shadow-xl">
                  <Send size={16} /> {t.sendOrder}
                </button>
                <button onClick={trackOrderOnWhatsApp} className="w-full bg-green-500 text-white font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-4 uppercase tracking-widest text-[10px] hover:bg-green-600 transition-all shadow-xl">
                  <MessageSquare size={16} /> {t.trackWa}
                </button>
              </div>
            </div>

            <button onClick={handleFinish} className="w-full bg-slate-100 text-slate-400 font-black py-6 rounded-[2.5rem] hover:bg-slate-200 hover:text-slate-900 transition-all uppercase tracking-[0.2em] text-[11px]">
              {t.backMenu}
            </button>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-2xl" onClick={onClose} />
      
      <div className="relative bg-white w-full max-w-xl rounded-[4rem] shadow-2xl overflow-hidden animate-scale-up border-[8px] border-white flex flex-col max-h-[92vh]">
        
        {/* Header with Navigation */}
        <div className="px-10 py-8 border-b-2 border-slate-50 flex justify-between items-center bg-white sticky top-0 z-10">
          <div className="flex items-center gap-6">
            {step > 1 && step < 4 && (
              <button onClick={() => setStep(step - 1)} className="p-3 bg-slate-50 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all">
                <ChevronLeft size={24} className={isAr ? 'rotate-180' : ''} />
              </button>
            )}
            <div>
              <h2 className={`text-2xl md:text-3xl font-black ${isAr ? 'font-arabic' : 'brand-font'} text-slate-900 uppercase`}>
                {step === 1 ? (isAr ? 'بدء الطلب' : 'START ORDER') : t.title}
              </h2>
              <div className="flex gap-2 mt-2">
                {[1, 2, 3].map(s => (
                  <div key={s} className={`h-1.5 rounded-full transition-all duration-500 ${step > s ? 'w-10 bg-green-500' : (step === s ? 'w-10 bg-red-600' : 'w-4 bg-slate-100')}`} />
                ))}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-100 rounded-full transition-colors text-slate-300">
            <X size={32} />
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-10">
          {renderStep()}
        </div>

        {/* Footer info (Step 2 & 3) */}
        {step > 1 && step < 4 && (
          <div className="px-10 py-6 border-t-2 border-slate-50 bg-slate-50/50 flex justify-between items-center">
             <div className={isAr ? 'text-right' : 'text-left'}>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{t.itemsInBasket}</p>
                <p className="text-xs font-black text-slate-900 uppercase">{cartItems.length} {t.products}</p>
             </div>
             <div className={isAr ? 'text-left' : 'text-right'}>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">{t.basketTotal}</p>
                <p className="text-xl font-black text-red-600">{finalTotal} {isAr ? 'ج.م' : 'LE'}</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutModal;
