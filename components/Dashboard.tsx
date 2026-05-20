import React, { useState, useEffect } from 'react';
import { InspectionLog, RiskLevel, Site, Role, RiskAssessmentLog, RiskAssessmentStatus } from '../types';
import { RefreshCw, BrainCircuit, Plus, X, LayoutGrid, ListChecks, Hammer, Edit, CheckCircle2, AlertCircle, Clock, Trash2, Ban, CalendarClock, AlertTriangle, BarChart3, ShieldAlert, Activity, Check, Send, PhoneCall, Smartphone, UserPlus, Minus, FileText, ChevronRight, FileCheck, Map, Upload, Zap, TrendingUp, Wifi } from 'lucide-react';
import { RiskAssessment } from './RiskAssessment';
import { generateDailySafetySummary, validateCorrectiveAction } from '../services/aiService';
import { updateLog } from '../services/firestore';
import { sendAlimTalk } from '../services/notification';
import HistoryTimeline from './HistoryTimeline';
import { hapticLight, hapticMedium, hapticSuccess } from '../utils/haptics';
import PullToRefresh from './PullToRefresh';
import ImageModal from './ImageModal';

interface DashboardProps {
    logs: InspectionLog[];
    sites: Site[];
    assessments: RiskAssessmentLog[];
    onAddSite?: (site: Site) => Promise<void> | void;
    onUpdateSite?: (site: Site) => Promise<void> | void;
    onDeleteSite?: (siteId: string) => Promise<void> | void;
    storeName?: string;
}

interface BeforeAfterSliderProps {
    beforeImg: string;
    afterImg: string;
}

