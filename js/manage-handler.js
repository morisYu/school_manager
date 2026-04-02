/* js/manage-handler.js */

let rawData = [];

// 페이지 로드 시 강사 목록 추출 (캐싱 및 백그라운드 갱신 적용)
window.onload = () => {
    // 학교 관리 페이지와 동일한 URL 및 캐시키를 사용하여 캐시 데이터 재사용
    fetchAndCache(`${GAS_URL}?sheet=출강이력`, 'cached_historyData', (data, isCache) => {
        rawData = data;
        
        const select = document.getElementById('teacherSelect');
        const prevVal = select.value;
        
        const teachers = new Set();
        rawData.forEach(r => {
            if(r['주강사']) teachers.add(r['주강사']);
            if(r['보조강사']) teachers.add(r['보조강사']);
        });

        select.innerHTML = '<option value="">강사 선택</option>';
        [...teachers].sort().forEach(t => {
            select.innerHTML += `<option value="${t}">${t}</option>`;
        });
        
        // 사용자가 이미 강사를 선택해 놓았다면 값 유지
        if (prevVal && [...teachers].includes(prevVal)) {
            select.value = prevVal;
        }
        
        // 백그라운드 갱신 데이터가 들어왔을 때 이미 화면 조회 중이라면 재렌더링
        if (!isCache && select.value) {
            loadReport();
        }
    }).catch(e => {
        console.error("Data Load Error:", e);
        alert("강사 목록을 불러오지 못했습니다.");
    });
};



function exportToExcel() {
    const table = document.querySelector("#report-area table");
    const wb = XLSX.utils.table_to_book(table, { sheet: "정산내역서", raw: true });
    const name = document.getElementById('teacherSelect').value || '강사';
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `정산내역서_${name}_${dateStr}.xlsx`);
}

async function loadReport() {
    const region = document.getElementById('region-select').value; // 지역 값 가져오기
    const name = document.getElementById('teacherSelect').value;
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;

    if (!name) { alert("강사를 선택해주세요."); return; }

    const filtered = rawData.filter(r => {
        const rDate = new Date(r['날짜']);
        // 지역 필터 조건 추가: '전체'가 아니면 시트의 '지역구분' 컬럼과 비교
        const isRegionMatch = region === "전체" || String(r['지역구분']) === region;
        const isNameMatch = String(r['주강사']) === name || String(r['보조강사']) === name;
        const isAfter = !start || rDate >= new Date(start);
        const isBefore = !end || rDate <= new Date(end);
        return isNameMatch && isAfter && isBefore;
    }).sort((a, b) => new Date(a['날짜']) - new Date(b['날짜']));

    const tbody = document.getElementById('report-table-body');
    const footer = document.getElementById('report-footer');
    tbody.innerHTML = '';
    
    let mainTotal = 0;
    let subTotal = 0;

    filtered.forEach((r, index) => {
        const hours = calculateHours(r['시작시간'], r['종료시간']);
        const role = String(r['주강사']) === name ? "주강사" : "보조강사";
        
        if(role === "주강사") mainTotal += parseFloat(hours);
        else subTotal += parseFloat(hours);

        tbody.innerHTML += `
            <tr>
                <td>${index + 1}</td>
                <td class="date-cell">${formatDate(r['날짜'])}</td>
                <td>${r['지역구분'] || '-'}</td> <td>${r['기관명']}</td>
                <td>${r['프로그램명']}</td>
                <td>${role}</td>
                <td class="hour-cell">${hours}</td>
                <td><input type="number" class="lesson-input" value="" step="0.5"></td>
                <td><input type="text" class="note-input" value="${r['비고'] || ''}"></td>
            </tr>
        `;
    });

    document.getElementById('main-total-hours').innerText = mainTotal.toFixed(1);
    document.getElementById('sub-total-hours').innerText = subTotal.toFixed(1);
    document.getElementById('total-hours').innerText = (mainTotal + subTotal).toFixed(1);

    if (filtered.length > 0) {
        footer.style.display = 'table-footer-group';
    } else {
        tbody.innerHTML = '<tr><td colspan="9">내역이 없습니다.</td></tr>';
        footer.style.display = 'none';
    }
}