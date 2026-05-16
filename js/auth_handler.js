import { auth } from './firebase_config.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// ── 세션 타임아웃 설정 (밀리초) ──
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000; // 2시간 (필요 시 조정)
const SESSION_KEY = 'school_manager_last_activity';

/**
 * 마지막 활동 시간을 기록합니다.
 */
function updateLastActivity() {
    localStorage.setItem(SESSION_KEY, Date.now().toString());
}

/**
 * 세션 만료 여부를 확인합니다.
 * @returns {boolean} 세션이 만료되었으면 true
 */
function isSessionExpired() {
    const lastActivity = localStorage.getItem(SESSION_KEY);
    if (!lastActivity) return false; // 최초 접속 시에는 만료 판단하지 않음
    return (Date.now() - parseInt(lastActivity)) > SESSION_TIMEOUT_MS;
}

/**
 * 세션 데이터를 초기화합니다.
 */
function clearSession() {
    localStorage.removeItem(SESSION_KEY);
}

// DOM Elements
const loginScreen = document.getElementById('login-screen');
const mainContent = document.getElementById('main-content');
const loginForm = document.getElementById('login-form');
const emailInput = document.getElementById('login-email');
const passwordInput = document.getElementById('login-password');
const errorMsg = document.getElementById('login-error');

/**
 * 인증 상태 변경 감지
 */
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // 세션 만료 확인
        if (isSessionExpired()) {
            console.log("Session expired. Auto logging out...");
            clearSession();
            await signOut(auth);
            return; // signOut 후 onAuthStateChanged가 다시 호출됨
        }

        // 로그인 상태: 활동 시간 갱신
        updateLastActivity();
        console.log("Logged in as:", user.email);
        showMainSystem();
    } else {
        // 로그아웃 상태
        console.log("Logged out");
        clearSession();
        showLoginScreen();
    }
});

/**
 * 페이지 포커스/가시성 변경 시 세션 만료 체크 (탭 전환 후 복귀 시)
 */
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && auth.currentUser) {
        if (isSessionExpired()) {
            console.log("Session expired on tab return. Auto logging out...");
            clearSession();
            await signOut(auth);
        } else {
            updateLastActivity();
        }
    }
});

/**
 * 로그인 처리
 */
async function handleLogin(e) {
    if (e) e.preventDefault();

    const email = emailInput.value;
    const password = passwordInput.value;

    errorMsg.style.display = 'none';
    const loginBtn = document.querySelector('.login-button');
    const originalText = loginBtn.innerText;
    loginBtn.innerText = '로그인 중...';
    loginBtn.disabled = true;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        updateLastActivity(); // 로그인 성공 시 활동 시간 기록
    } catch (error) {
        console.error("Login Error:", error.code, error.message);
        errorMsg.style.display = 'block';
        let message = "로그인에 실패했습니다.";
        if (error.code === 'auth/invalid-credential') message = "이메일 또는 비밀번호가 올바르지 않습니다.";
        if (error.code === 'auth/user-not-found') message = "등록되지 않은 사용자입니다.";
        if (error.code === 'auth/wrong-password') message = "비밀번호가 틀렸습니다.";
        errorMsg.innerText = message;
    } finally {
        loginBtn.innerText = originalText;
        loginBtn.disabled = false;
    }
}

/**
 * 로그아웃 처리
 */
window.handleLogout = async function () {
    if (confirm("로그아웃 하시겠습니까?")) {
        try {
            clearSession();
            await signOut(auth);
            location.reload(); // 상태 초기화를 위해 새로고침
        } catch (error) {
            console.error("Logout Error:", error);
        }
    }
}

function showMainSystem() {
    document.body.style.display = 'flex'; // body가 숨겨져 있을 경우를 대비해 추가 (common.css의 flex 유지)
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainContent) {
        mainContent.style.display = 'flex';
        mainContent.style.flexDirection = 'column';
        mainContent.style.height = '100%';
        mainContent.style.width = '100%';
    }

    // 캘린더가 이미 있다면 크기를 재조정하고 데이터를 다시 불러옵니다.
    if (window.myCalendar) {
        setTimeout(() => {
            window.myCalendar.updateSize();
            window.myCalendar.refetchEvents();
        }, 100);
    } else if (typeof window.initCalendar === 'function') {
        // 캘린더가 아직 없으면(최초 로그인 시) 화면 표시 직후 초기화합니다.
        setTimeout(() => {
            window.initCalendar();
        }, 100);
    }
}

function showLoginScreen() {
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainContent) mainContent.style.display = 'none';
}

// 이벤트 리스너 등록
if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
}

