import React, { useState, useEffect } from 'react';
import { InspectionLog, RiskLevel, Site, Role } from '../types';
import { RefreshCw, BrainCircuit, Plus, X, LayoutGrid, ListChecks, Hammer, Edit, CheckCircle2, AlertCircle, Clock, Trash2, Ban, CalendarClock, AlertTriangle, BarChart3, ShieldAlert, Activity, Check, Send, PhoneCall, Smartphone, UserPlus, Minus } from 'lucide-react';
import { generateDailySafetySummary, validateCorrectiveAction } from '../services/aiService';
import { updateLog } from '../services/firestore';
import { sendAlimTalk } from '../services/notification';

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

    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

    const [actionLogId, setActionLogId] = useState<string | null>(null);
    const [actionNotes, setActionNotes] = useState("");
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    const [siteForm, setSiteForm] = useState<Partial<Site>>({
        floor: '1F',
        status: '대기',
        managerPhones: { SALES: [''], SAFETY: [''], FACILITY: [''] }
    });

    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });

    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const todaysLogs = logs.filter(l => {
        const logDate = new Date(l.timestamp);
        const year = logDate.getFullYear();
        const month = String(logDate.getMonth() + 1).padStart(2, '0');
        const day = String(logDate.getDate()).padStart(2, '0');
        const logDateStr = `${year}-${month}-${day}`;
        return logDateStr === selectedDate;
    });

    const warningCount = todaysLogs.filter(l => l.riskLevel === RiskLevel.WARNING).length;
    const facilityChecks = todaysLogs.filter(l => l.inspectorRole === Role.FACILITY).length;
    const safetyChecks = todaysLogs.filter(l => l.inspectorRole === Role.SAFETY).length;
    const salesChecks = todaysLogs.filter(l => l.inspectorRole === Role.SALES).length;

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
        setSiteForm({ floor: '1F', status: '대기', startDate: '', endDate: '', name: '', department: '', location: '', managerPhones: { SALES: [''], SAFETY: [''], FACILITY: [''] } });
        setIsEditing(false);
        setShowSiteForm(true);
    };

    const openEditForm = (site: Site) => {
        setSiteForm({ ...site, managerPhones: site.managerPhones || { SALES: [''], SAFETY: [''], FACILITY: [''] } });
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

    const handlePhoneChange = (role: keyof NonNullable<Site['managerPhones']>, index: number, value: string) => {
        const newPhones = { ...siteForm.managerPhones };
        if (!newPhones[role]) newPhones[role] = [''];
        newPhones[role]![index] = value;
        setSiteForm({ ...siteForm, managerPhones: newPhones });
    };

    const addPhoneField = (role: keyof NonNullable<Site['managerPhones']>) => {
        const newPhones = { ...siteForm.managerPhones };
        if (!newPhones[role]) newPhones[role] = [''];
        newPhones[role]!.push('');
        setSiteForm({ ...siteForm, managerPhones: newPhones });
    };

    const removePhoneField = (role: keyof NonNullable<Site['managerPhones']>, index: number) => {
        const newPhones = { ...siteForm.managerPhones };
        if (newPhones[role] && newPhones[role]!.length > 1) {
            newPhones[role]!.splice(index, 1);
            setSiteForm({ ...siteForm, managerPhones: newPhones });
        }
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (siteForm.name && siteForm.department && siteForm.startDate && siteForm.endDate) {
            
            // Clean up empty phone numbers before saving
            const cleanPhones = {
                SALES: siteForm.managerPhones?.SALES?.filter(p => p.trim() !== '') || [],
                SAFETY: siteForm.managerPhones?.SAFETY?.filter(p => p.trim() !== '') || [],
                FACILITY: siteForm.managerPhones?.FACILITY?.filter(p => p.trim() !== '') || []
            };

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
                    status: siteForm.status || '대기',
                    managerPhones: cleanPhones
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
                    status: '대기',
                    managerPhones: cleanPhones
                };
                onAddSite(site);
            }
            setShowSiteForm(false);
        }
    };

    const submitCorrectiveAction = async () => {
        if (!actionNotes.trim() || !actionLogId) return;
        setIsSubmittingAction(true);
        const log = logs.find(l => l.id === actionLogId);
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

    const handleAlimTalkManual = async () => {
        const activeSites = sortedSites.filter(site => getStatus(site.endDate).status !== 'expired');
        const roles: Role[] = [Role.FACILITY, Role.SAFETY, Role.SALES];
        let totalSent = 0;
        let errors = [];

        alert("알림톡 발송 프로세스를 시작합니다. (환경변수 설정 시 실제 문자 발송)");

        for (const site of activeSites) {
            const siteLogs = todaysLogs.filter(l => l.siteId === site.id);
            const missingRoles = roles.filter(role => !siteLogs.some(l => l.inspectorRole === role));
            
            if (missingRoles.length > 0) {
               const result = await sendAlimTalk(site, missingRoles);
               if (result.success) totalSent++;
               else errors.push(`${site.name}: ${result.message}`);
            }
        }

        if (errors.length > 0) {
           alert(`발송 완료 내역: ${totalSent}건 성공\n일부 오류 발생:\n${errors[0]}`);
        } else if (totalSent > 0) {
           alert(`총 ${totalSent}개 현장에 미점검 알림톡/문자 발송이 성공했습니다!`);
        } else {
           alert("현재 수동으로 알림톡을 발송할 미점검 현장이 없습니다.");
        }
    };

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
        const styles = { expired: "bg-slate-100 text-slate-500 border-slate-200", urgent: "bg-amber-50 text-amber-600 border-amber-200 animate-pulse", active: "bg-blue-50 text-blue-600 border-blue-100" };
        const icons = { expired: <Ban size={10} />, urgent: <CalendarClock size={10} />, active: <CheckCircle2 size={10} /> };

        return (
            <span className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border ${styles[status as keyof typeof styles]}`}>
                {icons[status as keyof typeof icons]}
                {label}
            </span>
        );
    };

    const renderCheckStatusChip = (log: InspectionLog | undefined, roleLabel: string, isMissing: boolean = false) => {
        if (!log) return (
            <div className={`flex items-center gap-1 px-2 py-1 rounded border ${isMissing ? 'text-red-500 bg-red-50 border-red-200 shadow-sm animate-pulse' : 'text-slate-300 bg-slate-50 border-slate-100'}`}>
                {isMissing ? <AlertTriangle size={10} className="text-red-500" /> : <div className="w-2 h-2 rounded-full bg-slate-300"></div>}
                <span className="text-[10px] font-bold">{roleLabel} 미점검</span>
            </div>
        );

        const isWarning = log.riskLevel === RiskLevel.WARNING;
        const colorClass = isWarning ? 'text-red-600 bg-red-50 border-red-100' :
            log.riskLevel === RiskLevel.CAUTION ? 'text-amber-600 bg-amber-50 border-amber-100' :
                'text-emerald-600 bg-emerald-50 border-emerald-100';

        return (
            <div className={`flex items-center gap-1 px-2 py-1 rounded border ${colorClass}`}>
                {isWarning ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
                <span className="text-[10px] font-bold">{roleLabel} 완료</span>
            </div>
        );
    };

    const sortedSites = [...sites]
        .filter(site => {
            const start = new Date(site.startDate);
            const end = new Date(site.endDate);
            const selected = new Date(selectedDate);
            start.setHours(0, 0, 0, 0); end.setHours(0, 0, 0, 0); selected.setHours(0, 0, 0, 0);
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

    const activeSitesToday = sortedSites.filter(site => getStatus(site.endDate).status !== 'expired');
    const getRoleCompletion = (role: Role) => activeSitesToday.filter(site => todaysLogs.some(l => l.siteId === site.id && l.inspectorRole === role)).length;

    return (
        <div className="p-4 md:p-6 pb-24">
            <div className="flex bg-slate-200 p-1 rounded-xl mb-6 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('monitoring')}
                    className={`flex-1 min-w-[100px] py-2.5 text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'monitoring' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutGrid size={16} /> 통합 관제
                </button>
                <button
                    onClick={() => setActiveTab('analysis')}
                    className={`flex-1 min-w-[100px] py-2.5 text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'analysis' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Activity size={16} /> 위험 분석
                </button>
                <button
                    onClick={() => setActiveTab('management')}
                    className={`flex-1 min-w-[100px] py-2.5 text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'management' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <ListChecks size={16} /> 현장 설정
                </button>
            </div>

            {/* --- 1. 실시간 모니터링 탭 --- */}
            {activeTab === 'monitoring' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4 md:gap-0">
                            <div className="flex flex-row justify-between items-center w-full md:w-auto md:flex-col md:items-start">
                                <h2 className="text-xl md:text-2xl font-bold text-slate-900">{storeName || '전체'} 일일 현황</h2>
                                <div className="flex items-center gap-2 md:mt-1">
                                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
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
                            </div>
                        </div>

                        {/* Progress Bars */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                    <Check size={16} className="text-indigo-500"/> 오늘의 점검율 const activeSitesToday = sortedSites.filter(site => getStatus(site.endDate).status !== 'expired');
    const getRoleCompletion = (role: Role) => activeSitesToday.filter(site => todaysLogs.some(l => l.siteId === site.id && l.inspectorRole === role)).length;

    return (
        <div className="p-4 md:p-6 pb-24">
            <div className="flex bg-slate-200 p-1 rounded-xl mb-6 overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('monitoring')}
                    className={`flex-1 min-w-[100px] py-2.5 text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'monitoring' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <LayoutGrid size={16} /> 통합 관제
                </button>
                <button
                    onClick={() => setActiveTab('analysis')}
                    className={`flex-1 min-w-[100px] py-2.5 text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'analysis' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Activity size={16} /> 위험 분석
                </button>
                <button
                    onClick={() => setActiveTab('management')}
                    className={`flex-1 min-w-[100px] py-2.5 text-xs md:text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'management' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <ListChecks size={16} /> 현장 설정
                </button>
            </div>

            {/* --- 1. 실시간 모니터링 탭 --- */}
            {activeTab === 'monitoring' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                        <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-4 md:gap-0">
                            <div className="flex flex-row justify-between items-center w-full md:w-auto md:flex-col md:items-start">
                                <h2 className="text-xl md:text-2xl font-bold text-slate-900">{storeName || '전체'} 일일 현황</h2>
                                <div className="flex items-center gap-2 md:mt-1">
                                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1 text-slate-600 font-bold outline-none focus:ring-2 focus:ring-blue-500" />
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
                            </div>
                        </div>

                        {/* Progress Bars */}
                        <div className="space-y-4 pt-4 border-t border-slate-100">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                    <Check size={16} className="text-indigo-500"/> 오늘의 점검율 [1일 1점검]
                                </h4>
                                <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-1 rounded">진행중 {activeSitesToday.length}건</span>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="flex justify-between text-xs font-bold text-blue-700 mb-1">
                                        <span>시설팀 완료율</span>
                                        <span>{activeSitesToday.length ? Math.round((getRoleCompletion(Role.FACILITY) / activeSitesToday.length) * 100) : 0}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-blue-500 h-full rounded-full transition-all" style={{ width: `${activeSitesToday.length ? (getRoleCompletion(Role.FACILITY) / activeSitesToday.length) * 100 : 0}%` }}></div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="flex justify-between text-xs font-bold text-emerald-700 mb-1">
                                        <span>안전팀 완료율</span>
                                        <span>{activeSitesToday.length ? Math.round((getRoleCompletion(Role.SAFETY) / activeSitesToday.length) * 100) : 0}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${activeSitesToday.length ? (getRoleCompletion(Role.SAFETY) / activeSitesToday.length) * 100 : 0}%` }}></div>
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                                    <div className="flex justify-between text-xs font-bold flex items-center gap-1 mb-1">
                                        <span className="text-purple-700">영업팀 완료율</span>
                                        {activeSitesToday.length > 0 && getRoleCompletion(Role.SALES) < activeSitesToday.length && <AlertTriangle size={12} className="text-red-500 animate-pulse" />}
                                        <span className="ml-auto text-purple-700">{activeSitesToday.length ? Math.round((getRoleCompletion(Role.SALES) / activeSitesToday.length) * 100) : 0}%</span>
                                    </div>
                                    <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                        <div className="bg-purple-500 h-full rounded-full transition-all" style={{ width: `${activeSitesToday.length ? (getRoleCompletion(Role.SALES) / activeSitesToday.length) * 100 : 0}%` }}></div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-center px-1">
                            <h3 className="font-bold text-slate-800 text-lg">실시간 현장별 모니터링</h3>
                            <button onClick={handleAlimTalkManual} className="flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold px-3 py-1.5 rounded-lg border border-indigo-200 shadow-sm transition-colors">
                                <Send size={12} /> 알림톡 수동 발송
                            </button>
                        </div>

                        {sortedSites.length === 0 ? (
                            <div className="text-center py-10 text-slate-400">등록된 현장이 없습니다.</div>
                        ) : (
                            sortedSites.map(site => {
                                const siteLogs = todaysLogs.filter(l => l.siteId === site.id);
                                const facilityLog = siteLogs.find(l => l.inspectorRole === Role.FACILITY);
                                const safetyLog = siteLogs.find(l => l.inspectorRole === Role.SAFETY);
                                const salesLog = siteLogs.find(l => l.inspectorRole === Role.SALES);

                                const workTypeDisplay = safetyLog?.workType || facilityLog?.workType || salesLog?.workType || siteLogs[0]?.workType;
                                const { status } = getStatus(site.endDate);
                                const isMissingSomething = status !== 'expired' && (!facilityLog || !safetyLog || !salesLog);

                                return (
                                    <div key={site.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${status === 'expired' ? 'opacity-60 grayscale-[0.5] order-last' : 'border-slate-200'}`}>
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

                                            <div className="flex gap-2 mt-2">
                                                {renderCheckStatusChip(facilityLog, "시설")}
                                                {renderCheckStatusChip(safetyLog, "안전")}
                                                {renderCheckStatusChip(salesLog, "영업")}
                                            </div>
                                        </div>

                                        {(facilityLog || safetyLog || salesLog) && (
                                            <div className="p-4 bg-slate-50/50">
                                                <div className="space-y-4">
                                                    {workTypeDisplay && (
                                                        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                                                            <Hammer size={14} className="text-indigo-500" />
                                                            <span className="text-xs text-slate-500">진행 작업:</span>
                                                            <span>{workTypeDisplay}</span>
                                                        </div>
                                                    )}

                                                    {siteLogs.map(l => (
                                                        <div key={l.id} className={`p-3 rounded-lg border ${l.riskLevel === RiskLevel.WARNING ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}`}>
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className={`text-xs font-bold ${l.inspectorRole === Role.SAFETY ? 'text-emerald-600' : l.inspectorRole === Role.SALES ? 'text-purple-600' : 'text-blue-600'}`}>
                                                                    [{l.inspectorRole === Role.SAFETY ? '안전' : l.inspectorRole === Role.SALES ? '영업' : '시설'}] 점검자: {l.inspector}
                                                                </span>
                                                                {l.riskLevel === RiskLevel.WARNING && (
                                                                    <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">경고</span>
                                                                )}
                                                            </div>

                                                            {l.notes && <div className="text-sm text-slate-700 mb-2">{l.notes}</div>}
                                                            
                                                            {l.photos.length > 0 && (
                                                                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 mb-2">
                                                                    {l.photos.map((photo, idx) => (
                                                                        <button key={idx} onClick={() => setSelectedImage(photo)} className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200">
                                                                            <img src={photo} className="w-full h-full object-cover" alt="" />
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* 조치 결과 UI (Warning 일 때만) */}
                                                            {l.riskLevel === RiskLevel.WARNING && (
                                                                <div className="mt-3 pt-3 border-t border-red-200/50">
                                                                    {(!l.action || l.action.status === 'PENDING') ? (
                                                                        <button 
                                                                            onClick={() => setActionLogId(l.id)}
                                                                            className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2"
                                                                        >
                                                                            <Hammer size={16} /> 개선 조치 등록하기
                                                                        </button>
                                                                    ) : (
                                                                        <div className="bg-white p-2 rounded border border-emerald-100 text-xs text-slate-700 shadow-sm">
                                                                            <div className="font-bold text-emerald-600 mb-1 flex items-center gap-1"><Check size={12}/> 조치 완료 (AI 승인)</div>
                                                                            <div className="mb-1"><span className="text-slate-400">조치내용:</span> {l.action.actionNotes}</div>
                                                                            <div className="text-[10px] text-slate-400 italic">" {l.action.aiFeedback} "</div>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
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

            {/* --- 2. 위험 분석 (TAB) --- */}
            {activeTab === 'analysis' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex justify-between items-center">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <ShieldAlert className="text-indigo-600" /> 총괄 위험 분석
                        </h2>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="bg-indigo-900 rounded-xl p-5 text-white w-full md:w-1/2 shadow-lg">
                            <div className="flex items-center gap-2 font-bold text-indigo-200 text-sm mb-3"><BrainCircuit size={16} /> AI Summary</div>
                            {loadingAi ? (
                                <p className="animate-pulse text-sm text-indigo-300">리포트 생성중...</p>
                            ) : (
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{aiSummary || '기록이 없습니다.'}</p>
                            )}
                        </div>
                        <div className="w-full md:w-1/2 bg-slate-50 p-5 rounded-xl border border-slate-200">
                             <div className="flex justify-between text-xs font-bold text-slate-500 mb-4">
                                 <span>부적합 분포 (체크리스트 기반)</span>
                                 <span>총 {failureStats.fireSafety + failureStats.electrical + failureStats.ppe + failureStats.environment}건</span>
                             </div>
                             {failureStats.fireSafety + failureStats.electrical + failureStats.ppe + failureStats.environment === 0 ? (
                                <div className="text-xs text-center text-slate-400 py-4">체크리스트상 부적합 항목이 없습니다.</div>
                             ) : (
                                <>
                                    <div className="flex h-4 rounded-full overflow-hidden mb-2 shadow-inner">
                                        <div style={{width: `${(failureStats.electrical/Math.max(1, failureStats.electrical + failureStats.fireSafety + failureStats.ppe + failureStats.environment))*100}%`}} className="bg-amber-400"></div>
                                        <div style={{width: `${(failureStats.fireSafety/Math.max(1, failureStats.electrical + failureStats.fireSafety + failureStats.ppe + failureStats.environment))*100}%`}} className="bg-red-400"></div>
                                        <div style={{width: `${(failureStats.ppe/Math.max(1, failureStats.electrical + failureStats.fireSafety + failureStats.ppe + failureStats.environment))*100}%`}} className="bg-orange-400"></div>
                                        <div style={{width: `${(failureStats.environment/Math.max(1, failureStats.electrical + failureStats.fireSafety + failureStats.ppe + failureStats.environment))*100}%`}} className="bg-blue-400"></div>
                                    </div>
                                    <div className="flex flex-wrap gap-3 text-[10px] font-bold">
                                        <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 bg-amber-400 rounded-sm"></span> 전기</span>
                                        <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 bg-red-400 rounded-sm"></span> 화재</span>
                                        <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 bg-orange-400 rounded-sm"></span> 보호구</span>
                                        <span className="flex items-center gap-1 text-slate-600"><span className="w-2 h-2 bg-blue-400 rounded-sm"></span> 환경</span>
                                    </div>
                                </>
                             )}
                        </div>
                    </div>
                </div>
            )}

            {/* --- 3. 현장 관리 탭 --- */}
            {activeTab === 'management' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-200">
                        <div className="flex items-center gap-3 mb-2">
                            <Smartphone size={24} className="text-indigo-200" />
                            <h2 className="text-lg font-black tracking-wide">점검 알림톡 설정</h2>
                        </div>
                        <p className="text-indigo-100 text-sm mb-4">영업/안전/시설 담당자에게 매일 오후 2시에 미점검 현장 전용 체크인 링크를 발송합니다. 공사 등록 시 입력한 연락처를 기반으로 발송됩니다.</p>
                        <div className="bg-white/10 p-3 rounded-xl border border-white/20 text-xs text-indigo-50 flex justify-between items-center">
                            <span className="font-bold flex items-center gap-2"><CheckCircle2 size={14} className="text-emerald-400"/> 서버 스케줄러: 활성화됨</span>
                            <button onClick={handleAlimTalkManual} className="bg-white text-indigo-700 px-3 py-1.5 rounded-lg font-bold hover:bg-indigo-50 transition-colors shadow-sm">
                                발송 정보 확인
                            </button>
                        </div>
                    </div>

                    <div className="flex justify-between items-center mt-8">
                        <h3 className="font-bold text-slate-800 text-lg">{storeName} 공사 현장 목록</h3>
                        <button onClick={openAddForm} className="bg-slate-900 text-white px-3 py-2 rounded-lg text-sm font-bold flex items-center gap-2 shadow-lg shadow-slate-200 hover:bg-slate-800">
                            <Plus size={16} /> 현장 등록
                        </button>
                    </div>

                    {/* 현장 리스트 */}
                    <div className="space-y-3">
                        {sortedSites.length === 0 ? (
                            <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl">등록된 공사 현장이 없습니다.</div>
                        ) : (
                            sortedSites.map(site => {
                                const { status } = getStatus(site.endDate);
                                const isExpired = status === 'expired';

                                return (
                                    <div key={site.id} className={`bg-white p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm ${isExpired ? 'border-slate-100 bg-slate-50/50' : 'border-slate-200'}`}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 font-bold bg-slate-100`}>
                                                {site.floor}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className={`font-bold text-sm ${isExpired ? 'text-slate-400 decoration-slate-300' : 'text-slate-800'}`}>{site.name}</h4>
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
                                            <button onClick={() => openEditForm(site)} className="px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors font-medium flex items-center gap-1">
                                                <Edit size={14} /> 수정/연락처
                                            </button>
                                            <button onClick={() => handleDeleteClick(site.id)} className="px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-red-50 hover:text-red-600 rounded-lg transition-colors font-medium flex items-center gap-1">
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
                    <div className="bg-white w-full md:max-w-xl rounded-t-2xl md:rounded-2xl p-6 max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-10">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-bold text-slate-900">{isEditing ? '현장 및 연락처 수정' : '신규 현장 등록'}</h3>
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
                            <div className="grid grid-cols-2 gap-3">
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">담당 부서</label>
                                    <input type="text" placeholder="예: 명품잡화팀" className="w-full p-3 border rounded-lg bg-slate-50" value={siteForm.department || ''} onChange={e => setSiteForm({ ...siteForm, department: e.target.value })} required />
                                </div>
                                <div className="col-span-1">
                                    <label className="block text-xs font-bold text-slate-500 mb-1">세부 위치</label>
                                    <input type="text" placeholder="예: ES 상행 앞" className="w-full p-3 border rounded-lg bg-slate-50" value={siteForm.location || ''} onChange={e => setSiteForm({ ...siteForm, location: e.target.value })} />
                                </div>
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

                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><PhoneCall size={16} className="text-indigo-500"/> 알림톡 수신 담당자 연락처</h4>
                                <div className="space-y-4">
                                    {(['SALES', 'SAFETY', 'FACILITY'] as const).map(role => (
                                        <div key={role} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className={`text-xs font-bold ${role === 'SALES' ? 'text-purple-600' : role === 'SAFETY' ? 'text-emerald-600' : 'text-blue-600'}`}>
                                                    {role === 'SALES' ? '영업팀' : role === 'SAFETY' ? '안전팀' : '시설팀'} 담당자
                                                </span>
                                                <button type="button" onClick={() => addPhoneField(role)} className="text-[10px] bg-white border px-2 py-1 rounded shadow-sm flex items-center gap-1 hover:bg-slate-100"><Plus size={10}/> 추가</button>
                                            </div>
                                            <div className="space-y-2">
                                                {(siteForm.managerPhones?.[role] || ['']).map((phone, idx) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            placeholder="010-0000-0000" 
                                                            className="flex-1 p-2 text-sm border rounded-lg bg-white outline-none focus:border-blue-400" 
                                                            value={phone} 
                                                            onChange={(e) => handlePhoneChange(role, idx, e.target.value)} 
                                                        />
                                                        {(siteForm.managerPhones?.[role]?.length || 0) > 1 && (
                                                            <button type="button" onClick={() => removePhoneField(role, idx)} className="p-2 text-red-400 hover:bg-red-50 rounded text-sm"><Minus size={16}/></button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold mt-4 shadow-lg active:scale-95 transition-transform">
                                {isEditing ? '수정 임시 저장' : '현장 및 연락처 세팅 완료'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* 경고 조치 모달 (In Monitoring Tab Context) */}
            {actionLogId && (
                <div className="fixed inset-0 z-[70] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2"><Hammer className="text-red-500" /> 개선 조치 및 AI 검수</h3>
                            <button onClick={() => setActionLogId(null)} className="p-1 hover:bg-slate-100 rounded text-slate-500"><X size={20} /></button>
                        </div>
                        <div className="mb-4 text-sm text-slate-500">
                            어떤 조치를 취했는지 작성해 주세요. 작성 후 AI가 안전 기준에 부합하는지 즉시 검증합니다.
                        </div>
                        <textarea 
                            className="w-full border border-slate-200 rounded-xl p-3 bg-slate-50 min-h-[100px] text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="예: 노출된 전선 정리 및 절연 테이프 마감 완료"
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                        />
                        <button 
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl mt-4 font-bold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                            onClick={submitCorrectiveAction}
                            disabled={isSubmittingAction || !actionNotes.trim()}
                        >
                            {isSubmittingAction ? <RefreshCw className="animate-spin" size={16} /> : <BrainCircuit size={16} />}
                            조치 내용 확인 및 승인 요청
                        </button>
                    </div>
                </div>
            )}

            {deleteTargetId && (
                <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center">
                        <AlertTriangle size={24} className="text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold">삭제 확인</h3>
                        <p className="text-slate-500 text-sm mb-6 mt-2">이 현장과 연락처 데이터를 모두 삭제하시겠습니까?</p>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTargetId(null)} className="flex-1 py-3 bg-slate-100 rounded-xl font-bold">취소</button>
                            <button onClick={confirmDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold">삭제</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedImage && (
                <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
                    <img src={selectedImage} className="max-w-full max-h-[90vh] rounded-lg" alt="Full size" />
                </div>
            )}
        </div>
    );
};

export default Dashboard;
