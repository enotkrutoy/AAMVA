
import React, { useState, useRef, useEffect } from 'react';
import { JURISDICTIONS } from './constants';
import { Jurisdiction, DLFormData } from './types';
import { generateAAMVAString } from './utils/aamva';
import { preprocessImage, scanDLWithGemini, detectJurisdictionFromCode } from './utils/ocr';
import { validateAAMVAStructure } from './utils/validator';
import BarcodeCanvas from './components/BarcodeCanvas';
import { 
  ArrowLeft, Camera, Search, Settings, Key, Fingerprint,
  ShieldCheck, ClipboardCheck, Check, Info, User, Heart, AlertCircle
} from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<'SELECT' | 'FORM' | 'RESULT'>('SELECT');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<Jurisdiction | null>(null);
  const [generatedString, setGeneratedString] = useState<string>("");
  const [apiKey, setApiKey] = useState<string>("");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [filterText, setFilterText] = useState("");
  
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

  useEffect(() => {
    const key = localStorage.getItem('gemini_api_key') || (process.env.API_KEY || "");
    setApiKey(key);
  }, []);

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
    if (!apiKey) { setIsSettingsOpen(true); return; }
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
      alert(`AI Scan Failed: ${err.message || "Unknown error"}`);
    } finally {
      setIsScanning(false);
    }
  };

  const handleGenerate = () => {
    const str = generateAAMVAString(formData);
    setGeneratedString(str);
    setStep('RESULT');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/30">
      <header className="bg-slate-900/80 border-b border-slate-800 backdrop-blur-xl px-6 py-4 flex justify-between items-center sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {step !== 'SELECT' && (
            <button onClick={() => setStep('SELECT')} className="p-2 hover:bg-slate-800 rounded-full transition-colors text-sky-400">
              <ArrowLeft size={20}/>
            </button>
          )}
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Fingerprint className="text-sky-500" size={24} /> 
            AAMVA <span className="text-sky-500 tracking-tighter">2020 PRO</span>
          </h1>
        </div>
        <button onClick={() => setIsSettingsOpen(true)} className="p-2 hover:bg-slate-800 rounded-full text-slate-400"><Settings size={22} /></button>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-8">
        {step === 'SELECT' && (
          <div className="max-w-4xl mx-auto space-y-12 py-10">
            <div className="text-center space-y-4">
              <h2 className="text-6xl font-black tracking-tighter bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent">Compliance Master</h2>
              <p className="text-slate-400 text-lg">Генерация штрих-кодов по стандарту AAMVA 2020.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 hover:border-sky-500/50 transition-all cursor-pointer shadow-2xl" onClick={() => fileInputRef.current?.click()}>
                <Camera className="text-sky-500 mb-6" size={40} />
                <h3 className="text-2xl font-bold mb-2">AI Extraction</h3>
                <p className="text-slate-400 text-sm mb-6">Автозаполнение данных и определение штата по фото лицензии.</p>
                <div className="flex items-center gap-2 text-sky-400 text-xs font-bold uppercase tracking-widest">
                  {isScanning ? "Processing..." : "Start Scanning"} <ArrowLeft className="rotate-180" size={14}/>
                </div>
                <input type="file" ref={fileInputRef} onChange={handleImageScan} className="hidden" accept="image/*"/>
              </div>
              <div className="bg-slate-900/50 border border-slate-800 rounded-[2.5rem] p-8 flex flex-col justify-between shadow-2xl">
                <div>
                  <h3 className="text-2xl font-bold mb-4">Quick Templates</h3>
                  <div className="relative mb-6">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input placeholder="Search state..." className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-xs outline-none" onChange={e => setFilterText(e.target.value)}/>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {JURISDICTIONS.filter(j => j.name.toLowerCase().includes(filterText.toLowerCase())).slice(0, 6).map(j => (
                    <button key={j.name} onClick={() => handleSelectJurisdiction(j)} className="bg-slate-800/50 hover:bg-sky-600 p-3 rounded-xl text-[10px] font-bold transition-all truncate">{j.code}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'FORM' && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-3 bg-slate-900 rounded-[2.5rem] p-8 sm:p-12 border border-slate-800 shadow-2xl space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-800 pb-8">
                <div className="flex items-center gap-4">
                   <div className="bg-sky-500/10 p-4 rounded-2xl"><User className="text-sky-500" size={32} /></div>
                   <div>
                    <h3 className="text-3xl font-black tracking-tight">{selectedJurisdiction?.name}</h3>
                    <p className="text-sky-500 font-mono text-[10px] mt-1 uppercase tracking-tighter">AAMVA 2020 Compliance Profile</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setFormData({...formData, DDK: formData.DDK === '1' ? '0' : '1'})} className={`p-2 rounded-lg flex flex-col items-center transition-all ${formData.DDK === '1' ? 'bg-rose-500/20 text-rose-500' : 'bg-slate-800 text-slate-500'}`}>
                    <span className="text-[7px] font-black mb-1 uppercase">Donor</span>
                    <Heart size={16}/>
                  </button>
                  <button onClick={() => setFormData({...formData, DDA: formData.DDA === 'F' ? 'N' : 'F'})} className={`px-4 py-2 rounded-lg flex flex-col items-center transition-all ${formData.DDA === 'F' ? 'bg-amber-500 text-black' : 'bg-slate-800 text-slate-500'}`}>
                    <span className="text-[7px] font-black mb-1 uppercase">REAL ID</span>
                    <span className="text-[9px] font-bold uppercase">{formData.DDA === 'F' ? 'COMPLIANT' : 'NON-COMP'}</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                 {[
                   { label: "First Name", tag: "DAC" },
                   { label: "Middle", tag: "DAD" },
                   { label: "Last Name", tag: "DCS" },
                   { label: "Suffix", tag: "DCU" }
                 ].map(f => (
                   <div key={f.tag} className="space-y-2">
                     <label className="text-[9px] font-black text-slate-500 uppercase flex justify-between">{f.label} <span>{f.tag}</span></label>
                     <input value={formData[f.tag as keyof DLFormData]} onChange={e => setFormData({...formData, [f.tag]: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm outline-none focus:border-sky-500 transition-all" />
                   </div>
                 ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase flex justify-between">ID Number <span>DAQ</span></label>
                  <input value={formData.DAQ} onChange={e => setFormData({...formData, DAQ: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase flex justify-between">Audit Code (DD) <span>DCF</span></label>
                  <input value={formData.DCF} onChange={e => setFormData({...formData, DCF: e.target.value.toUpperCase()})} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-mono" />
                </div>
              </div>

              <div className="bg-slate-950/50 p-6 rounded-3xl border border-slate-800 space-y-4">
                <h4 className="text-[9px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-2"><AlertCircle size={12}/> Truncation Controls (AAMVA 2020)</h4>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { label: "Surname Trunc", tag: "DDE" },
                    { label: "First Trunc", tag: "DDF" },
                    { label: "Middle Trunc", tag: "DDG" }
                  ].map(t => (
                    <div key={t.tag} className="flex flex-col gap-2">
                      <span className="text-[8px] font-bold text-slate-600">{t.label}</span>
                      <select value={formData[t.tag as keyof DLFormData]} onChange={e => setFormData({...formData, [t.tag]: e.target.value})} className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-[10px] outline-none">
                        <option value="N">None (N)</option>
                        <option value="T">Truncated (T)</option>
                        <option value="U">Unknown (U)</option>
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <button onClick={handleGenerate} className="w-full bg-sky-600 hover:bg-sky-500 py-5 rounded-2xl font-black text-lg transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3">
                <ShieldCheck /> COMPILE COMPLIANT DATA STREAM
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-slate-900/50 rounded-3xl p-6 border border-slate-800 h-fit space-y-4">
                <h4 className="text-[10px] font-black text-sky-500 uppercase tracking-widest flex items-center gap-2"><Info size={14}/> 2020 STANDARD</h4>
                <div className="text-[11px] text-slate-400 leading-relaxed">
                  Поля <strong>DDE/DDF/DDG</strong> сообщают считывателю, что имя было урезано для печати на карте. Это критически важно для сверки с БД.
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'RESULT' && (
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="bg-white rounded-[3rem] p-10 text-slate-950 flex flex-col items-center gap-8 shadow-2xl">
              <div className="text-center">
                <h3 className="text-4xl font-black tracking-tighter">AAMVA PDF417</h3>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1">Version 2020 Compliant</p>
              </div>
              <BarcodeCanvas data={generatedString} />
              <div className="flex gap-4">
                <button onClick={() => window.print()} className="bg-slate-950 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all">PRINT</button>
                <button onClick={() => setStep('FORM')} className="bg-slate-100 text-slate-600 px-8 py-4 rounded-xl font-bold hover:bg-slate-200 transition-all">EDIT</button>
              </div>
            </div>
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800 font-mono text-[10px] break-all opacity-50">
              {generatedString}
            </div>
          </div>
        )}
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 w-full max-w-md rounded-[2rem] p-8 border border-slate-800 shadow-2xl space-y-6">
            <h3 className="text-2xl font-black flex items-center gap-3"><Key className="text-amber-400" /> API KEY REQUIRED</h3>
            <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="Gemini API Key" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white font-mono outline-none" />
            <button onClick={() => { localStorage.setItem('gemini_api_key', apiKey); setIsSettingsOpen(false); }} className="w-full bg-sky-600 hover:bg-sky-500 py-4 rounded-xl font-black">SAVE</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
