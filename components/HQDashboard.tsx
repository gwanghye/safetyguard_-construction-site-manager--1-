import React, { useState, useEffect, useMemo } from 'react';
import { Store, Site, InspectionLog, RiskLevel, Role } from '../types';
import { subscribeToAllSites, subscribeToAllLogs, updateSite } from '../services/firestore';
import { generateProjectFinalReport } from '../services/aiService';
import { ArrowLeft, BrainCircuit, Activity, Navigation, Building2, HardHat, ShieldCheck, Briefcase, RefreshCw, BarChart3, AlertTriangle, CalendarClock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts';

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
    const [isLoading, setIsLoading] = useState(true);

    const [activeTab, setActiveTab] = useState<'overview' | 'reports'>('overview');

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

    // Fetch Global Data
    useEffect(() => {
        const unsubSites = subscribeToAllSites(setSites);
        const unsubLogs = subscribeToAllLogs((data) => {
            setLogs(data);
            setIsLoading(false);
        });
        return () => {
            unsubSites();
            unsubLogs();
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
    const storeDataMap = new Map<string, { storeName: string, count: number }>();
    stores.forEach(s => storeDataMap.set(s.id, { storeName: s.name, count: 0 }));
    
    filteredSites.forEach(site => {
        if (storeDataMap.has(site.storeId)) {
            storeDataMap.get(site.storeId)!.count += 1;
        }
    });

    const storeChartData = Array.from(storeDataMap.values())
        .filter(d => d.count > 0)
        .sort((a, b) => b.count - a.count); // sort descending

    // 4. Logs per store
    const storeLogMap = new Map<string, { storeName: string, count: number }>();
    stores.forEach(s => storeLogMap.set(s.id, { storeName: s.name, count: 0 }));

    filteredLogs.forEach(log => {
        // We need to map log -> site -> store.
        // Wait, log doesn't have storeId, but we added storeId in firestore.ts recent update.
        // However, older logs might not have it. Let's lookup via site.
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
                </div>

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
                                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <Building2 size={16} /> 지점별 공사 건수
                                        </h3>
                                        <div className="h-64 w-full">
                                            {storeChartData.length > 0 ? (
                                                <ResponsiveContainer>
                                                    <BarChart data={storeChartData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                        <XAxis dataKey="storeName" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={60} />
                                                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                        <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Bar dataKey="count" name="공사 건수" fill={COLORS.MOH} radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-slate-400 text-sm">해당 기간 데이터가 없습니다.</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* 지점별 점검 수행 건수 */}
                                    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                                        <h3 className="font-bold text-slate-700 mb-4 flex items-center gap-2">
                                            <Navigation size={16} /> 지점별 통합 점검 횟수
                                        </h3>
                                        <div className="h-64 w-full">
                                            {storeLogChartData.length > 0 ? (
                                                <ResponsiveContainer>
                                                    <BarChart data={storeLogChartData}>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                                        <XAxis dataKey="storeName" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={60} />
                                                        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                                        <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                                        <Bar dataKey="count" name="점검 횟수" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
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
                                        <h3 className="font-bold text-slate-700 mb-2 whitespace-nowrap self-start">주체별 점검 비율</h3>
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
                                        <h3 className="font-bold text-slate-700 mb-2 whitespace-nowrap self-start">위험 수준 분포 분석</h3>
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
                                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-2">
                                        <BrainCircuit className="text-indigo-600" /> AI 안전관리 최종 분석
                                    </h2>
                                    <p className="text-sm text-slate-500">종료된 공사에 대한 전체 점검 이력을 분석하여 최종 평가 보고서를 수동으로 생성 및 보관합니다.</p>
                                </div>

                                <div className="space-y-4">
                                    {completedSites.length === 0 ? (
                                        <div className="text-center py-20 text-slate-400 border border-slate-200 border-dashed rounded-xl bg-white">
                                            종료된 공사 현장이 없습니다.
                                        </div>
                                    ) : (
                                        completedSites.map(site => {
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
                    </>
                )}
            </main>
        </div>
    );
};

export default HQDashboard;
