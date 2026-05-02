const admin = require('firebase-admin');
const path = require('path');

// 1. 서비스 계정 키 및 초기화
const serviceAccount = require('../json/schoolmanage87-serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

/**
 * 지능적으로 별칭(Alias) 생성 함수
 */
function generateSmartAlias(fullName) {
    if (!fullName) return '';
    
    // 1. 기본 제거: '등학교' -> '', '학교' -> ''
    let alias = fullName.replace('등학교', '').replace('학교', '');
    
    // 2. '대구' 접두어 처리
    // 학교명이 '대구XXX초' 형태일 때 'XXX초'로 축약 (단, 남대구, 동대구 등은 유지)
    if (alias.startsWith('대구') && alias.length > 3) {
        // '대구' 뒤에 오는 글자가 지역명(남, 동, 서, 북)이 아닌 경우에만 제거 시도
        const commonPrefixes = ['남대구', '동대구', '서대구', '북대구'];
        const isSpecialCase = commonPrefixes.some(p => alias.startsWith(p));
        
        if (!isSpecialCase) {
            alias = alias.substring(2);
        }
    }
    
    // 3. 부설 학교 특수 처리 (예: 경북대학교사범대학부설초등학교 -> 경대사대부초)
    alias = alias.replace('대학교사범대학부설', '사대부');
    alias = alias.replace('대학교부설', '부설');
    alias = alias.replace('교육대학교', '교대');
    alias = alias.replace('경북대학교', '경대');
    
    return alias;
}

async function updateEmptyAliases() {
    const collectionRef = db.collection('schools');
    const snapshot = await collectionRef.get();
    
    console.log(`총 ${snapshot.size}개의 학교 데이터를 검사합니다...`);
    
    let updateCount = 0;
    const batchSize = 500;
    let batch = db.batch();

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const fullName = data.schoolName;
        const currentAlias = data.searchAlias;

        // 별칭이 비어있는 경우에만 자동 생성
        if (!currentAlias || currentAlias.trim() === '-' || currentAlias.trim() === '') {
            const newAlias = generateSmartAlias(fullName);
            
            if (newAlias) {
                batch.update(docSnap.ref, { searchAlias: newAlias });
                updateCount++;
                
                if (updateCount % batchSize === 0) {
                    console.log(`${updateCount}개 별칭 생성 중...`);
                }
            }
        }
    });

    if (updateCount > 0) {
        await batch.commit();
    }

    console.log(`✅ 별칭 자동 생성 완료! 총 ${updateCount}개의 학교 별칭이 업데이트되었습니다.`);
}

updateEmptyAliases().catch(console.error);
