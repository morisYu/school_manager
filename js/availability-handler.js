/* js/availability-handler.js — 전체 강사 수업 불가능 시간 통합 조회 */
import { getAllInstructors } from './db_service.js';
import { auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// ─── 상수 ────────────────────────────────────────────────────────────────────
const DAY_CONFIG = [
    { key: 'monday',    label: '월' },
    { key: 'tuesday',   label: '화' },
    { key: 'wednesday', label: '수' },
    { key: 'thursday',  label: '목' },
    { key: 'friday',    label: '금' },
    { key: 'saturday',  label: '토' },
    { key: 'sunday',    label: '일' }
];

// ─── 모듈 전역 상태 ──────────────────────────────────────────────────────────
let instructorsData = [];
let activeDayFilters = new Set();

// ─── 인증 후 초기화 ─────────────────────────────────────────────────────────
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = '../index.html';
    } else {
        document.body.style.display = '';
        loadData();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    initFilters();
    initHamburgerMenu();
    initPopupClose();
});

// ─── 데이터 로딩 ─────────────────────────────────────────────────────────────
async function loadData() {
    toggleSpinner(true);
    try {
        instructorsData = await getAllInstructors();
        populateAffiliationFilter();
        renderTable();
        updateStats();
    } catch (error) {
        console.error('📋 데이터 로딩 중 오류:', error);
        showEmptyState('데이터를 불러오는 데 실패했습니다.');
    } finally {
        toggleSpinner(false);
    }
}

/**
 * 소속 필터 드롭다운을 강사 데이터 기반으로 동적 생성합니다.
 */
function populateAffiliationFilter() {
    const select = document.getElementById('filter-affiliation');
    if (!select) return;

    // 기존 옵션 초기화 (첫 번째 '전체 소속' 유지)
    select.innerHTML = '<option value="">전체 소속</option>';

    // 유니크한 소속 목록 추출
    const affiliations = new Set();
    instructorsData.forEach(inst => {
        if (inst.affiliation && inst.affiliation.trim()) {
            affiliations.add(inst.affiliation.trim());
        }
    });

    // 가나다순 정렬 후 옵션 추가
    [...affiliations].sort().forEach(aff => {
        const option = document.createElement('option');
        option.value = aff;
        option.textContent = aff;
        select.appendChild(option);
    });
}

function toggleSpinner(show) {
    const spinner = document.getElementById('loading-spinner');
    if (spinner) spinner.style.display = show ? 'flex' : 'none';
}

function showEmptyState(message) {
    const emptyEl = document.getElementById('empty-state');
    const tableEl = document.getElementById('availability-table');
    if (emptyEl) {
        emptyEl.textContent = message || '등록된 강사가 없습니다.';
        emptyEl.style.display = 'flex';
    }
    if (tableEl) tableEl.style.display = 'none';
}

// ─── 테이블 렌더링 ──────────────────────────────────────────────────────────
function renderTable() {
    const tbody = document.getElementById('availability-table-body');
    const tableEl = document.getElementById('availability-table');
    const emptyEl = document.getElementById('empty-state');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (instructorsData.length === 0) {
        if (tableEl) tableEl.style.display = 'none';
        if (emptyEl) {
            emptyEl.textContent = '등록된 강사가 없습니다.';
            emptyEl.style.display = 'flex';
        }
        return;
    }

    if (tableEl) tableEl.style.display = '';
    if (emptyEl) emptyEl.style.display = 'none';

    instructorsData.forEach(instructor => {
        const tr = document.createElement('tr');
        tr.dataset.id = instructor.id;

        // 강사명 셀
        const nameTd = document.createElement('td');
        nameTd.className = 'instructor-name-cell';
        nameTd.textContent = instructor.name || '이름 없음';
        nameTd.addEventListener('click', () => showDetailPopup(instructor));
        tr.appendChild(nameTd);

        // 요일별 셀
        DAY_CONFIG.forEach(day => {
            const td = document.createElement('td');
            const slots = instructor.availability?.[day.key] || [];

            if (!instructor.availability || slots.length === 0) {
                // 종일 가능
                td.className = 'cell-status cell-available';
                td.innerHTML = '<span class="cell-badge badge-available">종일 가능</span>';
            } else if (slots.some(s => s.start === '00:00' && s.end === '23:59')) {
                // 종일 불가
                td.className = 'cell-status cell-unavailable';
                td.innerHTML = '<span class="cell-badge badge-unavailable">종일 불가</span>';
            } else {
                // 부분 불가
                td.className = 'cell-status cell-partial';
                td.innerHTML = slots.map(s =>
                    `<span class="cell-badge badge-partial">${s.start}~${s.end} 불가</span>`
                ).join('');
            }
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });

    // 현재 필터 상태 반영
    applyFilters();
}

// ─── 필터 초기화 ─────────────────────────────────────────────────────────────
function initFilters() {
    // 요일 토글 버튼
    document.querySelectorAll('.day-filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const dayKey = e.currentTarget.dataset.day;
            if (activeDayFilters.has(dayKey)) {
                activeDayFilters.delete(dayKey);
                e.currentTarget.classList.remove('active');
            } else {
                activeDayFilters.add(dayKey);
                e.currentTarget.classList.add('active');
            }
            applyDayColumnFilter();
            applyFilters();
        });
    });

    // 실시간 검색
    const searchInput = document.getElementById('search-instructor');
    if (searchInput) {
        searchInput.addEventListener('input', () => applyFilters());
    }

    // 소속 필터
    const affiliationSelect = document.getElementById('filter-affiliation');
    if (affiliationSelect) {
        affiliationSelect.addEventListener('change', () => applyFilters());
    }

    // 시간 필터 입력 시 실시간 적용
    const filterStart = document.getElementById('filter-start');
    const filterEnd = document.getElementById('filter-end');
    if (filterStart) filterStart.addEventListener('input', () => applyFilters());
    if (filterEnd) filterEnd.addEventListener('input', () => applyFilters());

    // 필터 적용 버튼
    const applyBtn = document.querySelector('.btn-filter-apply');
    if (applyBtn) applyBtn.addEventListener('click', () => applyFilters());

    // 초기화 버튼
    const resetBtn = document.querySelector('.btn-filter-reset');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);
}

