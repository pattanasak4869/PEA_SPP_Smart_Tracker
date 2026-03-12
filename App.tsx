
import React, { useState, useEffect } from 'react';
import { InspectionData, InspectionStatus, ViewState, PlantData, ToolData } from './types';
import { Dashboard } from './components/Dashboard';
import { InspectionForm } from './components/InspectionForm';
import { AllTasks } from './components/AllTasks';
import { Profile } from './components/Profile';
import { InspectionHistory } from './components/InspectionHistory';
import { Login } from './components/Login';
import { PlantRegistry } from './components/PlantRegistry';
import { ToolsManager } from './components/ToolsManager';
import { NotificationCenter } from './components/NotificationCenter';
import { ChatBot } from './components/ChatBot';
import { Zap, LayoutDashboard, User, Menu, X, Loader2, Building2, Wrench, Bell, CheckSquare, History as HistoryIcon } from 'lucide-react';
import { fetchInspections, saveInspectionToSheet, fetchPlants, fetchTools, subscribeToUpdates, refreshData, logout, clearAllLocalCaches } from './services/sheetsService';
import { socketService } from './services/socketService';
import { useLanguage } from './contexts/LanguageContext';
import { useNotifications } from './contexts/NotificationContext';
import { useSettings } from './contexts/SettingsContext';
import { TranslationKey } from './utils/translations';

