import React, { useState } from 'react';
import { Site, InspectionLog, RiskLevel, Role } from '../types';
import { Camera, CheckSquare, Upload, X, Maximize2, AlertTriangle, MapPin, Hammer, ShieldCheck } from 'lucide-react';
import { analyzeSafetyPhoto } from '../services/aiService';

interface FieldWorkProps {
  siteId: string | null;
  sites: Site[];
  currentRole: Role;
  onSubmitInspection: (log: Omit<InspectionLog, 'id'>) => void;
  onCancel: () => void;
}

const FieldWork: React.FC<FieldWorkProps> = ({ siteId, sites, currentRole, onSubmitInspection, onCancel }) => {
  // Form State
  const [photos, setPhotos] = useState<string[]>([]);
  const [workType, setWorkType] = useState('');
  const [notes, setNotes] = useState('');
  const [risk, setRisk] = useState<RiskLevel>(RiskLevel.NORMAL);
  const [checklist, setChecklist] = useState({
    ppe: false, fireSafety: false, environment: false, electrical: false
  });
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Get Site Info
  const site = sites.find(s => s.id === siteId);

  if (!site) {
      return (
          <div className="flex flex-col items-center justify-center h-[60vh] text-slate-500">
              <p>현장 정보를 찾을 수 없습니다.</p>
              <button onClick={onCancel} className="mt-4 px-6 py-2 bg-slate-800 text-white rounded-lg">목록으로 돌아가기</button>
          </div>
      )
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsAnalyzing(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        if (ev.target?.result) {
          const base64 = ev.target.result as string;
          setPhotos(prev => [...prev, base64]);
          
          // Simple AI analysis for the first photo to suggest risk
          if (photos.length === 0) {
             const analysis = await analyzeSafetyPhoto(base64);
             if (analysis.risk === '경고') setRisk(RiskLevel.WARNING);
             if (analysis.risk === '주의') setRisk(RiskLevel.CAUTION);
             if (analysis.description && !notes) setNotes(analysis.description); 
          }
          setIsAnalyzing(false);
        }
      };
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const handleSubmit = () => {
    // 작업 내용 입력 검증은 안전팀에게만 적용
    if (currentRole === Role.SAFETY && !workType.trim()) {
        alert("금일 주요 진행 작업 내용을 입력해주세요.");
        return;
    }

    const inspectorName = currentRole === Role.FACILITY ? "시설 담당자" : "안전 관리자";

    const newLog: Omit<InspectionLog, 'id'> = {
      siteId: site.id,
      siteName: site.name,
      workType: workType, // 시설팀일 경우 빈 문자열로 전송됨
      timestamp: Date.now(),
      photos,
      riskLevel: risk,
      notes,
      inspector: inspectorName,
      inspectorRole: currentRole, // Save which team did this
      checklist
    };

    onSubmitInspection(newLog);
    alert("점검 결과가 저장되었습니다.");
    onCancel(); // Return to main screen
  };

  return (
    <div className="px-4 py-6 animate-in slide-in-from-bottom-4 pb-24">
      {/* Header Info */}
      <div className={`text-white p-5 rounded-2xl shadow-lg mb-6 ${currentRole === Role.SAFETY ? 'bg-emerald-800' : 'bg-slate-900'}`}>
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300 text-xs mb-1 uppercase tracking-wider">
                <MapPin size={12} />
                {site.floor} - {site.department}
            </div>
            <button onClick={onCancel} className="text-slate-300 hover:text-white"><X size={20}/></button>
        </div>
        <h2 className="text-2xl font-bold mb-2">{site.name}</h2>
        <div className="flex justify-between items-end">
            <p className="text-slate-300 text-sm opacity-80">
                공사 기간: {site.startDate} ~ {site.endDate}
            </p>
            <span className="text-xs font-bold border border-white/30 px-2 py-1 rounded-full">
                {currentRole === Role.FACILITY ? '시설팀 점검' : '안전팀 점검'}
            </span>
        </div>
      </div>

      <div className="space-y-6">
        {/* 0. 작업 내용 입력 (Only visible to Safety Team) */}
        {currentRole === Role.SAFETY && (
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
              <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <Hammer className="w-5 h-5 text-indigo-500" />
                  금일 주요 진행 작업
              </h3>
              <input 
                  type="text"
                  value={workType}
                  onChange={(e) => setWorkType(e.target.value)}
                  placeholder="예: 천장 텍스 교체, 배관 용접, 페인트 도장 등"
                  className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 outline-none font-medium"
              />
          </div>
        )}

        {/* 1. 체크리스트 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
             <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <CheckSquare className="w-5 h-5 text-emerald-500" />
                필수 점검 항목
             </h3>
             <div className="space-y-3">
                 {[
                     { key: 'ppe', label: '작업자 보호구(PPE) 착용 상태' },
                     { key: 'fireSafety', label: '소화기 비치 및 화재 위험 요소' },
                     { key: 'electrical', label: '가설 전기 배선 및 분전반 상태' },
                     { key: 'environment', label: '자재 정리정돈 및 통행로 확보' },
                 ].map((item) => (
                     <label key={item.key} className="flex items-center gap-3 p-3 rounded-lg border border-slate-100 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer">
                         <div className={`w-6 h-6 rounded flex items-center justify-center border transition-colors ${checklist[item.key as keyof typeof checklist] ? 'bg-blue-600 border-blue-600' : 'bg-white border-slate-300'}`}>
                            {checklist[item.key as keyof typeof checklist] && <CheckSquare size={16} className="text-white" />}
                         </div>
                         <input 
                            type="checkbox" 
                            checked={checklist[item.key as keyof typeof checklist]}
                            onChange={() => setChecklist(prev => ({...prev, [item.key]: !prev[item.key as keyof typeof checklist]}))}
                            className="hidden" 
                        />
                         <span className="text-slate-700 text-sm font-medium">{item.label}</span>
                     </label>
                 ))}
             </div>
        </div>

        {/* 2. 사진 촬영 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Camera className="w-5 h-5 text-blue-500" />
                    현장 사진 촬영
                </h3>
                <span className="text-xs text-slate-400">{photos.length}/5</span>
            </div>
            
            <div className="grid grid-cols-3 gap-2">
                {photos.map((p, idx) => (
                    <div key={idx} className="aspect-square relative rounded-lg overflow-hidden group bg-slate-100">
                        <img src={p} alt="Site" className="w-full h-full object-cover" />
                        <button onClick={() => setPreviewImage(p)} className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <Maximize2 className="text-white w-5 h-5" />
                        </button>
                    </div>
                ))}
                {photos.length < 5 && (
                    <label className={`aspect-square rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 cursor-pointer active:bg-slate-50 transition-colors ${isAnalyzing ? 'animate-pulse bg-slate-50' : ''}`}>
                        <input type="file" accept="image/*" className="hidden" capture="environment" onChange={handleFileChange} disabled={isAnalyzing} />
                        {isAnalyzing ? (
                             <div className="flex flex-col items-center">
                                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                                <span className="text-[10px]">분석 중...</span>
                             </div>
                        ) : (
                            <>
                                <Upload className="w-6 h-6 mb-1" />
                                <span className="text-[10px]">촬영/업로드</span>
                            </>
                        )}
                    </label>
                )}
            </div>
        </div>

        {/* 3. 위험도 및 특이사항 */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                위험도 평가 및 특이사항
            </h3>
            
            <div className="flex gap-2 mb-4">
                {[RiskLevel.NORMAL, RiskLevel.CAUTION, RiskLevel.WARNING].map((lvl) => (
                    <button
                        key={lvl}
                        onClick={() => setRisk(lvl)}
                        className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all shadow-sm
                            ${risk === lvl && lvl === RiskLevel.NORMAL ? 'bg-green-500 text-white ring-2 ring-green-600 ring-offset-2' : ''}
                            ${risk === lvl && lvl === RiskLevel.CAUTION ? 'bg-amber-500 text-white ring-2 ring-amber-600 ring-offset-2' : ''}
                            ${risk === lvl && lvl === RiskLevel.WARNING ? 'bg-red-500 text-white ring-2 ring-red-600 ring-offset-2' : ''}
                            ${risk !== lvl ? 'bg-white text-slate-400 border border-slate-200 hover:bg-slate-50' : ''}
                        `}
                    >
                        {lvl}
                    </button>
                ))}
            </div>

            <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="현장 특이사항이나 조치가 필요한 사항을 입력하세요..."
                className="w-full p-4 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none min-h-[100px] resize-none"
            ></textarea>
        </div>

        <button 
            onClick={handleSubmit}
            className={`w-full text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 ${currentRole === Role.SAFETY ? 'bg-emerald-600 shadow-emerald-200' : 'bg-blue-600 shadow-blue-200'}`}
        >
            <ShieldCheck size={20} />
            {currentRole === Role.FACILITY ? '시설 점검 완료' : '안전 점검 완료'}
        </button>
      </div>

      {/* Image Preview Modal */}
      {previewImage && (
          <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4" onClick={() => setPreviewImage(null)}>
              <button className="absolute top-4 right-4 text-white p-2"><X size={24}/></button>
              <img src={previewImage} className="max-w-full max-h-full rounded" alt="Preview" />
          </div>
      )}
    </div>
  );
};

export default FieldWork;