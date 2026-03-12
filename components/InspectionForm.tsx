
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { InspectionData, InspectionStatus, PowerQualityData, PlantData } from '../types';
import { generateExecutiveSummary, analyzeInspectionImage } from '../services/geminiService';
import { generateInspectionPDF } from '../services/pdfService';
import { fetchPlants, getInspectionDetails } from '../services/sheetsService';
import { SignaturePad } from './SignaturePad';
import { 
  Camera, Activity, Loader2, AlertTriangle, MapPin, Zap, ChevronRight, 
  FileText, X, Sliders, Sparkles, Navigation, CheckCircle2, RefreshCw, 
  AlertCircle, Factory, Building2, Wind, Droplets, Leaf, Flame, ShieldAlert,
  ExternalLink, Lock, Unlock, Map, Signal, Clock, Target, Smartphone, Save, FileDown,
  User, Phone, Upload, Trash2
} from 'lucide-react';
import { useNotifications } from '../contexts/NotificationContext';
import { useSettings } from '../contexts/SettingsContext';

interface InspectionFormProps {
  data: InspectionData;
  onSave: (data: InspectionData) => void;
  onBack: () => void;
  currentUser?: any;
}

// --- STRICT SECURITY CONFIGURATION (METERS) ---
const ZONE_A_RADIUS = 50;   // Verified Zone: < 50m (Strict)
const ZONE_B_RADIUS = 100;  // Warning Zone: < 100m (Operation Allowed)
// Zone C: > 100m (System Locked)

// --- Advanced Road Logic ---
// 1. Distance: Uses Dynamic Road Factor to mimic Google Maps (Highway vs Urban)
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

// 2. ETA: Calculates driving time based on 90-120 km/h constraint
const calculateCarETA = (distanceMeters: number): string => {
    if (distanceMeters < 100) return 'Arriving';
    
    // Logic:
    // If distance > 5km -> Assume Highway Driving @ ~100 km/h (27.7 m/s) (Avg of 90-120)
    // If distance <= 5km -> Assume Local Driving @ ~40 km/h (11.1 m/s)
    const speedMps = distanceMeters > 5000 ? 27.7 : 11.1; 
    
    const totalSeconds = distanceMeters / speedMps;
    const minutes = Math.round(totalSeconds / 60);
    
    if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return `~${hours} hr ${mins} min`;
    }
    return `~${minutes} min drive`;
};

type GeoStatus = 'SEARCHING' | 'VERIFIED' | 'WARNING' | 'LOCKED';

