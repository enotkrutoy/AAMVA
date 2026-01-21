
import React, { useState, useRef, useMemo } from 'react';
import { JURISDICTIONS } from './constants';
import { Jurisdiction, DLFormData } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import BarcodeCanvas from './components/BarcodeCanvas';
import { 
  ArrowLeft, Camera, Search, Fingerprint,
  ShieldCheck, Check, Info, User, Heart, AlertCircle, Loader2, Zap, Terminal,
  Layout
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'SELECT' | 'FORM' | 'RESULT'>('SELECT');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [filterText, setFilterText] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState<DLFormData>({
    IIN: '', Version: '10', JurisdictionVersion: '00', subfileType: 'DL',
    DCA: 'C', DCB: 'NONE', DCD: 'NONE', DBA: '', DCS: '', DAC: '', DAD: '',
    DBD: '', DBB: '', DBC: '1', DAY: 'BRO', DAU: '5-04',
    DAG: '', DAI: '', DAJ: '', DAK: '', DAQ: '', DCF: '', DCG: 'USA', 
    DAW: '165', DAZ: 'BRO', DCU: '', DDA: 'F', DDK: '1',
    DDE: 'N', DDF: 'N', DDG: 'N'
  });

  const generatedString = useMemo(() => generateAAMVAString(formData), [formData]);

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
    setIsScanning(true);
    try {
      const base64 = await preprocessImage(file);
      const updates = await scanDLWithGemini(base64);
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
      alert(`AI Error: ${err.message || "Could not extract data"}`);
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const InputField = ({ label, tag, placeholder = "" }: { label: string, tag: keyof DLFormData, placeholder?: string }) => (
    <div className="space-y-1.5 group">
      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest group-focus-within:text-sky-400 transition-colors flex justify-between">
        {label} <span className="font-mono text-slate-700">{tag}</span>
      </label>
      <input 
        value={formData[tag] || ""} 
        placeholder={placeholder}
        onChange={e => setFormData({...formData, [tag]: e.target.value.toUpperCase()})} 
        className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-sm font-semibold outline-none focus:border-sky-500/50 focus:bg-slate-900/50 transition-all placeholder:text-slate-700" 
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      <header className="bg-slate-900/40 border-b border-slate-800 backdrop-blur-2xl px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {step !== 'SELECT' && (
            <button onClick={() => setStep('SELECT')} className="p-2 hover:bg-white/10 rounded-full transition-all text-sky-400">
              <ArrowLeft size={20}/>
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="bg-sky-600 p-1 rounded-lg">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <h1 className="text-lg font-black tracking-tighter uppercase">MATRIX <span className="text-sky-500 italic">PRO 2025</span></h1>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
           <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
           <span className="text-[9px] font-black uppercase text-emerald-500">System Ready</span>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8">
        {step === 'SELECT' && (
          <div className="max-w-4xl mx-auto space-y-12 py-10">
            <div className="text-center space-y-4">
              <h2 className="text-6xl font-black tracking-tighter bg-gradient-to-b from-white via-white to-slate-600 bg-clip-text text-transparent italic">Vector Kernel</h2>
              <p className="text-slate-400 text-lg max-w-xl mx-auto">Элитный генератор PDF417 штрих-кодов, полностью соответствующий стандарту AAMVA 2020.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div 
                className={`group relative bg-slate-900/50 border rounded-[3rem] p-10 transition-all cursor-pointer shadow-2xl overflow-hidden ${isScanning ? 'border-sky-500/50' : 'border-slate-800 hover:border-sky-500/40'}`}
                onClick={() => !isScanning && fileInputRef.current?.click()}
              >
                <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity"><Terminal size={120} /></div>
                <div className="w-14 h-14 rounded-2xl bg-sky-500/10 flex items-center justify-center mb-8 border border-sky-500/20 shadow-[0_0_20px_rgba(14,165,233,0.15)]">
                  {isScanning ? <Loader2 size={28} className="text-sky-500 animate-spin" /> : <Camera className="text-sky-500" size={28} />}
                </div>
                <h3 className="text-3xl font-black mb-3 italic">AI Scan</h3>
                <p className="text-slate-400 text-sm leading-relaxed mb-8">Используйте нейронную сеть для мгновенного извлечения данных с фотографии DL/ID.</p>
                <div className="flex items-center gap-2 text-sky-400 text-xs font-black uppercase tracking-widest">
                  {isScanning ? "Processing Link..." : "Start Capture"} <Check size={16}/>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*" />
              </div>

              <div className="bg-slate-900/30 border border-slate-800 rounded-[3rem] p-10 flex flex-col justify-between shadow-2xl backdrop-blur-sm">
                <div>
                  <h3 className="text-3xl font-black mb-6 italic">Jurisdiction</h3>
                  <div className="relative mb-6">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                    <input 
                      placeholder="Search state node..." 
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold outline-none focus:border-sky-500/50 transition-all" 
                      onChange={e => setFilterText(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 overflow-y-auto max-h-[160px] pr-2 scrollbar-hide">
                  {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).map(j => (
                    <button key={j.name} onClick={() => handleSelectJurisdiction(j)} className="bg-slate-800/40 hover:bg-sky-600 border border-white/5 p-3 rounded-xl text-[10px] font-black transition-all flex flex-col items-center gap-1">
                      <span className="text-sky-400 group-hover:text-white transition-colors">{j.code}</span>
                      <span className="text-[7px] text-slate-500 uppercase truncate w-full text-center">{j.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 animate-in fade-in zoom-in-95 duration-500">
            <div className="lg:col-span-3 bg-slate-900/60 rounded-[3.5rem] p-8 sm:p-12 border border-slate-800 shadow-2xl space-y-10 backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-800 pb-10">
                <div className="flex items-center gap-6">
                   <div className="bg-sky-500/10 p-5 rounded-[1.5rem] border border-sky-500/20"><User className="text-sky-500" size={32} /></div>
                   <div>
                    <h3 className="text-4xl font-black tracking-tight italic">{selectedJurisdiction?.name}</h3>
                    <div className="flex items-center gap-3 mt-2">
                       <span className="bg-sky-600 text-white px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider italic">V.{formData.JurisdictionVersion} REV</span>
                       <span className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">{formData.DCG} Region</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button onClick={() => setFormData({...formData, DDK: formData.DDK === '1' ? '0' : '1'})} className={`p-3.5 rounded-[1.2rem] flex flex-col items-center gap-1.5 transition-all border ${formData.DDK === '1' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]' : 'bg-slate-800/50 text-slate-500 border-transparent'}`}>
                    <span className="text-[7px] font-black uppercase tracking-widest">Donor</span>
                    <Heart size={18} className={formData.DDK === '1' ? "fill-rose-500" : ""} />
                  </button>
                  <button onClick={() => setFormData({...formData, DDA: formData.DDA === 'F' ? 'N' : 'F'})} className={`px-6 py-3 rounded-[1.2rem] flex flex-col items-center gap-1.5 transition-all border ${formData.DDA === 'F' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : 'bg-slate-800/50 text-slate-500 border-transparent'}`}>
                    <span className="text-[7px] font-black uppercase tracking-widest">Real ID</span>
                    <span className="text-[10px] font-black italic">{formData.DDA === 'F' ? 'COMPLIANT' : 'LEGACY'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 <InputField label="First Name" tag="DAC" />
                 <InputField label="Middle" tag="DAD" />
                 <InputField label="Last Name" tag="DCS" />
                 <InputField label="ID Number" tag="DAQ" />
                 <InputField label="Birth Date" tag="DBB" placeholder="YYYYMMDD" />
                 <InputField label="Expiry" tag="DBA" placeholder="YYYYMMDD" />
                 <div className="lg:col-span-3">
                    <InputField label="Address Line 1" tag="DAG" />
                 </div>
                 <InputField label="City" tag="DAI" />
                 <InputField label="Zip" tag="DAK" />
                 <InputField label="Audit Code" tag="DCF" />
              </div>

              <button onClick={() => setStep('RESULT')} className="w-full bg-sky-600 hover:bg-sky-500 py-6 rounded-[2.5rem] font-black text-xl transition-all shadow-[0_20px_50px_rgba(8,145,178,0.3)] flex items-center justify-center gap-4 group italic">
                <ShieldCheck className="group-hover:rotate-12 transition-transform" /> COMPILE BITSTREAM
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 space-y-6 shadow-xl">
                 <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-[0.2em] italic flex items-center gap-2"><Fingerprint size={14}/> Node Security</h4>
                 <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                       <span className="text-[10px] font-bold text-slate-400">AAMVA Rev.</span>
                       <span className="text-[10px] font-black text-white font-mono">2020</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-xl border border-slate-800">
                       <span className="text-[10px] font-bold text-slate-400">Subfile</span>
                       <span className="text-[10px] font-black text-sky-500 font-mono">ANSI_DL</span>
                    </div>
                 </div>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-[2.5rem] p-8 space-y-4 shadow-xl">
                 <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] italic flex items-center gap-2"><Info size={14}/> Validation</h4>
                 <p className="text-[11px] text-slate-500 leading-relaxed font-medium italic">
                    Алгоритм автоматической усечки (DDE/DDF/DDG) будет применен в финальном потоке для совместимости со старыми считывателями.
                 </p>
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-10 duration-700">
            <div className="flex justify-between items-end border-b border-slate-800 pb-8">
              <div className="space-y-2">
                <h2 className="text-4xl font-black tracking-tighter italic">Compiled Matrix</h2>
                <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 italic">Node Verified</span>
              </div>
              <button onClick={() => setStep('FORM')} className="flex items-center gap-2 px-8 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl text-xs font-black uppercase tracking-widest transition-all">Modify Core</button>
            </div>

            <div className="bg-white rounded-[4rem] p-12 text-slate-950 flex flex-col items-center gap-12 shadow-[0_50px_100px_rgba(0,0,0,0.5)] border-4 border-slate-200">
              <div className="text-center space-y-3">
                <h3 className="text-5xl font-black tracking-tighter uppercase italic text-slate-900 flex items-center gap-4">
                   <Layout className="text-sky-600" size={40} /> PDF417 Master
                </h3>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono italic">AAMVA_2020_REV_1</span>
                  <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                  <span className="text-[10px] font-black text-sky-600 uppercase tracking-widest font-mono italic">{selectedJurisdiction?.code} NODE</span>
                </div>
              </div>
              
              <BarcodeCanvas data={generatedString} />

              <div className="flex gap-4 w-full max-w-lg">
                 <button onClick={() => window.print()} className="flex-1 bg-slate-950 text-white py-6 rounded-[2.5rem] font-black text-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-4 group italic shadow-xl">
                    <Check size={24} className="group-hover:translate-y-[-2px] transition-transform" /> Print Master
                 </button>
                 <button onClick={() => { navigator.clipboard.writeText(generatedString); alert("Copied to clipboard!"); }} className="flex-1 bg-sky-100 text-sky-600 py-6 rounded-[2.5rem] font-black text-xl hover:bg-sky-200 transition-all flex items-center justify-center gap-4 italic shadow-xl">
                    <Terminal size={24} /> Copy Raw
                 </button>
              </div>
            </div>

            <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-[2.5rem] font-mono text-[10px] break-all leading-relaxed text-sky-400/80 shadow-inner">
               <div className="text-[8px] font-black uppercase text-slate-700 mb-4 tracking-[0.3em]">Neural Bitstream Log</div>
               {generatedString}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
