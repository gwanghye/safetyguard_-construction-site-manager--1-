import React, { useState, useRef, useEffect } from 'react';
import { InspectionLog, Site, Role, RiskLevel } from '../types';
import { X, Clock, AlertTriangle, CheckCircle2, ChevronRight, Ban, Hammer, ShieldAlert, FileText, Check, Maximize2 } from 'lucide-react';

interface HistoryTimelineProps {
    site: Site;
    logs: InspectionLog[];
    onClose: () => void;
}

const HistoryTimeline: React.FC<HistoryTimelineProps> = ({ site, logs, onClose }) => {
    const [selectedLog, setSelectedLog] = useState<InspectionLog | null>(null);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const timelineRef = useRef<HTMLDivElement>(null);

    const siteLogs = logs.filter(l => l.siteId === site.id);

    // 1. 날짜 배열 생성 (최신순)
    const formatDate = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const startDate = new Date(site.startDate);
    const endDate = new Date(site.endDate);
    const today = new Date();
    const limitDate = endDate < today ? endDate : today;

    const dateList: string[] = [];
    for (let d = new Date(startDate); d <= limitDate; d.setDate(d.getDate() + 1)) {
        dateList.push(formatDate(d));
    }
    dateList.reverse(); // 최신순 정렬

    // 통계 계산
    const totalChecks = siteLogs.length;
    const warningCount = siteLogs.filter(l => l.riskLevel === RiskLevel.WARNING).length;
    const unresolvedCount = siteLogs.filter(l => l.action?.status === 'PENDING').length;
    
    const safetyChecks = siteLogs.filter(l => l.inspectorRole === Role.SAFETY).length;
    const facilityChecks = siteLogs.filter(l => l.inspectorRole === Role.FACILITY).length;
    const salesChecks = siteLogs.filter(l => l.inspectorRole === Role.SALES).length;

    const getLogsForDateAndRole = (dateStr: string, role: Role) => {
        return siteLogs.filter(l => formatDate(new Date(l.timestamp)) === dateStr && l.inspectorRole === role);
    };

    const scrollToDate = (dateStr: string) => {
        const element = document.getElementById(`timeline-${dateStr}`);
        if (element && timelineRef.current) {
            timelineRef.current.scrollTo({
                top: element.offsetTop - 150,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="fixed inset-0 z-[70] bg-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-200 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-4 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm shrink-0">
                <div>
                    <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                        <Clock className="text-indigo-500" />
                        {site.name} 전체 이력 보드
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">{site.startDate} ~ {site.endDate}</p>
                </div>
                <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors">
                    <X size={24} />
                </button>
            </div>

            <div className="flex flex-1 overflow-hidden relative">
                
                {/* Left/Main Timeline Area */}
                <div className="flex-1 flex flex-col h-full bg-slate-50 relative overflow-hidden transition-all duration-300">
                    
                    {/* Top Dashboard & Minimap */}
                    <div className="shrink-0 bg-white border-b border-slate-200 shadow-sm relative z-10">
                        {/* Stats Widgets */}
                        <div className="grid grid-cols-4 gap-4 p-4 border-b border-slate-100 bg-slate-50/50">
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                                <div className="text-xs font-bold text-slate-500 mb-1">총 점검 횟수</div>
                                <div className="text-2xl font-black text-slate-800">{totalChecks}건</div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                                <div className="text-xs font-bold text-slate-500 mb-1">발견된 위험</div>
                                <div className="text-2xl font-black text-red-600">{warningCount}건</div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm text-center">
                                <div className="text-xs font-bold text-slate-500 mb-1">미조치 항목</div>
                                <div className="text-2xl font-black text-amber-600">{unresolvedCount}건</div>
                            </div>
                            <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
                                <div className="text-[10px] font-bold text-slate-500 mb-2 text-center">주체별 점검수</div>
                                <div className="space-y-1.5">
                                    <div className="flex items-center text-[10px]"><span className="w-8 font-bold text-emerald-600">안전</span> <div className="flex-1 bg-slate-100 h-1.5 ml-1 rounded-full"><div className="bg-emerald-500 h-full rounded-full" style={{width:`${Math.min(100, (safetyChecks/dateList.length)*100)}%`}}></div></div> <span className="ml-1 w-4 text-right">{safetyChecks}</span></div>
                                    <div className="flex items-center text-[10px]"><span className="w-8 font-bold text-blue-600">시설</span> <div className="flex-1 bg-slate-100 h-1.5 ml-1 rounded-full"><div className="bg-blue-500 h-full rounded-full" style={{width:`${Math.min(100, (facilityChecks/dateList.length)*100)}%`}}></div></div> <span className="ml-1 w-4 text-right">{facilityChecks}</span></div>
                                    <div className="flex items-center text-[10px]"><span className="w-8 font-bold text-purple-600">영업</span> <div className="flex-1 bg-slate-100 h-1.5 ml-1 rounded-full"><div className="bg-purple-500 h-full rounded-full" style={{width:`${Math.min(100, (salesChecks/dateList.length)*100)}%`}}></div></div> <span className="ml-1 w-4 text-right">{salesChecks}</span></div>
                                </div>
                            </div>
                        </div>

                        {/* Horizontal Minimap Strip */}
                        <div className="px-4 py-3 overflow-x-auto no-scrollbar flex gap-2 items-center">
                            <span className="text-[10px] font-bold text-slate-400 whitespace-nowrap bg-slate-100 px-2 py-1 rounded">출석부 미니맵</span>
                            {dateList.map(date => {
                                const facLogs = getLogsForDateAndRole(date, Role.FACILITY);
                                const safLogs = getLogsForDateAndRole(date, Role.SAFETY);
                                const salLogs = getLogsForDateAndRole(date, Role.SALES);
                                return (
                                    <button 
                                        key={date} 
                                        onClick={() => scrollToDate(date)}
                                        className="flex flex-col items-center gap-1 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors min-w-[48px] flex-shrink-0"
                                    >
                                        <div className="text-[9px] font-bold text-slate-500">{date.slice(5).replace('-','/')}</div>
                                        <div className="flex gap-0.5">
                                            <div className={`w-2 h-2 rounded-full ${facLogs.length > 0 ? (facLogs.some(l => l.riskLevel === RiskLevel.WARNING) ? 'bg-red-500' : 'bg-blue-500') : 'bg-slate-200'}`}></div>
                                            <div className={`w-2 h-2 rounded-full ${safLogs.length > 0 ? (safLogs.some(l => l.riskLevel === RiskLevel.WARNING) ? 'bg-red-500' : 'bg-emerald-500') : 'bg-slate-200'}`}></div>
                                            <div className={`w-2 h-2 rounded-full ${salLogs.length > 0 ? (salLogs.some(l => l.riskLevel === RiskLevel.WARNING) ? 'bg-red-500' : 'bg-purple-500') : 'bg-slate-200'}`}></div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Vertical Timeline Body */}
                    <div ref={timelineRef} className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth relative">
                        {/* Center Timeline Line */}
                        <div className="absolute left-8 md:left-[88px] top-0 bottom-0 w-0.5 bg-indigo-100"></div>

                        <div className="max-w-5xl mx-auto space-y-8 relative">
                            {/* Column Headers */}
                            <div className="pl-16 md:pl-32 grid grid-cols-3 gap-2 md:gap-4 sticky top-0 z-10 pb-2">
                                <div className="bg-blue-100 text-blue-700 text-xs font-bold py-1.5 rounded text-center shadow-sm">시설 점검</div>
                                <div className="bg-emerald-100 text-emerald-700 text-xs font-bold py-1.5 rounded text-center shadow-sm">안전 점검</div>
                                <div className="bg-purple-100 text-purple-700 text-xs font-bold py-1.5 rounded text-center shadow-sm">영업 점검</div>
                            </div>

                            {dateList.map((date) => {
                                const facLogs = getLogsForDateAndRole(date, Role.FACILITY);
                                const safLogs = getLogsForDateAndRole(date, Role.SAFETY);
                                const salLogs = getLogsForDateAndRole(date, Role.SALES);

                                return (
                                    <div key={date} id={`timeline-${date}`} className="relative flex items-start group">
                                        {/* Date Node */}
                                        <div className="w-16 md:w-32 flex-shrink-0 flex items-center gap-3 bg-slate-50 py-2 relative z-10">
                                            <div className="text-[10px] md:text-sm font-bold text-indigo-900 bg-indigo-50 px-2 py-1 rounded border border-indigo-100 shadow-sm">
                                                {date.slice(5).replace('-','/')}
                                            </div>
                                            <div className="w-3 h-3 rounded-full bg-indigo-500 ring-4 ring-indigo-50 shadow-sm hidden md:block"></div>
                                        </div>

                                        {/* 3 Kanban Columns */}
                                        <div className="flex-1 grid grid-cols-3 gap-2 md:gap-4 pl-2 md:pl-0">
                                            {[facLogs, safLogs, salLogs].map((logsArray, idx) => {
                                                if (logsArray.length === 0) {
                                                    return (
                                                        <div key={idx} className="border border-dashed border-slate-200 rounded-xl bg-slate-50/50 flex flex-col items-center justify-center p-4 h-24 opacity-50">
                                                            <Ban size={16} className="text-slate-300 mb-1" />
                                                            <span className="text-[10px] text-slate-400 font-bold">미점검</span>
                                                        </div>
                                                    );
                                                }
                                                return (
                                                    <div key={idx} className="flex flex-col gap-2">
                                                        {logsArray.map(log => (
                                                            <div 
                                                                key={log.id} 
                                                                onClick={() => setSelectedLog(log)}
                                                                className={`rounded-xl border shadow-sm cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all bg-white
                                                                    ${selectedLog?.id === log.id ? 'ring-2 ring-indigo-500 border-indigo-500' : 'border-slate-200'}
                                                                `}
                                                            >
                                                                <div className={`px-2 py-1.5 border-b text-[10px] font-bold flex justify-between items-center
                                                                    ${log.riskLevel === RiskLevel.WARNING ? 'bg-red-50 text-red-700 border-red-100' : log.riskLevel === RiskLevel.CAUTION ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-slate-50 text-slate-700 border-slate-100'}
                                                                `}>
                                                                    <span className="truncate">{log.inspector}</span>
                                                                    <div className="flex items-center gap-1">
                                                                        <span className="text-[8px] opacity-70">{new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                                                                        {log.riskLevel === RiskLevel.WARNING && <AlertTriangle size={12} className="animate-pulse" />}
                                                                    </div>
                                                                </div>
                                                                <div className="p-2 md:p-3">
                                                                    {log.photos.length > 0 ? (
                                                                        <div className="h-16 bg-slate-100 rounded mb-2 overflow-hidden border border-slate-100 relative group-hover:opacity-90 transition-opacity">
                                                                            <img src={log.photos[0]} className="w-full h-full object-cover" alt="thumb" />
                                                                            {log.photos.length > 1 && (
                                                                                <div className="absolute bottom-1 right-1 bg-black/50 text-white text-[8px] font-bold px-1 rounded">+{log.photos.length-1}</div>
                                                                            )}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="h-6 mb-1"></div>
                                                                    )}
                                                                    <div className="text-[10px] md:text-xs text-slate-600 line-clamp-2 md:line-clamp-3 leading-relaxed">
                                                                        {log.notes || "특이사항 없음"}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Right Slide-out Drawer */}
                <div className={`shrink-0 bg-white border-l border-slate-200 shadow-2xl transition-all duration-300 ease-in-out absolute md:relative right-0 top-0 bottom-0 z-30
                    ${selectedLog ? 'w-[85%] md:w-[400px] translate-x-0' : 'w-[85%] md:w-[400px] translate-x-full md:hidden'}
                `}>
                    {selectedLog ? (
                        <div className="h-full flex flex-col">
                            <div className="p-4 border-b border-slate-100 bg-slate-50">
                                <div className="flex justify-between items-center mb-3">
                                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                        <FileText className="text-indigo-500" size={18} />
                                        점검 상세 리포트
                                    </h3>
                                    <button onClick={() => setSelectedLog(null)} className="p-1.5 bg-white rounded-full text-slate-400 hover:text-slate-800 shadow-sm border border-slate-200">
                                        <X size={16} />
                                    </button>
                                </div>

                                {(() => {
                                    const sameDayRoleLogs = siteLogs.filter(l => 
                                        formatDate(new Date(l.timestamp)) === formatDate(new Date(selectedLog.timestamp)) && 
                                        l.inspectorRole === selectedLog.inspectorRole
                                    ).sort((a, b) => a.timestamp - b.timestamp);

                                    if (sameDayRoleLogs.length > 1) {
                                        return (
                                            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
                                                {sameDayRoleLogs.map((log, idx) => (
                                                    <button
                                                        key={log.id}
                                                        onClick={() => setSelectedLog(log)}
                                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all whitespace-nowrap
                                                            ${selectedLog.id === log.id 
                                                                ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-100' 
                                                                : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-100'}
                                                        `}
                                                    >
                                                        기록 {idx + 1} ({new Date(log.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})
                                                    </button>
                                                ))}
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-6">
                                {/* 헤더 정보 */}
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 mb-1">{new Date(selectedLog.timestamp).toLocaleString()}</div>
                                        <div className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                            {selectedLog.inspector} 
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full text-white shadow-sm
                                                ${selectedLog.inspectorRole === Role.SAFETY ? 'bg-emerald-500' : selectedLog.inspectorRole === Role.SALES ? 'bg-purple-500' : 'bg-blue-500'}
                                            `}>
                                                {selectedLog.inspectorRole === Role.SAFETY ? '안전' : selectedLog.inspectorRole === Role.SALES ? '영업' : '시설'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`px-3 py-1 rounded-lg text-sm font-bold border shadow-sm
                                        ${selectedLog.riskLevel === RiskLevel.WARNING ? 'bg-red-50 text-red-700 border-red-200' : selectedLog.riskLevel === RiskLevel.CAUTION ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}
                                    `}>
                                        {selectedLog.riskLevel}
                                    </div>
                                </div>

                                {/* 체크리스트 요약 */}
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className={`p-2 rounded border flex items-center gap-1.5 ${selectedLog.checklist.ppe ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                        {selectedLog.checklist.ppe ? <CheckCircle2 size={14}/> : <ShieldAlert size={14}/>} 보호구
                                    </div>
                                    <div className={`p-2 rounded border flex items-center gap-1.5 ${selectedLog.checklist.fireSafety ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                        {selectedLog.checklist.fireSafety ? <CheckCircle2 size={14}/> : <ShieldAlert size={14}/>} 화재예방
                                    </div>
                                    <div className={`p-2 rounded border flex items-center gap-1.5 ${selectedLog.checklist.electrical ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                        {selectedLog.checklist.electrical ? <CheckCircle2 size={14}/> : <ShieldAlert size={14}/>} 전기안전
                                    </div>
                                    <div className={`p-2 rounded border flex items-center gap-1.5 ${selectedLog.checklist.environment ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 'bg-red-50 border-red-100 text-red-700'}`}>
                                        {selectedLog.checklist.environment ? <CheckCircle2 size={14}/> : <ShieldAlert size={14}/>} 정리정돈
                                    </div>
                                </div>

                                {/* 작업 내용 */}
                                {selectedLog.workType && (
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1"><Hammer size={12}/> 작업 내용</div>
                                        <div className="text-sm font-bold text-slate-800 bg-slate-100 p-3 rounded-lg border border-slate-200">{selectedLog.workType}</div>
                                    </div>
                                )}

                                {/* 특이사항 */}
                                <div>
                                    <div className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1"><FileText size={12}/> 특이사항 및 내용</div>
                                    <div className="text-sm text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200 whitespace-pre-wrap leading-relaxed min-h-[100px]">
                                        {selectedLog.notes || "특이사항 없음"}
                                    </div>
                                </div>

                                {/* 사진 갤러리 */}
                                {selectedLog.photos.length > 0 && (
                                    <div>
                                        <div className="text-xs font-bold text-slate-500 mb-1.5 flex items-center gap-1">현장 사진 ({selectedLog.photos.length}장)</div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {selectedLog.photos.map((photo, idx) => (
                                                <button key={idx} onClick={() => setSelectedImage(photo)} className="aspect-square rounded-xl overflow-hidden border border-slate-200 relative group bg-slate-100">
                                                    <img src={photo} className="w-full h-full object-cover transition-transform group-hover:scale-105" alt="" />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                                                        <Maximize2 className="text-white opacity-0 group-hover:opacity-100" size={20} />
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* AI 조치 권고 */}
                                {selectedLog.action && (
                                    <div className={`p-4 rounded-xl border ${selectedLog.action.status === 'RESOLVED' ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                                        <div className="flex items-center gap-2 mb-3">
                                            {selectedLog.action.status === 'RESOLVED' ? <Check size={18} className="text-emerald-600" /> : <AlertTriangle size={18} className="text-red-500" />}
                                            <span className="font-bold text-slate-800 text-sm">{selectedLog.action.status === 'RESOLVED' ? '조치 완료됨' : '미조치 항목'}</span>
                                        </div>
                                        
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-500 block mb-1">작업자 입력 조치 내용</span>
                                                <div className="text-sm text-slate-700 bg-white p-3 rounded-lg border shadow-sm">
                                                    {selectedLog.action.actionNotes}
                                                </div>
                                            </div>
                                            {selectedLog.action.aiFeedback && (
                                                <div>
                                                    <span className="text-[10px] font-bold text-indigo-500 block mb-1">AI 추가 피드백</span>
                                                    <div className="text-xs text-indigo-900 bg-indigo-50 p-3 rounded-lg border border-indigo-100 leading-relaxed">
                                                        {selectedLog.action.aiFeedback}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center">
                            <Clock size={48} className="text-slate-200 mb-4" />
                            <h3 className="font-bold text-slate-600 mb-1">상세 기록 서랍장</h3>
                            <p className="text-xs">왼쪽 칸반 타임라인에서<br/>미니 카드를 클릭하면 상세 내용이 이곳에 표시됩니다.</p>
                        </div>
                    )}
                </div>

            </div>

            {/* 이미지 전체 화면 */}
            {selectedImage && (
                <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in" onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage} className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" alt="Full size" />
                    <button className="absolute top-6 right-6 text-white bg-black/50 p-2 rounded-full hover:bg-black/80">
                        <X size={24} />
                    </button>
                </div>
            )}
        </div>
    );
};

export default HistoryTimeline;