function resetFilters() {
    // 요일 필터 초기화
    activeDayFilters.clear();
    document.querySelectorAll('.day-filter-btn').forEach(btn => btn.classList.remove('active'));

    // 시간 필터 초기화
    const filterStart = document.getElementById('filter-start');
    const filterEnd = document.getElementById('filter-end');
    if (filterStart) filterStart.value = '';
    if (filterEnd) filterEnd.value = '';

    // 검색 초기화
    const searchInput = document.getElementById('search-instructor');
    if (searchInput) searchInput.value = '';

    // 소속 필터 초기화
    const affiliationSelect = document.getElementById('filter-affiliation');
    if (affiliationSelect) affiliationSelect.value = '';

    applyDayColumnFilter();
    applyFilters();
}

/**
 * 선택된 요일만 테이블 열에 표시하고, 선택하지 않은 요일 열은 숨깁니다.
 * 선택된 요일이 없으면 모든 열을 표시합니다.
 */
function applyDayColumnFilter() {
    const table = document.getElementById('availability-table');
    if (!table) return;

    // 필터 활성 시 min-width 해제 → 열이 왼쪽 정렬
    table.style.minWidth = activeDayFilters.size === 0 ? '100%' : 'auto';

    DAY_CONFIG.forEach((day, idx) => {
        const colIndex = idx + 1; // 0은 강사명 열
        const showColumn = activeDayFilters.size === 0 || activeDayFilters.has(day.key);

        // thead
        const th = table.querySelector(`thead tr th:nth-child(${colIndex + 1})`);
        if (th) th.style.display = showColumn ? '' : 'none';

        // tbody의 모든 행
        table.querySelectorAll(`tbody tr`).forEach(row => {
            const td = row.querySelector(`td:nth-child(${colIndex + 1})`);
            if (td) td.style.display = showColumn ? '' : 'none';
        });
    });
}

// ─── 필터 적용 ──────────────────────────────────────────────────────────────
function applyFilters() {
    const searchInput = document.getElementById('search-instructor');
    const searchText = (searchInput?.value || '').trim().toLowerCase();

    const affiliationSelect = document.getElementById('filter-affiliation');
    const selectedAffiliation = affiliationSelect?.value || '';

    const startTime = document.getElementById('filter-start')?.value || '';
    const endTime = document.getElementById('filter-end')?.value || '';
    const hasTimeFilter = startTime.length >= 4 && endTime.length >= 4;

    const tbody = document.getElementById('availability-table-body');
    if (!tbody) return;

    const rows = tbody.querySelectorAll('tr');

    rows.forEach(row => {
        const id = row.dataset.id;
        const instructor = instructorsData.find(inst => inst.id === id);
        if (!instructor) return;

        // ─ 이름 검색 필터
        if (searchText && (!instructor.name || !instructor.name.toLowerCase().includes(searchText))) {
            row.style.display = 'none';
            return;
        }

        // ─ 소속 필터
        if (selectedAffiliation && (instructor.affiliation || '') !== selectedAffiliation) {
            row.style.display = 'none';
            return;
        }

        row.style.display = '';

        // ─ 요일/시간 하이라이트
        row.classList.remove('row-highlight-available', 'row-highlight-unavailable');

        if (hasTimeFilter) {
            // 요일 필터가 선택되었으면 해당 요일만, 아니면 모든 요일 검사
            const daysToCheck = activeDayFilters.size > 0
                ? [...activeDayFilters]
                : DAY_CONFIG.map(d => d.key);

            let hasConflict = false;
            daysToCheck.forEach(dayKey => {
                const slots = instructor.availability?.[dayKey] || [];
                if (isTimeConflict(slots, startTime, endTime)) {
                    hasConflict = true;
                }
            });

            row.classList.add(hasConflict ? 'row-highlight-unavailable' : 'row-highlight-available');
        }
    });
}

