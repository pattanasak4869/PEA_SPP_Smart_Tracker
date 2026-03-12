
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ToolData } from '../types';
import { 
  Wrench, Search, Plus, Filter, CheckCircle2, AlertCircle, Clock, 
  MapPin, X, Save, Trash2, Edit2, Loader2, Calendar, Hash, 
  ArrowLeft, RefreshCw, ShieldCheck, AlertTriangle, LayoutGrid, List,
  Upload, Image as ImageIcon, Download
} from 'lucide-react';
import { fetchTools, saveTool, deleteTool, subscribeToUpdates, testSheetsConnection } from '../services/sheetsService';
import { useNotifications } from '../contexts/NotificationContext';

const CATEGORY_LABELS: Record<string, string> = {
  'PQ_ANALYZER': 'เครื่องวิเคราะห์คุณภาพไฟฟ้า (PQ)',
  'THERMAL_SCAN': 'กล้องถ่ายภาพความร้อน (Thermal)',
  'GROUND_TESTER': 'เครื่องวัดความต้านทานดิน (Ground)',
  'METER': 'มัลติมิเตอร์/แคลมป์มิเตอร์ (Meter)'
};

const STATUS_LABELS: Record<string, string> = {
  'AVAILABLE': 'พร้อมใช้งาน',
  'IN_USE': 'กำลังใช้งาน',
  'DAMAGED_CHECK': 'รอตรวจสอบชำรุด',
  'REPAIR': 'ส่งซ่อมอุปกรณ์'
};

const DEPARTMENTS = [
  "PQ Team PEA N1", "PQ Team PEA N2", "PQ Team PEA N3",
  "PQ Team PEA NE1", "PQ Team PEA NE2", "PQ Team PEA NE3",
  "PQ Team PEA C1", "PQ Team PEA C2", "PQ Team PEA C3",
  "PQ Team PEA S1", "PQ Team PEA S2", "PQ Team PEA S3"
];

interface ToolsManagerProps {
  toolsData: ToolData[];
  setToolsData: React.Dispatch<React.SetStateAction<ToolData[]>>;
  onBack: () => void;
}

