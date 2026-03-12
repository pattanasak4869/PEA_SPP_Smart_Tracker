
/**
 * บริการจัดการข้อมูล (Data Service)
 * ทำหน้าที่เป็นตัวกลางในการติดต่อกับ Backend API และจัดการการเก็บข้อมูลสำรองในเครื่อง (Local Persistence)
 * รองรับการทำงานแบบ Offline-First โดยใช้ LocalStorage และ IndexedDB
 */

import { InspectionData, InspectionStatus, PlantData, ToolData } from '../types';
import { saveAsset, getAsset, clearAllAssets } from './indexedDBService';
import { socketService } from './socketService';

// การตั้งค่าคอนฟิก (Configuration)
// ในสภาวะปกติจะเชื่อมต่อกับ Express Backend ที่พอร์ต 3000
const API_URL = "/api"; 

// คีย์สำหรับเก็บข้อมูลใน LocalStorage
const STORAGE_KEYS = {
  INSPECTIONS: 'app_data_inspections',
  PLANTS: 'app_data_plants',
  TOOLS: 'app_data_tools'
};

/**
 * ล้างข้อมูล Cache ทั้งหมดในเครื่อง (LocalStorage และ IndexedDB)
 */
export const clearAllLocalCaches = async (): Promise<void> => {
  // 1. Clear LocalStorage
  localStorage.removeItem(STORAGE_KEYS.INSPECTIONS);
  localStorage.removeItem(STORAGE_KEYS.PLANTS);
  localStorage.removeItem(STORAGE_KEYS.TOOLS);
  
  // 2. Clear IndexedDB
  await clearAllAssets();
  
  // 3. Reset Memory Caches
  CACHED_INSPECTIONS = [];
  CACHED_PLANTS = [];
  CACHED_TOOLS = [];
  IS_HYDRATED = false;
  
  console.log("[Persistence] ล้างข้อมูล Cache ในเครื่องทั้งหมดแล้ว");
};

// รายชื่อฟิลด์ที่มีขนาดใหญ่ (เช่น รูปภาพ Base64) ที่ต้องแยกไปเก็บใน IndexedDB เพื่อไม่ให้ LocalStorage เต็ม
const LARGE_FIELDS: Record<string, string[]> = {
  INSPECTIONS: [
    'imageEvidence',
    'imageEvidenceInside',
    'uploadedReportUrl',
    'inspectorSignature',
    'producerSignature',
    'voiceNotes'
  ],
  TOOLS: ['imageUrl'],
  PLANTS: ['imageUrl']
};

/**
 * บันทึกข้อมูลขนาดใหญ่ลงใน IndexedDB
 * @param data ข้อมูล
 * @param type ประเภทข้อมูล ('INSPECTIONS' | 'TOOLS' | 'PLANTS')
 * @returns รายชื่อฟิลด์ที่ถูกบันทึกสำเร็จ
 */
const saveToIDB = async (data: any, type: keyof typeof LARGE_FIELDS): Promise<string[]> => {
    const storedFields: string[] = [];
    const fields = LARGE_FIELDS[type];
    if (!fields) return [];

    for (const field of fields) {
        const val = data[field];
        if (val && typeof val === 'string' && val.length > 100) {
            await saveAsset(`${type.toLowerCase()}_${data.id}_${field}`, val);
            storedFields.push(field);
        }
    }
    return storedFields;
};

/**
 * ดึงข้อมูลขนาดใหญ่กลับมาจาก IndexedDB
 * @param data ข้อมูลเบื้องต้น
 * @param type ประเภทข้อมูล
 * @returns ข้อมูลที่สมบูรณ์พร้อมรูปภาพ
 */
const restoreLargeData = async (data: any, type: keyof typeof LARGE_FIELDS): Promise<any> => {
  const restored = { ...data };
  const storedFields = data._storedInIDB as string[] || [];
  
  await Promise.all(storedFields.map(async (field) => {
      const val = await getAsset(`${type.toLowerCase()}_${data.id}_${field}`);
      if (val) restored[field] = val;
  }));
  
  return restored;
};

/**
 * ลบข้อมูลขนาดใหญ่ออกจาก Object ก่อนบันทึกลง LocalStorage
 * เพื่อป้องกันข้อผิดพลาด "QuotaExceededError"
 */
const stripLargeFields = (data: any): any => {
    const clone = { ...data };
    const fields = clone._storedInIDB || [];
    
    fields.forEach((field: string) => {
        delete clone[field];
    });
    
    return clone;
};

/**
 * ดึงข้อมูลการตรวจสอบเริ่มต้น (จาก Cache หรือ Mock)
 */