const App: React.FC = () => {
  const { t } = useLanguage();
  const { unreadCount, addNotification } = useNotifications();
  const [socketStatus, setSocketStatus] = useState<'CONNECTED' | 'DISCONNECTED' | 'CONNECTING'>(socketService.getStatus());
  const { settings } = useSettings();
  
  const [isAuthenticated, setIsAuthenticated] = useState(() => localStorage.getItem('app_auth') === 'true');
  const [currentUser, setCurrentUser] = useState<any>(() => {
      const saved = localStorage.getItem('user_profile');
      return saved ? JSON.parse(saved) : null;
  });
  const [view, setView] = useState<ViewState>(() => (localStorage.getItem('current_view') as ViewState) || 'DASHBOARD');
  
  const [inspections, setInspections] = useState<InspectionData[]>([]);
  const [plants, setPlants] = useState<PlantData[]>([]);
  const [tools, setTools] = useState<ToolData[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [activeInspectionId, setActiveInspectionId] = useState<string | null>(() => localStorage.getItem('active_task_id'));
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNotiOpen, setIsNotiOpen] = useState(false);
  
  const inspectionsRef = React.useRef<InspectionData[]>([]);
  const plantsRef = React.useRef<PlantData[]>([]);
  const toolsRef = React.useRef<ToolData[]>([]);
  const activeInspectionIdRef = React.useRef<string | null>(activeInspectionId);

  useEffect(() => { inspectionsRef.current = inspections; }, [inspections]);
  useEffect(() => { plantsRef.current = plants; }, [plants]);
  useEffect(() => { toolsRef.current = tools; }, [tools]);
  useEffect(() => { activeInspectionIdRef.current = activeInspectionId; }, [activeInspectionId]);

  const hasShownWelcome = React.useRef(false);
  const networkStatusRef = React.useRef(navigator.onLine);
  const anomalyAlertedRef = React.useRef(false);

  useEffect(() => {
    // Cleanup old mock data from LocalStorage
    // Any ID that is in the mock list or doesn't look like a real timestamp-based ID
    const mockIds = ['ins_1', 'p1', 'p2', 'p3', '1', '2', '3', 'test', 'demo'];
    let needsReload = false;
    
    ['app_data_inspections', 'app_data_plants', 'app_data_tools'].forEach(key => {
      const saved = localStorage.getItem(key);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const filtered = parsed.filter((item: any) => {
            // Keep if it's the specific real ID the user mentioned
            if (item.id === '1773129373676-olit7jgx1') return true;
            
            // Filter out known mock IDs
            if (mockIds.includes(item.id)) return false;
            
            // If it's a very old timestamp or looks like a placeholder, filter it
            // (Optional: you can be more specific here if needed)
            return true;
          });
          
          if (filtered.length !== parsed.length) {
            localStorage.setItem(key, JSON.stringify(filtered));
            needsReload = true;
          }
        } catch (e) {}
      }
    });
    
    if (needsReload) {
      window.location.reload();
    }
  }, []);

  useEffect(() => {
    socketService.connect();
    const unsubStatus = socketService.onStatusChange(setSocketStatus);
    
    const unsubscribe = subscribeToUpdates((type, payload) => {
      if (type === 'INSPECTION') {
        const isUpdate = inspectionsRef.current.some(i => i.id === payload.id);
        
        setInspections(prev => {
          const index = prev.findIndex(i => i.id === payload.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = payload;
            return next;
          }
          return [payload, ...prev];
        });

        // Handle notification outside of state updater
        if (isUpdate) {
            if (activeInspectionIdRef.current === payload.id) {
                addNotification('ALERT', 'ข้อมูลถูกอัปเดตโดยผู้อื่น', `รายการตรวจสอบนี้ถูกอัปเดตโดยผู้ใช้อื่น ข้อมูลล่าสุดถูกโหลดเข้าสู่ระบบแล้ว`);
            } else {
                addNotification('INFO', 'อัปเดตข้อมูลการตรวจสอบ', `ข้อมูลของ ${payload.plantName} ถูกอัปเดตแล้ว`);
            }
        } else {
            addNotification('SUCCESS', 'รายการตรวจสอบใหม่', `มีการเพิ่มรายการตรวจสอบสำหรับ ${payload.plantName}`);
        }
      } else if (type === 'PLANT') {
        const isUpdate = plantsRef.current.some(p => p.id === payload.id);
        
        setPlants(prev => {
          const index = prev.findIndex(p => p.id === payload.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = payload;
            return next;
          }
          return [...prev, payload];
        });

        if (isUpdate) {
            addNotification('INFO', 'อัปเดตข้อมูลโรงไฟฟ้า', `ข้อมูลของ ${payload.name} ถูกอัปเดตแล้ว`);
        } else {
            addNotification('SUCCESS', 'โรงไฟฟ้าใหม่', `มีการลงทะเบียนโรงไฟฟ้า ${payload.name} เพิ่มเติม`);
        }
      } else if (type === 'PLANT_DELETED') {
        const item = plantsRef.current.find(p => p.id === payload);
        if (item) {
            addNotification('ALERT', 'ลบข้อมูลโรงไฟฟ้า', `โรงไฟฟ้า ${item.name} ถูกลบออกจากระบบ`);
        }
        setPlants(prev => prev.filter(p => p.id !== payload));
      } else if (type === 'TOOL') {
        const isUpdate = toolsRef.current.some(t => t.id === payload.id);
        
        setTools(prev => {
          const index = prev.findIndex(t => t.id === payload.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = payload;
            return next;
          }
          return [...prev, payload];
        });

        if (isUpdate) {
            addNotification('INFO', 'อัปเดตคลังเครื่องมือ', `ข้อมูลอุปกรณ์ ${payload.name} ถูกอัปเดตในระบบ`);
        } else {
            addNotification('SUCCESS', 'อุปกรณ์ใหม่', `มีการเพิ่มอุปกรณ์ ${payload.name} เข้าสู่คลังเครื่องมือ`);
        }
      } else if (type === 'TOOL_DELETED') {
        const item = toolsRef.current.find(t => t.id === payload);
        if (item) {
            addNotification('ALERT', 'ลบอุปกรณ์', `อุปกรณ์ ${item.name} ถูกลบออกจากคลังเครื่องมือ`);
        }
        setTools(prev => prev.filter(t => t.id !== payload));
      } else if (type === 'USER') {
        if (currentUser && currentUser.id === payload.id) {
            setCurrentUser(payload);
            localStorage.setItem('user_profile', JSON.stringify(payload));
            addNotification('INFO', 'อัปเดตข้อมูลส่วนตัว', 'ข้อมูลโปรไฟล์ของคุณถูกอัปเดตโดยระบบ');
        }
      }
    });

    return () => {
        unsubscribe();
        unsubStatus();
    };
  }, [addNotification]);

  useEffect(() => {
    localStorage.setItem('current_view', view);
  }, [view]);

  // View State Validation - Prevent stuck screens
  useEffect(() => {
    if (view === 'INSPECTION' && !activeInspectionId) {
        setView('DASHBOARD');
    }
  }, [view, activeInspectionId]);

  // System Anomaly: Network Monitoring
  useEffect(() => {
    const handleOnline = () => {
        if (!networkStatusRef.current) {
            networkStatusRef.current = true;
            addNotification('SUCCESS', 'ระบบออนไลน์ (System Online)', 'การเชื่อมต่อเครือข่ายกลับมาทำงานปกติ', 'Network Status: Connected\nSync Status: Ready');
        }
    };
    
    const handleOffline = () => {
        if (networkStatusRef.current) {
            networkStatusRef.current = false;
            addNotification('ALERT', 'ระบบออฟไลน์ (System Offline)', 'ขาดการเชื่อมต่อเครือข่าย ระบบจะทำงานในโหมด Offline-First', 'Network Status: Disconnected\nImpact: Cloud Sync Paused, AI Features Disabled\nAction: Data will be saved locally.');
        }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
    };
  }, [addNotification]);

  useEffect(() => {
    if (isAuthenticated) {
      if (!dataLoaded) {
        loadData();
      }
      
      if (!hasShownWelcome.current) {
        addNotification('SUCCESS', 'เข้าสู่ระบบสำเร็จ', 'ยินดีต้อนรับกลับสู่ระบบ PEA PQ Smart Tracker');
        hasShownWelcome.current = true;
      }
    }
  }, [isAuthenticated, addNotification, dataLoaded]);

  // Global Anomaly Detection
  useEffect(() => {
    if (dataLoaded && inspections.length > 0 && !anomalyAlertedRef.current) {
        // Grounding resistance alerts removed per user request
        anomalyAlertedRef.current = true;
    }
  }, [dataLoaded, inspections, addNotification]);

  const loadData = async () => {
    if (isLoadingData) return;
    setIsLoadingData(true);
    try {
      const [inspectionsData, plantsData, toolsData] = await Promise.all([
        fetchInspections(),
        fetchPlants(),
        fetchTools()
      ]);
      
      // Sort inspections by timestamp descending (newest first)
      const sortedInspections = [...inspectionsData].sort((a, b) => b.timestamp - a.timestamp);
      
      setInspections(sortedInspections);
      setPlants(plantsData);
      setTools(toolsData);
      setDataLoaded(true);
    } catch (error) {
      console.error("Failed to load data", error);
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleRefresh = async () => {
    if (isLoadingData) return;
    setIsLoadingData(true);
    try {
      const success = await refreshData();
      if (success) {
        await loadData();
        return true;
      } else {
        throw new Error('Refresh failed');
      }
    } catch (error) {
      console.error("Refresh failed", error);
      // Fallback to local load if refresh fails
      await loadData();
      throw error;
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleStartInspection = (id: string) => {
    setActiveInspectionId(id);
    localStorage.setItem('active_task_id', id);
    setView('INSPECTION');
    setIsSidebarOpen(false);
  };

  const handleSystemClean = async () => {
    setIsLoadingData(true);
    try {
      await clearAllLocalCaches();
      await handleRefresh();
      addNotification('SUCCESS', 'ล้างข้อมูลสำเร็จ', 'ข้อมูลในเครื่องถูกลบและโหลดใหม่จากฐานข้อมูลแล้ว');
    } catch (error) {
      addNotification('ALERT', 'เกิดข้อผิดพลาด', 'ไม่สามารถล้างข้อมูลได้');
    } finally {
      setIsLoadingData(false);
    }
  };

  const handleSaveInspection = async (data: InspectionData, navigate = true) => {
    setInspections(prev => {
        // Remove existing item with same ID to prevent duplicates and move to top
        const filtered = prev.filter(i => i.id !== data.id);
        return [data, ...filtered];
    });
    
    // Check Auto-Sync Setting
    const shouldSkipNetwork = !settings.autoSync;
    const success = await saveInspectionToSheet(data, shouldSkipNetwork);
    
    if (success) {
        if (shouldSkipNetwork) {
            addNotification('INFO', 'บันทึกในเครื่องแล้ว', 'โหมด Auto-Sync ปิดอยู่ ข้อมูลจะถูกเก็บไว้ในเครื่องเท่านั้น');
        } else {
            addNotification('SUCCESS', 'บันทึกข้อมูลสำเร็จ', `รายงานของ ${data.plantName} ถูกส่งเข้าสู่ระบบแล้ว`);
        }
        
        if (navigate) {
          setView('DASHBOARD');
          setActiveInspectionId(null);
          localStorage.removeItem('active_task_id');
        }
    } else {
        addNotification(
            'ALERT', 
            'ซิงค์ข้อมูลล้มเหลว (Sync Anomaly)', 
            'ไม่สามารถเชื่อมต่อฐานข้อมูลได้ ข้อมูลถูกบันทึกไว้ในเครื่องชั่วคราว',
            `Error Code: SYNC_FAIL_500\nPayload ID: ${data.id}\nReason: API Unreachable or Timeout\nAction: Will retry automatically when network is stable.`
        );
        
        if (navigate) {
          setView('DASHBOARD'); // Still navigate back as local save worked
          setActiveInspectionId(null);
          localStorage.removeItem('active_task_id');
        }
    }
  };

  const handleLogout = async () => {
      await logout();
      setIsAuthenticated(false);
      setCurrentUser(null);
      localStorage.removeItem('app_auth');
      localStorage.removeItem('user_profile');
      hasShownWelcome.current = false;
  };

  if (!isAuthenticated) return (
    <Login 
      onLogin={(user) => { 
        setIsAuthenticated(true); 
        setCurrentUser(user);
        localStorage.setItem('app_auth', 'true'); 
        localStorage.setItem('user_profile', JSON.stringify(user));
      }} 
    />
  );

  const navItems = [
    { id: 'DASHBOARD', icon: <LayoutDashboard size={18} />, label: t('nav.dashboard') },
    { id: 'ALL_TASKS', icon: <CheckSquare size={18} />, label: t('nav.tasks') },
    { id: 'HISTORY', icon: <HistoryIcon size={18} />, label: 'ประวัติการตรวจสอบ' },
    { id: 'PLANTS', icon: <Building2 size={18} />, label: t('nav.plants') },
    { id: 'TOOLS', icon: <Wrench size={18} />, label: t('nav.tools') },
    { id: 'PROFILE', icon: <User size={18} />, label: t('nav.profile') },
  ];

  return (
    <div className="min-h-screen w-full bg-slate-50 dark:bg-[#020617] text-slate-900 dark:text-white font-sans flex flex-col relative overflow-x-hidden selection:bg-indigo-500/30 transition-colors duration-300">
      <header className="shrink-0 border-b border-gray-200 dark:border-white/5 px-4 sm:px-6 lg:px-12 py-4 flex justify-between items-center z-[100] sticky top-0 bg-white/80 dark:bg-[#020617]/80 backdrop-blur-2xl transition-colors duration-300">
        <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-600/20">
                <Zap size={20} className="text-white" fill="currentColor" />
            </div>
            <div className="flex flex-col">
                <h1 className="text-base font-bold tracking-tight">{t('app.title')}</h1>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.1em]">{t('app.division')}</span>
            </div>
        </div>
        
        <nav className="hidden xl:flex items-center gap-2">
            {navItems.map(item => (
                <button 
                  key={item.id}
                  onClick={() => setView(item.id as ViewState)}
                  className={`flex items-center gap-2 text-sm font-medium transition-all px-4 py-2 rounded-xl ${
                    view === item.id 
                    ? 'bg-slate-100 dark:bg-white/10 text-slate-900 dark:text-white' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5'
                  }`}
                >
                   {item.icon}
                   <span>{item.label}</span>
                </button>
            ))}
        </nav>

        <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                <div className={`w-2 h-2 rounded-full ${
                    socketStatus === 'CONNECTED' ? 'bg-emerald-500 animate-pulse' : 
                    socketStatus === 'CONNECTING' ? 'bg-amber-500 animate-bounce' : 'bg-rose-500'
                }`}></div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 hidden sm:inline">
                    {socketStatus === 'CONNECTED' ? 'Real-time Sync' : socketStatus === 'CONNECTING' ? 'Connecting...' : 'Offline'}
                </span>
            </div>

            <button 
              onClick={() => setIsNotiOpen(true)}
              className="relative p-2.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(244,63,94,0.6)]"></span>
              )}
            </button>

            <button className="xl:hidden p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl" onClick={() => setIsSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            
            <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-500 p-[2px] hidden sm:block">
               <img src="https://picsum.photos/100/100" alt="Avatar" className="w-full h-full object-cover rounded-full border-2 border-white dark:border-[#020617]" />
            </div>
        </div>
      </header>

      <NotificationCenter isOpen={isNotiOpen} onClose={() => setIsNotiOpen(false)} />
      <ChatBot />

      {/* Mobile Sidebar */}
      <div className={`fixed inset-0 z-[150] transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsSidebarOpen(false)}></div>
          <div className={`absolute right-0 top-0 bottom-0 w-72 bg-white dark:bg-[#020617] border-l border-gray-200 dark:border-white/10 p-6 transform transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
              <div className="flex justify-between items-center mb-8">
                <span className="text-xs font-black uppercase tracking-widest text-slate-500">Menu</span>
                <button onClick={() => setIsSidebarOpen(false)} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"><X size={18} /></button>
              </div>
              <div className="space-y-2">
                  {navItems.map(item => (
                      <button 
                        key={item.id} 
                        onClick={() => { setView(item.id as ViewState); setIsSidebarOpen(false); }} 
                        className={`flex items-center gap-4 w-full p-4 rounded-xl text-sm font-semibold transition-all ${
                          view === item.id ? 'bg-indigo-600 text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                      >
                          {item.icon} {item.label}
                      </button>
                  ))}
              </div>
          </div>
      </div>

      <main className="flex-1 w-full px-4 sm:px-6 lg:px-12 py-8 max-w-[1600px] mx-auto pb-10">
          {isLoadingData ? (
             <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500 space-y-4">
                <Loader2 className="animate-spin text-indigo-500" size={40} />
                <p className="text-xs font-black uppercase tracking-[0.2em]">{t('loading')}</p>
             </div>
          ) : (
            <div className="animate-fade-in">
              {view === 'DASHBOARD' && (
                <Dashboard 
                  inspections={inspections} 
                  plants={plants} 
                  onStartInspection={handleStartInspection} 
                  onViewAll={() => setView('ALL_TASKS')} 
                  onNav={(v) => setView(v)} 
                  onUpdate={(data) => handleSaveInspection(data, false)}
                  onRefresh={handleRefresh}
                />
              )}
              {view === 'PLANTS' && (
                <PlantRegistry 
                  onBack={() => setView('DASHBOARD')} 
                  onUpdate={loadData} 
                  plantsData={plants} 
                  setPlantsData={setPlants}
                />
              )}
              {view === 'ALL_TASKS' && (
                <AllTasks 
                  inspections={inspections} 
                  plants={plants}
                  onSelect={handleStartInspection} 
                  onBack={() => setView('DASHBOARD')} 
                  onAddNew={handleSaveInspection}
                  onUpdate={(data) => handleSaveInspection(data, false)} 
                />
              )}
              {view === 'TOOLS' && (
                <ToolsManager 
                  toolsData={tools} 
                  setToolsData={setTools} 
                  onBack={() => setView('DASHBOARD')}
                />
              )}
              {view === 'HISTORY' && (
                <InspectionHistory 
                  inspections={inspections} 
                  plants={plants} 
                  onBack={() => setView('DASHBOARD')}
                  onSelectInspection={handleStartInspection}
                />
              )}
              {view === 'INSPECTION' && inspections.find(i => i.id === activeInspectionId) && (
                <InspectionForm 
                  data={inspections.find(i => i.id === activeInspectionId)!} 
                  onBack={() => setView('DASHBOARD')} 
                  onSave={handleSaveInspection} 
                  currentUser={currentUser}
                />
              )}
              {view === 'PROFILE' && (
                <Profile 
                  onBack={() => setView('DASHBOARD')} 
                  onLogout={handleLogout} 
                  currentUser={currentUser}
                  onUpdateUser={(user) => {
                    setCurrentUser(user);
                    localStorage.setItem('user_profile', JSON.stringify(user));
                  }}
                  onSystemClean={handleSystemClean}
                />
              )}
            </div>
          )}
      </main>
    </div>
  );
};

export default App;
