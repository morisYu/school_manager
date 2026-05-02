const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 1. 서비스 계정 키 및 초기화
const serviceAccount = require('../json/schoolmanage87-serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 2. JSON 데이터 로드
const schoolsPath = path.join(__dirname, '../json/schools.json');
const schoolsData = JSON.parse(fs.readFileSync(schoolsPath, 'utf8'));

/**
 * 데이터를 Firestore에 일괄 업로드
 */
async function migrateSchools() {
    const collectionRef = db.collection('schools');
    
    console.log(`총 ${schoolsData.length}개의 학교 데이터를 마이그레이션 시작합니다...`);

    let count = 0;
    const batchSize = 500;
    let batch = db.batch();

    for (const school of schoolsData) {
        // 필드 매핑 (한글 키 -> 영문 카멜케이스)
        const mappedData = {
            schoolId: school['학교ID'] || '',
            searchAlias: school['검색용 약칭'] || '',
            schoolName: school['학교명'] || '',
            schoolType: school['학교구분'] || '',
            city: school['시'] || '',
            district: school['구'] || '',
            address: school['주소'] || '',
            zipCode: String(school['우편번호'] || ''),
            mainPhone: school['대표번호'] || '',
            website: school['홈페이지'] || '',
            managerName: school['담당자명'] || '',
            managerPhone: school['담당자 연락처'] || '',
            note: school['비고'] || ''
        };

        // 학교ID를 문서 ID로 사용하거나 자동 생성
        // 여기서는 데이터 중복을 방지하기 위해 학교ID가 있으면 그것을 사용합니다.
        const docRef = school['학교ID'] ? collectionRef.doc(school['학교ID']) : collectionRef.doc();
        batch.set(docRef, mappedData, { merge: true });

        count++;

        // 500개 단위로 커밋
        if (count % batchSize === 0) {
            await batch.commit();
            console.log(`${count}개 완료...`);
            batch = db.batch();
        }
    }

    // 남은 배치 커밋
    if (count % batchSize !== 0) {
        await batch.commit();
    }

    console.log(`✅ 마이그레이션 완료! 총 ${count}개의 데이터가 처리되었습니다.`);
}

migrateSchools().catch(console.error);
