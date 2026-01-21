
import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

export const preprocessImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const SCALE = 1536; // Increased resolution for better OCR
        let w = img.width, h = img.height;
        if (w > SCALE || h > SCALE) {
          const r = Math.min(SCALE/w, SCALE/h);
          w *= r; h *= r;
        }
        canvas.width = w; canvas.height = h;
        if (ctx) {
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const scanDLWithGemini = async (base64: string): Promise<Record<string, string>> => {
  // 🔴 CRITICAL: Obtain API key exclusively from process.env.API_KEY
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Use gemini-3-flash-preview for Basic Text Tasks like OCR and Extraction
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: [{
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: `Strict OCR extraction for AAMVA 2020.
        Required Fields:
        - DCS (Last), DAC (First), DAD (Middle)
        - DAQ (ID#), DCF (Audit)
        - DBB, DBA, DBD (Dates in YYYYMMDD)
        - DAJ (State 2-char), DCG (Country USA/CAN)
        - DAU (Height), DBC (Sex 1/2/9), DAY (Eyes)
        - DAG (Address), DAI (City), DAK (Zip)
        - DDA: 'F' if Real ID star present, else 'N'
        - DDK: '1' if Donor heart present, else '0'
        Return valid JSON only.` }
      ]
    }],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          DCS: { type: Type.STRING },
          DAC: { type: Type.STRING },
          DAD: { type: Type.STRING },
          DAQ: { type: Type.STRING },
          DBB: { type: Type.STRING },
          DBA: { type: Type.STRING },
          DBD: { type: Type.STRING },
          DAJ: { type: Type.STRING },
          DCG: { type: Type.STRING },
          DAG: { type: Type.STRING },
          DAI: { type: Type.STRING },
          DAK: { type: Type.STRING },
          DBC: { type: Type.STRING },
          DAY: { type: Type.STRING },
          DAU: { type: Type.STRING },
          DCF: { type: Type.STRING },
          DDA: { type: Type.STRING },
          DDK: { type: Type.STRING }
        }
      }
    }
  });

  // 🔴 Use response.text property directly
  const text = response.text;
  if (!text) throw new Error("Neural link extraction failed.");
  
  try {
    const raw = JSON.parse(text);
    const cleaned: Record<string, string> = {};
    Object.keys(raw).forEach(key => {
      let val = String(raw[key] || "").toUpperCase().trim();
      // Normalize dates to digits only
      if (['DBA', 'DBB', 'DBD'].includes(key)) val = val.replace(/\D/g, '');
      cleaned[key] = val;
    });
    return cleaned;
  } catch (e) {
    throw new Error("Failed to parse neural response.");
  }
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  return JURISDICTIONS.find(j => j.code === (code || "").toUpperCase() && !j.name.includes("Old")) || null;
};
