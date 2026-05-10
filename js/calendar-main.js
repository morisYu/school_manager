import { getSchedulesByDate } from './db_service.js';
import { auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// onAuthStateChanged는 auth_handler.js에서 통합 관리하고, 
// 여기서는 초기화 함수만 전역으로 노출하여 화면이 준비되었을 때 호출하도록 변경합니다.
// 대한민국 법정공휴일 하드코딩 데이터 (2024~2026년 기준)
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

const STATIC_HOLIDAY_EVENTS = Object.entries(KOREAN_HOLIDAYS).map(([dateStr, name]) => ({
    title: name,
    start: dateStr,
    allDay: true,
    display: 'block',
    classNames: ['holiday-event'],
    extendedProps: { isHoliday: true }
}));

window.isUnassignedFilterActive = false;
window.allHolidayDates = Object.keys(KOREAN_HOLIDAYS);

// onAuthStateChanged 리스너가 상단(5라인)에 이미 존재하므로 중복 방지를 위해 여기서는 제거합니다.

window.initCalendar = function() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    // 이미 초기화된 경우 중복 생성 방지
    if (window.myCalendar) return;

    const savedDate = sessionStorage.getItem('calendarCurrentDate');

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialDate: savedDate ? new Date(savedDate) : new Date(),
        initialView: 'dayGridMonth',
        locale: 'ko',
        height: '100%',
        showNonCurrentDates: false,
        fixedWeekCount: false,
        expandRows: true,
        headerToolbar: {
            left: 'prev,next today unassignedFilter',
            center: 'title',
            right: 'dayGridMonth,listWeek'
        },
        listDayFormat: function (arg) {
            const d = arg.date.marker;
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'long' }).format(d);
            return `${year}년 ${month}월 ${day}일 (${weekday})`;
        },
        listDaySideFormat: false,
        customButtons: {
            unassignedFilter: {
                text: '강사 미정',
                click: function () {
                    const calendarEl = document.getElementById('calendar');
                    const btn = document.querySelector('.fc-unassignedFilter-button');
                    calendarEl.classList.toggle('fc-show-unassigned');
                    if (calendarEl.classList.contains('fc-show-unassigned')) {
                        btn.classList.add('fc-button-active');
                    } else {
                        btn.classList.remove('fc-button-active');
                    }
                }
            }
        },
        buttonText: { today: '오늘', month: '월간', list: '목록' },

        eventSources: [
            STATIC_HOLIDAY_EVENTS,
            async function (info, successCallback, failureCallback) {
                try {
                    // 캘린더의 현재 뷰 시작일과 종료일 가져오기
                    const startDate = info.startStr.split('T')[0];
                    const endDate = info.endStr.split('T')[0];

                    // Firestore에서 해당 기간 데이터 조회
                    const rawEvents = await getSchedulesByDate(startDate, endDate);

                    // 캘린더 규격에 맞게 매핑
                    const eventsData = rawEvents.map(r => ({
                        title: r.schoolName + (r.programName ? ` (${r.programName})` : ''),
                        start: r.date + 'T' + r.startTime,
                        end: r.date + 'T' + r.endTime,
                        backgroundColor: r.color || '#2c3e50',
                        extendedProps: {
                            // 모달 상세 보기 및 수정을 위한 원본 데이터 매핑
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
                            '대상인원': r.targetCount,
                            row: r.id // Firestore 문서 ID 전달
                        }
                    }));

                    successCallback(eventsData);
                } catch (error) {
                    console.error('Firestore 데이터 로드 실패:', error);
                    failureCallback(error);
                }
            }
        ],
        eventContent: function (arg) {
            if (arg.event.extendedProps.isHoliday) {
                return {
                    html: `<div class="holiday-text">${arg.event.title}</div>`
                };
            }

            const p = arg.event.extendedProps;
            const color = arg.event.backgroundColor;
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
            const subTeachers = p['보조강사들'] || [];
            const institution = p['기관명'] || '기관 미정';

            const startTime = typeof extractTime === 'function' ? extractTime(p['시작시간']) : (p['시작시간'] || '');
            const durationValue = typeof calculateHours === 'function' ? calculateHours(p['시작시간'], p['종료시간']) : '';

            // 보조강사 축약 표시: 첫 번째 + N명
            let subText = '';
            if (subTeachers.length === 1) subText = subTeachers[0];
            else if (subTeachers.length > 1) subText = `${subTeachers[0]} +${subTeachers.length - 1}명`;
            const teacherText = subText ? `${mainTeacher}(${subText})` : mainTeacher;

            // 교구 축약 표시
            const equips = p['교구목록'] || [];
            let toolText = '교구 없음';
            if (equips.length === 1) toolText = `${equips[0].type}(${equips[0].count})`;
            else if (equips.length > 1) toolText = `${equips[0].type}(${equips[0].count}) +${equips.length - 1}종`;

            const isUnassigned = mainTeacher.includes('미정') || subTeachers.some(s => s.includes('미정'));
            const highlightClass = isUnassigned ? 'unassigned-highlight' : '';

            if (arg.view.type === 'listWeek') {
                const grade = p['학년'] || '';
                const count = p['대상인원'] || '';

                let targetText = '';
                if (grade && count) targetText = `${grade}(${count})`;
                else if (grade) targetText = grade;
                else if (count) targetText = count;

                const note = p['비고'] || '';

                return {
                    html: `
                    <div class="event-list-item ${highlightClass}" style="--event-color: ${color}; --event-bg: ${transparentBg};">
                        <div class="list-col col-inst" title="${institution}">${institution}</div>
                        <div class="list-col col-prog" title="${program}">${program}</div>
                        <div class="list-col col-target" title="${targetText}">${targetText}</div>
                        <div class="list-col col-teacher" title="${teacherText}">${teacherText}</div>
                        <div class="list-col col-tool" title="${toolText}">${toolText}</div>
                        <div class="list-col col-note" title="${note}">${note}</div>
                    </div>`
                };
            }

            return {
                html: `
                <div class="event-wrapper ${highlightClass}" style="--event-color: ${color}; --event-bg: ${transparentBg}; color: #111;">
                    <div class="event-line1">
                        <span class="event-time"><strong>${startTime}(${durationValue})</strong> |</span>
                        <span class="event-institution">${institution}</span>
                    </div>
                    <div class="event-line2">
                        ${program}, ${teacherText}, ${toolText}
                    </div>
                </div>`
            };
        },
        dayCellDidMount: function (arg) {
            const dateStr = arg.date.toLocaleDateString('sv-SE');
            if (window.allHolidayDates && window.allHolidayDates.includes(dateStr)) {
                arg.el.classList.add('fc-holiday-date');
            }
        },
        eventClick: function (info) {
            if (info.event.extendedProps.isHoliday) return;
            window.openModal(info.event.extendedProps);
        },
        datesSet: function (info) {
            sessionStorage.setItem('calendarCurrentDate', info.view.currentStart.toISOString());
        }
    });
    calendar.render();
    window.myCalendar = calendar;
}