const getInitialInspections = (): InspectionData[] => {
  const saved = localStorage.getItem(STORAGE_KEYS.INSPECTIONS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const mockIds = ['ins_1', 'p1', 'p2', 'p3', '1', '2', '3'];
      const filtered = parsed.filter((item: any) => !mockIds.includes(item.id));
      
      const uniqueMap = new Map();
      filtered.forEach((item: InspectionData) => {
        if (!uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      });
      const list = Array.from(uniqueMap.values());
      console.log(`[Persistence] โหลด Inspections จาก LocalStorage สำเร็จ: ${list.length} รายการ`);
      return list;
    } catch (e) {
      console.error("ไม่สามารถอ่านข้อมูลการตรวจสอบจาก LocalStorage ได้", e);
    }
  }

  return [];
};

const getInitialPlants = (): PlantData[] => {
  const saved = localStorage.getItem(STORAGE_KEYS.PLANTS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const mockIds = ['ins_1', 'p1', 'p2', 'p3', '1', '2', '3'];
      const filtered = parsed.filter((item: any) => !mockIds.includes(item.id));

      // Deduplicate by ID
      const uniqueMap = new Map();
      filtered.forEach((item: PlantData) => {
        if (!uniqueMap.has(item.id)) {
          uniqueMap.set(item.id, item);
        }
      });
      const list = Array.from(uniqueMap.values());
      console.log(`[Persistence] โหลด Plants จาก LocalStorage สำเร็จ: ${list.length} รายการ`);
      return list;
    } catch (e) {
      console.error("Failed to parse plants", e);
    }
  }

  return [];
};

const getInitialTools = (): ToolData[] => {
  const saved = localStorage.getItem(STORAGE_KEYS.TOOLS);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const mockIds = ['ins_1', 'p1', 'p2', 'p3', '1', '2', '3'];
      return parsed.filter((item: any) => !mockIds.includes(item.id));
    } catch (e) {
      console.error("Failed to parse tools", e);
    }
  }

  return [];
};

let CACHED_INSPECTIONS = getInitialInspections();
let CACHED_PLANTS = getInitialPlants();
let CACHED_TOOLS = getInitialTools();
let IS_HYDRATED = false;

/**
 * ดึงข้อมูลการตรวจสอบทั้งหมด
 * ระบบจะพยายามดึงข้อมูลจาก API ก่อน หากล้มเหลวจะใช้ข้อมูลที่เก็บไว้ในเครื่อง
 */
export const fetchInspections = async (): Promise<InspectionData[]> => {
  if (CACHED_INSPECTIONS.length > 0 && !IS_HYDRATED) {
      const hydrated = await Promise.all(CACHED_INSPECTIONS.map(item => restoreLargeData(item, 'INSPECTIONS')));
      CACHED_INSPECTIONS = hydrated;
      IS_HYDRATED = true;
  }

  try {
    const response = await fetch(`${API_URL}/data?t=${Date.now()}`);
    const json = await response.json();
    
    if (json.inspections) {
      const serverData = json.inspections.map((item: any) => ({
          ...item,
          location: typeof item.location === 'string' ? JSON.parse(item.location) : item.location,
          pqData: typeof item.pqData === 'string' ? JSON.parse(item.pqData) : item.pqData
      }));
      
      console.log(`[Sync] ได้รับข้อมูลจาก Server: ${serverData.length} รายการ`);
      
      // Merge Strategy: Trust server as the source of truth for the set of IDs
      // If we are online and get data, we should reflect the server state
      CACHED_INSPECTIONS = serverData;
      
      const lightweight = serverData.map(stripLargeFields);
      localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(lightweight));
      
      return serverData;
    }
    return CACHED_INSPECTIONS;
  } catch (error) {
    console.warn("ไม่สามารถเชื่อมต่อ API ได้ กำลังใช้ข้อมูลจาก Cache", error);
    return CACHED_INSPECTIONS;
  }
};

/**
 * บันทึกข้อมูลการตรวจสอบ
 * @param data ข้อมูลที่ต้องการบันทึก
 * @param skipNetwork หากเป็น true จะบันทึกเฉพาะในเครื่องเท่านั้น (โหมด Offline)
 */
