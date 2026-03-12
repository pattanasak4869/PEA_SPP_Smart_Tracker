
import React, { useState, useEffect } from 'react';
import { User, Settings, Bell, HelpCircle, LogOut, ChevronRight, Shield, Award, Calendar, Mail, Phone, MapPin, ArrowLeft, Save, Check, Lock, Smartphone, Globe, Moon, RefreshCw, Volume2, MessageSquare, Sun } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { useSettings } from '../contexts/SettingsContext';
import { Language } from '../types';

import { saveUser } from '../services/sheetsService';

interface ProfileProps {
  onBack: () => void;
  onLogout: () => void;
  currentUser: any;
  onUpdateUser: (user: any) => void;
  onSystemClean?: () => void;
}

type ProfileSection = 'MAIN' | 'EDIT_PROFILE' | 'NOTIFICATIONS' | 'SECURITY' | 'SETTINGS' | 'HELP';

// Default Profile Data
const DEFAULT_PROFILE = {
    name: "Somchai Jaidee",
    position: "Field Inspector",
    email: "somchai.jai@egat.co.th",
    phone: "081-234-5678",
    zone: "Zone B (Central)",
    id: "INS-8821"
};

export const Profile: React.FC<ProfileProps> = ({ onBack, onLogout, currentUser, onUpdateUser, onSystemClean }) => {
  const { t, language, setLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();
  const { settings, updateSettings } = useSettings();
  const [section, setSection] = useState<ProfileSection>('MAIN');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  
  // Profile Data State with Persistence
  const [profileData, setProfileData] = useState(currentUser || DEFAULT_PROFILE);

  useEffect(() => {
    if (currentUser) {
      setProfileData(currentUser);
    }
  }, [currentUser]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveProfile = async (newData: any) => {
      const updated = { ...profileData, ...newData };
      setProfileData(updated);
      
      // Sync to Server & Google Sheets
      const success = await saveUser(updated);
      
      if (success) {
        onUpdateUser(updated);
        showToast(t('btn.save') + ' ' + t('status.completed'));
        setSection('MAIN');
      } else {
        showToast('Failed to sync with server');
      }
  };

  // --- Sub-Components ---

  const Toggle: React.FC<{ label: string; checked: boolean; onChange: () => void; description?: string }> = ({ label, checked, onChange, description }) => (
    <div className="flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5 hover:bg-white/80 dark:hover:bg-white/10 transition-colors cursor-pointer" onClick={onChange}>
      <div>
        <div className="font-medium text-slate-800 dark:text-white">{label}</div>
        {description && <div className="text-xs text-slate-500 dark:text-gray-500 mt-1">{description}</div>}
      </div>
      <div className={`w-12 h-6 rounded-full p-1 transition-colors duration-300 ${checked ? 'bg-neon-blue' : 'bg-gray-300 dark:bg-gray-700'}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${checked ? 'translate-x-6' : 'translate-x-0'}`} />
      </div>
    </div>
  );

  const InputField: React.FC<{ label: string; value: string; icon: React.ReactNode; type?: string; onChange: (val: string) => void }> = ({ label, value, icon, type = "text", onChange }) => (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 ml-1 uppercase tracking-wider">{label}</label>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 group-focus-within:text-neon-blue transition-colors">
          {icon}
        </div>
        <input 
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl py-3.5 pl-11 pr-4 text-slate-900 dark:text-white focus:outline-none focus:border-neon-blue/50 focus:ring-1 focus:ring-neon-blue/50 transition-all placeholder-gray-400 dark:placeholder-gray-600"
        />
      </div>
    </div>
  );

  // --- Views ---

  const EditProfileView = () => {
    const [formData, setFormData] = useState(profileData);

    return (
        <div className="space-y-6 animate-slide-in-top">
        <div className="glass-panel p-6 rounded-2xl border-t border-gray-200 dark:border-white/10">
            <div className="flex flex-col items-center mb-10 mt-4">
                <div className="relative group cursor-pointer">
                    <div className="w-32 h-32 rounded-full border-4 border-white dark:border-[#020617] bg-gray-200 dark:bg-gray-800 overflow-hidden relative shadow-2xl">
                        <img src="https://picsum.photos/200/200" alt="Profile" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm">
                            <span className="text-xs font-bold text-white border border-white/30 px-3 py-1 rounded-full">{t('btn.edit')}</span>
                        </div>
                    </div>
                    <div className="absolute bottom-1 right-1 bg-neon-blue p-2 rounded-full text-black shadow-lg hover:scale-110 transition-transform">
                        <Settings size={16} />
                    </div>
                </div>
                <h2 className="text-xl font-bold mt-4 text-slate-900 dark:text-white">{formData.name}</h2>
                <p className="text-neon-blue text-sm bg-neon-blue/10 px-3 py-0.5 rounded-full border border-neon-blue/20 mt-2 font-mono">ID: {formData.id}</p>
            </div>

            <div className="grid gap-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label={t('profile.name')} value={formData.name} onChange={(v) => setFormData({...formData, name: v})} icon={<User size={18} />} />
                    <InputField label={t('profile.position')} value={formData.position} onChange={(v) => setFormData({...formData, position: v})} icon={<Award size={18} />} />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <InputField label={t('profile.email')} value={formData.email} onChange={(v) => setFormData({...formData, email: v})} icon={<Mail size={18} />} />
                    <InputField label={t('profile.phone')} value={formData.phone} onChange={(v) => setFormData({...formData, phone: v})} icon={<Phone size={18} />} />
                </div>
                
                <InputField label={t('profile.zone')} value={formData.zone} onChange={(v) => setFormData({...formData, zone: v})} icon={<MapPin size={18} />} />
            </div>

            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10 flex justify-end">
                <button 
                    onClick={() => handleSaveProfile(formData)}
                    className="bg-neon-blue hover:bg-neon-blue/80 text-black font-bold py-3.5 px-8 rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(0,243,255,0.3)] transition-all active:scale-95"
                >
                    <Save size={18} /> {t('btn.save')}
                </button>
            </div>
        </div>
        </div>
    );
  };

  const SettingsView = () => {
    return (
        <div className="space-y-6 animate-slide-in-top">
            <div className="glass-panel p-6 rounded-2xl">
                 <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white"><Settings className="text-orange-400" /> {t('profile.settings')}</h3>
                 
                 <div className="space-y-4">
                     <div className="flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5 hover:bg-white/80 dark:hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                            <Globe size={20} className="text-gray-500 dark:text-gray-400" />
                            <div>
                                <div className="font-medium text-slate-800 dark:text-white">{t('profile.lang')}</div>
                                <div className="text-xs text-gray-500">{t('profile.lang_desc')}</div>
                            </div>
                        </div>
                        <select 
                          value={language}
                          onChange={(e) => setLanguage(e.target.value as Language)}
                          className="bg-white dark:bg-black/30 text-slate-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-neon-blue"
                        >
                            <option value="TH">ไทย (Thai)</option>
                            <option value="EN">English</option>
                            <option value="CN">中文 (Chinese)</option>
                        </select>
                     </div>

                     <div className="flex items-center justify-between p-4 bg-white/50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5 hover:bg-white/80 dark:hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                            {theme === 'dark' ? <Moon size={20} className="text-gray-500 dark:text-gray-400" /> : <Sun size={20} className="text-orange-500" />}
                            <div>
                                <div className="font-medium text-slate-800 dark:text-white">{t('profile.theme')}</div>
                                <div className="text-xs text-gray-500">{t('profile.theme_desc')}</div>
                            </div>
                        </div>
                         <select 
                            value={theme}
                            onChange={(e) => setTheme(e.target.value as 'light' | 'dark')}
                            className="bg-white dark:bg-black/30 text-slate-900 dark:text-white border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-neon-blue"
                         >
                            <option value="dark">Dark Mode</option>
                            <option value="light">Light Mode</option>
                        </select>
                     </div>

                     <Toggle 
                        label={t('profile.sync')} 
                        description={t('profile.sync_desc')}
                        checked={settings.autoSync} 
                        onChange={() => updateSettings({ autoSync: !settings.autoSync })} 
                    />

                    <Toggle 
                        label={t('profile.data_saver')} 
                        description={t('profile.data_saver_desc')}
                        checked={settings.dataSaver} 
                        onChange={() => updateSettings({ dataSaver: !settings.dataSaver })} 
                    />

                    {onSystemClean && (
                      <div className="pt-4 mt-4 border-t border-gray-200 dark:border-white/10">
                        <button 
                          onClick={() => {
                            if (window.confirm('คุณต้องการล้างข้อมูล Cache ทั้งหมดและโหลดใหม่จากฐานข้อมูลใช่หรือไม่?')) {
                              onSystemClean();
                              setSection('MAIN');
                            }
                          }}
                          className="w-full p-4 flex items-center justify-between bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-xl transition-colors group"
                        >
                          <div className="flex items-center gap-3">
                            <RefreshCw size={20} className="text-amber-500 group-hover:rotate-180 transition-transform duration-500" />
                            <div className="text-left">
                              <div className="font-medium text-amber-600 dark:text-amber-400">ล้างข้อมูล Cache & Sync</div>
                              <div className="text-[10px] text-amber-500/70">ลบข้อมูลในเครื่องที่ไม่ตรงกับฐานข้อมูล</div>
                            </div>
                          </div>
                          <ChevronRight size={18} className="text-amber-500" />
                        </button>
                      </div>
                    )}
                 </div>

                 <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10 flex justify-end">
                    <button 
                        onClick={() => {
                            showToast(t('btn.save') + ' ' + t('status.completed'));
                            setSection('MAIN');
                        }}
                        className="bg-orange-500 hover:bg-orange-400 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-2 shadow-lg shadow-orange-900/20 transition-all active:scale-95"
                    >
                        <Save size={18} /> {t('btn.save')}
                    </button>
                </div>
            </div>
        </div>
    );
  };

  const HelpView = () => (
    <div className="space-y-6 animate-slide-in-top">
        <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white"><HelpCircle className="text-teal-400" /> {t('profile.help')}</h3>
            <div className="text-gray-600 dark:text-gray-300">
                Contact support for assistance.
            </div>
             <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10 flex justify-end">
                <button onClick={() => setSection('MAIN')} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white">{t('btn.back')}</button>
             </div>
        </div>
    </div>
  );

   const NotificationsView = () => (
    <div className="space-y-6 animate-slide-in-top">
        <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white"><Bell className="text-neon-purple" /> {t('profile.notifications')}</h3>
            <div className="text-gray-600 dark:text-gray-300">
                Notification settings here.
            </div>
             <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10 flex justify-end">
                <button onClick={() => setSection('MAIN')} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white">{t('btn.back')}</button>
             </div>
        </div>
    </div>
  );

  const SecurityView = () => (
    <div className="space-y-6 animate-slide-in-top">
        <div className="glass-panel p-6 rounded-2xl">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-slate-800 dark:text-white"><Shield className="text-green-400" /> {t('profile.security')}</h3>
            <div className="text-gray-600 dark:text-gray-300">
                Password and security settings.
            </div>
             <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/10 flex justify-end">
                <button onClick={() => setSection('MAIN')} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white">{t('btn.back')}</button>
             </div>
        </div>
    </div>
  );

  const MainProfileView = () => (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
        {/* Left Column: ID Card & Quick Stats */}
        <div className="space-y-6">
            {/* Identity Card */}
            <div className="glass-panel p-6 rounded-2xl relative overflow-hidden border-t border-gray-200 dark:border-white/10 group">
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-neon-blue/20 to-neon-purple/20"></div>
                
                <div className="relative flex flex-col items-center mt-4">
                    <div className="w-24 h-24 rounded-full border-4 border-white dark:border-[#020617] p-1 bg-gradient-to-br from-neon-blue to-neon-purple shadow-lg shadow-neon-blue/20">
                        <img 
                            src="https://picsum.photos/200/200" 
                            alt="Profile" 
                            className="w-full h-full rounded-full object-cover bg-gray-200 dark:bg-gray-800"
                        />
                    </div>
                    
                    <div className="text-center mt-3">
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{profileData.name}</h2>
                        <p className="text-sm text-neon-blue font-medium mt-1">{profileData.position}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <span className="px-2 py-0.5 rounded text-[10px] bg-gray-100 dark:bg-white/10 border border-gray-200 dark:border-white/5 text-gray-500 dark:text-gray-300">ID: {profileData.id}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/20 border border-green-500/30 text-green-600 dark:text-green-400 font-bold flex items-center gap-1">
                                <Shield size={10} /> VERIFIED
                            </span>
                        </div>
                    </div>
                </div>

                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-white/5 space-y-3">
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <Mail size={16} />
                        </div>
                        <span className="truncate">{profileData.email}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <Phone size={16} />
                        </div>
                        <span>{profileData.phone}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300">
                        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-500 dark:text-gray-400">
                            <MapPin size={16} />
                        </div>
                        <span>{profileData.zone}</span>
                    </div>
                </div>
            </div>

            {/* Performance Stats */}
            <div className="glass-panel p-5 rounded-2xl">
                <h3 className="text-sm font-bold text-gray-400 mb-4 uppercase tracking-wider">{t('profile.perf')}</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-white/50 dark:bg-white/5 rounded-xl p-3 border border-gray-200 dark:border-white/5 flex flex-col items-center justify-center text-center">
                        <div className="text-neon-purple mb-1"><Award size={20} /></div>
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">98%</span>
                        <span className="text-[10px] text-gray-500">{t('profile.accuracy')}</span>
                    </div>
                    <div className="bg-white/50 dark:bg-white/5 rounded-xl p-3 border border-gray-200 dark:border-white/5 flex flex-col items-center justify-center text-center">
                        <div className="text-neon-blue mb-1"><Calendar size={20} /></div>
                        <span className="text-2xl font-bold text-slate-900 dark:text-white">142</span>
                        <span className="text-[10px] text-gray-500">{t('profile.completed')}</span>
                    </div>
                </div>
            </div>
        </div>

        {/* Right Column: Settings & Menus */}
        <div className="lg:col-span-2 space-y-6">
            
            <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-white/50 dark:bg-white/5">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t('profile.account')}</h3>
                </div>
                
                <div className="divide-y divide-gray-200 dark:divide-white/5">
                    <button onClick={() => setSection('EDIT_PROFILE')} className="w-full p-4 flex items-center justify-between hover:bg-white/50 dark:hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                                <User size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">{t('btn.edit')}</div>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                    </button>

                    <button onClick={() => setSection('NOTIFICATIONS')} className="w-full p-4 flex items-center justify-between hover:bg-white/50 dark:hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-500 dark:text-purple-400 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                                <Bell size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">{t('profile.notifications')}</div>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                    </button>

                    <button onClick={() => setSection('SECURITY')} className="w-full p-4 flex items-center justify-between hover:bg-white/50 dark:hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-green-500/10 text-green-600 dark:text-green-400 group-hover:bg-green-500 group-hover:text-white transition-colors">
                                <Shield size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">{t('profile.security')}</div>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                    </button>
                </div>
            </div>

            <div className="glass-panel rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-gray-200 dark:border-white/5 bg-white/50 dark:bg-white/5">
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t('profile.other')}</h3>
                </div>
                
                <div className="divide-y divide-gray-200 dark:divide-white/5">
                    <button onClick={() => setSection('SETTINGS')} className="w-full p-4 flex items-center justify-between hover:bg-white/50 dark:hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-orange-500/10 text-orange-500 dark:text-orange-400 group-hover:bg-orange-500 group-hover:text-white transition-colors">
                                <Settings size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">{t('profile.settings')}</div>
                                <div className="text-xs text-gray-500">{t('profile.lang')}, {t('profile.theme')}</div>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                    </button>

                    <button onClick={() => setSection('HELP')} className="w-full p-4 flex items-center justify-between hover:bg-white/50 dark:hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-4">
                            <div className="p-2 rounded-lg bg-teal-500/10 text-teal-600 dark:text-teal-400 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                                <HelpCircle size={20} />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-medium text-slate-900 dark:text-white">{t('profile.help')}</div>
                            </div>
                        </div>
                        <ChevronRight size={18} className="text-gray-400 group-hover:text-slate-900 dark:group-hover:text-white" />
                    </button>
                </div>
            </div>

            <button 
                onClick={onLogout}
                className="w-full p-4 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-500 dark:hover:text-red-300 transition-all flex items-center justify-center gap-2 font-bold shadow-lg shadow-red-500/10 dark:shadow-red-900/20"
            >
                <LogOut size={20} />
                {t('nav.logout')}
            </button>

             <p className="text-center text-xs text-gray-500 dark:text-gray-600 mt-4">
                SPP Smart Tracker v1.1.0 <br/>
                &copy; 2024 Energy Regulatory Commission
            </p>

        </div>
      </div>
  );

  return (
    <div className="space-y-6 animate-fade-in w-full pb-24 md:pb-0 relative">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-green-500 text-white px-6 py-3 rounded-full shadow-[0_0_20px_rgba(34,197,94,0.4)] flex items-center gap-2 animate-fade-in border border-green-400 font-medium">
            <div className="bg-white rounded-full p-0.5 text-green-600"><Check size={12} strokeWidth={4} /></div>
            {toastMessage}
        </div>
      )}

      {/* Header / Back */}
      <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button onClick={section === 'MAIN' ? onBack : () => setSection('MAIN')} className="text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors text-sm flex items-center gap-1">
                {section === 'MAIN' ? (
                    <>← {t('btn.back')}</>
                ) : (
                    <><ArrowLeft size={16} /> {t('btn.back')}</>
                )}
            </button>
            <span className="text-gray-400 dark:text-gray-600">/</span>
            <span className="text-slate-900 dark:text-gray-200 text-sm">
                {section === 'MAIN' && t('profile.title')}
                {section === 'EDIT_PROFILE' && t('btn.edit')}
                {section === 'SETTINGS' && t('profile.settings')}
                {section !== 'MAIN' && section !== 'EDIT_PROFILE' && section !== 'SETTINGS' && section}
            </span>
          </div>
      </div>

      {section === 'MAIN' && <MainProfileView />}
      {section === 'EDIT_PROFILE' && <EditProfileView />}
      {section === 'NOTIFICATIONS' && <NotificationsView />}
      {section === 'SECURITY' && <SecurityView />}
      {section === 'SETTINGS' && <SettingsView />}
      {section === 'HELP' && <HelpView />}

    </div>
  );
};
