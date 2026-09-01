const admin = require('firebase-admin');

const serviceAccount = require('../json/schoolmanage87-serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function cleanup() {
    console.log("🔍 오늘 잘못 생성된 깡통 학교 데이터를 검색합니다...");
    
    // 오늘 생성된 학교를 가져오기 위해 24시간 전 시간 구하기
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const snapshot = await db.collection('schools')
        .where('createdAt', '>=', yesterday.toISOString())
        .get();

    if (snapshot.empty) {
        console.log("✅ 신규 학교 데이터가 없습니다.");
        return;
    }

    let deleteCount = 0;
    const batch = db.batch();

    snapshot.forEach(doc => {
        const data = doc.data();
        
        // 깡통 학교 특징: 오늘 생성되었고, 주소가 없음 (방금 CSV 파싱에서 주소가 누락되었기 때문)
        if (!data.address || data.address.trim() === '') {
            console.log(`🗑️ 삭제 대상 발견: ${data.schoolName} (ID: ${doc.id})`);
            batch.delete(doc.ref);
            deleteCount++;
        }
    });

    if (deleteCount > 0) {
        await batch.commit();
        console.log(`\n🎉 총 ${deleteCount}개의 깡통 중복 학교를 성공적으로 삭제했습니다!`);
    } else {
        console.log("\n✅ 삭제할 깡통 데이터가 없습니다.");
    }
}

cleanup().catch(console.error);
