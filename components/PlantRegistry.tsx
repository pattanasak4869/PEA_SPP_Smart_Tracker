
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { PlantData } from '../types';
import { 
  Search, MapPin, Building2, Plus, Factory, Zap, Leaf, Wind, Droplets, 
  Flame, Navigation, X, CheckCircle, Save, Loader2, Filter, Hash, 
  SortAsc, SortDesc, ChevronRight, ArrowLeft, Camera, RefreshCw, 
  Trash2, Info, AlertTriangle, Globe, Map as MapIcon, MousePointerClick,
  FileSpreadsheet, Upload
} from 'lucide-react';
import { fetchPlants, savePlant, deletePlant, subscribeToUpdates } from '../services/sheetsService';
import { useNotifications } from '../contexts/NotificationContext';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';

interface PlantRegistryProps {
  onBack: () => void;
  onUpdate?: () => void;
  plantsData: PlantData[];
  setPlantsData: React.Dispatch<React.SetStateAction<PlantData[]>>;
}

type SortField = 'name' | 'plantId' | 'zone' | 'status' | 'capacityMW';
type SortOrder = 'asc' | 'desc';

const PLANT_TYPES = ['SOLAR', 'WIND', 'HYDRO', 'BIOMASS', 'THERMAL'] as const;

const PLANT_TYPE_LABELS: Record<string, string> = {
  'SOLAR': 'พลังงานแสงอาทิตย์ (Solar)',
  'WIND': 'พลังงานลม (Wind)',
  'HYDRO': 'พลังงานน้ำ (Hydro)',
  'BIOMASS': 'ชีวมวล (Biomass)',
  'THERMAL': 'ความร้อน (Thermal)'
};

const FUEL_TYPES: Record<string, string[]> = {
  'SOLAR': ['แสงอาทิตย์'],
  'WIND': ['ลม'],
  'HYDRO': ['น้ำ'],
  'BIOMASS': ['ไม้สับ', 'แกลบ', 'กากอ้อย', 'ทะลายปาล์ม', 'ก๊าซชีวภาพ', 'ขยะชุมชน'],
  'THERMAL': ['ก๊าซธรรมชาติ', 'ถ่านหิน', 'น้ำมันดีเซล', 'น้ำมันเตา']
};

// --- Thailand Regions & Provinces Data ---
const THAI_REGIONS: Record<string, string[]> = {
  "ภาคกลาง": ["กรุงเทพมหานคร", "กำแพงเพชร", "ชัยนาท", "นครนายก", "นครปฐม", "นครสวรรค์", "นนทบุรี", "ปทุมธานี", "พระนครศรีอยุธยา", "พิจิตร", "พิษณุโลก", "เพชรบูรณ์", "ลพบุรี", "สมุทรปราการ", "สมุทรสงคราม", "สมุทรสาคร", "สระบุรี", "สิงห์บุรี", "สุโขทัย", "สุพรรณบุรี", "อ่างทอง", "อุทัยธานี"],
  "ภาคเหนือ": ["เชียงราย", "เชียงใหม่", "น่าน", "พะเยา", "แพร่", "แม่ฮ่องสอน", "ลำปาง", "ลำพูน", "อุตรดิตถ์"],
  "ภาคตะวันออกเฉียงเหนือ": ["กาฬสินธุ์", "ขอนแก่น", "ชัยภูมิ", "นครพนม", "นครราชสีมา", "บึงกาฬ", "บุรีรัมย์", "มหาสารคาม", "มุกดาหาร", "ยโสธร", "ร้อยเอ็ด", "เลย", "ศรีสะเกษ", "สกลนคร", "สุรินทร์", "หนองคาย", "หนองบัวลำภู", "อำนาจเจริญ", "อุดรธานี", "อุบลราชธานี"],
  "ภาคตะวันออก": ["จันทบุรี", "ฉะเชิงเทรา", "ชลบุรี", "ตราด", "ปราจีนบุรี", "ระยอง", "สระแก้ว"],
  "ภาคตะวันตก": ["กาญจนบุรี", "ตาก", "ประจวบคีรีขันธ์", "เพชรบุรี", "ราชบุรี"],
  "ภาคใต้": ["กระบี่", "ชุมพร", "ตรัง", "นครศรีธรรมราช", "นราธิวาส", "ปัตตานี", "พังงา", "พัทลุง", "ภูเก็ต", "ระนอง", "สงขลา", "สตูล", "สุราษฎร์ธานี", "ยะลา"]
};

// --- Map Component ---
interface MapPickerProps {
  lat: number;
  lng: number;
  onPick: (lat: number, lng: number) => void;
}

const MapPicker: React.FC<MapPickerProps> = ({ lat, lng }) => {
  const mapUrl = `https://www.google.com/maps/embed/v1/view?key=${process.env.GEMINI_API_KEY}&center=${lat},${lng}&zoom=15&maptype=satellite`;
  
  return (
    <div className="w-full h-full relative overflow-hidden rounded-xl border border-gray-200 dark:border-white/10 shadow-inner">
      <iframe
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        src={`https://www.google.com/maps?q=${lat},${lng}&z=15&output=embed`}
      ></iframe>
    </div>
  );
};


