import { auth } from './firebase_config.js';
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

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
onAuthStateChanged(auth, (user) => {
    if (user) {
        // 로그인 상태
        console.log("Logged in as:", user.email);
        showMainSystem();
    } else {
        // 로그아웃 상태
        console.log("Logged out");
        showLoginScreen();
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
