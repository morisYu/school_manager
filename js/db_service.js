// firebase_config.js에서 초기화된 Firestore 인스턴스 가져오기 (동적 임포트 환경에 맞게 작성 가능하나, 여기서는 ES 모듈 기반으로 작성)
import { db } from './firebase_config.js';

// Firebase v9 Modular SDK (CDN)
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    getDoc,
    doc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

/**
 * 프로그램명 괄호 앞 공백 제거 정규화 유틸리티
 * 예: 'GALAXY탐사 (과학)' -> 'GALAXY탐사(과학)'
 * @param {string} name 프로그램명
 * @returns {string} 정제된 프로그램명
 */
export function normalizeProgramName(name) {
    if (!name || typeof name !== 'string') return name;
    return name.replace(/\s+\(/g, '(').trim();
}

/**
 * 쉼표 구분 프로그램 목록 문자열 내 각 프로그램명 정규화 유틸리티
 * @param {string} str 쉼표로 구분된 프로그램 목록 문자열
 * @returns {string} 정제된 프로그램 목록 문자열
 */
export function normalizeProgramsListString(str) {
    if (!str || typeof str !== 'string') return str;
    return str
        .split(',')
        .map(s => normalizeProgramName(s))
        .filter(Boolean)
        .join(', ');
}

/**
 * =========================================================
 * [Instructors 컬렉션 관련 기능]
 * Schema: { name, birthDate, hireDate, programs, note, photoBase64 }
 * 문서 ID = 강사명 (name)을 그대로 사용하여 검색 용이
 * =========================================================
 */

/**
 * 강사명으로 프로필을 조회합니다.
 * @param {string} name 강사명
 * @returns {Promise<Object|null>} 강사 프로필 객체 또는 null
 */
export async function getInstructorProfile(name) {
    try {
        const docRef = doc(db, "instructors", name);
        const docSnap = await getDoc(docRef);
        return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null;
    } catch (error) {
        console.error("👤 getInstructorProfile 에러:", error);
        throw error;
    }
}

/**
 * 강사 프로필을 저장하거나 업데이트합니다.
 * @param {string} name 강사명 (문서 ID로 사용)
 * @param {Object} data 저장할 프로필 데이터
 * @returns {Promise<void>}
 */
export async function saveInstructorProfile(name, data) {
    try {
        const docRef = doc(db, "instructors", name);
        const dataToSave = { ...data };
        if (dataToSave.programs) {
            dataToSave.programs = normalizeProgramsListString(dataToSave.programs);
        }
        await setDoc(docRef, { ...dataToSave, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
        console.error("👤 saveInstructorProfile 에러:", error);
        throw error;
    }
}

/**
 * instructors 컬렉션에서 모든 강사 목록을 가져옵니다.
 * @param {boolean} includeResigned 퇴사자 포함 여부 (기본값: false - 퇴사일이 지난 강사는 제외됨)
 * @returns {Promise<Array>} 강사 프로필 객체 배열 (name 오름차순)
 */
export async function getAllInstructors(includeResigned = false) {
    try {
        const instructorsRef = collection(db, "instructors");
        const q = query(instructorsRef, orderBy("name", "asc"));
        const snapshot = await getDocs(q);
        const instructors = [];

        // 오늘 날짜 (YYYY-MM-DD 형식)
        const todayStr = new Date().toLocaleDateString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
        }).replace(/\. /g, '-').replace('.', ''); // 2026-07-20 형태 변환 (또는 단순 문자열 비교를 위해 로컬 날짜 기준 사용)

        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            if (!includeResigned && data.isResigned && data.resignationDate) {
                // 퇴사일이 오늘이거나 오늘 이전이면 제외
                if (data.resignationDate <= todayStr) {
                    return; // skip this instructor
                }
            }

            instructors.push({ id: docSnap.id, ...data });
        });
        return instructors;
    } catch (error) {
        console.error("👤 getAllInstructors 에러:", error);
        throw error;
    }
}

/**
 * 강사명(문서 ID)으로 강사 프로필을 삭제합니다.
 * @param {string} name 강사명 (문서 ID)
 * @returns {Promise<void>}
 */
