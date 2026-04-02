// 대한민국 법정공휴일 하드코딩 데이터 (2024~2026년 기준)
// 향후 임시공휴일이 추가될 경우, 이 객체에 'YYYY-MM-DD': '휴일명' 형식으로 추가하시면 됩니다.
const KOREAN_HOLIDAYS = {
    "2024-01-01": "신정",
    "2024-02-09": "설날", "2024-02-10": "설날", "2024-02-11": "설날", "2024-02-12": "대체공휴일",
    "2024-03-01": "3·1절",
    "2024-04-10": "국회의원선거",
    "2024-05-05": "어린이날", "2024-05-06": "대체공휴일", "2024-05-15": "부처님오신날",
    "2024-06-06": "현충일",
    "2024-08-15": "광복절",
    "2024-09-16": "추석", "2024-09-17": "추석", "2024-09-18": "추석",
    "2024-10-01": "임시공휴일(국군의날)", "2024-10-03": "개천절", "2024-10-09": "한글날",
    "2024-12-25": "크리스마스",
    "2025-01-01": "신정",
    "2025-01-28": "설날", "2025-01-29": "설날", "2025-01-30": "설날",
    "2025-03-01": "3·1절", "2025-03-03": "대체공휴일",
    "2025-05-05": "어린이날/부처님오신날", "2025-05-06": "대체공휴일",
    "2025-06-06": "현충일",
    "2025-08-15": "광복절",
    "2025-10-03": "개천절", "2025-10-05": "추석", "2025-10-06": "추석", "2025-10-07": "추석", "2025-10-08": "대체공휴일", "2025-10-09": "한글날",
    "2025-12-25": "크리스마스",
    "2026-01-01": "신정",
    "2026-02-16": "설날", "2026-02-17": "설날", "2026-02-18": "설날",
    "2026-03-01": "3·1절", "2026-03-02": "대체공휴일",
    "2026-05-05": "어린이날", "2026-05-24": "부처님오신날", "2026-05-25": "대체공휴일",
    "2026-06-03": "지방선거", "2026-06-06": "현충일",
    "2026-08-15": "광복절",
    "2026-09-24": "추석", "2026-09-25": "추석", "2026-09-26": "추석", "2026-09-28": "대체공휴일",
    "2026-10-03": "개천절", "2026-10-05": "대체공휴일", "2026-10-09": "한글날",
    "2026-12-25": "크리스마스"
};

// 1. 공휴일 데이터를 즉시 표시 가능한 형태로 사전 가공 (로딩 시간 0초 달성)
const STATIC_HOLIDAY_EVENTS = Object.entries(KOREAN_HOLIDAYS).map(([dateStr, name]) => ({
    title: name,
    start: dateStr,
    allDay: true,
    display: 'block',
    classNames: ['holiday-event'],
    extendedProps: { isHoliday: true }
}));

// 공휴일 날짜 배열만 따로 저장 (빠른 날짜 색상 변경을 위함)
window.allHolidayDates = Object.keys(KOREAN_HOLIDAYS);