export const InspectionForm: React.FC<InspectionFormProps> = ({ data, onSave, onBack, currentUser }) => {
  const { addNotification } = useNotifications();
  const { settings } = useSettings();
  const [formData, setFormData] = useState<InspectionData>(data);
  const [plantDetails, setPlantDetails] = useState<PlantData | null>(null);
  const [isLoadingPlant, setIsLoadingPlant] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [isHydrating, setIsHydrating] = useState(true);
  
  // Camera Refs
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [activeCameraField, setActiveCameraField] = useState<'imageEvidence' | 'imageEvidenceInside'>('imageEvidence');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // GPS & Geofencing State
  const [currentLoc, setCurrentLoc] = useState<{lat: number, lng: number} | null>(null);
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('SEARCHING');
  const [gpsAccuracy, setGpsAccuracy] = useState<number>(0);
  const [eta, setEta] = useState<string>('');
  const [minutesToArrival, setMinutesToArrival] = useState<number>(0);
  const [bypassLock, setBypassLock] = useState(false);
  const [bypassExpiry, setBypassExpiry] = useState<number | null>(null);
  
  const isReadOnly = data.status === InspectionStatus.COMPLETED;
  
  // Logic Refs
  const lastUpdateRef = useRef<number>(0);
  const alertedOhmRef = useRef<boolean>(false);
  const alertedVoltRef = useRef<boolean>(false);

  // --- 0. Hydrate Large Data (Lazy Loading) & Restore Draft ---
  useEffect(() => {
      const hydrate = async () => {
          setIsHydrating(true);
          
          // 1. Try to restore from Draft first (most recent work)
          const draft = localStorage.getItem(`draft_inspection_${data.id}`);
          if (draft) {
              try {
                  const parsedDraft = JSON.parse(draft);
                  setFormData(parsedDraft);
                  addNotification('INFO', 'Draft Restored', 'กู้คืนข้อมูลร่างล่าสุดสำเร็จ');
              } catch (e) {
                  console.error("Failed to parse draft", e);
              }
          } else {
              // 2. If no draft, load from server/cache
              const fullData = await getInspectionDetails(data.id);
              if (fullData) {
                  setFormData(prev => ({ 
                      ...prev, 
                      ...fullData,
                      inspectorName: fullData.inspectorName || currentUser?.name || prev.inspectorName
                  }));
              } else if (currentUser?.name && !data.inspectorName) {
                  setFormData(prev => ({ ...prev, inspectorName: currentUser.name }));
              }
          }
          
          setIsHydrating(false);
      };
      hydrate();
  }, [data.id, addNotification, currentUser]);

  // --- 0.1 Auto-save Draft ---
  useEffect(() => {
      if (isHydrating || isReadOnly) return;
      
      const timer = setTimeout(() => {
          localStorage.setItem(`draft_inspection_${data.id}`, JSON.stringify(formData));
      }, 1000); // Debounce 1s
      
      return () => clearTimeout(timer);
  }, [formData, data.id, isHydrating, isReadOnly]);

  useEffect(() => {
    if (bypassLock && bypassExpiry) {
      const timer = setInterval(() => {
        const now = Date.now();
        if (now >= bypassExpiry) {
          setBypassLock(false);
          setBypassExpiry(null);
          addNotification('ALERT', 'Bypass Expired', 'หมดเวลาปลดล็อคชั่วคราว ระบบกลับสู่สถานะล็อค');
        }
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [bypassLock, bypassExpiry, addNotification]);

  const handleBypass = () => {
    setBypassLock(true);
    setBypassExpiry(Date.now() + 30 * 60 * 1000); // 30 minutes
    addNotification('SUCCESS', 'Bypass Active', 'ระบบถูกปลดล็อคชั่วคราวเป็นเวลา 30 นาที');
  };

  // --- 1. Camera Handling ---
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
    }
    setIsCameraOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // --- 2. Load Plant Data & Sync Location ---
  useEffect(() => {
    const loadPlantInfo = async () => {
      setIsLoadingPlant(true);
      try {
        const plants = await fetchPlants();
        const found = plants.find(p => p.plantId === data.plantId);
        if (found) {
            setPlantDetails(found);
            // CRITICAL: Force sync Target Location with Database for accuracy
            setFormData(prev => ({
                ...prev,
                location: found.location
            }));
        }
      } catch (err) {
        console.error("Failed to load plant details", err);
      } finally {
        setIsLoadingPlant(false);
      }
    };
    loadPlantInfo();
  }, [data.plantId]);

  // --- 3. Electrical Anomaly Detection ---
  useEffect(() => {
    // Voltage Check
    const v = formData.voltage;
    if (v <= 0) return;

    // Determine Standard based on Plant Voltage Level
    const level = plantDetails?.voltageLevel || 0.22; // Default to 220V (0.22kV)
    
    let min = 0;
    let max = 0;
    let standardLabel = '';
    let action = 'Check Tap Changer / Regulator';

    if (level === 22) {
        min = 20.9;
        max = 23.1;
        standardLabel = '22kV ±5% (20.9 - 23.1 kV)';
    } else if (level === 33) {
        min = 31.35;
        max = 34.65;
        standardLabel = '33kV ±5% (31.35 - 34.65 kV)';
    } else if (level === 115) {
        min = 109.25;
        max = 126.5;
        standardLabel = '115kV +10% / -5% (109.25 - 126.5 kV)';
    } else if (level === 0.22 || level < 1) {
        // Low Voltage 220V/400V
        min = 0.198;
        max = 0.242;
        standardLabel = '220V ±10% (198 - 242 V)';
    } else {
        // Generic ±10% for other levels
        min = level * 0.9;
        max = level * 1.1;
        standardLabel = `${level}kV ±10%`;
    }

    const isOutOfRange = v < min || v > max;

    if (isOutOfRange) {
        if (!alertedVoltRef.current) {
             addNotification(
                'ALERT',
                'แรงดันไฟฟ้าผิดปกติ (Voltage Instability)',
                `ตรวจพบแรงดันไฟฟ้านอกเกณฑ์มาตรฐาน (${v} kV)`,
                `Measured Value: ${v} kV\nStandard: ${standardLabel}\nAction: ${action}`
            );
            alertedVoltRef.current = true;
        }
    } else {
        alertedVoltRef.current = false;
    }

    // PQ Data Checks
    const pq = formData.pqData;
    if (pq) {
        if (pq.thd_v && pq.thd_v > 5) {
            addNotification('ALERT', 'Harmonics Alert (THD-V)', `Voltage Harmonics สูงเกินเกณฑ์มาตรฐาน (${pq.thd_v}%)`, 'Standard: < 5%\nAction: Check Harmonic Filter');
        }
        if (pq.powerFactor && pq.powerFactor < 0.85) {
            addNotification('ALERT', 'Power Factor Alert', `ค่า Power Factor ต่ำกว่าเกณฑ์มาตรฐาน (${pq.powerFactor})`, 'Standard: > 0.85\nAction: Check Capacitor Bank');
        }
    }
  }, [formData.voltage, formData.pqData, plantDetails, addNotification]);

  // --- 4. Supercharged GPS Logic (ACTIVE SECURITY) ---
  const prevGeoStatusRef = useRef<GeoStatus>('SEARCHING');

  useEffect(() => {
    // Only trigger notification if status HAS CHANGED from the previous render
    if (geoStatus !== prevGeoStatusRef.current) {
        // If status is LOCKED, we check if it was due to signal loss (handled in watchPosition)
        // or just distance. To avoid "double" notifications, we can check a ref.
        if (geoStatus === 'VERIFIED') {
            addNotification('SUCCESS', 'GPS Verified', `ยืนยันพิกัดสำเร็จ: เข้าสู่พื้นที่โครงการ (<${ZONE_A_RADIUS}m)`);
        } else if (geoStatus === 'WARNING') {
            addNotification('ALERT', 'GPS Warning', `คุณอยู่นอกระยะ ${ZONE_A_RADIUS}m (Zone B - Authorized)`);
        } else if (geoStatus === 'LOCKED' && !bypassLock && !gpsErrorRef.current) {
            addNotification('ALERT', 'System Locked', `ระบบถูกล็อค: อยู่นอกพื้นที่ปฏิบัติงานเกินกำหนด (>${ZONE_B_RADIUS}m)`);
        }
        // Update the ref to the current status
        prevGeoStatusRef.current = geoStatus;
    }
  }, [geoStatus, addNotification, bypassLock]);

  const gpsErrorRef = useRef(false);

  useEffect(() => {
    const targetLat = formData.location?.lat;
    const targetLng = formData.location?.lng;

    if (targetLat === undefined || targetLng === undefined) {
       console.warn("Missing target coordinates in formData");
       return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        gpsErrorRef.current = false; // Reset error flag on success
        const now = Date.now();
        // Update UI every 2 seconds max to save battery
        if (now - lastUpdateRef.current < 2000) return;
        lastUpdateRef.current = now;

        const newLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const accuracy = pos.coords.accuracy;
        setGpsAccuracy(accuracy);

        // Calculate "Road Distance" & "ETA"
        const dist = calculateRoadDistance(targetLat, targetLng, newLoc.lat, newLoc.lng);
        const timeEst = calculateCarETA(dist);
        
        // Calculate minutes to arrival for Bypass logic
        const speedMps = dist > 5000 ? 27.7 : 11.1; 
        const totalSeconds = dist / speedMps;
        const mins = Math.round(totalSeconds / 60);
        setMinutesToArrival(mins);
        
        setCurrentLoc(newLoc);
        setFormData(prev => ({ ...prev, distanceFromSite: dist }));
        setEta(timeEst);

        // SYSTEM LOCKED MODE: Enforce distance constraints
        // Logic Updated: Strict Meter-based thresholds
        let newStatus: GeoStatus = 'LOCKED';
        if (dist <= ZONE_A_RADIUS) {
            newStatus = 'VERIFIED';
        } else if (dist <= ZONE_B_RADIUS) {
            newStatus = 'WARNING';
        }

        setGeoStatus(prev => {
            if (prev !== newStatus) {
                return newStatus;
            }
            return prev;
        });
      },
      (err) => { 
          console.error("GPS Error:", err); 
          gpsErrorRef.current = true;
          setGeoStatus('LOCKED'); // Strict Security: Lock if GPS fails
          addNotification('ALERT', 'GPS Signal Lost', 'ไม่สามารถระบุพิกัดได้ ระบบถูกล็อคเพื่อความปลอดภัย');
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 5000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [formData.location?.lat, formData.location?.lng, addNotification]); 

  // --- Handlers ---
  const handleOpenGoogleMaps = () => {
      const lat = formData.location?.lat;
      const lng = formData.location?.lng;
      
      if (lat && lng) {
          const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
          window.open(url, '_blank');
      } else {
          addNotification('ALERT', 'Navigation Error', 'ไม่พบข้อมูลพิกัด (Missing GPS Coordinates)');
      }
  };

  const handleInputChange = (field: keyof InspectionData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, field: 'imageEvidence' | 'imageEvidenceInside') => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const img = new Image();
      img.onload = async () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;

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

        const quality = settings.dataSaver ? 0.5 : 0.7;
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        
        handleInputChange(field, compressedBase64);
        
        try {
          const base64Image = compressedBase64.split(',')[1];
          const result = await analyzeInspectionImage(base64Image, plantDetails?.voltageLevel);
          
          if (field === 'imageEvidence') {
              setFormData(prev => ({ 
                  ...prev, 
                  aiAnalysis: result.analysis, 
                  powerQualityScore: result.powerQualityScore 
              }));
              if (result.powerQualityScore < 50) {
                  addNotification('ALERT', 'Low Power Quality Score (Outside)', `Score: ${result.powerQualityScore}/100`);
              }
          } else {
              setFormData(prev => ({ 
                  ...prev, 
                  aiAnalysisInside: result.analysis, 
                  powerQualityScoreInside: result.powerQualityScore 
              }));
              if (result.powerQualityScore < 50) {
                  addNotification('ALERT', 'Low Power Quality Score (Inside)', `Score: ${result.powerQualityScore}/100`);
              }
          }
        } catch (err) { 
          addNotification('ALERT', 'AI Error', 'วิเคราะห์ภาพล้มเหลว'); 
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const startCamera = async (field: 'imageEvidence' | 'imageEvidenceInside' = 'imageEvidence') => {
    setActiveCameraField(field);
    try {
      setIsCameraOpen(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch (err) {
      addNotification('ALERT', 'Camera Error', 'ไม่สามารถเข้าถึงกล้องได้');
      setIsCameraOpen(false);
    }
  };

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setIsCapturing(true);
    const context = canvasRef.current.getContext('2d');
    if (context) {
      canvasRef.current.width = videoRef.current.videoWidth;
      canvasRef.current.height = videoRef.current.videoHeight;
      context.drawImage(videoRef.current, 0, 0);
      
      const quality = settings.dataSaver ? 0.5 : 0.85; 
      const base64Data = canvasRef.current.toDataURL('image/jpeg', quality);
      const base64Image = base64Data.split(',')[1];
      
      handleInputChange(activeCameraField, base64Data);
      stopCamera();

      try {
        const result = await analyzeInspectionImage(base64Image, plantDetails?.voltageLevel);
        
        if (activeCameraField === 'imageEvidence') {
            setFormData(prev => ({ 
                ...prev, 
                aiAnalysis: result.analysis, 
                powerQualityScore: result.powerQualityScore 
            }));
            if (result.powerQualityScore < 50) {
                addNotification('ALERT', 'Low Power Quality Score (Outside)', `Score: ${result.powerQualityScore}/100`);
            }
        } else {
            setFormData(prev => ({ 
                ...prev, 
                aiAnalysisInside: result.analysis, 
                powerQualityScoreInside: result.powerQualityScore 
            }));
            if (result.powerQualityScore < 50) {
                addNotification('ALERT', 'Low Power Quality Score (Inside)', `Score: ${result.powerQualityScore}/100`);
            }
        }
      } catch (err) { 
        addNotification('ALERT', 'AI Error', 'วิเคราะห์ภาพล้มเหลว'); 
      }
    }
    setIsCapturing(false);
  };

  const handleAIAnalysis = async () => {
      if (isProcessingAI) return;
      setIsProcessingAI(true);
      try {
        const aiResult = await generateExecutiveSummary(formData);
        setFormData(prev => ({
            ...prev,
            executiveSummary: aiResult.summary,
            faultRootCause: aiResult.faultAnalysis,
            improvementPlan: aiResult.recommendation,
            status: InspectionStatus.COMPLETED,
            timestamp: Date.now()
        }));
        setShowSummary(true);
      } catch (e) { 
          addNotification('ALERT', 'Report Error', 'ไม่สามารถสร้างรายงานได้'); 
      } finally { 
          setIsProcessingAI(false); 
      }
  }

  const [isSaving, setIsSaving] = useState(false);

  const handleDirectSave = async () => {
      if (isSaving) return;
      if (!formData.inspectorSignature) {
          addNotification('ALERT', 'Signature Required', 'กรุณาลงลายเซ็นผู้ตรวจสอบก่อนบันทึก');
          return;
      }
      
      setIsSaving(true);
      try {
          // Clear draft on successful save
          localStorage.removeItem(`draft_inspection_${data.id}`);
          
          await onSave({
              ...formData,
              status: InspectionStatus.COMPLETED,
              timestamp: Date.now()
          });
      } finally {
          setIsSaving(false);
      }
  };

  const handleDownloadPDF = async () => {
      await generateInspectionPDF(formData);
  };

  const getPlantIcon = (type?: string) => {
    switch(type) {
      case 'SOLAR': return <Zap className="text-yellow-500" size={24} />;
      case 'WIND': return <Wind className="text-cyan-500" size={24} />;
      case 'HYDRO': return <Droplets className="text-blue-500" size={24} />;
      case 'BIOMASS': return <Leaf className="text-green-500" size={24} />;
      case 'THERMAL': return <Flame className="text-rose-500" size={24} />;
      default: return <Factory className="text-slate-400" size={24} />;
    }
  };

  const handleFinalSave = () => {
      localStorage.removeItem(`draft_inspection_${data.id}`);
      onSave(formData);
  };

  // --- View: Executive Summary ---
  if (showSummary) {
      return (
          <div className="max-w-4xl mx-auto py-6 sm:py-10 space-y-8 animate-slide-up">
              <div className="text-center space-y-4">
                <div className="inline-flex px-4 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-black uppercase tracking-widest border border-emerald-500/20">Analysis Completed</div>
                <h2 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">รายงานวิเคราะห์อัจฉริยะ</h2>
              </div>
              
              <div className="space-y-6">
                  <div className="minimal-card p-6 sm:p-10 bg-indigo-500/[0.03]">
                      <h3 className="text-xs font-black text-indigo-400 mb-6 uppercase tracking-widest flex items-center gap-3">
                        <Sparkles size={18} /> Executive Summary
                      </h3>
                      <div className="ai-content text-slate-700 dark:text-slate-200 text-base sm:text-xl leading-relaxed font-light">
                          {formData.executiveSummary?.split('\n').map((l, i) => <p key={i}>{l}</p>)}
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="minimal-card p-6 sm:p-8 bg-amber-500/[0.02] border-amber-500/10">
                          <h3 className="text-[10px] font-black text-amber-500 mb-6 uppercase tracking-widest flex items-center gap-3">
                             <AlertTriangle size={18} /> Fault Analysis
                          </h3>
                          <div className="ai-content text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed font-light">
                             {formData.faultRootCause?.split('\n').map((l, i) => <p key={i}>{l}</p>)}
                          </div>
                      </div>
                      <div className="minimal-card p-6 sm:p-8 bg-emerald-500/[0.02] border-emerald-500/10">
                          <h3 className="text-[10px] font-black text-emerald-500 mb-6 uppercase tracking-widest flex items-center gap-3">
                             <CheckCircle2 size={18} /> Recommendation
                          </h3>
                          <div className="ai-content text-slate-600 dark:text-slate-400 text-sm sm:text-base leading-relaxed font-light">
                             {formData.improvementPlan?.split('\n').map((l, i) => <p key={i}>{l}</p>)}
                          </div>
                      </div>
                  </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-4 pt-8">
                  <button onClick={() => setShowSummary(false)} className="px-8 py-4 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-2xl text-xs font-bold uppercase tracking-widest text-slate-600 dark:text-slate-400 transition-all">แก้ไขข้อมูล</button>
                  <button onClick={handleDownloadPDF} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-2xl shadow-emerald-600/30 transition-all flex items-center justify-center gap-3">
                      <FileDown size={18} /> Download PDF
                  </button>
                  <button onClick={handleFinalSave} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs font-bold uppercase tracking-widest shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3">
                      <FileText size={18} /> บันทึกและส่งรายงาน
                  </button>
              </div>
          </div>
      );
  }

  // --- Main Render ---
  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
       {/* 1. Header with Advanced GPS Monitor */}
       <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] border border-gray-200 dark:border-white/10 shadow-xl sticky top-20 z-40 backdrop-blur-xl">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
               <div className="flex items-center gap-4">
                  <button onClick={onBack} className="p-3 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-slate-500 dark:text-slate-400 transition-colors">
                     <X size={20} />
                  </button>
                  <div>
                     <h2 className="text-xl font-bold text-slate-900 dark:text-white leading-none flex items-center gap-2">
                        {data.plantName}
                        {geoStatus === 'VERIFIED' && <CheckCircle2 size={20} className="text-emerald-500" />}
                     </h2>
                     <p className="text-[11px] text-slate-500 font-mono mt-1.5 font-bold tracking-widest uppercase flex items-center gap-2">
                        {getPlantIcon(plantDetails?.type)} ID: {data.plantId}
                     </p>
                  </div>
               </div>

               {/* Smart Geofencing Status Bar */}
               <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                   
                   {/* GPS Info: Comparative Coordinates */}
                   {currentLoc && (
                     <div className="hidden xl:flex gap-6 mr-4 pr-4 border-r border-gray-200 dark:border-white/10">
                        <div className="flex flex-col justify-center items-end">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Target size={10} /> Target Site
                            </span>
                            <div className="text-[10px] font-mono text-slate-600 dark:text-slate-300 font-bold">
                                {formData.location.lat.toFixed(6)}, {formData.location.lng.toFixed(6)}
                            </div>
                        </div>
                        <div className="flex flex-col justify-center items-end">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <Smartphone size={10} /> Device (You)
                            </span>
                            <div className="text-[10px] font-mono text-indigo-600 dark:text-indigo-400 font-bold">
                                {currentLoc.lat.toFixed(6)}, {currentLoc.lng.toFixed(6)}
                            </div>
                        </div>
                     </div>
                   )}
                   
                   {/* Main Status Badge */}
                   <div className={`flex items-center gap-3 px-5 py-2.5 rounded-2xl border transition-all ${
                      geoStatus === 'VERIFIED' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                      geoStatus === 'WARNING' ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400' :
                      'bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400'
                   }`}>
                      <div className="relative shrink-0">
                         {geoStatus === 'SEARCHING' ? (
                            <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-white/10 animate-pulse flex items-center justify-center">
                                <Loader2 size={20} className="animate-spin" />
                            </div>
                         ) : (
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 ${
                                geoStatus === 'VERIFIED' ? 'border-emerald-500 bg-emerald-500/20' : 
                                geoStatus === 'WARNING' ? 'border-amber-500 bg-amber-500/20' : 'border-rose-500 bg-rose-500/20'
                            }`}>
                                <Navigation size={18} fill="currentColor" />
                            </div>
                         )}
                      </div>
                                            <div className="min-w-[100px]">
                         <div className="flex justify-between items-center mb-1 gap-4">
                             <span className="text-[9px] font-black uppercase tracking-widest opacity-80">
                                {bypassLock ? 'BYPASS ACTIVE' : (geoStatus === 'VERIFIED' ? 'ZONE A (VERIFIED)' : geoStatus === 'WARNING' ? 'ZONE B (WARNING)' : 'ZONE C (LOCKED)')}
                             </span>
                             {bypassLock ? <Unlock size={10} className="text-indigo-400" /> : <Signal size={10} className={gpsAccuracy < 20 ? "text-emerald-500" : "text-amber-500"} />}
                         </div>
                         <div className="flex items-baseline gap-2">
                             <p className={`text-lg font-black font-mono leading-none ${bypassLock ? 'text-indigo-500' : ''}`}>
                                {currentLoc ? (
                                    formData.distanceFromSite >= 1000 
                                    ? `${(formData.distanceFromSite / 1000).toFixed(2)} km` 
                                    : `${formData.distanceFromSite} m`
                                ) : '--'}
                             </p>
                             {bypassLock && bypassExpiry ? (
                                <span className="text-[10px] font-bold text-indigo-400 flex items-center gap-1">
                                    <Clock size={10} /> {Math.ceil((bypassExpiry - Date.now()) / 60000)}m left
                                </span>
                             ) : (
                                geoStatus !== 'VERIFIED' && eta && (
                                    <span className="text-[10px] font-bold text-rose-400 flex items-center gap-1">
                                        <Clock size={10} /> {eta}
                                    </span>
                                )
                             )}
                         </div>
                      </div>
                   </div>

                   <button 
                      onClick={handleOpenGoogleMaps}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                   >
                      <Map size={16} /> Navigate
                   </button>
               </div>
           </div>
       </div>

       {/* Main Form Content */}
       <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
           
           {/* Read-Only Banner */}
           {isReadOnly && (
             <div className="lg:col-span-12 bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 size={20} />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-emerald-800 dark:text-emerald-400">Inspection Completed</h3>
                    <p className="text-xs text-emerald-600 dark:text-emerald-500/80">This record is locked and cannot be edited. You can only view the details.</p>
                </div>
             </div>
           )}

           {/* Full Security Lock Overlay */}
           {geoStatus === 'LOCKED' && !bypassLock && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-50/60 dark:bg-[#020617]/80 backdrop-blur-sm rounded-[2rem]">
                <div className="bg-white dark:bg-[#0f172a] p-8 rounded-[2.5rem] border border-rose-500/20 shadow-2xl text-center max-w-md mx-4 animate-scale-in">
                    <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                        <Lock size={40} />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Restricted Access (System Locked)</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mb-8 leading-relaxed">
                       ระบบถูกล็อคเนื่องจากอยู่นอกพื้นที่ปฏิบัติงานเกินกำหนด
                       <br/>กรุณาเข้าสู่พื้นที่โรงไฟฟ้าเพื่อปลดล็อคแบบฟอร์ม
                       <br/><span className="text-rose-500 font-bold mt-2 block bg-rose-50 dark:bg-rose-500/10 py-1 px-3 rounded-lg inline-block">ระยะห่าง: {formData.distanceFromSite >= 1000 ? (formData.distanceFromSite/1000).toFixed(2) + ' km' : formData.distanceFromSite + ' m'} (Est. {eta})</span>
                    </p>
                    <div className="flex flex-col gap-3">
                        <button onClick={handleOpenGoogleMaps} className="w-full py-4 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-xl shadow-rose-600/20 transition-all active:scale-95">
                           <Navigation size={16} /> นำทางไปยังจุดตรวจสอบ
                        </button>
                        
                        {minutesToArrival <= 30 && (
                            <button 
                                onClick={handleBypass}
                                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold uppercase tracking-widest text-xs flex items-center justify-center gap-2 shadow-xl shadow-indigo-600/20 transition-all active:scale-95"
                            >
                                <Unlock size={16} /> ปลดล็อคล่วงหน้า (Unlock Early - 30 Mins)
                            </button>
                        )}
                    </div>
                </div>
             </div>
           )}

           {/* Left Column: Form Inputs (Always Active for Data Prep) */}
           <div className="lg:col-span-7 space-y-6">
              
              {/* 1. Object Information */}
              <div className="minimal-card p-6 md:p-8">
                 <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                    <Target size={18} className="text-indigo-500" /> Object Information
                 </h3>
                 <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Object Name / Device ID</label>
                        <input 
                            type="text" 
                            value={formData.objectName || ''}
                            onChange={(e) => handleInputChange('objectName', e.target.value)}
                            placeholder="e.g. Transformer TR-01, Inverter INV-05"
                            disabled={isReadOnly}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        />
                    </div>
                 </div>
              </div>

              {/* 2. Visual Inspection (Outside) */}
              <div className="minimal-card p-6 md:p-8 relative overflow-hidden">
                 <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                        <Camera size={18} className="text-indigo-500" /> Visual Inspection (Outside)
                    </h3>
                    {!isReadOnly && (
                    <div className="flex gap-2">
                        <input 
                            id="upload-outside" 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(e, 'imageEvidence')} 
                        />
                        <button 
                            onClick={() => document.getElementById('upload-outside')?.click()} 
                            className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors flex items-center gap-2"
                            title="Upload Image"
                        >
                            <Upload size={16} /> <span className="text-[10px] font-bold uppercase hidden sm:inline">Upload</span>
                        </button>
                    </div>
                    )}
                 </div>
                 
                 {!formData.imageEvidence ? (
                    !isReadOnly ? (
                    <button 
                      onClick={() => startCamera('imageEvidence')}
                      className="w-full h-48 rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/20 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-indigo-500 hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all group"
                    >
                       <div className="p-4 rounded-full bg-gray-100 dark:bg-white/5 group-hover:scale-110 transition-transform">
                          <Camera size={32} />
                       </div>
                       <span className="text-xs font-bold uppercase tracking-widest">Tap to Capture Outside</span>
                    </button>
                    ) : (
                        <div className="w-full h-48 rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/20 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <span className="text-xs font-bold uppercase tracking-widest">No Image Captured</span>
                        </div>
                    )
                 ) : (
                    <div className="relative rounded-2xl overflow-hidden group">
                       <img src={formData.imageEvidence} alt="Outside Evidence" className="w-full h-64 object-cover" />
                       {!isReadOnly && (
                       <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                          <button onClick={() => startCamera('imageEvidence')} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-transform hover:scale-110">
                             <RefreshCw size={24} />
                          </button>
                          <button onClick={() => handleInputChange('imageEvidence', undefined)} className="p-3 bg-rose-500/20 hover:bg-rose-500 rounded-full text-rose-200 hover:text-white backdrop-blur-md transition-transform hover:scale-110">
                             <X size={24} />
                          </button>
                       </div>
                       )}
                       {formData.powerQualityScore !== undefined && (
                          <div className={`absolute bottom-4 right-4 px-4 py-2 rounded-xl backdrop-blur-md border ${
                             formData.powerQualityScore >= 80 ? 'bg-emerald-500/80 border-emerald-400 text-white' : 
                             formData.powerQualityScore >= 50 ? 'bg-amber-500/80 border-amber-400 text-white' : 'bg-rose-500/80 border-rose-400 text-white'
                          }`}>
                             <span className="text-[10px] uppercase font-black tracking-widest block mb-0.5">Power Quality Score</span>
                             <span className="text-2xl font-black">{formData.powerQualityScore}/100</span>
                          </div>
                       )}
                    </div>
                 )}
                 
                 {formData.aiAnalysis && (
                    <div className="mt-4 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                       <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Sparkles size={12} /> AI Analysis Result
                       </h4>
                       <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-light">
                          {formData.aiAnalysis}
                       </p>
                    </div>
                 )}
              </div>

              {/* 3. Visual Inspection (Inside) */}
              <div className="minimal-card p-6 md:p-8 relative overflow-hidden">
                 <div className="flex justify-between items-center mb-6 relative z-10">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 uppercase tracking-wider">
                        <Camera size={18} className="text-indigo-500" /> Visual Inspection (Inside)
                    </h3>
                    {!isReadOnly && (
                    <div className="flex gap-2">
                        <input 
                            id="upload-inside" 
                            type="file" 
                            accept="image/*" 
                            className="hidden" 
                            onChange={(e) => handleFileUpload(e, 'imageEvidenceInside')} 
                        />
                        <button 
                            onClick={() => document.getElementById('upload-inside')?.click()} 
                            className="p-2 bg-slate-100 dark:bg-white/5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 transition-colors flex items-center gap-2"
                            title="Upload Image"
                        >
                            <Upload size={16} /> <span className="text-[10px] font-bold uppercase hidden sm:inline">Upload</span>
                        </button>
                    </div>
                    )}
                 </div>
                 
                 {!formData.imageEvidenceInside ? (
                    !isReadOnly ? (
                    <button 
                      onClick={() => startCamera('imageEvidenceInside')}
                      className="w-full h-48 rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/20 flex flex-col items-center justify-center gap-3 text-slate-400 hover:text-indigo-500 hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all group"
                    >
                       <div className="p-4 rounded-full bg-gray-100 dark:bg-white/5 group-hover:scale-110 transition-transform">
                          <Camera size={32} />
                       </div>
                       <span className="text-xs font-bold uppercase tracking-widest">Tap to Capture Inside</span>
                    </button>
                    ) : (
                        <div className="w-full h-48 rounded-2xl border-2 border-dashed border-gray-300 dark:border-white/20 flex flex-col items-center justify-center gap-3 text-slate-400">
                            <span className="text-xs font-bold uppercase tracking-widest">No Image Captured</span>
                        </div>
                    )
                 ) : (
                    <div className="relative rounded-2xl overflow-hidden group">
                       <img src={formData.imageEvidenceInside} alt="Inside Evidence" className="w-full h-64 object-cover" />
                       {!isReadOnly && (
                       <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 backdrop-blur-sm">
                          <button onClick={() => startCamera('imageEvidenceInside')} className="p-3 bg-white/10 hover:bg-white/20 rounded-full text-white backdrop-blur-md transition-transform hover:scale-110">
                             <RefreshCw size={24} />
                          </button>
                          <button onClick={() => handleInputChange('imageEvidenceInside', undefined)} className="p-3 bg-rose-500/20 hover:bg-rose-500 rounded-full text-rose-200 hover:text-white backdrop-blur-md transition-transform hover:scale-110">
                             <X size={24} />
                          </button>
                       </div>
                       )}
                       {formData.powerQualityScoreInside !== undefined && (
                          <div className={`absolute bottom-4 right-4 px-4 py-2 rounded-xl backdrop-blur-md border ${
                             formData.powerQualityScoreInside >= 80 ? 'bg-emerald-500/80 border-emerald-400 text-white' : 
                             formData.powerQualityScoreInside >= 50 ? 'bg-amber-500/80 border-amber-400 text-white' : 'bg-rose-500/80 border-rose-400 text-white'
                          }`}>
                             <span className="text-[10px] uppercase font-black tracking-widest block mb-0.5">Power Quality Score</span>
                             <span className="text-2xl font-black">{formData.powerQualityScoreInside}/100</span>
                          </div>
                       )}
                    </div>
                 )}

                 {formData.aiAnalysisInside && (
                    <div className="mt-4 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                       <h4 className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 flex items-center gap-2">
                          <Sparkles size={12} /> AI Analysis Result
                       </h4>
                       <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed font-light">
                          {formData.aiAnalysisInside}
                       </p>
                    </div>
                 )}
              </div>

              {/* 4. Measurements & Power Quality */}
              <div className="minimal-card p-6 md:p-8">
                 <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                    <Activity size={18} className="text-indigo-500" /> Measurements & Power Quality
                 </h3>
                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Voltage (kV) 
                            {plantDetails?.voltageLevel && (
                                <span className="ml-2 text-indigo-500 lowercase font-bold">
                                    Standard: {
                                        plantDetails.voltageLevel === 22 ? '20.9-23.1' :
                                        plantDetails.voltageLevel === 33 ? '31.35-34.65' :
                                        plantDetails.voltageLevel === 115 ? '109.25-126.5' :
                                        plantDetails.voltageLevel === 0.22 ? '0.198-0.242' :
                                        `${(plantDetails.voltageLevel * 0.9).toFixed(2)}-${(plantDetails.voltageLevel * 1.1).toFixed(2)}`
                                    } kV
                                </span>
                            )}
                        </label>
                        <div className="relative">
                            <input 
                                type="number" 
                                step="0.01"
                                value={formData.voltage || ''}
                                onChange={(e) => handleInputChange('voltage', parseFloat(e.target.value))}
                                placeholder={plantDetails?.voltageLevel ? `e.g. ${plantDetails.voltageLevel}` : "e.g. 22.4"}
                                disabled={isReadOnly}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">kV</div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Grounding (Ohm)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                step="0.01"
                                value={formData.groundingOhm || ''}
                                onChange={(e) => handleInputChange('groundingOhm', parseFloat(e.target.value))}
                                placeholder="e.g. 4.2"
                                disabled={isReadOnly}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Ω</div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            THD-V (%)
                            <span className="ml-2 text-indigo-500 lowercase font-bold">Standard: &lt; 5%</span>
                        </label>
                        <div className="relative">
                            <input 
                                type="number" 
                                step="0.01"
                                value={formData.pqData?.thd_v || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, pqData: { ...prev.pqData, thd_v: parseFloat(e.target.value) } }))}
                                placeholder="e.g. 1.2"
                                disabled={isReadOnly}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            THD-I (%)
                            <span className="ml-2 text-indigo-500 lowercase font-bold">Standard: &lt; 5%</span>
                        </label>
                        <div className="relative">
                            <input 
                                type="number" 
                                step="0.01"
                                value={formData.pqData?.thd_i || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, pqData: { ...prev.pqData, thd_i: parseFloat(e.target.value) } }))}
                                placeholder="e.g. 3.5"
                                disabled={isReadOnly}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">
                            Power Factor
                            <span className="ml-2 text-indigo-500 lowercase font-bold">Standard: &gt; 0.85</span>
                        </label>
                        <input 
                            type="number" 
                            step="0.01"
                            value={formData.pqData?.powerFactor || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, pqData: { ...prev.pqData, powerFactor: parseFloat(e.target.value) } }))}
                            placeholder="e.g. 0.98"
                            disabled={isReadOnly}
                            className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Frequency (Hz)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                step="0.01"
                                value={formData.pqData?.frequency || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, pqData: { ...prev.pqData, frequency: parseFloat(e.target.value) } }))}
                                placeholder="e.g. 50.02"
                                disabled={isReadOnly}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">Hz</div>
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Unbalance (%)</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                step="0.01"
                                value={formData.pqData?.unbalance || ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, pqData: { ...prev.pqData, unbalance: parseFloat(e.target.value) } }))}
                                placeholder="e.g. 0.8"
                                disabled={isReadOnly}
                                className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400">%</div>
                        </div>
                    </div>
                 </div>
              </div>

              {/* Power Quality Score Criteria */}
              <div className="minimal-card p-6 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10">
                 <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={14} /> เกณฑ์คะแนนคุณภาพไฟฟ้า (Power Quality Score Criteria)
                 </h3>
                 <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <div className="flex-1">
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block">80 - 100 คะแนน (Excellent)</span>
                            <span className="text-[10px] text-slate-600 dark:text-slate-400">คุณภาพดีเยี่ยม เป็นไปตามมาตรฐาน PEA ไม่พบความผิดปกติ</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                        <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <div className="flex-1">
                            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 block">50 - 79 คะแนน (Warning)</span>
                            <span className="text-[10px] text-slate-600 dark:text-slate-400">คุณภาพปานกลาง พบความเสี่ยงเล็กน้อย ควรเฝ้าระวังหรือปรับปรุง</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
                        <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                        <div className="flex-1">
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block">0 - 49 คะแนน (Critical)</span>
                            <span className="text-[10px] text-slate-600 dark:text-slate-400">คุณภาพต่ำกว่ามาตรฐาน มีความเสี่ยงสูง ต้องแก้ไขทันที</span>
                        </div>
                    </div>
                 </div>
              </div>

              {/* Camera Overlay */}
              {isCameraOpen && (
                 <div className="fixed inset-0 z-[100] bg-black flex flex-col">
                    <video ref={videoRef} autoPlay playsInline className="flex-1 object-cover w-full h-full" />
                    <canvas ref={canvasRef} className="hidden" />
                    <div className="absolute bottom-0 left-0 right-0 p-8 flex justify-between items-center bg-gradient-to-t from-black/80 to-transparent">
                       <button onClick={stopCamera} className="p-4 text-white"><X size={32} /></button>
                       <button 
                          onClick={capturePhoto} 
                          disabled={isCapturing}
                          className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center bg-white/20 active:scale-95 transition-transform"
                       >
                          {isCapturing && <Loader2 className="animate-spin text-white" size={32} />}
                       </button>
                       <div className="w-12"></div>
                    </div>
                 </div>
              )}
           </div>

           {/* Right Column: Signatures & Actions */}
           <div className="lg:col-span-5 space-y-6">
              <div className="minimal-card p-6">
                 <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4 uppercase tracking-wider flex items-center justify-between">
                    <span>Digital Signatures</span>
                    {geoStatus === 'VERIFIED' ? <Unlock size={14} className="text-emerald-500" /> : <Lock size={14} className="text-slate-400" />}
                 </h3>
                 <div className={`space-y-6`}>
                    {isReadOnly ? (
                       <div className="grid grid-cols-1 gap-6">
                           <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Inspector Signature</label>
                               {formData.inspectorSignature ? (
                                   <img src={formData.inspectorSignature} alt="Inspector Signature" className="w-full h-32 object-contain bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10" />
                               ) : (
                                   <div className="w-full h-32 flex items-center justify-center bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 text-xs">Not Signed</div>
                               )}
                           </div>
                           <div>
                               <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Producer Signature</label>
                               {formData.producerSignature ? (
                                   <img src={formData.producerSignature} alt="Producer Signature" className="w-full h-32 object-contain bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10" />
                               ) : (
                                   <div className="w-full h-32 flex items-center justify-center bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 text-slate-400 text-xs">Not Signed</div>
                               )}
                           </div>
                       </div>
                    ) : (
                    <>
                    <div className="space-y-2">
                       <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Inspector Name</label>
                       <input 
                          type="text" 
                          value={formData.inspectorName || ''}
                          onChange={(e) => handleInputChange('inspectorName', e.target.value)}
                          readOnly
                          className="w-full p-3 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none cursor-not-allowed opacity-80 text-slate-600 dark:text-slate-400"
                          placeholder="Enter Inspector Name"
                       />
                    </div>
                    <SignaturePad 
                       label="Inspector Signature" 
                       onSave={(sig) => handleInputChange('inspectorSignature', sig)} 
                    />
                    
                    <div className="space-y-2 mt-4">
                       <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">Producer Name</label>
                       {plantDetails?.contacts && plantDetails.contacts.length > 0 ? (
                           <select
                              value={formData.producerName || ''}
                              onChange={(e) => handleInputChange('producerName', e.target.value)}
                              disabled={isReadOnly}
                              className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50 text-black dark:text-white"
                           >
                               <option value="" className="text-black">Select Producer Name</option>
                               {plantDetails.contacts.map((c, i) => (
                                   <option key={i} value={c.name} className="text-black">{c.name}</option>
                               ))}
                           </select>
                       ) : (
                           <input 
                              type="text" 
                              value={formData.producerName || ''}
                              onChange={(e) => handleInputChange('producerName', e.target.value)}
                              className="w-full p-3 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                              placeholder="Enter Producer Name"
                              disabled={isReadOnly}
                           />
                       )}
                    </div>
                    <SignaturePad 
                       label="Producer Signature" 
                       onSave={(sig) => handleInputChange('producerSignature', sig)} 
                    />
                    </>
                    )}
                 </div>
              </div>

              {/* Contact Information (Moved) */}
              <div className="minimal-card p-6">
                 <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2 uppercase tracking-wider">
                    <User size={18} className="text-indigo-500" /> Contact Information
                 </h3>
                 <div className="space-y-4">
                    {plantDetails?.contacts && plantDetails.contacts.length > 0 ? (
                        plantDetails.contacts.map((contact, index) => (
                            <div key={index} className="p-4 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{contact.name}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">{contact.email}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <a href={`tel:${contact.phone}`} className="px-4 py-2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-emerald-500/20 transition-colors flex items-center gap-2">
                                        <Phone size={14} /> Call
                                    </a>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center py-8 text-slate-400 text-sm">No contact information available</div>
                    )}
                 </div>
              </div>

              <div className="minimal-card p-6 bg-gradient-to-br from-indigo-600 to-indigo-800 text-white border-none shadow-xl shadow-indigo-600/20">
                 {isReadOnly ? (
                     <div className="text-center py-4">
                         <CheckCircle2 size={48} className="mx-auto mb-4 text-emerald-400" />
                         <h3 className="text-lg font-bold mb-2">Inspection Finalized</h3>
                         <p className="text-xs text-indigo-100 mb-6 opacity-80 leading-relaxed">
                            This report has been submitted and is now read-only.
                         </p>
                         <button 
                            onClick={handleDownloadPDF}
                            className="w-full py-4 bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-colors flex items-center justify-center gap-2 active:scale-95"
                        >
                            <FileDown size={18} /> Download Report PDF
                        </button>
                     </div>
                 ) : (
                 <>
                 <h3 className="text-lg font-bold mb-2">Ready to Submit?</h3>
                 <p className="text-xs text-indigo-100 mb-6 opacity-80 leading-relaxed">
                    Choose "Save Directly" if you want to skip AI report generation or if the system is offline.
                 </p>
                 <div className="flex flex-col gap-3">
                    <button 
                        onClick={handleDirectSave}
                        disabled={isSaving}
                        className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg transition-colors flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                        บันทึกข้อมูลทันที (Save Directly)
                    </button>
                    
                    <button 
                        onClick={handleAIAnalysis}
                        disabled={isProcessingAI || !formData.inspectorSignature}
                        className="w-full py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-white/10"
                    >
                        {isProcessingAI ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                        Analyze with AI (Optional)
                    </button>
                 </div>
                 </>
                 )}
              </div>
           </div>
       </div>
    </div>
  );
};
