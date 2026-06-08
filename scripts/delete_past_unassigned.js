const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require('../json/schoolmanage87-serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function run() {
    // 오늘 날짜 구하기 (YYYY-MM-DD)
    const today = new Date();
    // 한국 시간(KST) 기준으로 처리
    const offset = today.getTimezoneOffset() * 60000; 
    const dateOffset = new Date(today.getTime() - offset);
    const todayStr = dateOffset.toISOString().split("T")[0];

    console.log(`오늘 날짜(${todayStr}) 이전의 일정 중 강사가 '미정'이거나 '-'인 일정을 삭제합니다...`);

    const collectionRef = db.collection('schedules');
    const snapshot = await collectionRef.where('date', '<', todayStr).get();
    
    let count = 0;
    let batch = db.batch();

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const main = (data.mainInstructor || '').trim();
        
        // 강사가 미정 또는 - 인 경우
        if (main === '미정' || main === '-') {
            console.log(`삭제 대상: [${data.date}] ${data.schoolName} - ${data.programName} (강사: ${main})`);
            batch.delete(docSnap.ref);
            count++;
        }
    });

    if (count > 0) {
        await batch.commit();
        console.log(`\n✅ 완료! 총 ${count}개의 미정/'-' 일정이 삭제되었습니다.`);
    } else {
        console.log(`\n✅ 삭제할 일정이 없습니다.`);
    }
    process.exit(0);
}

run().catch(console.error);