export async function deleteInstructor(name) {
    try {
        const docRef = doc(db, "instructors", name);
        await deleteDoc(docRef);
    } catch (error) {
        console.error("🗑️ deleteInstructor 에러:", error);
        throw error;
    }
}



/**
 * =========================================================
 * [Schools 컬렉션 관련 기능]
 * Schema: { schoolId, searchAlias, schoolName, schoolType, city, district, address, zipCode, mainPhone, website, managerName, managerPhone, note }
 * =========================================================
 */

/**
 * 모든 학교 목록을 가져와서 배열로 반환합니다.
 * @returns {Promise<Array>} 학교 객체 배열 (schoolName 오름차순 정렬)
 */
export async function getSchools() {
    try {
        const schoolsRef = collection(db, "schools");
        const q = query(schoolsRef, orderBy("schoolName", "asc"));
        const snapshot = await getDocs(q);

        const schools = [];
        snapshot.forEach((docSnap) => {
            // 문서 ID를 포함하여 객체 생성
            schools.push({ id: docSnap.id, ...docSnap.data() });
        });
        return schools;
    } catch (error) {
        console.error("🏫 getSchools 에러:", error);
        throw error; // 호출한 쪽에서 처리할 수 있도록 에러를 던짐
    }
}

/**
 * 새로운 학교를 추가합니다.
 * @param {Object} data 학교 정보 객체
 * @returns {Promise<string>} 추가된 문서 ID
 */
export async function addSchool(data) {
    try {
        const schoolsRef = collection(db, "schools");
        const docRef = await addDoc(schoolsRef, {
            ...data,
            createdAt: new Date().toISOString()
        });
        return docRef.id;
    } catch (error) {
        console.error("🏫 addSchool 에러:", error);
        throw error;
    }
}

/**
 * 기존 학교 정보를 업데이트합니다.
 * @param {string} docId 문서 ID
 * @param {Object} data 업데이트할 객체
 * @returns {Promise<boolean>} 성공 여부
 */
export async function updateSchool(docId, data) {
    try {
        const schoolRef = doc(db, "schools", docId);
        await updateDoc(schoolRef, {
            ...data,
            updatedAt: new Date().toISOString()
        });
        return true;
    } catch (error) {
        console.error("🏫 updateSchool 에러:", error);
        throw error;
    }
}

/**
 * 학교 목록을 일괄 업데이트/추가합니다.
 * @param {Array} newSchools 추가할 학교 배열
 * @param {Array} updateSchools 업데이트할 학교 배열 (docId 필수)
 */
export async function bulkUpdateSchools(newSchools, updateSchools) {
    try {
        const promises = [];
        const schoolsRef = collection(db, "schools");

        newSchools.forEach(school => {
            const targetId = school.id || school.schoolCode;
            if (targetId) {
                const docRef = doc(db, "schools", targetId);
                promises.push(setDoc(docRef, {
                    ...school,
                    createdAt: new Date().toISOString()
                }, { merge: true }));
            } else {
                promises.push(addDoc(schoolsRef, {
                    ...school,
                    createdAt: new Date().toISOString()
                }));
            }
        });

        updateSchools.forEach(school => {
            const { docId, ...dataToUpdate } = school;
            const targetId = docId || school.id || school.schoolCode;
            const schoolRef = doc(db, "schools", targetId);
            promises.push(setDoc(schoolRef, {
                ...dataToUpdate,
                updatedAt: new Date().toISOString()
            }, { merge: true }));
        });

        await Promise.all(promises);
        return true;
    } catch (error) {
        console.error("🏫 bulkUpdateSchools 에러:", error);
        throw error;
    }
}

/**
 * =========================================================
 * [Schedules 컬렉션 관련 기능]
 * Schema: { region, date, startTime, endTime, programName, schoolName, schoolId, grade, targetCount, mainInstructor, subInstructor, equipType, equipCount, note, color }
 * =========================================================
 */

