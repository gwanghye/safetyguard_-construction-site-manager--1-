import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Base64 이미지 문자열을 Firebase Storage에 업로드하고 다운로드 URL을 반환합니다.
 * @param base64String 업로드할 이미지의 Base64 문자열
 * @param path Storage에 저장될 폴더 경로 (예: 'inspections' 또는 'actions')
 * @returns 업로드된 이미지의 다운로드 URL
 */
export const uploadImageToStorage = async (base64String: string, path: string = 'general'): Promise<string> => {
    // 이미 URL인 경우(이전에 업로드된 경우) 그대로 반환
    if (base64String.startsWith('http')) {
        return base64String;
    }

    try {
        // 파일명 생성 (랜덤 문자열 + 타임스탬프)
        const randomString = Math.random().toString(36).substring(2, 9);
        const fileName = `${path}/${Date.now()}_${randomString}.jpg`;
        const storageRef = ref(storage, fileName);

        // Base64 데이터에서 실제 데이터 부분만 추출 (data:image/jpeg;base64,... 부분 제거)
        // 안드로이드/iOS 호환성을 위해 원본 문자열 전체를 data_url 포맷으로 업로드
        await uploadString(storageRef, base64String, 'data_url');
        
        // 업로드된 파일의 다운로드 URL 가져오기
        const downloadUrl = await getDownloadURL(storageRef);
        return downloadUrl;
    } catch (error) {
        console.error("Error uploading image to storage:", error);
        throw new Error("이미지 업로드에 실패했습니다.");
    }
};

/**
 * 여러 개의 Base64 이미지를 병렬로 Firebase Storage에 업로드하고 URL 배열을 반환합니다.
 */
export const uploadMultipleImages = async (base64Strings: string[], path: string = 'general'): Promise<string[]> => {
    if (!base64Strings || base64Strings.length === 0) return [];
    
    // Promise.all을 사용하여 병렬 업로드 처리로 속도 향상
    const uploadPromises = base64Strings.map(base64 => uploadImageToStorage(base64, path));
    return await Promise.all(uploadPromises);
};
