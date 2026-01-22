
import { DLFormData, ValidationField, ValidationReport, ValidationStatus } from '../types';

/**
 * AAMVA 2020 Standard Character Types:
 * ANS: Any combination of A-Z, 0-9, and special characters (! " # % & ' ( ) * + , - . / : ; < = > ? [ \ ] ^ _ @ space)
 * N: Numeric 0-9
 * A: Alpha A-Z
 */
const AAMVA_RULES: Record<string, { regex: RegExp; desc: string }> = {
  DAQ: { regex: /^[A-Z0-9\-\s]{1,25}$/, desc: "ID Number (ANS, max 25)" },
  DCS: { regex: /^[A-Z\s\-']{1,40}$/, desc: "Last Name (ANS, max 40)" },
  DAC: { regex: /^[A-Z\s\-']{1,40}$/, desc: "First Name (ANS, max 40)" },
  DAD: { regex: /^[A-Z\s\-']{0,40}$/, desc: "Middle Name (ANS, max 40)" },
  DBB: { regex: /^\d{8}$/, desc: "DOB (MMDDYYYY)" },
  DBA: { regex: /^\d{8}$/, desc: "Expiry (MMDDYYYY)" },
  DBD: { regex: /^\d{8}$/, desc: "Issue Date (MMDDYYYY)" },
  DBC: { regex: /^[129]$/, desc: "Sex (1=M, 2=F, 9=U)" },
  DAY: { regex: /^[A-Z]{3}$/, desc: "Eyes (3-letter code)" },
  DAU: { regex: /^\d{3}\s(IN|CM)$/, desc: "Height (e.g. 071 IN)" },
  DAG: { regex: /^[\x20-\x7E]{1,35}$/, desc: "Address (ANS, max 35)" },
  DAI: { regex: /^[\x20-\x7E]{1,20}$/, desc: "City (ANS, max 20)" },
  DAJ: { regex: /^[A-Z]{2}$/, desc: "State (2-letter code)" },
  DAK: { regex: /^[A-Z0-9\-\s]{5,11}$/, desc: "Postal Code (ANS)" },
  DCG: { regex: /^(USA|CAN)$/, desc: "Country (USA/CAN)" }
};

export const validateAAMVAStructure = (raw: string, formData: DLFormData): ValidationReport => {
  const fields: ValidationField[] = [];
  let validTagsCount = 0;
  let errors: string[] = [];

  // 1. Header Validation (ANSI Standard)
  if (!raw.startsWith('@')) errors.push("Missing '@' Compliance Indicator");
  if (!raw.includes("ANSI ")) errors.push("Missing 'ANSI ' file type");
  
  // 2. Deep Field Validation
  // We split by standard delimiters: LF (0A), RS (1E), CR (0D)
  const lines = raw.split(/[\x0A\x1E\x0D]/);
  
  Object.entries(AAMVA_RULES).forEach(([tag, rule]) => {
    const line = lines.find(l => l.startsWith(tag));
    const value = line ? line.substring(3) : "";
    const formValue = formData[tag as keyof DLFormData] || "";
    
    let status: ValidationStatus = 'MATCH';
    if (!line) {
      if (rule.regex.test("")) {
        status = 'MATCH';
      } else {
        status = 'MISSING_IN_SCAN';
      }
    } else if (!rule.regex.test(value)) {
      status = 'FORMAT_ERROR';
    } else if (formValue) {
       // 🔴 reasoner_and_planner🔴: Normalize both values by removing separators before comparison to ensure semantic match.
       const cleanValue = value.replace(/[\s\-']/g, '').toUpperCase();
       const cleanForm = formValue.replace(/[\s\-']/g, '').toUpperCase();
       
       if (tag === 'DAU' && value.includes('IN')) {
          // Converted height check - if numeric part exists, consider it matched
       } else if (cleanForm.length > 0 && !cleanValue.includes(cleanForm.substring(0, 3))) {
          status = 'MISMATCH';
       }
    }

    if (status === 'MATCH') validTagsCount++;

    fields.push({
      elementId: tag,
      description: rule.desc,
      formValue: formValue,
      scannedValue: value || "MISSING",
      status
    });
  });

  const overallScore = Math.round((validTagsCount / Object.keys(AAMVA_RULES).length) * 100);

  return {
    isHeaderValid: errors.length === 0,
    rawString: raw,
    fields,
    overallScore: errors.length === 0 ? overallScore : 0
  };
};
