import { getSchedulesByDate } from './db_service.js';
import { auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// onAuthStateChanged는 auth_handler.js에서 통합 관리하고, 
// 여기서는 초기화 함수만 전역으로 노출하여 화면이 준비되었을 때 호출하도록 변경합니다.
// 공휴일 관련 전역 상태
window.isUnassignedFilterActive = false;
window.allHolidayDates = [];
window.holidayEventsMap = {};

const HOLIDAY_API_KEY = '90429afb7b60bd5e94f15a8289c8966b421bbef0e5b213e96aa348bbbd5836a0';

// 공공데이터포털 특일 정보 API 호출 함수
async function fetchHolidays(year) {
    const cacheKey = `holidays_${year}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    try {
        // http -> https 문제(Mixed Content) 방지를 위해 https로 호출
        // 공공데이터포털은 https 지원
        const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?serviceKey=${HOLIDAY_API_KEY}&solYear=${year}&numOfRows=100&_type=json`;
        const response = await fetch(url);
        const data = await response.json();
        
        const items = data?.response?.body?.items?.item;
        let holidays = [];
        
        if (Array.isArray(items)) {
            holidays = items;
        } else if (items) {
            holidays = [items];
        }

        const formattedHolidays = {};
        holidays.forEach(h => {
            if (h.isHoliday === 'Y') {
                const dateStr = h.locdate.toString();
                const formattedDate = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
                
                // 같은 날짜에 공휴일이 겹치는 경우 (예: 어린이날 + 부처님오신날)
                if (formattedHolidays[formattedDate]) {
                     formattedHolidays[formattedDate] += `/${h.dateName}`;
                } else {
                     formattedHolidays[formattedDate] = h.dateName;
                }
            }
        });

        localStorage.setItem(cacheKey, JSON.stringify(formattedHolidays));
        return formattedHolidays;
    } catch (error) {
        console.error(`${year}년 공휴일 데이터를 가져오는데 실패했습니다:`, error);
        return {};
    }
}

// 동적 CSS 필터 스타일 업데이트 함수
function updateFilterStyle(filterName) {
    let styleEl = document.getElementById('fc-filter-dynamic-style');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = 'fc-filter-dynamic-style';
        document.head.appendChild(styleEl);
    }
    
    if (filterName === null) {
        styleEl.innerHTML = '';
        return;
    }
    
    const target = filterName.trim() === '' ? '미정' : filterName.trim();
    
    styleEl.innerHTML = `
        .fc-show-unassigned .event-wrapper[data-teachers*="${target}"],
        .fc-show-unassigned .event-list-item[data-teachers*="${target}"] {
            --event-bg: #fff0f0 !important;
            --event-color: #e74c3c !important;
            border: 1px solid #ffcfcf !important;
        }
    `;
}

// onAuthStateChanged 리스너가 상단(5라인)에 이미 존재하므로 중복 방지를 위해 여기서는 제거합니다.

