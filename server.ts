
import dotenv from 'dotenv';
dotenv.config(); // Load .env if exists
dotenv.config({ path: '.env.example' }); // Fallback to .env.example

import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { google } from 'googleapis';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const wss = new WebSocketServer({ server: httpServer });

app.use(express.json({ limit: '50mb' }));

// ระบบจำลองฐานข้อมูลในหน่วยความจำ (In-memory store) พร้อมระบบบันทึกไฟล์ (File Persistence)
// สำหรับการใช้งานจริง ควรเปลี่ยนไปใช้ฐานข้อมูลเช่น PostgreSQL หรือ Google Sheets API
const DB_PATH = path.join(__dirname, 'db.json');

const initialData = {
  inspections: [] as any[],
  plants: [] as any[],
  tools: [] as any[],
  users: [] as any[]
};

let data = initialData;

/**
 * ฟังก์ชันสำหรับดึง ID ของ Spreadsheet จาก URL หรือ ID ตรงๆ
 */
function extractSheetId(idOrUrl: string): string {
    if (!idOrUrl) return '';
    const trimmed = idOrUrl.trim();
    if (trimmed.includes('/d/')) {
        const match = trimmed.match(/\/d\/([a-zA-Z0-9-_]+)/);
        return match ? match[1] : trimmed;
    }
    return trimmed;
}

/**
 * ฟังก์ชันสำหรับตรวจสอบและสร้าง Sheet หากยังไม่มี
 */
async function ensureSheetExists(sheets: any, spreadsheetId: string, title: string, headers: string[]) {
    try {
        const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = spreadsheet.data.sheets.find((s: any) => s.properties.title === title);
        
        if (!sheet) {
            console.log(`[Google Sheets API] กำลังสร้าง Sheet: ${title}`);
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{ addSheet: { properties: { title } } }]
                }
            });
            
            // เพิ่ม Header
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${title}!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [headers] }
            });
        }
    } catch (error: any) {
        console.error(`[Google Sheets API] Error in ensureSheetExists for ${title}:`, error.message);
    }
}

/**
 * ฟังก์ชันสำหรับดึงข้อมูลทั้งหมดจาก Google Sheets เพื่อใช้เป็นฐานข้อมูลเริ่มต้น
 */
