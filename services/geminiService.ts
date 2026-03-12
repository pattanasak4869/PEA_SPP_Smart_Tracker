
import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// --- Caching Utility ---
const AI_CACHE_KEY = 'pea_pq_ai_cache';

const getCache = (key: string) => {
  const cache = JSON.parse(localStorage.getItem(AI_CACHE_KEY) || '{}');
  return cache[key];
};

const setCache = (key: string, value: any) => {
  const cache = JSON.parse(localStorage.getItem(AI_CACHE_KEY) || '{}');
  cache[key] = value;
  localStorage.setItem(AI_CACHE_KEY, JSON.stringify(cache));
};

// --- Helper: Clean JSON Parsing ---
const cleanAndParseJSON = (text: string) => {
  try {
    // 1. Remove markdown code blocks
    let clean = text.replace(/```json|```/g, '').trim();
    
    // 2. Extract JSON object if wrapped in other text
    const firstBrace = clean.indexOf('{');
    const lastBrace = clean.lastIndexOf('}');
    
    if (firstBrace >= 0 && lastBrace >= 0) {
      clean = clean.substring(firstBrace, lastBrace + 1);
    }
    
    return JSON.parse(clean);
  } catch (e) {
    console.error("JSON Parse Error:", e);
    // Return a safe fallback to prevent app crash
    return { 
       analysis: "AI Analysis Error: Invalid format returned.",
       safetyScore: 0,
       faultPotential: ["System Unavailable"]
    };
  }
};

// --- Retry Utility (Exponential Backoff) ---
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 2, fallbackValue?: T): Promise<T> => {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const msg = error?.toString() || '';
      // Check for Quota or Overloaded errors
      const isQuotaError = msg.includes('429') || msg.includes('quota') || msg.includes('exhausted') || msg.includes('503');
      
      if (isQuotaError) {
        if (i === maxRetries - 1) {
            if (fallbackValue !== undefined) {
               console.warn("Gemini API Quota exhausted. Using fallback value.");
               return fallbackValue;
            }
            console.error("Max retries reached for API Quota.");
            throw error;
        }
        console.warn(`Gemini API Quota Hit (Attempt ${i+1}/${maxRetries}). Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }
      // For other errors, throw immediately or return fallback
      if (fallbackValue !== undefined) {
          console.warn("Gemini API Error (Non-Quota). Using fallback.", error);
          return fallbackValue;
      }
      throw error;
    }
  }
  if (fallbackValue !== undefined) return fallbackValue;
  throw new Error('Maximum retries exceeded');
};

export const getDashboardBriefing = async (inspections: any[]): Promise<string> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `จากข้อมูลการตรวจสอบ: ${JSON.stringify(inspections.slice(0, 10))}. สรุปสถานะภาพรวมและความเสี่ยงที่ต้องระวังเป็นประโยคสั้นๆ 1 ประโยค (ภาษาไทย).`,
    });
    return response.text || "ระบบพร้อมทำงาน ตรวจสอบรายการด้านล่าง";
  }, 2, "ระบบพร้อมทำงาน (AI Offline)");
};

export const analyzeInspectionImage = async (base64Image: string, voltageLevel?: number): Promise<{ analysis: string; powerQualityScore: number; faultPotential: string[] }> => {
  const fallback = {
      analysis: "ไม่สามารถวิเคราะห์ภาพได้ในขณะนี้ (ระบบ AI ขัดข้องหรือเกินโควต้า) กรุณาตรวจสอบด้วยสายตา",
      powerQualityScore: 50, // Neutral score
      faultPotential: ["System Unavailable"]
  };

  return withRetry(async () => {
    // Use gemini-3-flash-preview for multimodal analysis
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
          { text: `Analyze this power plant installation for PEA Grid Standards focusing on Power Quality (Harmonics, Voltage Stability, Wiring Safety). ${voltageLevel ? `Voltage Level: ${voltageLevel} kV.` : ''} Return ONLY raw JSON with these keys: {analysis: string (Thai), powerQualityScore: number (0-100), faultPotential: string[]}` }
        ]
      },
      config: {
        responseMimeType: 'application/json'
      }
    });
    return cleanAndParseJSON(response.text || "{}");
  }, 2, fallback);
};

export const generateExecutiveSummary = async (data: any): Promise<{summary: string, faultAnalysis: string, recommendation: string}> => {
  const fallback = {
      summary: "ไม่สามารถสร้างบทสรุปได้เนื่องจากระบบ AI เกินโควต้าการใช้งาน กรุณาใช้ข้อมูลดิบในการรายงาน",
      faultAnalysis: "N/A (AI Service Unavailable)",
      recommendation: "ดำเนินการตามมาตรฐานการบำรุงรักษาปกติ"
  };

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Analyze: ${JSON.stringify(data)}. Generate report in Thai with keys: summary, faultAnalysis, recommendation.`,
      config: { 
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            faultAnalysis: { type: Type.STRING },
            recommendation: { type: Type.STRING }
          },
          required: ["summary", "faultAnalysis", "recommendation"]
        }
      }
    });
    return cleanAndParseJSON(response.text || "{}");
  }, 2, fallback);
};

export const generateSystemAuditReport = async (inspections: any[]): Promise<string> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Generate a system audit report in Thai: ${JSON.stringify(inspections)}`,
    });
    return response.text || "ไม่สามารถสร้างรายงานได้";
  }, 2, "ขออภัย ไม่สามารถสร้างรายงานได้ในขณะนี้ เนื่องจากปริมาณการใช้งาน AI สูงเกินกำหนด");
};

export const getTechInsights = async (topic: string): Promise<string> => {
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model: 'gemini-3.1-pro-preview',
      contents: `Provide a detailed technical insight about "${topic}" specifically for Power Quality and Grid Integration (SPP/VSPP context). Answer in Thai. Use markdown formatting.`,
    });
    return response.text || "ไม่สามารถค้นหาข้อมูลได้";
  }, 2, "ระบบค้นหาข้อมูลขัดข้องชั่วคราว");
};

export const sendAIChatMessage = async (history: any[], newMessage: string): Promise<string> => {
  return withRetry(async () => {
    const chat = ai.chats.create({
      model: 'gemini-3.1-pro-preview',
      history: history,
      config: {
        systemInstruction: `You are "PEA Spark AI". Respond in THAI. Expert in SPP/VSPP Grid Code.`
      }
    });
    const result = await chat.sendMessage({ message: newMessage });
    return result.text || "...";
  }, 2, "ขออภัยครับ ขณะนี้ระบบมีผู้ใช้งานจำนวนมาก ผมไม่สามารถตอบกลับได้ในขณะนี้");
};
