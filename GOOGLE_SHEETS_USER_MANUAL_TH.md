# 📘 คู่มือการเชื่อมต่อ Google Sheets (ฉบับละเอียดที่สุด)
## ระบบ PEA PQ Smart Tracker

คู่มือนี้จะช่วยให้คุณเชื่อมต่อแอปพลิเคชันเข้ากับ Google Sheets เพื่อใช้เป็นฐานข้อมูลออนไลน์สำหรับเก็บข้อมูลการตรวจวัดโรงไฟฟ้าและคลังเครื่องมือ

---

### 🛠 ขั้นตอนที่ 1: เตรียม Google Sheets
1. เข้าไปที่ [Google Sheets](https://sheets.new) เพื่อสร้างไฟล์ใหม่
2. ตั้งชื่อไฟล์ เช่น **"ฐานข้อมูล PEA PQ Smart Tracker"**
3. **สำคัญมาก:** สร้างแผ่นงาน (Tabs) ด้านล่าง 4 แผ่น โดยตั้งชื่อให้ถูกต้องดังนี้:
   - `Inspections` (สำหรับข้อมูลการตรวจ)
   - `Plants` (สำหรับข้อมูลโรงไฟฟ้า)
   - `Tools` (สำหรับข้อมูลเครื่องมือ)
   - `Users` (สำหรับข้อมูลผู้ใช้งาน/ระบบ Login)

---

### 🔑 ขั้นตอนที่ 2: ตั้งค่าระบบ Login (Users)
ในแผ่นงาน `Users` ให้ใส่หัวข้อในแถวแรก (Row 1) ดังนี้:
`Timestamp`, `User ID`, `Password`, `Name`, `Position`, `Email`, `Phone`, `Zone`, `Role`

**ตัวอย่างข้อมูลผู้ใช้งาน:**
- **User ID:** `admin`
- **Password:** `admin`
- **Name:** `System Admin`
- **Role:** `ADMIN`

*หมายเหตุ: หากใน Sheet `Users` ไม่มีข้อมูล ระบบจะอนุญาตให้ใช้ `admin/admin` เพื่อเข้าสู่ระบบในครั้งแรก*

---

### 💻 ขั้นตอนที่ 3: ตั้งค่าระบบรับข้อมูล (Google Apps Script)
1. ในหน้า Google Sheets ไปที่เมนู **ส่วนขยาย (Extensions)** > **Apps Script**
2. ลบโค้ดเดิมทิ้งให้หมด และวางโค้ดด้านล่างนี้ลงไปแทน:

```javascript
/**
 * ฟังก์ชันหลักสำหรับรับข้อมูลจากแอป PEA PQ Smart Tracker
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet;
    
    // 1. จัดการข้อมูลการตรวจ (Inspections)
    if (data.type === 'saveInspection') {
      sheet = ss.getSheetByName('Inspections');
      sheet.appendRow([
        new Date(), 
        data.payload.id, 
        data.payload.plantName, 
        data.payload.voltage, 
        data.payload.groundingOhm,
        data.payload.status,
        data.payload.aiAnalysis
      ]);
    } 
    // 2. จัดการข้อมูลโรงไฟฟ้า (Plants)
    else if (data.type === 'savePlant') {
      sheet = ss.getSheetByName('Plants');
      sheet.appendRow([
        new Date(),
        data.payload.plantId,
        data.payload.name,
        data.payload.capacityMW,
        data.payload.province
      ]);
    } 
    // 3. จัดการข้อมูลเครื่องมือ (Tools)
    else if (data.type === 'saveTool') {
      sheet = ss.getSheetByName('Tools');
      sheet.appendRow([
        new Date(),
        data.payload.name,
        data.payload.serialNumber,
        data.payload.status,
        data.payload.department
      ]);
    }
    // 4. ระบบทดสอบการเชื่อมต่อ (Connection Test)
    else if (data.type === 'TEST') {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'success', 
        message: '✅ เชื่อมต่อสำเร็จ! ระบบ Google Sheets พร้อมรับข้อมูลแล้ว'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({status: 'success'}))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error', 
      message: '❌ เกิดข้อผิดพลาด: ' + error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
```

---

### 🚀 ขั้นตอนที่ 3: การติดตั้ง Web App (Deployment)
1. กดปุ่ม **การทำให้ใช้งานได้ (Deploy)** สีน้ำเงิน > เลือก **การทำให้ใช้งานได้ใหม่ (New Deployment)**
2. เลือกประเภทเป็น **เว็บแอป (Web App)**
3. ตั้งค่าดังนี้:
   - **คำอธิบาย:** `PEA PQ API v1`
   - **เรียกใช้ในฐานะ:** **ฉัน (Me)**
   - **ผู้ที่มีสิทธิ์เข้าถึง:** **ทุกคน (Anyone)** *(ต้องเลือกอันนี้เท่านั้น)*
4. กด **การทำให้ใช้งานได้ (Deploy)**
5. กด **ให้สิทธิ์เข้าถึง (Authorize Access)** > เลือกบัญชี Google > กด **Advanced** > กด **Go to... (unsafe)** > กด **Allow**
6. **คัดลอก URL ของเว็บแอป** ที่ได้มา (เก็บไว้ใช้ในขั้นตอนถัดไป)

---

### ⚙️ ขั้นตอนที่ 5: เชื่อมต่อกับแอปใน AI Studio
1. กลับมาที่หน้าจอ **Google AI Studio**
2. ไปที่เมนู **Settings** (รูปเฟือง)
3. ในส่วน **Environment Variables** ให้เพิ่มค่าใหม่:
   - **Key:** `GOOGLE_SCRIPT_URL`
   - **Value:** (วาง URL ที่คัดลอกมา)
   - **Key:** `GOOGLE_SHEET_ID`
   - **Value:** (ID ของไฟล์ Google Sheet - ดูได้จาก URL ของ Sheet)
4. กด **Save** หรือ **Update**

---

### ✅ ขั้นตอนที่ 6: ทดสอบการใช้งาน
1. เปิดแอป PEA PQ Smart Tracker
2. เข้าสู่ระบบด้วย `admin` / `admin`
3. ไปที่เมนู **"เครื่องมือ (Tools)"**
4. กดปุ่ม **"Test Sync"** (ปุ่มสีเขียว)
5. หากขึ้นว่า **"การเชื่อมต่อสมบูรณ์"** แสดงว่าระบบพร้อมใช้งานแล้ว!
6. ลองบันทึกข้อมูลจริง ข้อมูลจะไปปรากฏใน Google Sheets ทันที

---
**จัดทำโดย:** ระบบช่วยพัฒนา AI (Senior Full-Stack Developer Assistant)

---
### 💡 เคล็ดลับเพิ่มเติม
- หากต้องการใช้ระบบที่เสถียรกว่า แนะนำให้ใช้ **Method 2 (Service Account)** โดยการกรอก `GOOGLE_SERVICE_ACCOUNT_EMAIL` และ `GOOGLE_PRIVATE_KEY` ใน Settings
- ระบบจะดึงข้อมูลผู้ใช้งานจาก Sheet `Users` มาใช้ในการ Login แบบ Real-time