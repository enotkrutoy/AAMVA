
import { DLFormData } from '../types';

const LF = "\x0A";
const RS = "\x1E";
const CR = "\x0D";

const formatHeight = (h: string) => {
  const parts = h.split(/['-]/);
  if (parts.length >= 2) {
    const feet = parseInt(parts[0], 10) || 0;
    const inches = parseInt(parts[1], 10) || 0;
    const totalInches = (feet * 12) + inches;
    return `${totalInches.toString().padStart(3, '0')} IN`;
  }
  const digits = h.replace(/\D/g, '');
  return digits.length > 0 ? `${digits.padStart(3, '0')} IN` : "unavl";
};

const formatWeight = (w: string) => {
  const digits = w.replace(/\D/g, '');
  return digits.length > 0 ? `${digits.padStart(3, '0')} LB` : "unavl";
};

const sanitize = (val: string, placeholder = "NONE") => {
  const cleaned = (val || "").toUpperCase().replace(/[^\x20-\x7E]/g, "").trim();
  if (!cleaned) return placeholder === "NONE" ? "NONE" : "unavl";
  return cleaned;
};

export const generateAAMVAString = (data: DLFormData): string => {
  const subfields: string[] = [];
  const add = (tag: string, val: string, isMandatory = true) => {
    let cleanVal = "";
    if (tag === "DAU") cleanVal = formatHeight(val);
    else if (tag === "DAW") cleanVal = formatWeight(val);
    else cleanVal = sanitize(val, isMandatory ? "NONE" : "unavl");
    
    if (cleanVal || isMandatory) subfields.push(`${tag}${cleanVal}`);
  };

  // Mandatory Elements (Table D.3)
  add("DCA", data.DCA || "C");
  add("DCB", data.DCB);
  add("DCD", data.DCD);
  add("DBA", data.DBA);
  add("DCS", data.DCS);
  add("DAC", data.DAC);
  add("DAD", data.DAD);
  add("DBD", data.DBD);
  add("DBB", data.DBB);
  add("DBC", data.DBC);
  add("DAY", data.DAY);
  add("DAU", data.DAU);
  add("DAG", data.DAG);
  add("DAI", data.DAI);
  add("DAJ", data.DAJ);
  add("DAK", data.DAK);
  add("DAQ", data.DAQ);
  add("DCF", data.DCF);
  add("DCG", data.DCG || "USA");
  
  // Optional Elements (Table D.4)
  if (data.DCU) add("DCU", data.DCU, false);
  if (data.DDA) add("DDA", data.DDA, false);
  if (data.DDK) add("DDK", data.DDK, false);
  add("DAW", data.DAW, false);
  add("DAZ", data.DAZ, false);

  // Mandatory Truncation Indicators for 2020 Standard
  add("DDE", data.DDE || "N");
  add("DDF", data.DDF || "N");
  add("DDG", data.DDG || "N");

  const subfileType = data.subfileType || "DL";
  const subfileBody = subfields.join(LF) + CR;
  const fullSubfile = subfileType + subfileBody;

  const header = "@" + LF + RS + CR + "ANSI " + 
                 (data.IIN || "636000").substring(0, 6).padEnd(6, '0') + 
                 "10" + (data.JurisdictionVersion || "00").padStart(2, '0') + "01";

  const designator = subfileType + "0031" + fullSubfile.length.toString().padStart(4, '0');

  return header + designator + fullSubfile;
};
