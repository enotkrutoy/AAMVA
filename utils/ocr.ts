
import { GoogleGenAI, Type } from "@google/genai";
import { Jurisdiction } from '../types';
import { JURISDICTIONS } from '../constants';

const normalizeDate = (raw: string): string => {
  if (!raw) return "";
  // Removes all non-digit characters
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 8) return digits; // MMDDCCYY
  
  // Try to parse if it's in a readable format
  try {
    const date = new Date(raw);
    if (!isNaN(date.getTime())) {
      const m = (date.getMonth() + 1).toString().padStart(2, '0');
      const d = date.getDate().toString().padStart(2, '0');
      const y = date.getFullYear().toString();
      return `${m}${d}${y}`;
    }
  } catch {}
  return digits.padEnd(8, '0').substring(0, 8);
};

export const preprocessImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const SCALE = 1200; // Increased resolution for better OCR
        let w = img.width, h = img.height;
        if (w > SCALE || h > SCALE) {
          const r = Math.min(SCALE/w, SCALE/h);
          w *= r; h *= r;
        }
        canvas.width = w; canvas.height = h;
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0,0,w,h);
          ctx.drawImage(img, 0, 0, w, h);
        }
        resolve(canvas.toDataURL('image/jpeg', 0.9).split(',')[1]);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  });
};

export const scanDLWithGemini = async (base64: string, apiKey: string): Promise<Record<string, string>> => {
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview', 
    contents: {
      parts: [
        { inlineData: { mimeType: 'image/jpeg', data: base64 } },
        { text: `Analyze the Driver's License/ID image. Extract data for AAMVA 2020 standard tags.
        Rules:
        - Dates (DBA, DBB, DBD) must be MMDDYYYY.
        - Sex (DBC): 1 for Male, 2 for Female.
        - Eye Color (DAY): 3-letter codes (e.g., BRO, BLU, GRN).
        - Height (DAU): format as FT-IN (e.g., 5'-11").
        - DDA: 'F' if has Gold Star (REAL ID), 'N' if not.
        - DDK: '1' if Organ Donor, '0' if not.
        Return ONLY valid JSON.` }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          DCS: { type: Type.STRING, description: "Last Name" },
          DAC: { type: Type.STRING, description: "First Name" },
          DAD: { type: Type.STRING, description: "Middle Name" },
          DCU: { type: Type.STRING, description: "Suffix" },
          DAQ: { type: Type.STRING, description: "ID Number" },
          DBB: { type: Type.STRING, description: "DOB" },
          DBA: { type: Type.STRING, description: "Expiry" },
          DBD: { type: Type.STRING, description: "Issue Date" },
          DAG: { type: Type.STRING, description: "Address" },
          DAI: { type: Type.STRING, description: "City" },
          DAJ: { type: Type.STRING, description: "State Code (2 chars)" },
          DAK: { type: Type.STRING, description: "Zip" },
          DBC: { type: Type.STRING, description: "Sex" },
          DAY: { type: Type.STRING, description: "Eyes" },
          DAU: { type: Type.STRING, description: "Height" },
          DCF: { type: Type.STRING, description: "Document Discriminator" },
          DDA: { type: Type.STRING, description: "REAL ID Indicator" },
          DDK: { type: Type.STRING, description: "Donor" }
        }
      }
    }
  });

  try {
    const raw = JSON.parse(response.text || "{}");
    const cleaned: Record<string, string> = {};
    Object.keys(raw).forEach(key => {
      let val = String(raw[key] || "").toUpperCase().trim();
      if (['DBA', 'DBB', 'DBD'].includes(key)) {
        val = normalizeDate(val);
      }
      cleaned[key] = val;
    });
    return cleaned;
  } catch (e) { 
    console.error("Gemini Parse Error:", e);
    throw new Error("Failed to parse AI response. Ensure image quality."); 
  }
};

export const detectJurisdictionFromCode = (code: string): Jurisdiction | null => {
  const c = (code || "").toUpperCase().substring(0, 2);
  return JURISDICTIONS.find(j => j.code === c && !j.name.includes("Old")) || null;
};
