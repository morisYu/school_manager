/* js/school-manage-handler.js - Firebase Firestore 버전 */
import { getSchools, getAllSchedules } from './db_service.js';

let schoolData = [];
let historyData = [];

// 페이지 로드 시 Firestore에서 학교 목록 및 전체 이력 데이터 로드
window.onload = async () => {
    const schoolSelect = document.getElementById('school-select');
    showInfoPlaceholder();

    try {
        // 1. 학교 데이터 로드
        schoolData = await getSchools();
        
        schoolSelect.innerHTML = '<option value="">-- 학교를 선택하세요 --</option>';
        if (Array.isArray(schoolData)) {
            schoolData.forEach((school, index) => {
                if (school.schoolName) {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = school.schoolName;
                    schoolSelect.appendChild(option);
                }
            });
        }

        // 2. 출강 이력 데이터 로드
        const firestoreSchedules = await getAllSchedules();
        
        // Firestore 영문 카멜케이스 → 기존 렌더링 로직의 한글 키로 변환
        historyData = firestoreSchedules.map(r => ({
            '날짜': r.date,
            '시작시간': r.startTime,
            '종료시간': r.endTime,
            '지역구분': r.region,
            '프로그램명': r.programName,
            '기관명': r.schoolName,
            '주강사': r.mainInstructor,
            '보조강사들': normalizeSubInstructors(r.subInstructors || r.subInstructor),
            '교구목록': normalizeEquipments(r.equipments, r.equipType, r.equipCount),
            '비고': r.note,
            '색상': r.color,
            '학년': r.grade,
            '대상인원': r.targetCount
        }));

    } catch (e) {
        console.error("Data Load Error:", e);
        alert("데이터를 불러오는 중 오류가 발생했습니다.");
    }
};

/**
 * 학교를 선택하고 조회할 때 호출되는 함수
 */
window.loadSchoolHistory = function() {
    const schoolIndex = document.getElementById('school-select').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (schoolIndex === "") {
        showInfoPlaceholder();
        document.getElementById('history-table-body').innerHTML = '<tr><td colspan="7" class="empty-msg">학교를 선택하고 조회하기 버튼을 눌러주세요.</td></tr>';
        return;
    }

    const selectedSchool = schoolData[schoolIndex];
    const shortName = selectedSchool.searchAlias;

    // 1. 상단 학교 정보 카드 업데이트
    displaySchoolInfo(selectedSchool);

    // 2. 하단 출강 이력 필터링 및 출력
    filterAndDisplayHistory(shortName, startDate, endDate);
};

/**
 * 학교 미선택 시 정보 카드에 placeholder 표시
 */
function showInfoPlaceholder() {
    const infoCard = document.getElementById('school-info');
    infoCard.innerHTML = `
        <div class="info-placeholder">
            <span class="placeholder-icon">🏫</span>
            <span>조회할 학교를 선택한 후 <strong>조회하기</strong> 버튼을 눌러주세요.</span>
        </div>
    `;
}

/**
 * 선택된 학교의 정보를 상단 카드에 표시 (Firestore 스키마 기준)
 */
function displaySchoolInfo(school) {
    const infoCard = document.getElementById('school-info');

    infoCard.innerHTML = `
        <div class="school-header">
            <div class="school-title-box">
                <h2 id="info-school-name"></h2>
                <span id="info-school-type" class="school-type-tag"></span>
            </div>
            <div id="info-school-region" style="color: #666; font-size: 0.9rem;"></div>
        </div>
        <div class="info-layout">
            <div class="info-left">
                <div class="info-item">
                    <div class="info-label">📍 주소</div>
                    <div id="info-school-address" class="info-value"></div>
                </div>
                <div class="info-item">
                    <div class="info-label">📞 대표번호</div>
                    <div id="info-school-phone" class="info-value"></div>
                </div>
                <div class="info-item">
                    <div class="info-label">👤 담당자</div>
                    <div id="info-school-contact" class="info-value"></div>
                </div>
                <div class="info-item">
                    <div class="info-label">🌐 홈페이지</div>
                    <div id="info-school-home" class="info-value"></div>
                </div>
            </div>
            <div class="info-right">
                <div class="info-item note-container">
                    <div class="info-label">📝 비고</div>
                    <div id="info-school-note" class="info-value note-value"></div>
                </div>
            </div>
        </div>
    `;

    // Firestore 영문 카멜케이스 필드명으로 접근
    document.getElementById('info-school-name').textContent = school.schoolName || '-';
    document.getElementById('info-school-type').textContent = school.schoolType || '-';
    document.getElementById('info-school-region').textContent = `${school.city || ''} ${school.district || ''}`.trim() || '지역 정보 없음';
    document.getElementById('info-school-address').textContent = `${school.address || '-'} (${school.zipCode || '-'})`;
    document.getElementById('info-school-phone').textContent = school.mainPhone || '-';
    document.getElementById('info-school-contact').textContent = `${school.managerName || '-'} (${school.managerPhone || '-'})`;
    
    const homeLink = document.getElementById('info-school-home');
    if (school.website && school.website !== '-') {
        homeLink.innerHTML = `<a href="${school.website}" target="_blank">${school.website} (이동)</a>`;
    } else {
        homeLink.textContent = '-';
    }
    
    document.getElementById('info-school-note').textContent = school.note || '-';
}

/**
 * 약칭 매칭 및 기간 필터링을 통한 이력 출력
 */
function filterAndDisplayHistory(shortName, start, end) {
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">데이터를 분석 중입니다...</td></tr>';

    if (!Array.isArray(historyData)) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">출강 이력 데이터가 없습니다.</td></tr>';
        return;
    }

    const filtered = historyData.filter(row => {
        const institution = String(row['기관명'] || '');
        const match = institution.match(/\(([^)]+)\)/);
        let isSchoolMatch = false;

        if (match && shortName) {
            const extractedName = match[1].trim();
            isSchoolMatch = extractedName === shortName.trim();
        } else if (!match && shortName) {
            isSchoolMatch = institution.includes(shortName.trim());
        }

        const rowDate = new Date(row['날짜']);
        const isAfter = !start || rowDate >= new Date(start);
        const isBefore = !end || rowDate <= new Date(end);

        return isSchoolMatch && isAfter && isBefore;
    });

    filtered.sort((a, b) => new Date(b['날짜']) - new Date(a['날짜']));

    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">해당 조건에 맞는 출강 이력이 없습니다.</td></tr>';
        return;
    }

    filtered.forEach((row, index) => {
        const hours = typeof calculateHours === 'function' ? calculateHours(row['시작시간'], row['종료시간']) : '-';
        const dateStr = typeof formatDate === 'function' ? formatDate(row['날짜']) : row['날짜'];
        const subs = row['보조강사들'] || [];
        const subText = subs.length > 0 ? ' / ' + subs.join(', ') : '';
        const educators = `${row['주강사'] || '-'}${subText}`;

        tbody.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td class="date-cell">${dateStr}</td>
                <td>${row['기관명']}</td>
                <td class="program-cell">${row['프로그램명']}</td>
                <td>${educators}</td>
                <td class="time-cell">${hours}h</td>
                <td>${row['비고'] || '-'}</td>
            </tr>
        `;
    });
}
