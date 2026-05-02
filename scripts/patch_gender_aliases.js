const admin = require('firebase-admin');

// 1. 서비스 계정 키 및 초기화
const serviceAccount = require('../json/schoolmanage87-serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function patchGenderAliases() {
    const collectionRef = db.collection('schools');
    const snapshot = await collectionRef.get();
    
    console.log(`성별 특화 학교 별칭 패치 시작...`);
    
    let updateCount = 0;
    const batchSize = 500;
    let batch = db.batch();

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        let alias = data.searchAlias || '';

        // '여자고' -> '여고', '여자중' -> '여중' 변환
        if (alias.includes('여자고') || alias.includes('여자중')) {
            const newAlias = alias.replace('여자고', '여고').replace('여자중', '여중');
            
            if (newAlias !== alias) {
                batch.update(docSnap.ref, { searchAlias: newAlias });
                updateCount++;
                console.log(`[변경] ${alias} -> ${newAlias}`);
            }
        }
    });

    if (updateCount > 0) {
        await batch.commit();
    }

    console.log(`✅ 패치 완료! 총 ${updateCount}개의 학교 별칭이 수정되었습니다.`);
}

patchGenderAliases().catch(console.error);