// 모달 열기 및 닫기 함수 바인딩 (module 스크립트에서도 동작하도록 window 객체에 할당)
window.openModal = function (p) {
    const modal = document.getElementById('edit-modal');
    const overlay = document.getElementById('modal-overlay');

    if (!modal || !overlay) {
        console.error("HTML에서 edit-modal 또는 modal-overlay를 찾을 수 없습니다.");
        return;
    }

    if (p) {
        const localDate = new Date(p['날짜']).toLocaleDateString('sv-SE');

        document.getElementById('edit-row').value = p.row || '';
        document.getElementById('edit-region').value = p['지역구분'] || '대구';
        document.getElementById('edit-institution').value = p['기관명'] || '';
        document.getElementById('edit-program').value = p['프로그램명'] || '';
        document.getElementById('edit-date').value = localDate;
        document.getElementById('edit-start').value = typeof extractTime === 'function' ? extractTime(p['시작시간']) : (p['시작시간'] || '');
        document.getElementById('edit-end').value = typeof extractTime === 'function' ? extractTime(p['종료시간']) : (p['종료시간'] || '');
        document.getElementById('edit-main').value = p['주강사'] || '';

        // 동적 보조강사 복원
        const subList = document.getElementById('edit-sub-list');
        subList.innerHTML = '';
        const subs = p['보조강사들'] || [];
        if (subs.length > 0) {
            subs.forEach(name => addSubInstructorRow('edit-sub-list', name));
        }

        // 동적 교구 복원
        const equipList = document.getElementById('edit-equip-list');
        equipList.innerHTML = '';
        const equips = p['교구목록'] || [];
        if (equips.length > 0) {
            equips.forEach(eq => addEquipmentRow('edit-equip-list', eq.type, eq.count));
        }
        document.getElementById('edit-note').value = p['비고'] || '';
        document.getElementById('edit-grade').value = p['학년'] || '';
        document.getElementById('edit-students').value = p['대상인원'] || '';

        const colorSelect = document.getElementById('edit-color');
        colorSelect.value = p['색상'] || '#2c3e50';
        colorSelect.style.color = colorSelect.value;

        modal.querySelector('.modal-header h2').innerText = '⚙️ 일정 상세 및 수정';
    } else {
        const allInputs = modal.querySelectorAll('input, textarea, select');
        allInputs.forEach(input => { if (input.id !== 'edit-color') input.value = ''; });
        document.getElementById('edit-date').value = new Date().toLocaleDateString('sv-SE');
        // 동적 리스트 초기화
        document.getElementById('edit-sub-list').innerHTML = '';
        document.getElementById('edit-equip-list').innerHTML = '';
        modal.querySelector('.modal-header h2').innerText = '📅 새 일정 추가';
    }

    overlay.style.display = 'block';
    modal.style.display = 'block';
};

window.closeModal = function () {
    document.getElementById('modal-overlay').style.display = 'none';
    document.getElementById('edit-modal').style.display = 'none';
};