document.addEventListener('DOMContentLoaded', function () {
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
        
        // [성능 최적화] eventSources 배열을 사용하여 공휴일과 일정을 분리하여 로딩!
        eventSources: [
            // 첫 번째 소스: 공휴일 (통신이 없으므로 월을 넘기자마자 0초 만에 표시됨)
            STATIC_HOLIDAY_EVENTS,
            
            // 두 번째 소스: 메모리에 로드된 전체 일정을 즉시 반환 (하이브리드 캐싱 적용됨)
            function (info, successCallback, failureCallback) {
                // fetch없이 전역 배열을 0초만에 그대로 전달하므로, 달을 넘길 때 전혀 통신 대기가 없습니다.
                successCallback(window.currentScheduleEvents || []);
            }
        ],
        eventContent: function (arg) {
            // 공휴일 스타일 처리
            if (arg.event.extendedProps.isHoliday) {
                return {
                    html: `<div class="holiday-text">${arg.event.title}</div>`
                };
            }

            // 기존 일정 스타일 처리 (기존 로직 유지)
            const p = arg.event.extendedProps;
            const color = arg.event.textColor;
            const transparentBg = (() => {
                if (!color) return 'rgba(0,0,0,0.03)';
                if (color.startsWith('#')) {
                    let hex = color.slice(1);
                    if (hex.length === 3) { hex = hex.split('').map(ch => ch + ch).join(''); }
                    if (/^[0-9a-fA-F]{6}$/.test(hex)) {
                        const r = parseInt(hex.slice(0, 2), 16);
                        const g = parseInt(hex.slice(2, 4), 16);
                        const b = parseInt(hex.slice(4, 6), 16);
                        return `rgba(${r}, ${g}, ${b}, 0.08)`;
                    }
                }
                return color;
            })();

            const program = p['프로그램명'] || '프로그램 미정';
            const mainTeacher = p['주강사'] || '강사 미정';
            const subTeacher = p['보조강사'] || '';
            const institution = p['기관명'] || '기관 미정';
            const startTime = extractTime(p['시작시간']);
            const durationValue = calculateHours(p['시작시간'], p['종료시간']);

            const teacherText = subTeacher ? `${mainTeacher}(${subTeacher})` : `${mainTeacher}`;
            const toolName = p['교구종류'] || '교구 없음';
            const toolQty = (p['교구수량'] && p['교구수량'] !== 0) ? `(${p['교구수량']})` : '';

            return {
                html: `
                <div class="event-wrapper" style="--event-color: ${color}; --event-bg: ${transparentBg}; color: #111;">
                    <div class="event-line1">
                        <strong>${startTime}(${durationValue})</strong> | ${institution}
                    </div>
                    <div class="event-line2">
                        ${program}, ${teacherText}, ${toolName}${toolQty}
                    </div>
                </div>`
            };
        },
        // [중요] 날짜 숫자를 빨간색으로 변경 (공휴일 대응)
        dayCellDidMount: function (arg) {
            const dateStr = arg.date.toLocaleDateString('sv-SE');
            if (window.allHolidayDates && window.allHolidayDates.includes(dateStr)) {
                arg.el.classList.add('fc-holiday-date');
            }
        },
        eventClick: function (info) {
            if (info.event.extendedProps.isHoliday) return; // 공휴일은 클릭 불가
            openModal(info.event.extendedProps);
        }
    });
    calendar.render();
    window.myCalendar = calendar;

    // [하이브리드 캐싱 + 저장소 공유] 
    // 동일한 API, 동일한 캐시키('cached_historyData')로 출강이력 데이터를 로드합니다.
    window.currentScheduleEvents = [];
    fetchAndCache(`${GAS_URL}?sheet=출강이력`, 'cached_historyData', (rawEvents, isCache) => {
        const eventsData = Array.isArray(rawEvents) ? rawEvents : (rawEvents.value || []);
        
        window.currentScheduleEvents = eventsData.map(r => {
            const localDate = new Date(r['날짜']).toLocaleDateString('sv-SE');
            return {
                title: r['프로그램명'] || '일정',
                start: `${localDate}T${extractTime(r['시작시간'])}`,
                end: `${localDate}T${extractTime(r['종료시간'])}`,
                textColor: r['색상'] || '#2c3e50',
                extendedProps: r
            };
        });
        
        // 데이터가 준비되면 캘린더에 즉각 알림 (최초 캐시 즉시출력 + 새로운 갱신 발견 시 자동렌더)
        if (window.myCalendar) {
            window.myCalendar.refetchEvents();
        }
    }).catch(e => {
        console.error("Calendar data fetch error:", e);
    });
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
        allInputs.forEach(input => { if (input.id !== 'edit-color') input.value = ''; });
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