/**
 * 특정 기간 내의 일정을 쿼리하여 반환합니다.
 * @param {string} startDate 시작 날짜 (예: '2024-04-01')
 * @param {string} endDate 종료 날짜 (예: '2024-04-30')
 * @returns {Promise<Array>} 일정 객체 배열
 */
export async function getSchedulesByDate(startDate, endDate) {
    try {
        const schedulesRef = collection(db, "schedules");
        const q = query(
            schedulesRef,
            where("date", ">=", startDate),
            where("date", "<=", endDate),
            orderBy("date", "asc")
        );

        const snapshot = await getDocs(q);

        const schedules = [];
        snapshot.forEach((docSnap) => {
            schedules.push({ id: docSnap.id, ...docSnap.data() });
        });
        return schedules;
    } catch (error) {
        console.error("📅 getSchedulesByDate 에러:", error);
        throw error;
    }
}


/**
 * 전체 일정을 가져와 배열로 반환합니다. (강사 관리/학교 관리 페이지용)
 * @returns {Promise<Array>} 전체 일정 객체 배열 (date 오름차순 정렬)
 */
export async function getAllSchedules() {
    try {
        const schedulesRef = collection(db, "schedules");
        const q = query(schedulesRef, orderBy("date", "asc"));
        const snapshot = await getDocs(q);

        const schedules = [];
        snapshot.forEach((docSnap) => {
            schedules.push({ id: docSnap.id, ...docSnap.data() });
        });
        return schedules;
    } catch (error) {
        console.error("📅 getAllSchedules 에러:", error);
        throw error;
    }
}

/**
 * 새로운 일정을 저장합니다.
 * @param {Object} data 저장할 일정 객체
 * @returns {Promise<string>} 생성된 문서의 ID
 */
export async function addSchedule(data) {
    try {
        const scheduleData = { ...data };
        if (scheduleData.programName) {
            scheduleData.programName = normalizeProgramName(scheduleData.programName);
        }
        const schedulesRef = collection(db, "schedules");
        const docRef = await addDoc(schedulesRef, scheduleData);
        return docRef.id;
    } catch (error) {
        console.error("➕ addSchedule 에러:", error);
        throw error;
    }
}

/**
 * 문서 ID를 기준으로 기존 일정을 수정합니다.
 * @param {string} docId 수정할 문서의 ID
 * @param {Object} data 수정할 데이터 (전부 또는 일부 필드)
 * @returns {Promise<boolean>} 성공 여부
 */
export async function updateSchedule(docId, data) {
    try {
        const updateData = { ...data };
        if (updateData.programName) {
            updateData.programName = normalizeProgramName(updateData.programName);
        }
        const scheduleRef = doc(db, "schedules", docId);
        await updateDoc(scheduleRef, updateData);
        return true;
    } catch (error) {
        console.error("✏️ updateSchedule 에러:", error);
        throw error;
    }
}

/**
 * 문서 ID를 기준으로 일정을 삭제합니다.
 * @param {string} docId 삭제할 문서의 ID
 * @returns {Promise<boolean>} 성공 여부
 */
export async function deleteSchedule(docId) {
    try {
        const scheduleRef = doc(db, "schedules", docId);
        await deleteDoc(scheduleRef);
        return true;
    } catch (error) {
        console.error("🗑️ deleteSchedule 에러:", error);
        throw error;
    }
}

/**
 * 기존 일정을 복제하고 필요시 데이터를 덮어써서 새 일정을 생성합니다.
 * @param {string} originalDocId 복제할 원본 문서의 ID
 * @param {Object} updatedData 원본 데이터 위에 덮어쓸 새로운 데이터 (예: 다른 날짜 등)
 * @returns {Promise<string>} 생성된 새 문서의 ID
 */