// ─── 시간 겹침 확인 ─────────────────────────────────────────────────────────
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function isTimeConflict(slots, startTime, endTime) {
    if (!slots || slots.length === 0) return false;
    const startMin = timeToMinutes(startTime);
    const endMin = timeToMinutes(endTime);

    return slots.some(slot => {
        if (slot.start === '00:00' && slot.end === '23:59') return true;
        const sMin = timeToMinutes(slot.start);
        const eMin = timeToMinutes(slot.end);
        return Math.max(startMin, sMin) < Math.min(endMin, eMin);
    });
}

// ─── 상세 팝업 ──────────────────────────────────────────────────────────────
function showDetailPopup(instructor) {
    const popup = document.getElementById('detail-popup');
    if (!popup) return;

    // 이름 표시
    const nameEl = document.getElementById('detail-popup-name');
    if (nameEl) nameEl.textContent = `${instructor.name || '이름 없음'} 강사 — 수업 불가능 시간 상세`;

    // 본문 생성
    const bodyEl = document.getElementById('detail-popup-body');
    if (bodyEl) {
        let html = '<div class="detail-days-grid">';
        DAY_CONFIG.forEach(day => {
            const slots = instructor.availability?.[day.key] || [];
            let statusClass = 'detail-day-available';
            let text = '종일 가능';

            if (slots.length > 0) {
                if (slots.some(s => s.start === '00:00' && s.end === '23:59')) {
                    statusClass = 'detail-day-unavailable';
                    text = '종일 불가';
                } else {
                    statusClass = 'detail-day-partial';
                    text = slots.map(s => `${s.start}~${s.end}`).join(', ') + ' 불가';
                }
            }
            html += `<div class="detail-day-row ${statusClass}">
                        <strong>${day.label}요일</strong>
                        <span>${text}</span>
                     </div>`;
        });
        html += '</div>';

        // 메모
        if (instructor.availabilityNote) {
            html += `<div class="detail-note">
                        <strong>📝 특이사항</strong>
                        <p style="white-space: pre-wrap;">${instructor.availabilityNote}</p>
                     </div>`;
        }

        bodyEl.innerHTML = html;
    }

    popup.style.display = 'flex';
}

function closeDetailPopup() {
    const popup = document.getElementById('detail-popup');
    if (popup) popup.style.display = 'none';
}

function initPopupClose() {
    const closeBtn = document.getElementById('detail-popup-close');
    const popup = document.getElementById('detail-popup');

    if (closeBtn) closeBtn.addEventListener('click', closeDetailPopup);
    if (popup) {
        popup.addEventListener('click', (e) => {
            if (e.target === popup) closeDetailPopup();
        });
    }
}

// ─── 통계 업데이트 ──────────────────────────────────────────────────────────
function updateStats() {
    const total = instructorsData.length;
    let restricted = 0;

    instructorsData.forEach(inst => {
        if (inst.availability) {
            for (const day of DAY_CONFIG) {
                const slots = inst.availability[day.key];
                if (slots && slots.length > 0) {
                    restricted++;
                    break;
                }
            }
        }
    });

    const available = total - restricted;

    const totalEl = document.getElementById('stat-total');
    const availableEl = document.getElementById('stat-available');
    const unavailableEl = document.getElementById('stat-unavailable');

    if (totalEl) totalEl.textContent = `전체 ${total}명`;
    if (availableEl) availableEl.textContent = `제한없음 ${available}명`;
    if (unavailableEl) unavailableEl.textContent = `제한있음 ${restricted}명`;
}

// ─── 자동 콜론 헬퍼 (시간 입력) ─────────────────────────────────────────────
window.autoColon = function(input) {
    let v = input.value.replace(/[^0-9]/g, '');
    if (v.length >= 3) v = v.slice(0, 2) + ':' + v.slice(2);
    input.value = v;
};

// ─── 햄버거 메뉴 (모바일) ───────────────────────────────────────────────────
function initHamburgerMenu() {
    const hamburgerBtn = document.getElementById('hamburger-btn');
    const mobileNav = document.getElementById('mobile-nav');
    const navOverlay = document.getElementById('nav-overlay');
    if (hamburgerBtn && mobileNav) {
        const toggle = () => {
            const isOpen = mobileNav.classList.toggle('is-open');
            hamburgerBtn.classList.toggle('is-open', isOpen);
            hamburgerBtn.setAttribute('aria-expanded', isOpen);
            navOverlay?.classList.toggle('is-visible', isOpen);
        };
        hamburgerBtn.addEventListener('click', toggle);
        navOverlay?.addEventListener('click', toggle);
    }
}
