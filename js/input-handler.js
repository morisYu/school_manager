import { addSchedule, getSchools, checkInstructorAvailability, getInstructorProfile, getAllInstructors, getPrograms } from './db_service.js';
import { auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// 학교 목록 + 강사 목록 데이터 로드 및 자동완성 설정
onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
        const [schools, instructors, programs] = await Promise.all([
            getSchools(),
            getAllInstructors(), // 재직 중인 강사만 로드
            getPrograms()
        ]);

        // ─── 학교 자동완성 ───────────────────────────────────
        const dataList = document.getElementById('school-list');
        if (dataList && Array.isArray(schools)) {
            schools.forEach(school => {
                if (school.searchAlias) {
                    const option1 = document.createElement('option');
                    option1.value = school.searchAlias;
                    dataList.appendChild(option1);

                    const option2 = document.createElement('option');
                    option2.value = `${school.schoolName.replace('등학교', '')} (${school.searchAlias})`;
                    dataList.appendChild(option2);
                }
            });
        }

        // ─── 강사 자동완성 ───────────────────────────────────
        // 전역 캐시에 강사명 저장 (utils.js의 addSubInstructorRow에서 참조)
        window._instructorNames = instructors.map(inst => inst.name);
        populateInstructorDatalist('instructor-datalist');

        // ─── 프로그램 자동완성 ───────────────────────────────────
        const programList = document.getElementById('program-list');
        if (programList && Array.isArray(programs)) {
            window._programNames = programs.map(p => p.programName);
            programs.forEach(prog => {
                const option = document.createElement('option');
                option.value = prog.programName;
                programList.appendChild(option);
            });
        }

    } catch (error) {
        console.error("Error loading data for suggestions:", error);
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

        // ─── 유효한 프로그램명 확인 ──────────────────────────────
        if (window._programNames && window._programNames.length > 0) {
            if (!window._programNames.includes(payloadData.programName)) {
                alert(`⚠️ '${payloadData.programName}'은(는) 등록되지 않은 프로그램입니다.\n[프로그램 관리] 페이지에서 먼저 등록해 주세요.`);
                btn.disabled = false;
                btn.innerText = originalText;
                return;
            }
        }

        // ─── 미등록 강사명 경고 ──────────────────────────────────
        const instructorsToCheck = [payloadData.mainInstructor, ...payloadData.subInstructors].filter(n => n && n !== '미정');
        if (window._instructorNames.length > 0) {
            const unregistered = instructorsToCheck.filter(n => !window._instructorNames.includes(n));
            if (unregistered.length > 0) {
                const proceed = confirm(
                    `⚠️ 강사 관리에 등록되지 않은 이름이 있습니다:\n\n  • ${unregistered.join('\n  • ')}\n\n오입력이 아닌지 확인해주세요.\n[확인] 그래도 저장  /  [취소] 수정`
                );
                if (!proceed) {
                    btn.disabled = false;
                    btn.innerText = originalText;
                    return;
                }
            }
        }

        // ─── 강사 가용 시간 충돌 확인 ───────────────────────────
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