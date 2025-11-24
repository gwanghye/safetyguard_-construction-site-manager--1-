import React, { useState, useEffect } from 'react';
import { QrCode, X, Loader2 } from 'lucide-react';

interface QRModeProps {
  onClose: () => void;
  onScanSuccess: (scannedSiteId: string) => void;
}

const QRMode: React.FC<QRModeProps> = ({ onClose, onScanSuccess }) => {
  const [scanning, setScanning] = useState(true);

  // Simulate scanning process
  useEffect(() => {
    const timer = setTimeout(() => {
        // Mock successful scan
        setScanning(false);
        // In a real app, the camera would read the ID. Here we mock it.
        // The parent component will decide which site this maps to for the demo.
        onScanSuccess('site-1'); 
    }, 2500);
    return () => clearTimeout(timer);
  }, [onScanSuccess]);

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col items-center justify-center text-white">
      <button 
        onClick={onClose} 
        className="absolute top-6 right-6 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
      >
        <X size={24} />
      </button>

      <div className="relative w-64 h-64 border-2 border-emerald-500 rounded-3xl flex items-center justify-center overflow-hidden mb-8 bg-black/50">
        {/* Scanning Animation */}
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/20 to-transparent opacity-50 animate-pulse"></div>
        <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.8)] animate-[scan_2s_infinite_linear]"></div>
        
        <QrCode size={48} className="text-white/20" />
      </div>

      <h2 className="text-2xl font-bold mb-2">QR 코드 스캔 중</h2>
      <p className="text-white/60 text-center max-w-xs px-4 leading-relaxed text-sm">
        공사 현장 입구에 부착된 QR 코드를<br/>사각형 영역 안에 맞춰주세요.
      </p>
      
      {scanning && (
          <div className="mt-8 flex items-center gap-2 text-emerald-400 text-sm font-medium px-4 py-2 bg-emerald-900/30 rounded-full animate-in fade-in zoom-in duration-500">
              <Loader2 className="animate-spin w-4 h-4" />
              현장 정보를 읽어오는 중...
          </div>
      )}

      <style>{`
        @keyframes scan {
          0% { top: 0; opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default QRMode;