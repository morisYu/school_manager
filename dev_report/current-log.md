# 📝 현재 개발 일지 (2026년 5월)

## 📅 2026-05-02 개발 내용

### ✅ 주요 업데이트 및 개선 사항

*   🏫 학교 관리 시스템 CRUD 및 검색 기능 강화
    *   🔍 지능형 실시간 검색 도입: 학교 관리 페이지에 검색 입력창 추가. 학교명 및 별칭(Alias)을 이용한 실시간 필터링 및 자동 선택 기능 구현.
    *   👤 담당자 정보 관리 세분화: 학교 정보 수정 시 '담당자명', '담당자 연락처', '담당자 이메일'을 개별 필드로 분리하여 수정 및 저장 가능하도록 확장.
    *   🖼️ 학교 정보 카드 UI 개선: 담당자 정보를 한 줄이 아닌 개별 항목으로 표시하여 가독성 향상.

*   🎨 일정 관리 UI/UX 일관성 확보
    *   📏 폼 레이아웃 통일: '일정 추가' 페이지와 '수정 모달'의 항목 배치 순서를 100% 일치시킴. (1행: 색상/지역/기관/프로그램, 2행: 날짜/시간/학년/인원 등)
    *   👀 누락 필드 복구: '일정 추가' 시 보이지 않던 '학년' 및 '대상 인원' 필드를 노출형으로 전환하여 입력 편의성 증대.
    *   ✨ 디자인 고도화: 수정 모달 헤더에 입력 페이지와 동일한 프리미엄 그라데이션 적용 및 form-card 중앙 정렬 처리.

*   👥 보조강사 / 교구 동적 추가 기능 구현 (전체 시스템)
    *   ➕ 보조강사를 복수 입력할 수 있도록 [+ 보조강사 추가] 동적 UI 도입 (최대 인원 제한 없음, 실사용 5명 이내).
    *   🎒 교구를 종류+수량 세트 단위로 복수 추가할 수 있도록 [+ 교구 추가] 동적 UI 도입.
    *   ❌ 각 동적 항목에 [×] 삭제 버튼 포함, 점선 테두리의 추가 버튼과 빨간 원형 삭제 버튼 디자인 적용.

*   🔒 인증 및 보안 강화
    *   🛡️ Firebase Authentication 도입: 이메일 로그인/로그아웃 상태 관리 및 프리미엄 로그인 UI 연동.
    *   🚫 페이지 접근 권한 제어: 비로그인 사용자의 서브 페이지 접근 차단 로직 적용.

*   ⚙️ 시스템 표준화 및 최적화
    *   🗄️ Firestore 스키마 배열 구조 전환: 보조강사와 교구 데이터를 배열 형태로 관리하여 확장성 확보.
    *   기존 단일값 데이터를 배열로 자동 변환하는 방어 함수(normalizeSubInstructors, normalizeEquipments) 추가.
    *   전체 페이지 동적 UI 일괄 적용 (11개 파일 수정).
    *   api-handler.js, input-handler.js: 배열 데이터 수집 로직으로 교체.
    *   manage-handler.js: 강사 목록 추출 시 보조강사 배열 순회, 필터링 로직 배열 대응.
    *   school-manage-handler.js: 이력 표시 시 보조강사 join(', ') 처리.
    *   migrate.js: 마이그레이션 스키마를 배열 구조로 업데이트.
    *   forms.css, input-form.css의 셀렉터를 .dynamic-row input, .dynamic-list-group label로 확장하여 기존 폼과 동일한 스타일 적용.
    *   🔘 로그인/로그아웃 버튼 스타일링: 모든 페이지 헤더 버튼을 프리미엄 디자인 시스템으로 통일.

*   🚀 GAS → Firebase Firestore 마이그레이션 스크립트 작성 (migrate.js)
    *   firebase-admin SDK 기반의 Node.js 마이그레이션 스크립트 작성
    *   JSON 데이터의 한글 키값을 Firestore 영문 카멜케이스 스키마(date, startTime, schoolName 등)로 자동 매핑
    *   500개 단위 batch 처리로 대량 데이터 효율적 업로드 (schools 461건, schedules 128건 성공)
    *   숫자 데이터(대상인원, 교구수량)는 Number() 형변환하여 Firestore에 정확한 타입으로 저장

*   🔗 API 핸들러 Firebase 전환 (api-handler.js)
    *   기존 fetch(GAS_URL, ...) 로직을 완전히 제거하고 db_service.js의 CRUD 함수 직접 호출로 교체
    *   async/await 패턴 적용 및 type="module" 모듈화 완료

*   📅 캘린더 Firebase 연동 (calendar-main.js)
    *   FullCalendar의 eventSources에서 db_service.getSchedulesByDate를 호출하여 뷰 기간에 맞는 Firestore 데이터를 실시간 조회
    *   Firestore 필드명(date, startTime 등) → FullCalendar 규격(start, end, title 등)으로 변환

*   📝 일정 추가 페이지 Firebase 연동 (input-handler.js)
    *   addSchedule() 함수를 import하여 Firestore에 직접 일정을 등록하도록 전환
    *   기존 GAS 방식의 fetch + formData 완전 제거

*   🏫 강사 관리 / 학교 관리 페이지 Firebase 전환
    *   manage-handler.js: getAllSchedules() 사용으로 전환, 전체 일정에서 강사 목록 추출
    *   school-manage-handler.js: getSchools() + getAllSchedules() 사용으로 전환
    *   db_service.js에 getAllSchedules() 함수 신규 추가

*   🧹 GAS 레거시 코드 전면 정리
    *   config.js 파일 삭제 (GAS_URL만 담고 있던 파일, 더 이상 참조 없음)
    *   utils.js에서 fetchAndCache() 함수 제거 (GAS 전용 캐싱 로직)
    *   index.html, input.html, manage.html, school-manage.html에서 config.js 스크립트 로드 제거
    *   모든 핸들러 스크립트에 type="module" 적용 완료
    *   프로젝트 전체에서 GAS_URL 참조 0건, fetchAndCache 참조 0건 검증 완료

### 🐛 해결된 버그
*   📜 스크롤 문제 해결: 일정 추가 페이지에서 항목 다수 추가 시 비고란이 밀리는 현상 해결 (overflow-y: auto).
*   🔄 데이터 동기화 이슈: 학교 정보 수정 후 목록에 즉시 반영되지 않던 로컬 데이터 갱신 로직 수정.
*   📐 캘린더 레이아웃 붕괴: 인증 상태 변화 시 Flexbox 레이아웃이 깨지던 문제 해결.
*   항목 배치 불일치: 일정 추가 페이지에서 '색상' 필드가 2행에 위치하던 문제를 1행으로 수정하여 모달과 통일.