async function fetchDataFromSheets() {
    const authEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let authKey = process.env.GOOGLE_PRIVATE_KEY;
    const sheetId = extractSheetId(process.env.GOOGLE_SHEET_ID || '');

    if (!authEmail || !authKey || !sheetId) return null;

    try {
        // ทำความสะอาด Private Key
        authKey = authKey.trim();
        if (authKey.startsWith('"') && authKey.endsWith('"')) {
            authKey = authKey.substring(1, authKey.length - 1);
        }
        authKey = authKey.replace(/\\n/g, '\n');

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: authEmail,
                private_key: authKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        // ตรวจสอบและสร้าง Sheet ที่จำเป็นก่อน
        await ensureSheetExists(sheets, sheetId, 'Inspections', [
            'Timestamp', 'ID', 'Plant Name', 'Voltage', 'Grounding Ohm', 'Status', 'AI Analysis', 'Plant ID', 
            'Object Name', 'PQ Score', 'Summary', 'PQ Data', 'AI Analysis Inside', 'PQ Score Inside', 
            'Fault Cause', 'Improvement', 'Inspector', 'Producer', 'Lat', 'Lng', 'Distance', 'Report URL', 'Voice'
        ]);
        await ensureSheetExists(sheets, sheetId, 'Plants', [
            'Timestamp', 'ID', 'Plant ID', 'Name', 'Type', 'Fuel', 'Capacity', 'PPA', 'Voltage', 'Feeder', 
            'Status', 'Region', 'Province', 'Zone', 'Location', 'Contacts'
        ]);
        await ensureSheetExists(sheets, sheetId, 'Tools', [
            'Last Calibrated', 'Name', 'Serial Number', 'Status', 'Department', 'Category', 'Assigned To', 'Company', 'Image'
        ]);
        await ensureSheetExists(sheets, sheetId, 'Users', [
            'Timestamp', 'User ID', 'Password', 'Name', 'Position', 'Email', 'Phone', 'Zone', 'Role'
        ]);

        // ดึงข้อมูลจากทุุก Sheet ที่เกี่ยวข้อง
        const response = await sheets.spreadsheets.values.batchGet({
            spreadsheetId: sheetId,
            ranges: ['Inspections!A2:Z', 'Plants!A2:Z', 'Tools!A2:Z', 'Users!A2:Z'],
        });

        const valueRanges = response.data.valueRanges || [];
        
        const inspections = (valueRanges[0]?.values || [])
            .filter(row => row[1]) // ต้องมี ID
            .map(row => ({
            timestamp: row[0] ? new Date(row[0]).getTime() : Date.now(),
            id: row[1],
            plantName: row[2],
            voltage: parseFloat(row[3]) || 0,
            groundingOhm: parseFloat(row[4]) || 0,
            status: row[5],
            aiAnalysis: row[6],
            plantId: row[7] || '',
            objectName: row[8] || '',
            powerQualityScore: parseInt(row[9]) || 0,
            executiveSummary: row[10] || '',
            pqData: row[11] ? JSON.parse(row[11]) : {},
            aiAnalysisInside: row[12] || '',
            powerQualityScoreInside: parseInt(row[13]) || 0,
            faultRootCause: row[14] || '',
            improvementPlan: row[15] || '',
            inspectorName: row[16] || '',
            producerName: row[17] || '',
            location: {
                lat: parseFloat(row[18]) || 0,
                lng: parseFloat(row[19]) || 0
            },
            distanceFromSite: parseFloat(row[20]) || 0,
            uploadedReportUrl: row[21] || '',
            voiceNotes: row[22] || ''
        }));

        const plants = (valueRanges[1]?.values || [])
            .filter(row => row[1] || row[2] || row[3]) // ต้องมี ID หรือ Name
            .map(row => ({
            id: row[1] || `p_${Math.random().toString(36).substr(2, 9)}`,
            plantId: row[2] || '',
            name: row[3] || '',
            type: row[4] || 'SOLAR',
            fuelType: row[5] || '',
            capacityMW: parseFloat(row[6]) || 0,
            ppaMW: parseFloat(row[7]) || 0,
            voltageLevel: parseFloat(row[8]) || 22,
            feeder: row[9] || '',
            status: row[10] || 'ACTIVE',
            region: row[11] || '',
            province: row[12] || '',
            zone: row[13] || '',
            location: row[14] ? JSON.parse(row[14]) : { lat: 13.7, lng: 100.5 },
            contacts: row[15] ? JSON.parse(row[15]) : [],
            lastInspectionDate: row[0] ? new Date(row[0]).getTime() : undefined
        }));

        const tools = (valueRanges[2]?.values || [])
            .filter(row => row[2]) // ต้องมี Serial Number (ID)
            .map(row => ({
            lastCalibrated: row[0] ? new Date(row[0]).getTime() : Date.now(),
            name: row[1],
            serialNumber: row[2],
            status: row[3],
            department: row[4],
            id: row[2],
            category: row[5] || 'PQ_ANALYZER',
            assignedTo: row[6] || '',
            companyName: row[7] || 'PEA',
            imageUrl: row[8] || ''
        }));

        const users = (valueRanges[3]?.values || [])
            .filter(row => row[1]) // ต้องมี User ID
            .map(row => ({
            id: row[1],
            password: row[2],
            name: row[3],
            position: row[4],
            email: row[5],
            phone: row[6],
            zone: row[7],
            role: row[8] || 'USER'
        }));

        return { inspections, plants, tools, users };
    } catch (error: any) {
        console.error('[Google Sheets API] ไม่สามารถดึงข้อมูลได้:', error.message);
        return null;
    }
}

