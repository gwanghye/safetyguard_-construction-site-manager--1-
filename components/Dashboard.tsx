
import React, { useState, useEffect } from 'react';
import { InspectionLog, RiskLevel, Site, Role } from '../types';
import { RefreshCw, BrainCircuit, Plus, X, LayoutGrid, ListChecks, Hammer, Edit, CheckCircle2, AlertCircle, Clock, Trash2, Ban, CalendarClock, AlertTriangle, BarChart3, ShieldAlert, Activity } from 'lucide-react';
import { generateDailySafetySummary } from '../services/aiService';

interface DashboardProps {
    logs: InspectionLog[];
    sites: Site[];
    onAddSite?: (site: Site) => Promise<void> | void;
    onUpdateSite?: (site: Site) => Promise<void> | void;
    onDeleteSite?: (siteId: string) => Promise<void> | void;
    storeName?: string;
}

const Dashboard: React.FC<DashboardProps> = ({ logs, sites, onAddSite, onUpdateSite, onDeleteSite, storeName }) => {
    const [activeTab, setActiveTab] = useState<'monitoring' | 'analysis' | 'management'>('monitoring');
    const [aiSummary, setAiSummary] = useState<string>("");
    const [loadingAi, setLoadingAi] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showSiteForm, setShowSiteForm] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Delete Confirmation Modal State
    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    // Form State
    const [siteForm, setSiteForm] = useState<Partial<Site>>({
        floor: '1F',
        status: '대기'
    });

    // Date Selection State
    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });

    const today = new Date().toDateString();
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    // Filter logs by selected date
    const todaysLogs = logs.filter(l => {
        const logDate = new Date(l.timestamp);
        const year = logDate.getFullYear();
        const month = String(logDate.getMonth() + 1).padStart(2, '0');
        const day = String(logDate.getDate()).padStart(2, '0');
        const logDateStr = `${year}-${month}-${day}`;
        return logDateStr === selectedDate;
    });

    // Stats
    const warningCount = todaysLogs.filter(l => l.riskLevel === RiskLevel.WARNING).length;
    const facilityChecks = todaysLogs.filter(l => l.inspectorRole === Role.FACILITY).length;
    const safetyChecks = todaysLogs.filter(l => l.inspectorRole === Role.SAFETY).length;
    const salesChecks = todaysLogs.filter(l => l.inspectorRole === Role.SALES).length;

    // Auto-generate summary when entering analysis tab if not present
    useEffect(() => {
        if (activeTab === 'analysis' && !aiSummary && todaysLogs.length > 0) {
            handleAiSummary();
        }
    }, [activeTab, todaysLogs.length]);

    const handleAiSummary = async () => {
        setLoadingAi(true);
        const summary = await generateDailySafetySummary(todaysLogs);
        setAiSummary(summary);
        setLoadingAi(false);
    };

    const openAddForm = () => {
        setSiteForm({ floor: '1F', status: '대기', startDate: '', endDate: '', name: '', department: '', location: '' });
        setIsEditing(false);
        setShowSiteForm(true);
    };

    const openEditForm = (site: Site) => {
        setSiteForm({ ...site });
        setIsEditing(true);
        setShowSiteForm(true);
    };

    const handleDeleteClick = (siteId: string) => {
        setDeleteTargetId(siteId);
    };

    const confirmDelete = () => {
        if (deleteTargetId && onDeleteSite) {
            onDeleteSite(deleteTargetId);
            setDeleteTargetId(null);
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (siteForm.name && siteForm.department && siteForm.startDate && siteForm.endDate) {
            if (isEditing && onUpdateSite && siteForm.id) {
                const updatedSite: Site = {
                    id: siteForm.id,
                    storeId: siteForm.storeId || '',
                    name: siteForm.name,
                    floor: siteForm.floor || '1F',
                    department: siteForm.department,
                    location: siteForm.location || '',
                    startDate: siteForm.startDate,
                    endDate: siteForm.endDate,
                    status: siteForm.status || '대기'
                };
                onUpdateSite(updatedSite);
            } else if (!isEditing && onAddSite) {
                const site: Site = {
                    id: `site-${Date.now()}`,
                    storeId: '',
                    name: siteForm.name!,
                    floor: siteForm.floor || '1F',
                    department: siteForm.department!,
                    location: siteForm.location || '',
                    startDate: siteForm.startDate!,
                    endDate: siteForm.endDate!,
                    status: '대기'
                };
                onAddSite(site);
            }
            setShowSiteForm(false);
        }
    };

    // Status Helper
    const getStatus = (endDateStr: string) => {
        const end = new Date(endDateStr);
        const diffTime = end.getTime() - todayDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffTime < 0) return { status: 'expired', label: '종료됨', color: 'slate' };
        if (diffDays <= 3 && diffDays >= 0) return { status: 'urgent', label: `마감임박 (${diffDays}일)`, color: 'amber' };
        return { status: 'active', label: '진행중', color: 'blue' };
    };

    const renderStatusBadge = (endDateStr: string) => {
        const { status, label } = getStatus(endDateStr);

        const styles = {
            expired: "bg-slate-100 text-slate-500 border-slate-200",
            urgent: "bg-amber-50 text-amber-600 border-amber-200 animate-pulse",
            active: "bg-blue-50 text-blue-600 border-blue-100"
        };

        const icons = {
            expired: <Ban size={10} />,
            urgent: <CalendarClock size={10} />,
            active: <CheckCircle2 size={10} />
        };

        return (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${styles[status as keyof typeof styles]}`}>
                {icons[status as keyof typeof icons]}
                {label}
            </span>
        );
    };

    // Helper to render check status chip
    const renderCheckStatusChip = (log: InspectionLog | undefined, roleLabel: string) => {
        if (!log) return (
            <div className="flex items-center gap-1 text-slate-300 bg-slate-50 px-2 py-1 rounded border border-slate-100">
                <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                <span className="text-[10px] font-medium">{roleLabel} 미점검</span>
            </div>
        );

        const isWarning = log.riskLevel === RiskLevel.WARNING;
        const colorClass = isWarning ? 'text-red-600 bg-red-50 border-red-100' :
            log.riskLevel === RiskLevel.CAUTION ? 'text-amber-600 bg-amber-50 border-amber-100' :
                'text-emerald-600 bg-emerald-50 border-emerald-100';

        return (
            <div className={`flex items-center gap-1 px-2 py-1 rounded border ${colorClass}`}>
                {isWarning ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
                <span className="text-[10px] font-bold">{roleLabel} {log.riskLevel}</span>
            </div>
        );
    };

    // Sort logic
    const sortedSites = [...sites]
        .filter(site => {
            const start = new Date(site.startDate);
            const end = new Date(site.endDate);
            const selected = new Date(selectedDate);
            // Set times to midnight for accurate comparison
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            selected.setHours(0, 0, 0, 0);

            return selected >= start && selected <= end;
        })
        .sort((a, b) => {
            const aStatus = getStatus(a.endDate);
            const bStatus = getStatus(b.endDate);
            const statusOrder = { urgent: 0, active: 1, expired: 2 };
            const orderDiff = statusOrder[aStatus.status as keyof typeof statusOrder] - statusOrder[bStatus.status as keyof typeof statusOrder];
            if (orderDiff !== 0) return orderDiff;
            return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
        });

    // Analysis Metrics
    const getFailureStats = () => {
        const stats = { ppe: 0, fireSafety: 0, electrical: 0, environment: 0 };
        todaysLogs.forEach(log => {
            if (!log.checklist.ppe) stats.ppe++;
            if (!log.checklist.fireSafety) stats.fireSafety++;
            if (!log.checklist.electrical) stats.electrical++;
            if (!log.checklist.environment) stats.environment++;
        });
        return stats;
    };
    const failureStats = getFailureStats();

    return (
        <div className="p-4 md:p-6 pb-24">

            {/* 탭 네비게이션 */}
            <div className="flex bg-slate-200 p-1 rounded-xl mb-6 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('monitoring')}
                    className={`flex-1 min-w-[100px] py-2.5 text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'monitoring' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutGrid size={16} />
                    통합 관제
                </button>
                <button
                    onClick={() => setActiveTab('analysis')}
                    className={`flex-1 min-w-[100px] py-2.5 text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'analysis' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Activity size={16} />
                    위험 분석
                </button>
                <button
                    onClick={() => setActiveTab('management')}
                    className={`flex-1 min-w-[100px] py-2.5 text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'management' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <ListChecks size={16} />
                    현장 관리
                </button>
            </div>

            {/* --- 1. 실시간 모니터링 탭 --- */}
            {activeTab === 'monitoring' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    {/* 요약 카드 */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4 md:gap-0">
                            <div>
                                <h2 className="text-lg md:text-xl font-bold text-slate-900">{storeName || '전체'} 안전 현황</h2>
                                <div className="flex items-center gap-2 mt-1">
                                    <input
                                        type="date"
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600 font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    {/* <span className="text-slate-400 text-xs">기준 집계</span> */}
                                </div>
                            </div>
                            <div className="flex gap-2 w-full md:w-auto justify-between md:justify-start">
                                <div className="flex-1 px-1.5 py-3 bg-blue-50 rounded-lg text-center min-w-[40px]">
                                    <div className="text-xs text-blue-600 font-bold whitespace-nowrap">시설점검</div>
                                    <div className="text-xl font-bold text-blue-700">{facilityChecks}</div>
                                </div>
                                <div className="flex-1 px-1.5 py-3 bg-emerald-50 rounded-lg text-center min-w-[40px]">
                                    <div className="text-xs text-emerald-600 font-bold whitespace-nowrap">안전점검</div>
                                    <div className="text-xl font-bold text-emerald-700">{safetyChecks}</div>
                                </div>
                                <div className="flex-1 px-1.5 py-3 bg-purple-50 rounded-lg text-center min-w-[40px]">
                                    <div className="text-xs text-purple-600 font-bold whitespace-nowrap">영업점검</div>
                                    <div className="text-xl font-bold text-purple-700">{salesChecks}</div>
                                </div>
                                <div className="flex-1 px-1.5 py-3 bg-red-50 rounded-lg text-center min-w-[40px]">
                                    <div className="text-xs text-red-600 font-bold whitespace-nowrap">위험</div>
                                    <div className="text-xl font-bold text-red-700">{warningCount}</div>
                                </div>
                            </div>
                        </div>

                        {/* Progress Bars for simple visual */}
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-slate-600">
                                <span>점검 진행률 (금일 공사중 현장 대비)</span>
                                <span>{Math.round((todaysLogs.length / (sortedSites.length * 3 || 1)) * 100)}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                                <div className="bg-slate-800 h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (todaysLogs.length / (sortedSites.length * 3 || 1)) * 100)}%` }}></div>
                            </div>
                        </div>
                    </div>

                    {/* 현장 리스트 (Double Check View) */}
                    <div className="space-y-4">
                        <h3 className="font-bold text-slate-800 text-lg px-1">실시간 현장별 모니터링</h3>
                        {sortedSites.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">
                                등록된 현장이 없습니다.
                            </div>
                        ) : (
                            sortedSites.map(site => {
                                const siteLogs = todaysLogs.filter(l => l.siteId === site.id);
                                const facilityLog = siteLogs.find(l => l.inspectorRole === Role.FACILITY);
                                const safetyLog = siteLogs.find(l => l.inspectorRole === Role.SAFETY);
                                const salesLog = siteLogs.find(l => l.inspectorRole === Role.SALES);

                                const workTypeDisplay = safetyLog?.workType || facilityLog?.workType || salesLog?.workType || siteLogs[0]?.workType;
                                const { status } = getStatus(site.endDate);

                                return (
                                    <div key={site.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${status === 'expired' ? 'opacity-60 grayscale-[0.5] order-last' : ''}`}>
                                        <div className="p-4 border-b border-slate-100">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-start gap-3">
                                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${site.floor.includes('B') ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                        {site.floor}
                                                    </div>
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <h4 className="font-bold text-slate-800 text-sm md:text-base">{site.name}</h4>
                                                            {renderStatusBadge(site.endDate)}
                                                        </div>
                                                        <div className="text-xs text-slate-500 flex items-center gap-2">
                                                            <span>{site.department}</span>
                                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                            <span>~ {site.endDate}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Dual Status Chips */}
                                            <div className="flex gap-2 mt-2">
                                                {renderCheckStatusChip(facilityLog, "시설")}
                                                {renderCheckStatusChip(safetyLog, "안전")}
                                                {renderCheckStatusChip(salesLog, "영업")}
                                            </div>
                                        </div>

                                        {/* Detailed Info if Checked */}
                                        {(facilityLog || safetyLog || salesLog) && (
                                            <div className="p-4 bg-slate-50/50">
                                                <div className="space-y-3">
                                                    {workTypeDisplay && (
                                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                            <Hammer size={14} className="text-indigo-500" />
                                                            <span className="text-xs text-slate-500">진행 작업:</span>
                                                            <span>{workTypeDisplay}</span>
                                                        </div>
                                                    )}

                                                    {/* Photos (Aggregate) */}
                                                    {siteLogs.some(l => l.photos.length > 0) && (
                                                        <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                                                            {siteLogs.flatMap(l => l.photos).map((photo, idx) => (
                                                                <button key={idx} onClick={() => setSelectedImage(photo)} className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200">
                                                                    <img src={photo} className="w-full h-full object-cover" alt="" />
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* Notes */}
                                                    {siteLogs.map(l => l.notes && (
                                                        <div key={l.id} className="text-xs bg-white p-2 rounded border border-slate-200 text-slate-600">
                                                            <span className={`font-bold mr-1 ${l.inspectorRole === Role.SAFETY ? 'text-emerald-600' : l.inspectorRole === Role.SALES ? 'text-purple-600' : 'text-blue-600'}`}>
                                                                [{l.inspectorRole === Role.SAFETY ? '안전' : l.inspectorRole === Role.SALES ? '영업' : '시설'}]:
                                                            </span>
                                                            {l.notes}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* --- 2. 위험 분석 (NEW TAB) --- */}
            {activeTab === 'analysis' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <ShieldAlert className="text-indigo-600" />
                            총괄 위험 분석
                        </h2>
                    </div>

                    {/* AI Report Section */}
                    <div className="bg-indigo-900 rounded-2xl p-5 text-white shadow-lg">
                        <div className="flex justify-between items-center mb-4">
                            <div className="flex items-center gap-2 font-bold text-indigo-200 text-sm uppercase tracking-wider">
                                <BrainCircuit size={16} />
                                AI Risk Analysis
                            </div>
                            <button
                                onClick={handleAiSummary}
                                disabled={loadingAi}
                                className="bg-indigo-800 hover:bg-indigo-700 p-2 rounded-lg transition-colors disabled:opacity-50"
                            >
                                <RefreshCw size={16} className={loadingAi ? "animate-spin" : ""} />
                            </button>
                        </div>

                        {todaysLogs.length === 0 ? (
                            <p className="text-indigo-300 text-center py-8 text-sm">분석할 점검 데이터가 없습니다.</p>
                        ) : (
                            <div className="space-y-4">
                                {loadingAi ? (
                                    <div className="flex items-center justify-center py-10 gap-3">
                                        <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
                                        <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.2s]"></div>
                                        <div className="w-2 h-2 bg-white rounded-full animate-bounce [animation-delay:0.4s]"></div>
                                    </div>
                                ) : (
                                    <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium opacity-90">
                                        {aiSummary || "AI 분석 버튼을 눌러 리포트를 생성하세요."}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Risk Distribution Chart (Simple Bars) */}
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <BarChart3 size={18} className="text-slate-500" />
                            유형별 부적합 현황
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="text-xs text-slate-500 font-bold mb-1">화재 위험</div>
                                <div className="flex items-end justify-between">
                                    <span className="text-2xl font-bold text-slate-800">{failureStats.fireSafety}</span>
                                    <div className={`h-1.5 rounded-full flex-1 ml-3 ${failureStats.fireSafety > 0 ? 'bg-red-500' : 'bg-slate-200'}`}></div>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="text-xs text-slate-500 font-bold mb-1">전기 안전</div>
                                <div className="flex items-end justify-between">
                                    <span className="text-2xl font-bold text-slate-800">{failureStats.electrical}</span>
                                    <div className={`h-1.5 rounded-full flex-1 ml-3 ${failureStats.electrical > 0 ? 'bg-amber-500' : 'bg-slate-200'}`}></div>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="text-xs text-slate-500 font-bold mb-1">보호구 미착용</div>
                                <div className="flex items-end justify-between">
                                    <span className="text-2xl font-bold text-slate-800">{failureStats.ppe}</span>
                                    <div className={`h-1.5 rounded-full flex-1 ml-3 ${failureStats.ppe > 0 ? 'bg-orange-500' : 'bg-slate-200'}`}></div>
                                </div>
                            </div>
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <div className="text-xs text-slate-500 font-bold mb-1">환경 정리</div>
                                <div className="flex items-end justify-between">
                                    <span className="text-2xl font-bold text-slate-800">{failureStats.environment}</span>
                                    <div className={`h-1.5 rounded-full flex-1 ml-3 ${failureStats.environment > 0 ? 'bg-blue-500' : 'bg-slate-200'}`}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Focused High Risk List */}
                    <div>
                        <h3 className="font-bold text-red-600 mb-3 flex items-center gap-2 px-1">
                            <AlertTriangle size={18} />
                            집중 관리 필요 현장 (Warning)
                        </h3>
                        {todaysLogs.filter(l => l.riskLevel === RiskLevel.WARNING).length === 0 ? (
                            <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-xl text-center text-emerald-700 font-bold">
                                현재 '경고' 등급의 위험 현장이 없습니다.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {todaysLogs.filter(l => l.riskLevel === RiskLevel.WARNING).map(log => (
                                    <div key={log.id} className="bg-red-50 border border-red-100 rounded-xl p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-slate-800">{log.siteName}</span>
                                            <span className="bg-red-200 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded">경고</span>
                                        </div>
                                        <div className="text-sm text-slate-700 mb-3 bg-white/50 p-2 rounded border border-red-100">
                                            {log.notes}
                                        </div>
                                        <div className="flex flex-wrap gap-2 text-[10px] font-bold text-red-700">
                                            {!log.checklist.fireSafety && <span className="bg-white px-2 py-1 rounded border border-red-200">화재 위험</span>}
                                            {!log.checklist.electrical && <span className="bg-white px-2 py-1 rounded border border-red-200">전기 부적합</span>}
                                            {!log.checklist.ppe && <span className="bg-white px-2 py-1 rounded border border-red-200">보호구 미착용</span>}
                                        </div>
                                        {log.photos.length > 0 && (
                                            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                                                {log.photos.map((p, i) => (
                                                    <img key={i} src={p} alt="risk" className="w-12 h-12 rounded object-cover border border-red-200" onClick={() => setSelectedImage(p)} />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- 3. 현장 관리 탭 --- */}
            {activeTab === 'management' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center">
                        <h3 className="font-bold text-slate-800 text-lg">{storeName} 공사 현장 목록</h3>
                        <button
                            onClick={openAddForm}
                            className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-200 hover:bg-slate-800"
                        >
                            <Plus size={16} /> 현장 등록
                        </button>
                    </div>

                    {/* 현장 리스트 (관리용 - 정렬됨) */}
                    <div className="space-y-3">
                        {sortedSites.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">
                                등록된 공사 현장이 없습니다.<br />새로운 현장을 등록해주세요.
                            </div>
                        ) : (
                            sortedSites.map(site => {
                                const { status } = getStatus(site.endDate);
                                const isExpired = status === 'expired';

                                return (
                                    <div key={site.id} className={`bg-white p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${isExpired ? 'border-slate-100 bg-slate-50/50' : 'border-slate-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 font-bold ${isExpired ? 'bg-slate-100' : 'bg-slate-100'}`}>
                                                {site.floor}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className={`font-bold text-sm ${isExpired ? 'text-slate-400 decoration-slate-300' : 'text-slate-800'}`}>
                                                        {site.name}
                                                    </h4>
                                                    {renderStatusBadge(site.endDate)}
                                                </div>
                                                <div className="text-xs text-slate-500 flex items-center gap-2 mt-1">
                                                    <span>{site.department}</span>
                                                    <span className="text-slate-300">|</span>
                                                    <Clock size={10} />
                                                    <span>{site.startDate} ~ {site.endDate}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 self-end sm:self-auto">
                                            <button
                                                onClick={() => openEditForm(site)}
                                                className="px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors font-medium flex items-center gap-1"
                                            >
                                                <Edit size={14} /> 수정
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(site.id)}
                                                className="px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors font-medium flex items-center gap-1"
                                            >
                                                <Trash2 size={14} /> 삭제
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}

            {/* 현장 등록/수정 모달 */}
            {showSiteForm && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-end md:items-center justify-center md:p-4">
                    <div className="bg-white w-full md:max-w-md rounded-t-2xl md:rounded-2xl p-6 animate-in slide-in-from-bottom-10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900">
                                {isEditing ? '현장 정보 수정' : '신규 공사 현장 등록'}
                            </h3>
                            <button onClick={() => setShowSiteForm(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleFormSubmit} className="space-y-4">
                            <div className="grid grid-cols-4 gap-3">
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">층</label>
                                    <input type="text" placeholder="1F" className="w-full p-3 border rounded-lg bg-slate-50" value={siteForm.floor || ''} onChange={e => setSiteForm({ ...siteForm, floor: e.target.value })} required />
                                </div>
                                <div className="col-span-3">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">공사명</label>
                                    <input type="text" placeholder="예: 프라다 리뉴얼" className="w-full p-3 border rounded-lg bg-slate-50" value={siteForm.name || ''} onChange={e => setSiteForm({ ...siteForm, name: e.target.value })} required />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">담당 부서</label>
                                <input type="text" placeholder="예: 명품잡화팀" className="w-full p-3 border rounded-lg bg-slate-50" value={siteForm.department || ''} onChange={e => setSiteForm({ ...siteForm, department: e.target.value })} required />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1">세부 위치</label>
                                <input type="text" placeholder="예: ES 상행 앞" className="w-full p-3 border rounded-lg bg-slate-50" value={siteForm.location || ''} onChange={e => setSiteForm({ ...siteForm, location: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">시작일</label>
                                    <input type="date" className="w-full p-3 border rounded-lg bg-slate-50" value={siteForm.startDate || ''} onChange={e => setSiteForm({ ...siteForm, startDate: e.target.value })} required />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 mb-1">종료일</label>
                                    <input type="date" className="w-full p-3 border rounded-lg bg-slate-50" value={siteForm.endDate || ''} onChange={e => setSiteForm({ ...siteForm, endDate: e.target.value })} required />
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold mt-4">
                                {isEditing ? '수정 완료' : '등록하기'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* 삭제 확인 모달 (Custom Modal) */}
            {deleteTargetId && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl transform transition-all scale-100">
                        <div className="flex flex-col items-center text-center mb-6">
                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 mb-4">
                                <AlertTriangle size={24} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 mb-2">현장 정보 삭제</h3>
                            <p className="text-slate-500 text-sm leading-relaxed">
                                정말로 이 현장 정보를 삭제하시겠습니까?<br />
                                <span className="text-red-500 font-medium">삭제된 데이터는 복구할 수 없습니다.</span>
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setDeleteTargetId(null)}
                                className="flex-1 py-3 rounded-xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
                            >
                                취소
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-200"
                            >
                                삭제
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 이미지 확대 모달 */}
            {selectedImage && (
                <div className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage} className="max-w-full max-h-[90vh] rounded-lg" alt="Full size" />
                </div>
            )}
        </div>
    );
};

export default Dashboard;
