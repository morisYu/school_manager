/* js/manage-handler.js */

let rawData = [];

// 페이지 로드 시 강사 목록 추출
window.onload = async () => {
    try {
        // GAS_URL은 config.js에 정의되어 있음
        const res = await fetch(GAS_URL);
        rawData = await res.json();
        
        const teachers = new Set();
        rawData.forEach(r => {
            if(r['주강사']) teachers.add(r['주강사']);
            if(r['보조강사']) teachers.add(r['보조강사']);
        });

        const select = document.getElementById('teacherSelect');
        select.innerHTML = '<option value="">강사 선택</option>';
        [...teachers].sort().forEach(t => {
            select.innerHTML += `<option value="${t}">${t}</option>`;
        });
    } catch (e) {
        console.error("Data Load Error:", e);
        alert("강사 목록을 불러오지 못했습니다.");
    }
};

function formatDate(isoString) {
    if (!isoString) return "-";
    const d = new Date(isoString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function calculateHours(startStr, endStr) {
    try {
        const sMatch = String(startStr).match(/(\d{2}):(\d{2})/);
        const eMatch = String(endStr).match(/(\d{2}):(\d{2})/);
        if (!sMatch || !eMatch) return 0;
        const diff = (parseInt(eMatch[1]) * 60 + parseInt(eMatch[2])) - (parseInt(sMatch[1]) * 60 + parseInt(sMatch[2]));
        return diff > 0 ? (diff / 60).toFixed(1) : 0;
    } catch (e) { return 0; }
}

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