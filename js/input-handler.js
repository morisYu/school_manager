/* js/input-handler.js */


// 폼 제출 핸들러
document.getElementById('lectureForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerText;
    
    btn.innerText = '저장 중...'; 
    btn.disabled = true;

    // [핵심 수정] 서버가 이해할 수 있는 'payload' 구조로 재구성
    const payload = {
        action: 'insert',        // 'save' 또는 'insert'
        sheetName: '출강이력',    // 확장성을 위해 시트명 명시
        data: {
            "날짜": document.getElementById('date').value,
            "시작시간": document.getElementById('startTime').value,
            "종료시간": document.getElementById('endTime').value,
            "프로그램명": document.getElementById('program').value,
            "기관명": document.getElementById('institution').value,
            "학년": document.getElementById('grade').value,
            "인원": document.getElementById('students').value,
            "주강사": document.getElementById('mainTeacher').value,
            "보조강사": document.getElementById('subTeacher').value,
            "교구종류": document.getElementById('toolType').value,
            "교구수량": document.getElementById('toolCount').value,
            "색상": document.getElementById('color').value,
            "비고": document.getElementById('note').value,
            "지역구분": document.getElementById('input-region').value // 새로 추가한 지역 구분
        }
    };

    // GAS_URL은 config.js에 정의되어 있음
    fetch(GAS_URL, { 
        method: 'POST', 
        // [수정] formData 대신 payload를 전송
        body: JSON.stringify(payload) 
    })
    .then(response => response.json()) // 응답을 JSON으로 받기
    .then(result => { 
        if(result.result === "success") {
            alert('성공적으로 저장되었습니다!'); 
            location.href = '../index.html'; 
        } else {
            throw new Error(result.error);
        }
    })
    .catch((error) => { 
        console.error('Error:', error);
        alert('저장에 실패했습니다: ' + error.message); 
        btn.disabled = false; 
        btn.innerText = originalText; 
    });
});