
export enum InspectionStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FLAGGED = 'FLAGGED'
}

export type Language = 'TH' | 'EN' | 'CN';

export interface PowerQualityData {
  thd_v?: number; // Total Harmonic Distortion (Voltage)
  thd_i?: number; // Total Harmonic Distortion (Current)
  powerFactor?: number;
  frequency?: number;
  unbalance?: number;
}

export interface InspectionData {
  id: string;
  plantName: string;
  plantId: string;
  objectName?: string;
  location: {
    lat: number;
    lng: number;
  };
  distanceFromSite: number;
  voltage: number;
  groundingOhm: number;
  pqData?: PowerQualityData;
  imageEvidence?: string;
  imageEvidenceInside?: string;
  aiAnalysis?: string;
  aiAnalysisInside?: string;
  powerQualityScore?: number;
  powerQualityScoreInside?: number;
  faultRootCause?: string;
  improvementPlan?: string;
  inspectorSignature?: string;
  inspectorName?: string;
  producerSignature?: string;
  producerName?: string;
  status: InspectionStatus;
  timestamp: number;
  voiceNotes?: string;
  executiveSummary?: string;
  uploadedReportUrl?: string;
}

export interface ToolData {
  id: string;
  name: string;
  serialNumber: string;
  category: 'PQ_ANALYZER' | 'THERMAL_SCAN' | 'GROUND_TESTER' | 'METER';
  lastCalibrated: number;
  assignedTo?: string;
  department?: string;
  status: 'AVAILABLE' | 'IN_USE' | 'DAMAGED_CHECK' | 'REPAIR';
  imageUrl?: string;
  companyName?: string;
}

export interface ContactPerson {
  name: string;
  email: string;
  phone: string;
}

export interface PlantData {
  id: string;
  plantId: string;
  name: string;
  type: 'SOLAR' | 'WIND' | 'BIOMASS' | 'THERMAL' | 'HYDRO';
  capacityMW: number;
  ppaMW?: number; // Contracted Capacity
  voltageLevel?: number; // kV
  feeder?: string; // Parallel Circuit
  fuelType?: string;
  contacts?: ContactPerson[];
  region: string;
  province: string;
  zone: string; // Display name: "Province (Region)"
  location: {
    lat: number;
    lng: number;
  };
  status: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE';
  lastInspectionDate?: number;
}

export type ViewState = 'DASHBOARD' | 'INSPECTION' | 'ALL_TASKS' | 'PROFILE' | 'PLANTS' | 'TOOLS' | 'HISTORY';

export type NotificationType = 'INFO' | 'ALERT' | 'SUCCESS';

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  details?: string;
}
