import { auth } from './firebase_config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// ── 세션 타임아웃 (auth_handler.js와 동일한 설정) ──
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2시간
const SESSION_KEY = 'school_manager_last_activity';

function updateLastActivity() {
    localStorage.setItem(SESSION_KEY, Date.now().toString());
}

function isSessionExpired() {
    const lastActivity = localStorage.getItem(SESSION_KEY);
    if (!lastActivity) return true; // 서브 페이지에서 세션 기록이 없으면 만료 처리
    return (Date.now() - parseInt(lastActivity)) > SESSION_TIMEOUT_MS;
}

function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// DOM Elements
const mainContent = document.getElementById('main-content');

/**
 * 인증 상태 체크 및 리다이렉트
 */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 세션 만료 확인
        if (isSessionExpired()) {
            console.log("Session expired on sub-page. Redirecting...");
            clearSession();
            await signOut(auth);
            return;
        }

        // 활동 시간 갱신
        updateLastActivity();

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
        clearSession();
        alert("로그인이 필요합니다.");
        const isSubPage = window.location.pathname.includes('/pages/');
        window.location.href = isSubPage ? '../index.html' : 'index.html';
    }
});

/**
 * 탭 전환 복귀 시 세션 만료 체크
 */
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && auth.currentUser) {
        if (isSessionExpired()) {
            console.log("Session expired on tab return (sub-page).");
            clearSession();
            await signOut(auth);
        } else {
            updateLastActivity();
        }
    }
});

/**
 * 로그아웃 처리 (전역 바인딩)
 */
window.handleLogout = async function() {
    const { signOut: doSignOut } = await import("https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js");
    if (confirm("로그아웃 하시겠습니까?")) {
        try {
            clearSession();
            await doSignOut(auth);
            const isSubPage = window.location.pathname.includes('/pages/');
            window.location.href = isSubPage ? '../index.html' : 'index.html';
        } catch (error) {
            console.error("Logout Error:", error);
        }
    }
}

