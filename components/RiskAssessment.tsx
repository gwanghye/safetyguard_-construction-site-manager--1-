import React, { useState, useRef, useEffect } from 'react';
import { Site, RiskAssessmentLog, RiskAssessmentStatus, Role } from '../types';
import { Camera, FileDown, CheckCircle2, AlertTriangle, Send, Loader2, ArrowLeft, PenTool, X } from 'lucide-react';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { addRiskAssessment, updateRiskAssessment } from '../services/firestore';
import { sendAssessmentApprovalAlert } from '../services/notification';

const SignaturePad = ({ onSave, onCancel }: { onSave: (data: string) => void, onCancel: () => void }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  useEffect(() => {
    // Canvas context initialization
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#0f172a'; // slate-900
      }
    }
  }, []);

  const getCoordinates = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDrawing = (e: any) => { 
    e.preventDefault();
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: any) => {
    e.preventDefault();
    if (!isDrawing) return;
    const coords = getCoordinates(e);
    if (!coords) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => { setIsDrawing(false); };
  
  const clear = () => { 
    const canvas = canvasRef.current; 
    if(canvas) { 
      const ctx = canvas.getContext('2d'); 
      ctx?.clearRect(0,0,canvas.width, canvas.height); 
    } 
  };
  
  const save = () => { 
    if(canvasRef.current) onSave(canvasRef.current.toDataURL('image/png')); 
  };
  
  return (
    <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 w-full max-w-sm flex flex-col items-center">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><PenTool size={20}/> 서명하기</h3>
        <canvas ref={canvasRef} width={300} height={150} className="border-2 border-slate-300 rounded-lg bg-slate-50 touch-none cursor-crosshair"
          onMouseDown={startDrawing} onMouseMove={draw} onMouseUp={stopDrawing} onMouseLeave={stopDrawing}
          onTouchStart={startDrawing} onTouchMove={draw} onTouchEnd={stopDrawing}
        />
        <div className="flex w-full gap-2 mt-6">
          <button onClick={clear} className="flex-1 py-3 bg-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-300">지우기</button>
          <button onClick={onCancel} className="flex-1 py-3 bg-red-100 text-red-600 rounded-xl font-bold hover:bg-red-200">취소</button>
          <button onClick={save} className="flex-[2] py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-md">서명 완료</button>
        </div>
      </div>
    </div>
  );
};

interface RiskAssessmentProps {
  site: Site;
  currentRole: Role;
  existingAssessment?: RiskAssessmentLog;
  approverMode?: 'SALES_TL' | 'SUPPORT_TL' | 'STORE_MANAGER';
  onBack: () => void;
  storeName?: string;
}

