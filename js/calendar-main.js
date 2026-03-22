document.addEventListener('DOMContentLoaded', function() {
    const calendarEl = document.getElementById('calendar');
    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialView: 'dayGridMonth',
        locale: 'ko',
        height: '100%',
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
            return {
                html: `
                <div class="event-wrapper" style="border-left-color: ${color}; color: ${color};">
                    <div class="event-line1">${extractTime(p['시작시간'])} | ${p['기관명']}</div>
                    <div class="event-line2">${p['주강사']} | ${p['교구종류']}</div>
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
function openModal(p) {
    const modal = document.querySelector('.modal-content');
    const overlay = document.getElementById('modalOverlay');

    if (p) {
        // [상세 보기/수정 모드] 데이터 채우기
        const localDate = new Date(p['날짜']).toLocaleDateString('sv-SE');
        if(document.getElementById('edit-row')) document.getElementById('edit-row').value = p.row;
        document.getElementById('edit-institution').value = p['기관명'] || '';
        document.getElementById('edit-program').value = p['프로그램명'] || '';
        document.getElementById('edit-date').value = localDate;
        document.getElementById('edit-start').value = extractTime(p['시작시간']);
        document.getElementById('edit-end').value = extractTime(p['종료시간']);
        document.getElementById('edit-grade').value = p['학년'] || '';
        document.getElementById('edit-students').value = p['대상인원'] || '';
        document.getElementById('edit-main').value = p['주강사'] || '';
        document.getElementById('edit-sub').value = p['보조강사'] || '';
        document.getElementById('edit-tool').value = p['교구종류'] || '';
        document.getElementById('edit-count').value = p['교구수량'] || 0;
        document.getElementById('edit-note').value = p['비고'] || '';
        
        const colorSelect = document.getElementById('edit-color');
        colorSelect.value = p['색상'] || '#2c3e50';
        colorSelect.style.color = colorSelect.value;
        
        document.querySelector('.modal-content h2').innerText = '⚙️ 일정 상세 및 수정';
    } else {
        // [새 일정 추가 모드] 모든 필드 비우기
        const allInputs = modal.querySelectorAll('input, textarea, select');
        allInputs.forEach(input => input.value = '');
        
        // 날짜만 오늘 날짜로 세팅
        document.getElementById('edit-date').value = new Date().toLocaleDateString('sv-SE');
        document.getElementById('edit-color').value = '#3498db'; // 기본 파랑
        document.querySelector('.modal-content h2').innerText = '📅 새 일정 추가';
    }

    // 디자인이 적용된 요소를 화면에 표시
    overlay.style.display = 'block';
    modal.style.display = 'block';
}

function closeModal() {
    document.getElementById('modalOverlay').style.display = 'none';
    document.querySelector('.modal-content').style.display = 'none';
}
