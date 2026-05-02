/* js/manage-handler.js - Firebase Firestore 버전 */
import { getAllSchedules } from './db_service.js';
import { auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

let rawData = [];

// 인증 상태가 확인된 후 데이터를 가져오도록 변경
onAuthStateChanged(auth, async (user) => {
    if (!user) return; // 비로그인 시 로직 중단 (auth-check.js에서 리다이렉트 처리함)

    try {
        const firestoreData = await getAllSchedules();
        
        // Firestore 영문 카멜케이스 → 기존 렌더링 로직의 한글 키로 변환
        rawData = firestoreData.map(r => ({
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

        const select = document.getElementById('teacherSelect');
        const teachers = new Set();
        rawData.forEach(r => {
            if(r['주강사']) teachers.add(r['주강사']);
            const subs = r['보조강사들'] || [];
            subs.forEach(s => { if(s) teachers.add(s); });
        });

        select.innerHTML = '<option value="">강사 선택</option>';
        [...teachers].sort().forEach(t => {
            select.innerHTML += `<option value="${t}">${t}</option>`;
        });
    } catch (e) {
        console.error("Data Load Error:", e);
        alert("강사 목록을 불러오지 못했습니다.");
    }
});

// window에 바인딩하여 HTML onclick에서 호출 가능하도록 설정
window.loadReport = function() {
    const region = document.getElementById('region-select').value;
    const name = document.getElementById('teacherSelect').value;
    const start = document.getElementById('startDate').value;
    const end = document.getElementById('endDate').value;

    if (!name) { alert("강사를 선택해주세요."); return; }

    const filtered = rawData.filter(r => {
        const rDate = new Date(r['날짜']);
        const isRegionMatch = region === "전체" || String(r['지역구분']) === region;
        const subs = r['보조강사들'] || [];
        const isNameMatch = String(r['주강사']) === name || subs.includes(name);
        const isAfter = !start || rDate >= new Date(start);
        const isBefore = !end || rDate <= new Date(end);
        return isNameMatch && isAfter && isBefore && isRegionMatch;
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
                <td>${r['지역구분'] || '-'}</td>
                <td>${r['기관명']}</td>
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
};

window.exportToExcel = function() {
    const table = document.querySelector("#report-area table");
    const wb = XLSX.utils.table_to_book(table, { sheet: "정산내역서", raw: true });
    const name = document.getElementById('teacherSelect').value || '강사';
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `정산내역서_${name}_${dateStr}.xlsx`);
};