# **\[일련번호: ERR-00]**

* **날짜:** 2026-03-22
* **발생 페이지:** pages/manage.html
* **상황:** '조회하기' 버튼 클릭 시 강사 목록이 나오지 않음.
* **원인 분석:** manage.html에서 manage-handler.js를 config.js보다 먼저 호출하여 변수를 인식하지 못함.
* **해결 방법:** HTML 하단의 \<script> 태그 순서를 config.js -> manage-handler.js 순으로 변경함.
* **상태:** ✅ 해결 완료
