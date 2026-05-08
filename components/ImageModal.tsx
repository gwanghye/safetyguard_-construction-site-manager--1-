import React, { useState, useRef } from 'react';
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react';
import { useSwipe } from '../hooks/useSwipe';
import { hapticLight } from '../utils/haptics';

interface ImageModalProps {
    imageUrls: string[];
    initialIndex?: number;
    onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrls, initialIndex = 0, onClose }) => {
    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [scale, setScale] = useState(1);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(prev => Math.min(prev + 0.5, 3));
        hapticLight();
    };
    
    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(prev => Math.max(prev - 0.5, 1));
        hapticLight();
    };

    const handleNext = () => {
        if (scale > 1) return; // 확대 중일 때는 넘기기 방지 (패닝을 위해)
        if (currentIndex < imageUrls.length - 1) {
            setCurrentIndex(prev => prev + 1);
            hapticLight();
        }
    };

    const handlePrev = () => {
        if (scale > 1) return;
        if (currentIndex > 0) {
            setCurrentIndex(prev => prev - 1);
            hapticLight();
        }
    };

    useSwipe(containerRef, {
        onSwipeLeft: handleNext,
        onSwipeRight: handlePrev,
        threshold: 60
    });

    return (
        <div 
            ref={containerRef}
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in"
            onClick={onClose}
        >
            <div className="absolute top-0 w-full p-4 flex justify-between items-center z-20 bg-gradient-to-b from-black/50 to-transparent" onClick={e => e.stopPropagation()}>
                <div className="flex gap-4">
                    <button onClick={handleZoomOut} className="text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><ZoomOut size={24}/></button>
                    <button onClick={handleZoomIn} className="text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><ZoomIn size={24}/></button>
                </div>
                {imageUrls.length > 1 && (
                    <div className="text-white font-bold text-sm bg-black/50 px-3 py-1.5 rounded-full">
                        {currentIndex + 1} / {imageUrls.length}
                    </div>
                )}
                <button onClick={onClose} className="text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                    <X size={24} />
                </button>
            </div>
            
            <div className="flex-1 w-full overflow-auto flex items-center justify-center p-4 touch-pan-x touch-pan-y relative" onClick={e => e.stopPropagation()}>
                {/* Prev Button Desktop */}
                {currentIndex > 0 && (
                    <button onClick={handlePrev} className="hidden md:flex absolute left-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                        <ChevronLeft size={32} />
                    </button>
                )}

                <img 
                    src={imageUrls[currentIndex]} 
                    style={{ transform: `scale(${scale})`, transition: scale === 1 ? 'transform 0.2s ease-out' : 'none' }} 
                    className="max-w-full max-h-[90vh] object-contain origin-center rounded-lg shadow-2xl" 
                    alt="Full size view" 
                />

                {/* Next Button Desktop */}
                {currentIndex < imageUrls.length - 1 && (
                    <button onClick={handleNext} className="hidden md:flex absolute right-4 z-10 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors">
                        <ChevronRight size={32} />
                    </button>
                )}
            </div>
            
            {imageUrls.length > 1 && scale === 1 && (
                <div className="absolute bottom-8 text-white/50 text-xs font-medium bg-black/40 px-3 py-1 rounded-full animate-pulse">
                    좌우로 스와이프하여 넘기기
                </div>
            )}
        </div>
    );
};

export default ImageModal;