window.initCalendar = async function() {
    const calendarEl = document.getElementById('calendar');
    if (!calendarEl) return;

    // 이미 초기화된 경우 중복 생성 방지
    if (window.myCalendar) return;

    const savedDate = sessionStorage.getItem('calendarCurrentDate');
    const initialDate = savedDate ? new Date(savedDate) : new Date();

    // 달력 초기화 전, 현재 표시될 연도를 기준으로 앞뒤 1년치 공휴일 미리 캐싱
    const initYear = initialDate.getFullYear();
    const [prevHols, currHols, nextHols] = await Promise.all([
        fetchHolidays(initYear - 1),
        fetchHolidays(initYear),
        fetchHolidays(initYear + 1)
    ]);
    
    Object.assign(window.holidayEventsMap, prevHols, currHols, nextHols);
    window.allHolidayDates = Object.keys(window.holidayEventsMap);

    const calendar = new FullCalendar.Calendar(calendarEl, {
        initialDate: initialDate,
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
                text: '강사 검색',
                click: function () {
                    const calendarEl = document.getElementById('calendar');
                    const btn = document.querySelector('.fc-unassignedFilter-button');
                    const input = document.getElementById('instructor-search-input');
                    const searchName = input ? input.value.trim() : '';
                    
                    if (calendarEl.classList.contains('fc-show-unassigned') && window.instructorFilterName === searchName) {
                        // 검색어가 같을 때 클릭하면 필터 해제
                        calendarEl.classList.remove('fc-show-unassigned');
                        btn.classList.remove('fc-button-active');
                        btn.innerText = '강사 검색';
                        if (input) input.value = '';
                        window.instructorFilterName = '';
                        updateFilterStyle(null);
                    } else {
                        // 필터 적용 (빈칸이면 '미정' 검색)
                        window.instructorFilterName = searchName;
                        calendarEl.classList.add('fc-show-unassigned');
                        btn.classList.add('fc-button-active');
                        btn.innerText = '필터 해제';
                        updateFilterStyle(searchName);
                    }
                }
            }
        },
        buttonText: { today: '오늘', month: '월간', list: '목록' },

        eventSources: [
            async function (info, successCallback, failureCallback) {
                try {
                    // 현재 달력 뷰에 포함된 연도를 추출
                    const startYear = info.start.getFullYear();
                    const endYear = info.end.getFullYear();
                    
                    let newlyLoaded = false;
                    for (let y = startYear; y <= endYear; y++) {
                        const cacheKey = `holidays_${y}`;
                        // 이미 로컬 스토리지에 캐싱되어 있는지 확인
                        const cached = localStorage.getItem(cacheKey);
                        if (!cached) {
                            const hMap = await fetchHolidays(y);
                            Object.assign(window.holidayEventsMap, hMap);
                            newlyLoaded = true;
                        } else if (Object.keys(window.holidayEventsMap).length === 0) {
                            // 캐시엔 있지만 메모리 맵이 비어있는 경우 (예외 상황)
                            Object.assign(window.holidayEventsMap, JSON.parse(cached));
                            newlyLoaded = true;
                        }
                    }
                    
                    // 글로벌 배열 갱신
                    window.allHolidayDates = Object.keys(window.holidayEventsMap);
                    
                    // 새롭게 불러온 공휴일이 있다면, 달력 셀 스타일 강제 렌더링을 위해 클래스 추가
                    // (dayCellDidMount가 비동기 호출보다 먼저 일어날 수 있으므로)
                    if (newlyLoaded) {
                        window.allHolidayDates.forEach(dateStr => {
                            const cell = calendarEl.querySelector(`.fc-day[data-date="${dateStr}"]`);
                            if (cell && !cell.classList.contains('fc-holiday-date')) {
                                cell.classList.add('fc-holiday-date');
                            }
                        });
                    }
                    
                    // FullCalendar 이벤트 포맷으로 변환
                    const eventsData = Object.entries(window.holidayEventsMap).map(([dateStr, name]) => ({
                        title: name,
                        start: dateStr,
                        allDay: true,
                        display: 'block',
                        classNames: ['holiday-event'],
                        extendedProps: { isHoliday: true }
                    }));
                    
                    successCallback(eventsData);
                } catch (error) {
                    console.error('공휴일 로딩 실패:', error);
                    failureCallback(error);
                }
            },
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

            const teachersData = [mainTeacher, ...subTeachers].join(',');

            if (arg.view.type === 'listWeek') {
                const grade = p['학년'] || '';
                const count = p['대상인원'] || '';
                const endTime = typeof extractTime === 'function' ? extractTime(p['종료시간']) : (p['종료시간'] || '');

                let targetText = '';
                if (grade && count) targetText = `${grade}(${count})`;
                else if (grade) targetText = grade;
                else if (count) targetText = count;

                const note = p['비고'] || '';
                const timeDisplay = `${startTime}~${endTime}`;

                return {
                    html: `
                    <div class="event-list-item" data-teachers="${teachersData}" style="--event-color: ${color}; --event-bg: ${transparentBg};">
                        <div class="list-col col-time" title="${timeDisplay}(${durationValue})">${timeDisplay}</div>
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
                <div class="event-wrapper" data-teachers="${teachersData}" style="--event-color: ${color}; --event-bg: ${transparentBg}; color: #111;">
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
            
            // 툴바 렌더링 시 검색 입력창 추가 보장
            const filterBtn = document.querySelector('.fc-unassignedFilter-button');
            if (filterBtn) {
                // FullCalendar가 월 이동 시 툴바를 재렌더링하면 버튼 텍스트가 초기값으로 돌아옴.
                // 검색창이 없을 때만 새로 생성하고, 이후 필터 상태를 항상 동기화.
                if (!document.getElementById('instructor-search-input')) {
                    const input = document.createElement('input');
                    input.type = 'text';
                    input.id = 'instructor-search-input';
                    input.placeholder = '강사명(빈칸:미정)';
                    input.className = 'instructor-search-input';
                    
                    // Enter 키 입력 시 검색 실행
                    input.addEventListener('keyup', function(e) {
                        if (e.key === 'Enter') {
                            filterBtn.click();
                        }
                    });
                    
                    // 버튼의 바로 앞에 입력창 추가
                    filterBtn.parentNode.insertBefore(input, filterBtn);
                }

                // 필터 활성화 상태라면 버튼 텍스트와 스타일을 복원
                // (FullCalendar 재렌더링으로 인해 리셋될 수 있으므로 항상 동기화)
                const calendarEl = document.getElementById('calendar');
                const isFilterActive = calendarEl && calendarEl.classList.contains('fc-show-unassigned');
                if (isFilterActive) {
                    filterBtn.innerText = '필터 해제';
                    filterBtn.classList.add('fc-button-active');
                    // 검색창에 현재 필터명 복원
                    const input = document.getElementById('instructor-search-input');
                    if (input && window.instructorFilterName !== undefined) {
                        input.value = window.instructorFilterName;
                    }
                } else {
                    filterBtn.innerText = '강사 검색';
                    filterBtn.classList.remove('fc-button-active');
                }
            }
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