// โหลดข้อมูลจากไฟล์เมื่อเริ่มต้นระบบ
async function loadData(): Promise<boolean> {
    console.log('[Database] กำลังโหลดข้อมูล...');
    try {
        // 1. พยายามโหลดจาก Google Sheets ก่อน (ถ้าตั้งค่าไว้)
        const sheetsData = await fetchDataFromSheets();
        if (sheetsData) {
            data = { ...initialData, ...sheetsData };
            console.log(`[Database] โหลดข้อมูลจาก Google Sheets สำเร็จ: Inspections=${data.inspections.length}, Plants=${data.plants.length}, Tools=${data.tools.length}, Users=${data.users.length}`);
            saveData(); // บันทึกลง local cache
            return true;
        } else {
            console.log('[Database] ไม่สามารถโหลดข้อมูลจาก Google Sheets ได้ (อาจไม่ได้ตั้งค่าหรือเกิดข้อผิดพลาด)');
        }

        // 2. ถ้าไม่ได้/ไม่มี ให้โหลดจากไฟล์ db.json
        if (fs.existsSync(DB_PATH)) {
            const fileContent = fs.readFileSync(DB_PATH, 'utf-8');
            if (fileContent.trim()) {
                data = JSON.parse(fileContent);
                console.log(`[Database] โหลดข้อมูลจากไฟล์สำเร็จ: Inspections=${data.inspections.length}`);
                return false; // Loaded from file, not Sheets
            } else {
                console.log('[Database] ไฟล์ db.json ว่างเปล่า กำลังใช้ข้อมูลเริ่มต้น');
                saveData();
                return false;
            }
        } else {
            console.log('[Database] ไม่พบไฟล์ db.json กำลังสร้างไฟล์ใหม่');
            saveData();
            return false;
        }
    } catch (error) {
        console.error('[Database] เกิดข้อผิดพลาดในการโหลดข้อมูล:', error);
        return false;
    }
}

// บันทึกข้อมูลลงไฟล์
function saveData() {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
        console.log('[Database] บันทึกข้อมูลลง db.json สำเร็จ');
    } catch (error) {
        console.error('[Database] เกิดข้อผิดพลาดในการบันทึกข้อมูล:', error);
    }
}

/**
 * ฟังก์ชันสำหรับตัดข้อความที่ยาวเกินขีดจำกัดของ Google Sheets (50,000 ตัวอักษร)
 */
function truncateForSheets(str: any): string {
    if (str === null || str === undefined) return '';
    
    let result = '';
    if (typeof str !== 'string') {
        result = JSON.stringify(str);
    } else {
        result = str;
    }
    
    const LIMIT = 49000; // ตั้งไว้ต่ำกว่า 50,000 เล็กน้อยเพื่อความปลอดภัย
    if (result.length > LIMIT) {
        console.warn(`[Google Sheets API] ข้อความยาวเกินขีดจำกัด (${result.length} ตัวอักษร) กำลังตัดข้อมูล...`);
        return result.substring(0, LIMIT) + "... [TRUNCATED DUE TO GOOGLE SHEETS LIMIT]";
    }
    return result;
}

/**
 * ฟังก์ชันสำหรับส่งข้อมูลไปยัง Google Sheets โดยตรงผ่าน Google Sheets API (v4)
 * ใช้ Service Account ในการยืนยันตัวตน
 */
