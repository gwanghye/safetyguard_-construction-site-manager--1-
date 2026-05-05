
/**
 * 클라이언트 사이드 이미지 압축 유틸리티
 * @param base64Str 원본 Base64 문자열
 * @param maxWidth 최대 가로 폭 (픽셀)
 * @param quality 화질 (0~1)
 */
export const compressImage = (base64Str: string, maxWidth: number = 600, quality: number = 0.6): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            // 해상도 조절
            if (width > maxWidth) {
                height = (maxWidth / width) * height;
                width = maxWidth;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            // 이미지 포맷을 jpeg로 변경하고 화질 조정
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };
    });
};
