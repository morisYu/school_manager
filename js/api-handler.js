/* js/api-handler.js 수정본 */

function processData(action) {
    if (action === 'delete' && !confirm("정말 이 일정을 삭제하시겠습니까?")) return;

    // [방어코드] GAS_URL 존재 여부 확인
    if (typeof GAS_URL === 'undefined') {
        alert("설정 파일(config.js)을 로드하지 못했습니다. 관리자에게 문의하세요.");
        return;
    }

    const btn = document.querySelector('.btn-save');
    const originalText = btn.innerText;

    try {
        // [방어코드] HTML 요소 존재 확인 후 데이터 수집
        const getValue = (id) => {
            const el = document.getElementById(id);
            if (!el) console.warn(`경고: ID '${id}' 요소를 찾을 수 없습니다.`);
            return el ? el.value : "";
        };

        const payload = {
            action: action,
            row: getValue('edit-row'),
            date: getValue('edit-date'),
            startTime: getValue('edit-start'),
            endTime: getValue('edit-end'),
            program: getValue('edit-program'),
            institution: getValue('edit-institution'),
            grade: getValue('edit-grade'),
            students: getValue('edit-students'),
            mainTeacher: getValue('edit-main'),
            subTeacher: getValue('edit-sub'),
            toolType: getValue('edit-tool'),
            toolCount: getValue('edit-count'),
            note: getValue('edit-note'),
            color: getValue('edit-color')
        };

        // 버튼 상태 변경
        btn.innerText = '처리 중...';
        btn.disabled = true;

        fetch(GAS_URL, {
            method: 'POST',
            body: JSON.stringify(payload)
        })
        .then(res => res.json())
        .then(data => {
            alert('정상적으로 처리되었습니다.');
            closeModal();
            
            // [방어코드] 캘린더 객체 확인 후 리프레시
            if (window.myCalendar && typeof window.myCalendar.refetchEvents === 'function') {
                window.myCalendar.refetchEvents();
            } else {
                location.reload(); // 객체가 없으면 페이지 새로고침으로 대응
            }
        })
        .catch(err => {
            console.error('Fetch Error:', err);
            alert('서버 통신 중 오류가 발생했습니다.');
        })
        .finally(() => {
            btn.innerText = originalText;
            btn.disabled = false;
        });

    } catch (e) {
        console.error('Logic Error:', e);
        alert('데이터 구성 중 오류가 발생했습니다. 개발자 도구(F12)를 확인하세요.');
        btn.innerText = originalText;
        btn.disabled = false;
    }
}