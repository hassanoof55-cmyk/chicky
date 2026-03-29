
import React from 'react';
import { MessageSquare } from 'lucide-react';
import { Language } from '../types';

interface WhatsAppFloatProps {
  phone: string;
  lang: Language;
}

const WhatsAppIcon = ({ size = 28 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M17.472 14.382c-.301-.15-1.767-.867-2.045-.967-.279-.1-.481-.15-.68.15-.199.299-.765.967-.937 1.166-.171.199-.343.225-.644.075-.301-.15-1.27-.467-2.42-1.496-.895-.798-1.5-1.783-1.676-2.083-.176-.3-.019-.462.13-.61.135-.133.301-.35.451-.524.15-.174.199-.299.301-.498.101-.199.051-.374-.025-.524-.075-.15-.68-1.637-.932-2.247-.245-.59-.496-.51-.68-.52-.175-.01-.376-.01-.577-.01-.201 0-.527.075-.803.374-.276.3-1.053 1.03-1.053 2.512 0 1.482 1.078 2.912 1.228 3.112.15.199 2.122 3.24 5.141 4.542.717.31 1.277.495 1.711.633.721.23 1.376.198 1.894.12.577-.087 1.767-.722 2.016-1.42.25-.699.25-1.298.175-1.422-.075-.125-.276-.199-.577-.35zM12 21.844l-.014.004c-1.69 0-3.344-.455-4.788-1.314l-.344-.204-3.56.933.95-3.47-.224-.356c-.943-1.5-1.441-3.236-1.441-5.018 0-5.118 4.164-9.282 9.285-9.282 2.481 0 4.812.966 6.565 2.72s2.72 4.085 2.72 6.562c0 5.122-4.164 9.286-9.285 9.286zM12 2C6.477 2 2 6.477 2 12c0 1.889.524 3.725 1.517 5.316L2 22l4.809-1.261c1.513.824 3.22 1.258 4.975 1.258.016 0 .032 0 .048-.001C17.523 21.996 22 17.521 22 12c0-2.671-1.04-5.182-2.929-7.071C17.182 3.04 14.671 2 12 2z"/>
  </svg>
);

const WhatsAppFloat: React.FC<WhatsAppFloatProps> = ({ phone, lang }) => {
  const isAr = lang === 'ar';
  const message = isAr 
    ? encodeURIComponent('مرحباً شيكي! 🍗 أريد طلب وجبة شهية الآن.') 
    : encodeURIComponent('Hello Chicky! 🍗 I want to order a delicious meal now.');

  const whatsappUrl = `https://wa.me/20${phone}?text=${message}`;

  return (
    <div className={`fixed bottom-8 ${isAr ? 'left-8' : 'right-8'} z-[100] group`}>
      {/* Label Tooltip */}
      <div className={`absolute bottom-full ${isAr ? 'left-0' : 'right-0'} mb-4 px-5 py-2.5 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-2xl whitespace-nowrap opacity-0 group-hover:opacity-100 transition-all transform translate-y-2 group-hover:translate-y-0 pointer-events-none shadow-2xl`}>
        {isAr ? 'اطلب عبر واتساب' : 'Order on WhatsApp'}
        <div className={`absolute top-full ${isAr ? 'left-6' : 'right-6'} border-8 border-transparent border-t-slate-900`}></div>
      </div>

      {/* Pulsing Aura */}
      <div className="absolute inset-0 bg-[#25D366] rounded-full animate-ping opacity-20 scale-150"></div>
      
      {/* Main Button */}
      <a 
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="relative flex items-center justify-center w-16 h-16 bg-[#25D366] text-white rounded-full shadow-[0_15px_30px_-5px_rgba(37,211,102,0.5)] hover:shadow-[0_20px_40px_-5px_rgba(37,211,102,0.6)] hover:scale-110 active:scale-90 transition-all duration-300 overflow-hidden group"
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        <WhatsAppIcon size={32} />
      </a>
    </div>
  );
};

export default WhatsAppFloat;
