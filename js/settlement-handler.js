import { getAllSchedules, getAllInstructors } from './db_service.js';
import { auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

let schedulesData = [];
let instructorsMap = {}; // name -> profile object
let currentDetailInstructor = "";
let isExcelMode = false;

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
        const mainFee = parseFloat(schedule.instructorFee) || 0;
        const subFee = parseFloat(schedule.subInstructorFee) || 0;

        const processInstructor = (name, fee) => {
            if (!name) return;
            name = String(name).trim();
            if (name === '없음' || name === '미정') return; // '없음', '미정'으로 표시된 강사는 무시

            if (!settlementMap[name]) settlementMap[name] = { totalAmount: 0, hasAmount: false };
            
            const amount = rounds * fee;
            if (amount > 0) {
                settlementMap[name].totalAmount += amount;
                settlementMap[name].hasAmount = true;
            }
        };

        // 주강사 추가 (주강사 단가 사용)
        if (schedule.mainInstructor) {
            processInstructor(schedule.mainInstructor, mainFee);
        }

        // 보조강사 추가 (보조강사 단가 사용, 없으면 주강사 단가로 펴백)
        const subs = normalizeSubInstructors(schedule.subInstructors || schedule.subInstructor);
        const effectiveSubFee = subFee > 0 ? subFee : mainFee;
        subs.forEach(name => processInstructor(name, effectiveSubFee));
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
    currentDetailInstructor = instructorName;
    isExcelMode = false;
    const btnExcel = document.getElementById('btn-settlement-excel');
    if (btnExcel) {
        btnExcel.innerText = '엑셀 다운';
    }
    const checkAll = document.getElementById('check-all-detail-reports');
    if (checkAll) {
        checkAll.checked = true;
    }
    document.querySelectorAll('.excel-checkbox-cell').forEach(el => el.style.display = 'none');

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
            const mainFee = parseFloat(schedule.instructorFee) || 0;
            const subFee = parseFloat(schedule.subInstructorFee) || 0;
            // 보조강사 단가가 없으면 주강사 단가로 펴백 (하위호환)
            const effectiveSubFee = subFee > 0 ? subFee : mainFee;
            
            let roleStr = [];
            if (isMain) roleStr.push('주강사');
            if (isSub) roleStr.push('보조강사');

            if (isMain) {
                const amount = rounds * mainFee;
                let displayAmount = amount > 0 ? amount.toLocaleString() : '-';
                totalDetailAmount += amount;
                tbody.innerHTML += `
                    <tr class="detail-report-row">
                        <td class="excel-checkbox-cell" style="display:none; text-align:center;"><input type="checkbox" class="row-checkbox" checked></td>
                        <td class="date-cell table-center">${schedule.date}</td>
                        <td class="school-cell table-center">${schedule.schoolName || '-'}</td>
                        <td class="program-cell table-center">${schedule.programName || '-'}</td>
                        <td class="role-cell table-center">주강사</td>
                        <td class="lesson-cell table-center">${rounds}</td>
                        <td class="fee-cell" style="display:none;">${mainFee}</td>
                        <td class="amount-cell table-amount">${displayAmount}</td>
                    </tr>
                `;
            }
            if (isSub) {
                const amount = rounds * effectiveSubFee;
                let displayAmount = amount > 0 ? amount.toLocaleString() : '-';
                totalDetailAmount += amount;
                tbody.innerHTML += `
                    <tr class="detail-report-row">
                        <td class="excel-checkbox-cell" style="display:none; text-align:center;"><input type="checkbox" class="row-checkbox" checked></td>
                        <td class="date-cell table-center">${schedule.date}</td>
                        <td class="school-cell table-center">${schedule.schoolName || '-'}</td>
                        <td class="program-cell table-center">${schedule.programName || '-'}</td>
                        <td class="role-cell table-center">보조강사</td>
                        <td class="lesson-cell table-center">${rounds}</td>
                        <td class="fee-cell" style="display:none;">${effectiveSubFee}</td>
                        <td class="amount-cell table-amount">${displayAmount}</td>
                    </tr>
                `;
            }
        }
    });

    if (!foundAny) {
        tbody.innerHTML = '<tr><td colspan="7" class="table-center">출강 내역이 없습니다.</td></tr>';
    } else {
        // 총계 행 추가
        tbody.innerHTML += `
            <tr style="background-color: #f8f9fa; font-weight: bold;">
                <td id="detail-total-colspan" colspan="5" style="text-align: right; padding-right: 15px;">총 합계</td>
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
    isExcelMode = false;
    const btnExcel = document.getElementById('btn-settlement-excel');
    if (btnExcel) {
        btnExcel.innerText = '엑셀 다운';
    }
    document.querySelectorAll('.excel-checkbox-cell').forEach(el => el.style.display = 'none');
    const totalTd = document.getElementById('detail-total-colspan');
    if (totalTd) totalTd.colSpan = 5;

    const overlay = document.getElementById('detail-modal-overlay');
    const modal = document.getElementById('detail-modal');

    overlay.classList.remove('is-open');
    modal.classList.remove('is-open');

    modal.addEventListener('transitionend', () => {
        overlay.style.display = 'none';
        modal.style.display = 'none';
    }, { once: true });
};

window.toggleAllDetailReportRows = function(checkbox) {
    const checkboxes = document.querySelectorAll('#detail-modal-tbody .row-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
};

window.handleSettlementExcel = async function() {
    if (!isExcelMode) {
        // 전환: 선택 모드로 변경
        isExcelMode = true;
        document.getElementById('btn-settlement-excel').innerText = '선택 다운로드';
        document.querySelectorAll('.excel-checkbox-cell').forEach(el => el.style.display = 'table-cell');
        
        // 체크박스 초기화
        const checkAll = document.getElementById('check-all-detail-reports');
        if (checkAll) checkAll.checked = true;
        document.querySelectorAll('#detail-modal-tbody .row-checkbox').forEach(cb => cb.checked = true);
        
        // 합계 칸의 colspan 조정 (체크박스 열이 생겼으므로 6으로 변경)
        const totalTd = document.getElementById('detail-total-colspan');
        if (totalTd) totalTd.colSpan = 6;
    } else {
        // 다운로드 실행
        await window.downloadSettlementExcel();
    }
};

window.downloadSettlementExcel = async function() {
    const rows = document.querySelectorAll('#detail-modal-tbody .detail-report-row');
    const exportData = [];

    rows.forEach((row) => {
        const checkbox = row.querySelector('.row-checkbox');
        if (!checkbox || !checkbox.checked) return;

        const date = row.querySelector('.date-cell').innerText;
        const school = row.querySelector('.school-cell').innerText;
        const program = row.querySelector('.program-cell').innerText;
        const role = row.querySelector('.role-cell').innerText;
        const lesson = row.querySelector('.lesson-cell').innerText;
        const fee = row.querySelector('.fee-cell').innerText;
        const amount = row.querySelector('.amount-cell').innerText;

        exportData.push([
            date,
            school,
            program,
            role,
            lesson,
            fee,
            amount
        ]);
    });

    if (exportData.length === 0) {
        alert("다운로드할 내역이 없습니다.");
        return;
    }

    const btn = document.getElementById('btn-settlement-excel');
    if (btn) {
        btn.innerText = '생성 중...';
        btn.disabled = true;
    }

    try {
        const response = await fetch('../template.xlsx');
        const workbook = new ExcelJS.Workbook();
        
        if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);
        } else {
            console.warn("template.xlsx 템플릿 파일을 찾을 수 없어 새 시트로 생성합니다.");
            const worksheet = workbook.addWorksheet('정산내역서');
            worksheet.getCell('B1').value = '급여계산서';
            worksheet.getRow(5).values = [null, '날짜', '기관명', '프로그램명', '강사 구분', '차시', '합계금액'];
        }

        const worksheet = workbook.worksheets[0];

        const startDateInput = document.getElementById('startDate');
        const startVal = startDateInput ? startDateInput.value : '';
        if (startVal) {
            const dateObj = new Date(startVal);
            const yyyy = dateObj.getFullYear();
            const m = dateObj.getMonth() + 1;
            const b1Cell = worksheet.getCell('B1');
            const titleStr = `${yyyy}년 ${m}월 급여계산서`;
            if (b1Cell.isMerged) {
                b1Cell.master.value = titleStr;
            } else {
                b1Cell.value = titleStr;
            }
        }

        const nameCell = worksheet.getCell('F3');
        if (nameCell.isMerged) {
            nameCell.master.value = `강사명: ${currentDetailInstructor}`;
        } else {
            nameCell.value = `강사명: ${currentDetailInstructor}`;
        }

        let startRowIndex = 6;
        
        if (response.ok && exportData.length > 24) {
            const extraRows = exportData.length - 24;
            const emptyRows = Array(extraRows).fill([]);
            worksheet.spliceRows(30, 0, ...emptyRows);

            const styleRow = worksheet.getRow(29);
            for (let i = 0; i < extraRows; i++) {
                const newRow = worksheet.getRow(30 + i);
                newRow.height = 30;
                styleRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    newRow.getCell(colNumber).style = cell.style;
                });
            }

            const totalRow = worksheet.getRow(30 + extraRows);
            const sumCell = totalRow.getCell(7);
            sumCell.value = { formula: `SUM(G6:G${29 + extraRows})` };
        }

        exportData.forEach((dataRow, idx) => {
            const currentRow = worksheet.getRow(startRowIndex + idx);
            currentRow.getCell(2).value = dataRow[0];
            currentRow.getCell(3).value = dataRow[1];
            currentRow.getCell(4).value = dataRow[2];
            currentRow.getCell(5).value = dataRow[3];
            currentRow.getCell(6).value = Number(dataRow[4]) || 0;
            // manage-handler.js 에서는 강사비 열을 비워둠. 여기서도 비워둠.
            currentRow.getCell(7).value = Number(dataRow[6].replace(/,/g, '')) || 0;
        });

        // 페이지 설정: 1페이지 안에 모두 맞춤
        // 템플릿의 여백이나 열 너비는 건드리지 않고, 인쇄 시 1페이지에 딱 맞게 들어가도록 스케일만 조정합니다.
        if (worksheet.pageSetup) {
            worksheet.pageSetup.fitToPage = true;
            worksheet.pageSetup.fitToWidth = 1;
            worksheet.pageSetup.fitToHeight = 1;
        }

        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
        saveAs(blob, `정산내역서_${today}_${currentDetailInstructor}.xlsx`);

        // 다운로드 성공 후 초기화
        isExcelMode = false;
        if (btn) btn.innerText = '엑셀 다운';
        document.querySelectorAll('.excel-checkbox-cell').forEach(el => el.style.display = 'none');
        const totalTd = document.getElementById('detail-total-colspan');
        if (totalTd) totalTd.colSpan = 5;

    } catch (error) {
        console.error("Excel 생성 중 오류 발생:", error);
        alert("엑셀 생성 중 오류가 발생했습니다. 양식 파일(template.xlsx) 존재 여부를 확인해주세요.");
    } finally {
        if (btn) {
            if (isExcelMode) btn.innerText = '선택 다운로드';
            else btn.innerText = '엑셀 다운';
            btn.disabled = false;
        }
    }
};
