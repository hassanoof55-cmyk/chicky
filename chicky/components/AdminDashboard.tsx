
import React, { useState, useRef, useEffect } from 'react';
import { 
  X, Plus, Edit2, Trash2, Search, Layout, Database, 
  Settings2, Truck, Map as MapIcon, AppWindow,
  Sparkles, Star, Flame, Image as ImageIcon, Save,
  ChevronRight, Phone, Globe, Facebook, Instagram, Upload, FileImage, 
  RotateCcw, Layers, Hash, Check, Trash, Info, Key, MapPin,
  Palette, Share2, BarChart3, ListOrdered, AlignLeft, Eye, Tag as TagIcon,
  ArrowRight, MousePointer2, Navigation, CheckCircle2
} from 'lucide-react';
import { Product, SiteConfig, Area, HeroBanner, TagConfig, CategoryConfig, OrderDetails, StoredOrder } from '../types';

declare var L: any;

const TikTokIcon = ({ size = 18, className = "" }: { size?: number; className?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className} xmlns="http://www.w3.org/2000/svg">
    <path d="M19.589 6.686a4.793 4.793 0 0 1-3.77-4.245V2h-3.445v13.672a2.896 2.896 0 0 1-5.201 1.743l-.002-.001.002.001a2.895 2.895 0 0 1 3.183-4.51v-3.5a6.329 6.329 0 0 0-5.232 10.192 6.337 6.337 0 0 0 11.32-4.045V8.698a7.92 7.92 0 0 0 5.435 2.551v-3.47a4.797 4.797 0 0 1-2.29-.093z"/>
  </svg>
);

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  menu: Product[];
  onUpdateMenu: (newMenu: Product[]) => void;
  config: SiteConfig;
  onUpdateConfig: (newConfig: SiteConfig) => void;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ isOpen, onClose, menu, onUpdateMenu, config, onUpdateConfig }) => {
  const [activeTab, setActiveTab] = useState<'menu' | 'builder' | 'areas' | 'orders'>('menu');
  const [builderSubTab, setBuilderSubTab] = useState<'branding' | 'hero' | 'categories' | 'tags' | 'social'>('branding');
  const [orders, setOrders] = useState<StoredOrder[]>([]);
  
  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const productFileInputRef = useRef<HTMLInputElement>(null);

  const logoRedFileInputRef = useRef<HTMLInputElement>(null);
  const logoWhiteFileInputRef = useRef<HTMLInputElement>(null);

  const [isBannerFormOpen, setIsBannerFormOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Partial<HeroBanner> | null>(null);
  const bannerFileInputRef = useRef<HTMLInputElement>(null);

  const [newCat, setNewCat] = useState({ en: '', ar: '' });
  const [newTag, setNewTag] = useState({ en: '', ar: '' });

  const [drawingMode, setDrawingMode] = useState(false);
  const [currentPolygonPoints, setCurrentPolygonPoints] = useState<[number, number][]>([]);
  const [newArea, setNewArea] = useState<Partial<Area>>({ nameEn: '', nameAr: '', fee: 0 });
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  const [localFilterLabelEn, setLocalFilterLabelEn] = useState(config.filterLabelEn || '');
  const [localFilterLabelAr, setLocalFilterLabelAr] = useState(config.filterLabelAr || '');


  const adminMapRef = useRef<any>(null);
  const drawingLayerRef = useRef<any>(null);
  const ghostLayerRef = useRef<any>(null);
  const existingZonesLayerRef = useRef<any>(null);
  const drawingModeRef = useRef(false);

  useEffect(() => { drawingModeRef.current = drawingMode; }, [drawingMode]);

  useEffect(() => {
    setLocalFilterLabelEn(config.filterLabelEn || '');
    setLocalFilterLabelAr(config.filterLabelAr || '');
  }, [config.filterLabelEn, config.filterLabelAr]);

  useEffect(() => {
    if (!drawingLayerRef.current) return;
    drawingLayerRef.current.clearLayers();
    if (currentPolygonPoints.length > 0) {
      currentPolygonPoints.forEach((p) => {
        L.circleMarker(p, { 
          radius: 6, 
          color: config.theme.primaryColor, 
          fillColor: '#FFF', 
          fillOpacity: 1, 
          weight: 3 
        }).addTo(drawingLayerRef.current);
      });
      if (currentPolygonPoints.length > 1) {
        L.polyline(currentPolygonPoints, { color: config.theme.primaryColor, weight: 3 }).addTo(drawingLayerRef.current);
      }
      if (currentPolygonPoints.length > 2) {
        L.polygon(currentPolygonPoints, { 
          color: config.theme.primaryColor, 
          fillColor: config.theme.primaryColor, 
          fillOpacity: 0.2 
        }).addTo(drawingLayerRef.current);
      }
    }
  }, [currentPolygonPoints, config.theme.primaryColor]);

  useEffect(() => {
    if (activeTab === 'areas' && isOpen) {
      const timer = setTimeout(() => {
        if (!adminMapRef.current) {
          adminMapRef.current = L.map('admin-logistics-map').setView([30.0444, 31.2357], 11);
          L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png').addTo(adminMapRef.current);
          
          drawingLayerRef.current = L.layerGroup().addTo(adminMapRef.current);
          ghostLayerRef.current = L.layerGroup().addTo(adminMapRef.current);
          existingZonesLayerRef.current = L.layerGroup().addTo(adminMapRef.current);

          adminMapRef.current.on('click', (e: any) => {
            if (!drawingModeRef.current) return;
            setCurrentPolygonPoints(prev => [...prev, [e.latlng.lat, e.latlng.lng]]);
          });

          adminMapRef.current.on('mousemove', (e: any) => {
            if (!drawingModeRef.current || currentPolygonPoints.length === 0) return;
            ghostLayerRef.current.clearLayers();
            const last = currentPolygonPoints[currentPolygonPoints.length - 1];
            L.polyline([last, [e.latlng.lat, e.latlng.lng]], { 
              color: config.theme.primaryColor, 
              dashArray: '5,10', 
              opacity: 0.5 
            }).addTo(ghostLayerRef.current);
          });
        }
        adminMapRef.current.invalidateSize();
        refreshExistingZones();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [activeTab, isOpen, config.areas, config.theme.primaryColor]);

  const refreshExistingZones = () => {
    if (!existingZonesLayerRef.current) return;
    existingZonesLayerRef.current.clearLayers();
    config.areas.forEach(area => {
      if (area.points && area.points.length > 0) {
        const poly = L.polygon(area.points, { 
          color: selectedAreaId === area.id ? config.theme.primaryColor : '#475569', 
          weight: selectedAreaId === area.id ? 4 : 2, 
          fillOpacity: selectedAreaId === area.id ? 0.3 : 0.1,
          fillColor: config.theme.primaryColor
        }).addTo(existingZonesLayerRef.current);
        
        poly.bindTooltip(area.nameAr + ' (' + area.fee + ' LE)', { 
          permanent: false, 
          direction: 'center',
          className: 'brand-tooltip font-black uppercase text-[10px]'
        });

        poly.on('click', () => setSelectedAreaId(area.id));
      }
    });
  };

  useEffect(() => {
    refreshExistingZones();
  }, [selectedAreaId]);

  const focusOnArea = (area: Area) => {
    setSelectedAreaId(area.id);
    if (area.points && area.points.length > 0) {
      adminMapRef.current.fitBounds(L.polygon(area.points).getBounds(), { padding: [50, 50] });
    }
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    
    let newMenu: Product[];
    if (editingProduct.id) {
       newMenu = menu.map(p => p.id === editingProduct.id ? editingProduct as Product : p);
    } else {
       newMenu = [...menu, { ...editingProduct, id: 'p' + Date.now() } as Product];
    }
    onUpdateMenu(newMenu);
    setIsProductFormOpen(false);
  };

  const handleSaveBanner = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    const banners = [...config.hero.banners];
    if (editingBanner.id) {
      const idx = banners.findIndex(b => b.id === editingBanner.id);
      banners[idx] = editingBanner as HeroBanner;
    } else {
      banners.push({ ...editingBanner, id: 'b' + Date.now() } as HeroBanner);
    }
    
    onUpdateConfig({ ...config, hero: { banners } });
    setIsBannerFormOpen(false);
  };

  const handleAddCategory = () => {
    if (!newCat.en.trim() || !newCat.ar.trim()) return;
    const newLayout = [...config.layout, { id: 'cat_' + Date.now(), nameEn: newCat.en.trim(), nameAr: newCat.ar.trim() }];
    onUpdateConfig({ ...config, layout: newLayout });
    setNewCat({ en: '', ar: '' });
  };

  const handleAddTag = () => {
    const en = newTag.en.trim();
    const ar = newTag.ar.trim();
    if (!en || !ar) return;
    const tag = { id: 'tag_' + Date.now(), nameEn: en, nameAr: ar };
    onUpdateConfig({ ...config, tags: [...config.tags, tag] });
    setNewTag({ en: '', ar: '' });
  };

  const toggleProductTag = (tagName: string) => {
    if (!editingProduct) return;
    const currentTags = editingProduct.tags || [];
    const newTags = currentTags.includes(tagName) 
      ? currentTags.filter(t => t !== tagName)
      : [...currentTags, tagName];
    setEditingProduct({ ...editingProduct, tags: newTags });
  };

  const handleFile = (file: File, type: 'banner' | 'product' | 'logoRed' | 'logoWhite') => {
    if (!file.type.startsWith('image/')) return;
    
    // For local-only, use FileReader to generate a base64 string
    const reader = new FileReader();
    reader.onloadend = () => {
      const publicUrl = reader.result as string;
      if (type === 'banner' && editingBanner) { setEditingBanner({ ...editingBanner, image: publicUrl }); } 
      else if (type === 'product' && editingProduct) { setEditingProduct({ ...editingProduct, image: publicUrl }); } 
      else if (type === 'logoRed') { onUpdateConfig({ ...config, header: { ...config.header, logoRed: publicUrl } }); } 
      else if (type === 'logoWhite') { onUpdateConfig({ ...config, header: { ...config.header, logoWhite: publicUrl } }); }
    };
    reader.readAsDataURL(file);
  };


  if (!isOpen) return null;

  const inputStyle = "w-full p-4 bg-white border-2 border-slate-200 rounded-2xl outline-none focus:border-red-600 transition-all font-black text-slate-900 text-base shadow-sm";
  const labelStyle = "text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-2.5 block ml-1";
  const cardStyle = "bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 shadow-sm space-y-10";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/98 backdrop-blur-2xl" onClick={onClose} />
      <div className="relative bg-white w-full max-w-7xl h-[94vh] rounded-[4rem] shadow-2xl overflow-hidden flex flex-col border-[8px] border-white animate-scale-up">
        
        <div className="w-full bg-slate-50 border-b-2 border-slate-100 flex items-center justify-between px-10 py-6 shrink-0">
          <div className="flex items-center gap-6">
            <div className="bg-red-600 p-3 rounded-2xl shadow-xl shadow-red-100 text-white">
              <Database size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black brand-font text-red-600 tracking-tighter uppercase leading-none">DASHBOARD</h2>
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.4em] mt-1">ADMIN V10.2 • TOP-BAR NAV</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-slate-200/50 p-1.5 rounded-[2rem]">
            <button onClick={() => setActiveTab('orders')} className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-[10px] font-black tracking-widest transition-all ${activeTab === 'orders' ? 'bg-white text-red-600 shadow-xl' : 'text-slate-500 hover:bg-white'}`}><ListOrdered size={16} /> ORDERS</button>
            <button onClick={() => setActiveTab('areas')} className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-[10px] font-black tracking-widest transition-all ${activeTab === 'areas' ? 'bg-white text-red-600 shadow-xl' : 'text-slate-500 hover:bg-white'}`}><Truck size={16} /> LOGISTICS</button>
            <button onClick={() => setActiveTab('builder')} className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-[10px] font-black tracking-widest transition-all ${activeTab === 'builder' ? 'bg-white text-red-600 shadow-xl' : 'text-slate-500 hover:bg-white'}`}><Settings2 size={16} /> BUILDER</button>
            <button onClick={() => setActiveTab('menu')} className={`flex items-center gap-3 px-8 py-4 rounded-[1.5rem] text-[10px] font-black tracking-widest transition-all ${activeTab === 'menu' ? 'bg-white text-red-600 shadow-xl' : 'text-slate-500 hover:bg-white'}`}><Database size={16} /> MENU</button>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={onClose} className="flex items-center gap-3 px-6 py-4 bg-red-50 text-red-600 rounded-[1.5rem] font-black text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all shadow-sm group">
              <RotateCcw size={16} className="group-hover:-rotate-90 transition-transform" /> Back to App
            </button>
            <button onClick={onClose} className="p-4 bg-slate-200 hover:bg-red-600 hover:text-white rounded-full transition-all text-slate-500">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-white">
          <div className="flex-1 overflow-y-auto no-scrollbar p-12 bg-slate-50/50">


            {activeTab === 'orders' && (
              <div className="space-y-10 animate-reveal pb-20">
                <div className="flex items-center justify-between bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm">
                  <h3 className="text-3xl font-black brand-font uppercase text-slate-900">Customer Orders</h3>
                  <button onClick={() => { if(confirm('Clear all orders?')) { localStorage.removeItem('chicky_orders'); setOrders([]); } }} className="text-[10px] font-black uppercase text-red-600 tracking-widest hover:underline">Clear History</button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {orders.length === 0 ? (
                    <div className="bg-white p-20 rounded-[3.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300 italic">
                      No orders recorded yet.
                    </div>
                  ) : (
                    orders.map(order => (
                      <div key={order.id} className="bg-white p-10 rounded-[4rem] border-2 border-slate-50 shadow-sm hover:border-red-600 transition-all flex flex-col gap-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-8">
                          <div className="flex items-center gap-6">
                            <div className="w-16 h-16 bg-slate-900 text-white rounded-3xl flex items-center justify-center font-black brand-font text-lg shadow-xl shrink-0">
                              {order.id.slice(-2)}
                            </div>
                            <div>
                               <h4 className="font-black text-2xl text-slate-900 tracking-tight leading-none mb-2 capitalize">{order.customerName}</h4>
                               <div className="flex items-center gap-4">
                                 <span className="text-[10px] font-black text-red-600 uppercase tracking-widest bg-red-50 px-3 py-1 rounded-full">{order.id}</span>
                                 <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(order.createdAt).toLocaleString()}</span>
                               </div>
                            </div>
                          </div>
                          <div className="flex gap-4 items-center">
                             <div className="text-right">
                               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Price</span>
                               <span className="text-2xl font-black text-slate-900">{order.totalPrice} LE</span>
                             </div>
                             <div className={`p-4 rounded-2xl flex items-center gap-3 border-2 ${
                               order.status === 'pending' ? 'bg-orange-50 border-orange-100 text-orange-600' : 
                               order.status === 'completed' ? 'bg-green-50 border-green-100 text-green-600' : 
                               'bg-slate-50 border-slate-100 text-slate-400'
                             }`}>
                               <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${
                                 order.status === 'pending' ? 'bg-orange-600' : order.status === 'completed' ? 'bg-green-600' : 'bg-slate-400'
                               }`} />
                               <span className="text-[10px] font-black uppercase tracking-widest font-arabic">{order.status === 'pending' ? 'قيد التنفيذ' : order.status === 'completed' ? 'تم التوصيل' : 'ملغي'}</span>
                             </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                          <div className="space-y-6">
                             <div className="space-y-4">
                                <h5 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-3">
                                  <Truck size={14} className="text-red-600" /> Delivery Details
                                </h5>
                                <div className="space-y-3">
                                   <div className="flex items-center gap-4 text-slate-900 font-bold">
                                      <Phone size={16} className="text-slate-300" /> {order.phone}
                                   </div>
                                   <div className="flex items-start gap-4 text-slate-500 font-medium text-sm leading-relaxed">
                                      <MapPin size={16} className="text-slate-300 mt-1 shrink-0" /> {order.address} ({order.area})
                                   </div>
                                   <a 
                                    href={`https://www.google.com/maps?q=${order.location.lat},${order.location.lng}`} 
                                    target="_blank" 
                                    rel="noreferrer"
                                    className="flex items-center gap-3 text-[10px] font-black text-red-600 uppercase tracking-widest hover:underline pt-2"
                                   >
                                     <Navigation size={14} fill="currentColor" /> View Exact Pin on Maps
                                   </a>
                                </div>
                             </div>
                          </div>
                          
                          <div className="space-y-4">
                             <h5 className="text-[11px] font-black text-slate-300 uppercase tracking-[0.3em] flex items-center gap-3">
                               <Layout size={14} className="text-red-600" /> Order Summary
                             </h5>
                             <div className="bg-slate-50 rounded-3xl p-6 space-y-4">
                                {order.items.map((item, idx) => (
                                  <div key={idx} className="flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-3">
                                      <span className="w-7 h-7 bg-white rounded-lg flex items-center justify-center font-black text-[10px] border border-slate-100">{item.quantity}x</span>
                                      <span className="font-bold text-slate-900">{item.name}</span>
                                      {item.selectedSpiciness && (
                                        <span className={`text-[8px] font-black px-2 py-0.5 rounded uppercase border ${item.selectedSpiciness === 'Spicy' ? 'border-red-200 text-red-600 bg-red-50' : 'border-slate-200 text-slate-400 bg-white'}`}>
                                          {item.selectedSpiciness}
                                        </span>
                                      )}
                                    </div>
                                    <span className="font-black text-slate-400">{item.price * item.quantity} LE</span>
                                  </div>
                                ))}
                             </div>
                          </div>
                        </div>

                        <div className="flex gap-4 pt-4 border-t border-slate-50">
                           <button onClick={() => { 
                             const updated = orders.map(o => o.id === order.id ? {...o, status: 'completed' as const} : o);
                             localStorage.setItem('chicky_orders', JSON.stringify(updated));
                             setOrders(updated);
                           }} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 transition-all active:scale-95 shadow-lg">Mark as Completed</button>
                           
                           <button onClick={() => { 
                             const updated = orders.map(o => o.id === order.id ? {...o, status: 'cancelled' as const} : o);
                             localStorage.setItem('chicky_orders', JSON.stringify(updated));
                             setOrders(updated);
                           }} className="py-4 px-8 bg-slate-100 text-slate-400 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 hover:text-red-600 transition-all active:scale-95">Cancel</button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            {activeTab === 'menu' && (
              <div className="space-y-10 animate-reveal pb-20">
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm">
                  <div className="relative w-full md:w-[400px]">
                    <Search className="absolute left-7 top-1/2 -translate-y-1/2 text-slate-400" size={24} />
                    <input placeholder="Search menu..." className={inputStyle + " pl-16 bg-slate-50 border-none h-18 text-lg font-bold"} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                  </div>
                  <button onClick={() => { setEditingProduct({ name: '', nameAr: '', price: 0, originalPrice: 0, category: config.layout[0]?.id || '', image: '', tags: [], description: '', descriptionAr: '' }); setIsProductFormOpen(true); }} 
                    className="w-full md:w-auto bg-red-600 text-white font-black px-12 py-6 rounded-[2.5rem] flex items-center justify-center gap-4 uppercase text-sm tracking-widest shadow-2xl shadow-red-200 hover:scale-105 transition-all">
                    <Plus size={24} strokeWidth={4} /> Add New Item
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {menu.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()) || p.nameAr.includes(searchTerm)).map(product => {
                    const cat = config.layout.find(c => c.id === product.category);
                    const hasDiscount = product.originalPrice && product.originalPrice > product.price;
                    return (
                      <div key={product.id} className="bg-white p-8 rounded-[3.5rem] border-2 border-slate-50 flex flex-col sm:flex-row items-center gap-10 group hover:border-red-600 transition-all shadow-sm relative overflow-hidden">
                        <div className="relative shrink-0">
                           <img src={product.image} className="w-28 h-28 rounded-[2.5rem] object-cover bg-slate-100 shadow-inner ring-4 ring-slate-50" />
                           {product.isSpicy && <div className="absolute -top-3 -left-3 bg-red-600 text-white p-2.5 rounded-2xl shadow-xl animate-pulse"><Flame size={18} fill="currentColor" /></div>}
                        </div>
                        <div className="flex-1 space-y-4 text-center sm:text-left">
                          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                             <h4 className="font-black text-slate-900 uppercase text-xl leading-none">{product.name}</h4>
                             <span className="bg-red-50 text-red-600 text-[9px] font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] border border-red-100">{cat?.nameEn}</span>
                          </div>
                          <div className="flex items-center justify-center sm:justify-start gap-6">
                             <div className="flex flex-col">
                                <span className="text-2xl font-black text-red-600">{product.price} LE</span>
                                {hasDiscount && (
                                   <span className="text-[10px] font-black text-slate-300 line-through uppercase">بدلاً من {product.originalPrice} LE</span>
                                )}
                             </div>
                             <div className="h-8 w-px bg-slate-100 hidden sm:block" />
                             <div className="text-right">
                                <span className="text-lg font-black block leading-none font-arabic">{product.nameAr}</span>
                             </div>
                          </div>
                        </div>
                        <div className="flex sm:flex-col gap-3 shrink-0">
                          <button onClick={() => { setEditingProduct(product); setIsProductFormOpen(true); }} className="p-4 bg-slate-50 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-[1.5rem] transition-all"><Edit2 size={20} /></button>
                          <button onClick={() => { onUpdateMenu(menu.filter(p => p.id !== product.id)); }} className="p-4 bg-slate-50 text-slate-300 hover:text-slate-900 hover:bg-slate-100 rounded-[1.5rem] transition-all"><Trash2 size={20} /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'builder' && (
              <div className="flex gap-10 h-full animate-reveal pb-20">
                <div className="w-64 space-y-3 shrink-0">
                  <button onClick={() => setBuilderSubTab('branding')} className={`w-full text-left px-8 py-6 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all ${builderSubTab === 'branding' ? 'bg-red-600 text-white shadow-xl' : 'text-slate-500 hover:bg-white'}`}><ImageIcon size={16} className="inline mr-3"/> Visuals</button>
                  <button onClick={() => setBuilderSubTab('hero')} className={`w-full text-left px-8 py-6 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all ${builderSubTab === 'hero' ? 'bg-red-600 text-white shadow-xl' : 'text-slate-500 hover:bg-white'}`}><Sparkles size={16} className="inline mr-3"/> Hero Offers</button>
                  <button onClick={() => setBuilderSubTab('categories')} className={`w-full text-left px-8 py-6 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all ${builderSubTab === 'categories' ? 'bg-red-600 text-white shadow-xl' : 'text-slate-500 hover:bg-white'}`}><ListOrdered size={16} className="inline mr-3"/> Categories</button>
                  <button onClick={() => setBuilderSubTab('tags')} className={`w-full text-left px-8 py-6 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all ${builderSubTab === 'tags' ? 'bg-red-600 text-white shadow-xl' : 'text-slate-500 hover:bg-white'}`}><TagIcon size={16} className="inline mr-3"/> Tags & Filters</button>
                  <button onClick={() => setBuilderSubTab('social')} className={`w-full text-left px-8 py-6 rounded-3xl text-[11px] font-black uppercase tracking-widest transition-all ${builderSubTab === 'social' ? 'bg-red-600 text-white shadow-xl' : 'text-slate-500 hover:bg-white'}`}><Share2 size={16} className="inline mr-3"/> Social Links</button>
                </div>
                
                <div className="flex-1 space-y-8">
                  {builderSubTab === 'branding' && (
                    <div className="space-y-8 animate-reveal">
                      <div className={cardStyle}>
                        <h3 className="text-3xl font-black brand-font uppercase flex items-center gap-4 text-red-600 border-b pb-6"><Palette size={28} /> Brand Identity</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                           <div className="space-y-4">
                             <label className={labelStyle}>Standard Red Logo</label>
                             <div onClick={() => logoRedFileInputRef.current?.click()} className="relative w-full h-64 border-4 border-dashed rounded-[3.5rem] flex flex-col items-center justify-center cursor-pointer hover:border-red-600 transition-all bg-slate-50 overflow-hidden shadow-inner group">
                                <input type="file" ref={logoRedFileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && handleFile(e.target.files[0], 'logoRed')} />
                                {config.header.logoRed ? <img src={config.header.logoRed} className="h-32 object-contain group-hover:scale-105 transition-transform" /> : <Upload size={48} className="text-slate-300" />}
                             </div>
                           </div>
                           <div className="space-y-4">
                             <label className={labelStyle}>Alternate White Logo</label>
                             <div onClick={() => logoWhiteFileInputRef.current?.click()} className="relative w-full h-64 border-4 border-dashed rounded-[3.5rem] flex flex-col items-center justify-center cursor-pointer bg-slate-900 overflow-hidden shadow-2xl group">
                                <input type="file" ref={logoWhiteFileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && handleFile(e.target.files[0], 'logoWhite')} />
                                {config.header.logoWhite ? <img src={config.header.logoWhite} className="h-32 object-contain group-hover:scale-105 transition-transform" /> : <Upload size={48} className="text-slate-600" />}
                             </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {builderSubTab === 'hero' && (
                    <div className="space-y-8 animate-reveal">
                       <div className="flex justify-between items-center bg-white p-10 rounded-[3.5rem] shadow-sm border border-slate-100">
                         <h3 className="text-3xl font-black brand-font uppercase text-slate-900">Slider Campaigns</h3>
                         <button onClick={() => { setEditingBanner({ titleEn: '', titleAr: '', image: '', offerPrice: 0, originalPrice: 0, offerLabelEn: '', offerLabelAr: '', promoTagEn: '', promoTagAr: '' }); setIsBannerFormOpen(true); }} 
                          className="bg-red-600 text-white px-10 rounded-[2rem] py-5 font-black text-xs uppercase tracking-[0.2em] shadow-2xl shadow-red-200">New Offer</button>
                       </div>
                       <div className="grid grid-cols-1 gap-6">
                         {config.hero.banners.map(b => (
                           <div key={b.id} className="bg-white p-10 rounded-[3.5rem] border-2 border-slate-50 flex flex-col md:flex-row items-center justify-between shadow-sm group hover:border-red-600 transition-all">
                             <div className="flex flex-col md:flex-row items-center gap-10">
                               <div className="relative shrink-0">
                                 <img src={b.image} className="w-48 h-32 object-contain rounded-3xl bg-slate-50 p-4 shadow-inner" />
                                 <div className="absolute -top-4 -right-4 bg-red-600 text-white px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-xl border-4 border-white">
                                    {b.offerPrice} LE
                                 </div>
                               </div>
                               <div className="text-center md:text-left">
                                 <h5 className="font-black text-2xl text-slate-900 uppercase leading-none mb-2">{b.titleEn}</h5>
                                 <p className="text-sm font-bold text-red-600 flex items-center gap-2 justify-center md:justify-start">
                                    {b.offerLabelEn} 
                                    {b.originalPrice && b.originalPrice > b.offerPrice && (
                                       <span className="text-slate-300 text-[9px] line-through uppercase">بدلاً من {b.originalPrice} LE</span>
                                    )}
                                 </p>
                               </div>
                             </div>
                             <div className="flex gap-4">
                               <button onClick={() => { setEditingBanner(b); setIsBannerFormOpen(true); }} className="p-5 bg-slate-50 text-slate-300 hover:text-red-600 rounded-[1.5rem] transition-all"><Edit2 size={24} /></button>
                               <button onClick={() => { if(confirm('Delete offer?')) { onUpdateConfig({...config, hero: { banners: config.hero.banners.filter(x => x.id !== b.id)}}); } }} className="p-5 bg-slate-50 text-slate-300 hover:text-slate-900 rounded-[1.5rem] transition-all"><Trash2 size={24} /></button>
                             </div>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}
                  {builderSubTab === 'categories' && (
                    <div className="space-y-8 animate-reveal">
                      <div className={cardStyle}>
                         <h3 className="text-3xl font-black brand-font uppercase flex items-center gap-4 text-red-600 border-b pb-6"><ListOrdered size={28} /> Menu Sections</h3>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <input className={inputStyle} placeholder="Name (EN)" value={newCat.en} onChange={e => setNewCat({...newCat, en: e.target.value})} />
                           <div className="flex gap-4">
                              <input dir="rtl" className={inputStyle + " font-arabic"} placeholder="الاسم (AR)" value={newCat.ar} onChange={e => setNewCat({...newCat, ar: e.target.value})} />
                              <button onClick={handleAddCategory} className="bg-red-600 text-white px-8 rounded-2xl shadow-xl shadow-red-200 hover:scale-105 transition-all"><Plus size={24} /></button>
                           </div>
                         </div>
                         <div className="space-y-4 pt-6">
                           {config.layout.map((cat, idx) => (
                             <div key={cat.id} className="flex items-center justify-between p-8 bg-slate-50 rounded-[2.5rem] border border-slate-100 group hover:bg-white transition-all shadow-sm">
                               <div className="flex items-center gap-6">
                                 <span className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center font-black text-xs text-red-600 border-2 border-slate-100 shadow-sm">{idx+1}</span>
                                 <div><h5 className="font-black text-slate-900 uppercase text-lg leading-none mb-1">{cat.nameEn}</h5><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{cat.nameAr}</p></div>
                               </div>
                               <button onClick={() => { if(confirm('Delete?')) { onUpdateConfig({...config, layout: config.layout.filter(l => l.id !== cat.id)}); } }} className="p-4 text-slate-300 hover:text-slate-900 transition-all"><Trash2 size={20} /></button>
                             </div>
                           ))}
                         </div>
                      </div>
                    </div>
                  )}
                  {builderSubTab === 'tags' && (
                    <div className="space-y-8 animate-reveal">
                      <div className={cardStyle}>
                        <h3 className="text-3xl font-black brand-font uppercase flex items-center gap-4 text-red-600 border-b pb-6"><TagIcon size={28} /> Tags & Filters</h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8 bg-slate-50 rounded-[3rem] border border-slate-100">
                           <div>
                              <label className={labelStyle}>Filter Bar Title (EN)</label>
                              <input 
                                 className={inputStyle} 
                                 value={localFilterLabelEn} 
                                 onChange={e => setLocalFilterLabelEn(e.target.value)}
                                 onBlur={() => onUpdateConfig({...config, filterLabelEn: localFilterLabelEn})} 
                               />
                           </div>
                           <div>
                              <label className={labelStyle}>عنوان شريط التصفية (AR)</label>
                              <input 
                                 dir="rtl" 
                                 className={inputStyle + " font-arabic"} 
                                 value={localFilterLabelAr} 
                                 onChange={e => setLocalFilterLabelAr(e.target.value)}
                                 onBlur={() => onUpdateConfig({...config, filterLabelAr: localFilterLabelAr})} 
                               />
                           </div>
                        </div>

                        <div className="pt-6">
                          <label className={labelStyle}>Manage Individual Tags</label>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                             <input className={inputStyle} placeholder="Tag Label (EN)" value={newTag.en} onChange={e => setNewTag({...newTag, en: e.target.value})} />
                             <div className="flex gap-4">
                                <input dir="rtl" className={inputStyle + " font-arabic"} placeholder="اسم الوسم (AR)" value={newTag.ar} onChange={e => setNewTag({...newTag, ar: e.target.value})} />
                                <button onClick={handleAddTag} className="bg-red-600 text-white px-8 rounded-2xl shadow-xl shadow-red-200 hover:scale-105 transition-all"><Plus size={24} /></button>
                             </div>
                          </div>
                          
                          <div className="space-y-4">
                            {config.tags.length === 0 && (
                               <div className="text-center py-10 bg-white rounded-[2rem] border-2 border-dashed border-slate-100 italic text-slate-400 font-medium font-arabic">
                                 {config.branchStatus === 'open' ? 'لا يوجد وسوم مضافة حالياً. استخدم الحقول أعلاه لإضافة وسم جديد.' : 'No tags added yet. Use the fields above to create labels.'}
                               </div>
                            )}
                            {config.tags.map((tag) => (
                              <div key={tag.id} className="flex items-center justify-between p-6 bg-white rounded-[2rem] border-2 border-slate-50 hover:border-red-100 transition-all group">
                                <div className="flex items-center gap-4">
                                  <div className="p-3 bg-slate-50 rounded-xl text-slate-400 group-hover:text-red-600 transition-colors">
                                    <TagIcon size={18} />
                                  </div>
                                  <div>
                                    <h5 className="font-black text-slate-900 uppercase text-sm leading-none">{tag.nameEn}</h5>
                                    <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest leading-none">{tag.nameAr}</p>
                                  </div>
                                </div>
                                <button onClick={() => onUpdateConfig({...config, tags: config.tags.filter(t => t.id !== tag.id)})} className="p-3 text-slate-200 hover:text-red-600 transition-colors">
                                  <Trash2 size={20} />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {builderSubTab === 'social' && (
                    <div className="space-y-8 animate-reveal">
                      <div className={cardStyle}>
                        <h3 className="text-3xl font-black brand-font uppercase flex items-center gap-4 text-red-600 border-b pb-6"><Share2 size={28} /> Connections</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                           <div className="relative"><Facebook className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-600" size={24} /><input className={inputStyle + " pl-16"} value={config.footer.facebook} placeholder="Facebook Link" onChange={e => onUpdateConfig({...config, footer: {...config.footer, facebook: e.target.value}})} /></div>
                           <div className="relative"><Instagram className="absolute left-5 top-1/2 -translate-y-1/2 text-pink-600" size={24} /><input className={inputStyle + " pl-16"} value={config.footer.instagram} placeholder="Instagram Link" onChange={e => onUpdateConfig({...config, footer: {...config.footer, instagram: e.target.value}})} /></div>
                           <div className="relative"><TikTokIcon size={24} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-900" /><input className={inputStyle + " pl-16"} value={config.footer.tiktok} placeholder="TikTok Link" onChange={e => onUpdateConfig({...config, footer: {...config.footer, tiktok: e.target.value}})} /></div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'areas' && (
              <div className="h-full flex flex-col lg:flex-row gap-8 animate-reveal pb-20 overflow-hidden">
                <div className="w-full lg:w-[450px] flex flex-col h-full bg-white rounded-[4rem] p-10 border border-slate-100 shadow-xl z-20 overflow-y-auto no-scrollbar relative shrink-0">
                    <div className="flex flex-col gap-4 mb-10 border-b pb-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="bg-red-600 p-3.5 rounded-2xl shadow-xl shadow-red-200 text-white"><MapIcon size={24} /></div>
                           <h3 className="text-2xl font-black brand-font uppercase text-slate-900">Zone Manager</h3>
                        </div>
                        {drawingMode && (
                          <span className="flex items-center gap-2 bg-red-100 text-red-600 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest animate-pulse">
                            <Navigation size={12} fill="currentColor" /> Drawing Active
                          </span>
                        )}
                      </div>
                      
                      {/* Branch Status Toggle */}
                      <div className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${config.branchStatus === 'open' ? 'bg-green-500 animate-pulse' : 'bg-red-600'}`} />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                            Branch Status: {config.branchStatus === 'open' ? 'Accepting Orders' : 'Closed'}
                          </span>
                        </div>
                        <button 
                          onClick={() => {
                            const newStatus = config.branchStatus === 'open' ? 'closed' : 'open';
                            onUpdateConfig({ ...config, branchStatus: newStatus });
                          }}
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${config.branchStatus === 'open' ? 'bg-red-600 text-white shadow-lg shadow-red-100' : 'bg-green-600 text-white shadow-lg shadow-green-100'}`}
                        >
                          {config.branchStatus === 'open' ? 'Close Branch' : 'Open Branch'}
                        </button>
                      </div>
                    </div>

                  {!drawingMode ? (
                    <div className="space-y-6">
                      <button onClick={() => { setDrawingMode(true); setCurrentPolygonPoints([]); setSelectedAreaId(null); }} 
                        className="w-full bg-red-600 text-white font-black py-6 rounded-[2rem] flex items-center justify-center gap-4 uppercase tracking-widest text-xs shadow-2xl shadow-red-200 hover:scale-[1.02] transition-all active:scale-95">
                        <Plus size={20} strokeWidth={4} /> Draw New Territory
                      </button>

                      <div className="pt-4 space-y-4">
                        <div className="flex items-center justify-between px-2">
                           <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Active Corridors ({config.areas.length})</span>
                           <BarChart3 size={16} className="text-slate-300" />
                        </div>
                        {config.areas.map(area => (
                          <div key={area.id} 
                            onClick={() => focusOnArea(area)}
                            className={`p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer group flex items-center justify-between ${selectedAreaId === area.id ? 'bg-red-50 border-red-600 shadow-lg' : 'bg-slate-50 border-slate-100 hover:bg-white hover:border-slate-300'}`}>
                            <div className="flex items-center gap-5">
                               <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${selectedAreaId === area.id ? 'bg-red-600 text-white shadow-xl shadow-red-100' : 'bg-white text-slate-400 border border-slate-100'}`}>
                                 <Navigation size={20} className={selectedAreaId === area.id ? '' : 'rotate-45'} />
                               </div>
                               <div>
                                 <h5 className={`font-black uppercase text-base leading-none mb-1 ${selectedAreaId === area.id ? 'text-red-600' : 'text-slate-900'}`}>{area.nameAr}</h5>
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{area.nameEn} • {area.fee} LE Fee</p>
                               </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); onUpdateConfig({...config, areas: config.areas.filter(a => a.id !== area.id)}); refreshExistingZones(); }} 
                              className="p-3 text-slate-200 hover:text-red-600 hover:bg-white rounded-xl transition-all opacity-0 group-hover:opacity-100">
                              <Trash2 size={20} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-10 animate-reveal">
                      <div className="bg-slate-900 p-8 rounded-[3rem] text-white space-y-8 shadow-2xl">
                        <div>
                          <label className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3 block">1. Identity Information</label>
                          <div className="space-y-4">
                            <input className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white font-black outline-none focus:border-red-600 transition-all placeholder:text-white/20" placeholder="Territory Name (EN)" value={newArea.nameEn} onChange={e => setNewArea({...newArea, nameEn: e.target.value})} />
                            <input dir="rtl" className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl text-white font-black font-arabic outline-none focus:border-red-600 transition-all placeholder:text-white/20" placeholder="اسم المنطقة (AR)" value={newArea.nameAr} onChange={e => setNewArea({...newArea, nameAr: e.target.value})} />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3 block">2. Pricing Rules</label>
                          <div className="relative">
                            <div className="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 font-black text-xs">LE</div>
                            <input type="number" className="w-full bg-white/5 border border-white/10 p-4 pl-12 rounded-2xl text-white font-black outline-none focus:border-red-600 transition-all placeholder:text-white/20" placeholder="Flat Delivery Fee" value={newArea.fee || ''} onChange={e => setNewArea({...newArea, fee: Number(e.target.value)})} />
                          </div>
                        </div>
                        <div className="pt-4 border-t border-white/10 space-y-4">
                          <p className="text-[9px] font-black text-white/40 uppercase text-center italic tracking-widest">Click 3 or more points on the map to define boundaries</p>
                          <div className="grid grid-cols-2 gap-4">
                            <button onClick={() => { setDrawingMode(false); setCurrentPolygonPoints([]); ghostLayerRef.current?.clearLayers(); }} 
                              className="bg-white/5 text-white/60 font-black py-4 rounded-2xl hover:bg-white/10 transition-all uppercase text-[10px] tracking-widest">Discard</button>
                            <button disabled={currentPolygonPoints.length < 3 || !newArea.nameEn || !newArea.nameAr} 
                              onClick={() => { onUpdateConfig({...config, areas: [...config.areas, { id: 'a'+Date.now(), ...newArea, points: currentPolygonPoints } as Area]}); setDrawingMode(false); setCurrentPolygonPoints([]); refreshExistingZones(); }} 
                              className="bg-red-600 text-white font-black py-4 rounded-2xl shadow-xl shadow-red-900/40 transition-all uppercase text-[10px] tracking-widest disabled:opacity-20 flex items-center justify-center gap-2">
                              <Check size={16} strokeWidth={4} /> Save Zone
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-8 bg-red-50 rounded-[3rem] border border-red-100 flex items-start gap-4">
                         <Info size={24} className="text-red-600 shrink-0" />
                         <p className="text-[11px] font-bold text-red-900 leading-relaxed uppercase">The system uses Geofencing technology. Only orders placed inside these boundaries will be accepted at these rates.</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex-1 relative bg-slate-200 rounded-[4.5rem] overflow-hidden border-[10px] border-white shadow-2xl shadow-slate-200 group">
                  <div id="admin-logistics-map" className="absolute inset-0 w-full h-full"></div>
                  
                  {drawingMode && (
                    <div className="absolute top-10 left-1/2 -translate-x-1/2 z-20 bg-white/95 backdrop-blur-md px-10 py-5 rounded-[2.5rem] shadow-2xl border-4 border-red-600 flex items-center gap-6 animate-reveal">
                       <div className="w-10 h-10 bg-red-600 text-white rounded-full flex items-center justify-center font-black animate-bounce">{currentPolygonPoints.length}</div>
                       <div className="flex flex-col">
                          <span className="text-sm font-black text-slate-900 uppercase leading-none mb-1">Point Capturing Mode</span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Mark territory on the satellite grid</span>
                       </div>
                       <button onClick={() => setCurrentPolygonPoints(prev => prev.slice(0, -1))} className="p-3 bg-slate-100 hover:bg-red-100 text-slate-400 hover:text-red-600 rounded-2xl transition-all">
                          <RotateCcw size={20} />
                       </button>
                    </div>
                  )}

                  {!drawingMode && (
                    <div className="absolute bottom-10 right-10 z-20 flex flex-col gap-3">
                       <button onClick={() => adminMapRef.current?.setView([30.0444, 31.2357], 11)} className="bg-white p-4 rounded-2xl shadow-2xl text-slate-900 hover:text-red-600 transition-all active:scale-90 border border-slate-100">
                          <MapPin size={28} />
                       </button>
                       <button onClick={() => setDrawingMode(true)} className="bg-red-600 text-white p-4 rounded-2xl shadow-2xl hover:bg-slate-900 transition-all active:scale-90 shadow-red-200">
                          <Plus size={28} strokeWidth={4} />
                       </button>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

        {isProductFormOpen && editingProduct && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-3xl" onClick={() => setIsProductFormOpen(false)} />
            <form onSubmit={handleSaveProduct} className="relative bg-white w-full max-w-4xl rounded-[4rem] p-12 shadow-2xl animate-scale-up space-y-12 overflow-y-auto max-h-[90vh] no-scrollbar border-[12px] border-white">
               <div className="flex justify-between items-center mb-4 sticky top-0 bg-white z-10 py-6 border-b-4 border-slate-50"><h3 className="text-4xl font-black brand-font text-slate-900 uppercase leading-none">Manage Product</h3><button type="button" onClick={() => setIsProductFormOpen(false)} className="text-slate-300 hover:text-red-600 transition-all"><X size={48} /></button></div>
               <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                  <div className="md:col-span-1">
                    <label className={labelStyle}>Visual Asset</label>
                    <div onClick={() => productFileInputRef.current?.click()} className="relative w-full aspect-square border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-50 overflow-hidden hover:border-red-600 shadow-inner group">
                      {editingProduct.image ? <img src={editingProduct.image} className="h-full w-full object-cover group-hover:scale-110 transition-transform" /> : <Upload size={64} className="text-slate-200" />}
                      <input type="file" ref={productFileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && handleFile(e.target.files[0], 'product')} />
                    </div>
                  </div>
                  <div className="md:col-span-2 space-y-10">
                    <div className="grid grid-cols-2 gap-8">
                      <div><label className={labelStyle}>Name (EN)</label><input className={inputStyle} value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} required /></div>
                      <div><label className={labelStyle}>الاسم (AR)</label><input dir="rtl" className={inputStyle + " font-arabic font-black"} value={editingProduct.nameAr} onChange={e => setEditingProduct({...editingProduct, nameAr: e.target.value})} required /></div>
                    </div>
                    <div className="grid grid-cols-2 gap-8">
                      <div><label className={labelStyle}>Selling Price (LE)</label><input type="number" className={inputStyle + " text-3xl font-black text-red-600"} value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: Number(e.target.value)})} required /></div>
                      <div><label className={labelStyle}>Instead of (Old Price)</label><input type="number" className={inputStyle + " text-xl text-slate-300 font-bold"} value={editingProduct.originalPrice || ''} placeholder="LE" onChange={e => setEditingProduct({...editingProduct, originalPrice: Number(e.target.value)})} /></div>
                    </div>
                    <div><label className={labelStyle}>Category</label><select className={inputStyle} value={editingProduct.category} onChange={e => setEditingProduct({...editingProduct, category: e.target.value})}>{config.layout.map(c => <option key={c.id} value={c.id}>{c.nameEn}</option>)}</select></div>
                  </div>
               </div>

               {/* TAG ASSIGNMENT SECTION */}
               <div className="bg-slate-50 p-10 rounded-[3rem] border-2 border-slate-100 space-y-6">
                  <div className="flex items-center gap-4">
                    <TagIcon size={24} className="text-red-600" />
                    <h4 className="text-lg font-black brand-font uppercase tracking-tight text-slate-900">Product Labels & Badges</h4>
                  </div>
                  <div className="flex flex-wrap gap-3">
                    {config.tags.map(tag => {
                      const isActive = editingProduct.tags?.includes(tag.nameEn);
                      return (
                        <button 
                          key={tag.id}
                          type="button"
                          onClick={() => toggleProductTag(tag.nameEn)}
                          className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2 border-2 ${isActive ? 'bg-red-600 border-red-600 text-white shadow-xl shadow-red-200 scale-105' : 'bg-white border-slate-200 text-slate-400 hover:border-red-600 hover:text-red-600'}`}
                        >
                          {isActive && <CheckCircle2 size={14} />}
                          {tag.nameEn}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest pl-2">Items tagged with these labels will show up when customers use the filter menu.</p>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-10 border-t-2 border-slate-50">
                  <div><label className={labelStyle}>Description (EN)</label><textarea className={inputStyle + " h-32 resize-none font-bold"} value={editingProduct.description} onChange={e => setEditingProduct({...editingProduct, description: e.target.value})} /></div>
                  <div><label className={labelStyle}>الوصف (AR)</label><textarea dir="rtl" className={inputStyle + " h-32 resize-none font-arabic font-black"} value={editingProduct.descriptionAr} onChange={e => setEditingProduct({...editingProduct, descriptionAr: e.target.value})} /></div>
               </div>
               <div className="flex flex-wrap items-center gap-10 p-10 bg-slate-50 rounded-[3rem] border-4 border-white shadow-inner">
                  <label className="flex items-center gap-5 text-sm font-black uppercase cursor-pointer group"><input type="checkbox" checked={editingProduct.isSpicy} onChange={e => setEditingProduct({...editingProduct, isSpicy: e.target.checked})} className="w-8 h-8 rounded-xl accent-red-600" /> <span className="group-hover:text-red-600">🔥 Hot & Spicy Item</span></label>
                  <label className="flex items-center gap-5 text-sm font-black uppercase cursor-pointer group"><input type="checkbox" checked={editingProduct.spicinessOption} onChange={e => setEditingProduct({...editingProduct, spicinessOption: e.target.checked})} className="w-8 h-8 rounded-xl accent-red-600" /> <span className="group-hover:text-red-600">🍗 Allow Customer Choice</span></label>
               </div>
               <button type="submit" className="w-full py-10 font-black uppercase text-2xl tracking-widest bg-slate-900 text-white rounded-[3rem] shadow-2xl hover:bg-red-600 transition-all flex items-center justify-center gap-6 active:scale-95"><Save size={32} /> COMMIT TO LIVE MENU</button>
            </form>
          </div>
        )}

        {isBannerFormOpen && editingBanner && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" onClick={() => setIsBannerFormOpen(false)} />
            <form onSubmit={handleSaveBanner} className="relative bg-white w-full max-w-4xl rounded-[4rem] p-12 shadow-2xl animate-scale-up space-y-10 border-[12px] border-white overflow-y-auto max-h-[90vh] no-scrollbar">
               <div className="flex justify-between items-center mb-4 py-6 border-b-4 border-slate-50"><h3 className="text-4xl font-black brand-font text-slate-900 uppercase leading-none">Slider Offer Setup</h3><button type="button" onClick={() => setIsBannerFormOpen(false)} className="text-slate-300 hover:text-red-600 transition-all"><X size={48} /></button></div>
               <div className="space-y-4"><label className={labelStyle}>Banner Image (PNG Preferred)</label><div onClick={() => bannerFileInputRef.current?.click()} className="relative w-full h-72 border-4 border-dashed rounded-[3rem] flex flex-col items-center justify-center cursor-pointer bg-slate-50 overflow-hidden hover:border-red-600 shadow-inner group">{editingBanner.image ? <img src={editingBanner.image} className="h-full object-contain p-10 group-hover:scale-105 transition-transform" /> : <Upload size={64} className="text-slate-200" />}<input type="file" ref={bannerFileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && handleFile(e.target.files[0], 'banner')} /></div></div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10 pt-6">
                 <div className="space-y-10">
                    <div><label className={labelStyle}>Headline (EN)</label><input className={inputStyle} value={editingBanner.titleEn} onChange={e => setEditingBanner({...editingBanner, titleEn: e.target.value})} required /></div>
                    <div><label className={labelStyle}>العنوان (AR)</label><input dir="rtl" className={inputStyle + " font-arabic"} value={editingBanner.titleAr} onChange={e => setEditingBanner({...editingBanner, titleAr: e.target.value})} required /></div>
                    <div><label className={labelStyle}>Subtitle (EN)</label><input className={inputStyle} value={editingBanner.subtitleEn} placeholder="e.g. Dinner Box" onChange={e => setEditingBanner({...editingBanner, subtitleEn: e.target.value})} required /></div>
                    <div><label className={labelStyle}>العنوان الفرعي (AR)</label><input dir="rtl" className={inputStyle + " font-arabic"} value={editingBanner.subtitleAr} placeholder="مثال: بوكس العشاء" onChange={e => setEditingBanner({...editingBanner, subtitleAr: e.target.value})} required /></div>
                 </div>
                 <div className="space-y-10">
                    <div className="grid grid-cols-2 gap-8">
                       <div><label className={labelStyle}>Offer Price</label><input type="number" className={inputStyle + " text-4xl text-red-600 font-black"} value={editingBanner.offerPrice} onChange={e => setEditingBanner({...editingBanner, offerPrice: Number(e.target.value)})} required /></div>
                       <div><label className={labelStyle}>Instead of</label><input type="number" className={inputStyle + " text-2xl text-slate-300 font-bold"} value={editingBanner.originalPrice || ''} onChange={e => setEditingBanner({...editingBanner, originalPrice: Number(e.target.value)})} /></div>
                    </div>
                    <div><label className={labelStyle}>Short Label (EN)</label><input className={inputStyle} value={editingBanner.offerLabelEn} placeholder="e.g. MEGA SAVER" onChange={e => setEditingBanner({...editingBanner, offerLabelEn: e.target.value})} required /></div>
                 </div>
               </div>
               <button type="submit" className="w-full py-10 font-black uppercase text-2xl tracking-[0.4em] bg-slate-900 text-white rounded-[3rem] shadow-2xl hover:bg-red-600 transition-all flex items-center justify-center gap-8 active:scale-95"><Sparkles size={32} /> DEPLOY CAMPAIGN</button>
            </form>
          </div>
        )}

      </div>
    </div>
  );
};

export default AdminDashboard;
