import React, { useState, useEffect, useMemo } from 'react';
import { Store, Site, InspectionLog, RiskLevel, Role, RiskAssessmentLog, RiskAssessmentStatus } from '../types';
import { subscribeToAllSites, subscribeToAllLogs, updateSite, subscribeToAllRiskAssessments } from '../services/firestore';
import { generateProjectFinalReport } from '../services/aiService';
import { RiskAssessment } from './RiskAssessment';
import { ArrowLeft, BrainCircuit, Activity, Navigation, Building2, HardHat, ShieldCheck, Briefcase, RefreshCw, BarChart3, AlertTriangle, CalendarClock, Filter, Search as SearchIcon, X, CalendarDays, CheckCircle2, Download, FileCheck2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid, Legend } from 'recharts';

interface HQDashboardProps {
    stores: Store[];
    onExit: () => void;
}

const COLORS = {
    MOH: '#4f46e5', // INDIGO for general
    FACILITY: '#3b82f6', // BLUE
    SAFETY: '#10b981', // EMERALD
    SALES: '#8b5cf6', // PURPLE
    SUPPORT: '#64748b', // SLATE
    NORMAL: '#3b82f6', // BLUE
    CAUTION: '#f59e0b', // AMBER
    WARNING: '#ef4444', // RED
};

