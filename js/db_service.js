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
        await setDoc(docRef, { ...data, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (error) {
        console.error("👤 saveInstructorProfile 에러:", error);
        throw error;
    }
}

/**
 * instructors 컬렉션에서 모든 강사 목록을 가져옵니다.
 * @returns {Promise<Array>} 강사 프로필 객체 배열 (name 오름차순)
 */
export async function getAllInstructors() {
    try {
        const instructorsRef = collection(db, "instructors");
        const q = query(instructorsRef, orderBy("name", "asc"));
        const snapshot = await getDocs(q);
        const instructors = [];
        snapshot.forEach((docSnap) => {
            instructors.push({ id: docSnap.id, ...docSnap.data() });
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
        const schedulesRef = collection(db, "schedules");
        const docRef = await addDoc(schedulesRef, data);
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
        const scheduleRef = doc(db, "schedules", docId);
        await updateDoc(scheduleRef, data);
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
        const programsRef = collection(db, "programs");
        const docRef = await addDoc(programsRef, {
            ...data,
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
        const programRef = doc(db, "programs", docId);
        await updateDoc(programRef, { ...data, updatedAt: new Date().toISOString() });
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
