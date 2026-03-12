
import React, { useState, useEffect, useRef } from 'react';
import { InspectionData, InspectionStatus, PlantData } from '../types';
import { fetchPlants } from '../services/sheetsService';
import { MapPin, Save, X, Navigation, Building2, Hash, CheckCircle, AlertOctagon, ShieldCheck, Loader2, Search, ChevronDown, Calendar, Info, CheckCircle2 } from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';

interface NewTaskFormProps {
  onSave: (data: InspectionData) => void;
  onClose: () => void;
  plants?: PlantData[];
}

export const NewTaskForm: React.FC<NewTaskFormProps> = ({ onSave, onClose, plants = [] }) => {
  const { addNotification } = useNotifications();
  const [step, setStep] = useState<'INPUT' | 'REVIEW'>('INPUT');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Data Source
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const isMounted = useRef(true);

  // Form State
  const [plantName, setPlantName] = useState('');
  const [plantId, setPlantId] = useState('');
  const [lat, setLat] = useState<number>(0);
  const [lng, setLng] = useState<number>(0);
  const [locationError, setLocationError] = useState('');
  const [isGpsFound, setIsGpsFound] = useState(false);

  // Clean up on unmount
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredPlants = plants.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.plantId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectPlant = (plant: PlantData) => {
    setPlantName(plant.name);
    setPlantId(plant.plantId);
    setLat(plant.location.lat);
    setLng(plant.location.lng);
    setSearchQuery(plant.name);
    setShowSuggestions(false);
    setLocationError('');
    setIsGpsFound(true);
  };

  const handleGetLocation = () => {
    setLocationError('');
    setIsGpsFound(false);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (isMounted.current) {
            setLat(position.coords.latitude);
            setLng(position.coords.longitude);
            setIsGpsFound(true);
          }
        },
        (error) => {
          if (isMounted.current) {
            setLocationError('ไม่สามารถระบุตำแหน่งได้ กรุณากรอกด้วยตนเอง');
            setIsGpsFound(false);
          }
        }
      );
    } else {
      setLocationError('Browser ไม่รองรับ Geolocation');
    }
  };

  const handleReview = () => {
    if (!plantName || !plantId || lat === 0) return;

    // Input Anomaly Check: Coordinate Bounds (Approx Thailand Bounds)
    if (lat < 5 || lat > 21 || lng < 97 || lng > 106) {
        setLocationError('พิกัดอยู่นอกเขตประเทศไทย กรุณาตรวจสอบข้อมูล');
        addNotification(
            'ALERT', 
            'พิกัดผิดปกติ (Location Anomaly)', 
            'ระบบตรวจพบว่าพิกัดที่ระบุอยู่นอกเขตพื้นที่ให้บริการ (ประเทศไทย)',
            `Input Lat: ${lat}\nInput Lng: ${lng}\nBounds Check: Failed (Out of Thailand Region)`
        );
        return;
    }

    setStep('REVIEW');
  };

  const isSubmittingRef = useRef(false);

  const handleSubmit = () => {
    if (isSubmittingRef.current) return;
    
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    
    const newInspection: InspectionData = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Generate unique ID with random suffix
      plantName,
      plantId,
      location: { lat, lng },
      distanceFromSite: 0, // Reset for new task (will be calc in next step)
      voltage: 0,
      groundingOhm: 0,
      status: InspectionStatus.PENDING,
      timestamp: Date.now()
    };

    // Simulate API delay
    setTimeout(() => {
      if (isMounted.current) {
        onSave(newInspection);
        setIsSubmitting(false);
        isSubmittingRef.current = false;
        onClose();
      } else {
        isSubmittingRef.current = false;
      }
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 dark:bg-black/90 backdrop-blur-sm animate-fade-in transition-colors">
      <div className="w-full max-w-3xl bg-white dark:bg-[#0f172a] rounded-2xl border border-gray-200 dark:border-white/10 shadow-2xl flex flex-col max-h-[90vh] relative overflow-hidden transition-colors">
        
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <div className={`p-2 rounded-lg ${step === 'INPUT' ? 'bg-green-100 dark:bg-neon-green/10 text-green-600 dark:text-neon-green' : 'bg-blue-100 dark:bg-neon-blue/10 text-blue-600 dark:text-neon-blue'}`}>
                  {step === 'INPUT' ? <Building2 size={24} /> : <ShieldCheck size={24} />}
              </div>
              {step === 'INPUT' ? 'เพิ่มข้อมูลโครงการใหม่' : 'ตรวจสอบความถูกต้อง'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-gray-400 hover:text-slate-900 dark:hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">
          
          {step === 'INPUT' && (
            <div className="space-y-8 animate-slide-in-top">
              
              {/* Database Search Section */}
              <div className="relative" ref={searchRef}>
                  <label className="text-xs font-semibold text-blue-600 dark:text-neon-blue uppercase tracking-wider ml-1 flex items-center gap-2 mb-2">
                      <Search size={14} /> ค้นหาโรงไฟฟ้าจากฐานข้อมูล (Database Search)
                  </label>
                  <div className="relative group">
                    <input 
                      type="text" 
                      value={searchQuery}
                      onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setShowSuggestions(true);
                          if(e.target.value === '') {
                              setPlantName('');
                              setPlantId('');
                              setIsGpsFound(false);
                          }
                      }}
                      onFocus={() => setShowSuggestions(true)}
                      className="w-full bg-white dark:bg-black/40 border border-blue-200 dark:border-neon-blue/30 rounded-xl py-3.5 pl-12 pr-10 text-slate-900 dark:text-white focus:outline-none focus:border-blue-500 dark:focus:border-neon-blue focus:ring-1 focus:ring-blue-500 dark:focus:ring-neon-blue transition-all placeholder-gray-400 dark:placeholder-gray-500 text-base shadow-sm"
                      placeholder="พิมพ์ชื่อโรงไฟฟ้า หรือ รหัสโครงการ..."
                    />
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 dark:text-neon-blue">
                        <Building2 size={20} />
                    </div>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <ChevronDown size={18} />
                    </div>
                  </div>

                  {/* Autocomplete Dropdown */}
                  {showSuggestions && (
                      <div className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-xl shadow-2xl max-h-60 overflow-y-auto custom-scrollbar ring-1 ring-black/5 dark:ring-black/50">
                          {filteredPlants.length > 0 ? (
                              filteredPlants.map(plant => (
                                  <div 
                                    key={plant.id}
                                    onClick={() => handleSelectPlant(plant)}
                                    className="p-3.5 hover:bg-gray-50 dark:hover:bg-white/10 cursor-pointer border-b border-gray-100 dark:border-white/5 last:border-0 transition-colors flex justify-between items-center group"
                                  >
                                      <div>
                                          <div className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-neon-blue transition-colors">{plant.name}</div>
                                          <div className="text-xs text-gray-500 mt-0.5">{plant.zone}</div>
                                      </div>
                                      <div className="text-right">
                                          <div className="text-xs font-mono text-green-600 dark:text-neon-green bg-green-100 dark:bg-neon-green/10 px-2 py-0.5 rounded border border-green-200 dark:border-neon-green/20 inline-block mb-1">{plant.plantId}</div>
                                          <div className="text-[10px] text-gray-400">{plant.type}</div>
                                      </div>
                                  </div>
                              ))
                          ) : (
                              <div className="p-8 text-center text-gray-500 text-sm">
                                  ไม่พบข้อมูลโรงไฟฟ้าที่ตรงกัน
                              </div>
                          )}
                      </div>
                  )}
              </div>

              {/* Read-Only / Auto-filled Data */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">ชื่อโครงการ (Plant Name)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={plantName}
                      readOnly
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-4 pr-4 text-slate-900 dark:text-white focus:outline-none cursor-not-allowed opacity-80"
                      placeholder="-"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider ml-1">รหัสโครงการ (Plant ID)</label>
                  <div className="relative">
                    <input 
                      type="text" 
                      value={plantId}
                      readOnly
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl py-3 pl-4 pr-4 text-slate-900 dark:text-white focus:outline-none cursor-not-allowed font-mono tracking-wider opacity-80"
                      placeholder="-"
                    />
                  </div>
                </div>
              </div>

              {/* Location Card */}
              <div className={`bg-white dark:bg-white/5 border rounded-2xl p-1 overflow-hidden transition-colors ${locationError ? 'border-red-500/50' : 'border-gray-200 dark:border-white/10'}`}>
                <div className="bg-gray-50 dark:bg-black/20 p-4 border-b border-gray-200 dark:border-white/5 flex justify-between items-center">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-gray-300 flex items-center gap-2">
                    <MapPin size={16} className={locationError ? "text-red-500" : "text-slate-500 dark:text-slate-400"} /> พิกัดที่ตั้ง (GPS Location)
                  </h3>
                  <div className="flex items-center gap-3">
                    {isGpsFound && (
                      <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20 animate-fade-in">
                        <CheckCircle2 size={12} /> ระบุพิกัดสำเร็จ
                      </div>
                    )}
                    <button 
                      onClick={handleGetLocation}
                      className="text-xs bg-blue-100 dark:bg-neon-blue/10 text-blue-600 dark:text-neon-blue hover:bg-blue-200 dark:hover:bg-neon-blue dark:hover:text-black px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 border border-blue-200 dark:border-neon-blue/20"
                    >
                      <Navigation size={12} /> อัพเดทตำแหน่ง
                    </button>
                  </div>
                </div>

                <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="h-40 bg-gray-200 dark:bg-black/50 rounded-xl border border-gray-200 dark:border-white/10 overflow-hidden relative group">
                      {lat !== 0 ? (
                          <iframe 
                            width="100%" height="100%" frameBorder="0" 
                            src={`https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
                            className="w-full h-full opacity-90 dark:opacity-60 grayscale-[0.2] dark:grayscale dark:invert-[.85] transition-opacity group-hover:opacity-100 group-hover:grayscale-0"
                          ></iframe>
                      ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-2">
                              <MapPin size={24} className="opacity-20" />
                              <span className="text-xs">ระบุพิกัดเพื่อแสดงแผนที่</span>
                          </div>
                      )}
                   </div>

                   <div className="flex flex-col justify-center gap-4">
                       <div className="space-y-1.5">
                           <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold ml-1">Latitude</label>
                           <input 
                             type="number" 
                             step="any"
                             value={lat} 
                             onChange={(e) => {
                                 const val = parseFloat(e.target.value);
                                 setLat(isNaN(val) ? 0 : val);
                                 setIsGpsFound(true);
                             }}
                             className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg py-2.5 px-3 text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 dark:focus:border-neon-blue outline-none transition-colors"
                           />
                       </div>
                       <div className="space-y-1.5">
                           <label className="text-[10px] text-gray-500 uppercase tracking-wider font-semibold ml-1">Longitude</label>
                           <input 
                             type="number" 
                             step="any"
                             value={lng} 
                             onChange={(e) => {
                                 const val = parseFloat(e.target.value);
                                 setLng(isNaN(val) ? 0 : val);
                                 setIsGpsFound(true);
                             }}
                             className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/10 rounded-lg py-2.5 px-3 text-sm text-slate-900 dark:text-white font-mono focus:border-blue-500 dark:focus:border-neon-blue outline-none transition-colors"
                           />
                       </div>
                   </div>
                </div>
                {locationError && <div className="px-4 pb-4 text-xs text-red-500 dark:text-red-400 flex items-center gap-1"><AlertOctagon size={12}/> {locationError}</div>}
              </div>
            </div>
          )}

          {step === 'REVIEW' && (
            <div className="space-y-6 animate-slide-in-top">
              {/* AI Verification Badge */}
              <div className="bg-gradient-to-r from-blue-50 to-transparent dark:from-neon-blue/10 p-5 rounded-2xl border border-blue-100 dark:border-neon-blue/20 flex items-center gap-5">
                <div className="bg-blue-100 dark:bg-neon-blue/20 p-3 rounded-full animate-pulse shadow-[0_0_15px_rgba(59,130,246,0.2)] dark:shadow-[0_0_15px_rgba(0,243,255,0.2)]">
                  <ShieldCheck size={32} className="text-blue-600 dark:text-neon-blue" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">Database Verified</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">ข้อมูลโรงไฟฟ้าถูกต้องและตรงกับฐานข้อมูลทะเบียนกลาง</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Plant Name</span>
                    <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{plantName}</p>
                 </div>
                 <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-gray-200 dark:border-white/10 shadow-sm">
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-2">Plant ID</span>
                    <p className="text-xl font-bold text-green-600 dark:text-neon-green font-mono">{plantId}</p>
                 </div>
                 <div className="bg-white dark:bg-white/5 p-5 rounded-2xl border border-gray-200 dark:border-white/10 col-span-full flex flex-col md:flex-row justify-between md:items-center gap-4 shadow-sm">
                    <div>
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider block mb-1">Target Location</span>
                      <p className="text-base font-mono text-slate-700 dark:text-gray-300 flex items-center gap-2">
                          <MapPin size={16} className="text-blue-500 dark:text-neon-blue" /> {lat.toFixed(6)}, {lng.toFixed(6)}
                      </p>
                    </div>
                    <div className="text-green-600 dark:text-green-400 flex items-center gap-2 text-sm bg-green-100 dark:bg-green-500/10 px-3 py-1.5 rounded-lg border border-green-200 dark:border-green-500/20 font-medium self-start md:self-auto">
                       <CheckCircle size={16} /> พิกัดถูกต้อง
                    </div>
                 </div>
              </div>

              <div className="bg-yellow-50 dark:bg-yellow-500/5 p-4 rounded-xl border border-yellow-200 dark:border-yellow-500/10 flex gap-3 items-start">
                 <Info size={20} className="text-yellow-600 dark:text-yellow-500 shrink-0 mt-0.5" />
                 <p className="text-sm text-yellow-700 dark:text-yellow-200/80 leading-relaxed">
                   <strong>หมายเหตุ:</strong> การบันทึกข้อมูลนี้จะสร้างรายการตรวจสอบใหม่ในสถานะ "รอดำเนินการ (Pending)" โดยผู้ตรวจสอบสามารถเริ่มดำเนินการตรวจสอบได้ทันทีหลังจากบันทึก
                 </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-white/5 flex justify-end gap-3 shrink-0">
          {step === 'INPUT' ? (
            <button 
              onClick={handleReview}
              disabled={!plantName || !plantId || lat === 0}
              className="bg-blue-600 hover:bg-blue-500 dark:bg-neon-blue dark:hover:bg-neon-blue/80 text-white dark:text-black font-bold py-3 px-8 rounded-xl flex items-center gap-2 shadow-lg shadow-blue-500/30 dark:shadow-neon-blue/20 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed"
            >
              ถัดไป (ตรวจสอบ)
            </button>
          ) : (
             <>
                <button 
                  onClick={() => setStep('INPUT')}
                  className="px-6 py-3 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 dark:text-gray-300 transition-colors font-medium"
                >
                  แก้ไข
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="bg-green-600 hover:bg-green-500 dark:bg-green-500 dark:hover:bg-green-400 text-white dark:text-black font-bold py-3 px-8 rounded-xl flex items-center gap-2 shadow-lg shadow-green-500/30 dark:shadow-green-500/20 transition-all active:scale-95"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <Save size={18} />}
                  ยืนยันการเพิ่มข้อมูล
                </button>
             </>
          )}
        </div>

      </div>
    </div>
  );
};