export async function duplicateSchedule(originalDocId, updatedData = {}) {
    try {
        // 1. originalDocId로 원본 데이터를 가져온다.
        const scheduleRef = doc(db, "schedules", originalDocId);
        const docSnap = await getDoc(scheduleRef);

        if (!docSnap.exists()) {
            throw new Error(`문서 ID(${originalDocId})에 해당하는 일정이 존재하지 않습니다.`);
        }

        // 2. 원본 데이터 추출 (Firestore 시스템 필드인 id는 .data()에 포함되지 않으므로 자연스럽게 제외됨)
        const originalData = docSnap.data();

        // 3. updatedData 객체가 전달되면 원본 데이터 위에 덮어쓴다.
        const newData = {
            ...originalData,
            ...updatedData
        };
        if (newData.programName) {
            newData.programName = normalizeProgramName(newData.programName);
        }

        // 4. 새로운 문서로 컬렉션에 추가하고 새 ID를 반환한다.
        const newDocId = await addSchedule(newData);
        return newDocId;
    } catch (error) {
        console.error("📋 duplicateSchedule 에러:", error);
        throw error;
    }
}

/**
 * =========================================================
 * [Programs 컬렉션 관련 기능]
 * =========================================================
 */

/**
 * 특정 프로그램명과 연관된 모든 수업 일정을 가져옵니다.
 * schedules 컬렉션의 programName 필드로 필터링합니다.
 * @param {string} programName 프로그램명
 * @returns {Promise<Array>} 해당 프로그램의 일정 배열 (date 오름차순)
 */
export async function getSchedulesByProgramName(programName) {
    try {
        const schedulesRef = collection(db, "schedules");
        // orderBy 없이 where만 사용하여 복합 인덱스 요구 없이 동작
        const q = query(
            schedulesRef,
            where("programName", "==", programName)
        );
        const snapshot = await getDocs(q);
        const schedules = [];
        snapshot.forEach((docSnap) => {
            schedules.push({ id: docSnap.id, ...docSnap.data() });
        });
        // 클라이언트에서 날짜 오름차순 정렬
        schedules.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        return schedules;
    } catch (error) {
        console.error("📅 getSchedulesByProgramName 에러:", error);
        throw error;
    }
}

export async function getPrograms() {
    try {
        const programsRef = collection(db, "programs");
        const q = query(programsRef, orderBy("programName", "asc"));
        const snapshot = await getDocs(q);
        const programs = [];
        snapshot.forEach((docSnap) => {
            programs.push({ id: docSnap.id, ...docSnap.data() });
        });
        return programs;
    } catch (error) {
        console.error("📦 getPrograms 에러:", error);
        throw error;
    }
}

