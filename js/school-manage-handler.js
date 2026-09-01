import { getSchools, getAllSchedules } from './db_service.js';
import { db, auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, updateDoc, deleteDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

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
            <div class="school-title-box" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                <h2 id="info-school-name" style="margin: 0;"></h2>
                <span id="info-school-type" class="school-type-tag"></span>
                <span id="info-school-code" class="school-type-tag" style="display: none; background: #f5f5f5; color: #333; border: 1px solid #ddd;">코드: -</span>
                <span id="info-school-classes" class="school-type-tag" style="display: none; cursor: pointer; background: #e8f5e9; color: #2e7d32;" onclick="window.toggleGradeDetails()">학급수: -</span>
                <span id="info-school-students" class="school-type-tag" style="display: none; cursor: pointer; background: #fff3e0; color: #e65100;" onclick="window.toggleGradeDetails()">학생수: -</span>
            </div>
            <div class="school-action-container" style="display: flex; flex-direction: column; align-items: flex-end; gap: 5px;">
                <div id="info-school-region" style="color: #666; font-size: 0.9rem;"></div>
                <div class="school-action-btns">
                    <button id="btn-edit-school" class="btn-edit-small" onclick="toggleEditSchoolMode()">수정</button>
                    <button id="btn-save-school" class="btn-save-small" onclick="saveSchoolChanges()" style="display: none;">저장</button>
                </div>
            </div>
        </div>
        
        <!-- 학년별 상세 데이터 (숨김 기본) -->
        <div id="grade-details-panel" style="display: none; width: 100%; margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px; border: 1px solid #e0e0e0;">
            <h4 style="margin-top: 0; margin-bottom: 10px; font-size: 14px; color: #333;">학년별 상세 현황</h4>
            <table style="width: 100%; text-align: center; border-collapse: collapse; font-size: 0.85rem;">
                <thead>
                    <tr style="background: #f1f3f5;">
                        <th style="padding: 6px; border: 1px solid #ddd;">구분</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">1학년</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">2학년</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">3학년</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">4학년</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">5학년</th>
                        <th style="padding: 6px; border: 1px solid #ddd;">6학년</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <th style="padding: 6px; border: 1px solid #ddd; background: #f8f9fa;">학급수</th>
                        <td id="gd-c-1" style="padding: 6px; border: 1px solid #ddd;">-</td>
                        <td id="gd-c-2" style="padding: 6px; border: 1px solid #ddd;">-</td>
                        <td id="gd-c-3" style="padding: 6px; border: 1px solid #ddd;">-</td>
                        <td id="gd-c-4" style="padding: 6px; border: 1px solid #ddd;">-</td>
                        <td id="gd-c-5" style="padding: 6px; border: 1px solid #ddd;">-</td>
                        <td id="gd-c-6" style="padding: 6px; border: 1px solid #ddd;">-</td>
                    </tr>
                    <tr>
                        <th style="padding: 6px; border: 1px solid #ddd; background: #f8f9fa;">학생수</th>
                        <td id="gd-s-1" style="padding: 6px; border: 1px solid #ddd;">-</td>
                        <td id="gd-s-2" style="padding: 6px; border: 1px solid #ddd;">-</td>
                        <td id="gd-s-3" style="padding: 6px; border: 1px solid #ddd;">-</td>
                        <td id="gd-s-4" style="padding: 6px; border: 1px solid #ddd;">-</td>
                        <td id="gd-s-5" style="padding: 6px; border: 1px solid #ddd;">-</td>
                        <td id="gd-s-6" style="padding: 6px; border: 1px solid #ddd;">-</td>
                    </tr>
                </tbody>
            </table>
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
                    <div class="info-label">👤 담당자</div>
                    <div class="info-value contact-inline">
                        <span id="info-school-manager-name"></span>
                        <span class="contact-separator">|</span>
                        <span id="info-school-manager-phone"></span>
                    </div>
                </div>
                <div class="info-item">
                    <div class="info-label">📧 이메일</div>
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
    
    // 신규 뱃지 데이터 바인딩
    document.getElementById('info-school-code').textContent = '코드: ' + (school.schoolCode || '미등록');
    document.getElementById('info-school-code').style.display = 'inline-block';
    
    if (school.classStats) {
        document.getElementById('info-school-classes').textContent = '학급수: ' + (school.classStats.totalClasses || 0);
        document.getElementById('info-school-students').textContent = '학생수: ' + (school.classStats.totalStudents || 0);
        document.getElementById('info-school-classes').style.display = 'inline-block';
        document.getElementById('info-school-students').style.display = 'inline-block';
        
        for (let i = 1; i <= 6; i++) {
            const gradeData = school.classStats['grade' + i] || {};
            document.getElementById('gd-c-' + i).textContent = gradeData.classes || 0;
            const stCount = Math.floor((gradeData.classes || 0) * (gradeData.studentsPerClass || 0));
            document.getElementById('gd-s-' + i).textContent = stCount;
        }
    } else {
        document.getElementById('info-school-classes').style.display = 'none';
        document.getElementById('info-school-students').style.display = 'none';
        for (let i = 1; i <= 6; i++) {
            document.getElementById('gd-c-' + i).textContent = 0;
            document.getElementById('gd-s-' + i).textContent = 0;
        }
    }

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
 * 학년별 상세 현황 패널 토글
 */
window.toggleGradeDetails = function() {
    const panel = document.getElementById("grade-details-panel");
    if (panel) {
        if (panel.style.display === "none" || panel.style.display === "") {
            panel.style.display = "block";
        } else {
            panel.style.display = "none";
        }
    }
};

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
    // 담당자: 인라인 구조에서 개별 span을 입력창으로 교체
    managerNameArea.innerHTML = `<input type="text" id="edit-mname-input" class="edit-input-alias" value="${currentMName}" placeholder="담당자명" style="width: auto; min-width: 80px;">`;
    managerPhoneArea.innerHTML = `<input type="text" id="edit-mphone-input" class="edit-input-alias" value="${currentMPhone}" placeholder="연락처" style="width: auto; min-width: 120px;">`;
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
        // 학교명에서 '등학교', '중학교', '학교' 접미사 제거한 축약명 생성
        const targetShortName = targetFullName.replace(/등학교$|중학교$|학교$/, '').trim();

        if (match) {
            const extractedName = match[1].trim(); // 예: '대서초', '시지중'
            
            // 1. 별칭과 정확히 일치
            if (targetAlias && extractedName === targetAlias) {
                isSchoolMatch = true;
            } 
            // 2. 축약 학교명과 정확히 일치 (예: '대서초' === '대서초')
            else if (targetShortName && extractedName === targetShortName) {
                isSchoolMatch = true;
            }
        } else {
            // 괄호가 없는 경우: 기관명이 별칭 또는 학교명과 정확히 일치하는지 확인
            const instTrimmed = institution.trim();
            if (targetAlias && instTrimmed === targetAlias) {
                isSchoolMatch = true;
            } else if (targetFullName && instTrimmed === targetFullName) {
                isSchoolMatch = true;
            } else if (targetShortName && instTrimmed === targetShortName) {
                isSchoolMatch = true;
            }
        }

        const rowDate = new Date(row['날짜']);
        const isAfter = !start || rowDate >= new Date(start);
        const isBefore = !end || rowDate <= new Date(end);

        return isSchoolMatch && isAfter && isBefore;
    });

    // ── 중복 일정 제거: 같은 날짜+기관명+프로그램에 강사 배정 버전이 있으면 '미정' 버전 제외 ──
    const deduplicated = filtered.filter(row => {
        const mainInstructor = (row['주강사'] || '').trim();
        const isUnassigned = mainInstructor === '미정' || mainInstructor === '';

        if (!isUnassigned) return true; // 강사가 배정된 일정은 항상 유지

        // '미정'인 경우: 같은 날짜+기관명+프로그램에 강사가 배정된 다른 레코드가 있는지 확인
        const hasDuplicate = filtered.some(other => {
            if (other === row) return false;
            const otherInstructor = (other['주강사'] || '').trim();
            return other['날짜'] === row['날짜']
                && other['기관명'] === row['기관명']
                && other['프로그램명'] === row['프로그램명']
                && otherInstructor !== '미정'
                && otherInstructor !== '';
        });

        return !hasDuplicate; // 강사 배정 버전이 있으면 이 '미정' 레코드는 제외
    });

    deduplicated.sort((a, b) => new Date(b['날짜']) - new Date(a['날짜']));

    tbody.innerHTML = '';
    if (deduplicated.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">해당 조건에 맞는 출강 이력이 없습니다.</td></tr>';
        return;
    }

    deduplicated.forEach((row, index) => {
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
                <td class="time-cell">${hours}분</td>
                <td>${row['비고'] || '-'}</td>
            </tr>
        `;
    });
}

// ==========================================
// CSV 일괄 업데이트 모달 UI 제어
// ==========================================
window.openCsvModal = function() {
    const modal = document.getElementById('csv-modal');
    if (modal) {
        modal.style.display = 'block';
        // 모달을 열 때 초기화 로직 추가 가능
        document.getElementById('csv-preview-section').style.display = 'none';
        document.getElementById('btn-save-csv').style.display = 'none';
    }
};

window.closeCsvModal = function() {
    const modal = document.getElementById('csv-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

window.filterCsvPreview = function(filterType) {
    const rows = document.querySelectorAll('.preview-row');
    rows.forEach(row => {
        if (filterType === 'all') row.style.display = 'table-row';
        else if (row.classList.contains('status-' + filterType)) row.style.display = 'table-row';
        else row.style.display = 'none';
    });
};

let parsedUpdates = [];

window.analyzeCsvFiles = async function() {
    parsedUpdates = [];
    const studentInputs = ['csv-student-e', 'csv-student-m', 'csv-student-h'];
    const basicInputs = ['csv-basic-e', 'csv-basic-m', 'csv-basic-h'];
    
    let allStudentData = [];
    let allBasicData = [];
    
    const parseFile = (file) => {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                skipEmptyLines: true,
                complete: (results) => resolve(results.data),
                error: (err) => reject(err)
            });
        });
    };

    try {
        for (const id of studentInputs) {
            const el = document.getElementById(id);
            if (el && el.files.length > 0) {
                const data = await parseFile(el.files[0]);
                allStudentData = allStudentData.concat(data);
            }
        }
        
        for (const id of basicInputs) {
            const el = document.getElementById(id);
            if (el && el.files.length > 0) {
                const data = await parseFile(el.files[0]);
                allBasicData = allBasicData.concat(data);
            }
        }
    } catch (e) {
        alert("CSV 파싱 중 오류가 발생했습니다: " + e.message);
        return;
    }

    if (allStudentData.length === 0 && allBasicData.length === 0) {
        alert("업로드된 파일이 없습니다.");
        return;
    }

    const updatesMap = new Map();

    const normalizeName = (name) => {
        if (!name) return '';
        return name.replace(/\(검토필요\)/g, '').replace(/\s+/g, '').trim();
    };

    const allData = [...allBasicData, ...allStudentData];

    // 통합 데이터 처리 (어느 입력칸에 넣었든 상관없이 컬럼명 기준으로 정보 추출)
    for (const row of allData) {
        const code = row['정보공시 학교코드'] || row['학교코드'];
        if (!code) continue;
        
        const rowName = row['학교명'];
        const normRowName = normalizeName(rowName);
        
        // 기존 맵(이번 파싱 중 등록된 데이터) 우선 확인
        let existingSchool = updatesMap.get(code);
        
        // 맵에 없다면 기존 DB(schoolData)에서 매칭 (1순위: 코드, 2순위: 이름)
        if (!existingSchool) {
            existingSchool = schoolData.find(s => s.id === code || s.schoolId === code || s.schoolCode === code);
            if (!existingSchool) {
                existingSchool = schoolData.find(s => normalizeName(s.schoolName) === normRowName);
            }
        }

        // --- 기본 정보 추출 ---
        const basicInfo = {};
        if (row['시도교육청'] || row['지역']) basicInfo.city = row['시도교육청'] || row['지역'];
        
        let extractedAddress = row['학교도로명 주소'] || row['도로명주소'] || row['소재지도로명주소'] || row['주소'] || '';
        let addressDetail = row['학교도로명 상세주소'] || '';
        if (extractedAddress) {
            basicInfo.address = (extractedAddress + ' ' + addressDetail).trim();
        }
        
        if (row['학교도로명 우편번호'] || row['우편번호']) basicInfo.zipCode = String(row['학교도로명 우편번호'] || row['우편번호']);
        if (row['전화번호'] || row['대표번호'] || row['대표전화']) basicInfo.mainPhone = row['전화번호'] || row['대표번호'] || row['대표전화'];
        if (row['홈페이지 주소'] || row['홈페이지주소'] || row['홈페이지']) basicInfo.website = row['홈페이지 주소'] || row['홈페이지주소'] || row['홈페이지'];
        if (row['설립구분']) basicInfo.schoolType = row['설립구분'];

        // --- 학급/학생수 추출 ---
        let classStats = null;
        if (row['학급수(계)'] !== undefined || row['학생수(계)'] !== undefined) {
            classStats = {
                totalClasses: Number(row["학급수(계)"]) || 0,
                totalStudents: Number(row["학생수(계)"]) || 0,
            };
            for(let i=1; i<=6; i++) {
                classStats['grade'+i] = {
                    classes: Number(row[`${i}학년 학급수`]) || 0,
                    studentsPerClass: Number(row[`${i}학년 학급당 학생수`]) || 0
                };
            }
        }

        // --- 별칭 자동 생성 ---
        const generateAlias = (name) => {
            if (!name) return '';
            let cleanName = name.replace(/\(.*\)/g, '').trim(); // (검토필요) 등 제거
            if (cleanName.endsWith('초등학교')) return cleanName.replace('초등학교', '초');
            if (cleanName.endsWith('중학교')) return cleanName.replace('중학교', '중');
            if (cleanName.endsWith('고등학교')) return cleanName.replace('고등학교', '고');
            if (cleanName.endsWith('대학교')) return cleanName.replace('대학교', '대');
            return '';
        };

        // 병합 처리
        let mergedSchool = { ...(existingSchool || {}) };
        mergedSchool.id = existingSchool && existingSchool.id ? existingSchool.id : code;
        mergedSchool.schoolId = code;
        mergedSchool.schoolCode = code;
        if (!mergedSchool.schoolName || mergedSchool.schoolName === '미상') {
            mergedSchool.schoolName = rowName || '미상';
        }
        if (!mergedSchool.searchAlias) {
            mergedSchool.searchAlias = generateAlias(mergedSchool.schoolName);
        }
        
        // 기본정보 병합 (CSV에 데이터가 있을 때만 덮어쓰기)
        Object.keys(basicInfo).forEach(key => {
            if (basicInfo[key]) mergedSchool[key] = basicInfo[key];
        });
        
        // 학급/학생수 병합
        if (classStats) {
            mergedSchool.classStats = classStats;
        }

        updatesMap.set(code, {
            ...mergedSchool,
            _status: (existingSchool && existingSchool._status) ? existingSchool._status : (existingSchool && Object.keys(existingSchool).length > 0 ? 'update' : 'new'),
            _newName: rowName || mergedSchool.schoolName,
            _region: mergedSchool.city || ''
        });
    }
    
    const tbody = document.getElementById('csv-preview-body');
    tbody.innerHTML = '';
    
    let cntNew = 0, cntUpdate = 0;

    updatesMap.forEach((val, code) => {
        parsedUpdates.push(val);
        const st = val._status;
        if (st === 'new') cntNew++;
        else if (st === 'update') cntUpdate++;
        
        const tr = document.createElement('tr');
        tr.className = `preview-row status-${st}`;
        
        let badgeHtml = '';
        if (st === 'new') badgeHtml = '<span class="badge" style="background:#e3f2fd; color:#1976d2; padding:3px 6px; border-radius:4px;">신규</span>';
        else if (st === 'update') badgeHtml = '<span class="badge" style="background:#e8f5e9; color:#388e3c; padding:3px 6px; border-radius:4px;">업데이트</span>';
        
        tr.innerHTML = `
            <td style="padding:8px; border-bottom:1px solid #ddd;">${badgeHtml}</td>
            <td style="padding:8px; border-bottom:1px solid #ddd;">${code}</td>
            <td style="padding:8px; border-bottom:1px solid #ddd;">${val.schoolName} ${val._newName && val._newName !== val.schoolName ? `➔ <b>${val._newName}</b>` : ''}</td>
            <td style="padding:8px; border-bottom:1px solid #ddd;">${val._region || '-'}</td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('count-new').textContent = cntNew;
    document.getElementById('count-update').textContent = cntUpdate;
    
    document.getElementById('csv-preview-section').style.display = 'block';
    if (parsedUpdates.length > 0) {
        document.getElementById('btn-save-csv').style.display = 'inline-block';
    }
};

window.saveCsvToDb = async function() {
    if (parsedUpdates.length === 0) return;
    const btn = document.getElementById('btn-save-csv');
    btn.disabled = true;
    btn.textContent = '저장 중...';
    
    try {
        const { bulkUpdateSchools } = await import('./db_service.js');
        const newSchools = parsedUpdates.filter(s => s._status === 'new').map(s => {
            const copy = {...s};
            if (s._newName) copy.schoolName = s._newName;
            delete copy._status; delete copy._newName; delete copy._region;
            return copy;
        });
        const updateSchools = parsedUpdates.filter(s => s._status === 'update').map(s => {
            const copy = {...s};
            if (s._newName) copy.schoolName = s._newName;
            delete copy._status; delete copy._newName; delete copy._region;
            copy.docId = copy.id; // required by bulkUpdateSchools
            return copy;
        });
        
        await bulkUpdateSchools(newSchools, updateSchools);
        alert(`성공적으로 ${newSchools.length}개 추가, ${updateSchools.length}개 업데이트 되었습니다!`);
        closeCsvModal();
        location.reload();
    } catch(e) {
        alert('저장 중 오류 발생: ' + e.message);
        btn.disabled = false;
        btn.textContent = 'DB 일괄 적용';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const btnAnalyze = document.getElementById('btn-analyze-csv');
    if (btnAnalyze) {
        btnAnalyze.addEventListener('click', window.analyzeCsvFiles);
    }
    
    const btnSave = document.getElementById('btn-save-csv');
    if (btnSave) {
        btnSave.addEventListener('click', window.saveCsvToDb);
    }
});

// ==========================================
// 깡통 학교 임시 삭제 유틸
// ==========================================
window.cleanupDuplicates = async function() {
    if (!confirm("최근 잘못 생성된 주소 없는 깡통 학교 데이터를 전부 삭제하시겠습니까? (삭제된 데이터는 복구할 수 없습니다)")) return;
    
    try {
        const todayStr = new Date();
        todayStr.setHours(0, 0, 0, 0); // 오늘 자정 기준
        const todayIso = todayStr.toISOString();
        
        // 전체 학교를 가져와서 클라이언트에서 필터링 (createdAt이 없거나 updatedAt만 있는 경우도 처리하기 위해)
        const snap = await getDocs(collection(db, "schools"));
        
        let deleteCount = 0;
        const promises = [];
        
        snap.forEach(d => {
            const data = d.data();
            const createdToday = data.createdAt && data.createdAt >= todayIso;
            const updatedToday = data.updatedAt && data.updatedAt >= todayIso;
            
            // 오늘 생성되었거나 업데이트되었으면서, 주소가 비어있는 경우 삭제 대상
            if ((createdToday || updatedToday) && (!data.address || data.address.trim() === '')) {
                promises.push(deleteDoc(d.ref));
                deleteCount++;
            }
        });
        
        if (deleteCount === 0) {
            alert("삭제할 깡통 학교가 없습니다. (혹은 예전에 만들어진 학교라서 보호되었습니다)");
            return;
        }
        
        await Promise.all(promises);
        alert(`총 ${deleteCount}개의 깡통 데이터를 성공적으로 삭제했습니다!\n확인을 누르시면 페이지가 새로고침됩니다.`);
        location.reload();
        
    } catch(e) {
        alert("삭제 중 오류 발생: " + e.message);
        console.error(e);
    }
};
