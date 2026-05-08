// utils/haptics.ts

export const hapticLight = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10); // 아주 짧고 가벼운 진동 (체크박스 클릭 등)
    }
};

export const hapticMedium = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(30); // 중간 진동 (버튼 클릭 등)
    }
};

export const hapticSuccess = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([20, 50, 20]); // 성공 시 진동 (따-딱)
    }
};

export const hapticError = () => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([50, 50, 50, 50, 50]); // 에러 시 진동 (따-따-따)
    }
};
