import { addSchedule } from './db_service.js';

// 폼 제출 핸들러
document.getElementById('lectureForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const originalText = btn.innerText;
    
    btn.innerText = '저장 중...'; 
    btn.disabled = true;

    try {
        // Firestore 스키마에 맞춘 데이터 매핑 (카멜케이스)
        const payloadData = {
            date: document.getElementById('date').value,
            startTime: document.getElementById('startTime').value,
            endTime: document.getElementById('endTime').value,
            programName: document.getElementById('program').value,
            schoolName: document.getElementById('institution').value,
            grade: document.getElementById('grade').value,
            targetCount: Number(document.getElementById('students').value) || 0,
            mainInstructor: document.getElementById('mainTeacher').value,
            subInstructors: collectSubInstructors('input-sub-list'),     // 배열
            equipments: collectEquipments('input-equip-list'),           // 배열 [{type, count}]
            color: document.getElementById('color').value,
            note: document.getElementById('note').value,
            region: document.getElementById('input-region').value
        };

        // Firestore에 일정 추가
        await addSchedule(payloadData);

        // 메인 캘린더 화면으로 돌아갈 때 최신 데이터를 불러오도록 캐시 삭제
        sessionStorage.removeItem('cached_historyData');

        // alert('성공적으로 저장되었습니다!'); 
        location.href = '../index.html'; 
    } catch (error) {
        console.error('Error:', error);
        alert('저장에 실패했습니다: ' + error.message); 
        btn.disabled = false; 
        btn.innerText = originalText; 
    }
});