const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({ beforeImg, afterImg }) => {
    const [sliderPosition, setSliderPosition] = useState(50);
    const containerRef = React.useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState(300);

    useEffect(() => {
        if (containerRef.current) {
            setContainerWidth(containerRef.current.getBoundingClientRect().width);
        }
        const handleResize = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.getBoundingClientRect().width);
            }
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleMove = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const position = Math.max(0, Math.min(100, (x / rect.width) * 100));
        setSliderPosition(position);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (e.buttons === 1) {
            handleMove(e.clientX);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (e.touches && e.touches[0]) {
            handleMove(e.touches[0].clientX);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (e.buttons === 1) {
            handleMove(e.clientX);
        }
    };

    return (
        <div 
            ref={containerRef}
            onMouseMove={handleMouseMove}
            onTouchMove={handleTouchMove}
            onPointerMove={handlePointerMove}
            className="relative w-full h-48 select-none overflow-hidden rounded-xl border border-slate-200/60 shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.02)] cursor-ew-resize touch-none"
        >
            {/* After Image (Background) */}
            <img src={afterImg} alt="After" className="absolute inset-0 w-full h-full object-cover pointer-events-none" />

            {/* Before Image (Overlay with dynamic width) */}
            <div 
                className="absolute inset-y-0 left-0 overflow-hidden pointer-events-none border-r-2 border-white shadow-[2px_0_8px_rgba(0,0,0,0.15)]"
                style={{ width: `${sliderPosition}%` }}
            >
                <img 
                    src={beforeImg} 
                    alt="Before" 
                    className="absolute inset-y-0 left-0 h-full object-cover pointer-events-none"
                    style={{ width: containerWidth, maxWidth: 'none' }}
                />
            </div>

            {/* Center Slider Bar Control */}
            <div 
                className="absolute inset-y-0 pointer-events-none flex items-center justify-center"
                style={{ left: `calc(${sliderPosition}% - 12px)` }}
            >
                <div className="w-6 h-6 rounded-full bg-white border border-slate-200 shadow-md flex items-center justify-center text-slate-500 font-semibold text-xs select-none">
                    ↔
                </div>
            </div>
            
            {/* Badges */}
            <div className="absolute top-2 left-2 bg-red-600/80 backdrop-blur-sm text-white font-semibold text-[8px] px-1.5 py-0.5 rounded pointer-events-none tracking-wider">
                조치 전 (Before)
            </div>
            <div className="absolute top-2 right-2 bg-emerald-600/80 backdrop-blur-sm text-white font-semibold text-[8px] px-1.5 py-0.5 rounded pointer-events-none tracking-wider">
                조치 후 (After)
            </div>
        </div>
    );
};

const DefaultFloorPlan: React.FC = () => (
    <svg viewBox="0 0 400 300" className="w-full h-full stroke-slate-700/60 fill-none stroke-[1.5]">
        {/* Outer boundary */}
        <rect x="10" y="10" width="380" height="280" rx="8" className="stroke-indigo-500/20 fill-slate-900/50" />
        
        {/* Department Sections / Zones */}
        <g className="opacity-80">
            {/* Zone A: Luxury / Premium */}
            <rect x="25" y="25" width="90" height="50" rx="6" className="stroke-indigo-500/30 fill-indigo-950/20" />
            <text x="70" y="55" className="text-[7px] font-bold fill-indigo-400/80 stroke-none" textAnchor="middle">LUXURY ZONE</text>
            
            {/* Zone B: Apparel / Fashion */}
            <rect x="130" y="25" width="100" height="50" rx="6" className="stroke-indigo-500/30 fill-indigo-950/20" />
            <text x="180" y="55" className="text-[7px] font-bold fill-indigo-400/80 stroke-none" textAnchor="middle">FASHION ZONE</text>
            
            {/* Zone C: Food Court / F&B */}
            <rect x="245" y="25" width="130" height="50" rx="6" className="stroke-indigo-500/30 fill-indigo-950/20" />
            <text x="310" y="55" className="text-[7px] font-bold fill-indigo-400/80 stroke-none" textAnchor="middle">F&B COURT</text>
            
            {/* Central Aisle layout */}
            <path d="M 25,95 L 375,95 M 25,165 L 375,165" className="stroke-indigo-500/10 stroke-[2] stroke-dasharray-[2_4]" />
            
            {/* Zone D: Electronics / Home */}
            <rect x="25" y="110" width="140" height="45" rx="6" className="stroke-indigo-500/30 fill-indigo-950/20" />
            <text x="95" y="135" className="text-[7px] font-bold fill-indigo-400/80 stroke-none" textAnchor="middle">DIGITAL SQUARE</text>
            
            {/* Zone E: Cosmetics / Beauty */}
            <rect x="180" y="110" width="195" height="45" rx="6" className="stroke-indigo-500/30 fill-indigo-950/20" />
            <text x="277" y="135" className="text-[7px] font-bold fill-indigo-400/80 stroke-none" textAnchor="middle">BEAUTY & HEALTH</text>
            
            {/* Escalators and elevators */}
            <g transform="translate(170, 195)" className="stroke-indigo-400/80">
                <rect x="0" y="0" width="60" height="80" rx="8" className="fill-indigo-950/50 stroke-indigo-500/30" />
                <path d="M 10,20 L 50,60 M 10,60 L 50,20 M 15,10 L 45,10 M 15,70 L 45,70" className="stroke-[1.5]" />
                <text x="30" y="45" className="text-[8px] font-extrabold fill-indigo-300 stroke-none" textAnchor="middle">CORE / ES</text>
            </g>
        </g>
        
        {/* Entrance Gates */}
        <path d="M 10,210 L 10,260" className="stroke-emerald-500/60 stroke-[3]" />
        <text x="25" y="240" className="text-[8px] font-black fill-emerald-400 stroke-none">GATE 1</text>
    </svg>
);

interface DigitalTwinMapProps {
    sites: Site[];
    logs: InspectionLog[];
    onSelectSite: (siteId: string) => void;
    onUpdateSite?: (site: Site) => Promise<void> | void;
}

const DigitalTwinMap: React.FC<DigitalTwinMapProps> = ({ sites, logs, onSelectSite, onUpdateSite }) => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    const activeSitesToday = sites.filter(s => {
        if (s.status === '완료') return false;
        const start = new Date(s.startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(s.endDate);
        end.setHours(23, 59, 59, 999);
        return start <= todayDate && end >= todayDate;
    });

    // Floor tabs generated only from active sites today
    const availableFloors = Array.from(new Set(activeSitesToday.map(s => s.floor.trim().toUpperCase()))).sort();
    const [selectedFloorState, setSelectedFloor] = useState<string>('');
    const selectedFloor = availableFloors.includes(selectedFloorState) ? selectedFloorState : (availableFloors[0] || '1F');

    useEffect(() => {
        if (availableFloors.length > 0 && !availableFloors.includes(selectedFloorState)) {
            setSelectedFloor(availableFloors[0]);
        }
    }, [availableFloors, selectedFloorState]);

    // Sites to show on the map: active today AND matching selected floor
    const floorSites = activeSitesToday.filter(s => s.floor.trim().toUpperCase() === selectedFloor.trim().toUpperCase());

    // Pick the floor plan image for this floor (from any site on this floor, not just today's)
    const floorDrawingUrl = sites.find(s => s.floor.trim().toUpperCase() === selectedFloor.trim().toUpperCase() && s.drawingUrl)?.drawingUrl || null;

    const handleFloorPlanUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !onUpdateSite) return;
        
        const reader = new FileReader();
        reader.onload = async (event) => {
            if (event.target?.result) {
                const newUrl = event.target.result as string;
                // Update all sites on this floor so they share the drawing
                const sitesOnFloor = sites.filter(s => s.floor.trim().toUpperCase() === selectedFloor.trim().toUpperCase());
                for (const s of sitesOnFloor) {
                    await onUpdateSite({ ...s, drawingUrl: newUrl, layoutType: 'custom' });
                }
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                    현장 위치
                    <span className="text-[10px] font-normal text-slate-400 ml-1">
                        금일 공사 {activeSitesToday.length}개 현장
                    </span>
                </h3>

                {/* Floor Selector and Upload */}
                <div className="flex gap-2 items-center">
                    {availableFloors.length > 1 && (
                        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                            {availableFloors.map(fl => (
                                <button
                                    key={fl}
                                    type="button"
                                    onClick={() => setSelectedFloor(fl)}
                                    className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                                        selectedFloor === fl
                                            ? 'bg-white text-indigo-600 shadow-sm'
                                            : 'text-slate-500 hover:text-slate-800'
                                    }`}
                                >
                                    {fl}
                                </button>
                            ))}
                        </div>
                    )}
                    {selectedFloor && onUpdateSite && (
                        <label className="cursor-pointer px-2 py-1 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors">
                            <Upload size={12} />
                            도면 등록
                            <input type="file" accept="image/*" className="hidden" onChange={handleFloorPlanUpload} />
                        </label>
                    )}
                </div>
            </div>

            {activeSitesToday.length === 0 ? (
                <div className="h-[200px] flex flex-col items-center justify-center text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-xl">
                    <Map size={32} className="mb-2 opacity-30" />
                    금일 활성화된 공사 현장이 없습니다.
                </div>
            ) : (
                <>
                    {/* Flat Map Arena */}
                    <div className="relative w-full bg-slate-50 rounded-xl overflow-hidden flex items-center justify-center border border-slate-200 shadow-inner select-none" style={{ height: 280 }}>
                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:24px_24px] opacity-50" />
                        
                        {/* 2D Wrapper */}
                        <div className="relative w-full h-full p-2 flex items-center justify-center">
                            {/* Floor Plan Base */}
                            <div className="absolute inset-2 bg-white rounded-xl border border-indigo-100 p-1 shadow-sm overflow-hidden flex items-center justify-center">
                                {floorDrawingUrl ? (
                                    <img src={floorDrawingUrl} alt="Floor Plan" className="w-full h-full object-contain" />
                                ) : (
                                    <DefaultFloorPlan />
                                )}
                            </div>

                            {/* Markers */}
                            {floorSites.map(site => {
                                const siteLogs = logs.filter(l => l.siteId === site.id);
                                const hasWarning = siteLogs.some(l => l.riskLevel === '경고' && l.action?.status !== 'RESOLVED');
                                const hasCaution = siteLogs.some(l => l.riskLevel === '주의' && l.action?.status !== 'RESOLVED');
                                const x = site.mapX ?? 50;
                                const y = site.mapY ?? 50;
                                return (
                                    <div
                                        key={site.id}
                                        className="absolute cursor-pointer group z-10"
                                        style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%,-50%)' }}
                                        onClick={() => onSelectSite(site.id)}
                                    >
                                        <div className="relative flex flex-col items-center">
                                            <div className="absolute bottom-6 bg-slate-900/90 text-white border border-slate-700 text-[9px] font-bold px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-30">
                                                {site.name}
                                            </div>
                                            <div className={`w-4 h-4 rounded-full flex items-center justify-center shadow-md border border-white/80 group-hover:scale-125 transition-transform text-white font-extrabold text-[7px] ${
                                                hasWarning ? 'bg-rose-500 animate-pulse ring-2 ring-rose-500/50'
                                                    : hasCaution ? 'bg-amber-500 ring-2 ring-amber-500/30'
                                                    : 'bg-indigo-500 ring-2 ring-indigo-500/20'
                                            }`}>{site.floor}</div>
                                            {hasWarning && (
                                                <div className="absolute inset-0 w-4 h-4 rounded-full border opacity-50 pointer-events-none"
                                                    style={{ borderColor: '#ef4444', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite' }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Legend — compact */}
                    <div className="flex gap-3 text-[10px] text-slate-500 font-bold px-1">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" /> 경고</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> 주의</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-500" /> 정상</span>
                        <span className="text-slate-400 ml-auto">마커 클릭 시 해당 현장으로 이동</span>
                    </div>
                </>
            )}
        </div>
    );
};

const parseInlineMarkdownDark = (text: string) => {
    const parts = text.split('**');
    return parts.map((part, i) => {
        if (i % 2 === 1) {
            return <strong key={i} className="font-bold text-yellow-300">{part}</strong>;
        }
        return part;
    });
};

const renderFormattedText = (text: string) => {
    if (!text) return null;

    // Clean up code block ticks if any
    const cleanText = text.replace(/```markdown/gi, '').replace(/```/g, '');
    const lines = cleanText.split('\n');
    const elements: React.ReactNode[] = [];
    let i = 0;

    const isDividerLine = (l: string) => {
        const trimmed = l.trim();
        if (!trimmed.includes('|')) return false;
        const parts = trimmed.split('|').map(p => p.trim());
        const cleanParts = parts.filter((p, idx) => {
            if (idx === 0 && p === '') return false;
            if (idx === parts.length - 1 && p === '') return false;
            return true;
        });
        return cleanParts.length > 0 && cleanParts.every(p => /^[:-]+$/.test(p));
    };

    while (i < lines.length) {
        const line = lines[i];
        const cleanLine = line.trim();

        // 1. Markdown Table Parsing
        const nextLine = i + 1 < lines.length ? lines[i + 1] : '';
        const looksLikeTable = cleanLine.includes('|') && (
            cleanLine.startsWith('|') || 
            (nextLine && nextLine.includes('|') && isDividerLine(nextLine))
        );

        if (looksLikeTable) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].includes('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }

            const parsedRows: string[][] = [];
            let hasHeaders = false;

            tableLines.forEach((tLine) => {
                const parts = tLine.split('|').map(s => s.trim());
                if (parts.length > 0 && parts[0] === '') parts.shift();
                if (parts.length > 0 && parts[parts.length - 1] === '') parts.pop();

                const isDivider = parts.every(p => /^[:-]+$/.test(p));
                if (isDivider) {
                    hasHeaders = true;
                    return;
                }

                parsedRows.push(parts);
            });

            if (parsedRows.length > 0) {
                let headers: string[] = [];
                let bodyRows: string[][] = [];
                if (hasHeaders && parsedRows.length > 0) {
                    headers = parsedRows[0];
                    bodyRows = parsedRows.slice(1);
                } else {
                    bodyRows = parsedRows;
                }

                elements.push(
                    <div key={`table-${i}`} className="my-3 rounded-xl border border-indigo-800/60 overflow-hidden shadow-md">
                        {/* 헤더 행 */}
                        {headers.length > 0 && (
                            <div className="grid bg-indigo-950/70 border-b border-indigo-800/40" style={{ gridTemplateColumns: `repeat(${headers.length}, minmax(0, 1fr))` }}>
                                {headers.map((h, idx) => (
                                    <div key={idx} className="px-3 py-2 text-[10px] font-extrabold text-indigo-200 uppercase tracking-wide">
                                        {parseInlineMarkdownDark(h)}
                                    </div>
                                ))}
                            </div>
                        )}
                        {/* 데이터 행 */}
                        {bodyRows.map((row, rIdx) => (
                            <div
                                key={rIdx}
                                className={`grid border-b border-indigo-800/20 last:border-b-0 ${rIdx % 2 === 0 ? 'bg-indigo-900/50' : 'bg-indigo-900/30'}`}
                                style={{ gridTemplateColumns: `repeat(${Math.max(headers.length || 1, row.length)}, minmax(0, 1fr))` }}
                            >
                                {row.map((cell, cIdx) => (
                                    <div key={cIdx} className="px-3 py-2 text-xs text-indigo-100 leading-relaxed font-medium">
                                        {parseInlineMarkdownDark(cell)}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                );
            }
            continue;
        }

        // 2. Headers
        if (cleanLine.startsWith('###')) {
            elements.push(<h3 key={i} className="text-sm font-bold text-white mt-4 mb-2">{parseInlineMarkdownDark(cleanLine.replace('###', '').trim())}</h3>);
            i++;
            continue;
        }
        if (cleanLine.startsWith('##')) {
            elements.push(<h2 key={i} className="text-base font-bold text-white mt-5 mb-2.5">{parseInlineMarkdownDark(cleanLine.replace('##', '').trim())}</h2>);
            i++;
            continue;
        }
        if (cleanLine.startsWith('#')) {
            elements.push(<h1 key={i} className="text-lg font-bold text-white mt-6 mb-3.5">{parseInlineMarkdownDark(cleanLine.replace('#', '').trim())}</h1>);
            i++;
            continue;
        }

        // 3. Bullet list items
        if (cleanLine.startsWith('-') || cleanLine.startsWith('*')) {
            const listItems: string[] = [];
            while (i < lines.length && (lines[i].trim().startsWith('-') || lines[i].trim().startsWith('*'))) {
                let item = lines[i].trim();
                item = item.substring(1).trim();
                listItems.push(item);
                i++;
            }
            elements.push(
                <ul key={`list-${i}`} className="list-disc pl-5 my-2.5 space-y-1.5">
                    {listItems.map((item, idx) => (
                        <li key={idx} className="text-xs leading-relaxed text-indigo-100">{parseInlineMarkdownDark(item)}</li>
                    ))}
                </ul>
            );
            continue;
        }

        // 4. Paragraph or spacing
        if (cleanLine) {
            elements.push(<p key={i} className="text-xs leading-relaxed text-indigo-100 min-h-[0.75rem] my-2">{parseInlineMarkdownDark(cleanLine)}</p>);
        } else {
            elements.push(<div key={i} className="h-2" />);
        }
        i++;
    }

    return elements;
};

const Dashboard: React.FC<DashboardProps> = ({ logs, sites, assessments, onAddSite, onUpdateSite, onDeleteSite, storeName }) => {
    const [activeTab, setActiveTab] = useState<'monitoring' | 'analysis' | 'management' | 'risk_assessment'>('monitoring');
    const [selectedRiskSite, setSelectedRiskSite] = useState<Site | null>(null);
    const [aiSummary, setAiSummary] = useState<string>("");
    const [loadingAi, setLoadingAi] = useState(false);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [showSiteForm, setShowSiteForm] = useState(false);
    const [drawingModalSite, setDrawingModalSite] = useState<Site | null>(null);
    const [isEditing, setIsEditing] = useState(false);

    const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
    const [deleteInput, setDeleteInput] = useState("");

    const [actionLogId, setActionLogId] = useState<string | null>(null);
    const [actionNotes, setActionNotes] = useState("");
    const [isSubmittingAction, setIsSubmittingAction] = useState(false);

    const [selectedHistorySiteId, setSelectedHistorySiteId] = useState<string | null>(null);

    const [siteForm, setSiteForm] = useState<Partial<Site>>({
        floor: '1F',
        status: '대기',
        managerPhones: { SALES: [''], SAFETY: [''], FACILITY: [''], SUPPORT: [''], SALES_TL: [''], SUPPORT_TL: [''], STORE_MANAGER: [''] }
    });

    const [selectedDate, setSelectedDate] = useState<string>(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    });

    const scrollToSite = (siteId: string) => {
        const el = document.getElementById(`site-card-${siteId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('ring-4', 'ring-indigo-500/80', 'transition-all', 'duration-300');
            setTimeout(() => {
                el.classList.remove('ring-4', 'ring-indigo-500/80');
            }, 2500);
        }
    };

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
        const cacheKey = `ai_summary_${storeName || 'all'}_${selectedDate}`;
        const cached = localStorage.getItem(cacheKey);
        if (cached) {
            setAiSummary(cached);
        } else {
            setAiSummary("");
        }
    }, [selectedDate, storeName]);

    useEffect(() => {
        if (activeTab === 'analysis' && todaysLogs.length > 0) {
            const cacheKey = `ai_summary_${storeName || 'all'}_${selectedDate}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                setAiSummary(cached);
            } else if (!aiSummary) {
                handleAiSummary(false);
            }
        }
    }, [activeTab, todaysLogs.length, selectedDate]);

    const handleAiSummary = async (force = false) => {
        setLoadingAi(true);
        const cacheKey = `ai_summary_${storeName || 'all'}_${selectedDate}`;
        if (!force) {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                setAiSummary(cached);
                setLoadingAi(false);
                return;
            }
        }
        const dateParts = selectedDate.split('-');
        const dateStr = dateParts.length === 3 ? `${parseInt(dateParts[1])}월 ${parseInt(dateParts[2])}일` : selectedDate;
        const summary = await generateDailySafetySummary(todaysLogs, dateStr);
        setAiSummary(summary);
        localStorage.setItem(cacheKey, summary);
        setLoadingAi(false);
    };

    const openAddForm = () => {
        setSiteForm({ 
            floor: '1F', 
            status: '대기', 
            startDate: '', 
            endDate: '', 
            name: '', 
            department: '', 
            location: '', 
            managerPhones: { 
                SALES: [''], 
                SAFETY: [''], 
                FACILITY: [''], 
                SUPPORT: [''],
                SALES_TL: [''],
                SUPPORT_TL: [''],
                STORE_MANAGER: ['']
            },
            layoutType: 'rectangular',
            drawingUrl: '',
            mapX: 50,
            mapY: 50
        });
        setIsEditing(false);
        setShowSiteForm(true);
    };

    const openEditForm = (site: Site) => {
        setSiteForm({ 
            ...site, 
            managerPhones: site.managerPhones || { 
                SALES: [''], 
                SAFETY: [''], 
                FACILITY: [''], 
                SUPPORT: [''],
                SALES_TL: [''],
                SUPPORT_TL: [''],
                STORE_MANAGER: ['']
            } 
        });
        setIsEditing(true);
        setShowSiteForm(true);
    };

    const handleDeleteClick = (siteId: string) => {
        setDeleteTargetId(siteId);
        setDeleteInput("");
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

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (event.target?.result) {
                setSiteForm(prev => ({ ...prev, drawingUrl: event.target.result as string, layoutType: 'custom' }));
            }
        };
        reader.readAsDataURL(file);
    };

    // Draggable pin handler: click on map preview to set X/Y position
    const handleMapPinClick = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
        const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
        setSiteForm(prev => ({ ...prev, mapX: Math.max(2, Math.min(98, x)), mapY: Math.max(2, Math.min(98, y)) }));
    };

    const handleFormSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (siteForm.name && siteForm.department && siteForm.startDate && siteForm.endDate) {
            
            // Clean up empty phone numbers before saving
            const cleanPhones = {
                SALES: siteForm.managerPhones?.SALES?.filter(p => p.trim() !== '') || [],
                SAFETY: siteForm.managerPhones?.SAFETY?.filter(p => p.trim() !== '') || [],
                FACILITY: siteForm.managerPhones?.FACILITY?.filter(p => p.trim() !== '') || [],
                SALES_TL: siteForm.managerPhones?.SALES_TL?.filter(p => p.trim() !== '') || [],
                SUPPORT_TL: siteForm.managerPhones?.SUPPORT_TL?.filter(p => p.trim() !== '') || [],
                STORE_MANAGER: siteForm.managerPhones?.STORE_MANAGER?.filter(p => p.trim() !== '') || []
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
                    managerPhones: cleanPhones,
                    layoutType: siteForm.layoutType || 'rectangular',
                    drawingUrl: siteForm.drawingUrl || '',
                    mapX: siteForm.mapX !== undefined ? siteForm.mapX : 50,
                    mapY: siteForm.mapY !== undefined ? siteForm.mapY : 50
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
                    managerPhones: cleanPhones,
                    layoutType: siteForm.layoutType || 'rectangular',
                    drawingUrl: siteForm.drawingUrl || '',
                    mapX: siteForm.mapX !== undefined ? siteForm.mapX : 50,
                    mapY: siteForm.mapY !== undefined ? siteForm.mapY : 50
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
                hapticSuccess();
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

        if (errors.length > 0) alert(`완료! 발송: ${totalSent}건, 실패: ${errors.length}건`);
        else {
            hapticSuccess();
            alert(`전체 점검 독려 알림톡(${totalSent}건) 발송 완료!`);
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

    const isRiskAssessmentExempt = (site: Site) => new Date(site.endDate) < new Date('2026-04-20');
    const approvedRiskAssessments = assessments.filter(a => a.status === RiskAssessmentStatus.APPROVED);
    const exemptSites = sites.filter(s => isRiskAssessmentExempt(s) && !approvedRiskAssessments.some(a => a.siteId === s.id));
    const pendingRiskSites = sites.filter(s => !isRiskAssessmentExempt(s) && !assessments.some(a => a.siteId === s.id && a.status === RiskAssessmentStatus.APPROVED));

    // AI Safety Predictive Index (0~100) — computed from today's logs
    const safetyIndex = (() => {
        if (todaysLogs.length === 0) return null;
        const totalChecks = todaysLogs.length * 4; // 4 checklist items
        const passedChecks = todaysLogs.reduce((acc, l) => {
            return acc + (l.checklist.ppe ? 1 : 0) + (l.checklist.fireSafety ? 1 : 0)
                       + (l.checklist.electrical ? 1 : 0) + (l.checklist.environment ? 1 : 0);
        }, 0);
        const warningPenalty = todaysLogs.filter(l => l.riskLevel === RiskLevel.WARNING && l.action?.status !== 'RESOLVED').length * 10;
        const cautionPenalty = todaysLogs.filter(l => l.riskLevel === RiskLevel.CAUTION && l.action?.status !== 'RESOLVED').length * 4;
        const base = Math.round((passedChecks / totalChecks) * 100);
        return Math.max(0, Math.min(100, base - warningPenalty - cautionPenalty));
    })();

    // Live feed: last 15 inspection events across all sites, newest first
    const liveFeedItems = [...logs]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 15);


    return (
        <PullToRefresh onRefresh={() => window.location.reload()}>
            <div className="p-4 md:p-6 pb-24">
                <div className="flex bg-slate-100/80 backdrop-blur-md p-1 border border-slate-200/50 rounded-2xl mb-6 overflow-x-auto no-scrollbar gap-1 shadow-sm">
                    {[
                        { id: 'monitoring', label: '통합 관제', icon: LayoutGrid },
                        { id: 'analysis', label: '위험 분석', icon: Activity },
                        { id: 'management', label: '현장 설정', icon: ListChecks },
                        { id: 'risk_assessment', label: '마무리 점검', icon: FileText },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => { hapticLight(); setActiveTab(tab.id as any); }}
                            className={`flex-1 min-w-[100px] py-2.5 text-xs md:text-sm font-semibold rounded-xl flex items-center justify-center gap-2 transition-all duration-300
                                ${activeTab === tab.id 
                                    ? 'bg-white text-indigo-600 shadow-[0_2px_8px_rgba(0,0,0,0.04)] ring-1 ring-slate-900/[0.04] scale-[1.01]' 
                                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'}
                            `}
                        >
                            <tab.icon size={16} />
                            {tab.label}
                        </button>
                    ))}
                </div>

            {activeTab === 'risk_assessment' && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">

                    {selectedRiskSite ? (
                        <div className="fixed inset-0 z-[100] bg-white overflow-y-auto">
                            <RiskAssessment 
                                site={selectedRiskSite} 
                                currentRole={Role.SUPPORT} 
                                onBack={() => setSelectedRiskSite(null)} 
                                storeName={storeName}
                                existingAssessment={assessments.find(a => a.siteId === selectedRiskSite.id) || (isRiskAssessmentExempt(selectedRiskSite) ? { 
                                     id: 'exempt', siteId: selectedRiskSite.id, siteName: selectedRiskSite.name, authorName: '자동 완료', department: selectedRiskSite.department || '미상', constructionPeriod: `${selectedRiskSite.startDate} ~ ${selectedRiskSite.endDate}`, timestamp: Date.now(), status: RiskAssessmentStatus.APPROVED, checklist: { ceiling: '양호', floor: '양호', wall: '양호', equipment: '양호', fireSafety: '양호', electrical: '양호', others: '양호' }, notes: '26.04.20 이전 시행 현장으로 인한 수시위험성평가 면제 (자동 완료 처리됨)' } as any : undefined)}
                            />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                                <h2 className="text-xl font-bold text-slate-900 mb-2 whitespace-pre-wrap">공사 마무리 점검 (수시위험성평가) 보관함</h2>
                                <p className="text-sm text-slate-500">완료된 수시위험성평가 내역을 확인하고 결재 상태를 볼 수 있습니다.</p>
                            </div>
                            <div className="space-y-3">
                                {approvedRiskAssessments.length === 0 && exemptSites.length === 0 ? (
                                    <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50">조회 가능한 완료된 보관함이 없습니다.</div>
                                ) : (
                                    <>
                                        {approvedRiskAssessments.map(assessment => {
                                            const site = sites.find(s => s.id === assessment.siteId);
                                            return (
                                                <button key={assessment.id} onClick={() => site && setSelectedRiskSite(site)} className="w-full bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center hover:border-blue-300 hover:bg-blue-50 transition-all group">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-inner">
                                                            <CheckCircle2 size={18} />
                                                        </div>
                                                        <div className="text-left">
                                                            <h4 className="font-bold text-slate-800 text-sm group-hover:text-blue-700">{site?.name || assessment.siteName}</h4>
                                                            <div className="text-xs text-slate-500 mt-1">{assessment.department} | {assessment.authorName} | {new Date(assessment.timestamp).toLocaleDateString()}</div>
                                                        </div>
                                                    </div>
                                                    <ChevronRight className="text-slate-300 group-hover:text-blue-500" />
                                                </button>
                                            )
                                        })}
                                        {exemptSites.map(site => (
                                            <button key={site.id} onClick={() => setSelectedRiskSite(site)} className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center hover:border-emerald-300 hover:bg-emerald-50 transition-all group opacity-80">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold bg-slate-200 text-slate-500 border border-slate-300 shadow-inner">
                                                        <CheckCircle2 size={18} />
                                                    </div>
                                                    <div className="text-left">
                                                        <h4 className="font-bold text-slate-700 text-sm group-hover:text-emerald-700">{site.name} <span className="text-[10px] text-emerald-600 font-bold ml-1 bg-emerald-100 px-1.5 py-0.5 rounded">평가 면제</span></h4>
                                                        <div className="text-xs text-slate-500 mt-1">{site.department} | 26년 4월 20일 이전 현장 자동 완료됨</div>
                                                    </div>
                                                </div>
                                                <ChevronRight className="text-slate-300 group-hover:text-emerald-500" />
                                            </button>
                                        ))}
                                    </>
                                )}
                                
                                <div className="pt-8 border-t border-slate-200">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">현재 진행 중인 현장 (결재/조회용)</h4>
                                    <div className="space-y-3">
                                        {pendingRiskSites.length === 0 ? (
                                            <div className="text-center py-6 text-slate-400 text-sm">진행 중인 현장이 없습니다.</div>
                                        ) : (
                                            pendingRiskSites.map(site => (
                                                <button key={site.id} onClick={() => setSelectedRiskSite(site)} className="w-full bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center hover:border-indigo-300 hover:bg-white transition-all group">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold bg-white text-slate-400 border border-slate-200">{site.floor}</div>
                                                        <div className="text-left">
                                                            <h4 className="font-bold text-slate-600 text-sm">{site.name}</h4>
                                                            <div className="text-xs text-slate-400 mt-1">{site.department} | {site.endDate} 종료</div>
                                                        </div>
                                                    </div>
                                                    <div className="px-2 py-1 bg-white border border-slate-200 text-slate-400 rounded-lg text-[10px] font-bold">결재 대기/확인</div>
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}


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

                    <DigitalTwinMap sites={sites} logs={logs} onSelectSite={scrollToSite} onUpdateSite={onUpdateSite} />

                    {/* ─── AI Safety Predictive Index + Live Feed ─── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                        {/* AI Safety Index Ring */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col items-center justify-center gap-3">
                            <div className="flex items-center gap-2 self-start w-full">
                                <TrendingUp size={15} className="text-indigo-500" />
                                <span className="text-sm font-bold text-slate-800">AI 안전 지수</span>
                                <span className="text-[10px] text-slate-400 font-medium ml-auto">오늘 점검 기반</span>
                            </div>
                            {safetyIndex === null ? (
                                <div className="flex flex-col items-center gap-2 py-4">
                                    <div className="w-20 h-20 rounded-full border-4 border-slate-100 flex items-center justify-center">
                                        <span className="text-slate-300 text-xs font-bold">데이터<br/>없음</span>
                                    </div>
                                    <p className="text-[11px] text-slate-400">오늘 점검 데이터가 없습니다</p>
                                </div>
                            ) : (() => {
                                const r = 38;
                                const circ = 2 * Math.PI * r;
                                const dash = (safetyIndex / 100) * circ;
                                const color = safetyIndex >= 80 ? '#22c55e' : safetyIndex >= 60 ? '#f59e0b' : '#ef4444';
                                const label = safetyIndex >= 80 ? '안전' : safetyIndex >= 60 ? '주의' : '위험';
                                return (
                                    <div className="flex flex-col items-center gap-3 w-full">
                                        <div className="relative w-28 h-28">
                                            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                                                <circle cx="50" cy="50" r={r} fill="none" stroke="#f1f5f9" strokeWidth="10" />
                                                <circle
                                                    cx="50" cy="50" r={r} fill="none"
                                                    stroke={color} strokeWidth="10"
                                                    strokeLinecap="round"
                                                    strokeDasharray={`${dash} ${circ}`}
                                                    style={{ transition: 'stroke-dasharray 1s ease' }}
                                                />
                                            </svg>
                                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                <span className="text-2xl font-extrabold text-slate-900">{safetyIndex}</span>
                                                <span className="text-[10px] font-bold" style={{ color }}>{label}</span>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-2 w-full text-center">
                                            <div className="bg-red-50 rounded-xl py-2 px-1">
                                                <div className="text-xs font-extrabold text-red-600">{todaysLogs.filter(l => l.riskLevel === RiskLevel.WARNING).length}</div>
                                                <div className="text-[9px] text-red-400 font-bold">경고</div>
                                            </div>
                                            <div className="bg-amber-50 rounded-xl py-2 px-1">
                                                <div className="text-xs font-extrabold text-amber-600">{todaysLogs.filter(l => l.riskLevel === RiskLevel.CAUTION).length}</div>
                                                <div className="text-[9px] text-amber-400 font-bold">주의</div>
                                            </div>
                                            <div className="bg-emerald-50 rounded-xl py-2 px-1">
                                                <div className="text-xs font-extrabold text-emerald-600">{todaysLogs.filter(l => l.riskLevel === RiskLevel.NORMAL).length}</div>
                                                <div className="text-[9px] text-emerald-400 font-bold">정상</div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>

                        {/* Live Activity Feed */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col gap-3">
                            <div className="flex items-center gap-2">
                                <Wifi size={15} className="text-emerald-500" />
                                <span className="text-sm font-bold text-slate-800">실시간 활동 피드</span>
                                <span className="flex items-center gap-1 ml-auto">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                    <span className="text-[10px] text-emerald-500 font-bold">LIVE</span>
                                </span>
                            </div>
                            {liveFeedItems.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-300 py-6 gap-2">
                                    <Zap size={28} className="opacity-30" />
                                    <span className="text-xs">아직 점검 활동이 없습니다</span>
                                </div>
                            ) : (
                                <div className="space-y-1.5 overflow-y-auto max-h-[210px] pr-1">
                                    {liveFeedItems.map((item, idx) => {
                                        const site = sites.find(s => s.id === item.siteId);
                                        const roleLabel = item.inspectorRole === Role.FACILITY ? '시설' : item.inspectorRole === Role.SAFETY ? '안전' : item.inspectorRole === Role.SALES ? '영업' : '지원';
                                        const roleColor = item.inspectorRole === Role.FACILITY ? 'bg-blue-100 text-blue-700' : item.inspectorRole === Role.SAFETY ? 'bg-emerald-100 text-emerald-700' : item.inspectorRole === Role.SALES ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600';
                                        const riskColor = item.riskLevel === RiskLevel.WARNING ? 'text-red-500' : item.riskLevel === RiskLevel.CAUTION ? 'text-amber-500' : 'text-emerald-500';
                                        const elapsed = (() => {
                                            const diff = Date.now() - item.timestamp;
                                            const m = Math.floor(diff / 60000);
                                            if (m < 1) return '방금 전';
                                            if (m < 60) return `${m}분 전`;
                                            const h = Math.floor(m / 60);
                                            if (h < 24) return `${h}시간 전`;
                                            return `${Math.floor(h / 24)}일 전`;
                                        })();
                                        return (
                                            <div key={item.id} className={`flex items-start gap-2.5 p-2.5 rounded-xl border border-slate-50 bg-slate-50/60 hover:bg-slate-100/60 transition-colors ${idx === 0 ? 'ring-1 ring-indigo-200/60' : ''}`}>
                                                <span className={`text-[9px] font-extrabold px-1.5 py-0.5 rounded-md mt-0.5 shrink-0 ${roleColor}`}>{roleLabel}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex justify-between items-center gap-1">
                                                        <span className="text-[11px] font-bold text-slate-700 truncate">{site?.name || item.siteName}</span>
                                                        <span className={`text-[9px] font-bold shrink-0 ${riskColor}`}>{item.riskLevel}</span>
                                                    </div>
                                                    <div className="text-[10px] text-slate-400 truncate">{item.inspector} · {elapsed}</div>
                                                    {item.notes && <div className="text-[10px] text-slate-500 mt-0.5 truncate">{item.notes}</div>}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
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
                                    <div key={site.id} id={`site-card-${site.id}`} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${status === 'expired' ? 'opacity-60 grayscale-[0.5] order-last' : 'border-slate-200'}`}>
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
                                                <button onClick={() => setSelectedHistorySiteId(site.id)} className="flex items-center gap-1.5 text-xs bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm transition-colors whitespace-nowrap">
                                                    <Clock size={12} /> 전체 이력
                                                </button>
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
                                                        <div key={l.id} className={`p-4 rounded-xl border transition-all duration-300 ${
                                                            l.riskLevel === RiskLevel.WARNING 
                                                            ? 'bg-rose-50/90 backdrop-blur-sm border-rose-200 ring-1 ring-rose-950/[0.05] shadow-[0_1px_2px_rgba(244,63,94,0.05),0_4px_16px_rgba(244,63,94,0.05)] animate-in fade-in slide-in-from-bottom-2' 
                                                            : 'bg-white/90 backdrop-blur-sm border border-slate-200/60 ring-1 ring-slate-950/[0.02] shadow-[0_1px_2px_rgba(0,0,0,0.02),0_4px_16px_rgba(0,0,0,0.02)] hover:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_24px_rgba(0,0,0,0.04)]'
                                                        }`}>
                                                            <div className="flex justify-between items-start mb-1.5">
                                                                <span className={`text-xs font-bold ${l.inspectorRole === Role.SAFETY ? 'text-emerald-600' : l.inspectorRole === Role.SALES ? 'text-purple-600' : 'text-blue-600'}`}>
                                                                    [{l.inspectorRole === Role.SAFETY ? '안전' : l.inspectorRole === Role.SALES ? '영업' : '시설'}] 점검자: {l.inspector}
                                                                </span>
                                                                {l.riskLevel === RiskLevel.WARNING && (
                                                                    <span className="bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm animate-pulse">경고</span>
                                                                )}
                                                            </div>

                                                            {l.notes && <div className="text-sm text-slate-700 mb-2.5 font-medium leading-relaxed">{l.notes}</div>}
                                                            
                                                            {l.photos.length > 0 && (
                                                                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 mb-2.5">
                                                                    {l.photos.map((photo, idx) => (
                                                                        <button key={idx} onClick={() => setSelectedImage(photo)} className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-400 transition-colors shadow-sm">
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
                                                                            className="w-full py-2 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm"
                                                                        >
                                                                            <Hammer size={14} /> 개선 조치 등록하기
                                                                        </button>
                                                                    ) : (
                                                                        <div className="bg-white p-3 rounded-lg border border-emerald-100 text-xs text-slate-700 shadow-sm space-y-2">
                                                                            <div className="font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={12}/> 조치 완료 (AI 승인)</div>
                                                                            
                                                                            {/* Before/After Photo Comparison */}
                                                                            {((l.photos && l.photos.length > 0) || (l.action.resolvedPhotos && l.action.resolvedPhotos.length > 0) || l.action.photoUrl) && (
                                                                                <div className="my-2">
                                                                                    {l.photos && l.photos[0] && (l.action.resolvedPhotos?.[0] || l.action.photoUrl) ? (
                                                                                        <BeforeAfterSlider 
                                                                                            beforeImg={l.photos[0]} 
                                                                                            afterImg={l.action.resolvedPhotos?.[0] || l.action.photoUrl || ""} 
                                                                                        />
                                                                                    ) : (
                                                                                        <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2 rounded-lg border border-slate-100">
                                                                                            <div className="flex flex-col items-center">
                                                                                                <span className="text-[9px] font-bold text-red-500 mb-1">조치 전 (Before)</span>
                                                                                                {l.photos && l.photos[0] ? (
                                                                                                    <button onClick={() => setSelectedImage(l.photos[0])} className="w-full h-20 rounded-lg overflow-hidden border border-red-200 hover:border-red-400 transition-colors">
                                                                                                        <img src={l.photos[0]} className="w-full h-full object-cover" alt="Before" />
                                                                                                    </button>
                                                                                                ) : (
                                                                                                    <div className="w-full h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 text-[10px]">사진 없음</div>
                                                                                                )}
                                                                                            </div>
                                                                                            <div className="flex flex-col items-center">
                                                                                                <span className="text-[9px] font-bold text-emerald-500 mb-1">조치 후 (After)</span>
                                                                                                {l.action.resolvedPhotos && l.action.resolvedPhotos[0] ? (
                                                                                                    <button onClick={() => setSelectedImage(l.action.resolvedPhotos[0])} className="w-full h-20 rounded-lg overflow-hidden border border-emerald-200 hover:border-emerald-400 transition-colors">
                                                                                                        <img src={l.action.resolvedPhotos[0]} className="w-full h-full object-cover" alt="After" />
                                                                                                    </button>
                                                                                                ) : l.action.photoUrl ? (
                                                                                                    <button onClick={() => setSelectedImage(l.action.photoUrl)} className="w-full h-20 rounded-lg overflow-hidden border border-emerald-200 hover:border-emerald-400 transition-colors">
                                                                                                        <img src={l.action.photoUrl} className="w-full h-full object-cover" alt="After" />
                                                                                                    </button>
                                                                                                ) : (
                                                                                                    <div className="w-full h-20 bg-slate-100 rounded-lg flex items-center justify-center text-slate-300 text-[10px]">사진 없음</div>
                                                                                                )}
                                                                                            </div>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )}

                                                                            <div className="mb-1"><span className="text-slate-400 font-bold">조치내용:</span> {l.action.actionNotes}</div>
                                                                            {l.action.aiFeedback && (
                                                                                <div className="text-[10px] text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-100">
                                                                                    " {l.action.aiFeedback} "
                                                                                </div>
                                                                            )}
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
                            <div className="flex items-center justify-between font-bold text-indigo-200 text-sm mb-3">
                                <span className="flex items-center gap-2">
                                    <BrainCircuit size={16} /> 일일 보고서 ({(() => {
                                        const dateParts = selectedDate.split('-');
                                        return dateParts.length === 3 ? `${parseInt(dateParts[1])}월 ${parseInt(dateParts[2])}일` : selectedDate;
                                    })()})
                                </span>
                                {todaysLogs.length > 0 && (
                                    <button 
                                        onClick={() => handleAiSummary(true)} 
                                        disabled={loadingAi}
                                        className="p-1 hover:bg-white/10 rounded text-indigo-300 hover:text-white transition-colors animate-none"
                                        title="AI 분석 새로고침"
                                    >
                                        <RefreshCw size={14} className={loadingAi ? "animate-spin" : ""} />
                                    </button>
                                )}
                            </div>
                            {loadingAi ? (
                                <p className="animate-pulse text-sm text-indigo-300">리포트 생성중...</p>
                            ) : (
                                <div className="space-y-2">{renderFormattedText(aiSummary) || <p className="text-sm text-indigo-200">기록이 없습니다.</p>}</div>
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
                                        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap justify-end">
                                            <button onClick={() => setDrawingModalSite(site)} className="px-3 py-1.5 text-sm text-slate-600 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors font-medium flex items-center gap-1">
                                                <Map size={14} /> 도면 보기
                                            </button>
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
                                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2"><PhoneCall size={16} className="text-indigo-500"/> 현장 담당자 연락처 (점검 완료 알림)</h4>
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

                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <h4 className="text-sm font-bold text-indigo-600 mb-3 flex items-center gap-2"><FileCheck size={16} /> 수시위험성평가 결재권자 연락처 (결재 요청 알림)</h4>
                                <div className="space-y-3">
                                    {[
                                        { key: 'SALES_TL', label: '영업팀장' },
                                        { key: 'SUPPORT_TL', label: '지원팀장' },
                                        { key: 'STORE_MANAGER', label: '점장' }
                                    ].map(approver => (
                                        <div key={approver.key} className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-indigo-700">{approver.label}</span>
                                                <button type="button" onClick={() => addPhoneField(approver.key as any)} className="text-[10px] bg-white border px-2 py-1 rounded shadow-sm flex items-center gap-1"><Plus size={10}/> 추가</button>
                                            </div>
                                            <div className="space-y-2">
                                                {(siteForm.managerPhones?.[approver.key as any] || ['']).map((phone: string, idx: number) => (
                                                    <div key={idx} className="flex gap-2">
                                                        <input 
                                                            type="text" 
                                                            placeholder="010-0000-0000" 
                                                            className="flex-1 p-2 text-sm border rounded-lg bg-white outline-none focus:border-indigo-300" 
                                                            value={phone} 
                                                            onChange={(e) => handlePhoneChange(approver.key as any, idx, e.target.value)} 
                                                        />
                                                        {(siteForm.managerPhones?.[approver.key as any]?.length || 0) > 1 && (
                                                            <button type="button" onClick={() => removePhoneField(approver.key as any, idx)} className="p-2 text-red-400 hover:bg-red-50 rounded text-sm"><Minus size={16}/></button>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* 도면 등록 및 위치 핀 설정 */}
                            <div className="mt-6 pt-4 border-t border-slate-100">
                                <h4 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                                    <Map size={16} className="text-indigo-500"/> 도면 등록 및 현장 위치 설정
                                </h4>
                                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">

                                    {/* Image Upload — PNG / JPG / SVG 모두 허용 */}
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-500">도면 이미지 업로드 (PNG / JPG / SVG)</label>
                                        <div className="flex items-center gap-2">
                                            <label className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg cursor-pointer text-xs font-bold text-slate-600 transition-colors shadow-sm">
                                                <Upload size={14} className="text-indigo-500" />
                                                이미지 선택
                                                <input
                                                    type="file"
                                                    accept="image/*,.svg"
                                                    onChange={handleImageUpload}
                                                    className="hidden"
                                                />
                                            </label>
                                            {siteForm.drawingUrl && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSiteForm(prev => ({ ...prev, drawingUrl: '' }))}
                                                    className="text-[10px] text-red-500 hover:text-red-700 font-bold"
                                                >
                                                    ✕ 제거
                                                </button>
                                            )}
                                        </div>
                                        <p className="text-[10px] text-slate-400">
                                            {siteForm.drawingUrl ? '✓ 도면이 등록되었습니다.' : '도면을 등록하지 않으면 기본 템플릿 도면이 표시됩니다.'}
                                        </p>
                                    </div>

                                    {/* Drag-to-pin 위치 지정 */}
                                    <div className="space-y-2">
                                        <label className="block text-xs font-bold text-slate-500">
                                            현장 위치 핀 설정 — 도면을 클릭하여 핀을 이동하세요
                                        </label>
                                        <div
                                            className="relative w-full rounded-xl overflow-hidden border border-slate-200 bg-slate-900 cursor-crosshair"
                                            style={{ paddingBottom: '60%' }}
                                            onClick={handleMapPinClick}
                                        >
                                            <div className="absolute inset-0 flex items-center justify-center p-3">
                                                {siteForm.drawingUrl ? (
                                                    <img
                                                        src={siteForm.drawingUrl}
                                                        alt="Floor Plan Preview"
                                                        className="max-w-full max-h-full object-contain opacity-80 pointer-events-none"
                                                    />
                                                ) : (
                                                    <div className="w-full h-full pointer-events-none"><DefaultFloorPlan /></div>
                                                )}
                                                {/* Pin marker */}
                                                <div
                                                    className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                                                    style={{ left: `${siteForm.mapX ?? 50}%`, top: `${siteForm.mapY ?? 50}%` }}
                                                >
                                                    <div className="w-5 h-5 rounded-full bg-rose-500 border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                                    </div>
                                                    <div className="w-0.5 h-3 bg-rose-500 mx-auto" />
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-slate-400 text-center">
                                            현재 위치: X {siteForm.mapX ?? 50}% · Y {siteForm.mapY ?? 50}%
                                        </p>
                                    </div>
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
                    <div className="bg-white w-full max-w-sm rounded-2xl p-6 text-center shadow-2xl">
                        <AlertTriangle size={24} className="text-red-500 mx-auto mb-4" />
                        <h3 className="text-lg font-bold text-slate-800">삭제 확인</h3>
                        <p className="text-slate-500 text-sm mb-4 mt-2 leading-relaxed">
                            이 현장 데이터를 정말로 삭제하시겠습니까?<br/>
                            실수로 지우는 것을 방지하기 위해 아래에 <strong>삭제</strong> 라고 입력해주세요.
                        </p>
                        <input 
                            type="text" 
                            value={deleteInput}
                            onChange={(e) => setDeleteInput(e.target.value)}
                            placeholder="'삭제' 입력"
                            className="w-full p-3 mb-6 border border-slate-200 rounded-xl text-center font-bold text-slate-700 focus:ring-2 focus:ring-red-500 outline-none"
                        />
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTargetId(null)} className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-colors">취소</button>
                            <button onClick={confirmDelete} disabled={deleteInput !== '삭제'} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold disabled:opacity-30 disabled:cursor-not-allowed transition-all">삭제</button>
                        </div>
                    </div>
                </div>
            )}

            {selectedHistorySiteId && (
                <HistoryTimeline 
                    site={sites.find(s => s.id === selectedHistorySiteId)!} 
                    logs={logs} 
                    onClose={() => setSelectedHistorySiteId(null)} 
                />
            )}

            {selectedImage && (
                <ImageModal imageUrls={[selectedImage]} onClose={() => setSelectedImage(null)} />
            )}

            {/* 🗺️ 도면 미리보기 모달 */}
            {drawingModalSite && (
                <div className="fixed inset-0 z-[80] bg-black/70 flex items-center justify-center p-4" onClick={() => setDrawingModalSite(null)}>
                    <div className="bg-white w-full max-w-lg rounded-2xl p-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                                    <Map size={16} className="text-indigo-500" /> {drawingModalSite.name} 도면
                                </h3>
                                <p className="text-xs text-slate-500 mt-0.5">{drawingModalSite.floor} · {drawingModalSite.department} · {drawingModalSite.location}</p>
                            </div>
                            <button onClick={() => setDrawingModalSite(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-500">
                                <X size={18} />
                            </button>
                        </div>

                        {/* 도면 유형 정보 */}
                        <div className="flex gap-2 mb-4 text-[11px]">
                            <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-1 rounded-lg">
                                {drawingModalSite.layoutType === 'custom' ? '📐 사용자 업로드 도면' 
                                 : drawingModalSite.layoutType === 'l_shape' ? '🔲 L자형 레이아웃'
                                 : drawingModalSite.layoutType === 'corner' ? '🔳 코너 다각형 레이아웃'
                                 : '⬜ 표준형 직사각형 레이아웃'}
                            </span>
                            {drawingModalSite.mapX !== undefined && drawingModalSite.mapY !== undefined && (
                                <span className="bg-slate-50 text-slate-500 font-bold px-2 py-1 rounded-lg border border-slate-100">
                                    위치 X:{drawingModalSite.mapX}% Y:{drawingModalSite.mapY}%
                                </span>
                            )}
                        </div>

                        {/* 도면 뷰 */}
                        <div className="relative w-full bg-slate-950 rounded-xl overflow-hidden border border-slate-800" style={{ paddingBottom: '66%' }}>
                            <div className="absolute inset-0 flex items-center justify-center p-4">
                                {drawingModalSite.drawingUrl ? (
                                    <img
                                        src={drawingModalSite.drawingUrl}
                                        alt="Floor Plan"
                                        className="max-w-full max-h-full object-contain filter invert opacity-90"
                                    />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center">
                                        <DefaultFloorPlan />
                                        <div className="absolute bottom-3 left-0 right-0 text-center">
                                            <span className="text-[10px] font-bold text-slate-500 bg-slate-900/80 px-2 py-1 rounded">표준 도면 템플릿 (현장 수정 &gt; 도면 탭에서 SVG 업로드 가능)</span>
                                        </div>
                                    </div>
                                )}
                                {/* 위치 마커 */}
                                {drawingModalSite.mapX !== undefined && drawingModalSite.mapY !== undefined && (
                                    <div
                                        className="absolute w-5 h-5 rounded-full bg-rose-500 border-2 border-white shadow-lg flex items-center justify-center animate-pulse"
                                        style={{
                                            left: `${drawingModalSite.mapX}%`,
                                            top: `${drawingModalSite.mapY}%`,
                                            transform: 'translate(-50%, -50%)',
                                        }}
                                    >
                                        <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="mt-4 text-center">
                            <button
                                onClick={() => { setDrawingModalSite(null); openEditForm(drawingModalSite); }}
                                className="text-xs text-indigo-600 font-bold hover:underline flex items-center gap-1 mx-auto"
                            >
                                <Edit size={11} /> 도면 및 위치 수정하기 (현장 수정 탭)
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </PullToRefresh>
    );
};

export default Dashboard;
