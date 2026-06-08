const admin = require('firebase-admin');

const serviceAccount = require('../json/schoolmanage87-serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
    const docIds = ['9z9FINBl4RihRtTAOt32', 'm4hS4fy83lnPer8VerQe'];
    let count = 0;

    for (const docId of docIds) {
        const docRef = db.collection('schedules').doc(docId);
        
        // Remove '-' from subInstructor and subInstructors fields
        // Since we know they had '-', we can just update them to an empty string.
        await docRef.update({
            subInstructor: '',
            subInstructors: ''
        });
        
        count++;
        console.log(`✅ [${docId}] 보조강사 '-' 제거 완료`);
    }

    console.log(`총 ${count}건의 일정에서 보조강사 '-' 표시를 삭제(공란 처리)했습니다.`);
    process.exit(0);
}

run().catch(console.error);
