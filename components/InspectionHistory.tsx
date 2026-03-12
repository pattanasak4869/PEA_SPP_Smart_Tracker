
import React, { useState, useMemo } from 'react';
import { InspectionData, InspectionStatus, PlantData } from '../types';
import { 
  ArrowLeft, Search, Calendar, MapPin, Activity, 
  FileText, Download, Eye, Filter,
  ChevronRight, BarChart3, History as HistoryIcon, ShieldCheck,
  AlertTriangle, CheckCircle2, Clock, Wrench
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Legend, ReferenceLine 
} from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';
import { generateInspectionPDF } from '../services/pdfService';

interface InspectionHistoryProps {
  inspections: InspectionData[];
  plants: PlantData[];
  onBack: () => void;
  onSelectInspection: (id: string) => void;
}

export const InspectionHistory: React.FC<InspectionHistoryProps> = ({ 
  inspections, 
  plants, 
  onBack,
  onSelectInspection
}) => {
  const { t } = useLanguage();
  const [selectedPlantId, setSelectedPlantId] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPlants = useMemo(() => {
    return plants.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.plantId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [plants, searchTerm]);

  const plantInspections = useMemo(() => {
    if (!selectedPlantId) return [];
    return inspections
      .filter(i => i.plantId === selectedPlantId)
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [inspections, selectedPlantId]);

  const selectedPlant = useMemo(() => {
    return plants.find(p => p.plantId === selectedPlantId);
  }, [plants, selectedPlantId]);

  const chartData = useMemo(() => {
    return [...plantInspections]
      .reverse()
      .map(i => {
        const outside = i.powerQualityScore || 0;
        const inside = i.powerQualityScoreInside || 0;
        const avg = i.powerQualityScore !== undefined && i.powerQualityScoreInside !== undefined 
             ? (i.powerQualityScore + i.powerQualityScoreInside) / 2 
             : (i.powerQualityScore || i.powerQualityScoreInside || 0);
             
        return {
          date: new Date(i.timestamp).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' }),
          ohm: i.groundingOhm,
          avg,
          outside,
          inside,
          fullDate: new Date(i.timestamp).toLocaleDateString('th-TH')
        };
      });
  }, [plantInspections]);

  const handleViewReport = (e: React.MouseEvent, item: InspectionData) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!item.uploadedReportUrl) {
        alert('No report uploaded.');
        return;
    }

    const win = window.open('', '_blank');
    if (win) {
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
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-white/5 pb-6">
        <div className="space-y-1">
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 transition-colors text-sm font-bold mb-2"
          >
            <ArrowLeft size={16} /> {t('btn.back')}
          </button>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <HistoryIcon className="text-indigo-500" /> ประวัติการตรวจสอบอุปกรณ์
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">
            ติดตามแนวโน้มสุขภาพของระบบไฟฟ้าและประวัติการบำรุงรักษาเชิงป้องกัน
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar: Plant Selection */}
        <div className="lg:col-span-4 space-y-4">
          <div className="minimal-card p-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text"
                placeholder="ค้นหาโรงไฟฟ้า..."
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="max-h-[500px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
              {filteredPlants.map(plant => (
                <button
                  key={plant.plantId}
                  onClick={() => setSelectedPlantId(plant.plantId)}
                  className={`w-full text-left p-4 rounded-xl border transition-all flex items-center justify-between group ${
                    selectedPlantId === plant.plantId
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-600/20'
                    : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/5 text-slate-700 dark:text-slate-300 hover:border-indigo-300'
                  }`}
                >
                  <div className="min-w-0">
                    <span className="block font-bold text-sm truncate">{plant.name}</span>
                    <span className={`text-[10px] font-mono opacity-60 ${selectedPlantId === plant.plantId ? 'text-white' : ''}`}>
                      {plant.plantId}
                    </span>
                  </div>
                  <ChevronRight size={16} className={selectedPlantId === plant.plantId ? 'text-white' : 'text-slate-400'} />
                </button>
              ))}
              {filteredPlants.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm">
                  ไม่พบข้อมูลโรงไฟฟ้า
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Content: History Details */}
        <div className="lg:col-span-8 space-y-6">
          {!selectedPlantId ? (
            <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400 space-y-4 bg-white dark:bg-white/5 rounded-3xl border border-dashed border-gray-200 dark:border-white/10">
              <div className="p-6 bg-slate-50 dark:bg-white/5 rounded-full">
                <BarChart3 size={48} className="opacity-20" />
              </div>
              <p className="font-bold uppercase tracking-widest text-xs">กรุณาเลือกโรงไฟฟ้าเพื่อดูประวัติ</p>
            </div>
          ) : (
            <>
              {/* Plant Info Summary */}
              <div className="minimal-card p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-indigo-600/10 text-indigo-600 rounded-2xl">
                    <ShieldCheck size={32} />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-slate-900 dark:text-white">{selectedPlant?.name}</h2>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs font-mono text-slate-500">{selectedPlant?.plantId}</span>
                      <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin size={12} /> {selectedPlant?.zone}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="text-center px-4 border-r border-gray-100 dark:border-white/5">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">วงจรที่ขนาน</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white">{selectedPlant?.feeder || '-'}</span>
                  </div>
                  <div className="text-center px-4">
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">ปริมาณขายไฟ (MW)</span>
                    <span className="text-xl font-black text-slate-900 dark:text-white">{selectedPlant?.ppaMW || selectedPlant?.capacityMW} MW</span>
                  </div>
                </div>
              </div>

              {/* Trend Charts */}
              <div className="grid grid-cols-1 gap-6">
                {/* Power Quality Score Trend */}
                <div className="minimal-card p-6">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                    <Activity size={16} className="text-emerald-500" /> Power Quality Score (%)
                  </h3>
                  <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.1)" />
                        <XAxis dataKey="date" fontSize={10} axisLine={false} tickLine={false} />
                        <YAxis fontSize={10} axisLine={false} tickLine={false} domain={[0, 100]} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#1e293b', border: 'none', borderRadius: '12px', color: '#fff' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Legend verticalAlign="top" height={36} iconType="circle" />
                        <ReferenceLine y={80} stroke="#10b981" strokeDasharray="3 3" label={{ position: 'right', value: 'Excellent', fill: '#10b981', fontSize: 10 }} />
                        <ReferenceLine y={50} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'right', value: 'Pass (50%)', fill: '#f59e0b', fontSize: 10 }} />
                        <Line 
                          type="monotone" 
                          name="คะแนนเฉลี่ย"
                          dataKey="avg" 
                          stroke="#6366f1" 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                          activeDot={{ r: 6 }}
                        />
                        <Line 
                          type="monotone" 
                          name="คะแนนประเมินภายนอก"
                          dataKey="outside" 
                          stroke="#10b981" 
                          strokeWidth={2} 
                          strokeDasharray="5 5"
                          dot={{ r: 3, fill: '#10b981' }}
                        />
                        <Line 
                          type="monotone" 
                          name="คะแนนประเมินภายใน"
                          dataKey="inside" 
                          stroke="#ec4899" 
                          strokeWidth={2} 
                          strokeDasharray="5 5"
                          dot={{ r: 3, fill: '#ec4899' }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest px-1">บันทึกการตรวจสอบย้อนหลัง</h3>
                <div className="space-y-3">
                  {plantInspections.map((item) => (
                    <div 
                      key={item.id}
                      className="minimal-card p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-indigo-500/30 transition-all group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${
                          item.status === InspectionStatus.COMPLETED ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
                        }`}>
                          {item.status === InspectionStatus.COMPLETED ? <CheckCircle2 size={20} /> : <Clock size={20} />}
                        </div>
                        <div>
                          <span className="block font-bold text-slate-900 dark:text-white">
                            {new Date(item.timestamp).toLocaleDateString('th-TH', { 
                              day: '2-digit', 
                              month: 'long', 
                              year: 'numeric' 
                            })}
                          </span>
                          <div className="flex items-center gap-3 mt-0.5">
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">PQ Avg : </span>
                                {(() => {
                                    const avgScore = item.powerQualityScore !== undefined && item.powerQualityScoreInside !== undefined 
                                        ? (item.powerQualityScore + item.powerQualityScoreInside) / 2 
                                        : (item.powerQualityScore || item.powerQualityScoreInside || 0);
                                    
                                    return (
                                        <>
                                            <div className="w-36 h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <div 
                                                    className={`h-full ${
                                                        avgScore >= 80 ? 'bg-emerald-500' : 
                                                        avgScore >= 50 ? 'bg-amber-500' : 
                                                        'bg-rose-500'
                                                    }`} 
                                                    style={{ width: `${avgScore}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                                                {avgScore.toFixed(1)}%
                                            </span>
                                        </>
                                    );
                                })()}
                            </div>
                            <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                            <span className="text-[10px] text-slate-900 dark:text-slate-200 font-bold flex items-center gap-1">
                              <Wrench size={10} className="text-indigo-500" />อุปกรณ์ที่ตรวจสอบ : {item.objectName || 'ไม่ระบุอุปกรณ์'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                        {item.uploadedReportUrl && (
                          <button 
                            onClick={(e) => handleViewReport(e, item)}
                            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-all"
                            title="View Report"
                          >
                            <Eye size={18} />
                          </button>
                        )}
                        <button 
                          onClick={() => generateInspectionPDF(item)}
                          className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                          title="Download PDF"
                        >
                          <Download size={18} />
                        </button>
                        <button 
                          onClick={() => onSelectInspection(item.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-white/5 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-bold transition-all"
                        >
                          รายละเอียด <ChevronRight size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
