import { useEffect, useRef } from 'react';

interface SwipeHandlers {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    threshold?: number;
    edgeSwipeOnly?: boolean; // 뒤로가기처럼 화면 가장자리에서 시작된 스와이프만 감지할지 여부
}

export const useSwipe = (ref: React.RefObject<HTMLElement | null>, handlers: SwipeHandlers) => {
    const touchStart = useRef<{ x: number; y: number } | null>(null);
    const touchEnd = useRef<{ x: number; y: number } | null>(null);

    useEffect(() => {
        const element = ref.current;
        if (!element) return;

        const handleTouchStart = (e: TouchEvent) => {
            touchEnd.current = null;
            const touch = e.targetTouches[0];
            touchStart.current = { x: touch.clientX, y: touch.clientY };
        };

        const handleTouchMove = (e: TouchEvent) => {
            const touch = e.targetTouches[0];
            touchEnd.current = { x: touch.clientX, y: touch.clientY };
        };

        const handleTouchEnd = () => {
            if (!touchStart.current || !touchEnd.current) return;

            const distanceX = touchEnd.current.x - touchStart.current.x;
            const distanceY = touchEnd.current.y - touchStart.current.y;
            const isLeftSwipe = distanceX < -50;
            const isRightSwipe = distanceX > 50;
            const isUpSwipe = distanceY < -50;
            const isDownSwipe = distanceY > 50;
            
            const threshold = handlers.threshold || 50;

            // 엣지 스와이프 (뒤로가기) 감지: 시작점이 왼쪽 가장자리(50px 이내)여야 함
            if (handlers.edgeSwipeOnly && touchStart.current.x > 50) {
                return;
            }

            if (Math.abs(distanceX) > Math.abs(distanceY)) {
                if (isRightSwipe && Math.abs(distanceX) > threshold && handlers.onSwipeRight) {
                    handlers.onSwipeRight();
                }
                if (isLeftSwipe && Math.abs(distanceX) > threshold && handlers.onSwipeLeft) {
                    handlers.onSwipeLeft();
                }
            } else {
                if (isDownSwipe && Math.abs(distanceY) > threshold && handlers.onSwipeDown) {
                    handlers.onSwipeDown();
                }
                if (isUpSwipe && Math.abs(distanceY) > threshold && handlers.onSwipeUp) {
                    handlers.onSwipeUp();
                }
            }
        };

        element.addEventListener('touchstart', handleTouchStart);
        element.addEventListener('touchmove', handleTouchMove);
        element.addEventListener('touchend', handleTouchEnd);

        return () => {
            element.removeEventListener('touchstart', handleTouchStart);
            element.removeEventListener('touchmove', handleTouchMove);
            element.removeEventListener('touchend', handleTouchEnd);
        };
    }, [ref, handlers]);
};
