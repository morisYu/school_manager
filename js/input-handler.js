import { addSchedule, getSchools, checkInstructorAvailability, getInstructorProfile } from './db_service.js';
import { auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// 학교 목록 데이터 로드 및 자동완성 설정
onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
        const schools = await getSchools();
        const dataList = document.getElementById('school-list');
        
        if (dataList && Array.isArray(schools)) {
            schools.forEach(school => {
                if (school.searchAlias) {
                    // 1. 별칭 자체 제안
                    const option1 = document.createElement('option');
                    option1.value = school.searchAlias;
                    dataList.appendChild(option1);

                    // 2. 기관명 (별칭) 형식 제안 (예: 학교 (별칭))
                    const option2 = document.createElement('option');
                    option2.value = `${school.schoolName.replace('등학교', '')} (${school.searchAlias})`;
                    dataList.appendChild(option2);
                }
            });
        }
    } catch (error) {
        console.error("Error loading schools for suggestions:", error);
    }
});

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
            mainInstructor: document.getElementById('mainTeacher').value.trim() || '미정',
            subInstructors: collectSubInstructors('input-sub-list'),
            equipments: collectEquipments('input-equip-list'),           // 배열 [{type, count}]
            color: document.getElementById('color').value,
            note: document.getElementById('note').value,
            region: document.getElementById('input-region').value
        };

        // ─── 강사 가용 시간 충돌 확인 ───────────────────────────
        const instructorsToCheck = [payloadData.mainInstructor, ...payloadData.subInstructors].filter(n => n && n !== '미정');
        const warnings = [];

        for (const name of instructorsToCheck) {
            const result = await checkInstructorAvailability(name, payloadData.date, payloadData.startTime, payloadData.endTime);
            if (!result.available) {
                warnings.push(result.message);
            }
        }

        if (warnings.length > 0) {
            const proceed = confirm(
                warnings.join('\n\n') +
                '\n\n──────────────────────\n' +
                '✅ [확인] 그래도 저장합니다.\n' +
                '❌ [취소] 강사를 변경합니다.'
            );
            if (!proceed) {
                // 강사 입력 필드로 포커스 이동하여 변경 유도
                const mainField = document.getElementById('mainTeacher');
                if (mainField) mainField.focus();
                btn.disabled = false;
                btn.innerText = originalText;
                return;
            }
        }

        // ─── 아르바이트생 시급 및 시간 스냅샷 ─────────────────────
        payloadData.partTimeFees = {};
        payloadData.partTimeHours = {};
        
        let calculatedHours = 0;
        if (payloadData.startTime && payloadData.endTime) {
            const [sh, sm] = payloadData.startTime.split(':').map(Number);
            const [eh, em] = payloadData.endTime.split(':').map(Number);
            calculatedHours = (eh + em / 60) - (sh + sm / 60);
            if (calculatedHours < 0) calculatedHours = 0;
        }

        for (const name of instructorsToCheck) {
            const profile = await getInstructorProfile(name);
            if (profile && profile.employmentType === 'part-time') {
                payloadData.partTimeFees[name] = profile.hourlyWage || 13000;
                payloadData.partTimeHours[name] = calculatedHours;
            }
        }

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