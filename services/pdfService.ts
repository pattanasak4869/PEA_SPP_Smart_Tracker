
import { jsPDF } from "jspdf";
import { PDFDocument } from 'pdf-lib';
import { InspectionData } from '../types';
import { fetchPlants } from './sheetsService';

// --- 1. Asset Loaders ---

// Helper: Convert ArrayBuffer to Base64
const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

// Load Regular Font (Sarabun)
const loadThaiFontRegular = async (): Promise<string> => {
  try {
    const response = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Regular.ttf');
    if (!response.ok) throw new Error("Font Regular fetch failed");
    return arrayBufferToBase64(await response.arrayBuffer());
  } catch (error) {
    console.warn("Failed to load Thai Regular font.");
    return "";
  }
};

// Load Bold Font (Sarabun)
const loadThaiFontBold = async (): Promise<string> => {
  try {
    const response = await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/sarabun/Sarabun-Bold.ttf');
    if (!response.ok) throw new Error("Font Bold fetch failed");
    return arrayBufferToBase64(await response.arrayBuffer());
  } catch (error) {
    console.warn("Failed to load Thai Bold font.");
    return "";
  }
};

export const combinePDFs = async (pdf1Blob: Blob, pdf2Blob: Blob): Promise<Blob> => {
  const pdf1Bytes = await pdf1Blob.arrayBuffer();
  const pdf2Bytes = await pdf2Blob.arrayBuffer();

  const pdf1Doc = await PDFDocument.load(pdf1Bytes);
  const pdf2Doc = await PDFDocument.load(pdf2Bytes);

  const mergedPdf = await PDFDocument.create();

  const copiedPages1 = await mergedPdf.copyPages(pdf1Doc, pdf1Doc.getPageIndices());
  copiedPages1.forEach((page) => mergedPdf.addPage(page));

  const copiedPages2 = await mergedPdf.copyPages(pdf2Doc, pdf2Doc.getPageIndices());
  copiedPages2.forEach((page) => mergedPdf.addPage(page));

  const mergedPdfBytes = await mergedPdf.save();
  return new Blob([mergedPdfBytes], { type: 'application/pdf' });
};

