
import React, { useState, useEffect, useRef } from 'react';
import { InspectionData, InspectionStatus, ViewState, PlantData } from '../types';
import { 
  Clock, CheckCircle, AlertTriangle, FileText, Loader2, X, Wrench, 
  Zap, ChevronRight, Activity, TrendingUp, Sparkles, Building2,
  Calendar, ArrowRight, ShieldCheck, MapPin, BarChart3, List, AlertOctagon,
  Upload, QrCode, FileDown, Eye, History as HistoryIcon, RefreshCw
} from 'lucide-react';
import QRCodeReact from 'react-qr-code';
import { generateInspectionPDF, combinePDFs } from '../services/pdfService';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, ReferenceLine } from 'recharts';
import { generateSystemAuditReport, getDashboardBriefing } from '../services/geminiService';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotifications } from '../contexts/NotificationContext';

// --- Advanced Road Logic (Matching Inspection Form) ---
const calculateRoadDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const geodesicDist = R * c;
  
  // Dynamic Road Factor:
  // > 10km: Assume Highway (Multiplier 1.25)
  // < 10km: Assume Urban/Local Roads (Multiplier 1.5)
  const roadFactor = geodesicDist > 10000 ? 1.25 : 1.5;
  
  return Math.round(geodesicDist * roadFactor); 
};

interface DashboardProps {
  onStartInspection: (plantId: string) => void;
  onViewAll: () => void;
  onNav: (view: ViewState) => void;
  onUpdate?: (data: InspectionData) => void;
  onRefresh?: () => Promise<void>;
  inspections: InspectionData[];
  plants?: PlantData[];
}

