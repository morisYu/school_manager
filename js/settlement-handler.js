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

        const processInstructor = (name) => {
            if (!name) return;
            name = String(name).trim();
            if (name === '없음' || name === '미정') return; // '없음', '미정'으로 표시된 강사는 무시

            if (!settlementMap[name]) settlementMap[name] = { totalAmount: 0, hasAmount: false };
            
            if (amount > 0) {
                settlementMap[name].totalAmount += amount;
                settlementMap[name].hasAmount = true;
            }
        };

        // 주강사 추가
        if (schedule.mainInstructor) {
            processInstructor(schedule.mainInstructor);
        }

        // 보조강사 추가
        const subs = normalizeSubInstructors(schedule.subInstructors || schedule.subInstructor);
        subs.forEach(processInstructor);
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
        const data = settlementMap[name];
        const totalAmount = data.totalAmount;
        const hasAmount = data.hasAmount;

        let displayTotalAmount = '-';
        let displayFinalAmount = '-';

        if (hasAmount && totalAmount > 0) {
            // 3.3% 공제 (소수점 절사)
            const finalAmount = Math.floor(totalAmount * (1 - 0.033));

            grandTotalPreTax += totalAmount;
            grandTotalPostTax += finalAmount;

            displayTotalAmount = totalAmount.toLocaleString();
            displayFinalAmount = finalAmount.toLocaleString();
        }

        const profile = instructorsMap[name] || {};
        const affiliation = profile.affiliation || '-';
        const birth6 = getBirth6Digits(profile.birthDate);
        const bankName = profile.bankName || '-';
        const accountNum = profile.accountNumber || '-';
        const accountHolder = profile.accountHolder || '-';

        tbody.innerHTML += `
            <tr>
                <td class="table-center">
                    <div class="instructor-name-btn" onclick="openDetailModal('${name}')">
                        <strong>${name}</strong>
                    </div>
                </td>
                <td class="table-center">${affiliation}</td>
                <td class="table-center">${birth6}</td>
                <td class="table-center">${bankName}</td>
                <td class="table-center">${accountNum}</td>
                <td class="table-center">${accountHolder}</td>
                <td class="table-amount">${displayTotalAmount}</td>
                <td class="table-amount" style="color: #e74c3c; font-weight: bold;">${displayFinalAmount}</td>
            </tr>
        `;
    });

    document.getElementById('total-pre-tax').textContent = grandTotalPreTax.toLocaleString();
    document.getElementById('total-post-tax').textContent = grandTotalPostTax.toLocaleString();
    footer.style.display = 'table-footer-group';
};

// 강사 상세 내역 모달
window.openDetailModal = function(instructorName) {
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;
    
    // 기간 내 스케줄 필터링
    const filtered = schedulesData.filter(r => {
        const rDate = new Date(r.date);
        return rDate >= new Date(start) && rDate <= new Date(end);
    });

    const tbody = document.getElementById('detail-modal-tbody');
    tbody.innerHTML = '';

    let totalDetailAmount = 0;
    let foundAny = false;

    // 날짜 오름차순 정렬
    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    filtered.forEach(schedule => {
        let isMain = false;
        let isSub = false;

        if (schedule.mainInstructor && String(schedule.mainInstructor).trim() === instructorName) {
            isMain = true;
        }

        const subs = normalizeSubInstructors(schedule.subInstructors || schedule.subInstructor);
        if (subs.some(sub => String(sub).trim() === instructorName)) {
            isSub = true;
        }

        if (isMain || isSub) {
            foundAny = true;
            const rounds = parseFloat(schedule.rounds) || 0;
            const fee = parseFloat(schedule.instructorFee) || 0;
            const amount = rounds * fee;
            
            let roleStr = [];
            if (isMain) roleStr.push('주강사');
            if (isSub) roleStr.push('보조강사');

            // 합계금액이 없거나 0일 때 '-' 처리
            let displayAmount = amount > 0 ? amount.toLocaleString() : '-';

            // 만약 주, 보조 둘다 속할 경우 금액이 2배인지 여부? 기존 로직은 두 번 집계하므로 여기선 1번만 추가하고 2배 처리 혹은 개별 처리.
            // 보통 한 강사가 한 일정에 주/보조 동시가 아니지만, 혹시 그렇다면 각 역할을 따로 보여주거나 한 줄에 합침.
            // 기존 로직은 각각 집계하므로 각각 출력하는 것이 정확.
            if (isMain) {
                totalDetailAmount += amount;
                tbody.innerHTML += `
                    <tr>
                        <td class="table-center">${schedule.date}</td>
                        <td class="table-center">${schedule.schoolName || '-'}</td>
                        <td class="table-center">${schedule.programName || '-'}</td>
                        <td class="table-center">주강사</td>
                        <td class="table-center">${rounds}</td>
                        <td class="table-amount">${displayAmount}</td>
                    </tr>
                `;
            }
            if (isSub) {
                totalDetailAmount += amount;
                tbody.innerHTML += `
                    <tr>
                        <td class="table-center">${schedule.date}</td>
                        <td class="table-center">${schedule.schoolName || '-'}</td>
                        <td class="table-center">${schedule.programName || '-'}</td>
                        <td class="table-center">보조강사</td>
                        <td class="table-center">${rounds}</td>
                        <td class="table-amount">${displayAmount}</td>
                    </tr>
                `;
            }
        }
    });

    if (!foundAny) {
        tbody.innerHTML = '<tr><td colspan="6" class="table-center">출강 내역이 없습니다.</td></tr>';
    } else {
        // 총계 행 추가
        tbody.innerHTML += `
            <tr style="background-color: #f8f9fa; font-weight: bold;">
                <td colspan="5" style="text-align: right; padding-right: 15px;">총 합계</td>
                <td class="table-amount" style="color: #e74c3c;">${totalDetailAmount > 0 ? totalDetailAmount.toLocaleString() : '-'}</td>
            </tr>
        `;
    }

    document.getElementById('detail-modal-title').textContent = `출강 및 정산 내역서 - ${instructorName}`;
    const overlay = document.getElementById('detail-modal-overlay');
    const modal = document.getElementById('detail-modal');
    
    overlay.style.display = 'block';
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        modal.classList.add('is-open');
    });
};

window.closeDetailModal = function() {
    const overlay = document.getElementById('detail-modal-overlay');
    const modal = document.getElementById('detail-modal');

    overlay.classList.remove('is-open');
    modal.classList.remove('is-open');

    modal.addEventListener('transitionend', () => {
        overlay.style.display = 'none';
        modal.style.display = 'none';
    }, { once: true });
};
