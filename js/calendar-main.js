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
    const modal = document.getElementById('edit-modal');
    const overlay = document.getElementById('modal-overlay');

    if (!modal || !overlay) {
        console.error("HTML에서 editModal 또는 modalOverlay를 찾을 수 없습니다.");
        return;
    }

    if (p) {
        // [상세 보기/수정 모드] 데이터 채우기
        const localDate = new Date(p['날짜']).toLocaleDateString('sv-SE');
        
        // kebab-case ID로 데이터 매칭
        document.getElementById('edit-row').value = p.row || '';
        document.getElementById('edit-region').value = p['지역구분'] || '대구';
        document.getElementById('edit-institution').value = p['기관명'] || '';
        document.getElementById('edit-program').value = p['프로그램명'] || '';
        document.getElementById('edit-date').value = localDate;
        document.getElementById('edit-start').value = extractTime(p['시작시간']);
        document.getElementById('edit-end').value = extractTime(p['종료시간']);
        document.getElementById('edit-main').value = p['주강사'] || '';
        document.getElementById('edit-sub').value = p['보조강사'] || '';
        document.getElementById('edit-tool').value = p['교구종류'] || '';
        document.getElementById('edit-count').value = p['교구수량'] || 0;
        document.getElementById('edit-note').value = p['비고'] || '';
        
        const colorSelect = document.getElementById('edit-color');
        colorSelect.value = p['색상'] || '#2c3e50';
        colorSelect.style.color = colorSelect.value;
        
        modal.querySelector('.modal-header h2').innerText = '⚙️ 일정 상세 및 수정';
    } else {
        // 새 일정 추가 모드 초기화 로직 (동일)
        const allInputs = modal.querySelectorAll('input, textarea, select');
        allInputs.forEach(input => { if(input.id !== 'edit-color') input.value = ''; });
        document.getElementById('edit-date').value = new Date().toLocaleDateString('sv-SE');
        modal.querySelector('.modal-header h2').innerText = '📅 새 일정 추가';
    }

    overlay.style.display = 'block';
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('edit-modal').style.display = 'none';
}
