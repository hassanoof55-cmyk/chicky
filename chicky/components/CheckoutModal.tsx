
import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Truck, MapPin, Phone, User, Loader2, AlertCircle, LayoutList, Map as MapIcon, ChevronRight, ChevronLeft, MessageSquare, Send, Navigation, ShoppingBag, Utensils, Clock, Tag, Sparkles } from 'lucide-react';
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
  const [locationMethod, setLocationMethod] = useState<'map' | 'list'>('list');
  const [details, setDetails] = useState<OrderDetails>({
    name: '',
    phone: '',
    address: '',
    branch: 'Main Branch',
    serviceType: initialServiceType || 'delivery'
  });
  const [appliedPromo, setAppliedPromo] = useState<PromoCode | null>(null);
  const [promoInput, setPromoInput] = useState('');
  const [promoError, setPromoError] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');

  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number}>({ lat: 30.0444, lng: 31.2357 }); 
  const [isCalculating, setIsCalculating] = useState(false);
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const areas = config.areas || [];

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
    autoDetect: isAr ? 'تحديد موقعي تلقائياً' : 'Use Current Location'
  };

  const EgyptianPhoneRegex = /^01[0125][0-9]{8}$/;

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 11);
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

  useEffect(() => {
    if (step === 2 && details.serviceType === 'delivery' && locationMethod === 'map' && isOpen) {
      const timer = setTimeout(() => {
        if (!mapRef.current) {
          mapRef.current = L.map('map-container', { zoomControl: false, center: [location.lat, location.lng], zoom: 13 });
          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);

          const customIcon = L.divIcon({
            html: `<div class="bg-red-600 p-2 rounded-full border-4 border-white shadow-xl flex items-center justify-center transform -translate-y-1/2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
                   </div>`,
            className: 'custom-pin',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
          });

          markerRef.current = L.marker([location.lat, location.lng], { icon: customIcon, draggable: true }).addTo(mapRef.current);
          
          markerRef.current.on('dragend', (e: any) => {
            const pos = e.target.getLatLng();
            const newLoc = { lat: pos.lat, lng: pos.lng };
            setLocation(newLoc);
            validatePosition(newLoc.lat, newLoc.lng);
          });

          mapRef.current.on('click', (e: any) => {
            markerRef.current.setLatLng(e.latlng);
            const newLoc = { lat: e.latlng.lat, lng: e.latlng.lng };
            setLocation(newLoc);
            validatePosition(newLoc.lat, newLoc.lng);
          });
          
          areas.forEach(area => {
            if (area.points) {
              L.polygon(area.points, { color: '#E4002B', weight: 1, fillOpacity: 0.1 }).addTo(mapRef.current);
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
    setSelectedArea(area);
    setIsOutOfRange(false);
    if (area.points && area.points.length > 0) {
      const center = area.points[0];
      setLocation({ lat: center[0], lng: center[1] });
      if (markerRef.current) markerRef.current.setLatLng(center);
      if (mapRef.current) mapRef.current.setView(center, 14);
    }
  };

  const currentFee = details.serviceType === 'delivery' ? (selectedArea?.fee || 0) : 0;
  const discountAmount = appliedPromo ? (appliedPromo.discountType === 'percentage' ? (subtotal * appliedPromo.discountValue / 100) : appliedPromo.discountValue) : 0;
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
         discountValue: data.discount_value 
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
    
    const newOrderId = 'CH-' + Math.random().toString(36).substr(2, 6).toUpperCase();
    setOrderId(newOrderId);

    // 1. Save to Supabase
    try {
      await supabase.from('orders').insert([{
        id: newOrderId,
        details: {
           ...details,
           location: details.serviceType === 'delivery' ? location : null,
           scheduledTime: isScheduling ? scheduledTime : 'Now'
        },
        items: cartItems,
        total: finalTotal,
        status: 'pending'
      }]);
    } catch(e) { console.error(e); }

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

  const sendOrderToRestaurant = (customId?: string) => {
    const currentOrderId = customId || orderId;
    const targetNumber = config.header.phone;
    let msg = `*NEW ORDER FROM CHICKY WEB*\n`;
    msg += `--------------------------\n`;
    msg += `*Order ID:* ${currentOrderId}\n`;
    msg += `*Customer:* ${details.name}\n`;
    msg += `*Phone:* ${details.phone}\n`;
    msg += `*Service:* ${details.serviceType.toUpperCase()}\n`;
    
    if (details.serviceType === 'delivery') {
      msg += `*Area:* ${selectedArea?.nameEn}\n`;
      msg += `*Address:* ${details.address}\n`;
    }
    
    if (isScheduling) {
      msg += `*Schedule:* ${scheduledTime}\n`;
    } else {
      msg += `*Schedule:* ASAP (Now)\n`;
    }

    msg += `\n*Items:*\n`;
    cartItems.forEach(item => {
      const sizeStr = item.selectedSize ? ` [${item.selectedSize.nameEn}]` : '';
      const spicyStr = item.selectedSpiciness ? ` (${item.selectedSpiciness})` : '';
      const extrasStr = (item.selectedModifiers || []).length > 0 ? ` + ${item.selectedModifiers?.map(m => m.nameEn).join(', ')}` : '';
      msg += `• ${item.quantity}x ${item.name}${sizeStr}${spicyStr}${extrasStr}\n`;
    });

    msg += `\n*Subtotal:* ${subtotal} LE\n`;
    if (discountAmount > 0) msg += `*Discount:* -${discountAmount} LE (${appliedPromo?.code})\n`;
    if (details.serviceType === 'delivery') msg += `*Delivery:* ${currentFee} LE\n`;
    msg += `\n*GRAND TOTAL: ${finalTotal} LE* 💰\n`;

    window.open(`https://wa.me/${targetNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const trackOrderOnWhatsApp = () => {
    const targetNumber = config.header.phone;
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
             </div>

             {details.serviceType === 'delivery' && (
                <div className="space-y-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <h3 className={`text-xl font-black ${isAr ? 'font-arabic border-r-4' : 'brand-font border-l-4'} border-red-600 ${isAr ? 'pr-4' : 'pl-4'}`}>{t.location}</h3>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button onClick={() => setLocationMethod('list')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${locationMethod === 'list' ? 'bg-white shadow-md' : 'text-slate-400'}`}>
                         {t.areaList}
                      </button>
                      <button onClick={() => setLocationMethod('map')} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${locationMethod === 'map' ? 'bg-white shadow-md' : 'text-slate-400'}`}>
                         {t.mapPin}
                      </button>
                    </div>
                  </div>

                  {locationMethod === 'list' ? (
                    <div className="grid grid-cols-2 gap-3 max-h-[250px] overflow-y-auto no-scrollbar p-1">
                      {areas.map(area => (
                        <button key={area.id} onClick={() => handleAreaSelect(area)} className={`p-4 rounded-2xl border-2 transition-all text-center flex flex-col items-center gap-2 group ${selectedArea?.id === area.id ? 'bg-red-600 border-red-600 text-white' : 'bg-slate-50 border-slate-100 hover:border-red-600'}`}>
                           <span className="text-[10px] font-black uppercase tracking-widest">{isAr ? area.nameAr : area.nameEn}</span>
                           <span className={`text-[10px] font-black ${selectedArea?.id === area.id ? 'text-white/80' : 'text-red-600'}`}>{area.fee} LE</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="relative w-full h-[250px] rounded-[2.5rem] overflow-hidden border-4 border-slate-100 shadow-inner group">
                        <div id="map-container" className="w-full h-full z-0" />
                        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                           <button onClick={detectLocation} className="bg-white p-3 rounded-2xl shadow-2xl text-red-600 hover:bg-slate-50 transition-all">
                              {isDetecting ? <Loader2 className="animate-spin" size={20} /> : <Navigation size={20} />}
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
                        className={inputClass + " h-24 py-4 resize-none"} 
                        placeholder={t.addressPlaceholder}
                        value={details.address}
                        onChange={e => setDetails({...details, address: e.target.value})}
                     />
                  </div>
                </div>
             )}

             <button 
                disabled={!details.name || details.phone.length < 11 || phoneError || (details.serviceType === 'delivery' && !selectedArea)}
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
                   <h3 className="text-lg font-black brand-font text-slate-900 uppercase">Order Summary</h3>
                   <span className="bg-red-100 text-red-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {details.serviceType}
                   </span>
                </div>
                <div className="space-y-4 max-h-[200px] overflow-y-auto no-scrollbar px-2">
                   {cartItems.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-start">
                         <div>
                            <p className="text-sm font-black text-slate-900 uppercase leading-none">{item.quantity}x {isAr ? item.nameAr : item.name}</p>
                            <div className="flex gap-2 mt-1">
                               {item.selectedSize && <span className="text-[10px] font-bold text-slate-400 bg-white px-2 py-0.5 rounded-lg border border-slate-100 uppercase">{isAr ? item.selectedSize.nameAr : item.selectedSize.nameEn}</span>}
                               {item.selectedSpiciness && <span className="text-[10px] font-bold text-red-600 bg-white px-2 py-0.5 rounded-lg border border-slate-100 uppercase italic">{isAr ? 'حار' : 'Spicy'}</span>}
                            </div>
                         </div>
                         <span className="text-xs font-black text-slate-900">{item.price * item.quantity} LE</span>
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
                       Apply
                    </button>
                    {appliedPromo && <span className="absolute -bottom-6 left-1 text-[10px] font-bold text-green-600 uppercase italic">Code Applied: -{discountAmount} LE!</span>}
                    {promoError && <span className="absolute -bottom-6 left-1 text-[10px] font-bold text-red-600 uppercase italic">{promoError}</span>}
                 </div>

                 {/* Scheduling */}
                 <div className="bg-slate-50 p-6 rounded-[2.5rem] border-2 border-slate-100 space-y-4">
                    <button onClick={() => setIsScheduling(!isScheduling)} className="flex items-center justify-between w-full">
                       <div className="flex items-center gap-4">
                          <Clock className={isScheduling ? 'text-red-600' : 'text-slate-300'} size={24} />
                          <div className="text-left">
                             <h4 className="text-sm font-black text-slate-900 uppercase">Schedule for later?</h4>
                             <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{isScheduling ? 'Time selected' : 'Order for ASAP (Now)'}</p>
                          </div>
                       </div>
                       <div className={`w-12 h-6 rounded-full transition-all flex items-center p-1 ${isScheduling ? 'bg-red-600' : 'bg-slate-200'}`}>
                          <div className={`w-4 h-4 bg-white rounded-full shadow-md transition-all ${isScheduling ? (isAr ? '-translate-x-6' : 'translate-x-6') : ''}`} />
                       </div>
                    </button>
                    {isScheduling && (
                       <input 
                          type="time" 
                          className={inputClass + " mt-2"} 
                          value={scheduledTime} 
                          onChange={e => setScheduledTime(e.target.value)}
                       />
                    )}
                 </div>
             </div>

             <div className="bg-slate-900 p-10 rounded-[3rem] text-white space-y-4 shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-red-600 rounded-bl-[100px] opacity-10 group-hover:scale-150 transition-transform duration-700" />
                <div className="flex justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">
                   <span>{isAr ? 'الإجمالي' : 'SUBTOTAL'}</span>
                   <span>{subtotal} LE</span>
                </div>
                {discountAmount > 0 && (
                   <div className="flex justify-between items-center text-green-400 text-[10px] font-black uppercase tracking-[0.2em] animate-reveal">
                      <span>{isAr ? 'الخصم' : 'DISCOUNT'}</span>
                      <span>-{discountAmount} LE</span>
                   </div>
                )}
                {details.serviceType === 'delivery' && (
                  <div className="flex justify-between items-center text-white/50 text-[10px] font-black uppercase tracking-[0.2em]">
                    <span>{isAr ? 'التوصيل' : 'DELIVERY'}</span>
                    <span>{currentFee} LE</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-4 border-t border-white/10">
                   <h4 className="text-2xl font-black brand-font uppercase">{t.total}</h4>
                   <h4 className="text-3xl font-black text-red-500">{finalTotal} LE</h4>
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
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Items in basket</p>
                <p className="text-xs font-black text-slate-900 uppercase">{cartItems.length} Products</p>
             </div>
             <div className={isAr ? 'text-left' : 'text-right'}>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Basket Total</p>
                <p className="text-xl font-black text-red-600">{finalTotal} LE</p>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutModal;