async function syncToGoogleSheetsDirect(type: string, payload: any) {
    console.log(`[Google Sheets API] Syncing: ${type}`, JSON.stringify(payload).substring(0, 200));
    const authEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    let authKey = process.env.GOOGLE_PRIVATE_KEY;
    const sheetId = extractSheetId(process.env.GOOGLE_SHEET_ID || '');

    if (!authEmail || !authKey || !sheetId) {
        console.log(`[Google Sheets API] ข้ามการซิงค์: ขาดการตั้งค่า Credentials (ประเภท: ${type})`);
        console.log(`[Google Sheets API] Email: ${authEmail ? 'OK' : 'MISSING'}, Key: ${authKey ? 'OK' : 'MISSING'}, SheetID: ${sheetId ? 'OK' : 'MISSING'}`);
        // พยายามใช้ระบบ Apps Script เดิมเป็น fallback หากมี URL
        return syncToGoogleSheets(type, payload);
    }

    try {
        // ทำความสะอาด Private Key (รองรับการก๊อปปี้มาแบบมีเครื่องหมายคำพูด หรือ \n ที่ถูก escape)
        authKey = authKey.trim();
        if (authKey.startsWith('"') && authKey.endsWith('"')) {
            authKey = authKey.substring(1, authKey.length - 1);
        }
        authKey = authKey.replace(/\\n/g, '\n');

        if (!authKey.includes('-----BEGIN PRIVATE KEY-----')) {
            console.error('[Google Sheets API] รูปแบบ GOOGLE_PRIVATE_KEY ไม่ถูกต้อง (ต้องขึ้นต้นด้วย -----BEGIN PRIVATE KEY-----)');
            return;
        }

        const auth = new google.auth.GoogleAuth({
            credentials: {
                client_email: authEmail,
                private_key: authKey,
            },
            scopes: ['https://www.googleapis.com/auth/spreadsheets'],
        });

        const sheets = google.sheets({ version: 'v4', auth });
        
        // กำหนดชื่อ Sheet ตามประเภทข้อมูล
        let range = 'Inspections!A:A';
        let values = [];

        if (type === 'INSPECTION') {
            range = 'Inspections!A:W';
            values = [[
                new Date(payload.timestamp || Date.now()).toISOString(),
                payload.id,
                payload.plantName,
                payload.voltage,
                payload.groundingOhm,
                payload.status,
                truncateForSheets(payload.aiAnalysis || ''),
                payload.plantId || '',
                payload.objectName || '',
                payload.powerQualityScore || 0,
                truncateForSheets(payload.executiveSummary || ''),
                truncateForSheets(payload.pqData || {}),
                truncateForSheets(payload.aiAnalysisInside || ''),
                payload.powerQualityScoreInside || 0,
                truncateForSheets(payload.faultRootCause || ''),
                truncateForSheets(payload.improvementPlan || ''),
                payload.inspectorName || '',
                payload.producerName || '',
                payload.location?.lat || 0,
                payload.location?.lng || 0,
                payload.distanceFromSite || 0,
                truncateForSheets(payload.uploadedReportUrl || ''),
                truncateForSheets(payload.voiceNotes || '')
            ]];
            
            // ตรวจสอบและสร้าง Sheet
            await ensureSheetExists(sheets, sheetId, 'Inspections', [
                'Timestamp', 'ID', 'Plant Name', 'Voltage', 'Grounding Ohm', 'Status', 'AI Analysis', 'Plant ID', 
                'Object Name', 'PQ Score', 'Summary', 'PQ Data', 'AI Analysis Inside', 'PQ Score Inside', 
                'Fault Cause', 'Improvement', 'Inspector', 'Producer', 'Lat', 'Lng', 'Distance', 'Report URL', 'Voice'
            ]);

            // Check if it exists
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: 'Inspections!A:H'
            });
            
            const rows = response.data.values || [];
            let rowIndex = -1;
            let fallbackRowIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;
                
                const rowId = String(row[1] || '').trim();
                const matchId = String(payload.id).trim();
                
                if (rowId === matchId) {
                    const rowPlantId = String(row[7] || '').trim();
                    const matchPlantId = String(payload.plantId || '').trim();
                    
                    if (rowPlantId === matchPlantId) {
                        rowIndex = i + 1; // 1-indexed for sheets
                        break;
                    }
                    if (fallbackRowIndex === -1) fallbackRowIndex = i + 1;
                }
            }
            
            if (rowIndex === -1 && fallbackRowIndex !== -1) {
                rowIndex = fallbackRowIndex;
            }
            
            if (rowIndex !== -1) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: sheetId,
                    range: `Inspections!A${rowIndex}:W${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values }
                });
                console.log(`[Google Sheets API] อัปเดตข้อมูลสำเร็จ (Row ${rowIndex}): ${type}`);
                return;
            }
        } else if (type === 'PLANT') {
            range = 'Plants!A:P';
            values = [[
                new Date().toISOString(),
                payload.id,
                payload.plantId,
                payload.name,
                payload.type,
                payload.fuelType || '',
                payload.capacityMW,
                payload.ppaMW,
                payload.voltageLevel,
                payload.feeder || '',
                payload.status || 'ACTIVE',
                payload.region || '',
                payload.province || '',
                payload.zone || '',
                truncateForSheets(payload.location || {}),
                truncateForSheets(payload.contacts || [])
            ]];
            
            // ตรวจสอบและสร้าง Sheet
            await ensureSheetExists(sheets, sheetId, 'Plants', [
                'Timestamp', 'ID', 'Plant ID', 'Name', 'Type', 'Fuel', 'Capacity', 'PPA', 'Voltage', 'Feeder', 
                'Status', 'Region', 'Province', 'Zone', 'Location', 'Contacts'
            ]);

            // Check if it exists
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: 'Plants!A:C'
            });
            
            const rows = response.data.values || [];
            let rowIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                if (rows[i][1] === payload.id || rows[i][2] === payload.plantId) {
                    rowIndex = i + 1; // 1-indexed for sheets
                    break;
                }
            }
            
            if (rowIndex !== -1) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: sheetId,
                    range: `Plants!A${rowIndex}:P${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values }
                });
                console.log(`[Google Sheets API] อัปเดตข้อมูลสำเร็จ (Row ${rowIndex}): ${type}`);
                return;
            }
        } else if (type === 'TOOL') {
            range = 'Tools!A:I';
            values = [[
                new Date(payload.lastCalibrated || Date.now()).toISOString(),
                payload.name,
                payload.serialNumber,
                payload.status,
                payload.department || '',
                payload.category,
                payload.assignedTo || '',
                payload.companyName || '',
                truncateForSheets(payload.imageUrl || '')
            ]];
            
            // ตรวจสอบและสร้าง Sheet
            await ensureSheetExists(sheets, sheetId, 'Tools', [
                'Last Calibrated', 'Name', 'Serial Number', 'Status', 'Department', 'Category', 'Assigned To', 'Company', 'Image'
            ]);

            // Check if it exists
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: 'Tools!A:C'
            });
            
            const rows = response.data.values || [];
            let rowIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                if (rows[i][2] === payload.serialNumber) {
                    rowIndex = i + 1; // 1-indexed for sheets
                    break;
                }
            }
            
            if (rowIndex !== -1) {
                await sheets.spreadsheets.values.update({
                    spreadsheetId: sheetId,
                    range: `Tools!A${rowIndex}:I${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values }
                });
                console.log(`[Google Sheets API] อัปเดตข้อมูลสำเร็จ (Row ${rowIndex}): ${type}`);
                return;
            }
        } else if (type === 'USER') {
            range = 'Users!A:I';
            values = [[
                new Date().toISOString(),
                payload.id,
                payload.password || '',
                payload.name,
                payload.position,
                payload.email,
                payload.phone,
                payload.zone,
                payload.role || 'USER'
            ]];
            
            // ตรวจสอบและสร้าง Sheet
            await ensureSheetExists(sheets, sheetId, 'Users', [
                'Timestamp', 'User ID', 'Password', 'Name', 'Position', 'Email', 'Phone', 'Zone', 'Role'
            ]);

            // Check if it exists
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: 'Users!A:B'
            });
            
            const rows = response.data.values || [];
            let rowIndex = -1;
            for (let i = 0; i < rows.length; i++) {
                if (rows[i][1] === payload.id) {
                    rowIndex = i + 1; // 1-indexed for sheets
                    break;
                }
            }
            
            if (rowIndex !== -1) {
                // Update existing user
                await sheets.spreadsheets.values.update({
                    spreadsheetId: sheetId,
                    range: `Users!A${rowIndex}:I${rowIndex}`,
                    valueInputOption: 'USER_ENTERED',
                    requestBody: { values }
                });
                console.log(`[Google Sheets API] อัปเดตข้อมูลผู้ใช้สำเร็จ (Row ${rowIndex}): ${payload.id}`);
                return;
            }
        } else if (type === 'DELETE_PLANT' || type === 'DELETE_TOOL') {
            let sheetTitle = '';
            let idColumnIndex = 1; // Default to column B
            let targetId = payload?.id;

            if (type === 'DELETE_PLANT') {
                sheetTitle = 'Plants';
            } else if (type === 'DELETE_TOOL') {
                sheetTitle = 'Tools';
                idColumnIndex = 2; // Serial Number is in column C
                // Use serialNumber if provided in payload, otherwise fallback to id
                targetId = payload.serialNumber || payload.id;
            }

            console.log(`[Google Sheets API] Deletion Config: Sheet=${sheetTitle}, ColumnIndex=${idColumnIndex}, TargetID=${targetId}`);

            // 1. Get Spreadsheet metadata to find sheetId
            const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
            const sheet = spreadsheet.data.sheets?.find((s: any) => s.properties.title === sheetTitle);
            
            if (!sheet) {
                console.error(`[Google Sheets API] ไม่พบ Sheet: ${sheetTitle}`);
                return;
            }
            
            const targetSheetId = sheet.properties.sheetId;

            // 2. Find the row index
            const response = await sheets.spreadsheets.values.get({
                spreadsheetId: sheetId,
                range: `${sheetTitle}!A:Z`
            });
            
            const rows = response.data.values || [];
            let rowIndex = -1;
            let fallbackRowIndex = -1;
            console.log(`[Google Sheets API] Searching for row in ${sheetTitle}: ID=${targetId}, PlantID=${payload.plantId || 'N/A'}`);
            console.log(`[Google Sheets API] Total rows found: ${rows.length}`);
            
            // Log first few rows for debugging
            for (let j = 0; j < Math.min(5, rows.length); j++) {
                console.log(`[Google Sheets API] Row ${j}: ID=${rows[j] ? rows[j][idColumnIndex] : 'N/A'}, PlantID=${rows[j] ? rows[j][7] : 'N/A'}`);
            }

            for (let i = 0; i < rows.length; i++) {
                const row = rows[i];
                if (!row) continue;

                // Robust comparison: check if row exists, has the column, and matches (trimmed)
                const rowId = String(row[idColumnIndex] || '').trim();
                const matchId = String(targetId).trim();

                if (rowId === matchId) {
                    rowIndex = i;
                    break;
                }
            }

            if (rowIndex !== -1) {
                console.log(`[Google Sheets API] กำลังลบแถวที่ ${rowIndex + 1} ใน Sheet: ${sheetTitle}`);
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: sheetId,
                    requestBody: {
                        requests: [{
                            deleteDimension: {
                                range: {
                                    sheetId: targetSheetId,
                                    dimension: 'ROWS',
                                    startIndex: rowIndex,
                                    endIndex: rowIndex + 1
                                }
                            }
                        }]
                    }
                });
                console.log(`[Google Sheets API] ลบข้อมูลสำเร็จ: ${type} (ID: ${targetId})`);
            } else {
                console.warn(`[Google Sheets API] ไม่พบข้อมูลที่ต้องการลบใน Sheets: ${type} (ID: ${targetId})`);
            }
            return;
        }

        if (values.length > 0) {
            console.log(`[Google Sheets API] กำลัง Append ข้อมูลไปยัง Sheet: ${range.split('!')[0]}`);
            await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: range.split('!')[0], // ใช้แค่ชื่อ Sheet สำหรับ Append
                valueInputOption: 'USER_ENTERED',
                insertDataOption: 'INSERT_ROWS',
                requestBody: { values },
            });
            console.log(`[Google Sheets API] ซิงค์ข้อมูลสำเร็จ (Append): ${type}`);
        }
    } catch (error: any) {
        console.error(`[Google Sheets API] เกิดข้อผิดพลาดร้ายแรง:`, error);
        if (error.response && error.response.data) {
            console.error(`[Google Sheets API] รายละเอียดข้อผิดพลาด:`, JSON.stringify(error.response.data));
        }
        // Fallback ไปยัง Apps Script หาก API ล้มเหลว
        return syncToGoogleSheets(type, payload);
    }
}

/**
 * ฟังก์ชันสำหรับส่งข้อมูลไปยัง Google Sheets (Google Sheets Synchronization)
 * 
 * วิธีการทำงาน:
 * 1. ระบบจะตรวจสอบว่ามีการตั้งค่า GOOGLE_SCRIPT_URL ใน Environment Variables หรือไม่
 * 2. หากมี ระบบจะส่งข้อมูลแบบ POST ไปยัง URL นั้นในรูปแบบ JSON
 * 3. ข้อมูลที่ส่งไปจะประกอบด้วย 'type' (ประเภทข้อมูล) และ 'payload' (ตัวข้อมูล)
 */
async function syncToGoogleSheets(type: string, payload: any) {
    const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
    
    if (!SCRIPT_URL) {
        console.log(`[Google Sheets] ข้ามการซิงค์: ไม่พบ GOOGLE_SCRIPT_URL (ประเภท: ${type})`);
        return;
    }

    console.log(`[Google Sheets] กำลังส่งข้อมูลไปยัง Google Sheets... (ประเภท: ${type})`);
    
    try {
        // ส่งข้อมูลไปยัง Google Apps Script Web App
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type,
                payload,
                timestamp: new Date().toISOString(),
                source: 'PEA PQ Smart Tracker'
            })
        });

        if (response.ok) {
            console.log(`[Google Sheets] ซิงค์ข้อมูลสำเร็จ: ${type}`);
        } else {
            console.error(`[Google Sheets] การซิงค์ล้มเหลว: ${response.statusText}`);
        }
    } catch (error) {
        console.error(`[Google Sheets] เกิดข้อผิดพลาดในการเชื่อมต่อ:`, error);
    }
}

// Broadcast to all clients
function broadcast(type: string, payload: any, sender?: WebSocket) {
  const message = JSON.stringify({ type, payload });
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN && client !== sender) {
      client.send(message);
    }
  });
}

// API Routes
app.get('/api/data', (req, res) => {
  res.json(data);
});

app.post('/api/refresh', async (req, res) => {
  console.log('[Database] ได้รับคำขอรีเฟรชข้อมูลจาก Client...');
  try {
    const syncedWithSheets = await loadData();
    if (syncedWithSheets) {
        console.log('[Database] รีเฟรชข้อมูลจาก Google Sheets สำเร็จ');
        res.json({ status: 'success', message: 'รีเฟรชข้อมูลจาก Google Sheets สำเร็จ', data });
    } else {
        console.warn('[Database] รีเฟรชข้อมูลไม่สำเร็จ (โหลดจาก Local Cache แทน)');
        res.status(400).json({ status: 'error', message: 'ไม่สามารถซิงค์กับ Google Sheets ได้ กรุณาตรวจสอบการตั้งค่า' });
    }
  } catch (error: any) {
    console.error('[Database] รีเฟรชข้อมูลล้มเหลว:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  console.log(`[Auth] พยายามเข้าสู่ระบบ: ${username}`);

  // 1. ตรวจสอบใน Memory Data
  const user = data.users.find(u => u.id === username && u.password === password);

  if (user) {
    console.log(`[Auth] เข้าสู่ระบบสำเร็จ: ${username}`);
    const { password: _, ...userWithoutPassword } = user;
    return res.json({ status: 'success', user: userWithoutPassword });
  }

  // 2. หากไม่พบ ให้ลองรีเฟรชจาก Sheets เผื่อมีการเพิ่มผู้ใช้ใหม่
  await loadData();
  const freshUser = data.users.find(u => u.id === username && u.password === password);

  if (freshUser) {
    console.log(`[Auth] เข้าสู่ระบบสำเร็จ (หลังรีเฟรช): ${username}`);
    const { password: _, ...userWithoutPassword } = freshUser;
    return res.json({ status: 'success', user: userWithoutPassword });
  }

  // 3. Mock สำหรับการทดสอบครั้งแรก (หากไม่มีข้อมูลใน Sheets เลย)
  if (username === 'admin' && password === 'admin') {
      const mockAdmin = {
          id: 'admin',
          name: 'System Administrator',
          position: 'Admin',
          email: 'admin@pea.co.th',
          phone: '081-000-0000',
          zone: 'All',
          role: 'ADMIN'
      };
      return res.json({ status: 'success', user: mockAdmin });
  }

  console.log(`[Auth] เข้าสู่ระบบล้มเหลว: ${username}`);
  res.status(401).json({ status: 'error', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' });
});

app.post('/api/logout', (req, res) => {
  res.json({ status: 'success' });
});

app.post('/api/update', async (req, res) => {
  const { type, payload } = req.body;
  
  try {
      if (type === 'saveInspection') {
        const index = data.inspections.findIndex(i => i.id === payload.id);
        if (index >= 0) data.inspections[index] = payload;
        else data.inspections.unshift(payload);
        saveData();
        broadcast('INSPECTION', payload);
        await syncToGoogleSheetsDirect('INSPECTION', payload);
      } else if (type === 'savePlant') {
        const index = data.plants.findIndex(p => p.id === payload.id);
        if (index >= 0) data.plants[index] = payload;
        else data.plants.push(payload);
        saveData();
        broadcast('PLANT', payload);
        await syncToGoogleSheetsDirect('PLANT', payload);
      } else if (type === 'saveTool') {
        const index = data.tools.findIndex(t => t.id === payload.id);
        if (index >= 0) data.tools[index] = payload;
        else data.tools.push(payload);
        saveData();
        broadcast('TOOL', payload);
        await syncToGoogleSheetsDirect('TOOL', payload);
      } else if (type === 'deletePlant') {
        data.plants = data.plants.filter(p => p.id !== payload.id);
        saveData();
        broadcast('PLANT_DELETED', payload.id);
        await syncToGoogleSheetsDirect('DELETE_PLANT', payload);
      } else if (type === 'deleteTool') {
        const toolToDelete = data.tools.find(t => t.id === payload.id);
        const syncPayload = toolToDelete ? { ...payload, serialNumber: toolToDelete.serialNumber } : payload;
        data.tools = data.tools.filter(t => t.id !== payload.id);
        saveData();
        broadcast('TOOL_DELETED', payload.id);
        await syncToGoogleSheetsDirect('DELETE_TOOL', syncPayload);
      } else if (type === 'saveUser') {
        const index = data.users.findIndex(u => u.id === payload.id);
        if (index >= 0) {
            // Preserve password if not provided in payload
            const existingUser = data.users[index];
            data.users[index] = { ...existingUser, ...payload };
        } else {
            data.users.push(payload);
        }
        saveData();
        broadcast('USER', data.users[index] || payload);
        await syncToGoogleSheetsDirect('USER', data.users[index] || payload);
      }

      res.json({ status: 'success' });
  } catch (error: any) {
      console.error('[API Update Error]', error);
      res.status(500).json({ status: 'error', message: error.message });
  }
});

app.post('/api/test-sheets', async (req, res) => {
  const authEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  let authKey = process.env.GOOGLE_PRIVATE_KEY;
  const sheetId = extractSheetId(process.env.GOOGLE_SHEET_ID || '');
  const SCRIPT_URL = process.env.GOOGLE_SCRIPT_URL;
  
  console.log('[Test Sync] กำลังเริ่มทดสอบการเชื่อมต่อ...');
  console.log(`[Test Sync] Email: ${authEmail ? 'OK' : 'MISSING'}`);
  console.log(`[Test Sync] Key: ${authKey ? 'OK' : 'MISSING'}`);
  console.log(`[Test Sync] SheetID: ${sheetId ? 'OK' : 'MISSING'}`);

  // ตรวจสอบว่ามีการตั้งค่า API หรือไม่
  if (authEmail && authKey && sheetId) {
    try {
      // ทำความสะอาด Private Key
      authKey = authKey.trim();
      if (authKey.startsWith('"') && authKey.endsWith('"')) {
          authKey = authKey.substring(1, authKey.length - 1);
      }
      authKey = authKey.replace(/\\n/g, '\n');

      if (!authKey.includes('-----BEGIN PRIVATE KEY-----')) {
          throw new Error('รูปแบบ GOOGLE_PRIVATE_KEY ไม่ถูกต้อง (ต้องขึ้นต้นด้วย -----BEGIN PRIVATE KEY-----)');
      }

      const auth = new google.auth.GoogleAuth({
        credentials: {
          client_email: authEmail,
          private_key: authKey,
        },
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
      });
      const sheets = google.sheets({ version: 'v4', auth });
      
      console.log('[Test Sync] กำลังดึงข้อมูล Spreadsheet Metadata...');
      // ทดสอบดึงข้อมูล Metadata ของ Spreadsheet
      const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
      console.log(`[Test Sync] เชื่อมต่อสำเร็จ: ${meta.data.properties?.title}`);
      
      return res.json({ 
        status: 'success', 
        message: `เชื่อมต่อ Google Sheets API (v4) สำเร็จ! ชื่อไฟล์: ${meta.data.properties?.title}` 
      });
    } catch (error: any) {
      console.error('[Google Sheets API Test Error]:', error);
      let errorMsg = error.message;
      if (error.response && error.response.data && error.response.data.error) {
          errorMsg = `${error.message} (${error.response.data.error.message})`;
      }
      return res.status(500).json({ 
        status: 'error', 
        message: `Google Sheets API Error: ${errorMsg}` 
      });
    }
  }

  // หากไม่มี API ให้ลองใช้ Apps Script เดิม
  if (!SCRIPT_URL) {
    return res.status(400).json({ 
      status: 'error', 
      message: 'ไม่พบการตั้งค่า Google Sheets API หรือ GOOGLE_SCRIPT_URL ในระบบ' 
    });
  }

  try {
    const response = await fetch(SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'TEST',
        payload: { message: 'ระบบทดสอบการเชื่อมต่อ (Connection Test)', timestamp: new Date().toISOString() },
        timestamp: new Date().toISOString(),
        source: 'PEA PQ Smart Tracker TEST'
      })
    });

    if (response.ok) {
      res.json({ status: 'success', message: 'เชื่อมต่อ Google Sheets สำเร็จ!' });
    } else {
      res.status(500).json({ 
        status: 'error', 
        message: `Google Sheets ตอบกลับด้วยข้อผิดพลาด: ${response.status} ${response.statusText}` 
      });
    }
  } catch (error: any) {
    res.status(500).json({ 
      status: 'error', 
      message: `เกิดข้อผิดพลาดในการเชื่อมต่อ: ${error.message}` 
    });
  }
});

// Vite middleware for development
async function startServer() {
  await loadData();
  
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  if (!process.env.VERCEL) {
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  }
}

// Export for Vercel
export default app;

if (!process.env.VERCEL) {
  startServer();
} else {
  // On Vercel, we still need to load data
  loadData().catch(console.error);
}
