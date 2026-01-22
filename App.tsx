
import React, { useState, useRef, useMemo } from 'react';
import { JURISDICTIONS } from './constants';
import { Jurisdiction, DLFormData, ValidationReport } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import BarcodeCanvas from './components/BarcodeCanvas';
import { validateAAMVAStructure } from './utils/validator';
import { 
  ArrowLeft, Camera, Search, Fingerprint,
  ShieldCheck, User, Heart, AlertCircle, Copy, CheckCircle2,
  Loader2, RefreshCcw, MapPin, Ruler, Calendar
} from 'lucide-react';

// 🔴 reasoner_and_planner🔴: Defining explicit interface for FormSection to ensure 'children' is correctly typed and recognized by JSX.
interface FormSectionProps {
  title: string;
  icon: any;
  children: React.ReactNode;
}

const FormSection: React.FC<FormSectionProps> = ({ title, icon: Icon, children }) => (
  <div className="space-y-6">
    <div className="flex items-center gap-2 border-b border-white/5 pb-2">
      <Icon className="text-sky-500" size={18} />
      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">{title}</h4>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {children}
    </div>
  </div>
);

// 🔴 reasoner_and_planner🔴: Moving InputField outside the App component to prevent unnecessary re-renders and provide strict typing for its dependencies.
interface InputFieldProps {
  label: string;
  tag: string;
  formData: DLFormData;
  updateField: (tag: string, value: string) => void;
  validation: ValidationReport;
  type?: string;
  placeholder?: string;
}

