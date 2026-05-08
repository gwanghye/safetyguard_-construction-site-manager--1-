import React, { useState, useEffect, useRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { hapticSuccess } from '../utils/haptics';

interface PullToRefreshProps {
    onRefresh: () => Promise<void> | void;
    children: React.ReactNode;
}

const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const currentY = useRef(0);
    const isPulling = useRef(false);

    const PULL_THRESHOLD = 80;
    const MAX_PULL = 120;

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const handleTouchStart = (e: TouchEvent) => {
            // 스크롤이 맨 위일 때만 작동
            if (element.scrollTop <= 0 && !isRefreshing) {
                startY.current = e.touches[0].clientY;
                isPulling.current = true;
            }
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (!isPulling.current || isRefreshing) return;

            currentY.current = e.touches[0].clientY;
            const distance = currentY.current - startY.current;

            // 위에서 아래로 당길 때 (distance > 0)
            if (distance > 0 && element.scrollTop <= 0) {
                // 브라우저 기본 스크롤(새로고침 등) 방지
                if (e.cancelable) e.preventDefault();
                
                // 마찰력 적용 (잡아당길수록 뻑뻑하게)
                const pullValue = Math.min(distance * 0.5, MAX_PULL);
                setPullDistance(pullValue);
            }
        };

        const handleTouchEnd = async () => {
            if (!isPulling.current) return;
            isPulling.current = false;

            if (pullDistance > PULL_THRESHOLD && !isRefreshing) {
                hapticSuccess();
                setIsRefreshing(true);
                setPullDistance(PULL_THRESHOLD / 2); // 로딩 중에는 살짝 걸쳐있게
                
                try {
                    await onRefresh();
                } finally {
                    setIsRefreshing(false);
                    setPullDistance(0);
                }
            } else {
                setPullDistance(0);
            }
        };

        // touchmove에 passive: false를 주어 preventDefault가 동작하게 함
        element.addEventListener('touchstart', handleTouchStart);
        element.addEventListener('touchmove', handleTouchMove, { passive: false });
        element.addEventListener('touchend', handleTouchEnd);

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [pullDistance, isRefreshing, onRefresh]);

    return (
        <div 
            ref={containerRef} 
            className="h-full overflow-y-auto no-scrollbar relative"
            style={{ overscrollBehaviorY: 'contain' }} // 브라우저 네이티브 PTR 방지
        >
            {/* Pull Indicator */}
            <div 
                className="absolute left-0 right-0 flex justify-center items-center overflow-hidden transition-all duration-200"
                style={{ 
                    height: `${Math.max(0, pullDistance)}px`,
                    opacity: pullDistance > 20 ? 1 : 0
                }}
            >
                <div 
                    className={`bg-white rounded-full p-2 shadow-md flex items-center justify-center transition-transform
                        ${isRefreshing ? 'animate-spin text-indigo-500' : 'text-slate-400'}
                    `}
                    style={{ transform: `rotate(${pullDistance * 2}deg)` }}
                >
                    <RefreshCw size={20} />
                </div>
            </div>
            
            {/* Content Wrapper */}
            <div 
                className="transition-transform duration-200 min-h-full"
                style={{ transform: `translateY(${isRefreshing ? PULL_THRESHOLD / 2 : pullDistance}px)` }}
            >
                {children}
            </div>
        </div>
    );
};

export default PullToRefresh;
