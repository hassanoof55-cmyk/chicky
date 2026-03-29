
import React, { useState } from 'react';
import { X, Lock, ShieldCheck, ArrowRight, AlertCircle } from 'lucide-react';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: () => void;
}

const AdminAuthModal: React.FC<AdminAuthModalProps> = ({ isOpen, onClose, onAuthenticated }) => {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  // Master passcode - typically would be in env or backend, but for this app we use a fixed one.
  const MASTER_PASSCODE = '01220062060';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    setTimeout(() => {
      if (passcode === MASTER_PASSCODE) {
        onAuthenticated();
        setPasscode('');
        setError(false);
      } else {
        setError(true);
        setPasscode('');
        // Shake animation handled by CSS class
      }
      setLoading(false);
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl animate-fade-in" onClick={onClose} />
      
      <div className={`relative bg-white w-full max-w-sm rounded-[3rem] shadow-2xl overflow-hidden border-[6px] border-white transition-all ${error ? 'animate-shake' : 'animate-scale-up'}`}>
        <div className="p-10 text-center">
          <div className="w-20 h-20 bg-red-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-red-200">
            <Lock size={32} className="text-white" />
          </div>
          
          <h3 className="text-3xl font-black brand-font text-slate-900 uppercase tracking-tight">Admin Gateway</h3>
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-[0.3em] mt-2 mb-8">Restricted Access Only</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input 
                type="password" 
                placeholder="ENTER PASSCODE" 
                className={`w-full py-5 px-6 bg-slate-50 border-2 rounded-2xl outline-none text-center font-black tracking-[0.5em] text-xl transition-all ${error ? 'border-red-500 bg-red-50 text-red-600' : 'border-slate-100 focus:border-red-600 focus:bg-white'}`}
                value={passcode}
                onChange={(e) => { setPasscode(e.target.value); setError(false); }}
                autoFocus
              />
              {error && (
                <div className="flex items-center justify-center gap-2 mt-3 text-red-500 animate-reveal">
                  <AlertCircle size={14} />
                  <span className="text-[10px] font-black uppercase tracking-widest">Incorrect Passcode</span>
                </div>
              )}
            </div>

            <button 
              type="submit" 
              disabled={loading || !passcode}
              className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl hover:bg-red-600 disabled:opacity-30 uppercase tracking-[0.2em] text-xs"
            >
              {loading ? (
                <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Unlock Access <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-[9px] font-black text-slate-300 uppercase tracking-widest flex items-center justify-center gap-2">
            <ShieldCheck size={12} /> Encrypted Session
          </p>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
};

export default AdminAuthModal;
