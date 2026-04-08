import React, { useState } from 'react';
import { Site, InspectionLog, Role, RiskLevel } from '../types';
import { ArrowLeft, Plus, AlertTriangle, Hammer, Check, BrainCircuit, RefreshCw, X, FilePlus } from 'lucide-react';
import { validateCorrectiveAction } from '../services/aiService';
import { updateLog } from '../services/firestore';

interface SiteDetailProps {
    site: Site;
    logs: InspectionLog[];
    currentRole: Role;
    onBack: () => void;
    onStartInspection: () => void;
}

const SiteDetail: React.FC<SiteDetailProps> = ({ site, logs, currentRole, onBack, onStartInspection }) => {
    const [actionLogId, setActionLogId] = useState<string | null>(null);
    const [actionNotes, setActionNotes] = useState("");
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);
    
    // 이 현장의 점검 로그 중 현재 역할(Role)이 지적한 미조치 Warning 로그들만 필터링
    const siteLogs = logs.filter(l => l.siteId === site.id);
    const pendingWarnings = siteLogs.filter(l => l.riskLevel === RiskLevel.WARNING && (!l.action || l.action.status === 'PENDING') && l.inspectorRole === currentRole);

    const submitCorrectiveAction = async () => {
        if (!actionNotes.trim() || !actionLogId) return;
        setIsSubmittingAction(true);
        const log = siteLogs.find(l => l.id === actionLogId);
        if (log) {
            const { isResolved, feedback } = await validateCorrectiveAction(log.notes, actionNotes);
            
            const updatedLog: InspectionLog = {
                ...log,
                action: {
                    status: isResolved ? 'RESOLVED' : 'PENDING',
                    actionNotes: actionNotes,
                    resolvedAt: Date.now(),
                    aiFeedback: feedback
                }
            };

            await updateLog(updatedLog);
            if (!isResolved) {
                alert(`AI 추가 조치 권고:\n${feedback}`);
            } else {
                alert("조치가 정상적으로 승인되었습니다.");
            }
        }
        setIsSubmittingAction(false);
        setActionLogId(null);
        setActionNotes("");
    };

    return (
        <div className="flex flex-col h-[calc(100vh-70px)] bg-slate-50 relative">
            <div className="p-4 md:p-6 pb-24 overflow-y-auto animate-in slide-in-from-right-4">
                {/* Header Back Button */}
                <button onClick={onBack} className="flex items-center gap-2 text-slate-500 font-bold mb-4 hover:text-slate-800 transition-colors">
                    <ArrowLeft size={18} /> 현장 목록으로
                </button>

                {/* Site Info Card */}
                <div className={`text-white p-5 rounded-2xl shadow-lg mb-6 ${currentRole === Role.SAFETY ? 'bg-emerald-800' : currentRole === Role.SALES ? 'bg-purple-900' : 'bg-slate-900'}`}>
                    <div className="flex items-center gap-2 text-slate-300 text-xs mb-2 tracking-wider">
                        <span className="font-bold py-0.5 px-2 bg-white/20 rounded">{site.floor}</span>
                        {site.department}
                    </div>
                    <h2 className="text-2xl font-bold mb-1">{site.name}</h2>
                    <p className="text-slate-300 text-sm">
                        {site.startDate} ~ {site.endDate}
                    </p>
                </div>

                {/* Action Required Section */}
                <div className="mb-6">
                    <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 px-1">
                        <AlertTriangle className="text-red-500" size={18}/> 
                        미조치 위험 요소 ({pendingWarnings.length}건)
                    </h3>
                    
                    {pendingWarnings.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
                            <span className="text-4xl block mb-2">🎉</span>
                            <h4 className="font-bold text-slate-800">현재 조치해야 할 경고 내역이 없습니다.</h4>
                            <p className="text-sm text-slate-500 mt-1">현장이 안전하게 관리되고 있습니다.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {pendingWarnings.map(log => (
                                <div key={log.id} className="bg-white border border-red-300 rounded-xl overflow-hidden shadow-sm">
                                    <div className="p-4 bg-red-50/30">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <span className="font-bold text-slate-800 text-sm">지적자: {log.inspector} ({log.inspectorRole})</span>
                                                <div className="text-[10px] text-slate-500 mt-0.5">{new Date(log.timestamp).toLocaleString()}</div>
                                            </div>
                                            <span className="bg-red-600 text-white shadow-sm text-[10px] font-bold px-2 py-1 rounded animate-pulse w-fit">조치 요망</span>
                                        </div>
                                        
                                        <div className="text-sm text-slate-800 bg-white p-3 rounded-lg border border-red-100 mb-3">
                                            {log.notes}
                                        </div>
                                        
                                        {/* 개선 조치 폼 바로 노출 */}
                                        <div className="border-t border-red-100 pt-3">
                                            {actionLogId === log.id ? (
                                                <div className="animate-in fade-in zoom-in-95">
                                                    <textarea 
                                                        className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 text-sm focus:ring-2 focus:ring-indigo-500 outline-none mb-2"
                                                        placeholder="예: 노출된 전선 정리 및 절연 마감 완료"
                                                        rows={2}
                                                        value={actionNotes}
                                                        onChange={(e) => setActionNotes(e.target.value)}
                                                    />
                                                    <div className="flex gap-2">
                                                        <button 
                                                            onClick={submitCorrectiveAction}
                                                            disabled={isSubmittingAction || !actionNotes.trim()}
                                                            className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-lg text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                                                        >
                                                            {isSubmittingAction ? <RefreshCw className="animate-spin" size={14} /> : <BrainCircuit size={14} />}
                                                            조치 승인 요청
                                                        </button>
                                                        <button 
                                                            onClick={() => setActionLogId(null)}
                                                            className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg text-sm font-bold hover:bg-slate-300"
                                                        >
                                                            취소
                                                        </button>
                                                    </div>
                                                </div>
                                            ) : (
                                                <button 
                                                    onClick={() => setActionLogId(log.id)}
                                                    className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Hammer size={16} /> 내가 조치하기
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Bottom Floating Action Button */}
            <div className="absolute bottom-6 left-0 right-0 px-4 md:px-6">
                <button 
                    onClick={onStartInspection} 
                    className={`w-full text-white py-4 flex items-center justify-center gap-3 rounded-2xl font-bold text-lg shadow-xl hover:-translate-y-1 transition-all active:translate-y-0
                    ${currentRole === Role.SAFETY ? 'bg-emerald-600 shadow-emerald-200' : currentRole === Role.SALES ? 'bg-purple-600 shadow-purple-200' : 'bg-blue-600 shadow-blue-200'}`}
                >
                    <FilePlus size={24} />
                    새로운 점검 시작하기
                </button>
            </div>
        </div>
    );
};

export default SiteDetail;
