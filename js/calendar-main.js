document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ko',
        height: '100%',
        showNonCurrentDates: false, 
        fixedWeekCount: false,
        expandRows: true,
        headerToolbar: { 
            left: 'prev,next today', 
            center: 'title', 
            right: 'dayGridMonth,timeGridWeek,listWeek' 
        },
        buttonText: { today: '오늘', month: '월간', week: '주간', list: '목록' },
        events: function(info, successCallback, failureCallback) {
            fetch(GAS_URL)
                .then(res => res.json())
                .then(data => {
                    const events = data.map(r => {
                        const localDate = new Date(r['날짜']).toLocaleDateString('sv-SE');
                        return {
                            title: r['프로그램명'],
                            start: `${localDate}T${extractTime(r['시작시간'])}`,
                            end: `${localDate}T${extractTime(r['종료시간'])}`,
                            textColor: r['색상'] || '#2c3e50',
                            extendedProps: r
                        };
                    });
                    successCallback(events);
                })
                .catch(failureCallback);
        },
        eventContent: function(arg) {
            const p = arg.event.extendedProps;
            const color = arg.event.textColor;

            // 데이터 가공 (비어있을 경우 대비)
            const program = p['프로그램명'] || '프로그램 미정';
            const teacher = p['주강사'] || '강사 미정';
            const toolName = p['교구종류'] || '교구 없음';
            // 수량이 있을 때만 (수량) 표시, 없으면 빈 문자열
            const toolQty = (p['교구수량'] && p['교구수량'] !== 0) ? `(${p['교구수량']})` : '';

            return {
                html: `
                <div class="event-wrapper" style="border-left-color: ${color}; color: ${color};">
                    <div class="event-line1">
                        <strong>${extractTime(p['시작시간'])}</strong> | ${p['기관명']}
                    </div>
                    <div class="event-line2" style="font-size: 0.85em; margin-top: 2px;">
                        ${program} | ${teacher} | ${toolName}${toolQty}
                    </div>
                </div>`
            };
        },
        // 일정을 클릭했을 때 실행 (기존 데이터 로드)
        eventClick: function(info) { openModal(info.event.extendedProps); }
    });
    calendar.render();
    window.myCalendar = calendar;
});

// 모달 열기 함수 (수정됨)
// 모달 열기 함수 (수정본)
function openModal(p) {
    // 1. 클래스가 아닌 ID(#editModal)로 명확하게 모달을 찾습니다.
    const modal = document.getElementById('editModal'); 
    const overlay = document.getElementById('modalOverlay');

    if (!modal || !overlay) {
        console.error("HTML에서 editModal 또는 modalOverlay를 찾을 수 없습니다.");
        return;
    }

    if (p) {
        // [상세 보기/수정 모드] 데이터 채우기
        const localDate = new Date(p['날짜']).toLocaleDateString('sv-SE');
        
        // 요소가 존재할 때만 값을 넣도록 안전하게 처리
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val;
        };

        setVal('edit-row', p.row);
        setVal('edit-institution', p['기관명'] || '');
        setVal('edit-program', p['프로그램명'] || '');
        setVal('edit-date', localDate);
        setVal('edit-start', extractTime(p['시작시간']));
        setVal('edit-end', extractTime(p['종료시간']));
        setVal('edit-grade', p['학년'] || '');
        setVal('edit-students', p['대상인원'] || '');
        setVal('edit-main', p['주강사'] || '');
        setVal('edit-sub', p['보조강사'] || '');
        setVal('edit-tool', p['교구종류'] || '');
        setVal('edit-count', p['교구수량'] || 0);
        setVal('edit-note', p['비고'] || '');
        
        const colorSelect = document.getElementById('edit-color');
        if (colorSelect) {
            colorSelect.value = p['색상'] || '#2c3e50';
            colorSelect.style.color = colorSelect.value;
        }
        
        // 헤더 텍스트 변경 (클래스 구조에 맞춰 선택자 수정)
        const headerTitle = modal.querySelector('.modal-header h2');
        if (headerTitle) headerTitle.innerText = '⚙️ 일정 상세 및 수정';

    } else {
        // [새 일정 추가 모드] 모든 필드 비우기
        const allInputs = modal.querySelectorAll('input, textarea, select');
        allInputs.forEach(input => {
            if (input.id !== 'edit-color') input.value = '';
        });
        
        const dateInput = document.getElementById('edit-date');
        if (dateInput) dateInput.value = new Date().toLocaleDateString('sv-SE');
        
        const colorInput = document.getElementById('edit-color');
        if (colorInput) colorInput.value = '#3498db';

        const headerTitle = modal.querySelector('.modal-header h2');
        if (headerTitle) headerTitle.innerText = '📅 새 일정 추가';
    }

    // 화면 표시
    overlay.style.display = 'block';
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.getElementById('editModal').style.display = 'none'; // 여기도 ID로 수정
}