const HQDashboard: React.FC<HQDashboardProps> = ({ stores, onExit }) => {
    const [sites, setSites] = useState<Site[]>([]);
    const [logs, setLogs] = useState<InspectionLog[]>([]);
    const [assessments, setAssessments] = useState<RiskAssessmentLog[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'overview' | 'reports' | 'archive' | 'storeDetail'>('overview');

    // Date Filters (Default to this month)
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setDate(1); // First day of month
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState<string>(() => {
        const d = new Date(); // Today
        return d.toISOString().split('T')[0];
    });

    const [generatingReportId, setGeneratingReportId] = useState<string | null>(null);

    // --- Detail View State ---
    const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
    const [selectedArchiveAssessment, setSelectedArchiveAssessment] = useState<RiskAssessmentLog | null>(null);

    // --- Reports Filter State ---
    const [reportStoreFilter, setReportStoreFilter] = useState<string>('ALL');
    const [reportSearchQuery, setReportSearchQuery] = useState<string>('');
    const [globalInsight, setGlobalInsight] = useState<string>("");
    const [isAnalyzingInsight, setIsAnalyzingInsight] = useState(false);

    // Fetch Global Data
    useEffect(() => {
        const unsubSites = subscribeToAllSites(setSites);
        const unsubLogs = subscribeToAllLogs((data) => {
            setLogs(data);
            setIsLoading(false);
        });
        const unsubAssess = subscribeToAllRiskAssessments(setAssessments);
        return () => {
            unsubSites();
            unsubLogs();
            unsubAssess();
        };
    }, []);

    // Filter Logs by Date
    const filteredLogs = useMemo(() => {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        return logs.filter(log => {
            const logDate = new Date(log.timestamp);
            return logDate >= start && logDate <= end;
        });
    }, [logs, startDate, endDate]);

    // Filter Sites by Date (if they were active during this period)
    const filteredSites = useMemo(() => {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        return sites.filter(site => {
            const siteStart = new Date(site.startDate);
            const siteEnd = new Date(site.endDate);
            // Site was active if its start is before our end, and its end is after our start
            return siteStart <= end && siteEnd >= start;
        });
    }, [sites, startDate, endDate]);

    // --- Metrics for Overview ---
    
    // 1. Total Sites globally during period
    const totalSitesCount = filteredSites.length;
    // 2. Total Inspections globally during period
    const totalLogsCount = filteredLogs.length;

    // 3. Sites per store
    const storeDataMap = new Map<string, { storeId: string, storeName: string, count: number }>();
    stores.forEach(s => storeDataMap.set(s.id, { storeId: s.id, storeName: s.name, count: 0 }));
    
    filteredSites.forEach(site => {
        if (storeDataMap.has(site.storeId)) {
            storeDataMap.get(site.storeId)!.count += 1;
        }
    });

    const storeChartData = Array.from(storeDataMap.values())
        .filter(d => d.count > 0)
        .sort((a, b) => b.count - a.count); // sort descending

    // 4. Logs per store
    const storeLogMap = new Map<string, { storeId: string, storeName: string, count: number }>();
    stores.forEach(s => storeLogMap.set(s.id, { storeId: s.id, storeName: s.name, count: 0 }));

    filteredLogs.forEach(log => {
        const site = sites.find(s => s.id === log.siteId);
        const storeId = (log as any).storeId || site?.storeId;
        
        if (storeId && storeLogMap.has(storeId)) {
            storeLogMap.get(storeId)!.count += 1;
        }
    });

    const storeLogChartData = Array.from(storeLogMap.values())
        .filter(d => d.count > 0)
        .sort((a, b) => b.count - a.count);

    // 5. Logs by Role
    const roleMap = { FACILITY: 0, SAFETY: 0, SALES: 0, SUPPORT: 0 };
    filteredLogs.forEach(log => {
        if (roleMap[log.inspectorRole] !== undefined) {
            roleMap[log.inspectorRole]++;
        }
    });
    const roleChartData = [
        { name: '시설관리', value: roleMap.FACILITY, color: COLORS.FACILITY },
        { name: '안전관리', value: roleMap.SAFETY, color: COLORS.SAFETY },
        { name: '영업관리', value: roleMap.SALES, color: COLORS.SALES },
    ].filter(d => d.value > 0);

    // 6. Risk Distribution
    const riskMap = { [RiskLevel.NORMAL]: 0, [RiskLevel.CAUTION]: 0, [RiskLevel.WARNING]: 0 };
    filteredLogs.forEach(log => {
        riskMap[log.riskLevel]++;
    });
    const riskChartData = [
        { name: '정상', value: riskMap[RiskLevel.NORMAL], color: COLORS.NORMAL },
        { name: '주의', value: riskMap[RiskLevel.CAUTION], color: COLORS.CAUTION },
        { name: '위험', value: riskMap[RiskLevel.WARNING], color: COLORS.WARNING },
    ].filter(d => d.value > 0);

    // --- Reports for Completed Sites ---
    const todayDate = new Date();
    todayDate.setHours(0,0,0,0);
    const completedSites = sites.filter(site => {
        const end = new Date(site.endDate);
        return end < todayDate || site.status === '완료';
    }).sort((a,b) => new Date(b.endDate).getTime() - new Date(a.endDate).getTime());

    const filteredCompletedSites = useMemo(() => {
        return completedSites.filter(site => {
            const matchesStore = reportStoreFilter === 'ALL' || site.storeId === reportStoreFilter;
            const matchesSearch = site.name.toLowerCase().includes(reportSearchQuery.toLowerCase()) || 
                                  site.department.toLowerCase().includes(reportSearchQuery.toLowerCase());
            return matchesStore && matchesSearch;
        });
    }, [completedSites, reportStoreFilter, reportSearchQuery]);

    const handleGenerateReport = async (site: Site) => {
        setGeneratingReportId(site.id);
        const siteLogs = logs.filter(l => l.siteId === site.id);
        const report = await generateProjectFinalReport({ name: site.name, department: site.department }, siteLogs);
        
        try {
            await updateSite({ ...site, finalReport: report });
        } catch(e) {
            console.error(e);
            alert("보고서 저장에 실패했습니다.");
        } finally {
            setGeneratingReportId(null);
        }
    };

    // --- Store Detail Calculations ---
    const selectedStore = selectedStoreId ? stores.find(s => s.id === selectedStoreId) : null;
    const storeSites = selectedStoreId ? filteredSites.filter(s => s.storeId === selectedStoreId) : [];
    
    // Store Logs
    const storeLogs = selectedStoreId ? filteredLogs.filter(log => {
        const site = sites.find(s => s.id === log.siteId);
        const sId = (log as any).storeId || site?.storeId;
        return sId === selectedStoreId;
    }) : [];

    // Daily Stacked Chart Data
    const dailyChartData = useMemo(() => {
        if (!selectedStoreId) return [];
        const dailyMap = new Map<string, { date: string, SALES: number, SAFETY: number, FACILITY: number }>();
        
        // Initialize map with all dates in range
        const start = new Date(startDate);
        const end = new Date(endDate);
        for(let d = start; d <= end; d.setDate(d.getDate() + 1)) {
            const yyyymmdd = d.toISOString().split('T')[0];
            const displayDate = `${d.getMonth()+1}/${d.getDate()}`; // short format M/D
            dailyMap.set(yyyymmdd, { date: displayDate, SALES: 0, SAFETY: 0, FACILITY: 0 });
        }

        storeLogs.forEach(log => {
            // log.timestamp is a number (ms since epoch). Convert to yyyy-mm-dd safely.
            const d = new Date(log.timestamp);
            const yyyymmdd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            // Use ISO split as fallback just in case: new Date(log.timestamp).toISOString().split('T')[0] 
            // Note: toISOString() uses UTC, so generating local strings like above is more accurate for daily filtering, 
            // but the startDate/endDate uses UTC-based toISOString(). Let's align with that.
            const isoDate = new Date(log.timestamp - (new Date().getTimezoneOffset() * 60000)).toISOString().split('T')[0];
            
            if (dailyMap.has(isoDate)) {
                const dayData = dailyMap.get(isoDate)!;
                if (log.inspectorRole === 'SALES' || log.inspectorRole === 'SAFETY' || log.inspectorRole === 'FACILITY') {
                     dayData[log.inspectorRole]++;
                }
            }
        });

        return Array.from(dailyMap.values());
    }, [storeLogs, startDate, endDate, selectedStoreId]);

    const goStoreDetail = (storeId: string) => {
        setSelectedStoreId(storeId);
        setActiveTab('storeDetail');
    };

    const handleDownloadCSV = () => {
        const headers = ["지점명", "공사명", "부서", "기안자", "상태", "작성일"];
        const rows = assessments.map(a => {
            const site = sites.find(s => s.id === a.siteId);
            const storeName = stores.find(s => s.id === site?.storeId)?.name || '알수없음';
            const statusLabel = a.status === RiskAssessmentStatus.APPROVED ? '최종승인' : '진행중';
            return [
                storeName,
                a.siteName,
                a.department,
                a.authorName,
                statusLabel,
                new Date(a.timestamp).toLocaleDateString()
            ].join(",");
        });
        const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers.join(",") + "\n" + rows.join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `전사_수시위험성평가_대장_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const generateInsightSummary = async () => {
        if (isAnalyzingInsight) return;
        setIsAnalyzingInsight(true);
        try {
            const { generateRiskAssessmentInsights } = await import('../services/aiService');
            // Filter assessments based on current selected branch
            const targetAssessments = assessments.filter(a => !selectedStoreId || sites.find(s => s.id === a.siteId)?.storeId === selectedStoreId);
            const insight = await generateRiskAssessmentInsights(targetAssessments);
            setGlobalInsight(insight);
        } catch (e) {
            console.error(e);
            alert("인사이트 생성 중 오류가 발생했습니다.");
        } finally {
            setIsAnalyzingInsight(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24">
            {/* Header */}
            <header className="sticky top-0 z-30 bg-indigo-900 text-white px-4 py-4 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                    <div className="bg-white/20 p-2 rounded-lg">
                        <Activity size={20} className="text-indigo-100" />
                    </div>
                    <div>
                        <h1 className="font-bold text-lg leading-tight tracking-wide">본사 통합 관리자</h1>
                        <p className="text-xs text-indigo-300 font-medium">전점 통합 현황 대시보드</p>
                    </div>
                </div>
                <button
                    onClick={onExit}
                    className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold flex items-center gap-2 transition-colors"
                >
                    <ArrowLeft size={16} /> 나가기
                </button>
            </header>

            <main className="max-w-4xl mx-auto p-4 md:p-6">
                
                {/* Tabs */}
                {activeTab !== 'storeDetail' && (
                    <div className="flex bg-slate-200 p-1 rounded-xl mb-6 shadow-sm overflow-x-auto no-scrollbar">
                        <button
                            onClick={() => setActiveTab('overview')}
                            className={`flex-1 min-w-[120px] py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'overview' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <BarChart3 size={16} /> 데이터 분석
                        </button>
                        <button
                            onClick={() => setActiveTab('reports')}
                            className={`flex-1 min-w-[120px] py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'reports' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <BrainCircuit size={16} /> 완료 보고서
                        </button>
                        <button
                            onClick={() => setActiveTab('archive')}
                            className={`flex-1 min-w-[120px] py-3 text-sm font-bold rounded-lg flex items-center justify-center gap-2 transition-all ${activeTab === 'archive' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                        >
                            <FileCheck2 size={16} /> 수시평가 보관함
                        </button>
                    </div>
                )}

                {/* Date Filter Configuration */}
                {activeTab === 'overview' && (
                    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6 flex flex-col md:flex-row items-center justify-between gap-4">
                        <div className="font-bold text-slate-700 flex items-center gap-2">
                            <CalendarClock size={18} className="text-indigo-500" /> 분석 기간 설정
                        </div>
                        <div className="flex items-center gap-2 w-full md:w-auto">
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={e => setStartDate(e.target.value)}
                                className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 flex-1 md:flex-none"
                            />
                            <span className="text-slate-400 font-bold">~</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={e => setEndDate(e.target.value)}
                                className="bg-slate-50 border border-slate-200 p-2 rounded-lg text-sm font-medium focus:ring-2 focus:ring-indigo-500 flex-1 md:flex-none"
                            />
                        </div>
                    </div>
                )}

                {isLoading ? (
                    <div className="flex justify-center py-20 text-indigo-500">
                        <RefreshCw className="animate-spin" size={32} />
                    </div>
                ) : (
                    <>
                        {/* --- TAB: OVERVIEW --- */}
                        {activeTab === 'overview' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                
                                {/* Totals KPIs */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center">
                                        <div className="text-slate-500 text-xs font-bold mb-1">총 등록 공사수</div>
                                        <div className="text-3xl font-black text-indigo-600">{totalSitesCount}</div>
                                        <div className="text-[10px] text-slate-400 mt-1">설정 기간 내</div>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center">
                                        <div className="text-slate-500 text-xs font-bold mb-1">총 점검 수행</div>
                                        <div className="text-3xl font-black text-emerald-600">{totalLogsCount}</div>
                                        <div className="text-[10px] text-slate-400 mt-1">건 (설정 기간 내)</div>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center">
                                        <div className="text-slate-500 text-xs font-bold mb-1">위험 발생 건수</div>
                                        <div className="text-3xl font-black text-red-500">{riskMap[RiskLevel.WARNING]}</div>
                                        <div className="text-[10px] text-slate-400 mt-1">경고 등급</div>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col justify-center items-center">
                                        <div className="text-slate-500 text-xs font-bold mb-1">비조치 공사</div>
                                        <div className="text-3xl font-black text-amber-500">
                                            {filteredSites.filter(s => !logs.some(l => l.siteId === s.id)).length}
                                        </div>
                                        <div className="text-[10px] text-slate-400 mt-1">점검 이력 없음</div>
                                    </div>
                                </div>

                                {/* Main Charts Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    
                                    {/* 점별 등록 공사수 */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                                <Building2 size={16} /> 지점별 공사 건수
                                            </h3>
                                            <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md font-medium">클릭하여 상세 보기</span>
                                        </div>
                                        <div className="h-64 w-full">
                                            {storeChartData.length > 0 ? (
                                                <ResponsiveContainer>
                                                    <BarChart data={storeChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                        <XAxis dataKey="storeName" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={40} />
                                                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                        <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Bar 
                                                            dataKey="count" 
                                                            name="공사 건수" 
                                                            fill={COLORS.MOH} 
                                                            radius={[6, 6, 0, 0]} 
                                                            onClick={(data) => goStoreDetail(data.storeId)}
                                                            className="cursor-pointer hover:opacity-80 transition-opacity"
                                                        />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">해당 기간 데이터가 없습니다.</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 지점별 점검 수행 건수 */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                        <div className="flex justify-between items-center mb-4">
                                            <h3 className="font-bold text-slate-700 flex items-center gap-2">
                                                <Navigation size={16} /> 지점별 점검 수행 건수
                                            </h3>
                                            <span className="text-xs text-indigo-500 bg-indigo-50 px-2 py-1 rounded-md font-medium">클릭하여 상세 보기</span>
                                        </div>
                                        <div className="h-64 w-full">
                                            {storeLogChartData.length > 0 ? (
                                                <ResponsiveContainer>
                                                    <BarChart data={storeLogChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                        <XAxis dataKey="storeName" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={40} />
                                                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                        <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Bar 
                                                            dataKey="count" 
                                                            name="점검 횟수" 
                                                            fill="#8b5cf6" 
                                                            radius={[6, 6, 0, 0]}
                                                            onClick={(data) => goStoreDetail(data.storeId)}
                                                            className="cursor-pointer hover:opacity-80 transition-opacity"
                                                        />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">해당 기간 데이터가 없습니다.</div>
                                            )}
                                        </div>
                                    </div>
                                    
                                </div>

                                {/* Pie Charts Row */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    
                                    {/* 점검 주체별 비율 */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                                        <h3 className="font-bold text-slate-700 mb-2 whitespace-nowrap self-start">전체 주체별 점검 비율</h3>
                                        <div className="h-56 w-full relative">
                                            {roleChartData.length > 0 ? (
                                                <ResponsiveContainer>
                                                    <PieChart>
                                                        <Pie data={roleChartData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value" stroke="none">
                                                            {roleChartData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">해당 기간 데이터가 없습니다.</div>
                                            )}
                                        </div>
                                        {/* Legend */}
                                        <div className="flex gap-4 text-xs font-bold mt-2">
                                            {roleChartData.map(d => (
                                                <div key={d.name} className="flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></span>
                                                    <span className="text-slate-600">{d.name} ({d.value})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* 위험도 분포 비율 */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex flex-col items-center">
                                        <h3 className="font-bold text-slate-700 mb-2 whitespace-nowrap self-start">전체 위험 수준 분포 분석</h3>
                                        <div className="h-56 w-full relative">
                                            {riskChartData.length > 0 ? (
                                                <ResponsiveContainer>
                                                    <PieChart>
                                                        <Pie data={riskChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none">
                                                            {riskChartData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                                            ))}
                                                        </Pie>
                                                        <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                    </PieChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">해당 기간 데이터가 없습니다.</div>
                                            )}
                                        </div>
                                        {/* Legend */}
                                        <div className="flex gap-4 text-xs font-bold mt-2">
                                            {riskChartData.map(d => (
                                                <div key={d.name} className="flex items-center gap-1">
                                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }}></span>
                                                    <span className="text-slate-600">{d.name} ({d.value})</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                </div>
                            </div>
                        )}

                        {/* --- TAB: REPORTS --- */}
                        {activeTab === 'reports' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
                                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 mb-6">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                        <div>
                                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                                                <BrainCircuit className="text-indigo-600" /> AI 안전관리 최종 분석
                                            </h2>
                                            <p className="text-sm text-slate-500">종료된 공사에 대한 전체 점검 이력을 분석하여 최종 평가를 보관합니다.</p>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2">
                                            <div className="relative">
                                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <select
                                                    value={reportStoreFilter}
                                                    onChange={e => setReportStoreFilter(e.target.value)}
                                                    className="w-full sm:w-40 pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                                                >
                                                    <option value="ALL">전체 지점</option>
                                                    {stores.map(store => (
                                                        <option key={store.id} value={store.id}>{store.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="relative">
                                                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                <input
                                                    type="text"
                                                    placeholder="공사명 검색..."
                                                    value={reportSearchQuery}
                                                    onChange={e => setReportSearchQuery(e.target.value)}
                                                    className="w-full sm:w-48 pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                                />
                                                {reportSearchQuery && (
                                                    <button onClick={() => setReportSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                        <X size={14} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {filteredCompletedSites.length === 0 ? (
                                        <div className="text-center py-20 text-slate-400 border border-slate-200 border-dashed rounded-xl bg-white">
                                            검색 결과가 없거나 종료된 공사 현장이 없습니다.
                                        </div>
                                    ) : (
                                        filteredCompletedSites.map(site => {
                                            const storeName = stores.find(s => s.id === site.storeId)?.name || '알 수 없음';
                                            return (
                                                <div key={site.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col md:flex-row">
                                                    <div className="p-5 md:w-1/3 bg-slate-50 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col justify-center">
                                                        <div className="text-xs font-bold text-indigo-500 mb-1">{storeName}</div>
                                                        <h3 className="font-bold text-slate-800 text-lg mb-1">{site.name}</h3>
                                                        <div className="text-xs text-slate-500 mb-3">{site.department} <span className="mx-1">|</span> {site.startDate} ~ {site.endDate}</div>
                                                        
                                                        {site.finalReport ? (
                                                            <div className="mt-auto pt-4 flex items-center gap-2 text-emerald-600 text-xs font-bold">
                                                                <ShieldCheck size={14} /> 작성 완료됨
                                                            </div>
                                                        ) : (
                                                            <button 
                                                                onClick={() => handleGenerateReport(site)}
                                                                disabled={generatingReportId === site.id}
                                                                className="mt-auto w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold shadow-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                                            >
                                                                {generatingReportId === site.id ? (
                                                                    <RefreshCw size={16} className="animate-spin" />
                                                                ) : (
                                                                    <>AI 평가 생성</>
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="p-5 md:w-2/3 flex flex-col justify-center min-h-[120px]">
                                                        {site.finalReport ? (
                                                            <div className="text-sm font-medium text-slate-700 leading-relaxed p-4 bg-indigo-50/50 rounded-lg border border-indigo-50">
                                                                "{site.finalReport}"
                                                            </div>
                                                        ) : (
                                                            <div className="text-center text-slate-400 text-sm flex flex-col items-center">
                                                                <Activity size={24} className="opacity-20 mb-2" />
                                                                아직 생성된 최종 보고서가 없습니다.<br/>
                                                                버튼을 눌러 분석을 시작하세요.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        })
                                    )}
                                </div>
                            </div>
                        )}

                        {/* --- TAB: ARCHIVE --- */}
                        {activeTab === 'archive' && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 relative">
                               {selectedArchiveAssessment ? (
                                   <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden relative">
                                        <RiskAssessment 
                                          site={sites.find(s => s.id === selectedArchiveAssessment.siteId)!}
                                          currentRole={Role.SUPPORT}
                                          existingAssessment={selectedArchiveAssessment}
                                          approverMode={undefined}
                                          onBack={() => setSelectedArchiveAssessment(null)}
                                          storeName={stores.find(s => s.id === sites.find(site => site.id === selectedArchiveAssessment.siteId)?.storeId)?.name}
                                        />
                                   </div>
                               ) : (
                                   <>
                                       <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                                            <div className="flex-1">
                                                <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-1">
                                                    <FileCheck2 className="text-indigo-600" /> 수시위험성평가 전사 보관함
                                                </h2>
                                                <p className="text-sm text-slate-500">지점별 공사 대비 수시 위험성평가 이행 현황을 모니터링합니다.</p>
                                            </div>
                                            
                                             <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                                                <div className="relative">
                                                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                                    <select
                                                        value={selectedStoreId || 'ALL'}
                                                        onChange={e => {
                                                            setSelectedStoreId(e.target.value === 'ALL' ? null : e.target.value);
                                                            setGlobalInsight(""); // Reset insight on filter change
                                                        }}
                                                        className="w-full sm:w-48 pl-9 pr-8 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none appearance-none cursor-pointer"
                                                    >
                                                        <option value="ALL">전체 지점 보기</option>
                                                        {stores.map(store => (
                                                            <option key={store.id} value={store.id}>{store.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <button 
                                                    onClick={handleDownloadCSV}
                                                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-xl transition-colors border border-emerald-200 shadow-sm whitespace-nowrap text-sm"
                                                >
                                                    <Download size={18} /> CSV 추출
                                                </button>
                                            </div>
                                       </div>

                                       {/* Global/Store Insights metrics section */}
                                       <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                           <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col items-center justify-center">
                                               <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">총 공사 건수</span>
                                               <span className="text-2xl font-black text-slate-800">
                                                   {selectedStoreId ? sites.filter(s => s.storeId === selectedStoreId).length : sites.length}건
                                               </span>
                                           </div>
                                           <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col items-center justify-center">
                                               <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">평가 완료 건수</span>
                                               <span className="text-2xl font-black text-indigo-600">
                                                   {assessments.filter(a => (!selectedStoreId || sites.find(s => s.id === a.siteId)?.storeId === selectedStoreId) && a.status === RiskAssessmentStatus.APPROVED).length}건
                                               </span>
                                           </div>
                                           <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm flex flex-col items-center justify-center">
                                               <span className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">이행률</span>
                                               <span className="text-2xl font-black text-emerald-600">
                                                   {Math.round((assessments.filter(a => (!selectedStoreId || sites.find(s => s.id === a.siteId)?.storeId === selectedStoreId) && a.status === RiskAssessmentStatus.APPROVED).length / 
                                                   (selectedStoreId ? (sites.filter(s => s.storeId === selectedStoreId).length || 1) : (sites.length || 1))) * 100)}%
                                               </span>
                                           </div>
                                           <div className="bg-indigo-600 p-5 rounded-2xl shadow-lg flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-700 transition-colors" onClick={generateInsightSummary}>
                                               <span className="text-[10px] font-bold text-indigo-100 mb-1 uppercase tracking-wider">인사이트 분석</span>
                                               <div className="flex items-center gap-2 text-white font-black text-lg">
                                                   {isAnalyzingInsight ? <RefreshCw size={20} className="animate-spin" /> : <BrainCircuit size={20} />}
                                                   요약 생성
                                               </div>
                                           </div>
                                       </div>

                                       {globalInsight && (
                                           <div className="bg-indigo-50 border border-indigo-200 p-5 rounded-2xl mb-6 animate-in slide-in-from-top-2 duration-300">
                                               <h4 className="text-xs font-bold text-indigo-500 mb-2 flex items-center gap-2">
                                                   <Activity size={14} /> 안전관리 현황 통찰(HQ Insight)
                                               </h4>
                                               <p className="text-sm font-bold text-slate-800 leading-relaxed italic">
                                                   "{globalInsight}"
                                               </p>
                                           </div>
                                       )}

                                       <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                          <table className="w-full text-left border-collapse text-sm whitespace-nowrap">
                                              <thead>
                                                  <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                                                      <th className="p-4">지점/공사명</th>
                                                      <th className="p-4">기안자/부서</th>
                                                      <th className="p-4">평가 헤드라인 (특이사항)</th>
                                                      <th className="p-4 text-center">상태</th>
                                                  </tr>
                                              </thead>
                                              <tbody className="divide-y divide-slate-100">
                                                  {assessments.filter(a => !selectedStoreId || sites.find(s => s.id === a.siteId)?.storeId === selectedStoreId).length === 0 ? (
                                                      <tr><td colSpan={4} className="text-center py-10 text-slate-400 font-medium">조회 가능한 평가서가 없습니다.</td></tr>
                                                  ) : assessments
                                                    .filter(a => !selectedStoreId || sites.find(s => s.id === a.siteId)?.storeId === selectedStoreId)
                                                    .sort((a,b) => b.timestamp - a.timestamp)
                                                    .map(a => {
                                                      const site = sites.find(s => s.id === a.siteId);
                                                      const storeName = stores.find(s => s.id === site?.storeId)?.name || '알수없음';
                                                      const isFinished = a.status === RiskAssessmentStatus.APPROVED;
                                                      return (
                                                          <tr 
                                                              key={a.id} 
                                                              className="hover:bg-indigo-50 transition-colors cursor-pointer group"
                                                              onClick={() => setSelectedArchiveAssessment(a)}
                                                          >
                                                              <td className="p-4">
                                                                  <div className="text-[10px] font-bold text-indigo-500 mb-0.5">{storeName}</div>
                                                                  <div className="font-bold text-slate-900 group-hover:text-indigo-700">{a.siteName}</div>
                                                              </td>
                                                              <td className="p-4">
                                                                  <div className="font-medium text-slate-700">{a.authorName}</div>
                                                                  <div className="text-[11px] text-slate-400">{a.department}</div>
                                                              </td>
                                                              <td className="p-4">
                                                                  <div className="max-w-[250px] truncate text-slate-600 italic">
                                                                      {a.notes || '특이사항 없음'}
                                                                  </div>
                                                              </td>
                                                              <td className="p-4 text-center">
                                                                  <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-bold ${isFinished ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                                                                      {isFinished ? '최종승인' : '진행중'}
                                                                  </span>
                                                              </td>
                                                          </tr>
                                                      );
                                                  })}
                                              </tbody>
                                          </table>
                                       </div>
                                   </>
                               )}
                            </div>
                        )}

                        {/* --- TAB: STORE DETAIL (Full Screen Switch) --- */}
                        {activeTab === 'storeDetail' && selectedStore && (
                            <div className="animate-in fade-in slide-in-from-right-8 duration-300">
                                {/* Detail Header */}
                                <div className="mb-6 flex items-center gap-4">
                                    <button
                                        onClick={() => { setActiveTab('overview'); setSelectedStoreId(null); }}
                                        className="p-2 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 rounded-xl shadow-sm transition-colors flex items-center gap-2 font-bold text-sm"
                                    >
                                        <ArrowLeft size={16} /> 대시보드 복귀
                                    </button>
                                    <div>
                                        <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
                                            <Building2 className="text-indigo-600" /> {selectedStore.name} 안전 점검 현황
                                        </h2>
                                        <p className="text-slate-500 text-sm font-medium mt-1">
                                            기간: {startDate} ~ {endDate}
                                        </p>
                                    </div>
                                </div>

                                {/* KPIs */}
                                <div className="grid grid-cols-3 gap-4 mb-6">
                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                                        <div className="text-slate-500 text-xs font-bold mb-1">조회 기간 공사수</div>
                                        <div className="text-2xl font-black text-slate-800">{storeSites.length} <span className="text-sm text-slate-400 font-medium">건</span></div>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                                        <div className="text-slate-500 text-xs font-bold mb-1">총 점검 수행 횟수</div>
                                        <div className="text-2xl font-black text-indigo-600">{storeLogs.length} <span className="text-sm font-medium">번</span></div>
                                    </div>
                                    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 border-l-4 border-l-red-500">
                                        <div className="text-slate-500 text-xs font-bold mb-1">경고(위험) 적발 건수</div>
                                        <div className="text-2xl font-black text-red-500">{storeLogs.filter(l => l.riskLevel === RiskLevel.WARNING).length} <span className="text-sm font-medium">건</span></div>
                                    </div>
                                </div>

                                {/* Daily Timeline Chart (Stacked) */}
                                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                            <CalendarDays size={20} className="text-indigo-500" /> 일별 주체별 점검 참여 현황
                                        </h3>
                                        <div className="flex items-center gap-4 text-xs font-bold">
                                            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-blue-500"></span> 시설</div>
                                            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-emerald-500"></span> 안전</div>
                                            <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-purple-500"></span> 영업</div>
                                        </div>
                                    </div>
                                    <div className="h-64 w-full">
                                        <ResponsiveContainer>
                                            <BarChart data={dailyChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                <Bar dataKey="FACILITY" name="시설 점검" stackId="role" fill={COLORS.FACILITY} radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="SAFETY" name="안전 점검" stackId="role" fill={COLORS.SAFETY} radius={[0, 0, 0, 0]} />
                                                <Bar dataKey="SALES" name="영업 점검" stackId="role" fill={COLORS.SALES} radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    <p className="text-xs text-slate-400 mt-2 text-center bg-slate-50 py-2 rounded-lg">
                                        * 차트의 막대가 낮거나 없는 날은 점검이 수행되지 않았거나 적은 날입니다. 특정 역할의 색상이 빈 날짜를 모니터링 하세요.
                                    </p>
                                </div>

                                {/* Sites Detailed Table */}
                                <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                    <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                                        <h3 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                                            <CheckCircle2 size={20} className="text-indigo-500" /> 공사 현장별 점검 횟수 집계표
                                        </h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left border-collapse">
                                            <thead>
                                                <tr className="bg-slate-50 text-slate-500 text-xs uppercase font-bold border-b border-slate-200">
                                                    <th className="p-4">유형/기간</th>
                                                    <th className="p-4">공사명</th>
                                                    <th className="p-4 text-center">총 점검</th>
                                                    <th className="p-4 text-center">시설 점검</th>
                                                    <th className="p-4 text-center">안전 점검</th>
                                                    <th className="p-4 text-center text-purple-600 bg-purple-50/50 rounded-tl-xl rounded-tr-xl border-b-2 border-purple-200">영업 점검</th>
                                                </tr>
                                            </thead>
                                            <tbody className="text-sm font-medium text-slate-700 divide-y divide-slate-100">
                                                {storeSites.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={6} className="text-center py-10 text-slate-400">등록된 현장이 없습니다.</td>
                                                    </tr>
                                                ) : (
                                                    storeSites.map(site => {
                                                        const siteLogs = storeLogs.filter(l => l.siteId === site.id);
                                                        const facilityCount = siteLogs.filter(l => l.inspectorRole === 'FACILITY').length;
                                                        const safetyCount = siteLogs.filter(l => l.inspectorRole === 'SAFETY').length;
                                                        const salesCount = siteLogs.filter(l => l.inspectorRole === 'SALES').length;
                                                        const totalCount = siteLogs.length;

                                                        return (
                                                            <tr key={site.id} className="hover:bg-slate-50 transition-colors">
                                                                <td className="p-4">
                                                                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded inline-block mb-1">{site.department}</div>
                                                                    <div className="text-[10px] text-slate-400">{site.startDate} ~ {site.endDate}</div>
                                                                </td>
                                                                <td className="p-4 font-bold text-slate-900">{site.name}</td>
                                                                <td className="p-4 text-center">
                                                                    <span className="font-black text-indigo-600 text-base">{totalCount}</span>
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    {facilityCount > 0 ? (
                                                                        <span className="text-blue-600 font-bold px-2 py-1 bg-blue-50 rounded-md">{facilityCount}회</span>
                                                                    ) : (
                                                                        <span className="text-slate-300">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-center">
                                                                    {safetyCount > 0 ? (
                                                                        <span className="text-emerald-600 font-bold px-2 py-1 bg-emerald-50 rounded-md">{safetyCount}회</span>
                                                                    ) : (
                                                                        <span className="text-slate-300">-</span>
                                                                    )}
                                                                </td>
                                                                <td className="p-4 text-center bg-purple-50/20">
                                                                    {salesCount > 0 ? (
                                                                        <span className="text-purple-600 font-bold px-2 py-1 bg-purple-50 rounded-md border border-purple-100">{salesCount}회</span>
                                                                    ) : (
                                                                        <span className="text-red-500 font-bold px-3 py-1 bg-red-50 border border-red-200 rounded-md shadow-sm inline-flex items-center gap-1">
                                                                            <AlertTriangle size={14} /> 0회 (누락)
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </main>
        </div>
    );
};

export default HQDashboard;