export const RiskAssessment: React.FC<RiskAssessmentProps> = ({ site, currentRole, existingAssessment, approverMode, onBack, storeName }) => {
  const [assessment, setAssessment] = useState<Partial<RiskAssessmentLog>>(existingAssessment || {
    siteId: site.id,
    siteName: site.name,
    department: site.department || localStorage.getItem('risk_dept') || '',
    constructionPeriod: `${site.startDate} ~ ${site.endDate}`,
    authorName: localStorage.getItem('risk_author') || '',
    status: RiskAssessmentStatus.DRAFT,
    checklist: {
      ceiling: '',
      floor: '',
      wall: '',
      equipment: '',
      fireSafety: '',
      electrical: '',
      others: ''
    },
    notes: '',
    photos: [],
    approvers: {}
  });

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);
  const appendixRef = useRef<HTMLDivElement>(null);
  
  // Pending Sign Action
  const [signAction, setSignAction] = useState<'SUBMIT' | 'APPROVE' | null>(null);
  const [currentOpinion, setCurrentOpinion] = useState('');

  const isReadonly = assessment.status !== RiskAssessmentStatus.DRAFT;

  const handleChecklistChange = (field: keyof RiskAssessmentLog['checklist'], value: string) => {
    if (isReadonly) return;
    setAssessment(prev => ({
      ...prev,
      checklist: {
        ...prev.checklist!,
        [field]: value
      }
    }));
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'before' | 'after', index: number) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1000; // Limit resolution for safety and performance
          let width = img.width;
          let height = img.height;

          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Get compressed data (JPEG for smaller size)
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          
          const newPhotos = [...(assessment.photos || [])];
          if (!newPhotos[index]) {
            newPhotos[index] = { before: '', after: '', riskFactor: '', actionTaken: '' };
          }
          newPhotos[index][type] = dataUrl;
          setAssessment(prev => ({ ...prev, photos: newPhotos }));
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePhotoTextChange = (field: 'riskFactor' | 'actionTaken', value: string, index: number) => {
    const newPhotos = [...(assessment.photos || [])];
    if (!newPhotos[index]) {
      newPhotos[index] = { before: '', after: '', riskFactor: '', actionTaken: '' };
    }
    newPhotos[index][field] = value;
    setAssessment(prev => ({ ...prev, photos: newPhotos }));
  };

  const addPhotoSet = () => {
    setAssessment(prev => ({
      ...prev,
      photos: [...(prev.photos || []), { before: '', after: '', riskFactor: '', actionTaken: '' }]
    }));
  };

  const removePhotoSet = (index: number) => {
    setAssessment(prev => {
      const newPhotos = [...(prev.photos || [])];
      newPhotos.splice(index, 1);
      return { ...prev, photos: newPhotos };
    });
  };

  const generatePDF = async () => {
    if (!pdfRef.current) return;
    setIsGeneratingPdf(true);
    
    try {
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true
      });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Page 1: Main Report
      const canvas1 = await html2canvas(pdfRef.current, { 
        scale: 2, 
        useCORS: true,
        logging: false,
        allowTaint: true,
        scrollY: -window.scrollY
      });
      const imgData1 = canvas1.toDataURL('image/jpeg', 0.8);
      const imgHeight1 = (canvas1.height * pdfWidth) / canvas1.width;
      pdf.addImage(imgData1, 'JPEG', 0, 0, pdfWidth, Math.min(imgHeight1, pdfHeight));

      // Appendix (Multi-page support)
      if (appendixRef.current) {
        const canvas2 = await html2canvas(appendixRef.current, { 
          scale: 2, 
          useCORS: true,
          logging: false,
          allowTaint: true,
          scrollY: -window.scrollY
        });
        const imgData2 = canvas2.toDataURL('image/jpeg', 0.7);
        const imgWidth = canvas2.width;
        const imgHeight = canvas2.height;
        
        const pageHeightInCanvas = (pdfHeight * imgWidth) / pdfWidth;
        let heightLeft = imgHeight;
        let position = 0;

        while (heightLeft > 0) {
          pdf.addPage();
          pdf.addImage(imgData2, 'JPEG', 0, -position * (pdfWidth / imgWidth), pdfWidth, (imgHeight * pdfWidth) / imgWidth);
          heightLeft -= pageHeightInCanvas;
          position += pageHeightInCanvas;
        }
      }
      
      pdf.save(`${site.name}_수시위험성평가.pdf`);
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('PDF 변환 중 오류가 발생했습니다.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleSignComplete = async (signatureData: string) => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    // Modal will stay open while submitting to prevent UI unmount race conditions
    const currentAction = signAction;

    const withTimeout = <T,>(promise: Promise<T>, ms: number) => {
      return Promise.race([
        promise,
        new Promise<T>((_, reject) => setTimeout(() => reject(new Error('FIREBASE_TIMEOUT')), ms))
      ]);
    };

    if (currentAction === 'SUBMIT') {
      const finalAssessment = {
        ...assessment,
        authorSignature: signatureData,
        status: RiskAssessmentStatus.PENDING_SALES_TL
      } as RiskAssessmentLog;

      try {
        if (existingAssessment) {
          await withTimeout(updateRiskAssessment(finalAssessment), 5000);
        } else {
          await withTimeout(addRiskAssessment({
            ...(finalAssessment as Omit<RiskAssessmentLog, 'id'>)
          }, site.storeId), 5000);
        }
        setAssessment(finalAssessment);
        sendAssessmentApprovalAlert('영업팀장', site);
        setSignAction(null); // Close modal on success
        alert('수시 위험성평가 결재가 상신되었습니다. (영업팀장 대기)');
        setTimeout(() => onBack(), 50);
      } catch (error: any) {
        console.error(error);
        setSignAction(null);
        if (error.message === 'FIREBASE_TIMEOUT') {
           alert('서버 응답이 지연되고 있습니다. (파이어베이스 연결을 확인해주세요)');
        } else {
           alert('결재 상신 중 오류가 발생했습니다.');
        }
        setIsSubmitting(false);
      }
    } else if (currentAction === 'APPROVE') {
      if (!existingAssessment) {
        setIsSubmitting(false);
        setSignAction(null);
        return;
      }
      try {
        let nextStatus = assessment.status;
        let nextRoleName = '';
        let targetApproverObj: any = {
           name: '결재자',
           date: Date.now(),
           signature: signatureData,
           opinion: currentOpinion
        };
        const approversObj = { ...(assessment.approvers || {}) };

        if (approverMode === 'SALES_TL') {
          nextStatus = RiskAssessmentStatus.PENDING_SUPPORT_TL;
          nextRoleName = '지원팀장';
          approversObj.salesTeamLeader = targetApproverObj;
        } else if (approverMode === 'SUPPORT_TL') {
          nextStatus = RiskAssessmentStatus.PENDING_STORE_MGR;
          nextRoleName = '점장';
          approversObj.supportTeamLeader = targetApproverObj;
        } else if (approverMode === 'STORE_MANAGER') {
          nextStatus = RiskAssessmentStatus.APPROVED;
          approversObj.storeManager = targetApproverObj;
        }

        const updated = { 
          ...assessment, 
          status: nextStatus,
          approvers: approversObj
        } as RiskAssessmentLog;
        
        await withTimeout(updateRiskAssessment(updated), 5000);
        setAssessment(updated);
        
        setSignAction(null); // Close modal on success

        if (nextStatus === RiskAssessmentStatus.APPROVED) {
           alert('결재가 완료되었습니다.');
        } else {
           sendAssessmentApprovalAlert(nextRoleName, site);
           alert(`승인(결재) 처리가 완료되었습니다.\n다음 결재자(${nextRoleName})에게 알림이 전송되었습니다.`);
        }
        setTimeout(() => onBack(), 50);
      } catch (error: any) {
         console.error(error);
         setSignAction(null);
         if (error.message === 'FIREBASE_TIMEOUT') {
             alert('서버 응답이 지연되고 있습니다. (파이어베이스 연결을 확인해주세요)');
         } else {
             alert('결재 처리 중 오류가 발생했습니다.');
         }
         setIsSubmitting(false);
      }
    } else {
       // Should never hit here, but fallback just in case
       setSignAction(null);
       setIsSubmitting(false);
    }
  };

  const requestApproval = () => {
    if (assessment.department) localStorage.setItem('risk_dept', assessment.department);
    if (assessment.authorName) localStorage.setItem('risk_author', assessment.authorName);
    setSignAction('SUBMIT');
  };

  const handleApprove = () => {
    setSignAction('APPROVE');
  };

  const checklistItems = [
    { id: 'ceiling', category: '천장', question: '마감재 균열, 처짐, 사인물 고정상태 등 이상이 없는가?' },
    { id: 'floor', category: '바닥', question: '마감재 단차, 전기배선 노출, 슬로프 구간 등 넘어질 위험이 없는가?' },
    { id: 'wall', category: '벽체·기둥', question: '마감재 부착 상태, 이격 및 기울기, 손상 상태가 양호한가?' },
    { id: 'equipment', category: '집기', question: '집기 모서리가 뾰족하거나 고정 상태가 흔들리는 등 위험이 없는가?' },
    { id: 'fireSafety', category: '소방설비', question: '소화기 비치, 스프링클러 간섭, 소방설비 작동 간섭 항목이 없는가?' },
    { id: 'electrical', category: '전기', question: '전선 노출, 분전반 앞 적재물 등 감전 및 화재 위험 요소가 없는가?' },
    { id: 'others', category: '기타', question: '안전표지 부착 여부 및 작업장 주변 청소 상태가 양호한가?' },
  ];

  const currentDate = new Date().toLocaleDateString('ko-KR');

  return (
    <>
      <div className="flex flex-col h-full bg-slate-50 relative border-t border-slate-200 overflow-hidden">
        <div className="flex-none flex items-center justify-between p-4 bg-white border-b shadow-sm z-10">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-bold">
            <ArrowLeft size={18} /> 뒤로가기
          </button>
          <div className="flex gap-2">
            {assessment.status === RiskAssessmentStatus.APPROVED && (
               <button onClick={generatePDF} disabled={isGeneratingPdf} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg text-sm transition-colors">
                 {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <FileDown size={16} />} 
                 PDF 다운로드
               </button>
            )}
            {currentRole === Role.SALES && assessment.status === RiskAssessmentStatus.DRAFT && (
              <button onClick={requestApproval} className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-sm shadow-sm transition-colors">
                <Send size={16} /> 기안 상신
              </button>
            )}
            {approverMode && assessment.status !== RiskAssessmentStatus.APPROVED && assessment.status !== RiskAssessmentStatus.DRAFT && (
              <button onClick={handleApprove} className="flex items-center gap-1.5 px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-sm shadow-lg shadow-indigo-200 transition-colors">
                <CheckCircle2 size={18} /> 승인(결재) 처리
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 p-2 md:p-4 overflow-y-auto w-full max-w-4xl mx-auto no-scrollbar">
          
          <div ref={pdfRef} className="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-slate-200">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <span className="w-4 h-4 bg-slate-900 rounded-sm"></span> 
              신규매장 안전점검 체크리스트
            </h1>
            
            <div className="flex border-2 border-slate-900 text-center text-[10px] font-bold bg-white">
              <div className="border-r-2 border-slate-900 flex flex-col w-[85px]">
                <div className="py-1 px-1 border-b-2 border-slate-900 bg-slate-100 flex-none h-12 flex items-center justify-center">담 당<br/>(영 업)</div>
                <div className="h-14 flex items-center justify-center bg-white">
                  {assessment.authorSignature ? <img src={assessment.authorSignature} className="h-full w-full object-contain" /> : <span className="text-slate-300 font-normal">서명</span>}
                </div>
              </div>
              <div className="border-r-2 border-slate-900 flex flex-col w-[85px]">
                <div className="py-1 px-1 border-b-2 border-slate-900 bg-slate-100 flex-none h-12 flex items-center justify-center">팀 장<br/>(영 업)</div>
                <div className="h-14 flex items-center justify-center bg-white">
                  {assessment.approvers?.salesTeamLeader?.signature ? <img src={assessment.approvers.salesTeamLeader.signature} className="h-full w-full object-contain" /> : <span className="text-slate-300 font-normal">서명</span>}
                </div>
              </div>
              <div className="border-r-2 border-slate-900 flex flex-col w-[85px] relative">
                <div className="py-1 px-1 border-b-2 border-slate-900 bg-slate-50 flex-none h-12 flex flex-col items-center justify-center text-indigo-700">
                  <span className="text-[8px] leading-none mb-0.5 font-black">[협조결재]</span>
                  팀 장(지원)
                </div>
                <div className="h-14 flex items-center justify-center bg-white">
                  {assessment.approvers?.supportTeamLeader?.signature ? <img src={assessment.approvers.supportTeamLeader.signature} className="h-full w-full object-contain" /> : <span className="text-slate-300 font-normal">서명</span>}
                </div>
              </div>
              <div className="flex flex-col w-[85px]">
                <div className="py-1 px-1 border-b-2 border-slate-900 bg-slate-100 flex-none h-12 flex items-center justify-center">점 장<br/>(안전책임자)</div>
                <div className="h-14 flex items-center justify-center bg-white">
                  {assessment.approvers?.storeManager?.signature ? <img src={assessment.approvers.storeManager.signature} className="h-full w-full object-contain" /> : <span className="text-slate-300 font-normal">서명</span>}
                </div>
              </div>
            </div>
          </div>

          <table className="w-full mb-6 border-collapse border border-slate-400 text-sm">
            <tbody>
              <tr>
                <td className="border border-slate-400 bg-slate-200 font-bold py-3 px-2 w-1/6 text-center align-middle">
                  점검대상
                </td>
                <td className="border border-slate-400 py-3 px-2 text-center w-2/6 align-middle font-medium">
                  {site.name}
                </td>
                <td className="border border-slate-400 bg-slate-200 font-bold py-3 px-2 w-1/6 text-center align-middle">
                  소속점포
                </td>
                <td className="border border-slate-400 py-3 px-2 text-center w-2/6 font-bold align-middle">
                  {storeName || '-'}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-200 font-bold py-3 px-2 w-1/6 text-center align-middle">
                  공사기간
                </td>
                <td className="border border-slate-400 py-3 px-2 text-center w-2/6 align-middle">
                    {!isReadonly ? (
                      <input 
                        className="w-full text-center bg-transparent border-b border-slate-300 outline-none pb-1 pt-1 text-xs text-slate-900"
                        value={assessment.constructionPeriod || ''}
                        onChange={e => setAssessment(prev => ({...prev, constructionPeriod: e.target.value}))}
                      />
                    ) : (
                      <span className="text-xs">{assessment.constructionPeriod}</span>
                    )}
                </td>
                <td className="border border-slate-400 bg-slate-200 font-bold py-3 px-2 w-1/6 text-center align-middle">
                  기안자(성명)
                </td>
                <td className="border border-slate-400 py-3 px-2 text-center w-2/6 font-bold align-middle">
                    {!isReadonly ? (
                      <input 
                        className="w-full text-center bg-transparent border-b border-slate-300 outline-none pb-1 pt-1"
                        placeholder="성명 입력"
                        value={assessment.authorName || ''}
                        onChange={e => setAssessment(prev => ({...prev, authorName: e.target.value}))}
                      />
                    ) : (
                      <span>{assessment.authorName}</span>
                    )}
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 bg-slate-200 font-bold py-3 px-2 w-1/6 text-center align-middle">
                  작성부서
                </td>
                <td className="border border-slate-400 py-3 px-2 text-center w-2/6 align-middle">
                    {!isReadonly ? (
                      <input 
                        className="w-full text-center bg-transparent border-b border-slate-300 outline-none pb-1 pt-1"
                       placeholder="부서 입력"
                       value={assessment.department || ''}
                       onChange={e => setAssessment(prev => ({...prev, department: e.target.value}))}
                     />
                   ) : (
                     <span className="font-medium text-slate-500">{assessment.department}</span>
                   )}
                </td>
                <td className="border border-slate-400 bg-slate-200 font-bold py-3 px-2 text-center w-1/6 align-middle">작성일자</td>
                <td className="border border-slate-400 py-3 px-2 text-center w-2/6 text-xs align-middle">{currentDate}</td>
              </tr>
            </tbody>
          </table>

          {/* Checklist Table */}
          <table className="w-full mb-8 border-collapse border-y-2 border-x-2 border-slate-900 text-sm text-center">
            <thead>
              <tr className="bg-slate-500 text-white font-bold border-b-2 border-slate-900">
                <th className="py-3 px-2 border-r border-slate-400 w-1/6 align-middle">구분</th>
                <th className="py-3 px-2 border-r border-slate-400 w-3/6 align-middle">세부내용</th>
                <th className="py-3 px-2 border-r border-slate-400 align-middle">양호</th>
                <th className="py-3 px-2 border-r border-slate-400 align-middle">보완</th>
                <th className="py-3 px-2 border-r border-slate-400 align-middle">해당없음</th>
                <th className="py-3 px-2 w-1/6 align-middle">비고</th>
              </tr>
            </thead>
            <tbody>
              {checklistItems.map((item, idx) => (
                <tr key={item.id} className="border-b border-slate-300">
                  <td className="font-bold border-r border-slate-300 bg-slate-100 py-3 px-2 w-1/6 align-middle">
                    {item.category}
                  </td>
                  <td className="text-left py-3 px-2 border-r border-slate-300 text-slate-700 w-3/6 align-middle">
                    <div className="leading-tight font-medium text-[11px] min-h-[1.5rem] flex items-center justify-start">{item.question}</div>
                  </td>
                  
                  <td className="border-r border-slate-300 cursor-pointer hover:bg-slate-50 py-3 px-2 align-middle text-center" onClick={() => handleChecklistChange(item.id as any, '양호')}>
                      {assessment.checklist![item.id as keyof typeof assessment.checklist] === '양호' ? <CheckCircle2 size={18} className="text-green-600 inline-block align-middle" /> : <div className="w-4 h-4 border border-slate-300 rounded-full inline-block align-middle"></div>}
                  </td>
                  <td className="border-r border-slate-300 cursor-pointer hover:bg-slate-50 py-3 px-2 align-middle text-center" onClick={() => handleChecklistChange(item.id as any, '보완')}>
                      {assessment.checklist![item.id as keyof typeof assessment.checklist] === '보완' ? <CheckCircle2 size={18} className="text-red-500 inline-block align-middle" /> : <div className="w-4 h-4 border border-slate-300 rounded-full inline-block align-middle"></div>}
                  </td>
                  <td className="border-r border-slate-300 cursor-pointer hover:bg-slate-50 py-3 px-2 align-middle text-center" onClick={() => handleChecklistChange(item.id as any, '해당없음')}>
                      {assessment.checklist![item.id as keyof typeof assessment.checklist] === '해당없음' ? <CheckCircle2 size={18} className="text-slate-500 inline-block align-middle" /> : <div className="w-4 h-4 border border-slate-300 rounded-full inline-block align-middle"></div>}
                  </td>
                  
                  <td className="py-3 px-1 align-middle text-center">
                    <input type="text" className="w-full text-[10px] pb-1 pt-1 outline-none text-center bg-transparent disabled:opacity-80 disabled:text-slate-800 font-medium" placeholder={isReadonly ? "" : "입력"} disabled={isReadonly} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Special Notes / Author Opinion */}
          <div className="mb-6 font-sans">
              <h3 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                 <span className="w-1 h-3 bg-slate-400 rounded-px"></span>
                 기타 특이사항 (기안자 의견)
              </h3>
              {!isReadonly ? (
                <textarea 
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500" 
                  rows={2} 
                  placeholder="평가 중 발견된 기타 특이사항이나 팀장/점장님께 전달할 의견을 작성하세요."
                  value={assessment.notes || ''}
                  onChange={(e) => setAssessment(prev => ({...prev, notes: e.target.value}))}
                />
              ) : (
                <div className="bg-slate-50 p-3 rounded-lg text-xs text-slate-700 border border-slate-100 italic">
                  "{assessment.notes || '작성된 의견이 없습니다.'}"
                </div>
              )}
          </div>

          {/* Approver History in Main Page (Requested by User) */}
          {(assessment.approvers?.salesTeamLeader?.opinion || assessment.approvers?.supportTeamLeader?.opinion || assessment.approvers?.storeManager?.opinion) && (
              <div className="mb-8 border-t border-dashed border-slate-200 pt-6">
                  <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                     <span className="w-1 h-3 bg-indigo-500 rounded-px"></span>
                     결재자 검토 의견
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {assessment.approvers?.salesTeamLeader?.opinion && (
                       <div className="text-[11px] bg-indigo-50/30 p-2.5 rounded-lg border border-indigo-100/50 flex gap-2">
                         <span className="font-bold text-indigo-700 whitespace-nowrap min-w-[60px]">영업 팀장:</span> 
                         <span className="text-slate-600 font-medium">{assessment.approvers.salesTeamLeader.opinion}</span>
                       </div>
                    )}
                    {assessment.approvers?.supportTeamLeader?.opinion && (
                       <div className="text-[11px] bg-indigo-50/30 p-2.5 rounded-lg border border-indigo-100/50 flex gap-2">
                         <span className="font-bold text-indigo-700 whitespace-nowrap min-w-[60px]">지원 팀장:</span> 
                         <span className="text-slate-600 font-medium">{assessment.approvers.supportTeamLeader.opinion}</span>
                       </div>
                    )}
                    {assessment.approvers?.storeManager?.opinion && (
                       <div className="text-[11px] bg-emerald-50/30 p-2.5 rounded-lg border border-emerald-100/50 flex gap-2">
                         <span className="font-bold text-emerald-700 whitespace-nowrap min-w-[60px]">점장:</span> 
                         <span className="text-slate-600 font-medium">{assessment.approvers.storeManager.opinion}</span>
                       </div>
                    )}
                  </div>
              </div>
          )}

          {/* Approver Opinion Input (Visible only to current approver) */}
          {approverMode && assessment.status !== RiskAssessmentStatus.APPROVED && (
              <div className="mb-8 p-4 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <h3 className="text-sm font-bold text-indigo-700 mb-2 flex items-center gap-2">
                     <CheckCircle2 size={16} /> 결재자 검토 의견
                  </h3>
                  <textarea 
                    className="w-full bg-white border border-indigo-200 rounded-lg p-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm" 
                    rows={2} 
                    placeholder="해당 건에 대한 승인/보완 의견을 입력해 주세요. (선택사항)"
                    value={currentOpinion}
                    onChange={(e) => setCurrentOpinion(e.target.value)}
                  />
              </div>
          )}

          </div>

        {/* Appendix Section (Captured as Page 2) */}
        <div className="flex-none w-full max-w-4xl mx-auto mt-8">
          <div ref={appendixRef} className="bg-white p-4 md:p-8 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mt-4 mb-4 border-b-2 border-slate-900 pb-2">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <span className="w-4 h-4 bg-slate-900 outline outline-2 outline-offset-2 outline-slate-900 rounded-sm"></span> 
              별첨 _ 개선 현황
            </h2>
            {!isReadonly && !approverMode && (
              <button onClick={addPhotoSet} className="text-xs font-bold text-white bg-slate-800 px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-700">
                사진 란 추가 +
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-8">
            {(assessment.photos?.length || 0) === 0 ? (
               <div className="col-span-2 text-center text-sm text-slate-400 py-10 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                 개선 전/후 사진 및 조치사항을 등록하려면 '사진 란 추가 +' 버튼을 클릭하세요.
               </div>
            ) : assessment.photos?.map((photo, idx) => (
              <div key={idx} className="col-span-2 relative group flex gap-4">
                {!isReadonly && !approverMode && (
                  <button 
                    onClick={() => removePhotoSet(idx)} 
                    className="absolute -top-3 -right-3 z-30 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm shadow-md hover:bg-red-600 transition-colors opacity-0 group-hover:opacity-100"
                    title="사진 란 삭제"
                  >
                    ×
                  </button>
                )}
                
                {/* Before and After Side by Side */}
                <div className="flex-1 border-2 border-slate-600 rounded-sm">
                  <div className="bg-slate-500 text-white font-bold p-1 border-b border-slate-600 text-center text-xs">개선 전</div>
                  <div className="relative flex items-center justify-center p-2 bg-white h-[200px] overflow-hidden">
                    {photo.before ? (
                       <>
                        <img src={photo.before} alt="before" className="max-w-full max-h-full object-cover" />
                        {!isReadonly && !approverMode && (
                          <button onClick={() => {
                            const newPhotos = [...(assessment.photos || [])];
                            newPhotos[idx].before = '';
                            setAssessment(prev => ({...prev, photos: newPhotos}));
                          }} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"><X size={12}/></button>
                        )}
                       </>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Camera className="text-slate-300" size={32} />
                        {(!isReadonly && !approverMode) ? (
                          <label className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold cursor-pointer hover:bg-slate-200">
                            사진 등록
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'before', idx)} />
                          </label>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">사진 없음</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-600 p-2 min-h-[60px] text-xs">
                    <div className="font-bold text-slate-500 mb-1">유해·위험요인:</div>
                    {!isReadonly && !approverMode ? (
                      <textarea 
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1 outline-none text-[11px]" 
                        rows={2}
                        placeholder="위험요인 입력"
                        value={photo.riskFactor}
                        onChange={(e) => handlePhotoTextChange('riskFactor', e.target.value, idx)}
                      />
                    ) : (
                      <div className="text-slate-800 font-medium">{photo.riskFactor || '-'}</div>
                    )}
                  </div>
                </div>

                <div className="flex-1 border-2 border-slate-600 rounded-sm">
                  <div className="bg-slate-500 text-white font-bold p-1 border-b border-slate-600 text-center text-xs">개선 후</div>
                  <div className="relative flex items-center justify-center p-2 bg-white h-[200px] overflow-hidden">
                    {photo.after ? (
                       <>
                        <img src={photo.after} alt="after" className="max-w-full max-h-full object-cover" />
                        {!isReadonly && !approverMode && (
                          <button onClick={() => {
                            const newPhotos = [...(assessment.photos || [])];
                            newPhotos[idx].after = '';
                            setAssessment(prev => ({...prev, photos: newPhotos}));
                          }} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full"><X size={12}/></button>
                        )}
                       </>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <Camera className="text-slate-300" size={32} />
                        {!isReadonly && !approverMode ? (
                          <label className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-[10px] font-bold cursor-pointer hover:bg-slate-200">
                            사진 등록
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handlePhotoUpload(e, 'after', idx)} />
                          </label>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-bold">사진 없음</span>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-600 p-2 min-h-[60px] text-xs">
                    <div className="font-bold text-slate-500 mb-1">조치사항:</div>
                    {!isReadonly && !approverMode ? (
                      <textarea 
                        className="w-full bg-slate-50 border border-slate-200 rounded p-1 outline-none text-[11px]" 
                        rows={2}
                        placeholder="조치사항 입력"
                        value={photo.actionTaken}
                        onChange={(e) => handlePhotoTextChange('actionTaken', e.target.value, idx)}
                      />
                    ) : (
                      <div className="text-slate-800 font-medium">{photo.actionTaken || '-'}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          </div>
        </div>
      </div>
    </div>

      {signAction && (
         <SignaturePad 
           onSave={handleSignComplete} 
           onCancel={() => setSignAction(null)} 
         />
      )}
    </>
  );
};
