/**
 * Firebase Storage 이미지 업로드/삭제 서비스
 * 프로그램 관리용 이미지를 Storage에 업로드하고 URL을 반환합니다.
 */
import { storage } from './firebase_config.js';
import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-storage.js";

const MAX_WIDTH = 800; // 리사이즈 최대 폭 (px)

/**
 * 이미지 파일을 Canvas로 리사이즈합니다.
 * @param {File} file 원본 이미지 파일
 * @param {number} maxWidth 최대 너비
 * @returns {Promise<Blob>} 리사이즈된 이미지 Blob
 */
function resizeImage(file, maxWidth = MAX_WIDTH) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = (e) => {
            img.onload = () => {
                // 리사이즈 불필요 시 원본 반환
                if (img.width <= maxWidth) {
                    resolve(file);
                    return;
                }

                const ratio = maxWidth / img.width;
                const canvas = document.createElement('canvas');
                canvas.width = maxWidth;
                canvas.height = img.height * ratio;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                canvas.toBlob((blob) => {
                    if (blob) resolve(blob);
                    else reject(new Error("Canvas to Blob failed"));
                }, 'image/jpeg', 0.85);
            };
            img.onerror = () => reject(new Error("Image loading failed"));
            img.src = e.target.result;
        };
        reader.onerror = () => reject(new Error("File reading failed"));
        reader.readAsDataURL(file);
    });
}

export async function uploadImage(file, folder = 'programs') {
    try {
        const resized = await resizeImage(file);
        const fileName = `${folder}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        const storageRef = ref(storage, fileName);
        
        // 업로드가 무한 대기하는 현상을 방지하기 위해 15초 타임아웃 추가
        const uploadPromise = async () => {
            await uploadBytes(storageRef, resized);
            return await getDownloadURL(storageRef);
        };
        
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Storage upload timeout")), 3000);
        });

        const url = await Promise.race([uploadPromise(), timeoutPromise]);
        return url;
    } catch (error) {
        console.error("📷 uploadImage 에러:", error);
        throw error;
    }
}

/**
 * Firebase Storage에서 이미지를 삭제합니다.
 * @param {string} url 삭제할 이미지의 다운로드 URL
 */
export async function deleteImage(url) {
    try {
        const storageRef = ref(storage, url);
        await deleteObject(storageRef);
    } catch (error) {
        // 이미 삭제된 파일이거나 URL이 잘못된 경우 무시
        console.warn("🗑️ deleteImage 경고:", error.message);
    }
}
