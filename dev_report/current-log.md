# 📝 현재 개발 일지 (2026년 5월)

---

## 📅 2026-05-10 개발 내용

### ✅ 주요 업데이트: 모바일 반응형 전면 구현 (Samsung Galaxy S20 Ultra 기준)

#### 📱 1단계 — CSS 반응형 기반 구축 (`@media max-width: 768px`)

기존 PC 환경의 모든 CSS·JS 로직을 **100% 유지**하면서, 7개 CSS 파일 최하단에 모바일 전용 미디어 쿼리를 추가했습니다.

| 파일 | 주요 변경 내용 |
|------|---------------|
| `css/common.css` | 헤더 세로 스태킹, 네비 버튼 wrap + `min-height: 44px`, `overflow: hidden` 해제 |
| `css/login.css` | 로그인 카드 여백 축소, 입력창·버튼 터치 영역 `min-height: 48~52px` 확보 |
| `css/calendar.css` | 툴바 버튼 크기 조정, 이벤트 텍스트 축소 |
| `css/forms.css` | 모달 전체 너비(100%), 20열 → 2열 그리드, 버튼 그룹 세로 스태킹 |
| `css/input-form.css` | 폼 카드 전체 너비, 20열 → 1열 그리드, 모든 입력창 `min-height: 44px` |
| `css/manage-style.css` | 필터 행 1열, 테이블 영역 `overflow-x: auto + white-space: nowrap` (가로 스크롤) |
| `css/school-manage.css` | 좌우 패널 세로 스태킹, 정보 카드 세로 전환, 테이블 래퍼 가로 스크롤 |

---

#### 🍔 2단계 — 햄버거 메뉴 구현

스마트폰에서 상단 네비게이션 버튼들을 햄버거(☰) 버튼 안에 슬라이드-다운 드로어로 수납했습니다.

- **`js/utils.js`**: `initMobileNav()` IIFE 추가 — 햄버거 버튼 클릭 토글, 오버레이 클릭 닫기, 메뉴 항목 클릭 시 자동 닫기, ☰ → ✕ 애니메이션
- **`css/common.css`**: 햄버거 버튼 스타일(3-bar → X 전환 애니메이션), 슬라이드-다운 드로어(`max-height: 0 → 320px`), 반투명 오버레이
- **4개 HTML 파일** (`index.html`, `input.html`, `manage.html`, `school-manage.html`): `#hamburger-btn`, `#mobile-nav`, `#nav-overlay` 요소 추가

```
[PC]  로고 ─────────────────── [일정추가] [학교관리] [강사관리] [로그아웃]
[모바일]  로고 ────────────────────────────────────────────────── [☰]
           ↓ 클릭 시 슬라이드 다운
           📅 일정 추가
           🏫 학교 관리
           📊 강사 관리
           ──────────
           로그아웃
```

---

#### 📅 3단계 — 캘린더 툴바 모바일 최적화

Samsung Galaxy S20 Ultra(412px) 기준으로 캘린더 툴바를 2행 레이아웃으로 재배치했습니다.

- CSS `order` 속성 활용: **center chunk(년/월 제목)** → `order: -1`, `width: 100%` → 1행 전체 너비
- **start chunk(이전/다음/오늘/미정필터)** → 2행 왼쪽, **end chunk(뷰 전환)** → 2행 오른쪽

```
변경 전: [◀] [▶] [오늘] [미정]   2026년 5월   [월간] [목록]
변경 후:
  1행:         2026년 5월             (중앙 정렬, 전체 너비)
  2행: [◀] [▶] [오늘] [미정]          [월간] [목록]
```

---

#### 👁️ 4단계 — 캘린더 이벤트 모바일 표시 최적화

구글 캘린더처럼 모바일에서 이벤트 셀에 기관명(학교명)만 표시되도록 개선했습니다.

- **`js/calendar-main.js`**: `event-line1` 내부를 `<span class="event-time">` (시간/duration)과 `<span class="event-institution">` (기관명)으로 분리
- **`css/calendar.css`**: 모바일 구간에서 `.event-time`, `.event-line2` 숨김 / `.event-institution` 굵게 표시

```
[PC]   09:00(2.0) | 감삼초등학교   /   코딩교육, 홍길동, 큐보(3)
[모바일]  감삼초등학교  (굵게, 말줄임표)
```
> 이벤트 클릭 시 모달에서는 기존과 동일하게 전체 정보 표시

---

### 🐛 해결된 이슈
- CSS 중복 삽입 문제: 편집 중 `calendar.css`에 미디어 쿼리 외부에 고아(orphan) CSS 블록이 삽입된 것을 감지하여 즉시 제거

### ⚠️ 남은 작업 / 향후 개선 사항
- [ ] 다른 서브 페이지(manage, school-manage, input)의 모바일 실제 기기 테스트 필요
- [ ] 목록 보기(listWeek) 모바일에서 열 너비 최적화 추가 검토

---

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
