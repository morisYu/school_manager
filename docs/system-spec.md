#### 🏫 출강 관리 시스템 통합 명세서



##### 📂 현재 프로젝트 폴더 구조

/ (Root)

├── index.html              # 메인 캘린더 화면

├── pages/                  # 서브 페이지 폴더

│   ├── input.html          # 일정 등록

│   └── manage.html         # 정산 관리

├── css/                    # 스타일 시트 폴더

│   ├── common.css          # 공통 헤더/레이아웃

│   └── manage.css          # 정산 페이지 전용

└── js/                     # 로직 폴더

&#x20;   ├── config.js           # GAS\_URL 설정 (필수 참조)

&#x20;   ├── manage-handler.js   # 정산 로직

&#x20;   └── input-handler.js    # 입력 로직



##### 1\. 전역 설정 (Global)

\- 공통 통신 주소: `js/config.js`의 `GAS\_URL` 사용

\- 디자인 테마: Navy (#2c3e50), Blue (#3498db), 배경색 (#f4f7f6)

\- 공통 폰트: Pretendard, 모든 input/select는 굵기 800 적용



##### 2\. 메인 페이지 (index.html)

\- \*\*목적:\*\* 전체 출강 일정을 한눈에 확인하는 캘린더 화면

\- \*\*주요 기능:\*\* - FullCalendar 라이브러리를 이용한 일정 시각화

&#x20; - 일정 클릭 시 상세 내용 모달 출력 및 수정/삭제 연동

\- \*\*연결 파일:\*\* `js/calendar-main.js`, `css/calendar.css`



##### 3\. 일정 추가 페이지 (pages/input.html)

\- \*\*목적:\*\* 새로운 출강 정보를 구글 시트에 저장

\- \*\*입력 항목:\*\* 날짜, 시간, 기관명, 프로그램명, 주/보조강사, 교구 등

\- \*\*특이 사항:\*\* 저장 완료 후 자동으로 `index.html`로 이동해야 함

\- \*\*연결 파일:\*\* `js/input-handler.js`, `css/input.css`



##### 4\. 정산 관리 페이지 (pages/manage.html)

\- \*\*목적:\*\* 강사별 일정 조회 및 정산 내역서 생성

\- \*\*주요 기능:\*\*

&#x20; - 강사명/기간 필터링 조회

&#x20; - 주강사/보조강사 시간(h) 자동 합산 계산

&#x20; - PDF 저장(인쇄용) 및 Excel 내보내기 (xlsx 라이브러리)

\- \*\*연결 파일:\*\* `js/manage-handler.js`, `css/manage.css`

