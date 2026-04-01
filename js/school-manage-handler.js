/* js/school-manage-handler.js */

let schoolData = [];
let historyData = [];

// 페이지 로드 시 학교 목록 및 전체 이력 데이터 사전 로드
window.onload = async () => {
    try {
        const schoolSelect = document.getElementById('school-select');
        
        // 1. 학교 관리 데이터 가져오기
        const schoolRes = await fetch(`${GAS_URL}?sheet=학교관리`);
        schoolData = await schoolRes.json();

        // 2. 출강 이력 데이터 가져오기 (메모리 내 필터링을 위해 미리 로드)
        const historyRes = await fetch(`${GAS_URL}?sheet=출강이력`);
        historyData = await historyRes.json();

        // 드롭다운 구성
        schoolSelect.innerHTML = '<option value="">-- 학교를 선택하세요 --</option>';
        if (Array.isArray(schoolData)) {
            schoolData.forEach((school, index) => {
                if (school['학교명']) {
                    const option = document.createElement('option');
                    option.value = index; // 인덱스를 값으로 사용
                    option.textContent = school['학교명'];
                    schoolSelect.appendChild(option);
                }
            });
        }

        // URL 파라미터가 있을 경우 자동 조회 기능 등 확장 가능
    } catch (e) {
        console.error("Data Load Error:", e);
        alert("데이터를 불러오는 중 오류가 발생했습니다. 인터넷 연결이나 GAS 설정을 확인하세요.");
    }
};

/**
 * 학교를 선택하고 마칠 때 호출되는 조회 함수
 */
async function loadSchoolHistory() {
    const schoolIndex = document.getElementById('school-select').value;
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;

    if (schoolIndex === "") {
        alert("조회할 학교를 먼저 선택해주세요.");
        return;
    }

    const selectedSchool = schoolData[schoolIndex];
    const shortName = selectedSchool['검색용 약칭'];

    // 1. 상단 학교 정보 카드 업데이트
    displaySchoolInfo(selectedSchool);

    // 2. 하단 출강 이력 필터링 및 출력
    filterAndDisplayHistory(shortName, startDate, endDate);
}

/**
 * 선택된 학교의 정보를 상단 카드에 표시
 */
function displaySchoolInfo(school) {
    const infoCard = document.getElementById('school-info');
    infoCard.style.display = 'block';

    document.getElementById('info-school-name').textContent = school['학교명'] || '-';
    document.getElementById('info-school-type').textContent = school['학교구분'] || '-';
    document.getElementById('info-school-region').textContent = `${school['시'] || ''} ${school['구'] || ''}`.trim() || '지역 정보 없음';
    document.getElementById('info-school-address').textContent = `${school['주소'] || '-'} (${school['우편번호'] || '-'})`;
    document.getElementById('info-school-phone').textContent = school['대표번호'] || '-';
    document.getElementById('info-school-contact').textContent = `${school['담당자명'] || '-'} (${school['담당자 연락처'] || '-'})`;
    
    const homeLink = document.getElementById('info-school-home');
    if (school['홈페이지'] && school['홈페이지'] !== '-') {
        homeLink.innerHTML = `<a href="${school['홈페이지']}" target="_blank">${school['홈페이지']} (이동)</a>`;
    } else {
        homeLink.textContent = '-';
    }
    
    document.getElementById('info-school-note').textContent = school['비고'] || '-';
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

    // 필터링 로직
    const filtered = historyData.filter(row => {
        // A. 학교칭 매칭 (괄호 안의 이름 추출)
        const institution = String(row['기관명'] || '');
        const match = institution.match(/\(([^)]+)\)/); // 정규식: (내용) 추출
        let isSchoolMatch = false;

        if (match && shortName) {
            const extractedName = match[1].trim();
            isSchoolMatch = extractedName === shortName.trim();
        } else if (!match && shortName) {
            // 괄호가 없는 경우 기관명 전체에 포함되는지 확인 (폴백 로직)
            isSchoolMatch = institution.includes(shortName.trim());
        }

        // B. 기간 매칭
        const rowDate = new Date(row['날짜']);
        const isAfter = !start || rowDate >= new Date(start);
        const isBefore = !end || rowDate <= new Date(end);

        return isSchoolMatch && isAfter && isBefore;
    });

    // 날짜순 정렬 (최신순)
    filtered.sort((a, b) => new Date(b['날짜']) - new Date(a['날짜']));

    // 테이블 렌더링
    tbody.innerHTML = '';
    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="empty-msg">해당 조건에 맞는 출강 이력이 없습니다.</td></tr>';
        return;
    }

    filtered.forEach((row, index) => {
        const hours = typeof calculateHours === 'function' ? calculateHours(row['시작시간'], row['종료시간']) : '-';
        const dateStr = typeof formatDate === 'function' ? formatDate(row['날짜']) : row['날짜'];
        const educators = `${row['주강사'] || '-'}${row['보조강사'] ? ' / ' + row['보조강사'] : ''}`;

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
