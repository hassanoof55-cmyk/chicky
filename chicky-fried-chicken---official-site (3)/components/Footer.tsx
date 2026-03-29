
import React from 'react';
import { Facebook, Instagram, MapPin, Phone, Settings } from 'lucide-react';
import { SiteConfig, Language } from '../types';
import Logo from './Logo';

const TikTokIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.232 10.192 6.337 6.337 0 0 0 11.32-4.045V8.698a7.92 7.92 0 0 0 5.435 2.551v-3.47a4.797 4.797 0 0 1-2.29-.093z"/>
  </svg>
);

interface FooterProps {
  config: SiteConfig;
  lang: Language;
  onOpenAdmin: () => void;
  scrollToCategory: (id: string) => void;
}

const Footer: React.FC<FooterProps> = ({ config, lang, onOpenAdmin, scrollToCategory }) => {
  const isAr = lang === 'ar';

  return (
    <footer className="bg-slate-950 text-white pt-24 pb-12 border-t-8 border-red-600">
      <div className="max-w-7xl mx-auto px-6 md:px-12 grid grid-cols-1 md:grid-cols-4 gap-16 border-b border-white/5 pb-20">
        <div className="space-y-8">
          <Logo src={config.header.logoWhite} className="h-16" />
          <p className="text-slate-300 text-base leading-relaxed font-medium">
            {isAr ? config.footer.aboutAr : config.footer.aboutEn}
          </p>
          <div className="flex gap-4">
            {[
              { icon: <Facebook size={22} />, link: config.footer.facebook },
              { icon: <Instagram size={22} />, link: config.footer.instagram },
              { icon: <TikTokIcon size={22} />, link: config.footer.tiktok }
            ].map((social, i) => (
              <a key={i} href={social.link} target="_blank" rel="noreferrer" 
                 className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center hover:bg-red-600 hover:scale-110 transition-all shadow-xl">
                {social.icon}
              </a>
            ))}
          </div>
        </div>

        <div className="space-y-8">
          <h4 className="text-sm font-black uppercase tracking-[0.3em] text-red-600 border-b-2 border-red-600/20 pb-4 w-fit">
            {isAr ? 'روابط سريعة' : 'QUICK LINKS'}
          </h4>
          <ul className="space-y-4 text-base font-bold text-slate-400">
            {config.layout.slice(0, 5).map(cat => (
              <li key={cat.id}>
                <button onClick={() => scrollToCategory(cat.id)} className="hover:text-white transition-colors uppercase tracking-widest flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-red-600"></div>
                   {isAr ? cat.nameAr : cat.nameEn}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-8">
          <h4 className="text-sm font-black uppercase tracking-[0.3em] text-red-600 border-b-2 border-red-600/20 pb-4 w-fit">
            {isAr ? 'تواصل معنا' : 'CONTACT US'}
          </h4>
          <div className="space-y-6">
            <a 
              href={config.footer.locationUrl} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="flex items-start gap-4 group hover:bg-white/5 p-2 -m-2 rounded-2xl transition-all"
            >
              <MapPin size={24} className="text-red-600 shrink-0 mt-1 group-hover:scale-110 transition-transform" />
              <p className="text-base text-slate-300 font-bold leading-relaxed group-hover:text-white">
                {isAr ? config.footer.addressAr : config.footer.addressEn}
              </p>
            </a>
            <div className="flex items-center gap-4 group">
              <div className="w-14 h-14 bg-red-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-red-600/30 group-hover:scale-110 transition-all">
                <Phone size={26} className="text-white" />
              </div>
              <div className={isAr ? 'text-right' : 'text-left'}>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block mb-1">HOTLINE</span>
                <p className="text-3xl font-black tracking-tighter text-white">{config.header.phone}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <h4 className="text-sm font-black uppercase tracking-[0.3em] text-red-600 border-b-2 border-red-600/20 pb-4 w-fit">
            {isAr ? 'الإدارة' : 'ADMINISTRATION'}
          </h4>
          <button onClick={onOpenAdmin} className="w-full flex items-center justify-between p-6 bg-white/5 border border-white/10 rounded-3xl hover:bg-white/10 transition-all group border-b-4 border-b-red-600/40">
            <div className={isAr ? 'text-right' : 'text-left'}>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 block">CONTROL PANEL</span>
              <span className="text-sm font-black uppercase tracking-widest text-white">{isAr ? 'لوحة التحكم' : 'OPEN DASHBOARD'}</span>
            </div>
            <Settings size={24} className="text-red-600 group-hover:rotate-180 transition-transform duration-700" />
          </button>
        </div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 md:px-12 pt-12 flex flex-col md:flex-row items-center justify-between gap-6 text-[11px] font-black uppercase tracking-[0.4em] text-slate-500">
        <p>{isAr ? config.footer.copyrightAr : config.footer.copyrightEn}</p>
        <div className="flex gap-8">
          <span className="hover:text-white cursor-pointer transition-colors">PRIVACY</span>
          <span className="hover:text-white cursor-pointer transition-colors">TERMS</span>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