export const generateInspectionPDF = async (data: InspectionData, returnBlob = false): Promise<Blob | void> => {
  const doc = new jsPDF();

  // --- PRELOAD ASSETS ---
  const [fontRegular, fontBold, plants] = await Promise.all([
      loadThaiFontRegular(),
      loadThaiFontBold(),
      fetchPlants()
  ]);
  
  const plantData = plants.find(p => p.plantId === data.plantId);
  
  // --- REGISTER FONTS (SARABUN) ---
  const isFontReady = !!fontRegular;
  
  if (fontRegular) {
      doc.addFileToVFS("Sarabun-Regular.ttf", fontRegular);
      doc.addFont("Sarabun-Regular.ttf", "Sarabun", "normal");
  }
  
  if (fontBold) {
      doc.addFileToVFS("Sarabun-Bold.ttf", fontBold);
      doc.addFont("Sarabun-Bold.ttf", "Sarabun", "bold");
  } else if (fontRegular) {
      doc.addFont("Sarabun-Regular.ttf", "Sarabun", "bold");
  }

  const setFont = (type: 'normal' | 'bold' = 'normal') => {
      if (isFontReady) {
          doc.setFont("Sarabun", type);
      } else {
          doc.setFont("Helvetica", type === 'bold' ? 'bold' : 'normal');
      }
  };

  const safeSplit = (text: string, width: number): string[] => {
      try {
          return doc.splitTextToSize(text || '', width);
      } catch (e) {
          return [(text || '').substring(0, 100)];
      }
  };

  // --- LAYOUT CONFIG ---
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15; // Reduced margin for more space
  const contentWidth = pageWidth - (margin * 2);
  let yPos = 20;

  // 1. HEADER SECTION (More compact)
  const logoSize = 18;
  const logoY = 15;
  
  doc.setFillColor(116, 4, 95); 
  doc.roundedRect(margin, logoY, logoSize, logoSize, 2, 2, 'F'); 

  doc.setTextColor(255, 255, 255);
  setFont('bold');
  doc.setFontSize(12);
  doc.text("PEA", margin + (logoSize / 2), logoY + (logoSize / 2), { align: "center", baseline: "middle" });

  const headerTextX = margin + 25;
  setFont('bold');
  doc.setTextColor(116, 4, 95); 
  doc.setFontSize(16); 
  doc.text("การไฟฟ้าส่วนภูมิภาค", headerTextX, 20);
  
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(8);
  doc.text("PROVINCIAL ELECTRICITY AUTHORITY", headerTextX, 25);
  
  setFont('normal');
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text("ใบแจ้งผลการตรวจสอบคุณภาพไฟฟ้า (PQ Audit Report)", headerTextX, 33);

  doc.setDrawColor(116, 4, 95); 
  doc.setLineWidth(0.3);
  doc.line(margin, 38, pageWidth - margin, 38);

  setFont('normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  const dateStr = new Date(data.timestamp).toLocaleDateString('th-TH');
  doc.text(`Doc Ref: ${data.id.substring(0, 8).toUpperCase()}`, pageWidth - margin, 20, { align: "right" });
  doc.text(`Date: ${dateStr}`, pageWidth - margin, 25, { align: "right" });

  yPos = 45;

  // 2. Plant Info Box (Compact)
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, yPos, contentWidth, 25, 2, 2, 'FD');
  
  setFont('bold');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text("ข้อมูลสถานประกอบการ (Plant Information)", margin + 5, yPos + 7);
  
  setFont('normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  doc.text(`ชื่อโครงการ : ${data.plantName}`, margin + 5, yPos + 15);
  doc.text(`รหัสโครงการ : ${data.plantId}`, margin + 90, yPos + 15);
  
  if(data.location) {
      doc.text(`พิกัด (GPS) : ${data.location.lat.toFixed(6)}, ${data.location.lng.toFixed(6)}`, margin + 5, yPos + 21);
      doc.text(`ระยะทางจากศูนย์ : ${(data.distanceFromSite/1000).toFixed(2)} km`, margin + 90, yPos + 21);
  }

  yPos += 32;

  // 4. Object Information
  if (data.objectName) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, yPos, contentWidth, 10, 1, 1, 'FD');

      setFont('bold');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(`อุปกรณ์ที่ตรวจสอบ (Object) : ${data.objectName}`, margin + 5, yPos + 6.5);
      yPos += 15;
  }

  // 3. Measurements & Power Quality Section
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, yPos, contentWidth, 32, 2, 2, 'FD');
  
  setFont('bold');
  doc.setFontSize(10);
  doc.setTextColor(51, 65, 85);
  doc.text("ข้อมูลการตรวจวัด (Measurements & Power Quality)", margin + 5, yPos + 7);
  
  setFont('normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);

  const col1 = margin + 5;
  const col2 = margin + 60;
  const col3 = margin + 120;

  doc.text(`Voltage: ${data.voltage || '-'} kV`, col1, yPos + 14);
  doc.text(`Grounding: ${data.groundingOhm || '-'} Ω`, col2, yPos + 14);
  doc.text(`Frequency: ${data.pqData?.frequency || '-'} Hz`, col3, yPos + 14);

  doc.text(`THD-V: ${data.pqData?.thd_v || '-'} %`, col1, yPos + 20);
  doc.text(`THD-I: ${data.pqData?.thd_i || '-'} %`, col2, yPos + 20);
  doc.text(`Power Factor: ${data.pqData?.powerFactor || '-'}`, col3, yPos + 20);

  doc.text(`Unbalance: ${data.pqData?.unbalance || '-'} %`, col1, yPos + 26);

  yPos += 40;

  // 5. AI Executive Summary (Compact)
  if (data.executiveSummary) {
      setFont('bold');
      doc.setFontSize(11);
      doc.setTextColor(116, 4, 95); 
      doc.text("บทสรุปจาก AI (Executive Summary)", margin, yPos);
      yPos += 6;

      setFont('normal');
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.setLineHeightFactor(1.5);
      const lines = safeSplit(data.executiveSummary, contentWidth);
      // Limit to 10 lines to save space if needed, or just let it flow
      doc.text(lines, margin, yPos);
      yPos += (lines.length * 5.5) + 8;
      doc.setLineHeightFactor(1.15); // Reset
  }

  // 6. Visual Evidence (Outside) - Compact
  if (data.imageEvidence) {
      setFont('bold');
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.text("หลักฐานภาพถ่ายภายนอก (Visual Evidence - Outside)", margin, yPos);
      yPos += 6;

      try {
          const props = doc.getImageProperties(data.imageEvidence);
          const h = (contentWidth * props.height) / props.width;
          const finalH = Math.min(h, 95); // Increased height by ~50% (from 65)
          
          doc.addImage(data.imageEvidence, 'JPEG', margin, yPos, contentWidth, finalH);
          yPos += finalH + 5;

          if (data.powerQualityScore !== undefined) {
              doc.setFillColor(241, 245, 249);
              doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
              const scoreWidth = (data.powerQualityScore / 100) * contentWidth;
              const scoreColor = data.powerQualityScore >= 80 ? [34, 197, 94] : data.powerQualityScore >= 50 ? [234, 179, 8] : [239, 68, 68];
              doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2] as number);
              doc.roundedRect(margin, yPos, scoreWidth, 8, 1, 1, 'F');
              
              setFont('bold');
              doc.setFontSize(8);
              doc.setTextColor(0, 0, 0);
              doc.text(`Power Quality Score : ${data.powerQualityScore}/100`, margin + 2, yPos + 5.5);
              yPos += 12;
          }

          if (data.aiAnalysis) {
              setFont('normal');
              doc.setFontSize(8);
              doc.setTextColor(51, 65, 85);
              doc.setLineHeightFactor(1.5);
              const analysisLines = safeSplit(`Analysis: ${data.aiAnalysis}`, contentWidth);
              doc.text(analysisLines, margin, yPos);
              yPos += (analysisLines.length * 5) + 5;
              doc.setLineHeightFactor(1.15);
          }
      } catch (e) {
          doc.text("[Image Error]", margin, yPos + 5);
          yPos += 10;
      }
  }

  // Force Page 2 for the rest of the content
  doc.addPage();
  yPos = 20;

  // 7. Visual Evidence (Inside) - Compact
  if (data.imageEvidenceInside) {
      setFont('bold');
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.text("หลักฐานภาพถ่ายภายใน (Visual Evidence - Inside)", margin, yPos);
      yPos += 6;

      try {
          const props = doc.getImageProperties(data.imageEvidenceInside);
          const h = (contentWidth * props.height) / props.width;
          const finalH = Math.min(h, 95); // Increased height by ~50% (from 65)
          
          doc.addImage(data.imageEvidenceInside, 'JPEG', margin, yPos, contentWidth, finalH);
          yPos += finalH + 5;

          if (data.powerQualityScoreInside !== undefined) {
              doc.setFillColor(241, 245, 249);
              doc.roundedRect(margin, yPos, contentWidth, 8, 1, 1, 'F');
              const scoreWidth = (data.powerQualityScoreInside / 100) * contentWidth;
              const scoreColor = data.powerQualityScoreInside >= 80 ? [34, 197, 94] : data.powerQualityScoreInside >= 50 ? [234, 179, 8] : [239, 68, 68];
              doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2] as number);
              doc.roundedRect(margin, yPos, scoreWidth, 8, 1, 1, 'F');
              
              setFont('bold');
              doc.setFontSize(8);
              doc.setTextColor(0, 0, 0);
              doc.text(`Power Quality Score : ${data.powerQualityScoreInside}/100`, margin + 2, yPos + 5.5);
              yPos += 12;
          }

          if (data.aiAnalysisInside) {
              setFont('normal');
              doc.setFontSize(8);
              doc.setTextColor(51, 65, 85);
              doc.setLineHeightFactor(1.5);
              const analysisLines = safeSplit(`Analysis: ${data.aiAnalysisInside}`, contentWidth);
              doc.text(analysisLines, margin, yPos);
              yPos += (analysisLines.length * 5) + 5;
              doc.setLineHeightFactor(1.15);
          }
      } catch (e) {
          doc.text("[Image Error]", margin, yPos + 5);
          yPos += 10;
      }
      yPos += 5;
  }

  // 7.5 AI Detailed Analysis
  if (data.faultRootCause || data.improvementPlan) {
      setFont('bold');
      doc.setFontSize(11);
      doc.setTextColor(116, 4, 95); 
      doc.text("การวิเคราะห์และข้อเสนอแนะ (AI Detailed Analysis)", margin, yPos);
      yPos += 6;

      if (data.faultRootCause) {
          setFont('bold');
          doc.setFontSize(9);
          doc.setTextColor(180, 0, 0); 
          doc.text("สาเหตุของปัญหา (Root Cause):", margin, yPos);
          yPos += 5;
          setFont('normal');
          doc.setTextColor(51, 65, 85);
          doc.setLineHeightFactor(1.5);
          const faultLines = safeSplit(data.faultRootCause, contentWidth);
          doc.text(faultLines, margin, yPos);
          yPos += (faultLines.length * 5.5) + 5;
          doc.setLineHeightFactor(1.15);
      }

      if (data.improvementPlan) {
          setFont('bold');
          doc.setFontSize(9);
          doc.setTextColor(0, 120, 0); 
          doc.text("แผนการปรับปรุง (Improvement Plan):", margin, yPos);
          yPos += 5;
          setFont('normal');
          doc.setTextColor(51, 65, 85);
          doc.setLineHeightFactor(1.5);
          const planLines = safeSplit(data.improvementPlan, contentWidth);
          doc.text(planLines, margin, yPos);
          yPos += (planLines.length * 5.5) + 8;
          doc.setLineHeightFactor(1.15);
      }
  }

  // 8. Contact Information (Compact)
  if (plantData?.contacts && plantData.contacts.length > 0) {
      setFont('bold');
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85);
      doc.text("ข้อมูลผู้ประสานงาน (Contact Information)", margin, yPos);
      yPos += 8;

      plantData.contacts.forEach((contact) => {
          if (yPos > pageHeight - 40) return; // Don't overflow page 2

          doc.setFillColor(248, 250, 252);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(margin, yPos, contentWidth, 15, 1, 1, 'FD');

          setFont('bold');
          doc.setFontSize(9);
          doc.setTextColor(15, 23, 42);
          doc.text(contact.name, margin + 5, yPos + 6);

          setFont('normal');
          doc.setFontSize(8);
          doc.setTextColor(100, 116, 139);
          doc.text(`Email : ${contact.email} | เบอร์โทรติดต่อ : ${contact.phone}`, margin + 5, yPos + 11);

          yPos += 18;
      });
      yPos += 5;
  }

  // 9. Signatures (Fixed at bottom of Page 2)
  yPos = pageHeight - 50;
  
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  const sigW = contentWidth / 2;
  setFont('bold');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);

  doc.text("ลงชื่อผู้ตรวจสอบ (Inspector)", margin, yPos);
  if (data.inspectorSignature) {
      try { doc.addImage(data.inspectorSignature, 'PNG', margin, yPos + 3, 35, 15); } catch(e){}
  }
  if (data.inspectorName) {
      doc.setFontSize(8);
      doc.text(`(${data.inspectorName})`, margin, yPos + 22);
      doc.setFontSize(9);
  }

  doc.text("ลงชื่อผู้แทนโรงไฟฟ้า (Producer)", margin + sigW, yPos);
  if (data.producerSignature) {
      try { doc.addImage(data.producerSignature, 'PNG', margin + sigW, yPos + 3, 35, 15); } catch(e){}
  }
  if (data.producerName) {
      doc.setFontSize(8);
      doc.text(`(${data.producerName})`, margin + sigW, yPos + 22);
      doc.setFontSize(9);
  }

  // Footer
  const pages = doc.getNumberOfPages();
  for(let i=1; i<=pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text(`Generated by PEA PQ Smart Tracker - Official Report - Page ${i}/${pages}`, pageWidth/2, pageHeight-8, {align:"center"});
  }

  if (returnBlob) {
    return doc.output('blob');
  } else {
    doc.save(`AuditReport_${data.plantId}_${Date.now()}.pdf`);
  }
};
