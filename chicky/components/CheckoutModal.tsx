
import React, { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Truck, MapPin, Phone, User, Loader2, AlertCircle, LayoutList, Map as MapIcon, ChevronRight, ChevronLeft, MessageSquare, Send, Navigation } from 'lucide-react';
import { OrderDetails, LocationData, Area, CartItem, Language } from '../types';
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
}

const CheckoutModal: React.FC<CheckoutModalProps> = ({ isOpen, onClose, subtotal, onConfirm, cartItems, onClearCart, lang }) => {
  const [step, setStep] = useState(1);
  const [orderId, setOrderId] = useState('');
  const [locationMethod, setLocationMethod] = useState<'map' | 'list'>('list');
  const [details, setDetails] = useState<OrderDetails>({
    name: '',
    phone: '',
    address: '',
    branch: 'Main Branch'
  });
  const [selectedArea, setSelectedArea] = useState<Area | null>(null);
  const [location, setLocation] = useState<{lat: number, lng: number}>({ lat: 30.0444, lng: 31.2357 }); 
  const [isCalculating, setIsCalculating] = useState(false);
  const [isOutOfRange, setIsOutOfRange] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const config = getStoredConfig();
  const areas = config.areas || [];

  const isAr = lang === 'ar';

  const t = {
    title: isAr ? 'إتمام الطلب' : 'CHICKY CHECKOUT',
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
    if (step === 2 && locationMethod === 'map' && isOpen) {
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
  }, [step, locationMethod, isOpen]);

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

  const handleFinalConfirm = async () => {
    const newId = 'CH-' + Math.floor(10000 + Math.random() * 90000);
    setOrderId(newId);

    // 1. Save to Supabase (Global Live Sync)
    try {
      const { error } = await supabase.from('orders').insert({
        id: newId,
        customer_name: details.name,
        phone: details.phone,
        address: details.address,
        area: selectedArea?.nameEn || 'N/A',
        location: { lat: location.lat, lng: location.lng },
        items: cartItems,
        total_price: finalTotal,
        status: 'pending'
      });
      if (error) throw error;
    } catch (err) {
      console.error('Error saving order to Supabase:', err);
    }

    // 2. Save to Local Storage (Fallback)
    try {
      const existingOrders = JSON.parse(localStorage.getItem('chicky_orders') || '[]');
      const newOrder = {
        id: newId,
        customerName: details.name,
        phone: details.phone,
        address: details.address,
        area: selectedArea?.nameEn || 'N/A',
        location: { lat: location.lat, lng: location.lng },
        items: cartItems,
        totalPrice: finalTotal,
        status: 'pending',
        createdAt: new Date().toISOString()
      };
      localStorage.setItem('chicky_orders', JSON.stringify([newOrder, ...existingOrders]));
    } catch (err) {
      console.error('Error saving order locally:', err);
    }

    onConfirm({...details, location: { lat: location.lat, lng: location.lng, address: details.address, deliveryFee: currentFee, areaId: selectedArea?.id }});
    setStep(4);
    sendOrderToRestaurant(newId);
  };

  const sendOrderToRestaurant = (idToUse?: string) => {
    const activeId = idToUse || orderId;
    const targetNumber = '201220062060';
    
    const itemsList = cartItems.map(item => (
      `- ${item.quantity}x ${item.name} (${item.selectedSpiciness || 'Original'}) = ${item.price * item.quantity} LE`
    )).join('\n');

    const mapsLink = `https://www.google.com/maps?q=${location.lat},${location.lng}`;

    const message = encodeURIComponent(
`🍗 *NEW CHICKY ORDER #${activeId}* 🍗
--------------------------
👤 *Customer:* ${details.name}
📞 *Phone:* ${details.phone}
📍 *Address:* ${details.address}
🏙️ *Area:* ${selectedArea?.nameEn || 'N/A'}
🗺️ *Location:* ${mapsLink}

🛒 *Order Items:*
${itemsList}

--------------------------
💰 *Subtotal:* ${subtotal} LE
🚚 *Delivery:* ${currentFee} LE
✨ *TOTAL:* ${subtotal + currentFee} LE
--------------------------
_Sent via Chicky Web App_`
    );

    window.open(`https://wa.me/${targetNumber}?text=${message}`, '_blank');
  };

  const handleFinish = () => {
    onClearCart();
    onClose();
  };


  if (!isOpen) return null;

  const currentFee = selectedArea?.fee || 0;
  const finalTotal = subtotal + currentFee;
  const inputClass = `w-full ${isAr ? 'pr-12 pl-4' : 'pl-12 pr-4'} py-4 bg-white border-2 border-slate-200 rounded-2xl focus:border-red-600 transition-all outline-none font-black text-slate-900 text-base shadow-sm`;
  const labelClass = `text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-2.5 block ${isAr ? 'mr-1' : 'ml-1'}`;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" dir={isAr ? 'rtl' : 'ltr'}>
      <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
      <div className="relative bg-white w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-scale-up border-[6px] border-white flex flex-col max-h-[95vh]">
        <div className="p-8 border-b flex justify-between items-center bg-slate-50 relative">
          <div>
            <h2 className={`text-3xl font-black ${isAr ? 'font-arabic' : 'brand-font'} text-red-600 uppercase`}>{t.title}</h2>
            <div className="flex gap-1 mt-2">
              {[1, 2, 3].map(s => (
                <div key={s} className={`h-1.5 rounded-full transition-all ${step >= s ? 'w-8 bg-red-600' : 'w-4 bg-slate-200'}`} />
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-3 hover:bg-slate-200 rounded-full transition-colors text-slate-400"><X size={24} /></button>
        </div>

        <div className="p-8 overflow-y-auto no-scrollbar flex-1 bg-white">
          {step === 1 && (
            <div className="space-y-8 animate-reveal">
              <div className="space-y-6">
                <h3 className={`text-xl font-black ${isAr ? 'font-arabic border-r-4' : 'brand-font border-l-4'} border-red-600 ${isAr ? 'pr-4' : 'pl-4'}`}>{t.recipient}</h3>
                <div>
                  <label className={labelClass}>{t.name}</label>
                  <div className="relative"><User className={`absolute ${isAr ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={20} /><input type="text" placeholder={isAr ? 'أدخل اسمك' : 'Enter your name'} className={inputClass} value={details.name} onChange={e => setDetails({...details, name: e.target.value})} /></div>
                </div>
                <div>
                  <label className={labelClass}>{t.phone}</label>
                  <div className="relative"><Phone className={`absolute ${isAr ? 'right-4' : 'left-4'} top-1/2 -translate-y-1/2 text-slate-400`} size={20} /><input type="tel" placeholder="01XXXXXXXXX" className={inputClass} value={details.phone} onChange={handlePhoneChange} /></div>
                  {phoneError && <p className="text-[10px] font-black uppercase text-red-500 mt-2">{phoneError}</p>}
                </div>
              </div>
              <button disabled={!details.name || details.phone.length < 11} onClick={() => setStep(2)} className="w-full bg-red-600 text-white font-black py-6 rounded-2xl shadow-xl transition-all uppercase tracking-widest text-lg active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3">
                {t.location} {isAr ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6 animate-reveal">
              <div className="space-y-4">
                <h3 className={`text-xl font-black ${isAr ? 'font-arabic border-r-4' : 'brand-font border-l-4'} border-red-600 ${isAr ? 'pr-4' : 'pl-4'}`}>{t.location}</h3>
                <div className="flex p-1.5 bg-slate-100 rounded-2xl border-2 border-slate-200">
                  <button onClick={() => setLocationMethod('list')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${locationMethod === 'list' ? 'bg-white text-red-600 shadow-md scale-100' : 'text-slate-500 hover:text-slate-700'}`}><LayoutList size={18} /> {t.areaList}</button>
                  <button onClick={() => setLocationMethod('map')} className={`flex-1 flex items-center justify-center gap-3 py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${locationMethod === 'map' ? 'bg-white text-red-600 shadow-md scale-100' : 'text-slate-500 hover:text-slate-700'}`}><MapIcon size={18} /> {t.mapPin}</button>
                </div>
              </div>

              <div className="min-h-[300px] flex flex-col">
                {locationMethod === 'list' ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto pr-2 no-scrollbar animate-reveal">
                    {areas.map(area => (
                      <button key={area.id} onClick={() => handleAreaSelect(area)} className={`w-full flex items-center justify-between p-6 rounded-3xl border-2 transition-all ${isAr ? 'text-right' : 'text-left'} ${selectedArea?.id === area.id ? 'bg-red-50 border-red-600 ring-4 ring-red-50' : 'bg-white border-slate-100 hover:border-slate-300'}`}>
                        <div>
                          <h4 className="font-black text-slate-900 uppercase text-sm">{isAr ? area.nameAr : area.nameEn}</h4>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{isAr ? area.nameEn : area.nameAr}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className={isAr ? 'text-left' : 'text-right'}>
                             <span className="text-[9px] font-black text-slate-400 uppercase block">{isAr ? 'التوصيل' : 'Fee'}</span>
                             <span className="text-sm font-black text-red-600">{area.fee} {isAr ? 'ج.م' : 'LE'}</span>
                          </div>
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${selectedArea?.id === area.id ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-300'}`}>
                            {selectedArea?.id === area.id ? <CheckCircle size={20} /> : (isAr ? <ChevronLeft size={18} /> : <ChevronRight size={18} />)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="relative h-80 w-full rounded-[2.5rem] border-4 border-slate-100 shadow-2xl overflow-hidden animate-reveal group">
                    <div id="map-container" className="w-full h-full"></div>
                    <div className={`absolute top-4 ${isAr ? 'right-4' : 'left-4'} z-20 bg-slate-900/90 text-white px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.2em] backdrop-blur-md border border-white/20`}>
                      {t.pinMap}
                    </div>
                    
                    {/* Auto Detect Button */}
                    <button 
                      onClick={detectLocation}
                      disabled={isDetecting}
                      className={`absolute bottom-4 ${isAr ? 'left-4' : 'right-4'} z-20 bg-white text-red-600 p-4 rounded-full shadow-2xl border-2 border-red-50 hover:bg-red-50 transition-all flex items-center gap-2 active:scale-90`}
                    >
                      {isDetecting ? <Loader2 className="animate-spin" size={20} /> : <Navigation size={20} fill="currentColor" />}
                      <span className="text-[10px] font-black uppercase tracking-widest">{t.autoDetect}</span>
                    </button>

                    {isCalculating && (
                      <div className="absolute inset-0 z-30 bg-white/40 backdrop-blur-sm flex items-center justify-center">
                        <div className="bg-white px-8 py-4 rounded-[2rem] shadow-2xl flex items-center gap-4 border-2 border-red-600">
                          <Loader2 className="text-red-600 animate-spin" size={24} />
                          <span className="text-xs font-black uppercase tracking-widest">{t.validating}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {locationMethod === 'map' && isOutOfRange && !isCalculating && (
                <div className="bg-orange-50 p-5 rounded-3xl border-2 border-orange-200 flex items-center gap-4 animate-reveal shadow-lg shadow-orange-100">
                  <div className="bg-orange-600 p-3 rounded-2xl text-white"><AlertCircle size={24} /></div>
                  <div><h4 className="text-xs font-black text-orange-900 uppercase">{t.outOfRange}</h4><p className="text-[10px] text-orange-700 font-bold uppercase tracking-tight">{t.outOfRangeSub}</p></div>
                </div>
              )}

              {selectedArea && !isCalculating && (
                <div className="bg-slate-900 p-6 rounded-[2.5rem] flex items-center justify-between animate-reveal shadow-2xl shadow-slate-200">
                  <div className="flex items-center gap-4">
                    <div className="bg-red-600 p-4 rounded-2xl text-white shadow-xl shadow-red-500/30 animate-pulse"><Truck size={28} /></div>
                    <div className="text-white">
                      <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">{locationMethod === 'map' ? (isAr ? 'تم تحديد المنطقة' : 'MAP RECOGNIZED') : (isAr ? 'المنطقة المختارة' : 'SELECTED AREA')}</span>
                      <span className="text-xl font-black block leading-none mt-1 uppercase brand-font tracking-wide">{isAr ? selectedArea.nameAr : selectedArea.nameEn}</span>
                    </div>
                  </div>
                  <div className={`text-white bg-white/10 px-4 py-2 rounded-2xl border border-white/5 ${isAr ? 'text-left' : 'text-right'}`}>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">{t.fee}</span>
                    <span className="text-xl font-black block text-red-500">{selectedArea.fee} {isAr ? 'ج.م' : 'LE'}</span>
                  </div>
                </div>
              )}

              <button disabled={!selectedArea || isCalculating} onClick={() => setStep(3)} className={`w-full py-6 rounded-2xl shadow-2xl transition-all uppercase tracking-[0.2em] font-black text-lg active:scale-95 disabled:opacity-30 flex items-center justify-center gap-3 ${selectedArea ? 'bg-red-600 text-white shadow-red-200' : 'bg-slate-100 text-slate-400'}`}>
                {isAr ? 'المتابعة للعنوان' : 'CONTINUE TO ADDRESS'} {isAr ? <ChevronLeft size={20} /> : <ChevronRight size={20} />}
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-8 animate-reveal">
              <div className="space-y-6">
                <h3 className={`text-xl font-black ${isAr ? 'font-arabic border-r-4' : 'brand-font border-l-4'} border-red-600 ${isAr ? 'pr-4' : 'pl-4'}`}>{t.instructions}</h3>
                <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                   <div className={`flex items-center gap-3 mb-4 text-slate-400`}>
                     <MapPin size={18} />
                     <span className="text-[10px] font-black uppercase tracking-widest">{isAr ? 'تفاصيل الموقع الدقيقة' : 'Precise Location Info'}</span>
                   </div>
                   <textarea placeholder={t.addressPlaceholder} className={`w-full bg-white border-2 border-slate-200 rounded-2xl p-5 h-40 focus:border-red-600 transition-all outline-none font-bold text-slate-900 text-sm placeholder:text-slate-300 resize-none shadow-inner`} value={details.address} onChange={e => setDetails({...details, address: e.target.value})} />
                </div>
              </div>
              <button disabled={!details.address} onClick={handleFinalConfirm} className="w-full bg-red-600 text-white font-black py-6 rounded-[2.5rem] shadow-[0_25px_50px_-15px_rgba(228,0,43,0.4)] hover:shadow-[0_30px_60px_-10px_rgba(228,0,43,0.5)] transition-all active:scale-95 uppercase tracking-[0.2em] text-xl">{t.placeOrder}</button>
            </div>
          )}

          {step === 4 && (
            <div className="text-center space-y-10 py-12 animate-reveal">
              <div className="relative inline-block">
                <div className="absolute inset-0 bg-green-500 blur-3xl opacity-20 animate-pulse" />
                <div className="bg-green-100 w-32 h-32 rounded-[3.5rem] flex items-center justify-center mx-auto border-4 border-white shadow-2xl">
                  <CheckCircle size={80} className="text-green-600" />
                </div>
              </div>

              <div>
                <h3 className={`text-4xl font-black ${isAr ? 'font-arabic' : 'brand-font'} uppercase text-slate-900 leading-none`}>{t.successTitle}</h3>
                <p className="text-slate-400 font-black text-sm uppercase tracking-[0.3em] mt-4">{t.successSub}</p>
              </div>

              <div className="space-y-4">
                <div className="bg-slate-900 p-6 rounded-3xl text-center border-b-4 border-red-600 shadow-xl">
                  <p className="text-[10px] font-black text-red-500 uppercase tracking-[0.4em] mb-2">{t.orderRef}</p>
                  <span className="text-4xl font-black text-white brand-font tracking-widest">{orderId}</span>
                </div>

                <div className={`bg-slate-50 p-6 rounded-3xl ${isAr ? 'text-right' : 'text-left'} border border-slate-100`}>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">{t.trackFood}</p>
                  <div className="space-y-3">
                    <button onClick={() => sendOrderToRestaurant()} className="w-full bg-slate-950 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 text-xs tracking-widest uppercase border-2 border-slate-950">
                      <Send size={18} className={isAr ? 'rotate-180' : ''} /> {t.sendOrder}
                    </button>
                    <button onClick={() => { const targetNumber = '201220062060'; const msg = isAr ? `مرحباً شيكي! 🍗 أريد تتبع الطلب رقم #${orderId}.` : `Hello Chicky! 🍗 I'd like to track my order #${orderId}.`; window.open(`https://wa.me/${targetNumber}?text=${encodeURIComponent(msg)}`, '_blank'); }} className="w-full bg-green-500 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg active:scale-95 text-xs tracking-widest uppercase">
                      <MessageSquare size={18} fill="white" /> {t.trackWa}
                    </button>
                  </div>
                </div>
              </div>

              <button onClick={handleFinish} className="w-full bg-slate-100 text-slate-400 font-black py-6 rounded-[2.5rem] hover:bg-slate-200 transition-all uppercase tracking-widest text-lg active:scale-95">{t.backMenu}</button>
            </div>
          )}
        </div>

        {step < 4 && (
          <div className="p-8 bg-slate-50 border-t border-slate-100 mt-auto flex justify-between items-center shadow-inner">
            <div className={isAr ? 'text-right' : 'text-left'}>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">{t.total}</span>
              <span className="text-3xl font-black text-slate-900 brand-font tracking-tight">{finalTotal} <span className="text-sm opacity-50">{isAr ? 'ج.م' : 'LE'}</span></span>
            </div>
            {selectedArea && (
              <div className={`flex flex-col ${isAr ? 'items-start' : 'items-end'}`}>
                <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-green-200">
                  <Truck size={12} /> {selectedArea.fee} {isAr ? 'ج.م توصيل' : 'LE DELIVERED'}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutModal;