export const saveInspectionToSheet = async (data: InspectionData, skipNetwork = false): Promise<boolean> => {
  // 1. บันทึกไฟล์ขนาดใหญ่ลง IndexedDB
  const storedFields = await saveToIDB(data, 'INSPECTIONS');
  
  // 2. อัปเดต Metadata
  const dataWithMeta = { ...data, _storedInIDB: storedFields };

  // 3. อัปเดต Cache ในหน่วยความจำ
  const index = CACHED_INSPECTIONS.findIndex(i => i.id === data.id);
  if (index >= 0) {
    CACHED_INSPECTIONS[index] = dataWithMeta;
  } else {
    CACHED_INSPECTIONS.unshift(dataWithMeta);
  }
  
  // 4. บันทึกลง LocalStorage (แบบตัดรูปภาพออก)
  try {
      const lightweightList = CACHED_INSPECTIONS.map(stripLargeFields);
      localStorage.setItem(STORAGE_KEYS.INSPECTIONS, JSON.stringify(lightweightList));
  } catch (e) {
      console.error("LocalStorage เต็ม:", e);
      return false;
  }

  if (skipNetwork) return true;

  // 5. ส่งข้อมูลไปยัง Backend (ซึ่งสามารถส่งต่อไปยัง Google Sheets ได้)
  try {
    const response = await fetch(`${API_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'saveInspection', payload: dataWithMeta })
    });
    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    console.error("การส่งข้อมูลไปยัง Server ล้มเหลว", error);
    return false; 
  }
};

export const fetchPlants = async (): Promise<PlantData[]> => {
  try {
    const response = await fetch(`${API_URL}/data?t=${Date.now()}`);
    const json = await response.json();
    
    if (json.plants) {
      const serverData = await Promise.all(json.plants.map(async (item: any) => {
          const restored = await restoreLargeData(item, 'PLANTS');
          return {
            ...restored,
            location: typeof restored.location === 'string' ? JSON.parse(restored.location) : restored.location
          };
      }));
      
      console.log(`[Sync] ได้รับข้อมูลจาก Server: ${serverData.length} รายการ`);
      
      // Merge Strategy: Trust server as the source of truth for the set of IDs
      CACHED_PLANTS = serverData;
      const lightweight = serverData.map(stripLargeFields);
      localStorage.setItem(STORAGE_KEYS.PLANTS, JSON.stringify(lightweight));
      return serverData;
    }
    return CACHED_PLANTS;
  } catch (error) {
    return CACHED_PLANTS;
  }
};

export const savePlant = async (plant: PlantData): Promise<boolean> => {
   // 1. บันทึกไฟล์ขนาดใหญ่ลง IndexedDB
   const storedFields = await saveToIDB(plant, 'PLANTS');
   const plantWithMeta = { ...plant, _storedInIDB: storedFields };

   const index = CACHED_PLANTS.findIndex(p => p.id === plant.id);
   if (index >= 0) {
     CACHED_PLANTS[index] = plantWithMeta;
   } else {
     CACHED_PLANTS.push(plantWithMeta);
   }
   
   try {
      const lightweightList = CACHED_PLANTS.map(stripLargeFields);
      localStorage.setItem(STORAGE_KEYS.PLANTS, JSON.stringify(lightweightList));
   } catch (e) {
      console.error("LocalStorage เต็ม:", e);
   }

   try {
    const response = await fetch(`${API_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'savePlant', payload: plantWithMeta })
    });
    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    return false;
  }
};

export const deletePlant = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'deletePlant', payload: { id } })
    });
    const result = await response.json();
    if (result.status === 'success') {
      CACHED_PLANTS = CACHED_PLANTS.filter(p => p.id !== id);
      localStorage.setItem(STORAGE_KEYS.PLANTS, JSON.stringify(CACHED_PLANTS));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const refreshData = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    console.error("การรีเฟรชข้อมูลล้มเหลว", error);
    return false;
  }
};

/**
 * เข้าสู่ระบบผ่าน API
 */
