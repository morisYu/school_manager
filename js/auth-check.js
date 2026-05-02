import { auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// DOM Elements
const mainContent = document.getElementById('main-content');

/**
 * 인증 상태 체크 및 리다이렉트
 */
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 로그인 상태: body와 main-content를 모두 표시합니다.
        document.body.style.display = 'flex';
        if (mainContent) {
            mainContent.style.display = 'flex';
            mainContent.style.flexDirection = 'column';
            mainContent.style.width = '100%';
            mainContent.style.height = '100%';
        }
    } else {
        // 로그아웃 상태 -> 메인 로그인 페이지로 이동
        alert("로그인이 필요합니다.");
        const isSubPage = window.location.pathname.includes('/pages/');
        window.location.href = isSubPage ? '../index.html' : 'index.html';
    }
});

/**
 * 로그아웃 처리 (전역 바인딩)
 */
window.handleLogout = async function() {
    const { signOut } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js");
    if (confirm("로그아웃 하시겠습니까?")) {
        try {
            await signOut(auth);
            const isSubPage = window.location.pathname.includes('/pages/');
            window.location.href = isSubPage ? '../index.html' : 'index.html';
        } catch (error) {
            console.error("Logout Error:", error);
        }
    }
}
