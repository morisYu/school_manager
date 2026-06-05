import { getAllSchedules, getAllInstructors } from './db_service.js';
import { auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

let schedulesData = [];
let instructorsMap = {}; // name -> profile object

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
        const [schedules, instructors] = await Promise.all([
            getAllSchedules(),
            getAllInstructors()
        ]);

        schedulesData = schedules;
        
        // 강사 프로필 매핑
        instructorsMap = {};
        instructors.forEach(inst => {
            instructorsMap[inst.name] = inst;
        });

        // 오늘 날짜 기준으로 이번 달 1일~말일 기본 세팅 (선택적)
        const today = new Date();
        const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        
        document.getElementById('startDate').value = firstDay.toISOString().split('T')[0];
        document.getElementById('endDate').value = lastDay.toISOString().split('T')[0];

        // UI 표시 활성화
        document.body.style.display = 'block';
    } catch (e) {
        console.error("데이터 로드 에러:", e);
        alert("데이터를 불러오지 못했습니다.");
    }
});

// YYYY-MM-DD 등에서 생년월일 6자리 추출
function getBirth6Digits(birthDateStr) {
    if (!birthDateStr) return '-';
    // 입력이 YYYY-MM-DD 형식이라고 가정
    const parts = birthDateStr.split('-');
    if (parts.length === 3) {
        const yy = parts[0].substring(2);
        const mm = parts[1];
        const dd = parts[2];
        return `${yy}${mm}${dd}`;
    }
    // 형식이 다르면 숫자만 추출 후 최대 6자리
    const nums = birthDateStr.replace(/[^\d]/g, '');
    if (nums.length >= 8) return nums.substring(2, 8); // YYYYMMDD -> YYMMDD
    return nums || '-';
}

// 보조강사 필드 정규화
function normalizeSubInstructors(sub) {
    if (!sub) return [];
    if (Array.isArray(sub)) return sub;
    if (typeof sub === 'string') return sub.split(',').map(s => s.trim()).filter(s => s);
    return [];
}

window.loadSettlementReport = function() {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    const affiliationSearch = document.getElementById('affiliationSearch').value.trim().toLowerCase();

    if (!start || !end) {
        alert("시작일과 종료일을 모두 선택해주세요.");
        return;
    }

    // 기간 내 스케줄 필터링
    const filtered = schedulesData.filter(r => {
        const rDate = new Date(r.date);
        return rDate >= new Date(start) && rDate <= new Date(end);
    });

    // 강사별 정산 금액 집계
    // 구조: { '홍길동': { totalAmount: 0 } }
    const settlementMap = {};

    filtered.forEach(schedule => {
        const rounds = parseFloat(schedule.rounds) || 0;
        const fee = parseFloat(schedule.instructorFee) || 0;
        const amount = rounds * fee;

        if (amount > 0) {
            // 주강사 추가
            if (schedule.mainInstructor) {
                const name = String(schedule.mainInstructor).trim();
                if (!settlementMap[name]) settlementMap[name] = { totalAmount: 0 };
                settlementMap[name].totalAmount += amount;
            }

            // 보조강사 추가
            const subs = normalizeSubInstructors(schedule.subInstructors || schedule.subInstructor);
            subs.forEach(sub => {
                const name = String(sub).trim();
                if (!settlementMap[name]) settlementMap[name] = { totalAmount: 0 };
                settlementMap[name].totalAmount += amount;
            });
        }
    });

    // 테이블 렌더링
    const tbody = document.getElementById('settlement-table-body');
    const footer = document.getElementById('settlement-footer');
    tbody.innerHTML = '';

    let grandTotalPreTax = 0;
    let grandTotalPostTax = 0;

    let names = Object.keys(settlementMap).sort((a, b) => a.localeCompare(b, 'ko'));

    // 소속 검색어 필터링
    if (affiliationSearch) {
        names = names.filter(name => {
            const profile = instructorsMap[name] || {};
            const aff = (profile.affiliation || '').toLowerCase();
            return aff.includes(affiliationSearch);
        });
    }

    if (names.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8">해당 기간/조건에 정산할 내역이 없습니다.</td></tr>';
        footer.style.display = 'none';
        return;
    }

    names.forEach(name => {
        const totalAmount = settlementMap[name].totalAmount;
        // 3.3% 공제 (소수점 절사)
        const finalAmount = Math.floor(totalAmount * (1 - 0.033));

        grandTotalPreTax += totalAmount;
        grandTotalPostTax += finalAmount;

        const profile = instructorsMap[name] || {};
        const affiliation = profile.affiliation || '-';
        const birth6 = getBirth6Digits(profile.birthDate);
        const bankName = profile.bankName || '-';
        const accountNum = profile.accountNumber || '-';
        const accountHolder = profile.accountHolder || '-';

        tbody.innerHTML += `
            <tr>
                <td class="table-center"><strong>${name}</strong></td>
                <td class="table-center">${affiliation}</td>
                <td class="table-center">${birth6}</td>
                <td class="table-center">${bankName}</td>
                <td class="table-center">${accountNum}</td>
                <td class="table-center">${accountHolder}</td>
                <td class="table-amount">${totalAmount.toLocaleString()}</td>
                <td class="table-amount" style="color: #e74c3c; font-weight: bold;">${finalAmount.toLocaleString()}</td>
            </tr>
        `;
    });

    document.getElementById('total-pre-tax').textContent = grandTotalPreTax.toLocaleString();
    document.getElementById('total-post-tax').textContent = grandTotalPostTax.toLocaleString();
    footer.style.display = 'table-footer-group';
};
