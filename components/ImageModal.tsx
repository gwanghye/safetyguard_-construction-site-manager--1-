import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut } from 'lucide-react';

interface ImageModalProps {
    imageUrl: string;
    onClose: () => void;
}

const ImageModal: React.FC<ImageModalProps> = ({ imageUrl, onClose }) => {
    const [scale, setScale] = useState(1);

    const handleZoomIn = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(prev => Math.min(prev + 0.5, 3));
    };
    
    const handleZoomOut = (e: React.MouseEvent) => {
        e.stopPropagation();
        setScale(prev => Math.max(prev - 0.5, 1));
    };

    return (
        <div 
            className="fixed inset-0 z-[100] bg-black/95 flex flex-col items-center justify-center animate-in fade-in"
            onClick={onClose}
        >
            <div className="absolute top-0 w-full p-4 flex justify-between items-center z-10 bg-gradient-to-b from-black/50 to-transparent" onClick={e => e.stopPropagation()}>
                <div className="flex gap-4">
                    <button onClick={handleZoomOut} className="text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><ZoomOut size={24}/></button>
                    <button onClick={handleZoomIn} className="text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"><ZoomIn size={24}/></button>
                </div>
                <button onClick={onClose} className="text-white p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors">
                    <X size={24} />
                </button>
            </div>
            <div className="flex-1 w-full overflow-auto flex items-center justify-center p-4 touch-pan-x touch-pan-y">
                <img 
                    src={imageUrl} 
                    style={{ transform: `scale(${scale})`, transition: scale === 1 ? 'transform 0.2s ease-out' : 'none' }} 
                    className="max-w-full max-h-[90vh] object-contain origin-center rounded-lg shadow-2xl" 
                    alt="Full size view" 
                    onClick={(e) => e.stopPropagation()}
                />
            </div>
        </div>
    );
};

export default ImageModal;
