import { addSchedule, updateSchedule, deleteSchedule, duplicateSchedule } from './db_service.js';

// 1. HTML의 onclick="saveEvent()"와 연결 (module 스크립트에서도 동작하도록 window에 바인딩)
window.saveEvent = function() {
    processData('save', '#save-btn', '저장 중...');
};

// 2. HTML의 onclick="deleteEvent()"와 연결
window.deleteEvent = function() {
    processData('delete', '#delete-btn', '삭제 중...');
};

// 3. HTML의 onclick="duplicateEvent()"와 연결
window.duplicateEvent = function() {
    processData('insert', '#duplicate-btn', '복제 중...');
};

async function processData(action, btnSelector = '#save-btn', pendingText = '처리 중...') {
    if (action === 'delete' && !confirm("정말 이 일정을 삭제하시겠습니까?")) return;
    if (action === 'insert' && !confirm("현재 입력값으로 새 일정을 복제 생성할까요?")) return;

    const btn = document.querySelector(btnSelector);
    const originalText = btn ? btn.innerText : '처리하기';

    try {
        const getValue = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : "";
        };

        // Firestore의 문서 ID 역할을 할 docId 추출
        const docId = getValue('edit-row');

        // Firestore 스키마에 맞춘 데이터 매핑 (카멜케이스)
        const payloadData = {
            date: getValue('edit-date'),
            startTime: getValue('edit-start'),
            endTime: getValue('edit-end'),
            region: getValue('edit-region'),
            programName: getValue('edit-program'),
            schoolName: getValue('edit-institution'),
            mainInstructor: getValue('edit-main'),
            subInstructors: collectSubInstructors('edit-sub-list'),     // 배열
            equipments: collectEquipments('edit-equip-list'),           // 배열 [{type, count}]
            note: getValue('edit-note'),
            color: getValue('edit-color'),
            grade: getValue('edit-grade'),
            targetCount: Number(getValue('edit-students')) || 0
        };

        if (btn) {
            btn.innerText = pendingText;
            btn.disabled = true;
        }

        // Action에 따른 db_service 함수 호출
        if (action === 'save') {
            if (docId) {
                // 수정
                await updateSchedule(docId, payloadData);
            } else {
                // 신규 등록
                await addSchedule(payloadData);
            }
        } else if (action === 'delete') {
            if (docId) {
                await deleteSchedule(docId);
            } else {
                throw new Error("삭제할 문서 ID가 없습니다.");
            }
        } else if (action === 'insert') {
            // 복제 (insert)
            if (docId) {
                // 원본을 바탕으로 복제하면서 현재 입력값으로 덮어씀
                await duplicateSchedule(docId, payloadData);
            } else {
                // 원본 ID가 없다면 신규 등록 처리
                await addSchedule(payloadData);
            }
        }

        const successMsg = action === 'insert'
            ? '복제 일정이 추가되었습니다.'
            : '정상적으로 처리되었습니다.';
        // alert(successMsg);

        // 모달 닫기 함수가 전역에 있다고 가정하고 호출
        if (typeof window.closeModal === 'function') {
            window.closeModal();
        }

        // 성공 시 캐시 지우고 페이지 리로드
        sessionStorage.removeItem('cached_historyData');
        location.reload();

    } catch (e) {
        console.error('Logic Error:', e);
        alert('오류가 발생했습니다. 콘솔(F12)을 확인하세요.');
    } finally {
        if (btn) {
            btn.innerText = originalText;
            btn.disabled = false;
        }
    }
}