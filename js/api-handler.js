/* js/api-handler.js 최종 수정본 */

// 1. HTML의 onclick="saveEvent()"와 연결
function saveEvent() {
    processData('save');
}

// 2. HTML의 onclick="deleteEvent()"와 연결
function deleteEvent() {
    processData('delete');
}

function processData(action) {
    if (action === 'delete' && !confirm("정말 이 일정을 삭제하시겠습니까?")) return;

    if (typeof GAS_URL === 'undefined') {
        alert("GAS_URL이 정의되지 않았습니다. config.js를 확인하세요.");
        return;
    }

    const btn = document.querySelector('.btn-save');
    const originalText = btn ? btn.innerText : '저장하기';

    try {
        const getValue = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : "";
        };

        // [중요] GAS 서버(Code.gs)의 헤더 명칭과 100% 일치시켜야 합니다.
        const payload = {
            action: action,
            row: getValue('edit-row'),
            // [추가] 현재 작업 중인 시트명을 명시 (필요시 변수화 가능)
            sheetName: "출강이력", 
            data: {
                "날짜": getValue('edit-date'),
                "시작시간": getValue('edit-start'),
                "종료시간": getValue('edit-end'),
                "프로그램명": getValue('edit-program'),
                "기관명": getValue('edit-institution'),
                "주강사": getValue('edit-main'),
                "보조강사": getValue('edit-sub'),
                "교구종류": getValue('edit-tool'),
                "교구수량": getValue('edit-count'),
                "비고": getValue('edit-note'),
                "색상": getValue('edit-color')
            }
        };

        if (btn) {
            btn.innerText = '처리 중...';
            btn.disabled = true;
        }

        fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            if (data.result === "success") {
                alert('정상적으로 처리되었습니다.');
                closeModal();
                if (window.myCalendar) {
                    window.myCalendar.refetchEvents();
                } else {
                    location.reload();
                }
            } else {
                alert('서버 에러: ' + (data.error || '알 수 없는 오류'));
            }
        })
        .catch(err => {
            console.error('Fetch Error:', err);
            alert('서버 통신 중 오류가 발생했습니다.');
        })
        .finally(() => {
            if (btn) {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });

    } catch (e) {
        console.error('Logic Error:', e);
        alert('오류가 발생했습니다. 콘솔(F12)을 확인하세요.');
    }
}