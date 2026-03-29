
import React, { useState } from 'react';
import { X, Mail, Lock, User, ArrowRight, Github, Chrome as Google, Facebook } from 'lucide-react';
// Added Language import
import { Language } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Added lang prop to interface
  lang: Language;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      onClose();
    }, 1500);
  };

  const inputClass = "w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-100 rounded-2xl focus:border-red-600 focus:ring-4 focus:ring-red-500/10 transition-all outline-none font-bold text-slate-900 text-base placeholder:text-slate-300";

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" 
        onClick={onClose} 
      />
      
      <div className="relative bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-scale-up border-4 border-white">
        <button 
          onClick={onClose}
          className="absolute top-8 right-8 p-2 hover:bg-gray-100 rounded-full transition-colors z-10 text-gray-400"
        >
          <X size={24} />
        </button>

        <div className="flex border-b">
          <button 
            onClick={() => setMode('login')}
            className={`flex-1 py-8 text-xs font-black tracking-widest transition-all ${mode === 'login' ? 'text-red-600 border-b-4 border-red-600 bg-white' : 'text-slate-400 bg-slate-50'}`}
          >
            SIGN IN
          </button>
          <button 
            onClick={() => setMode('signup')}
            className={`flex-1 py-8 text-xs font-black tracking-widest transition-all ${mode === 'signup' ? 'text-red-600 border-b-4 border-red-600 bg-white' : 'text-slate-400 bg-slate-50'}`}
          >
            CREATE ACCOUNT
          </button>
        </div>

        <div className="p-10">
          <div className="text-center mb-10">
            <h3 className="text-4xl font-black brand-font text-slate-900 tracking-tight uppercase">
              {mode === 'login' ? 'Welcome Back' : 'Join Chicky'}
            </h3>
            <p className="text-slate-400 text-sm mt-2 font-bold uppercase tracking-widest">
              {mode === 'login' ? 'The crunch awaits' : 'Start your flavor journey'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-600 transition-colors" size={20} />
                <input type="text" placeholder="Full Name" className={inputClass} required />
              </div>
            )}
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-600 transition-colors" size={20} />
              <input type="email" placeholder="Email Address" className={inputClass} required />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-red-600 transition-colors" size={20} />
              <input type="password" placeholder="Password" className={inputClass} required />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-red-600 text-white font-black py-5 rounded-2xl shadow-xl shadow-red-100 hover:bg-red-700 transition-all active:scale-95 flex items-center justify-center gap-3 mt-6 uppercase tracking-widest"
            >
              {loading ? (
                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {mode === 'login' ? 'Sign In' : 'Create Account'}
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

          <div className="mt-10">
            <div className="relative flex items-center justify-center mb-8">
              <div className="absolute inset-0 border-t border-slate-100" />
              <span className="relative px-4 bg-white text-[10px] font-black text-slate-300 uppercase tracking-widest">Or continue with</span>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <button className="flex items-center justify-center p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"><Google size={20} className="text-slate-600" /></button>
              <button className="flex items-center justify-center p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"><Facebook size={20} className="text-blue-600" /></button>
              <button className="flex items-center justify-center p-4 bg-slate-50 rounded-2xl hover:bg-slate-100 transition-colors"><Github size={20} className="text-slate-900" /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