export const Dashboard: React.FC<DashboardProps> = ({ onStartInspection, onViewAll, onNav, onUpdate, onRefresh, inspections, plants = [] }) => {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [briefing, setBriefing] = useState<string>(t('loading'));
  const [currentLoc, setCurrentLoc] = useState<{lat: number, lng: number} | null>(null);
  const alertProcessed = useRef(false);

  // QR Code State
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrFileName, setQrFileName] = useState('');

  // Upload State (Mock)
  // Removed local onUpdate state as it is now passed as a prop

  const handleUploadReport = (e: React.MouseEvent, item: InspectionData) => {
    e.stopPropagation();
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'application/pdf';
    fileInput.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (file) {
        console.log(`Uploading report for inspection ${item.id}:`, file.name);
        
        if (onUpdate) {
             const reader = new FileReader();
             reader.onload = (e) => {
                 const base64 = e.target?.result as string;
                 // Simulate upload delay
                 setTimeout(() => {
                     onUpdate({
                         ...item,
                         uploadedReportUrl: base64
                     });
                     addNotification('SUCCESS', 'อัปโหลดสำเร็จ', `อัปโหลดรายงานสำหรับ ${item.plantName} เรียบร้อยแล้ว`);
                 }, 1000);
             };
             reader.readAsDataURL(file);
        } else {
            alert(`Upload simulated: ${file.name}. (Data update not persisted in Dashboard view)`);
        }
      }
    };
    fileInput.click();
  };

  const handleGenerateQRCode = async (e: React.MouseEvent, item: InspectionData) => {
    e.stopPropagation();
    setIsGeneratingQR(true);
    setShowQRModal(true);
    setQrFileName(`CombinedReport_${item.plantId}.pdf`);
    setQrCodeUrl(null);

    try {
        const systemPdfBlob = await generateInspectionPDF(item, true) as Blob;
        let finalBlob = systemPdfBlob;
        if (item.uploadedReportUrl) {
            try {
                const response = await fetch(item.uploadedReportUrl);
                if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
                const uploadedBlob = await response.blob();
                finalBlob = await combinePDFs(systemPdfBlob, uploadedBlob);
            } catch (err) {
                console.warn("Could not load uploaded report (likely expired blob URL). Generating system report only.");
            }
        }
        const url = URL.createObjectURL(finalBlob);
        setQrCodeUrl(url);
    } catch (error) {
        console.error("Error generating PDF:", error);
        alert("Failed to generate report.");
        setShowQRModal(false);
    } finally {
        setIsGeneratingQR(false);
    }
  };

  const handleDownloadPDF = async (e: React.MouseEvent, item: InspectionData) => {
      e.stopPropagation();
      await generateInspectionPDF(item);
  };

  const handleViewReport = (e: React.MouseEvent, item: InspectionData) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!item.uploadedReportUrl) {
          alert('No report uploaded.');
          return;
      }

      // Open a blank window first to ensure it's not blocked by popup blockers
      const win = window.open('', '_blank');
      
      if (win) {
          // Use iframe approach to display the report. 
          // This is more reliable for base64 data than direct navigation.
          win.document.write(`
            <html>
              <head>
                <title>Report: ${item.plantName}</title>
                <style>
                  body { margin: 0; padding: 0; background: #333; overflow: hidden; height: 100vh; width: 100vw; }
                  iframe { border: none; width: 100%; height: 100%; display: block; }
                </style>
              </head>
              <body>
                <iframe src="${item.uploadedReportUrl}" allowfullscreen></iframe>
              </body>
            </html>
          `);
          win.document.close();
      } else {
          alert('Popup blocked! Please allow popups to view the report.');
      }
  };
  
  useEffect(() => {
    const fetchBrief = async () => {
      try {
        const text = await getDashboardBriefing(inspections);
        setBriefing(text);
      } catch (e) {
        setBriefing("System Ready. Check pending tasks below.");
      }
    };
    fetchBrief();
  }, [inspections]);

  // GPS Tracking for Live Distance
  useEffect(() => {
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setCurrentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      (err) => console.warn("Dashboard GPS Error:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // Key Metrics
  const inProgressCount = inspections.filter(i => i.status !== InspectionStatus.COMPLETED).length;
  
  const completedInspections = inspections.filter(i => i.status === InspectionStatus.COMPLETED);
  
  const getAvg = (i: InspectionData) => {
      const s1 = i.powerQualityScore;
      const s2 = i.powerQualityScoreInside;
      if (s1 !== undefined && s2 !== undefined) return (s1 + s2) / 2;
      if (s1 !== undefined) return s1;
      if (s2 !== undefined) return s2;
      return 0;
  };

  const excellentCount = completedInspections.filter(i => getAvg(i) >= 80).length;
  const moderateCount = completedInspections.filter(i => getAvg(i) >= 50 && getAvg(i) < 80).length;
  const poorCount = completedInspections.filter(i => getAvg(i) < 50).length;

  // Transform Real Data for Chart (Show Power Quality Scores, max 10 recent)
  const chartData = inspections
    .filter(i => i.status === InspectionStatus.COMPLETED && (i.powerQualityScore !== undefined || i.powerQualityScoreInside !== undefined))
    .slice(0, 10)
    .map(i => {
        return {
            name: i.plantId,
            plantName: i.plantName,
            score: Number(getAvg(i).toFixed(1))
        };
    })
    .reverse();
  
  const handleRefresh = async () => {
    if (isRefreshing || !onRefresh) return;
    setIsRefreshing(true);
    try {
        await onRefresh();
        addNotification('SUCCESS', 'ซิงค์ข้อมูลสำเร็จ', 'ข้อมูลถูกอัปเดตจาก Google Sheets เรียบร้อยแล้ว');
    } catch (error) {
        addNotification('ALERT', 'ซิงค์ข้อมูลล้มเหลว', 'ไม่สามารถเชื่อมต่อกับฐานข้อมูลคลาวด์ได้');
    } finally {
        setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in pb-20">
      
      {/* 1. Operational Header (Clean & Direct) */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 border-b border-gray-200 dark:border-white/5 pb-8">
         <div className="space-y-2">
            <div className="flex items-center gap-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
               <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">{t('dash.system_online')}</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
               {t('dash.title')}
            </h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-light max-w-xl">
               {briefing}
            </p>
         </div>
         <div className="flex gap-3">
             <button 
               onClick={handleRefresh}
               disabled={isRefreshing}
               className="px-6 py-3 bg-white hover:bg-gray-50 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm dark:shadow-none disabled:opacity-50"
             >
               {isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} 
               {isRefreshing ? 'Syncing...' : 'Sync with Cloud'}
             </button>
             <button 
               onClick={() => setIsGeneratingReport(true)}
               className="px-6 py-3 bg-white hover:bg-gray-50 dark:bg-white/5 dark:hover:bg-white/10 border border-gray-200 dark:border-white/10 text-slate-700 dark:text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 shadow-sm dark:shadow-none"
             >
               <FileText size={16} /> {t('btn.report')}
             </button>
             <button 
               onClick={onViewAll}
               className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/20 flex items-center gap-2"
             >
               <List size={16} /> {t('nav.tasks')}
             </button>
         </div>
      </div>

      {/* 2. Primary Metrics Row (4 Columns) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         {/* In Progress */}
         <div className="minimal-card p-5 flex flex-col justify-between h-32 group hover:border-sky-500/30">
             <div className="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity"><Clock size={40} className="text-slate-900 dark:text-white" /></div>
             <span className="text-[10px] font-black text-sky-500 uppercase tracking-widest">อยู่ระหว่างตรวจสอบ</span>
             <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{inProgressCount}</span>
                <span className="text-xs text-slate-500 mb-1">{t('dash.items')}</span>
             </div>
         </div>
         
         {/* Excellent */}
         <div className="minimal-card p-5 flex flex-col justify-between h-32 group hover:border-emerald-500/30">
             <div className="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity"><CheckCircle size={40} className="text-slate-900 dark:text-white" /></div>
             <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">คุณภาพดีเยี่ยม</span>
             <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{excellentCount}</span>
                <span className="text-xs text-slate-500 mb-1">{t('dash.items')}</span>
             </div>
         </div>

         {/* Moderate */}
         <div className="minimal-card p-5 flex flex-col justify-between h-32 group hover:border-amber-500/30">
             <div className="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity"><Activity size={40} className="text-slate-900 dark:text-white" /></div>
             <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">คุณภาพปานกลาง</span>
             <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{moderateCount}</span>
                <span className="text-xs text-slate-500 mb-1">{t('dash.items')}</span>
             </div>
         </div>

         {/* Poor */}
         <div className="minimal-card p-5 flex flex-col justify-between h-32 group hover:border-rose-500/30">
             <div className="absolute right-4 top-4 opacity-10 group-hover:opacity-20 transition-opacity"><AlertOctagon size={40} className="text-slate-900 dark:text-white" /></div>
             <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">คุณภาพต่ำกว่าเกณฑ์</span>
             <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{poorCount}</span>
                <span className="text-xs text-slate-500 mb-1">{t('dash.items')}</span>
             </div>
         </div>
      </div>

      {/* 3. Main Content Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
         
         {/* Left: Monitoring Chart (8 Columns) - Now using Real Data */}
         <div className="lg:col-span-8 p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#0f172a]/40 border border-gray-200 dark:border-white/5 shadow-sm dark:shadow-none">
             <div className="flex justify-between items-center mb-8">
                <div>
                   <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <TrendingUp size={20} className="text-indigo-500" /> Power Quality Score Trends
                   </h3>
                   <p className="text-xs text-slate-500 uppercase tracking-widest mt-1">Last 10 Inspections (Average Score)</p>
                </div>
                <div className="flex gap-2">
                   <div className="flex items-center gap-2 px-3 py-1 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500"></div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase">Good ({'>'}80)</span>
                   </div>
                </div>
             </div>
             
             <div className="h-[300px] w-full">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(100, 116, 139, 0.2)" vertical={false} />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                        <YAxis stroke="#64748b" fontSize={11} axisLine={false} tickLine={false} dx={-10} domain={[0, 100]} />
                        <Tooltip 
                        cursor={{fill: 'rgba(99, 102, 241, 0.1)'}} 
                        contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                        formatter={(value: number) => [`${value} / 100`, 'PQ Score']}
                        labelStyle={{ color: '#94a3b8', fontSize: '12px', marginBottom: '5px' }}
                        />
                        <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'top', value: 'Good (80)', fill: '#10b981', fontSize: 10 }} />
                        <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'top', value: 'Pass (50)', fill: '#f59e0b', fontSize: 10 }} />
                        <Bar dataKey="score" radius={[4, 4, 0, 0]} barSize={40}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.score >= 80 ? '#10b981' : entry.score >= 50 ? '#f59e0b' : '#f43f5e'} />
                        ))}
                        </Bar>
                    </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                        <BarChart3 size={48} className="mb-2 text-slate-300 opacity-80" />
                        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">No Data Available</p>
                        <p className="text-[10px] text-slate-400 mt-1">Complete inspections to see score trends</p>
                    </div>
                )}
             </div>
         </div>

         {/* Right: Quick Management Actions (4 Columns) */}
          <div className="lg:col-span-4 space-y-4">
             <div className="flex items-center justify-between px-1 mb-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-widest">{t('dash.management')}</h3>
             </div>

             <button onClick={() => onNav('PLANTS')} className="minimal-card w-full p-5 flex items-center justify-between text-left group hover:border-emerald-500/30">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl group-hover:scale-110 transition-transform">
                      <Building2 size={20} />
                   </div>
                   <div>
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">{t('dash.plant_registry')}</span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        {plants.length > 0 ? `${plants.filter(p => p.status === 'ACTIVE').length} Active / ${plants.length} Total` : t('dash.manage_db')}
                      </span>
                   </div>
                </div>
                <ArrowRight size={16} className="text-slate-400 dark:text-slate-600 group-hover:text-emerald-500 transition-colors" />
             </button>

             <button onClick={() => onNav('TOOLS')} className="minimal-card w-full p-5 flex items-center justify-between text-left group hover:border-amber-500/30">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl group-hover:scale-110 transition-transform">
                      <Wrench size={20} />
                   </div>
                   <div>
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">{t('dash.equipment')}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{t('dash.status_cal')}</span>
                   </div>
                </div>
                <ArrowRight size={16} className="text-slate-400 dark:text-slate-600 group-hover:text-amber-500 transition-colors" />
             </button>

             <button onClick={() => onNav('HISTORY')} className="minimal-card w-full p-5 flex items-center justify-between text-left group hover:border-indigo-500/30">
                <div className="flex items-center gap-4">
                   <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl group-hover:scale-110 transition-transform">
                      <HistoryIcon size={20} />
                   </div>
                   <div>
                      <span className="block text-sm font-bold text-slate-900 dark:text-white">ประวัติการตรวจสอบ</span>
                      <span className="text-[10px] text-slate-500 font-mono">ดูแนวโน้มและรายงานย้อนหลัง</span>
                   </div>
                </div>
                <ArrowRight size={16} className="text-slate-400 dark:text-slate-600 group-hover:text-indigo-500 transition-colors" />
             </button>

             <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-600/10 border border-indigo-100 dark:border-indigo-500/20 mt-4">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-2">
                   <Sparkles size={16} />
                   <span className="text-[10px] font-black uppercase tracking-widest">{t('dash.ai_active')}</span>
                </div>
                <p className="text-xs text-indigo-800 dark:text-indigo-200/70 leading-relaxed">
                   {t('dash.ai_desc')}
                </p>
             </div>
         </div>
      </div>

      {/* 4. Recent Activity List (Simplified) */}
      <div className="space-y-4">
          <div className="flex justify-between items-center border-b border-gray-200 dark:border-white/5 pb-4 px-2">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-slate-900 dark:text-white">{t('dash.recent_activity')}</h3>
              <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-mono">
                {inspections.length}
              </span>
            </div>
            <span className="text-xs text-slate-500 font-mono">
              {inspections.length > 0 
                ? `${t('dash.showing')} ${Math.min(inspections.length, 5)} ${t('dash.items')}` 
                : t('dash.no_data')}
            </span>
          </div>
         
         <div className="space-y-2">
            {inspections.slice(0, 5).map((item, index) => {
               const s1 = item.powerQualityScore;
               const s2 = item.powerQualityScoreInside;
               let avgScore: number | null = null;
               
               if (s1 !== undefined || s2 !== undefined) {
                   const count = (s1 !== undefined ? 1 : 0) + (s2 !== undefined ? 1 : 0);
                   avgScore = ((s1 || 0) + (s2 || 0)) / count;
               }

               return (
              <div 
                 key={`${item.id}-${index}`} 
                 onClick={() => onStartInspection(item.id)}
                 className={`flex items-center gap-4 p-4 rounded-xl bg-white dark:bg-white/[0.01] border border-gray-100 dark:border-transparent shadow-sm dark:shadow-none transition-all ${
                    item.status === InspectionStatus.COMPLETED 
                    ? 'opacity-80 hover:bg-gray-50 dark:hover:bg-white/[0.03] cursor-pointer' 
                    : 'hover:bg-gray-50 dark:hover:bg-white/[0.03] hover:border-gray-200 dark:hover:border-white/5 cursor-pointer group'
                 }`}
              >
                 <div className={`p-2.5 rounded-lg ${
                    item.status === InspectionStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-100 dark:bg-slate-700/30 text-slate-500 dark:text-slate-400'
                 }`}>
                    {item.status === InspectionStatus.COMPLETED ? <CheckCircle size={18} /> : <Zap size={18} />}
                 </div>
                 
                 <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-center">
                    <div>
                       <p className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.plantName}</p>
                       <p className="text-[10px] text-slate-500 font-mono">{item.plantId}</p>
                    </div>
                    
                    <div className="hidden sm:block">
                       <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-0.5">{t('dash.location')}</p>
                       <p className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1">
                          <MapPin size={10} /> 
                           {currentLoc && item.location ? (
                               (() => {
                                   const dist = calculateRoadDistance(currentLoc.lat, currentLoc.lng, item.location.lat, item.location.lng);
                                   return dist >= 1000 ? `${(dist / 1000).toFixed(2)} km` : `${dist} m`;
                               })()
                           ) : (
                               item.distanceFromSite >= 1000 ? `${(item.distanceFromSite / 1000).toFixed(2)} km` : `${item.distanceFromSite} m`
                           )}
                           {' '}{t('dash.away')}
                       </p>
                    </div>

                    <div className="hidden md:block w-72">
                       <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-1">PQ Score (Avg)</p>
                       {avgScore !== null ? (
                           <div className="relative w-full h-5 rounded-md bg-slate-100 dark:bg-slate-800 overflow-hidden">
                               <div 
                                   className={`absolute top-0 left-0 h-full ${
                                       avgScore >= 80 ? 'bg-emerald-500' : 
                                       avgScore >= 50 ? 'bg-amber-500' : 
                                       'bg-rose-500'
                                   }`} 
                                   style={{ width: `${avgScore}%` }}
                               ></div>
                               <div className="absolute inset-0 flex items-center justify-center">
                                   <span className="text-[10px] font-bold text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
                                       {avgScore.toFixed(1)}%
                                   </span>
                               </div>
                           </div>
                       ) : (
                           <span className="text-xs font-mono text-slate-400">-</span>
                       )}
                    </div>

                    {/* Actions Column (Desktop) */}
                    <div className="hidden md:flex justify-end gap-2">
                       {item.status === InspectionStatus.COMPLETED && (
                           <>
                               {item.uploadedReportUrl && (
                                   <button 
                                     onClick={(e) => handleViewReport(e, item)}
                                     className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                     title="View Uploaded Report"
                                   >
                                     <Eye size={16} />
                                   </button>
                               )}
                               <button 
                                 onClick={(e) => handleUploadReport(e, item)}
                                 className="p-2 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                 title="Upload Report (PDF)"
                               >
                                 <Upload size={16} />
                               </button>
                               <button 
                                 onClick={(e) => handleGenerateQRCode(e, item)}
                                 className="p-2 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                                 title="Scan QR"
                               >
                                 <QrCode size={16} />
                               </button>
                               <button 
                                 onClick={(e) => handleDownloadPDF(e, item)}
                                 className="p-2 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                                 title="Download PDF"
                               >
                                 <FileDown size={16} />
                               </button>
                           </>
                       )}
                    </div>

                    <div className="text-right flex flex-col items-end gap-2">
                       <span className={`text-[10px] font-black uppercase px-2 py-1 rounded ${
                          item.status === InspectionStatus.COMPLETED ? 'text-emerald-500 bg-emerald-500/10' : 
                          item.status === InspectionStatus.PENDING ? 'text-sky-500 bg-sky-500/10' : 'text-slate-500 bg-gray-100 dark:bg-white/5'
                       }`}>
                          {item.status}
                       </span>

                       {item.status === InspectionStatus.COMPLETED && (
                           <div className="flex gap-1 md:hidden">
                               {item.uploadedReportUrl && (
                                   <button 
                                     onClick={(e) => handleViewReport(e, item)}
                                     className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                                     title="View Uploaded Report"
                                   >
                                     <Eye size={14} />
                                   </button>
                               )}
                               <button 
                                 onClick={(e) => handleUploadReport(e, item)}
                                 className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                                 title="Upload Report (PDF)"
                               >
                                 <Upload size={14} />
                               </button>
                               <button 
                                 onClick={(e) => handleGenerateQRCode(e, item)}
                                 className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                                 title="Scan QR"
                               >
                                 <QrCode size={14} />
                               </button>
                               <button 
                                 onClick={(e) => handleDownloadPDF(e, item)}
                                 className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                                 title="Download PDF"
                               >
                                 <FileDown size={14} />
                               </button>
                           </div>
                       )}
                    </div>
                 </div>
                 
                 {item.status !== InspectionStatus.COMPLETED && (
                    <ChevronRight size={16} className="text-slate-400 dark:text-slate-700 group-hover:text-slate-600 dark:group-hover:text-white transition-colors" />
                 )}
              </div>
            );
            })}
         </div>
      </div>
      
      {/* Report Modal */}
      {isGeneratingReport && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/50 dark:bg-[#020617]/90 backdrop-blur-md animate-fade-in">
           <div className="w-full max-w-lg bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-3xl p-8 shadow-2xl animate-slide-up text-center">
              <div className="w-16 h-16 bg-indigo-600/20 text-indigo-500 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Loader2 size={32} className="animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Generating Report</h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mb-8">Compiling data from Gemini AI Analysis...</p>
              <button onClick={() => setIsGeneratingReport(false)} className="px-8 py-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-xl text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-300 transition-all">
                 {t('btn.cancel')}
              </button>
           </div>
        </div>
      )}
      {/* QR Code Modal */}
      {showQRModal && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
                <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl shadow-2xl flex flex-col items-center max-w-sm w-full relative animate-scale-in">
                    <button 
                        onClick={() => setShowQRModal(false)} 
                        className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                    >
                        <X size={20} />
                    </button>
                    
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Scan to Download</h3>
                    <p className="text-xs text-slate-500 mb-6 text-center">Combined PQ Audit Report + Attached Files</p>
                    
                    <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-inner mb-6">
                        {isGeneratingQR ? (
                            <div className="w-48 h-48 flex items-center justify-center">
                                <Loader2 size={32} className="animate-spin text-indigo-600" />
                            </div>
                        ) : qrCodeUrl ? (
                            <QRCodeReact value={qrCodeUrl} size={192} />
                        ) : (
                            <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-sm">
                                Failed to load
                            </div>
                        )}
                    </div>

                    {qrCodeUrl && (
                        <a 
                            href={qrCodeUrl} 
                            download={qrFileName}
                            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-semibold text-sm transition-all shadow-lg shadow-indigo-600/20 w-full justify-center"
                        >
                            <FileDown size={18} /> Download Combined PDF
                        </a>
                    )}
                </div>
            </div>
        )}

    </div>
  );
};
