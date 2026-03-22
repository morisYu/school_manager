/* js/input-handler.js */

// 시간 입력 시 자동 콜론 생성
function autoColon(target) {
    let val = target.value.replace(/\D/g, "");
    if (val.length > 2) { 
        target.value = val.substring(0, 2) + ":" + val.substring(2, 4); 
    } else { 
        target.value = val; 
    }
}

// 폼 제출 핸들러
document.getElementById('lectureForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerText;
    
    btn.innerText = '저장 중...'; 
    btn.disabled = true;

    const formData = {
        action: 'insert',
        date: document.getElementById('date').value,
        startTime: document.getElementById('startTime').value,
        endTime: document.getElementById('endTime').value,
        program: document.getElementById('program').value,
        institution: document.getElementById('institution').value,
        grade: document.getElementById('grade').value,
        students: document.getElementById('students').value,
        mainTeacher: document.getElementById('mainTeacher').value,
        subTeacher: document.getElementById('subTeacher').value,
        toolType: document.getElementById('toolType').value,
        toolCount: document.getElementById('toolCount').value,
        color: document.getElementById('color').value,
        note: document.getElementById('note').value
    };

    // GAS_URL은 config.js에 정의되어 있다고 가정합니다.
    fetch(GAS_URL, { 
        method: 'POST', 
        body: JSON.stringify(formData) 
    })
    .then(() => { 
        alert('성공적으로 저장되었습니다!'); 
        location.href = '../index.html'; 
    })
    .catch((error) => { 
        console.error('Error:', error);
        alert('저장에 실패했습니다. 다시 시도해 주세요.'); 
        btn.disabled = false; 
        btn.innerText = originalText; 
    });
});