
import React, { useState, useEffect } from 'react';
import { InspectionData, InspectionStatus, PlantData } from '../types';
import { Search, ArrowLeft, FileText, Loader2, X, Save, Plus, Zap, LayoutGrid, List, Filter, ChevronRight, FileDown, MapPin, Calendar, Activity, Upload, Eye, QrCode, Trash2 } from 'lucide-react';
import QRCodeReact from 'react-qr-code';
import { generateSystemAuditReport } from '../services/geminiService';
import { generateInspectionPDF, combinePDFs } from '../services/pdfService';
import { NewTaskForm } from './NewTaskForm';

interface AllTasksProps {
  inspections: InspectionData[];
  plants?: PlantData[];
  onSelect: (id: string) => void;
  onBack: () => void;
  onAddNew?: (data: InspectionData) => void;
  onUpdate?: (data: InspectionData) => void;
}

export const AllTasks: React.FC<AllTasksProps> = ({ inspections, plants = [], onSelect, onBack, onAddNew, onUpdate }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<InspectionStatus | 'ALL'>('ALL');
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const [plantMetadataMap, setPlantMetadataMap] = useState<Record<string, { status: string; zone: string; province: string }>>({});
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  
  const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);
  const [reportContent, setReportContent] = useState<string | null>(null);
  const [reportInspectionId, setReportInspectionId] = useState<string | null>(null);

  // QR Code State
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [qrFileName, setQrFileName] = useState('');

  useEffect(() => {
    const map: Record<string, { status: string; zone: string; province: string }> = {};
    plants.forEach(p => {
        map[p.plantId] = { status: p.status, zone: p.zone, province: p.province };
    });
    setPlantMetadataMap(map);
  }, [plants]);

  const filteredInspections = inspections.filter(item => {
    const matchesSearch = item.plantName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.plantId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'ALL' || item.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleGenerateReport = (e: React.MouseEvent, item: InspectionData) => {
    e.stopPropagation();
    setGeneratingReportId(item.id);
    generateSystemAuditReport([item]).then(report => {
      setReportContent(report);
      setReportInspectionId(item.id);
      setGeneratingReportId(null);
    });
  };

  const handleUploadReport = (e: React.MouseEvent, item: InspectionData) => {
    e.stopPropagation();
    // Create a hidden file input
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
                     alert(`Upload successful: ${file.name}`);
                 }, 1000);
             };
             reader.readAsDataURL(file);
        }
      }
    };
    fileInput.click();
  };

  const handleViewReport = (e: React.MouseEvent, item: InspectionData) => {
      e.preventDefault();
      e.stopPropagation();
      
      if (!item.uploadedReportUrl) {
          alert('No report uploaded for this inspection.');
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

  const handleGenerateQRCode = async (e: React.MouseEvent, item: InspectionData) => {
    e.stopPropagation();
    setIsGeneratingQR(true);
    setShowQRModal(true);
    setQrFileName(`CombinedReport_${item.plantId}.pdf`);
    setQrCodeUrl(null);

    try {
        // 1. Generate System Report PDF (as Blob)
        const systemPdfBlob = await generateInspectionPDF(item, true) as Blob;

        // 2. Fetch Uploaded Report (if any)
        let finalBlob = systemPdfBlob;
        if (item.uploadedReportUrl) {
            try {
                const response = await fetch(item.uploadedReportUrl);
                if (!response.ok) throw new Error(`Failed to fetch: ${response.statusText}`);
                const uploadedBlob = await response.blob();
                // 3. Combine
                finalBlob = await combinePDFs(systemPdfBlob, uploadedBlob);
            } catch (err) {
                console.warn("Could not load uploaded report (likely expired blob URL). Generating system report only.");
                // Fallback to just system report if fetch fails
            }
        }

        // 4. Create URL
        const url = URL.createObjectURL(finalBlob);
        setQrCodeUrl(url);
    } catch (error) {
        console.error("Error generating combined PDF:", error);
        alert("Failed to generate combined report.");
        setShowQRModal(false);
    } finally {
        setIsGeneratingQR(false);
    }
  };

  const handleDownloadPDF = async (e: React.MouseEvent, item: InspectionData) => {
      e.stopPropagation();
      await generateInspectionPDF(item);
  };

  const handleSaveReportToDb = () => {
    if (!reportInspectionId || !reportContent || !onUpdate) return;
    
    const inspection = inspections.find(i => i.id === reportInspectionId);
    if (inspection) {
        const updatedInspection: InspectionData = {
            ...inspection,
            executiveSummary: reportContent
        };
        onUpdate(updatedInspection);
        setReportContent(null);
        setReportInspectionId(null);
    }
  };

  const getStatusBadgeClasses = (status: InspectionStatus) => {
    switch (status) {
      case InspectionStatus.COMPLETED: return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20';
      case InspectionStatus.PENDING: return 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
      case InspectionStatus.FLAGGED: return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20';
      case InspectionStatus.IN_PROGRESS: return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20';
      default: return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 w-full pb-24 max-w-[1600px] mx-auto px-4 sm:px-6 py-6 font-sans">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <button onClick={onBack} className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors text-sm font-semibold flex items-center gap-2 mb-2">
            <ArrowLeft size={16} /> ย้อนกลับ
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">งานตรวจสอบทั้งหมด</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">บริหารจัดการคำร้องตรวจสอบและประวัติการ Audit ในระบบ</p>
        </div>

        <div className="flex flex-col sm:flex-row w-full md:w-auto gap-3">
          <button 
            onClick={() => setShowNewTaskModal(true)}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 px-6 rounded-lg shadow-sm transition-all active:scale-95 flex items-center justify-center gap-2 text-sm"
          >
            <Plus size={18} />
            เพิ่มคำร้องตรวจสอบ
          </button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between sticky top-4 z-30">
        <div className="relative w-full lg:w-[400px]">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
            <Search size={18} />
          </div>
          <input
            type="text"
            placeholder="ค้นหาชื่อโรงไฟฟ้า หรือ รหัสโครงการ..."
            className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex w-full lg:w-auto gap-3 overflow-x-auto pb-2 lg:pb-0 no-scrollbar items-center">
          <div className="flex items-center gap-2 mr-2 text-slate-500 text-xs font-semibold uppercase tracking-wider shrink-0">
            <Filter size={14} /> Filter
          </div>
          
          <div className="flex gap-2">
            {['ALL', InspectionStatus.PENDING, InspectionStatus.IN_PROGRESS, InspectionStatus.COMPLETED, InspectionStatus.FLAGGED].map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  filterStatus === status 
                  ? 'bg-indigo-50 border-indigo-200 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {status === 'ALL' ? 'ทั้งหมด' : status.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 mx-2 hidden sm:block"></div>

          <div className="hidden sm:flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shrink-0">
             <button 
               onClick={() => setViewMode('GRID')}
               className={`p-1.5 rounded-md transition-all ${viewMode === 'GRID' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
             >
               <LayoutGrid size={16} />
             </button>
             <button 
               onClick={() => setViewMode('LIST')}
               className={`p-1.5 rounded-md transition-all ${viewMode === 'LIST' ? 'bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
             >
               <List size={16} />
             </button>
          </div>
        </div>
      </div>

      {/* Grid View */}
      {viewMode === 'GRID' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredInspections.map((item) => (
            <div
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`
                  bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all p-5 flex flex-col h-full group cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700
                  ${item.status === InspectionStatus.COMPLETED ? 'opacity-90' : ''}
              `}
            >
              <div className="flex justify-between items-start mb-4">
                 <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeClasses(item.status)}`}>
                    {item.status.replace('_', ' ')}
                 </span>
                 {item.status === InspectionStatus.COMPLETED && (
                     <div className="flex gap-1">
                       {item.uploadedReportUrl && (
                           <button 
                             onClick={(e) => handleViewReport(e, item)}
                             className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors"
                             title="View Uploaded Report"
                           >
                             <Eye size={16} />
                           </button>
                       )}
                       <button 
                         onClick={(e) => handleUploadReport(e, item)}
                         className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
                         title="Upload Report (PDF)"
                       >
                         <Upload size={16} />
                       </button>
                       <button 
                         onClick={(e) => handleGenerateQRCode(e, item)}
                         className="p-1.5 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors"
                         title="Scan QR to Download Combined Report"
                       >
                         <QrCode size={16} />
                       </button>
                       <button 
                         onClick={(e) => handleDownloadPDF(e, item)}
                         className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                         title="Download PDF"
                       >
                         <FileDown size={16} />
                       </button>
                     </div>
                 )}
              </div>

              <div className="flex-1 space-y-4">
                <div>
                    <h3 className="font-bold text-base text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.plantName}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{item.plantId}</p>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <MapPin size={14} className="text-slate-400" />
                        <span className="truncate">{plantMetadataMap[item.plantId]?.zone || 'Unknown Zone'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                        <Calendar size={14} className="text-slate-400" />
                        <span>{new Date(item.timestamp).toLocaleDateString('th-TH')}</span>
                    </div>
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                 <div className="flex gap-4">
                    <div className="w-full">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">อุปกรณ์ที่ตรวจสอบ</span>
                      <span className="text-sm font-medium text-slate-900 dark:text-white truncate block" title={item.objectName}>{item.objectName || '-'}</span>
                    </div>
                 </div>
                 <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* List View */}
      {viewMode === 'LIST' && (
        <div className="flex flex-col gap-3">
          {filteredInspections.map((item) => (
            <div 
              key={item.id}
              onClick={() => onSelect(item.id)}
              className={`
                bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 group hover:shadow-md transition-all cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700
                ${item.status === InspectionStatus.COMPLETED ? 'opacity-90' : ''}
              `}
            >
               <div className="flex items-center gap-4 flex-1 w-full sm:w-auto">
                  <div className={`p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors shrink-0 ${item.status === InspectionStatus.COMPLETED ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : ''}`}>
                      <Activity size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <h3 className="font-bold text-sm text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.plantName}</h3>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusBadgeClasses(item.status)}`}>{item.status.replace('_', ' ')}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                          <span className="font-mono text-slate-400">{item.plantId}</span>
                          <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="hidden sm:inline flex items-center gap-1"><Calendar size={12}/> {new Date(item.timestamp).toLocaleDateString('th-TH')}</span>
                          <span className="hidden sm:inline w-1 h-1 rounded-full bg-slate-300"></span>
                          <span className="hidden sm:inline flex items-center gap-1"><MapPin size={12}/> {plantMetadataMap[item.plantId]?.zone || 'N/A'}</span>
                      </div>
                  </div>
               </div>

               <div className="flex items-center justify-between w-full sm:w-auto gap-6 sm:pl-6 border-t sm:border-t-0 sm:border-l border-slate-100 dark:border-slate-800 pt-3 sm:pt-0 mt-2 sm:mt-0">
                   <div className="text-right min-w-[120px]">
                       <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-0.5">Object Name</span>
                       <span className="font-bold text-sm text-slate-700 dark:text-slate-300 truncate block max-w-[150px] ml-auto" title={item.objectName}>
                          {item.objectName || '-'}
                       </span>
                   </div>
                   
                   {item.status === InspectionStatus.COMPLETED ? (
                        <div className="flex gap-2">
                           {item.uploadedReportUrl && (
                               <button 
                                  onClick={(e) => handleViewReport(e, item)}
                                  className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors border border-slate-200 dark:border-slate-700"
                                  title="View Uploaded Report"
                               >
                                  <Eye size={16} />
                               </button>
                           )}
                           <button 
                              onClick={(e) => handleUploadReport(e, item)}
                              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors border border-slate-200 dark:border-slate-700"
                              title="Upload Report (PDF)"
                           >
                              <Upload size={16} />
                           </button>
                           <button 
                              onClick={(e) => handleGenerateQRCode(e, item)}
                              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-500/10 transition-colors border border-slate-200 dark:border-slate-700"
                              title="Scan QR to Download Combined Report"
                           >
                              <QrCode size={16} />
                           </button>
                           <button 
                              onClick={(e) => handleDownloadPDF(e, item)}
                              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors border border-slate-200 dark:border-slate-700"
                              title="Download PDF"
                           >
                              <FileDown size={16} />
                           </button>
                        </div>
                   ) : (
                        <div className="p-2 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all">
                           <ChevronRight size={20} />
                        </div>
                   )}
               </div>
            </div>
          ))}
        </div>
      )}

       {/* Report Modal */}
       {reportContent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden animate-scale-in">
            <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400 rounded-lg">
                    <FileText size={20} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">AI Audit Report</h2>
                </div>
                <button onClick={() => setReportContent(null)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <X size={20} />
                </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
                <div className="prose prose-sm prose-slate dark:prose-invert max-w-none">
                  {reportContent.split('\n').map((line, i) => (
                    <p key={i} className="mb-4 leading-relaxed">{line}</p>
                  ))}
                </div>
            </div>

            <div className="p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
               <button 
                  onClick={handleSaveReportToDb} 
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl text-sm font-semibold text-white shadow-sm transition-all flex items-center justify-center gap-2"
               >
                  <Save size={18} /> บันทึกรายงาน (Save to Database)
               </button>
            </div>
          </div>
        </div>
      )}

        {/* QR Code Modal */}
        {showQRModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in">
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
                    
                    <p className="text-[10px] text-slate-400 mt-4 text-center max-w-[200px]">
                        Note: This QR code links to a generated file.
                    </p>
                </div>
            </div>
        )}

      {showNewTaskModal && onAddNew && (
        <NewTaskForm 
          onSave={(data) => onAddNew(data)}
          onClose={() => setShowNewTaskModal(false)}
          plants={plants}
        />
      )}
    </div>
  );
};