export const PlantRegistry: React.FC<PlantRegistryProps> = ({ onBack, onUpdate, plantsData, setPlantsData }) => {
  const { addNotification } = useNotifications();
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // No local loadData needed as App.tsx handles it
  }, []);
  
  // UI States
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPlant, setSelectedPlant] = useState<PlantData | null>(null);
  const [isEditingStatus, setIsEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<string>('');
  const [isEditingContacts, setIsEditingContacts] = useState(false);
  const [tempContacts, setTempContacts] = useState<{ name: string; email: string; phone: string }[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const fileName = file.name.toLowerCase();
    
    try {
      let data: any[] = [];
      
      if (fileName.endsWith('.csv')) {
        const text = await file.text();
        const result = Papa.parse(text, { header: true, skipEmptyLines: true });
        data = result.data;
      } else if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) {
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer);
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        data = XLSX.utils.sheet_to_json(worksheet);
      } else {
        addNotification('ALERT', 'ไฟล์ไม่ถูกต้อง', 'กรุณาอัปโหลดไฟล์ .csv หรือ .xlsx เท่านั้น');
        setIsLoading(false);
        return;
      }

      if (data.length === 0) {
        addNotification('ALERT', 'ไม่มีข้อมูล', 'ไม่พบข้อมูลในไฟล์ที่อัปโหลด');
        setIsLoading(false);
        return;
      }

      // Process and save plants
      let successCount = 0;
      let failCount = 0;
      const newPlantsToSync: PlantData[] = [];

      for (const row of data) {
        // Map row to PlantData
        const ppaMW = Number(row['ppaMW'] || row['สัญญาขายไฟ'] || 0);
        const type = (row['type'] || row['ประเภท'] || 'SOLAR').toUpperCase() as any;
        const prefix = ppaMW >= 10 ? 'SPP' : 'VSPP';
        const randomSuffix = Math.floor(10000 + Math.random() * 90000);
        
        const plantToSave: PlantData = {
          id: `p_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          plantId: row['plantId'] || row['รหัสโรงไฟฟ้า'] || `${prefix}-${randomSuffix}`,
          name: row['name'] || row['ชื่อโรงไฟฟ้า'] || 'Unnamed Plant',
          type: type,
          capacityMW: ppaMW,
          ppaMW: ppaMW,
          voltageLevel: Number(row['voltageLevel'] || row['ระดับแรงดัน'] || 22),
          feeder: row['feeder'] || row['วงจรที่ขนาน'] || '',
          fuelType: row['fuelType'] || row['เชื้อเพลิง'] || (FUEL_TYPES[type]?.[0] || ''),
          region: row['region'] || row['ภูมิภาค'] || '',
          province: row['province'] || row['จังหวัด'] || '',
          zone: `${row['province'] || ''} (${row['region'] || ''})`,
          status: (row['status'] || 'ACTIVE') as any,
          location: {
            lat: Number(row['lat'] || row['ละติจูด'] || 13.7367),
            lng: Number(row['lng'] || row['ลองจิจูด'] || 100.5231)
          },
          contacts: [
            { 
              name: row['contact1_name'] || '', 
              email: row['contact1_email'] || '', 
              phone: row['contact1_phone'] || '' 
            },
            { 
              name: row['contact2_name'] || '', 
              email: row['contact2_email'] || '', 
              phone: row['contact2_phone'] || '' 
            }
          ]
        };
        newPlantsToSync.push(plantToSave);
      }

      // Optimistic update
      setPlantsData(prev => [...prev, ...newPlantsToSync]);

      for (const plant of newPlantsToSync) {
        try {
          const success = await savePlant(plant);
          if (success) successCount++;
          else failCount++;
        } catch (err) {
          failCount++;
        }
      }

      addNotification(
        failCount === 0 ? 'SUCCESS' : 'INFO', 
        'นำเข้าข้อมูลเรียบร้อย', 
        `สำเร็จ ${successCount} รายการ${failCount > 0 ? `, ล้มเหลว ${failCount} รายการ` : ''}`
      );
      
      if (onUpdate) onUpdate();
      else loadData();

    } catch (error) {
      addNotification('ALERT', 'เกิดข้อผิดพลาด', 'ไม่สามารถประมวลผลไฟล์ได้');
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Form State for New Plant
  const [newPlant, setNewPlant] = useState<Partial<PlantData & { region: string, province: string }>>({
    name: '',
    plantId: '',
    type: 'SOLAR',
    capacityMW: 0,
    ppaMW: 0,
    voltageLevel: 22,
    feeder: '',
    fuelType: 'แสงอาทิตย์',
    contacts: [
      { name: '', email: '', phone: '' },
      { name: '', email: '', phone: '' }
    ],
    region: '',
    province: '',
    zone: '',
    status: 'ACTIVE',
    location: { lat: 13.7367, lng: 100.5231 }
  });

  // --- Auto-ID Logic Effect ---
  useEffect(() => {
    if (newPlant.ppaMW !== undefined) {
      const prefix = newPlant.ppaMW >= 10 ? 'SPP' : 'VSPP';
      // Generate a stable random-like 5 digit number based on timestamp for simulation
      const randomSuffix = Math.floor(10000 + Math.random() * 90000);
      setNewPlant(prev => ({ ...prev, plantId: `${prefix}-${randomSuffix}` }));
    }
  }, [newPlant.ppaMW]);

  // Update Zone String when Region or Province changes
  useEffect(() => {
    if (newPlant.region || newPlant.province) {
      setNewPlant(prev => ({ 
        ...prev, 
        zone: `${prev.province || 'ไม่ระบุจังหวัด'} (${prev.region || 'ไม่ระบุภาค'})` 
      }));
    }
  }, [newPlant.region, newPlant.province]);

  const loadData = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const data = await fetchPlants();
      setPlantsData(data);
    } catch (error) {
      addNotification('ALERT', 'โหลดข้อมูลล้มเหลว', 'ไม่สามารถดึงข้อมูลทะเบียนโรงไฟฟ้าได้');
    } finally {
      setIsLoading(false);
    }
  };

  const processedPlants = useMemo(() => {
    return plantsData
      .filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             p.plantId.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'ALL' || p.type === filterType;
        return matchesSearch && matchesType;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];
        if (typeof valA === 'number' && typeof valB === 'number') {
            return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        const strA = String(valA || '').toLowerCase();
        const strB = String(valB || '').toLowerCase();
        if (strA < strB) return sortOrder === 'asc' ? -1 : 1;
        if (strA > strB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [plantsData, searchTerm, filterType, sortField, sortOrder]);

  const toggleSortOrder = () => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');

  const handleGetCurrentLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setNewPlant(prev => ({
          ...prev,
          location: { lat: pos.coords.latitude, lng: pos.coords.longitude }
        }));
        addNotification('SUCCESS', 'ดึงพิกัดสำเร็จ', 'อัปเดตตำแหน่งจาก GPS ของอุปกรณ์แล้ว');
      }, () => {
        addNotification('ALERT', 'พิกัดล้มเหลว', 'ไม่สามารถเข้าถึงตำแหน่งของคุณได้');
      });
    }
  };

  const handleSaveNewPlant = async () => {
    if (!newPlant.name || !newPlant.plantId || !newPlant.ppaMW || !newPlant.province) {
      addNotification('ALERT', 'ข้อมูลไม่ครบถ้วน', 'กรุณากรอกข้อมูลที่จำเป็นรวมถึงเลือกจังหวัดให้ครบถ้วน');
      return;
    }

    setIsSubmitting(true);
    const plantToSave = {
      ...newPlant,
      capacityMW: newPlant.capacityMW || newPlant.ppaMW || 0,
      id: `p_${Date.now()}`,
      lastInspectionDate: undefined
    } as PlantData;

    // Optimistic update
    setPlantsData(prev => [...prev, plantToSave]);

    try {
      const success = await savePlant(plantToSave);
      if (success) {
        addNotification('SUCCESS', 'บันทึกสำเร็จ', `ลงทะเบียน ${newPlant.name} เรียบร้อยแล้ว`);
        setShowAddModal(false);
        setNewPlant({ 
          name: '', 
          plantId: '', 
          type: 'SOLAR', 
          capacityMW: 0, 
          ppaMW: 0,
          voltageLevel: 22,
          feeder: '',
          fuelType: 'แสงอาทิตย์',
          contacts: [
            { name: '', email: '', phone: '' },
            { name: '', email: '', phone: '' }
          ],
          region: '', 
          province: '', 
          zone: '', 
          status: 'ACTIVE', 
          location: { lat: 13.7367, lng: 100.5231 } 
        });
      } else {
        // Rollback
        setPlantsData(prev => prev.filter(p => p.id !== plantToSave.id));
        addNotification('ALERT', 'บันทึกล้มเหลว', 'ไม่สามารถบันทึกข้อมูลลงฐานข้อมูลได้');
      }
    } catch (error) {
      // Rollback
      setPlantsData(prev => prev.filter(p => p.id !== plantToSave.id));
      addNotification('ALERT', 'บันทึกล้มเหลว', 'เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async () => {
    if (!selectedPlant || !newStatus) return;
    
    const originalStatus = selectedPlant.status;
    const updatedPlant = { ...selectedPlant, status: newStatus as any };
    
    // Optimistic update
    setPlantsData(prev => prev.map(p => p.id === updatedPlant.id ? updatedPlant : p));
    setSelectedPlant(updatedPlant);
    setIsEditingStatus(false);

    setIsSubmitting(true);
    try {
        const success = await savePlant(updatedPlant);
        
        if (success) {
            addNotification('SUCCESS', 'อัปเดตสถานะสำเร็จ', `เปลี่ยนสถานะเป็น ${newStatus} เรียบร้อยแล้ว`);
        } else {
            // Rollback
            setPlantsData(prev => prev.map(p => p.id === updatedPlant.id ? { ...p, status: originalStatus } : p));
            setSelectedPlant({ ...updatedPlant, status: originalStatus });
            addNotification('ALERT', 'อัปเดตล้มเหลว', 'ไม่สามารถบันทึกสถานะใหม่ได้');
        }
    } catch (error) {
        // Rollback
        setPlantsData(prev => prev.map(p => p.id === updatedPlant.id ? { ...p, status: originalStatus } : p));
        setSelectedPlant({ ...updatedPlant, status: originalStatus });
        addNotification('ALERT', 'อัปเดตล้มเหลว', 'ไม่สามารถบันทึกสถานะใหม่ได้');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleUpdateContacts = async () => {
    if (!selectedPlant) return;
    
    const originalContacts = selectedPlant.contacts;
    const updatedPlant = { ...selectedPlant, contacts: tempContacts };
    
    // Optimistic update
    setPlantsData(prev => prev.map(p => p.id === updatedPlant.id ? updatedPlant : p));
    setSelectedPlant(updatedPlant);
    setIsEditingContacts(false);

    setIsSubmitting(true);
    try {
        const success = await savePlant(updatedPlant);
        if (success) {
            addNotification('SUCCESS', 'อัปเดตผู้ประสานงานสำเร็จ', 'ข้อมูลผู้ประสานงานถูกบันทึกแล้ว');
        } else {
            // Rollback
            setPlantsData(prev => prev.map(p => p.id === updatedPlant.id ? { ...p, contacts: originalContacts } : p));
            setSelectedPlant({ ...updatedPlant, contacts: originalContacts });
            addNotification('ALERT', 'อัปเดตล้มเหลว', 'ไม่สามารถบันทึกข้อมูลผู้ประสานงานได้');
        }
    } catch (error) {
        // Rollback
        setPlantsData(prev => prev.map(p => p.id === updatedPlant.id ? { ...p, contacts: originalContacts } : p));
        setSelectedPlant({ ...updatedPlant, contacts: originalContacts });
        addNotification('ALERT', 'อัปเดตล้มเหลว', 'ไม่สามารถบันทึกข้อมูลผู้ประสานงานได้');
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDeletePlant = async () => {
    if (!selectedPlant) return;
    
    const plantToDelete = selectedPlant;
    
    // Optimistic update
    setPlantsData(prev => prev.filter(p => p.id !== plantToDelete.id));
    setSelectedPlant(null);
    setShowDeleteConfirm(false);

    setIsSubmitting(true);
    try {
      const success = await deletePlant(plantToDelete.id);
      if (success) {
        addNotification('SUCCESS', 'ลบข้อมูลสำเร็จ', `ลบโรงไฟฟ้า ${plantToDelete.name} ออกจากระบบแล้ว`);
      } else {
        // Rollback
        setPlantsData(prev => [...prev, plantToDelete]);
        addNotification('ALERT', 'ลบล้มเหลว', 'ไม่สามารถลบข้อมูลออกจากฐานข้อมูลได้');
      }
    } catch (error) {
      // Rollback
      setPlantsData(prev => [...prev, plantToDelete]);
      addNotification('ALERT', 'เกิดข้อผิดพลาด', 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getPlantIcon = (type: string) => {
    switch(type) {
      case 'SOLAR': return <Zap className="text-yellow-500" size={20} />;
      case 'WIND': return <Wind className="text-cyan-500" size={20} />;
      case 'HYDRO': return <Droplets className="text-blue-500" size={20} />;
      case 'BIOMASS': return <Leaf className="text-green-500" size={20} />;
      case 'THERMAL': return <Flame className="text-rose-500" size={20} />;
      default: return <Factory className="text-slate-400" size={20} />;
    }
  };

  return (
    <div className="space-y-8 sm:space-y-12 animate-fade-in pb-24 max-w-[1600px] mx-auto py-6">
      {/* Header & Search UI remain same for Registry View */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 px-4">
        <div className="space-y-2">
          <button onClick={onBack} className="text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors text-sm font-black uppercase tracking-widest flex items-center gap-2 mb-3">
             <ArrowLeft size={16} /> ย้อนกลับ
          </button>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">ทะเบียนผู้ผลิตไฟฟ้า</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm sm:text-base font-light">บริหารจัดการข้อมูลโรงไฟฟ้า SPP/VSPP ในความรับผิดชอบ</p>
        </div>

        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-4 w-full md:w-auto">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
            accept=".csv, .xlsx, .xls"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="bg-white dark:bg-white/5 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-bold py-4 px-8 rounded-2xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-sm hover:bg-indigo-50 dark:hover:bg-indigo-500/10"
          >
            <FileSpreadsheet size={20} /> นำเข้าข้อมูล (Excel/CSV)
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 px-8 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-95 flex items-center justify-center gap-3 uppercase tracking-widest text-sm"
          >
            <Plus size={20} /> ลงทะเบียนโรงไฟฟ้าใหม่
          </button>
        </div>
      </div>

      <div className="minimal-card p-6 mx-4 space-y-6 sticky top-20 z-[80] backdrop-blur-3xl bg-white/90 dark:bg-[#020617]/90 border-white/10">
        <div className="flex flex-col lg:flex-row gap-6 items-center justify-between">
          <div className="relative w-full lg:w-[450px]">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="ค้นหาชื่อ หรือ รหัสโรงไฟฟ้า..."
              className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl pl-12 pr-4 py-3.5 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-600 focus:outline-none focus:border-indigo-500/50 transition-all text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
              <Filter size={14} className="text-slate-500" />
              <select 
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-transparent text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 outline-none cursor-pointer"
              >
                <option value="ALL">ทุกประเภท (ALL)</option>
                {PLANT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sort By:</span>
              <select 
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                className="bg-transparent text-[11px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 outline-none cursor-pointer"
              >
                <option value="name">ชื่อโรงไฟฟ้า</option>
                <option value="plantId">รหัสโครงการ</option>
                <option value="capacityMW">กำลังผลิต (MW)</option>
                <option value="zone">โซน/พื้นที่</option>
                <option value="status">สถานะ</option>
              </select>
              <button 
                onClick={toggleSortOrder}
                className="p-1.5 text-indigo-600 dark:text-indigo-400 hover:bg-gray-200 dark:hover:bg-white/10 rounded-lg transition-all"
              >
                {sortOrder === 'asc' ? <SortAsc size={16} /> : <SortDesc size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-32 text-indigo-500">
          <Loader2 size={48} className="animate-spin mb-4" />
          <p className="text-sm font-black uppercase tracking-[0.2em] animate-pulse">Syncing Grid Registry...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-4">
          {processedPlants.map(plant => (
            <div 
              key={plant.id} 
              onClick={() => setSelectedPlant(plant)}
              className="minimal-card p-6 sm:p-8 group cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition-all relative overflow-hidden flex flex-col h-full"
            >
              <div className="flex justify-between items-start mb-6">
                 <div className="p-4 rounded-2xl bg-gray-100 dark:bg-white/5 text-slate-400 group-hover:bg-indigo-500/10 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-all duration-500">
                    {getPlantIcon(plant.type)}
                 </div>
                 <span className={`status-badge ${plant.status === 'ACTIVE' ? 'status-completed' : plant.status === 'MAINTENANCE' ? 'status-flagged' : 'status-alert'}`}>
                   {plant.status}
                 </span>
              </div>
              <div className="space-y-5 flex-1">
                <div>
                   <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors truncate tracking-tight">{plant.name}</h3>
                   <div className="flex items-center gap-2 text-[10px] text-slate-500 font-mono mt-2 font-black tracking-widest uppercase">
                      <Hash size={12} className="shrink-0" /> {plant.plantId}
                   </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                   <div className="bg-gray-50 dark:bg-black/40 p-4 rounded-xl border border-gray-200 dark:border-white/5">
                      <span className="text-[9px] text-slate-500 uppercase font-black block mb-1 tracking-widest">PPA (MW)</span>
                      <span className="text-sm font-bold text-slate-800 dark:text-white font-mono">{plant.ppaMW} MW</span>
                   </div>
                   <div className="bg-gray-50 dark:bg-black/40 p-4 rounded-xl border border-gray-200 dark:border-white/5">
                      <span className="text-[9px] text-slate-500 uppercase font-black block mb-1 tracking-widest">Fuel</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{plant.fuelType || '-'}</span>
                   </div>
                </div>
              </div>
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-white/5 flex justify-between items-center">
                 <div className="flex items-center gap-2 text-[10px] text-slate-500 font-black uppercase tracking-widest truncate max-w-[200px]">
                    <MapPin size={12} className="text-rose-500 shrink-0" /> {plant.zone}
                 </div>
                 <ChevronRight size={18} className="text-slate-400 dark:text-slate-700 group-hover:text-indigo-600 dark:group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* --- View Plant Details Modal --- */}
      {selectedPlant && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 dark:bg-[#020617]/95 backdrop-blur-2xl animate-fade-in">
           <div className="w-full max-w-3xl bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="p-8 border-b border-gray-200 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                     <div className="p-4 bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                        {getPlantIcon(selectedPlant.type)}
                     </div>
                     <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{selectedPlant.name}</h2>
                         <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest bg-gray-200 dark:bg-white/10 text-slate-600 dark:text-slate-400">
                                {selectedPlant.plantId}
                            </span>
                            {!isEditingStatus ? (
                                <div className="flex items-center gap-2">
                                    <span className={`status-badge ${selectedPlant.status === 'ACTIVE' ? 'status-completed' : selectedPlant.status === 'MAINTENANCE' ? 'status-flagged' : 'status-alert'}`}>
                                        {selectedPlant.status}
                                    </span>
                                    <button 
                                        onClick={() => {
                                            setNewStatus(selectedPlant.status);
                                            setIsEditingStatus(true);
                                        }}
                                        className="p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 animate-fade-in">
                                    <select 
                                        value={newStatus}
                                        onChange={(e) => setNewStatus(e.target.value)}
                                        className="bg-white dark:bg-black/40 border border-indigo-500 rounded-lg px-2 py-1 text-xs font-bold text-slate-700 dark:text-white outline-none"
                                    >
                                        <option value="ACTIVE">ACTIVE</option>
                                        <option value="MAINTENANCE">MAINTENANCE</option>
                                        <option value="INACTIVE">INACTIVE</option>
                                    </select>
                                    <button 
                                        onClick={handleUpdateStatus}
                                        disabled={isSubmitting}
                                        className="p-1 bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
                                    >
                                        <CheckCircle size={14} />
                                    </button>
                                    <button 
                                        onClick={() => setIsEditingStatus(false)}
                                        className="p-1 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-md hover:bg-slate-300 dark:hover:bg-white/20 transition-colors"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            )}
                         </div>
                     </div>
                  </div>
                  <button onClick={() => { setSelectedPlant(null); setIsEditingStatus(false); setShowDeleteConfirm(false); }} className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"><X size={28} /></button>
              </div>

              {/* Content */}
              <div className="p-8 overflow-y-auto custom-scrollbar flex-1 space-y-8">
                  {/* Action Bar */}
                  <div className="flex justify-end gap-3">
                      {!showDeleteConfirm ? (
                        <button 
                          onClick={() => setShowDeleteConfirm(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 text-rose-600 hover:bg-rose-500 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
                        >
                          <Trash2 size={14} /> ลบข้อมูลโรงไฟฟ้า
                        </button>
                      ) : (
                        <div className="flex items-center gap-3 animate-fade-in bg-rose-50 dark:bg-rose-500/10 p-2 rounded-2xl border border-rose-200 dark:border-rose-500/20">
                          <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest px-2">ยืนยันการลบ?</span>
                          <button 
                            onClick={handleDeletePlant}
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-700 transition-all flex items-center gap-2"
                          >
                            {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} ใช่, ลบเลย
                          </button>
                          <button 
                            onClick={() => setShowDeleteConfirm(false)}
                            className="px-4 py-2 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-300 dark:hover:bg-white/20 transition-all"
                          >
                            ยกเลิก
                          </button>
                        </div>
                      )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Plant Type</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{PLANT_TYPE_LABELS[selectedPlant.type] || selectedPlant.type}</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Fuel Type</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedPlant.fuelType || '-'}</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Installed Capacity</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedPlant.capacityMW} MW</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">PPA Capacity</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedPlant.ppaMW} MW</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Voltage</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedPlant.voltageLevel || '-'} kV</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Feeder</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedPlant.feeder || '-'}</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Region</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedPlant.region || '-'}</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5">
                          <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Province</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedPlant.province || '-'}</span>
                      </div>
                      <div className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 col-span-2">
                          <span className="text-[10px] uppercase font-black text-slate-400 block mb-1">Location Zone</span>
                          <span className="font-bold text-slate-900 dark:text-white text-sm">{selectedPlant.zone}</span>
                      </div>
                  </div>

                  {/* Contacts Section */}
                  <div className="space-y-4">
                      <div className="flex justify-between items-center border-b border-gray-200 dark:border-white/10 pb-2">
                          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">ผู้ประสานงาน (Coordinators)</h3>
                          {!isEditingContacts ? (
                              <button 
                                  onClick={() => {
                                      setTempContacts(selectedPlant.contacts || []);
                                      setIsEditingContacts(true);
                                  }}
                                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-500 uppercase tracking-wider flex items-center gap-1"
                              >
                                  <RefreshCw size={12} /> Edit Contacts
                              </button>
                          ) : (
                              <div className="flex items-center gap-2">
                                  <button 
                                      onClick={handleUpdateContacts}
                                      disabled={isSubmitting}
                                      className="px-3 py-1 bg-emerald-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-emerald-600 transition-colors flex items-center gap-1"
                                  >
                                      {isSubmitting ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save
                                  </button>
                                  <button 
                                      onClick={() => setIsEditingContacts(false)}
                                      className="px-3 py-1 bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-slate-300 dark:hover:bg-white/20 transition-colors"
                                  >
                                      Cancel
                                  </button>
                              </div>
                          )}
                      </div>
                      
                      {isEditingContacts ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {tempContacts.map((contact, idx) => (
                                  <div key={idx} className="p-4 rounded-2xl bg-white dark:bg-white/5 border border-indigo-500/30 shadow-lg shadow-indigo-500/10 space-y-3 relative">
                                      <div className="absolute top-2 right-2 text-[9px] font-black text-indigo-300 uppercase tracking-widest">Edit #{idx + 1}</div>
                                      <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-slate-400 uppercase">Name</label>
                                          <input 
                                              type="text" 
                                              value={contact.name}
                                              onChange={(e) => {
                                                  const newContacts = [...tempContacts];
                                                  newContacts[idx] = { ...contact, name: e.target.value };
                                                  setTempContacts(newContacts);
                                              }}
                                              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                                              placeholder="Contact Name"
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-slate-400 uppercase">Email</label>
                                          <input 
                                              type="email" 
                                              value={contact.email}
                                              onChange={(e) => {
                                                  const newContacts = [...tempContacts];
                                                  newContacts[idx] = { ...contact, email: e.target.value };
                                                  setTempContacts(newContacts);
                                              }}
                                              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                                              placeholder="Email Address"
                                          />
                                      </div>
                                      <div className="space-y-1">
                                          <label className="text-[9px] font-bold text-slate-400 uppercase">Phone</label>
                                          <input 
                                              type="tel" 
                                              value={contact.phone}
                                              onChange={(e) => {
                                                  const newContacts = [...tempContacts];
                                                  newContacts[idx] = { ...contact, phone: e.target.value };
                                                  setTempContacts(newContacts);
                                              }}
                                              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:border-indigo-500 transition-colors"
                                              placeholder="Phone Number"
                                          />
                                      </div>
                                  </div>
                              ))}
                              <button 
                                  onClick={() => setTempContacts([...tempContacts, { name: '', email: '', phone: '' }])}
                                  className="p-4 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-500 hover:border-indigo-500/50 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-all"
                              >
                                  <Plus size={24} />
                                  <span className="text-xs font-bold uppercase tracking-wider">Add Contact</span>
                              </button>
                          </div>
                      ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {selectedPlant.contacts && selectedPlant.contacts.length > 0 ? (
                                  selectedPlant.contacts.map((contact, idx) => (
                                      <div key={idx} className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 flex flex-col gap-1">
                                          <span className="text-sm font-bold text-slate-900 dark:text-white">{contact.name || '-'}</span>
                                          <div className="flex items-center gap-2 text-xs text-slate-500">
                                              <span className="font-semibold">Email:</span> {contact.email || '-'}
                                          </div>
                                          <div className="flex items-center gap-2 text-xs text-slate-500">
                                              <span className="font-semibold">Tel:</span> {contact.phone || '-'}
                                          </div>
                                      </div>
                                  ))
                              ) : (
                                  <div className="col-span-2 text-center py-8 text-slate-400 text-xs italic">No contact information available</div>
                              )}
                          </div>
                      )}
                  </div>

                  <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-white/10 h-64 relative">
                       <MapPicker lat={selectedPlant.location.lat} lng={selectedPlant.location.lng} onPick={() => {}} />
                       <div className="absolute bottom-4 right-4 z-[400]">
                           <button 
                             onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedPlant.location.lat},${selectedPlant.location.lng}`, '_blank')}
                             className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg flex items-center gap-2"
                           >
                              <Navigation size={14} /> Navigate Here
                           </button>
                       </div>
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* --- Add New Plant Modal (Enhanced) --- */}
      {showAddModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 dark:bg-[#020617]/95 backdrop-blur-2xl animate-fade-in">
           <div className="w-full max-w-4xl bg-white dark:bg-[#0f172a] border border-gray-200 dark:border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-gray-200 dark:border-white/5 flex justify-between items-center bg-gray-50 dark:bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                     <div className="p-4 bg-indigo-600/20 text-indigo-600 dark:text-indigo-400 rounded-2xl">
                        <Plus size={28} />
                     </div>
                     <div>
                        <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">ลงทะเบียนโรงไฟฟ้าใหม่</h2>
                        <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1">New Grid Plant Registration</p>
                     </div>
                  </div>
                  <button onClick={() => setShowAddModal(false)} className="p-3 text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all"><X size={28} /></button>
              </div>

              <div className="p-10 overflow-y-auto custom-scrollbar flex-1 space-y-10">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ชื่อโรงไฟฟ้า (Plant Name)</label>
                          <input 
                            type="text" 
                            className="w-full glass-input rounded-2xl p-4 text-slate-900 dark:text-white focus:outline-none"
                            placeholder="เช่น โซล่าร์ฟาร์ม หนองจอก"
                            value={newPlant.name}
                            onChange={(e) => setNewPlant({...newPlant, name: e.target.value})}
                          />
                      </div>
                      {/* --- Auto-Generated Plant ID --- */}
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest ml-1">รหัสโครงการ (Auto-Generated ID)</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              readOnly
                              className="w-full bg-gray-100 dark:bg-white/5 border border-indigo-500/20 rounded-2xl p-4 text-indigo-600 dark:text-indigo-400 font-mono focus:outline-none cursor-default shadow-inner"
                              value={newPlant.plantId}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                <CheckCircle size={18} className="text-emerald-500/50" />
                            </div>
                          </div>
                          <p className="text-[9px] text-slate-500 italic px-1">รหัสจะถูกสร้างอัตโนมัติจากประเภทกำลังผลิต (SPP/VSPP)</p>
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ประเภทโรงไฟฟ้า (Plant Type)</label>
                          <select 
                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none"
                            value={newPlant.type}
                            onChange={(e) => {
                                const newType = e.target.value as any;
                                setNewPlant({
                                    ...newPlant, 
                                    type: newType,
                                    fuelType: FUEL_TYPES[newType]?.[0] || ''
                                });
                            }}
                          >
                             {PLANT_TYPES.map(t => <option key={t} value={t} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{PLANT_TYPE_LABELS[t]}</option>)}
                          </select>
                      </div>
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">เชื้อเพลิง (Fuel)</label>
                          <select 
                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none"
                            value={newPlant.fuelType}
                            onChange={(e) => setNewPlant({...newPlant, fuelType: e.target.value})}
                          >
                             {(FUEL_TYPES[newPlant.type || 'SOLAR'] || []).map(f => (
                                 <option key={f} value={f} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white">{f}</option>
                             ))}
                          </select>
                      </div>
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">กำลังผลิตติดตั้ง (Installed MW)</label>
                          <input 
                            type="number" 
                            className="w-full glass-input rounded-2xl p-4 text-slate-900 dark:text-white font-mono text-center outline-none"
                            placeholder="0.0"
                            value={newPlant.capacityMW || ''}
                            onChange={(e) => setNewPlant({...newPlant, capacityMW: Number(e.target.value)})}
                          />
                      </div>
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">สัญญาขายไฟ (PPA MW)</label>
                          <input 
                            type="number" 
                            className="w-full glass-input rounded-2xl p-4 text-slate-900 dark:text-white font-mono text-center outline-none"
                            placeholder="0.0"
                            value={newPlant.ppaMW || ''}
                            onChange={(e) => setNewPlant({...newPlant, ppaMW: Number(e.target.value)})}
                          />
                      </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ระดับแรงดัน (Voltage kV)</label>
                          <input 
                            type="number" 
                            className="w-full glass-input rounded-2xl p-4 text-slate-900 dark:text-white font-mono text-center outline-none"
                            placeholder="22"
                            value={newPlant.voltageLevel || ''}
                            onChange={(e) => setNewPlant({...newPlant, voltageLevel: Number(e.target.value)})}
                          />
                      </div>
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">วงจรที่ขนาน (Feeder)</label>
                          <input 
                            type="text" 
                            className="w-full glass-input rounded-2xl p-4 text-slate-900 dark:text-white outline-none"
                            placeholder="เช่น F1, F2"
                            value={newPlant.feeder || ''}
                            onChange={(e) => setNewPlant({...newPlant, feeder: e.target.value})}
                          />
                      </div>
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">สถานะเริ่มต้น (Initial Status)</label>
                          <select 
                            className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none"
                            value={newPlant.status}
                            onChange={(e) => setNewPlant({...newPlant, status: e.target.value as any})}
                          >
                             <option value="ACTIVE" className="bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400">ACTIVE</option>
                             <option value="MAINTENANCE" className="bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400">MAINTENANCE</option>
                             <option value="INACTIVE" className="bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400">INACTIVE</option>
                          </select>
                      </div>
                  </div>

                  {/* --- Contact Persons Section --- */}
                  <div className="space-y-4">
                      <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest border-b border-gray-200 dark:border-white/10 pb-2">ข้อมูลผู้ประสานงาน (Coordinators)</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {newPlant.contacts?.map((contact, index) => (
                              <div key={index} className="p-4 rounded-2xl bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 space-y-3">
                                  <div className="flex justify-between items-center">
                                      <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Contact #{index + 1}</span>
                                  </div>
                                  <input 
                                    type="text" 
                                    placeholder="ชื่อ-นามสกุล (Name)"
                                    className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm outline-none"
                                    value={contact.name}
                                    onChange={(e) => {
                                        const updatedContacts = [...(newPlant.contacts || [])];
                                        updatedContacts[index] = { ...updatedContacts[index], name: e.target.value };
                                        setNewPlant({ ...newPlant, contacts: updatedContacts });
                                    }}
                                  />
                                  <input 
                                    type="email" 
                                    placeholder="อีเมล (Email)"
                                    className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm outline-none"
                                    value={contact.email}
                                    onChange={(e) => {
                                        const updatedContacts = [...(newPlant.contacts || [])];
                                        updatedContacts[index] = { ...updatedContacts[index], email: e.target.value };
                                        setNewPlant({ ...newPlant, contacts: updatedContacts });
                                    }}
                                  />
                                  <input 
                                    type="tel" 
                                    placeholder="เบอร์โทร (Phone)"
                                    className="w-full bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-xl p-3 text-sm outline-none"
                                    value={contact.phone}
                                    onChange={(e) => {
                                        const updatedContacts = [...(newPlant.contacts || [])];
                                        updatedContacts[index] = { ...updatedContacts[index], phone: e.target.value };
                                        setNewPlant({ ...newPlant, contacts: updatedContacts });
                                    }}
                                  />
                              </div>
                          ))}
                      </div>
                  </div>

                  {/* --- Thailand Geography Selectors --- */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ภูมิภาค (Region)</label>
                          <div className="relative">
                            <select 
                              className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none"
                              value={newPlant.region}
                              onChange={(e) => setNewPlant({...newPlant, region: e.target.value, province: ''})}
                            >
                               <option value="" className="bg-white dark:bg-slate-900">-- เลือกภูมิภาค --</option>
                               {Object.keys(THAI_REGIONS).map(r => <option key={r} value={r} className="bg-white dark:bg-slate-900">{r}</option>)}
                            </select>
                            <MapIcon className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" size={18} />
                          </div>
                      </div>
                      <div className="space-y-3">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">จังหวัด (Province)</label>
                          <div className="relative">
                            <select 
                              className="w-full bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none disabled:opacity-30 disabled:cursor-not-allowed"
                              value={newPlant.province}
                              disabled={!newPlant.region}
                              onChange={(e) => setNewPlant({...newPlant, province: e.target.value})}
                            >
                               <option value="" className="bg-white dark:bg-slate-900">-- เลือกจังหวัด --</option>
                               {newPlant.region && THAI_REGIONS[newPlant.region].map(p => <option key={p} value={p} className="bg-white dark:bg-slate-900">{p}</option>)}
                            </select>
                            <MapPin className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 pointer-events-none" size={18} />
                          </div>
                      </div>
                  </div>

                  <div className="minimal-card p-0 bg-indigo-50 dark:bg-indigo-500/[0.03] border-indigo-100 dark:border-indigo-500/10 overflow-hidden">
                      <div className="p-6 flex justify-between items-center border-b border-indigo-200 dark:border-white/5">
                         <h4 className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest flex items-center gap-3">
                            <Globe size={18} /> Location Metadata
                         </h4>
                         <button 
                            type="button"
                            onClick={handleGetCurrentLocation}
                            className="px-4 py-2 bg-indigo-600/10 hover:bg-indigo-600 text-indigo-600 dark:text-indigo-400 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2"
                         >
                            <Navigation size={14} /> Get Current GPS
                         </button>
                      </div>
                      
                      <div className="flex flex-col md:flex-row h-[400px]">
                          {/* Map Section */}
                          <div className="flex-1 relative border-r border-indigo-200 dark:border-white/5">
                             <div className="absolute inset-0 z-0">
                                <MapPicker 
                                  lat={newPlant.location?.lat || 13.7367} 
                                  lng={newPlant.location?.lng || 100.5231} 
                                  onPick={(lat, lng) => setNewPlant(prev => ({ ...prev, location: { lat, lng } }))}
                                />
                             </div>
                             <div className="absolute top-4 left-4 z-10 bg-white/90 dark:bg-black/80 backdrop-blur px-3 py-1.5 rounded-lg border border-black/10 text-[10px] font-bold text-slate-600 dark:text-slate-300 flex items-center gap-2 pointer-events-none shadow-lg">
                                <Globe size={14} /> Google Maps Service
                             </div>
                          </div>

                          {/* Coordinates Section */}
                          <div className="w-full md:w-64 p-6 space-y-6 bg-white/50 dark:bg-black/20">
                              <div className="space-y-2">
                                <label className="text-[9px] text-slate-600 uppercase font-black tracking-widest block ml-1">Latitude</label>
                                <input 
                                  type="number" 
                                  step="any"
                                  value={newPlant.location?.lat || 0} 
                                  onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setNewPlant(prev => ({ ...prev, location: { ...prev.location!, lat: isNaN(val) ? 0 : val } }));
                                  }}
                                  className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/5 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-mono focus:border-indigo-500 outline-none transition-colors" 
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-[9px] text-slate-600 uppercase font-black tracking-widest block ml-1">Longitude</label>
                                <input 
                                  type="number" 
                                  step="any"
                                  value={newPlant.location?.lng || 0} 
                                  onChange={(e) => {
                                      const val = parseFloat(e.target.value);
                                      setNewPlant(prev => ({ ...prev, location: { ...prev.location!, lng: isNaN(val) ? 0 : val } }));
                                  }}
                                  className="w-full bg-white dark:bg-black/40 border border-gray-200 dark:border-white/5 rounded-xl p-3 text-sm text-slate-900 dark:text-white font-mono focus:border-indigo-500 outline-none transition-colors" 
                                />
                              </div>
                              <div className="pt-4 border-t border-indigo-200 dark:border-white/5">
                                 <p className="text-[10px] text-indigo-500 leading-relaxed italic">
                                   <Info size={12} className="inline mr-1" />
                                   You can manually enter coordinates or use "Get Current GPS" to update the location.
                                 </p>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="p-8 border-t border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02] flex gap-4">
                  <button onClick={() => setShowAddModal(false)} className="flex-1 py-5 rounded-2xl bg-gray-200 dark:bg-white/5 hover:bg-gray-300 dark:hover:bg-white/10 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-widest text-xs transition-all">ยกเลิก</button>
                  <button onClick={handleSaveNewPlant} disabled={isSubmitting} className="flex-[2] py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase tracking-widest text-xs shadow-2xl shadow-indigo-600/20 transition-all flex items-center justify-center gap-3">
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                    ยืนยันการบันทึกข้อมูล
                  </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