export async function addProgram(data) {
    try {
        const programData = { ...data };
        if (programData.programName) {
            programData.programName = normalizeProgramName(programData.programName);
        }
        const programsRef = collection(db, "programs");
        const docRef = await addDoc(programsRef, {
            ...programData,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        return docRef.id;
    } catch (error) {
        console.error("➕ addProgram 에러:", error);
        throw error;
    }
}

export async function updateProgram(docId, data) {
    try {
        const programData = { ...data };
        if (programData.programName) {
            programData.programName = normalizeProgramName(programData.programName);
        }
        const programRef = doc(db, "programs", docId);
        await updateDoc(programRef, { ...programData, updatedAt: new Date().toISOString() });
        return true;
    } catch (error) {
        console.error("✏️ updateProgram 에러:", error);
        throw error;
    }
}

export async function deleteProgram(docId) {
    try {
        const programRef = doc(db, "programs", docId);
        await deleteDoc(programRef);
        return true;
    } catch (error) {
        console.error("🗑️ deleteProgram 에러:", error);
        throw error;
    }
}

/**
 * =========================================================
 * [프로그램 명칭 공백 정제 및 일괄 표준화 기능]
 * ' (' 형태의 공백을 '(' 로 통일하여 프로그램, 일정, 강사 정보를 일괄 정제
 * =========================================================
 */

/**
 * 데이터베이스 전체에서 괄호 앞 공백(' \(')이 포함된 프로그램, 일정, 강사 데이터를 검사합니다.
 * @returns {Promise<Object>} 검사 결과 리포트 객체
 */
export async function auditProgramNameSpaces() {
    try {
        const [programsSnap, schedulesSnap, instructorsSnap] = await Promise.all([
            getDocs(collection(db, "programs")),
            getDocs(collection(db, "schedules")),
            getDocs(collection(db, "instructors"))
        ]);

        const allPrograms = [];
        programsSnap.forEach(d => allPrograms.push({ id: d.id, ...d.data() }));

        const allSchedules = [];
        schedulesSnap.forEach(d => allSchedules.push({ id: d.id, ...d.data() }));

        const allInstructors = [];
        instructorsSnap.forEach(d => allInstructors.push({ id: d.id, ...d.data() }));

        const spaceRegex = /\s+\(/;

        // 1. 프로그램 검사 (중복 여부 확인)
        const affectedPrograms = [];
        const programsByName = new Map();
        allPrograms.forEach(p => {
            if (p.programName) {
                programsByName.set(p.programName.trim(), p);
            }
        });

        allPrograms.forEach(p => {
            const origName = p.programName || '';
            if (spaceRegex.test(origName)) {
                const targetName = normalizeProgramName(origName);
                const existingTarget = programsByName.get(targetName);
                const isDuplicate = existingTarget && existingTarget.id !== p.id;
                affectedPrograms.push({
                    docId: p.id,
                    oldName: origName,
                    newName: targetName,
                    isDuplicate: !!isDuplicate,
                    targetDocId: isDuplicate ? existingTarget.id : null,
                    docData: p
                });
            }
        });

        // 2. 수업 일정 검사 (기존 명칭별 그룹화)
        const affectedSchedulesMap = new Map();
        let totalAffectedSchedules = 0;
        allSchedules.forEach(s => {
            const origName = s.programName || '';
            if (spaceRegex.test(origName)) {
                const targetName = normalizeProgramName(origName);
                if (!affectedSchedulesMap.has(origName)) {
                    affectedSchedulesMap.set(origName, {
                        oldName: origName,
                        newName: targetName,
                        count: 0,
                        scheduleIds: []
                    });
                }
                const group = affectedSchedulesMap.get(origName);
                group.count += 1;
                group.scheduleIds.push(s.id);
                totalAffectedSchedules += 1;
            }
        });
        const affectedSchedules = Array.from(affectedSchedulesMap.values());

        // 3. 강사 정보 검사
        const affectedInstructors = [];
        allInstructors.forEach(inst => {
            const origPrograms = inst.programs || '';
            if (spaceRegex.test(origPrograms)) {
                const newPrograms = normalizeProgramsListString(origPrograms);
                affectedInstructors.push({
                    docId: inst.id,
                    name: inst.name || inst.id,
                    oldPrograms: origPrograms,
                    newPrograms: newPrograms
                });
            }
        });

        const hasChanges = affectedPrograms.length > 0 || affectedSchedules.length > 0 || affectedInstructors.length > 0;

        return {
            programs: affectedPrograms,
            schedules: affectedSchedules,
            totalSchedulesCount: totalAffectedSchedules,
            instructors: affectedInstructors,
            hasChanges
        };
    } catch (error) {
        console.error("🔍 auditProgramNameSpaces 에러:", error);
        throw error;
    }
}

/**
 * 감사 결과를 바탕으로 프로그램, 수업 일정, 강사 정보를 일괄 표준화합니다.
 * @param {Object} auditResult auditProgramNameSpaces의 반환값
 * @param {Function} [onProgress] 진행 상황 콜백 (메시지 문자열 전달)
 * @returns {Promise<Object>} 정제 결과 통계
 */
export async function executeNormalizeProgramNames(auditResult, onProgress = null) {
    if (!auditResult || !auditResult.hasChanges) {
        return {
            success: true,
            updatedProgramsCount: 0,
            mergedProgramsCount: 0,
            updatedSchedulesCount: 0,
            updatedInstructorsCount: 0
        };
    }

    let updatedProgramsCount = 0;
    let mergedProgramsCount = 0;
    let updatedSchedulesCount = 0;
    let updatedInstructorsCount = 0;

    try {
        // 1. 프로그램 컬렉션 정제
        for (const prog of auditResult.programs) {
            if (prog.isDuplicate && prog.targetDocId) {
                // 이미 표준 명칭을 가진 문서가 존재하는 경우 -> 데이터 병합 후 공백 포함 문서 삭제
                const targetRef = doc(db, "programs", prog.targetDocId);
                const targetSnap = await getDoc(targetRef);
                if (targetSnap.exists()) {
                    const targetData = targetSnap.data();
                    const oldData = prog.docData || {};
                    const mergedUpdates = { updatedAt: new Date().toISOString() };

                    // 타겟 문서에 비어있는 필드가 있다면 구문서의 내용으로 보완
                    if ((!targetData.educationPlan || targetData.educationPlan.trim() === '' || targetData.educationPlan === '<p><br></p>') && oldData.educationPlan) {
                        mergedUpdates.educationPlan = oldData.educationPlan;
                    }
                    if ((!targetData.materials || targetData.materials.length === 0) && (oldData.materials && oldData.materials.length > 0)) {
                        mergedUpdates.materials = oldData.materials;
                    }
                    if ((!targetData.examplePhotos || targetData.examplePhotos.length === 0) && (oldData.examplePhotos && oldData.examplePhotos.length > 0)) {
                        mergedUpdates.examplePhotos = oldData.examplePhotos;
                    }
                    if ((!targetData.targetGrades || targetData.targetGrades.length === 0) && (oldData.targetGrades && oldData.targetGrades.length > 0)) {
                        mergedUpdates.targetGrades = oldData.targetGrades;
                    }
                    if ((!targetData.assignableInstructors || targetData.assignableInstructors.length === 0) && (oldData.assignableInstructors && oldData.assignableInstructors.length > 0)) {
                        mergedUpdates.assignableInstructors = oldData.assignableInstructors;
                    }
                    if (!targetData.description && oldData.description) mergedUpdates.description = oldData.description;
                    if (!targetData.memo && oldData.memo) mergedUpdates.memo = oldData.memo;
                    if (!targetData.category && oldData.category) mergedUpdates.category = oldData.category;

                    await updateDoc(targetRef, mergedUpdates);
                }

                // 공백 포함 중복 문서 삭제
                await deleteDoc(doc(db, "programs", prog.docId));
                mergedProgramsCount++;
            } else {
                // 중복이 없는 경우 -> 프로그램명 단순 수정
                await updateDoc(doc(db, "programs", prog.docId), {
                    programName: prog.newName,
                    updatedAt: new Date().toISOString()
                });
                updatedProgramsCount++;
            }

            if (onProgress) {
                onProgress(`📦 프로그램 데이터 정제 중... (${updatedProgramsCount + mergedProgramsCount}/${auditResult.programs.length})`);
            }
        }

        // 2. 수업 일정(schedules) 컬렉션 일괄 수정 (25개씩 청크 분할)
        const scheduleUpdates = [];
        for (const group of auditResult.schedules) {
            for (const sId of group.scheduleIds) {
                scheduleUpdates.push({ id: sId, newName: group.newName });
            }
        }

        const CHUNK_SIZE = 25;
        for (let i = 0; i < scheduleUpdates.length; i += CHUNK_SIZE) {
            const chunk = scheduleUpdates.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(item => updateDoc(doc(db, "schedules", item.id), { programName: item.newName })));
            updatedSchedulesCount += chunk.length;
            if (onProgress) {
                onProgress(`📅 수업 일정 정제 중... (${updatedSchedulesCount}/${scheduleUpdates.length})`);
            }
        }

        // 3. 강사(instructors) 프로필 컬렉션 수정
        for (const inst of auditResult.instructors) {
            await updateDoc(doc(db, "instructors", inst.docId), {
                programs: inst.newPrograms,
                updatedAt: new Date().toISOString()
            });
            updatedInstructorsCount++;
            if (onProgress) {
                onProgress(`👤 강사 프로필 정제 중... (${updatedInstructorsCount}/${auditResult.instructors.length})`);
            }
        }

        return {
            success: true,
            updatedProgramsCount,
            mergedProgramsCount,
            updatedSchedulesCount,
            updatedInstructorsCount
        };
    } catch (error) {
        console.error("⚡ executeNormalizeProgramNames 에러:", error);
        throw error;
    }
}

/**
 * =========================================================
 * [강사 가용 시간 충돌 확인]
 * =========================================================
 */

/**
 * 특정 강사가 주어진 날짜/시간에 수업 가능한지 확인합니다.
 * @param {string} instructorName 강사명
 * @param {string} dateStr 날짜 문자열 (YYYY-MM-DD)
 * @param {string} startTime 시작 시간 (HH:MM)
 * @param {string} endTime 종료 시간 (HH:MM)
 * @returns {Promise<{available: boolean, message: string}>}
 */
export async function checkInstructorAvailability(instructorName, dateStr, startTime, endTime) {
    const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const DAY_KO = ['일', '월', '화', '수', '목', '금', '토'];

    try {
        const profile = await getInstructorProfile(instructorName);

        // 프로필이 없거나 가용 시간이 설정되지 않은 경우 → 제한 없음
        if (!profile || !profile.availability) {
            return { available: true, message: '' };
        }

        const dayIndex = new Date(dateStr).getDay();
        const dayKey = DAY_NAMES[dayIndex];
        const dayKo = DAY_KO[dayIndex];
        const slots = profile.availability[dayKey];

        // 해당 요일에 불가능 시간 슬롯이 없거나 빈 배열 → 종일 수업 가능
        if (!slots || slots.length === 0) {
            return { available: true, message: '' };
        }

        // 시간을 분(minutes)으로 변환하여 비교
        const toMinutes = (t) => {
            const [h, m] = t.split(':').map(Number);
            return h * 60 + m;
        };
        const schedStart = toMinutes(startTime);
        const schedEnd = toMinutes(endTime);

        // 불가능 시간 슬롯 중 하나라도 일정 시간과 '겹치는지' 확인
        const overlappingSlot = slots.find(slot => {
            const slotStart = toMinutes(slot.start);
            const slotEnd = toMinutes(slot.end);
            return schedStart < slotEnd && schedEnd > slotStart;
        });

        if (overlappingSlot) {
            return {
                available: false,
                message: `⚠️ "${instructorName}" 강사는 ${dayKo}요일 [${overlappingSlot.start}~${overlappingSlot.end}]에 수업이 불가능합니다.\n(요청 시간: ${startTime}~${endTime})`
            };
        }

        return { available: true, message: '' };
    } catch (error) {
        console.error('⏰ checkInstructorAvailability 에러:', error);
        // 에러 시에는 저장을 막지 않음
        return { available: true, message: '' };
    }
}

/**
 * =========================================================
 * [지급기준 (Payment Rules) 컬렉션 관련 기능]
 * Schema: { id, ruleName, keyword, baseMinutes, mainFee, subFee, order }
 * =========================================================
 */

export async function getPaymentRules() {
    try {
        const rulesRef = collection(db, "payment_rules");
        const q = query(rulesRef, orderBy("order", "asc"));
        const snapshot = await getDocs(q);
        const rules = [];
        snapshot.forEach(doc => {
            rules.push({ id: doc.id, ...doc.data() });
        });
        return rules;
    } catch (error) {
        console.error("📋 getPaymentRules 에러:", error);
        return []; // 에러 시 빈 배열 반환 (인덱스 없을 때 대비)
    }
}

export async function savePaymentRule(data) {
    try {
        const rulesRef = collection(db, "payment_rules");
        if (data.id) {
            const ruleRef = doc(db, "payment_rules", data.id);
            const dataToUpdate = { ...data };
            delete dataToUpdate.id; // id 필드는 문서에 저장하지 않음
            await updateDoc(ruleRef, dataToUpdate);
            return data.id;
        } else {
            const docRef = await addDoc(rulesRef, data);
            return docRef.id;
        }
    } catch (error) {
        console.error("📋 savePaymentRule 에러:", error);
        throw error;
    }
}

export async function deletePaymentRule(id) {
    try {
        const ruleRef = doc(db, "payment_rules", id);
        await deleteDoc(ruleRef);
    } catch (error) {
        console.error("📋 deletePaymentRule 에러:", error);
        throw error;
    }
}

