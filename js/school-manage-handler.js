import { getSchools, getAllSchedules } from './db_service.js';
import { db, auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

let schoolData = [];
let historyData = [];
let currentSchoolId = null; // 현재 선택된 학교의 Firestore ID (또는 매칭용 식별자)

// 인증 상태가 확인된 후 데이터를 가져오도록 변경
onAuthStateChanged(auth, async (user) => {
    if (!user) return; // 비로그인 시 로직 중단

    const schoolSelect = document.getElementById('school-select');
    showInfoPlaceholder();

    try {
        // 1. 학교 데이터 로드
        schoolData = await getSchools();
        
        renderSchoolSelect(schoolData); // 초기 렌더링

        // 검색 입력 핸들러 추가
        const schoolSearch = document.getElementById('school-search');
        schoolSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase().trim();
            filterSchools(query);
        });

        // 셀렉트 박스 변경 시 검색창 텍스트 동기화
        schoolSelect.addEventListener('change', (e) => {
            const index = e.target.value;
            if (index !== "") {
                schoolSearch.value = schoolData[index].schoolName;
            } else {
                schoolSearch.value = "";
            }
        });

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
});

/**
 * 학교 셀렉트 박스 렌더링 함수
 */
function renderSchoolSelect(data) {
    const schoolSelect = document.getElementById('school-select');
    schoolSelect.innerHTML = '<option value="">-- 학교를 선택하세요 --</option>';
    
    data.forEach((school) => {
        // 원래 전체 데이터(schoolData)에서의 인덱스를 찾아야 함
        const originalIndex = schoolData.findIndex(s => s.id === school.id);
        if (originalIndex !== -1) {
            const option = document.createElement('option');
            option.value = originalIndex;
            option.textContent = school.schoolName;
            schoolSelect.appendChild(option);
        }
    });
}

/**
 * 검색어에 따라 학교 목록 필터링
 */
function filterSchools(query) {
    if (!query) {
        renderSchoolSelect(schoolData);
        return;
    }

    const filtered = schoolData.filter(school => {
        const name = (school.schoolName || '').toLowerCase();
        const alias = (school.searchAlias || '').toLowerCase();
        return name.includes(query) || alias.includes(query);
    });

    renderSchoolSelect(filtered);

    // 검색 결과가 1개뿐이면 자동으로 선택해주기 (사용자 편의성)
    if (filtered.length === 1) {
        const schoolSelect = document.getElementById('school-select');
        const originalIndex = schoolData.findIndex(s => s.id === filtered[0].id);
        schoolSelect.value = originalIndex;
        // 정보 업데이트를 위해 수동 호출은 하지 않고 사용자가 '조회하기'를 누르도록 유도하거나 자동 호출
    }
}
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
    filterAndDisplayHistory(selectedSchool, startDate, endDate);
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
            <div class="school-action-container" style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                <div id="info-school-region" style="color: #666; font-size: 0.9rem;"></div>
                <div class="school-action-btns">
                    <button id="btn-edit-school" class="btn-edit-small" onclick="toggleEditSchoolMode()">수정</button>
                    <button id="btn-save-school" class="btn-save-small" onclick="saveSchoolChanges()" style="display: none;">저장</button>
                </div>
            </div>
        </div>
        <div class="info-layout">
            <div class="info-left">
                <div class="info-item">
                    <div class="info-label">🏷️ 별칭 (일정 매칭용)</div>
                    <div id="info-school-alias" class="info-value"></div>
                </div>
                <div class="info-item">
                    <div class="info-label">📍 주소</div>
                    <div id="info-school-address" class="info-value"></div>
                </div>
                <div class="info-item">
                    <div class="info-label">📞 대표번호</div>
                    <div id="info-school-phone" class="info-value"></div>
                </div>
                <div class="info-item">
                    <div class="info-label">👤 담당자명</div>
                    <div id="info-school-manager-name" class="info-value"></div>
                </div>
                <div class="info-item">
                    <div class="info-label">📱 담당자 연락처</div>
                    <div id="info-school-manager-phone" class="info-value"></div>
                </div>
                <div class="info-item">
                    <div class="info-label">📧 담당자 이메일</div>
                    <div id="info-school-manager-email" class="info-value"></div>
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
    document.getElementById('info-school-alias').textContent = school.searchAlias || '-';
    document.getElementById('info-school-address').textContent = `${school.address || '-'} (${school.zipCode || '-'})`;
    document.getElementById('info-school-phone').textContent = school.mainPhone || '-';
    
    // 담당자 정보 분리 표시
    document.getElementById('info-school-manager-name').textContent = school.managerName || '-';
    document.getElementById('info-school-manager-phone').textContent = school.managerPhone || '-';
    document.getElementById('info-school-manager-email').textContent = school.managerEmail || '-';
    
    const homeLink = document.getElementById('info-school-home');
    if (school.website && school.website !== '-') {
        homeLink.innerHTML = `<a href="${school.website}" target="_blank">${school.website} (이동)</a>`;
    } else {
        homeLink.textContent = '-';
    }
    
    document.getElementById('info-school-note').textContent = school.note || '-';

    // 수정 모드를 위한 현재 데이터 보관
    currentSchoolId = school.id; // db_service.js에서 가져온 문서 ID
}

