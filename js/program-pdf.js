/**
 * 프로그램 관리 PDF 출력 모듈
 * window.print()를 이용하여 교육계획안과 교구 목록을 출력합니다.
 */

export function printProgramAsPDF(programData) {
    const printArea = document.getElementById('print-area');
    if (!printArea) {
        console.error("인쇄 영역(#print-area)을 찾을 수 없습니다.");
        return;
    }

    // 대상 학년 포맷팅
    const grades = programData.targetGrades && programData.targetGrades.length > 0 
        ? programData.targetGrades.join(', ') 
        : '지정되지 않음';

    // 교구 목록 HTML 생성
    let materialsHtml = '';
    if (programData.materials && programData.materials.length > 0) {
        let rows = '';
        programData.materials.forEach(mat => {
            // 인쇄용 이미지 셀 (이미지가 있으면 출력, 없으면 빈 칸)
            const imgContent = mat.imageUrl 
                ? `<img src="${mat.imageUrl}" style="max-width: 80px; max-height: 80px; object-fit: cover;">` 
                : '';
            
            rows += `
                <tr>
                    <td>${mat.name || ''}</td>
                    <td style="text-align: center;">${mat.quantityPerStudent || ''}</td>
                    <td style="text-align: center;">${imgContent}</td>
                    <td>${mat.note || ''}</td>
                </tr>
            `;
        });

        materialsHtml = `
            <div class="print-section">
                <h2>필요 교구 및 재료</h2>
                <table class="print-materials-table">
                    <thead>
                        <tr>
                            <th>교구/재료명</th>
                            <th style="width: 80px;">1인 수량</th>
                            <th style="width: 100px; text-align: center;">이미지</th>
                            <th>비고</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;
    }

    // 출력 날짜
    const today = new Date();
    const dateStr = `${today.getFullYear()}.${String(today.getMonth() + 1).padStart(2, '0')}.${String(today.getDate()).padStart(2, '0')}`;

    // 인쇄용 HTML 구성
    const html = `
        <div class="print-header">
            <h1>교육 프로그램 계획안</h1>
            <div class="print-meta">
                <span><strong>프로그램명:</strong> ${programData.programName}</span>
                <span><strong>카테고리:</strong> ${programData.category}</span>
                <span><strong>대상 학년:</strong> ${grades}</span>
            </div>
        </div>

        <div class="print-section">
            <h2>수업 개요 및 교육계획안</h2>
            <div class="ql-editor" style="border: none; overflow: visible;">
                ${programData.educationPlan || '<p>작성된 교육계획안이 없습니다.</p>'}
            </div>
        </div>

        ${materialsHtml}

        <div style="margin-top: 50px; text-align: right; color: #555;">
            출력일자: ${dateStr}
        </div>
    `;

    printArea.innerHTML = html;

    // 이미지 로딩을 위해 약간 대기 후 인쇄 (이미지가 많을 경우를 대비)
    setTimeout(() => {
        window.print();
    }, 500);
}
