# 📝 Style Guide: 출강 관리 시스템



이 문서는 시스템의 일관된 유지보수와 확장을 위해 정의된 네이밍 규칙 및 핵심 요소 가이드입니다,.



## 1\. 네이밍 규칙 (Naming Conventions)



코드를 작성하거나 수정할 때 아래의 규칙을 반드시 준수해야 합니다.



\*   \*\*HTML ID:\*\* \*\*kebab-case\*\*를 사용합니다. (예: `edit-modal`, `lecture-form`),.

&#x20;   \*   \*주의: 기존 코드의 `editModal`, `teacherSelect` 등은 리팩토링 시 `edit-modal`, `teacher-select`로 변경을 권장합니다.\*

\*   \*\*JS 변수 및 함수:\*\* \*\*camelCase\*\*를 사용합니다. (예: `editModal`, `processData`, `rawData`),.

\*   \*\*CSS 클래스:\*\* \*\*kebab-case\*\*를 사용합니다. (예: `nav-btn`, `form-grid`, `event-wrapper`),,.



## 2\. 핵심 요소 리스트 (Key Elements)



시스템 전반에서 사용되는 주요 ID와 API 엔드포인트를 정리한 표입니다.



| 구분 | ID (HTML) / 변수명 (JS) | 설명 | 관련 파일 |

| :--- | :--- | :--- | :--- |

| \*\*모달\*\* | `edit-modal` | 일정 상세 정보 및 수정/삭제 모달 | `index.html`, `calendar-main.js`, |

| \*\*모달\*\* | `modal-overlay` | 모달 활성화 시 배경 어둡게 처리 | `index.html`, `calendar-main.js` |

| \*\*폼\*\* | `lecture-form` | 일정 입력을 위한 메인 폼 | `input.html`, `input-handler.js` |

| \*\*버튼\*\* | `submit-btn` | 일정 등록 및 수정 제출 버튼 | `input.html`, `api-handler.js` |

| \*\*버튼\*\* | `btn-save` | 모달 내 수정 내용 저장 버튼 | `index.html`, `api-handler.js` |

| \*\*버튼\*\* | `btn-delete` | 일정 삭제 버튼 | `index.html`, `api-handler.js` |

| \*\*선택창\*\* | `teacher-select` | 정산 조회를 위한 강사 선택 드롭다운 | `manage.html`, `manage-handler.js` |

| \*\*영역\*\* | `report-area` | 정산 결과 테이블이 출력되는 영역 | `manage.html`, `manage-style.css` |

| \*\*API\*\* | `GAS\_URL` | 구글 앱스 스크립트(GAS) 통신 주소 | `js/config.js`, |



## 3\. 데이터 규격 및 처리 (Data Handling)



\*   \*\*날짜 형식:\*\* 모든 날짜는 `YYYY-MM-DD` 형식을 표준으로 하며, 1900년 이전 데이터(예: 1899년)는 비정상 데이터로 간주하여 차단합니다,.

\*   \*\*시간 형식:\*\* `HH:mm` (24시간제) 형식을 사용하며, 입력 시 `autoColon` 함수를 통해 자동으로 형식을 교정합니다,.

\*   \*\*파일 참조 순서:\*\* 전역 설정을 포함한 `config.js`가 핸들러 파일(`manage-handler.js` 등)보다 항상 먼저 호출되어야 합니다,.



\---