export const ToolsManager: React.FC<ToolsManagerProps> = ({ toolsData, setToolsData, onBack }) => {
  const { addNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTool, setEditingTool] = useState<ToolData | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<ToolData>>({
    name: '',
    serialNumber: '',
    category: 'PQ_ANALYZER',
    status: 'AVAILABLE',
    lastCalibrated: Date.now(),
    assignedTo: '',
    department: DEPARTMENTS[0],
    companyName: '',
    imageUrl: ''
  });

  useEffect(() => {
    // No local loadTools needed as App.tsx handles it
  }, []);

  const loadTools = async (silent = false) => {
    // This is now handled by App.tsx, but keeping the function signature for compatibility if needed
    if (!silent) setIsLoading(true);
    try {
      const data = await fetchTools();
      setToolsData(data);
    } catch (error) {
      addNotification('ALERT', 'โหลดข้อมูลล้มเหลว', 'ไม่สามารถดึงข้อมูลคลังเครื่องมือได้');
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  const processedTools = useMemo(() => {
    const filtered = toolsData.filter(tool => {
      const matchesSearch = tool.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           tool.serialNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (tool.assignedTo && tool.assignedTo.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (tool.department && tool.department.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = filterCategory === 'ALL' || tool.category === filterCategory;
      const matchesStatus = filterStatus === 'ALL' || tool.status === filterStatus;
      return matchesSearch && matchesCategory && matchesStatus;
    });

    // Sort by lastCalibrated descending (most recent first)
    return filtered.sort((a, b) => b.lastCalibrated - a.lastCalibrated);
  }, [toolsData, searchTerm, filterCategory, filterStatus]);

  const handleSave = async () => {
    if (!formData.name || !formData.serialNumber) {
      addNotification('ALERT', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกชื่อและหมายเลขซีเรียลของอุปกรณ์');
      return;
    }

    setIsSubmitting(true);
    const originalTools = [...toolsData];
    try {
      const toolToSave = {
        ...formData,
        id: editingTool ? editingTool.id : `tool_${Date.now()}`,
        lastCalibrated: typeof formData.lastCalibrated === 'string' ? new Date(formData.lastCalibrated).getTime() : formData.lastCalibrated
      } as ToolData;

      // Optimistic update
      setToolsData(prev => {
        const index = prev.findIndex(t => t.id === toolToSave.id);
        if (index >= 0) {
          const next = [...prev];
          next[index] = toolToSave;
          return next;
        }
        return [toolToSave, ...prev];
      });

      const success = await saveTool(toolToSave);
      if (success) {
        addNotification('SUCCESS', editingTool ? 'อัปเดตสำเร็จ' : 'บันทึกสำเร็จ', `อุปกรณ์ ${formData.name} ถูกบันทึกแล้ว`);
        setShowAddModal(false);
        setEditingTool(null);
        setFormData({
          name: '',
          serialNumber: '',
          category: 'PQ_ANALYZER',
          status: 'AVAILABLE',
          lastCalibrated: new Date().toISOString().split('T')[0] as any,
          assignedTo: '',
          department: DEPARTMENTS[0],
          companyName: '',
          imageUrl: ''
        });
      } else {
        setToolsData(originalTools);
        addNotification('ALERT', 'บันทึกล้มเหลว', 'เซิร์ฟเวอร์ไม่สามารถบันทึกข้อมูลลง Google Sheets ได้ โปรดตรวจสอบการตั้งค่า API');
      }
    } catch (error: any) {
      setToolsData(originalTools);
      addNotification('ALERT', 'บันทึกล้มเหลว', error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    setIsSubmitting(true);
    const originalTools = [...toolsData];
    try {
      // Optimistic delete
      setToolsData(prev => prev.filter(t => t.id !== id));
      
      const success = await deleteTool(id);
      if (success) {
        addNotification('SUCCESS', 'ลบสำเร็จ', 'ลบข้อมูลอุปกรณ์ออกจากคลังแล้ว');
        setShowDeleteConfirm(null);
      } else {
        setToolsData(originalTools);
        addNotification('ALERT', 'ลบล้มเหลว', 'ไม่สามารถลบข้อมูลออกจากฐานข้อมูลได้');
      }
    } catch (error) {
      setToolsData(originalTools);
      addNotification('ALERT', 'ลบล้มเหลว', 'ไม่สามารถลบข้อมูลได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Show loading state if needed, but for now just process
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for resizing
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          // Max dimensions
          const MAX_WIDTH = 800;
          const MAX_HEIGHT = 800;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to compressed JPEG Base64
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setFormData(prev => ({ ...prev, imageUrl: compressedBase64 }));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const [isExporting, setIsExporting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    try {
      const result = await testSheetsConnection();
      if (result.success) {
        addNotification('SUCCESS', 'การเชื่อมต่อสมบูรณ์', result.message);
      } else {
        addNotification('ALERT', 'การเชื่อมต่อล้มเหลว', result.message);
      }
    } catch (error) {
      addNotification('ALERT', 'เกิดข้อผิดพลาด', 'ไม่สามารถทดสอบการเชื่อมต่อได้ในขณะนี้');
    } finally {
      setIsTesting(false);
    }
  };

  const handleExportCSV = () => {
    // We use processedTools which already contains the filtered and sorted data
    // including the most recent optimistic updates.
    if (processedTools.length === 0) {
      addNotification('ALERT', 'ไม่มีข้อมูล', 'ไม่มีข้อมูลอุปกรณ์ที่ตรงตามเงื่อนไขเพื่อส่งออก');
      return;
    }

    setIsExporting(true);
    
    // Small delay to show the exporting state
    setTimeout(() => {
      try {
        const headers = [
          'ID',
          'ชื่ออุปกรณ์',
          'หมายเลขซีเรียล',
          'หมวดหมู่',
          'สถานะ',
          'วันที่ผ่านการตรวจสอบ',
          'หน่วยงาน',
          'รหัสพนักงาน',
          'บริษัท',
          'วันที่ส่งออก (Export Date)'
        ];

        const now = new Date();
        const exportTimestamp = now.toLocaleString('th-TH');

        const rows = processedTools.map(tool => [
          tool.id,
          tool.name,
          tool.serialNumber,
          CATEGORY_LABELS[tool.category],
          STATUS_LABELS[tool.status],
          new Date(tool.lastCalibrated).toLocaleDateString('th-TH'),
          tool.department || '-',
          tool.assignedTo || '-',
          tool.companyName || 'PEA',
          exportTimestamp
        ]);

        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        ].join('\n');

        // Add BOM for Thai characters in Excel
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        
        // Create a more precise filename with date and time
        const dateStr = now.toISOString().split('T')[0];
        const timeStr = now.getHours().toString().padStart(2, '0') + 
                       now.getMinutes().toString().padStart(2, '0');
        
        link.setAttribute('href', url);
        link.setAttribute('download', `tools_inventory_${dateStr}_${timeStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        addNotification('SUCCESS', 'Export สำเร็จ', 'ดาวน์โหลดไฟล์ข้อมูลอุปกรณ์ที่เป็นปัจจุบันเรียบร้อยแล้ว');
      } catch (error) {
        addNotification('ALERT', 'Export ล้มเหลว', 'เกิดข้อผิดพลาดในการสร้างไฟล์ CSV');
      } finally {
        setIsExporting(false);
      }
    }, 500);
  };

  const getStatusStyle = (status: string) => {
    switch(status) {
      case 'AVAILABLE': return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20';
      case 'IN_USE': return 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20';
      case 'DAMAGED_CHECK': return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20';
      case 'REPAIR': return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20';
      default: return 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20';
    }
  };

  const isCalibrationExpired = (lastCalibrated: number) => {
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    return (Date.now() - lastCalibrated) > oneYear;
  };

  const isCalibrationUpcoming = (lastCalibrated: number) => {
    const tenMonths = 300 * 24 * 60 * 60 * 1000;
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    const diff = Date.now() - lastCalibrated;
    return diff > tenMonths && diff <= oneYear;
  };

  return (
    <div className="space-y-8 sm:space-y-12 animate-fade-in pb-24 max-w-[1600px] mx-auto py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-3 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl transition-all active:scale-90"
          >
            <ArrowLeft className="w-6 h-6 text-slate-600 dark:text-slate-400" />
          </button>
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">คลังเครื่องมือวัดและวิเคราะห์</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base font-light">บริหารจัดการอุปกรณ์วิเคราะห์คุณภาพไฟฟ้าและติดตามสถานะการตรวจสอบ</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
          <button 
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex-1 md:flex-none bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-slate-700 dark:text-slate-300 font-bold py-4 px-8 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs group disabled:opacity-50"
          >
            {isTesting ? (
              <Loader2 size={18} className="animate-spin text-emerald-600" />
            ) : (
              <RefreshCw size={18} className="group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors" />
            )}
            {isTesting ? 'Testing...' : 'Test Sync'}
          </button>

          <button 
            onClick={handleExportCSV}
            disabled={isExporting}
            className="flex-1 md:flex-none bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 text-slate-700 dark:text-slate-300 font-bold py-4 px-8 rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs group disabled:opacity-50"
          >
            {isExporting ? (
              <Loader2 size={18} className="animate-spin text-indigo-600" />
            ) : (
              <Download size={18} className="group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
            )}
            {isExporting ? 'Exporting...' : 'Export CSV'}
          </button>

          <button 
            onClick={() => {
              setEditingTool(null);
              setFormData({
                name: '',
                serialNumber: '',
                category: 'PQ_ANALYZER',
                status: 'AVAILABLE',
                lastCalibrated: new Date().toISOString().split('T')[0] as any,
                assignedTo: '',
                department: DEPARTMENTS[0],
                companyName: '',
                imageUrl: ''
              });
              setShowAddModal(true);
            }}
            className="flex-1 md:flex-none bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold py-4 px-8 rounded-2xl shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-xs"
          >
            <Plus size={20} /> เพิ่มอุปกรณ์ใหม่
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="minimal-card p-6 mx-4 space-y-6 sticky top-20 z-[80] backdrop-blur-3xl bg-white/90 dark:bg-[#020617]/90 border-white/10">
        <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
          <div className="relative w-full lg:w-[450px]">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือ S/N อุปกรณ์..."
              className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
              <Filter size={14} className="text-slate-500" />
              <select 
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="ALL">ทุกหมวดหมู่</option>
                {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
              <RefreshCw size={14} className="text-slate-500" />
              <select 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="ALL">ทุกสถานะ</option>
                {Object.entries(STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5 p-1 ml-2">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-white/10 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="Grid View"
              >
                <LayoutGrid size={16} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-white/10 text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                title="List View"
              >
                <List size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 text-indigo-500">
          <Loader2 size={48} className="animate-spin mb-4" />
          <p className="text-sm font-black uppercase tracking-[0.2em] animate-pulse">Syncing Inventory...</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
          {processedTools.map(tool => (
            <div 
              key={tool.id} 
              className="minimal-card p-0 group hover:bg-gray-50 dark:hover:bg-white/5 transition-all relative overflow-hidden flex flex-col h-full"
            >
              {tool.imageUrl && (
                <div className="h-48 w-full overflow-hidden relative">
                  <img 
                    src={tool.imageUrl} 
                    alt={tool.name} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              )}
              
              <div className="p-6 sm:p-8 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-6">
                   <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-slate-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-all duration-500">
                      <Wrench size={24} />
                   </div>
                   <div className="flex flex-col items-end gap-2">
                      <span className={`status-badge ${getStatusStyle(tool.status)}`}>
                        {STATUS_LABELS[tool.status]}
                      </span>
                      {isCalibrationExpired(tool.lastCalibrated) ? (
                        <span className="flex items-center gap-1 text-[9px] font-black text-rose-500 uppercase tracking-tighter bg-rose-500/10 px-2 py-0.5 rounded">
                          <AlertTriangle size={10} /> Expired
                        </span>
                      ) : isCalibrationUpcoming(tool.lastCalibrated) ? (
                        <span className="flex items-center gap-1 text-[9px] font-black text-amber-500 uppercase tracking-tighter bg-amber-500/10 px-2 py-0.5 rounded">
                          <Clock size={10} /> Upcoming
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-[9px] font-black text-emerald-500 uppercase tracking-tighter bg-emerald-500/10 px-2 py-0.5 rounded">
                          <ShieldCheck size={10} /> Valid
                        </span>
                      )}
                   </div>
                </div>
                
                <div className="space-y-4 flex-1">
                  <div>
                     <div className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-1">{tool.companyName || 'PEA'}</div>
                     <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors tracking-tight line-clamp-2 min-h-[3.5rem]">{tool.name}</h3>
                     <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-2 font-black tracking-widest uppercase">
                        <Hash size={12} className="shrink-0" /> {tool.serialNumber}
                     </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-white/5">
                     <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">หมวดหมู่</span>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{CATEGORY_LABELS[tool.category]}</span>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">วันที่ผ่านการตรวจสอบ</span>
                        <span className={`text-[10px] font-bold ${isCalibrationExpired(tool.lastCalibrated) ? 'text-rose-500' : 'text-slate-700 dark:text-slate-300'}`}>
                          {new Date(tool.lastCalibrated).toLocaleDateString('th-TH')}
                        </span>
                     </div>
                     <div className="flex items-center justify-between">
                        <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">หน่วยงาน</span>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300">{tool.department || '-'}</span>
                     </div>
                     {tool.assignedTo && (
                       <div className="flex items-center justify-between">
                          <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">รหัสพนักงาน</span>
                          <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">{tool.assignedTo}</span>
                       </div>
                     )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/5 flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                 <button 
                   onClick={() => {
                     setEditingTool(tool);
                     setFormData({
                       ...tool,
                       lastCalibrated: new Date(tool.lastCalibrated).toISOString().split('T')[0] as any
                     });
                     setShowAddModal(true);
                   }}
                   className="p-3 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-gray-100 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-xl transition-all active:scale-90"
                   title="แก้ไข"
                 >
                    <Edit2 size={18} />
                 </button>
                 <button 
                   onClick={() => setShowDeleteConfirm(tool.id)}
                   className="p-3 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-gray-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/20 rounded-xl transition-all active:scale-90"
                   title="ลบ"
                 >
                    <Trash2 size={18} />
                 </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 space-y-4">
          <div className="hidden lg:grid grid-cols-[80px_3fr_2fr_2fr_1.5fr_2fr_1fr_80px] gap-4 px-8 py-4 bg-gray-100 dark:bg-white/5 rounded-2xl text-[10px] font-black text-slate-500 uppercase tracking-widest border border-gray-200 dark:border-white/5">
            <div className="">รูปภาพ</div>
            <div className="">อุปกรณ์ / S/N</div>
            <div className="">บริษัท</div>
            <div className="">หมวดหมู่</div>
            <div className="">สถานะ</div>
            <div className="">หน่วยงาน</div>
            <div className="">รหัสพนักงาน</div>
            <div className="text-right">จัดการ</div>
          </div>
          {processedTools.map(tool => (
            <div 
              key={tool.id} 
              className="minimal-card p-4 sm:p-6 lg:grid lg:grid-cols-[80px_3fr_2fr_2fr_1.5fr_2fr_1fr_80px] gap-4 items-center hover:bg-gray-50 dark:hover:bg-white/5 transition-all group"
            >
              <div className="h-12 w-12 rounded-xl overflow-hidden bg-gray-200 dark:bg-white/5">
                {tool.imageUrl ? (
                  <img src={tool.imageUrl} alt={tool.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400">
                    <Wrench size={16} />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white tracking-tight">{tool.name}</h3>
                  <div className="text-[10px] text-slate-500 font-mono font-black tracking-widest uppercase flex items-center gap-1 mt-0.5">
                    <Hash size={10} /> {tool.serialNumber}
                  </div>
                </div>
              </div>

              <div className="mt-4 lg:mt-0">
                <span className="lg:hidden text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-1">บริษัท</span>
                <span className="text-xs font-bold text-indigo-500">{tool.companyName || 'PEA'}</span>
              </div>
              
              <div className="mt-4 lg:mt-0">
                <span className="lg:hidden text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-1">หมวดหมู่</span>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{CATEGORY_LABELS[tool.category]}</span>
              </div>

              <div className="mt-4 lg:mt-0">
                <span className="lg:hidden text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-1">สถานะ</span>
                <div className="flex flex-col items-start gap-1">
                  <span className={`status-badge ${getStatusStyle(tool.status)}`}>
                    {STATUS_LABELS[tool.status]}
                  </span>
                </div>
              </div>

              <div className="mt-4 lg:mt-0">
                <span className="lg:hidden text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-1">หน่วยงาน</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{tool.department || '-'}</span>
              </div>

              <div className="mt-4 lg:mt-0">
                <span className="lg:hidden text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-1">รหัสพนักงาน</span>
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">{tool.assignedTo || '-'}</span>
              </div>

              <div className="mt-6 lg:mt-0 flex justify-end gap-2">
                <button 
                  onClick={() => {
                    setEditingTool(tool);
                    setFormData({
                      ...tool,
                      lastCalibrated: new Date(tool.lastCalibrated).toISOString().split('T')[0] as any
                    });
                    setShowAddModal(true);
                  }}
                  className="p-2.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-gray-100 dark:bg-white/5 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-xl transition-all active:scale-90"
                  title="แก้ไข"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={() => setShowDeleteConfirm(tool.id)}
                  className="p-2.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-gray-100 dark:bg-white/5 hover:bg-rose-50 dark:hover:bg-rose-500/20 rounded-xl transition-all active:scale-90"
                  title="ลบ"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 dark:bg-[#020617]/95 backdrop-blur-2xl animate-fade-in">
           <div className="w-full max-w-2xl bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-gray-200 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                     <div className="p-4 bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                        {editingTool ? <Edit2 size={28} /> : <Plus size={28} />}
                     </div>
                     <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                          {editingTool ? 'แก้ไขข้อมูลอุปกรณ์' : 'เพิ่มอุปกรณ์ใหม่'}
                        </h2>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">Inventory Management</p>
                     </div>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"><X size={28} /></button>
              </div>

              <div className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                  <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ชื่ออุปกรณ์ (Tool Name)</label>
                      <input 
                        type="text" 
                        className="w-full glass-input rounded-2xl p-4 text-slate-900 dark:text-white focus:outline-none"
                        placeholder="เช่น Fluke 1775 Power Quality Analyzer"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ชื่อบริษัท (Company Name)</label>
                          <input 
                            type="text" 
                            className="w-full glass-input rounded-2xl p-4 text-slate-900 dark:text-white focus:outline-none"
                            placeholder="เช่น PEA, SIEMENS, ABB"
                            value={formData.companyName}
                            onChange={(e) => setFormData({...formData, companyName: e.target.value})}
                          />
                      </div>
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">รูปภาพอุปกรณ์ (Equipment Image)</label>
                          <div className="flex flex-col gap-4">
                            {formData.imageUrl ? (
                              <div className="relative w-full h-48 rounded-2xl overflow-hidden group">
                                <img 
                                  src={formData.imageUrl} 
                                  alt="Preview" 
                                  className="w-full h-full object-cover"
                                  referrerPolicy="no-referrer"
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                                  <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-md transition-all"
                                    title="เปลี่ยนรูปภาพ"
                                  >
                                    <Upload size={20} />
                                  </button>
                                  <button 
                                    onClick={() => setFormData(prev => ({ ...prev, imageUrl: '' }))}
                                    className="p-3 bg-rose-500/20 hover:bg-rose-500/40 rounded-full text-white backdrop-blur-md transition-all"
                                    title="ลบรูปภาพ"
                                  >
                                    <Trash2 size={20} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full h-48 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-indigo-500 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all"
                              >
                                <div className="p-4 bg-gray-100 dark:bg-white/5 rounded-full">
                                  <ImageIcon size={32} />
                                </div>
                                <div className="text-center">
                                  <p className="text-sm font-bold">คลิกเพื่ออัปโหลดรูปภาพ</p>
                                  <p className="text-[10px] uppercase font-black tracking-widest mt-1 opacity-60">PNG, JPG (Max 2MB)</p>
                                </div>
                              </button>
                            )}
                            <input 
                              type="file" 
                              ref={fileInputRef}
                              onChange={handleImageUpload}
                              accept="image/*"
                              className="hidden"
                            />
                            <div className="space-y-2">
                              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">หรือระบุ URL รูปภาพ (Or Image URL)</label>
                              <input 
                                type="text" 
                                className="w-full glass-input rounded-2xl p-4 text-slate-900 dark:text-white focus:outline-none text-xs"
                                placeholder="https://example.com/image.jpg"
                                value={formData.imageUrl}
                                onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                              />
                            </div>
                          </div>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">หมายเลขซีเรียล (Serial Number)</label>
                          <input 
                            type="text" 
                            className="w-full glass-input rounded-2xl p-4 text-slate-900 dark:text-white font-mono focus:outline-none"
                            placeholder="S/N: XXX-XXXX"
                            value={formData.serialNumber}
                            onChange={(e) => setFormData({...formData, serialNumber: e.target.value})}
                          />
                      </div>
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">หมวดหมู่ (Category)</label>
                          <select 
                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none"
                            value={formData.category}
                            onChange={(e) => setFormData({...formData, category: e.target.value as any})}
                          >
                             {Object.entries(CATEGORY_LABELS).map(([val, label]) => (
                               <option key={val} value={val} className="bg-white dark:bg-slate-900">{label}</option>
                             ))}
                          </select>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">สถานะ (Status)</label>
                          <select 
                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none"
                            value={formData.status}
                            onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                          >
                             {Object.entries(STATUS_LABELS).map(([val, label]) => (
                               <option key={val} value={val} className="bg-white dark:bg-slate-900">{label}</option>
                             ))}
                          </select>
                      </div>
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">วันที่ผ่านการตรวจสอบ (Inspection Date)</label>
                          <input 
                            type="date" 
                            className="w-full glass-input rounded-2xl p-4 text-slate-900 dark:text-white outline-none"
                            value={typeof formData.lastCalibrated === 'number' ? new Date(formData.lastCalibrated).toISOString().split('T')[0] : formData.lastCalibrated}
                            onChange={(e) => setFormData({...formData, lastCalibrated: e.target.value as any})}
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">รหัสพนักงานผู้ถือครอง (Employee ID)</label>
                          <input 
                            type="text" 
                            className="w-full glass-input rounded-2xl p-4 text-slate-900 dark:text-white focus:outline-none"
                            placeholder="เช่น 50XXXX"
                            value={formData.assignedTo}
                            onChange={(e) => setFormData({...formData, assignedTo: e.target.value})}
                          />
                      </div>
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">หน่วยงาน (Department)</label>
                          <select 
                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none"
                            value={formData.department}
                            onChange={(e) => setFormData({...formData, department: e.target.value})}
                          >
                             {DEPARTMENTS.map(dept => (
                               <option key={dept} value={dept} className="bg-white dark:bg-slate-900">{dept}</option>
                             ))}
                          </select>
                      </div>
                  </div>
              </div>

              <div className="p-8 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] flex gap-4">
                  <button 
                    onClick={() => setShowAddModal(false)} 
                    className="flex-1 py-5 rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-xs transition-all active:scale-95"
                  >
                    ยกเลิก
                  </button>
                  <button 
                    onClick={handleSave} 
                    disabled={isSubmitting} 
                    className="flex-[2] py-5 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold uppercase tracking-widest text-xs shadow-2xl shadow-indigo-600/20 hover:shadow-indigo-600/40 transition-all active:scale-95 flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    ยืนยันการบันทึกข้อมูล
                  </button>
              </div>
           </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-xl animate-fade-in">
           <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-rose-500/20 shadow-2xl text-center max-w-md w-full animate-scale-in">
              <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Trash2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">ยืนยันการลบอุปกรณ์?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-8">ข้อมูลอุปกรณ์นี้จะถูกลบออกจากคลังอย่างถาวรและไม่สามารถกู้คืนได้</p>
              <div className="flex gap-4">
                 <button 
                   onClick={() => setShowDeleteConfirm(null)} 
                   className="flex-1 py-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl font-bold uppercase tracking-widest text-xs text-slate-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-white/10 transition-all active:scale-95"
                 >
                   ยกเลิก
                 </button>
                 <button 
                   onClick={() => handleDelete(showDeleteConfirm)} 
                   disabled={isSubmitting} 
                   className="flex-1 py-4 bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-rose-600/20 hover:shadow-rose-600/40 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                 >
                   {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : 'ยืนยันการลบ'}
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
