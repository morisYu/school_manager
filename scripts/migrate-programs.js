const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// 1. 서비스 계정 키 및 DB 초기화
// 프로젝트에 설정된 데이터베이스 연결 설정을 가져옵니다.
let serviceAccount;
try {
    serviceAccount = require('../json/schoolmanage87-serviceAccountKey.json');
} catch (error) {
    console.error("❌ 서비스 계정 키를 찾을 수 없습니다.");
    console.error("경로: '../json/schoolmanage87-serviceAccountKey.json'");
    console.error("💡 Firebase Console에서 새 비공개 키를 생성하여 위 경로에 저장해 주세요.");
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

// 2. 매핑 딕셔너리 플레이스홀더
// "오타명": "정식명칭"
const MAPPING_DICT = {
    // 예시: "인공지능기초": "AI 코딩 기초",
    // "AI코딩기초": "AI 코딩 기초",
};

// 3. 실행 모드 확인
const args = process.argv.slice(2);
const isAudit = args.includes('--audit');
const isMigrate = args.includes('--migrate');

if (!isAudit && !isMigrate) {
    console.log("⚠️ 실행 모드를 지정해주세요: --audit 또는 --migrate");
    console.log("사용법: node scripts/migrate-programs.js --audit");
    process.exit(1);
}

async function run() {
    try {
        console.log("🔄 데이터베이스 연결 성공...");

        // '프로그램 관리' 컬렉션에서 유효한 프로그램 정식 명칭 목록 조회
        const programsSnapshot = await db.collection("programs").get();
        const validPrograms = new Set();
        programsSnapshot.forEach(doc => {
            validPrograms.add(doc.data().programName);
        });
        console.log(`✅ 등록된 정식 프로그램 수: ${validPrograms.size}개\n`);

        // '수업 일정' 데이터 조회
        const schedulesSnapshot = await db.collection("schedules").get();
        const allSchedules = schedulesSnapshot.docs;

        // --- 1. 감사(Audit) 모드 ---
        if (isAudit) {
            console.log("======================================");
            console.log("🔍 [감사(Audit) 모드] 미매칭 데이터 검색");
            console.log("======================================");
            
            const invalidNames = new Set();
            let invalidSchedulesCount = 0;

            allSchedules.forEach(doc => {
                const data = doc.data();
                const progName = data.programName;
                
                // 프로그램명이 존재하지만, 정식 목록에 없는 경우 추출
                if (progName && !validPrograms.has(progName)) {
                    invalidNames.add(progName);
                    invalidSchedulesCount++;
                }
            });

            console.log(`⚠️ 총 ${invalidSchedulesCount}개의 일정에서 미등록 프로그램명이 발견되었습니다.`);
            console.log(`\n📝 [미등록 프로그램명 목록 (고유값 ${invalidNames.size}개)]`);
            invalidNames.forEach(name => {
                console.log(`- "${name}"`);
            });
            console.log("\n💡 위 항목들을 확인하고 스크립트 상단의 MAPPING_DICT를 업데이트하세요.");
            process.exit(0);
        }

        // --- 2. 마이그레이션(Migrate) 모드 ---
        if (isMigrate) {
            console.log("======================================");
            console.log("🚀 [마이그레이션] 데이터 정규화 시작");
            console.log("======================================");

            if (Object.keys(MAPPING_DICT).length === 0) {
                console.log("⚠️ MAPPING_DICT에 매핑 규칙이 비어있습니다. 스크립트를 수정해 주세요.");
                process.exit(1);
            }

            let successCount = 0;
            let failCount = 0;
            let noChangeCount = 0;

            // 데이터 무결성을 위해 Firestore Batch 사용 (원자성 보장 및 롤백)
            let batch = db.batch();
            let currentBatchCount = 0;
            const BATCH_LIMIT = 400; // Firestore 1회 배치 제한(500) 이하로 설정

            for (const doc of allSchedules) {
                const data = doc.data();
                const progName = data.programName;

                if (MAPPING_DICT[progName]) {
                    const newProgName = MAPPING_DICT[progName];
                    const docRef = db.collection("schedules").doc(doc.id);
                    
                    // 정식 명칭으로 업데이트
                    batch.update(docRef, { programName: newProgName });
                    currentBatchCount++;
                    successCount++;

                    // 배치 크기가 한도에 도달하면 커밋하고 새 배치 생성
                    if (currentBatchCount >= BATCH_LIMIT) {
                        try {
                            await batch.commit();
                            currentBatchCount = 0;
                            batch = db.batch();
                        } catch (err) {
                            console.error("❌ 배치 커밋 에러 발생, 해당 배치는 롤백되었습니다:", err);
                            failCount += currentBatchCount;
                            successCount -= currentBatchCount; // 카운트 롤백
                            currentBatchCount = 0;
                            batch = db.batch();
                        }
                    }
                } else {
                    noChangeCount++;
                }
            }

            // 남은 배치가 있다면 처리
            if (currentBatchCount > 0) {
                try {
                    await batch.commit();
                } catch (err) {
                    console.error("❌ 마지막 배치 커밋 에러 발생, 해당 배치는 롤백되었습니다:", err);
                    failCount += currentBatchCount;
                    successCount -= currentBatchCount;
                }
            }

            console.log(`\n📊 [마이그레이션 완료 결과]`);
            console.log(`✅ 업데이트 성공: ${successCount}건`);
            console.log(`❌ 업데이트 실패(롤백): ${failCount}건`);
            console.log(`➖ 변경 대상 아님(정상): ${noChangeCount}건`);
            process.exit(0);
        }

    } catch (error) {
        console.error("❌ 치명적인 오류 발생:", error);
        process.exit(1);
    }
}

run();