export const login = async (username: string, password?: string): Promise<{ success: boolean; user?: any; message?: string }> => {
  try {
    const response = await fetch(`${API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    
    const result = await response.json();
    
    if (result.status === 'success') {
      return { success: true, user: result.user };
    } else {
      return { success: false, message: result.message || 'เข้าสู่ระบบล้มเหลว' };
    }
  } catch (error: any) {
    console.error("Login API Error:", error);
    return { success: false, message: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้' };
  }
};

/**
 * ออกจากระบบผ่าน API
 */
export const logout = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    return false;
  }
};

/**
 * บันทึกข้อมูลผู้ใช้งาน
 */
export const saveUser = async (user: any): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'saveUser', payload: user })
    });
    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    console.error("การบันทึกข้อมูลผู้ใช้งานล้มเหลว", error);
    return false;
  }
};

/**
 * ทดสอบการเชื่อมต่อกับ Google Sheets
 */
export const testSheetsConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    const response = await fetch(`${API_URL}/test-sheets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const result = await response.json();
    return { 
      success: result.status === 'success', 
      message: result.message || (result.status === 'success' ? 'เชื่อมต่อสำเร็จ' : 'เชื่อมต่อล้มเหลว')
    };
  } catch (error: any) {
    return { success: false, message: `ไม่สามารถติดต่อ Server ได้: ${error.message}` };
  }
};

export const getInspectionDetails = async (id: string): Promise<InspectionData | null> => {
  const inspection = CACHED_INSPECTIONS.find(i => i.id === id);
  if (!inspection) return null;
  return await restoreLargeData(inspection, 'INSPECTIONS');
};

export const fetchTools = async (): Promise<ToolData[]> => {
  try {
    const response = await fetch(`${API_URL}/data?t=${Date.now()}`);
    const json = await response.json();
    if (json.tools) {
      const serverData = await Promise.all(json.tools.map((item: any) => restoreLargeData(item, 'TOOLS')));
      
      console.log(`[Sync] ได้รับข้อมูลจาก Server: ${serverData.length} รายการ`);
      
      // Merge Strategy: Trust server as the source of truth for the set of IDs
      CACHED_TOOLS = serverData;
      const lightweight = serverData.map(stripLargeFields);
      localStorage.setItem(STORAGE_KEYS.TOOLS, JSON.stringify(lightweight));
      return CACHED_TOOLS;
    }
    return CACHED_TOOLS;
  } catch (error) {
    return CACHED_TOOLS;
  }
};

export const saveTool = async (tool: ToolData): Promise<boolean> => {
  // 1. บันทึกไฟล์ขนาดใหญ่ลง IndexedDB
  const storedFields = await saveToIDB(tool, 'TOOLS');
  const toolWithMeta = { ...tool, _storedInIDB: storedFields };

  const index = CACHED_TOOLS.findIndex(t => t.id === tool.id);
  if (index >= 0) {
    CACHED_TOOLS[index] = toolWithMeta;
  } else {
    CACHED_TOOLS.push(toolWithMeta);
  }
  
  try {
      const lightweightList = CACHED_TOOLS.map(stripLargeFields);
      localStorage.setItem(STORAGE_KEYS.TOOLS, JSON.stringify(lightweightList));
  } catch (e) {
      console.error("LocalStorage เต็ม:", e);
  }

  try {
    const response = await fetch(`${API_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'saveTool', payload: toolWithMeta })
    });
    const result = await response.json();
    return result.status === 'success';
  } catch (error) {
    return false;
  }
};

export const deleteTool = async (id: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_URL}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'deleteTool', payload: { id } })
    });
    const result = await response.json();
    if (result.status === 'success') {
      CACHED_TOOLS = CACHED_TOOLS.filter(t => t.id !== id);
      localStorage.setItem(STORAGE_KEYS.TOOLS, JSON.stringify(CACHED_TOOLS));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

// Real-time synchronization
export const subscribeToUpdates = (onUpdate: (type: string, payload: any) => void) => {
  const unsub1 = socketService.on('INSPECTION', (payload) => {
    const index = CACHED_INSPECTIONS.findIndex(i => i.id === payload.id);
    if (index >= 0) CACHED_INSPECTIONS[index] = payload;
    else CACHED_INSPECTIONS.unshift(payload);
    onUpdate('INSPECTION', payload);
  });

  const unsub2 = socketService.on('PLANT', (payload) => {
    const index = CACHED_PLANTS.findIndex(p => p.id === payload.id);
    if (index >= 0) CACHED_PLANTS[index] = payload;
    else CACHED_PLANTS.push(payload);
    onUpdate('PLANT', payload);
  });

  const unsub2_delete = socketService.on('PLANT_DELETED', (id) => {
    CACHED_PLANTS = CACHED_PLANTS.filter(p => p.id !== id);
    onUpdate('PLANT_DELETED', id);
  });

  const unsub3 = socketService.on('TOOL', (payload) => {
    const index = CACHED_TOOLS.findIndex(t => t.id === payload.id);
    if (index >= 0) CACHED_TOOLS[index] = payload;
    else CACHED_TOOLS.push(payload);
    onUpdate('TOOL', payload);
  });

  const unsub4 = socketService.on('TOOL_DELETED', (id) => {
    CACHED_TOOLS = CACHED_TOOLS.filter(t => t.id !== id);
    onUpdate('TOOL_DELETED', id);
  });

  const unsub5 = socketService.on('USER', (payload) => {
    onUpdate('USER', payload);
  });

  return () => {
    unsub1();
    unsub2();
    unsub2_delete();
    unsub3();
    unsub4();
    unsub5();
  };
};