/**
 * 학교 정보 수정 모드 토글
 */
window.toggleEditSchoolMode = function() {
    const aliasArea = document.getElementById('info-school-alias');
    const noteArea = document.getElementById('info-school-note');
    const managerNameArea = document.getElementById('info-school-manager-name');
    const managerPhoneArea = document.getElementById('info-school-manager-phone');
    const managerEmailArea = document.getElementById('info-school-manager-email');

    const editBtn = document.getElementById('btn-edit-school');
    const saveBtn = document.getElementById('btn-save-school');

    const currentAlias = aliasArea.textContent === '-' ? '' : aliasArea.textContent;
    const currentNote = noteArea.textContent === '-' ? '' : noteArea.textContent;
    const currentMName = managerNameArea.textContent === '-' ? '' : managerNameArea.textContent;
    const currentMPhone = managerPhoneArea.textContent === '-' ? '' : managerPhoneArea.textContent;
    const currentMEmail = managerEmailArea.textContent === '-' ? '' : managerEmailArea.textContent;

    // 입력창으로 전환
    aliasArea.innerHTML = `<input type="text" id="edit-alias-input" class="edit-input-alias" value="${currentAlias}">`;
    noteArea.innerHTML = `<textarea id="edit-note-input" class="edit-textarea-note">${currentNote}</textarea>`;
    managerNameArea.innerHTML = `<input type="text" id="edit-mname-input" class="edit-input-alias" value="${currentMName}">`;
    managerPhoneArea.innerHTML = `<input type="text" id="edit-mphone-input" class="edit-input-alias" value="${currentMPhone}">`;
    managerEmailArea.innerHTML = `<input type="email" id="edit-memail-input" class="edit-input-alias" value="${currentMEmail}">`;

    editBtn.style.display = 'none';
    saveBtn.style.display = 'inline-block';
};

/**
 * 수정된 정보 Firestore에 저장
 */
window.saveSchoolChanges = async function() {
    const newAlias = document.getElementById('edit-alias-input').value.trim();
    const newNote = document.getElementById('edit-note-input').value.trim();
    const newMName = document.getElementById('edit-mname-input').value.trim();
    const newMPhone = document.getElementById('edit-mphone-input').value.trim();
    const newMEmail = document.getElementById('edit-memail-input').value.trim();

    if (!currentSchoolId) {
        alert("선택된 학교 정보가 명확하지 않습니다.");
        return;
    }

    try {
        const schoolRef = doc(db, "schools", currentSchoolId);
        const updateData = {
            searchAlias: newAlias,
            note: newNote,
            managerName: newMName,
            managerPhone: newMPhone,
            managerEmail: newMEmail
        };
        await updateDoc(schoolRef, updateData);

        alert("학교 정보가 성공적으로 수정되었습니다.");

        // 로컬 데이터 갱신 (다시 로드하지 않고 화면만 업데이트)
        const schoolIndex = document.getElementById('school-select').value;
        if (schoolIndex !== "") {
            Object.assign(schoolData[schoolIndex], updateData);
            displaySchoolInfo(schoolData[schoolIndex]);
        }

        document.getElementById('btn-edit-school').style.display = 'inline-block';
        document.getElementById('btn-save-school').style.display = 'none';

    } catch (error) {
        console.error("Error updating school:", error);
        alert("저장 중 오류가 발생했습니다: " + error.message);
    }
};

/**
 * 학교 객체와 기간 필터링을 통한 이력 출력
 */
function filterAndDisplayHistory(school, start, end) {
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

        // 선택된 학교의 정보
        const targetAlias = (school.searchAlias || '').trim();
        const targetFullName = (school.schoolName || '').trim();

        if (match) {
            const extractedNameFromSchedule = match[1].trim(); // 예: '남대구초', '시지중'
            
            // 1. 별칭이 정확히 일치하는 경우
            if (targetAlias && extractedNameFromSchedule === targetAlias) {
                isSchoolMatch = true;
            } 
            // 2. 별칭이 없더라도 학교 전체 이름에 포함되는 경우 (예: '시지중학교'에 '시지중' 포함)
            else if (targetFullName && targetFullName.includes(extractedNameFromSchedule)) {
                isSchoolMatch = true;
            }
        } else {
            // 괄호가 없는 경우 (직접 입력 등): 기관명 자체가 학교명이나 별칭을 포함하는지 확인
            if (targetAlias && institution.includes(targetAlias)) {
                isSchoolMatch = true;
            } else if (targetFullName && institution.includes(targetFullName)) {
                isSchoolMatch = true;
            }
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
