
import React, { useState } from 'react';
import { User, Lock, ArrowRight, Smartphone, KeyRound, Loader2, Zap } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { login } from '../services/sheetsService';

interface LoginProps {
  onLogin: (user: any) => void;
}

export const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const { t } = useLanguage();
  const [loginMethod, setLoginMethod] = useState<'PASSWORD' | 'OTP'>('PASSWORD');
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [otpStep, setOtpStep] = useState(1); // 1: Request, 2: Verify
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) return;

    setIsLoading(true);
    setError(null);
    
    try {
      const result = await login(username, password);
      if (result.success) {
        onLogin(result.user);
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError('Connection error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOTP = async () => {
     if(!username) return;
     setIsLoading(true);
     setError(null);
     
     try {
         // In a real system, this would call an OTP API
         // For now, we'll use the login API with just the username if supported, 
         // or simulate it if it's just a demo of the UI
         const result = await login(username); // Try login with just username for OTP mode
         if (result.success) {
             onLogin(result.user);
         } else {
             // If login fails (e.g. needs OTP), we proceed to OTP step
             setOtpStep(2);
         }
     } catch (err) {
         setError('Connection error');
     } finally {
         setIsLoading(false);
     }
  }

  return (
    <div className="min-h-screen w-full bg-[#f8fafc] dark:bg-[#020617] flex items-center justify-center p-4 relative overflow-hidden font-sans transition-colors duration-500">
        {/* Background Effects */}
        <div className="absolute top-[-20%] left-[-10%] w-[70%] h-[70%] bg-blue-100 dark:bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none opacity-60 dark:opacity-100"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[70%] h-[70%] bg-purple-100 dark:bg-blue-600/20 rounded-full blur-[120px] pointer-events-none opacity-60 dark:opacity-100"></div>

        <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-gray-200 dark:border-white/10 shadow-2xl relative z-10 animate-fade-in">
            <div className="flex flex-col items-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-br from-neon-blue to-neon-purple rounded-2xl flex items-center justify-center shadow-[0_0_20px_rgba(0,243,255,0.3)] mb-4">
                    <Zap size={32} className="text-white" fill="white" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{t('app.title')}</h1>
                <p className="text-slate-500 dark:text-gray-400 text-sm">{t('app.subtitle')}</p>
            </div>

            {/* Toggle Methods */}
            <div className="flex bg-gray-100 dark:bg-black/20 p-1 rounded-xl mb-6 border border-gray-200 dark:border-white/5">
                <button 
                    onClick={() => setLoginMethod('PASSWORD')}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${loginMethod === 'PASSWORD' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`}
                >
                    <KeyRound size={16} /> {t('login.pass_mode')}
                </button>
                <button 
                    onClick={() => { setLoginMethod('OTP'); setOtpStep(1); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${loginMethod === 'OTP' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-gray-500 hover:text-slate-700 dark:hover:text-gray-300'}`}
                >
                    <Smartphone size={16} /> {t('login.otp')}
                </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
                {error && (
                    <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs p-3 rounded-xl animate-shake">
                        {error}
                    </div>
                )}
                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 ml-1 uppercase tracking-wider">{t('login.userid')}</label>
                    <div className="relative group">
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-neon-blue transition-colors">
                            <User size={18} />
                        </div>
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder={loginMethod === 'PASSWORD' ? "Ex. INS-8821" : "081-XXX-XXXX"}
                            className="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/50 transition-all"
                            required
                        />
                    </div>
                </div>

                {loginMethod === 'PASSWORD' && (
                     <div className="space-y-2 animate-fade-in">
                        <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 ml-1 uppercase tracking-wider">{t('login.password')}</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-neon-blue transition-colors">
                                <Lock size={18} />
                            </div>
                            <input 
                                type="password" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/50 transition-all"
                                required
                            />
                        </div>
                    </div>
                )}

                 {loginMethod === 'OTP' && otpStep === 2 && (
                     <div className="space-y-2 animate-fade-in">
                        <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 ml-1 uppercase tracking-wider">OTP Code</label>
                        <div className="relative group">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-neon-blue transition-colors">
                                <KeyRound size={18} />
                            </div>
                            <input 
                                type="text" 
                                placeholder="XXXXXX"
                                className="w-full bg-white dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-600 focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/50 transition-all tracking-widest text-center font-mono text-lg"
                                maxLength={6}
                                required
                            />
                        </div>
                         <div className="text-right">
                             <button type="button" onClick={() => setOtpStep(1)} className="text-xs text-neon-blue hover:text-blue-600 dark:hover:text-white mt-1">
                                 Resend OTP?
                             </button>
                         </div>
                    </div>
                )}

                <div className="pt-4">
                    {loginMethod === 'OTP' && otpStep === 1 ? (
                         <button 
                            type="button"
                            onClick={handleRequestOTP}
                            disabled={isLoading || !username}
                            className="w-full bg-white dark:bg-white/10 hover:bg-gray-100 dark:hover:bg-white/20 text-slate-900 dark:text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2 border border-gray-200 dark:border-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : <>{t('login.request_otp')} <ArrowRight size={18} /></>}
                        </button>
                    ) : (
                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-neon-blue to-blue-600 text-white font-bold py-3.5 rounded-xl shadow-[0_0_20px_rgba(0,243,255,0.3)] hover:shadow-[0_0_30px_rgba(0,243,255,0.5)] transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoading ? <Loader2 className="animate-spin" /> : t('login.submit')}
                        </button>
                    )}
                </div>
            </form>

            <div className="mt-8 text-center">
                <p className="text-xs text-slate-500 dark:text-gray-500">
                    {t('login.footer')} <span className="text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">Terms of Service</span> & <span className="text-slate-400 dark:text-gray-400 hover:text-slate-600 dark:hover:text-white cursor-pointer">Privacy Policy</span>
                </p>
            </div>
        </div>
    </div>
  );
};