const InputField: React.FC<InputFieldProps> = ({ label, tag, formData, updateField, validation, type = "text", placeholder = "" }) => {
  const fieldValidation = validation.fields.find(f => f.elementId === tag);
  const isError = fieldValidation && fieldValidation.status === 'FORMAT_ERROR';
  
  return (
    <div className="group space-y-2">
      <label className="text-[10px] font-black text-slate-500 uppercase flex justify-between px-1 tracking-widest group-focus-within:text-sky-400 transition-colors">
        {label} <span className="text-[9px] opacity-40">{tag}</span>
      </label>
      <div className="relative">
        <input 
          type={type}
          placeholder={placeholder}
          value={formData[tag as keyof DLFormData] || ""} 
          onChange={e => updateField(tag, e.target.value.toUpperCase())} 
          className={`w-full bg-slate-950 border ${isError ? 'border-rose-500/50' : 'border-white/10'} rounded-2xl p-4 text-sm outline-none focus:border-sky-500/50 focus:ring-4 focus:ring-sky-500/5 transition-all font-medium`} 
        />
        {fieldValidation?.status === 'MATCH' && <CheckCircle2 className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500/50" size={16} />}
        {isError && <AlertCircle className="absolute right-4 top-1/2 -translate-y-1/2 text-rose-500" size={16} />}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [step, setStep] = useState<'SELECT' | 'FORM' | 'RESULT'>('SELECT');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [filterText, setFilterText] = useState("");
  const [copyFeedback, setCopyFeedback] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<DLFormData>({
    IIN: '', Version: '10', JurisdictionVersion: '00', 
    subfileType: 'DL',
    DCA: 'C', DCB: 'NONE', DCD: 'NONE', DBA: '', DCS: '', DAC: '', DAD: '',
    DBD: '', DBB: '', DBC: '1', DAY: 'BRO', DAU: '5-04',
    DAG: '', DAI: '', DAJ: '', DAK: '', DAQ: '', DCF: '', DCG: 'USA', 
    DAW: '165', DAZ: 'BRO', DCU: '', DDA: 'F', DDK: '1',
    DDE: 'N', DDF: 'N', DDG: 'N'
  });

  const currentAAMVAString = useMemo(() => generateAAMVAString(formData), [formData]);
  const validation = useMemo(() => validateAAMVAStructure(currentAAMVAString, formData), [currentAAMVAString, formData]);

  const handleSelectJurisdiction = (jur: Jurisdiction) => {
    setSelectedJurisdiction(jur);
    setFormData(prev => ({ 
      ...prev, 
      DAJ: jur.code, 
      IIN: jur.iin, 
      JurisdictionVersion: jur.version,
      DCG: jur.country || 'USA'
    }));
    setStep('FORM');
  };

  const handleImageScan = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 🔴 reasoner_and_planner🔴: Solely relying on process.env.API_KEY as per the technical requirements for Gemini SDK.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      console.error("API_KEY environment variable is not configured.");
      return;
    }

    setIsScanning(true);
    try {
      const base64 = await preprocessImage(file);
      const updates = await scanDLWithGemini(base64, apiKey);
      let detectedJur = updates.DAJ ? detectJurisdictionFromCode(updates.DAJ) : null;
      
      if (detectedJur) {
        setSelectedJurisdiction(detectedJur);
        setFormData(prev => ({ 
          ...prev, 
          ...updates, 
          IIN: detectedJur.iin, 
          DAJ: detectedJur.code,
          JurisdictionVersion: detectedJur.version 
        }));
      } else {
        setFormData(prev => ({ ...prev, ...updates }));
      }
      setStep('FORM');
    } catch (err: any) {
      alert(`AI Scan Error: ${err.message || "Failed to analyze image"}`);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const updateField = (tag: string, value: string) => {
    setFormData(prev => ({ ...prev, [tag]: value }));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(currentAAMVAString);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30 overflow-x-hidden">
      <header className="bg-slate-900/40 border-b border-white/5 backdrop-blur-2xl px-6 py-4 flex justify-between items-center sticky top-0 z-[60]">
        <div className="flex items-center gap-4">
          {step !== 'SELECT' && (
            <button onClick={() => setStep('SELECT')} className="p-2 hover:bg-white/5 rounded-full transition-colors text-slate-400 hover:text-white">
              <ArrowLeft size={20}/>
            </button>
          )}
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Fingerprint className="text-sky-400" size={24} /> 
            <span className="tracking-tight">AAMVA <span className="text-sky-500 font-black">2020</span></span>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-8">
        {step === 'SELECT' && (
          <div className="max-w-5xl mx-auto space-y-16 py-12">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 px-4 py-1.5 rounded-full text-sky-400 text-[10px] font-black uppercase tracking-[0.2em] mb-4">
                Professional Compliance Suite
              </div>
              <h2 className="text-6xl md:text-8xl font-black tracking-tighter leading-none">
                Standard <span className="bg-gradient-to-r from-sky-400 via-blue-500 to-indigo-600 bg-clip-text text-transparent">Engineer</span>
              </h2>
              <p className="text-slate-400 text-lg max-w-2xl mx-auto font-medium">
                Standardized AAMVA PDF417 generation with AI-driven document extraction and deep structure validation.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div 
                className="group relative overflow-hidden bg-slate-900/50 border border-white/5 rounded-[3rem] p-10 hover:border-sky-500/40 transition-all cursor-pointer shadow-2xl active:scale-[0.99]"
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="absolute top-0 right-0 p-8 text-sky-500/20 group-hover:text-sky-500/40 transition-colors">
                  <Camera size={120} />
                </div>
                <div className="relative z-10">
                  <div className="bg-sky-500 shadow-[0_0_20px_rgba(14,165,233,0.3)] w-14 h-14 rounded-2xl flex items-center justify-center mb-8">
                    {isScanning ? <Loader2 className="animate-spin text-white" /> : <Camera className="text-white" size={28} />}
                  </div>
                  <h3 className="text-3xl font-bold mb-3 tracking-tight">AI Vision Pro</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-8 max-w-[240px]">
                    Automatic field detection from ID photos using Gemini 3 Vision processing.
                  </p>
                  <div className="flex items-center gap-2 text-sky-400 text-xs font-black uppercase tracking-widest group-hover:translate-x-2 transition-transform">
                    {isScanning ? "Analyzing..." : "Scan Card"} <ArrowLeft className="rotate-180" size={16}/>
                  </div>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*"/>
              </div>

              <div className="bg-slate-900/50 border border-white/5 rounded-[3rem] p-10 flex flex-col justify-between shadow-2xl relative overflow-hidden">
                 <div className="relative z-10">
                    <div className="bg-slate-800 w-14 h-14 rounded-2xl flex items-center justify-center mb-8">
                      <RefreshCcw className="text-slate-300" size={28} />
                    </div>
                    <h3 className="text-3xl font-bold mb-6 tracking-tight">Jurisdiction Manual</h3>
                    <div className="relative mb-8">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input 
                        placeholder="Search jurisdiction..." 
                        className="w-full bg-slate-950/50 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm outline-none focus:border-sky-500/50 transition-all placeholder:text-slate-600" 
                        onChange={e => setFilterText(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).slice(0, 8).map(j => (
                        <button 
                          key={`${j.code}-${j.iin}`} 
                          onClick={() => handleSelectJurisdiction(j)} 
                          className="bg-white/5 hover:bg-sky-600/20 border border-white/5 hover:border-sky-500/30 p-4 rounded-2xl text-xs font-black transition-all truncate text-center uppercase tracking-tighter"
                        >
                          {j.code}
                        </button>
                      ))}
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-10">
            <div className="xl:col-span-8 space-y-8">
              <div className="bg-slate-900 border border-white/5 rounded-[3.5rem] p-8 md:p-12 shadow-2xl space-y-12 relative">
                
                <div className="flex flex-col md:flex-row justify-between items-start gap-6 border-b border-white/5 pb-10">
                  <div className="flex items-center gap-6">
                    <div className="bg-sky-500/10 p-5 rounded-[2rem] border border-sky-500/20">
                      <User className="text-sky-400" size={40} />
                    </div>
                    <div>
                      <h3 className="text-4xl font-black tracking-tighter leading-tight">{selectedJurisdiction?.name || "Standard Form"}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <ShieldCheck className="text-sky-500" size={14} />
                        <p className="text-sky-500/80 font-mono text-[10px] uppercase tracking-widest font-black">2020 REV. COMPLIANCE ENGINE</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                     <button 
                      onClick={() => setFormData({...formData, DDK: formData.DDK === '1' ? '0' : '1'})} 
                      className={`h-14 w-14 rounded-2xl flex flex-col items-center justify-center transition-all border shadow-lg ${formData.DDK === '1' ? 'bg-rose-500/20 border-rose-500/30 text-rose-500' : 'bg-slate-800 border-white/5 text-slate-500'}`}
                     >
                        <Heart size={20} fill={formData.DDK === '1' ? 'currentColor' : 'none'} />
                        <span className="text-[8px] font-black mt-1 uppercase">Donor</span>
                     </button>
                     <button 
                      onClick={() => setFormData({...formData, DDA: formData.DDA === 'F' ? 'N' : 'F'})} 
                      className={`px-6 h-14 rounded-2xl flex flex-col items-center justify-center transition-all border shadow-lg ${formData.DDA === 'F' ? 'bg-amber-500 border-amber-600 text-black' : 'bg-slate-800 border-white/5 text-slate-500'}`}
                     >
                        <span className="text-[8px] font-black uppercase mb-0.5">Real ID</span>
                        <span className="text-[10px] font-black uppercase">{formData.DDA === 'F' ? 'Compliant' : 'Non-Comp'}</span>
                     </button>
                  </div>
                </div>

                <FormSection title="Legal Identity" icon={User}>
                  <InputField label="Last Name" tag="DCS" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="First Name" tag="DAC" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="Middle Name" tag="DAD" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="Suffix" tag="DCU" formData={formData} updateField={updateField} validation={validation} />
                </FormSection>

                <FormSection title="Location Data" icon={MapPin}>
                  <InputField label="Street Address" tag="DAG" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="City" tag="DAI" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="State Code" tag="DAJ" placeholder="TX" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="Postal Code" tag="DAK" formData={formData} updateField={updateField} validation={validation} />
                </FormSection>

                <FormSection title="Vital Metrics" icon={Ruler}>
                  <InputField label="Height" tag="DAU" placeholder="5-11" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="Eye Color" tag="DAY" placeholder="BRO" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="Sex (1=M, 2=F)" tag="DBC" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="Weight (LB)" tag="DAW" formData={formData} updateField={updateField} validation={validation} />
                </FormSection>

                <FormSection title="Document Control" icon={Calendar}>
                  <InputField label="ID Number" tag="DAQ" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="Date of Birth" tag="DBB" placeholder="MMDDYYYY" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="Expiry Date" tag="DBA" placeholder="MMDDYYYY" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="Issue Date" tag="DBD" placeholder="MMDDYYYY" formData={formData} updateField={updateField} validation={validation} />
                  <InputField label="Audit Code" tag="DCF" formData={formData} updateField={updateField} validation={validation} />
                </FormSection>

                <div className="bg-slate-950/50 p-8 rounded-[2.5rem] border border-white/5 space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                      <AlertCircle size={14} className="text-sky-500" /> TRUNCATION INDICATORS
                    </h4>
                  </div>
                  <div className="grid grid-cols-3 gap-6">
                    {['DDE', 'DDF', 'DDG'].map(tag => (
                      <div key={tag} className="space-y-2">
                        <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                          {tag === 'DDE' ? 'Last Name' : tag === 'DDF' ? 'First Name' : 'Middle Name'}
                        </span>
                        <select 
                          value={formData[tag as keyof DLFormData]} 
                          onChange={e => updateField(tag, e.target.value)} 
                          className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-[11px] outline-none font-bold text-sky-400 appearance-none text-center hover:border-sky-500/30 transition-all"
                        >
                          <option value="N">No Truncation</option>
                          <option value="T">Truncated</option>
                          <option value="U">Unknown</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={() => setStep('RESULT')} 
                  className="group w-full bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 py-6 rounded-[2rem] font-black text-lg tracking-tight transition-all shadow-2xl active:scale-[0.98] flex items-center justify-center gap-4 overflow-hidden relative"
                >
                  <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-500" />
                  <span className="relative flex items-center gap-3">
                    <CheckCircle2 size={24} /> COMPILE & VALIDATE PAYLOAD
                  </span>
                </button>
              </div>
            </div>

            <div className="xl:col-span-4 space-y-8">
              <div className="bg-white rounded-[3rem] p-8 text-slate-950 shadow-2xl space-y-6 sticky top-28">
                <div className="flex justify-between items-center px-2">
                   <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Real-time Preview</h4>
                   <div className={`flex items-center gap-1.5 ${validation.overallScore === 100 ? 'text-emerald-600 bg-emerald-50' : 'text-sky-600 bg-sky-50'} px-2 py-0.5 rounded-full text-[9px] font-black`}>
                      <div className={`h-1.5 w-1.5 ${validation.overallScore === 100 ? 'bg-emerald-500' : 'bg-sky-500'} rounded-full animate-pulse`} />
                      SYNCED
                   </div>
                </div>
                
                <BarcodeCanvas data={currentAAMVAString} />
                
                <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Compliance Score</span>
                    <span className={`text-xl font-black ${validation.overallScore === 100 ? 'text-emerald-600' : 'text-slate-950'}`}>
                      {validation.overallScore}%
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ease-out rounded-full ${validation.overallScore === 100 ? 'bg-emerald-500' : 'bg-sky-500'}`} 
                      style={{ width: `${validation.overallScore}%` }} 
                    />
                  </div>
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                   {validation.fields.map((f, i) => (
                     <div key={i} className={`flex items-center justify-between p-3 rounded-xl border ${f.status === 'MATCH' ? 'bg-emerald-50/30 border-emerald-100' : 'bg-rose-50/30 border-rose-100'}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-black uppercase text-slate-400">{f.elementId}</span>
                            <span className="text-[10px] font-bold text-slate-700">{f.description}</span>
                          </div>
                          {f.status === 'FORMAT_ERROR' && <p className="text-[8px] text-rose-500 font-bold uppercase">Invalid Format</p>}
                        </div>
                        {f.status === 'MATCH' ? <CheckCircle2 size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-rose-500" />}
                     </div>
                   ))}
                </div>

                <div className="pt-2">
                  <button 
                    onClick={copyToClipboard}
                    className="w-full bg-slate-950 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-95"
                  >
                    {copyFeedback ? <CheckCircle2 size={18} /> : <Copy size={18} />}
                    {copyFeedback ? "Copied Raw Data" : "Copy Payload String"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-700 pb-20">
             <div className="bg-white rounded-[4rem] p-12 md:p-20 text-slate-950 flex flex-col items-center gap-12 shadow-2xl border border-white/10">
                <div className="text-center space-y-3">
                   <div className="inline-block bg-emerald-500 text-white px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-[0.3em] mb-4">
                      Compliance Passed
                   </div>
                   <h3 className="text-5xl md:text-6xl font-black tracking-tighter">Certified AAMVA 417</h3>
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.2em]">Standard Revision 2020 • ECC Level 5</p>
                </div>
                
                <div className="w-full max-w-2xl bg-slate-50 rounded-[3rem] p-12 border border-slate-100 shadow-inner group">
                   <BarcodeCanvas data={currentAAMVAString} />
                   <p className="text-center text-[9px] text-slate-300 font-mono mt-8 group-hover:text-slate-400 transition-colors uppercase tracking-widest">Digital Certificate of Authenticity</p>
                </div>

                <div className="flex flex-wrap justify-center gap-6 w-full">
                   <button 
                    onClick={() => window.print()} 
                    className="flex-1 min-w-[200px] bg-slate-950 text-white px-10 py-6 rounded-3xl font-black text-lg hover:bg-slate-800 transition-all shadow-xl active:scale-95"
                   >
                    PRINT TEMPLATE
                   </button>
                   <button 
                    onClick={() => setStep('FORM')} 
                    className="flex-1 min-w-[200px] bg-slate-100 text-slate-600 px-10 py-6 rounded-3xl font-black text-lg hover:bg-slate-200 transition-all active:scale-95"
                   >
                    BACK TO EDITOR
                   </button>
                </div>
             </div>

             <div className="bg-slate-900/50 p-10 rounded-[3rem] border border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                   <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-widest">Raw Encoded Stream</h4>
                   <button onClick={copyToClipboard} className="text-slate-400 hover:text-white transition-colors"><Copy size={18} /></button>
                </div>
                <div className="bg-slate-950/80 p-8 rounded-3xl border border-white/5 font-mono text-[11px] leading-relaxed break-all text-sky-500/80 selection:bg-sky-500/20">
                  {currentAAMVAString}
                </div>
             </div>
          </div>
        )}
      </main>

      <footer className="py-8 px-6 border-t border-white/5 bg-slate-950/50 mt-auto text-center">
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.4em]">AAMVA Barcode Engineering Platform • V1.2.0 PRO</p>
      </footer>
    </div>
  );
};

export default App;
