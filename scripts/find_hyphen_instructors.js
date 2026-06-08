const admin = require('firebase-admin');

const serviceAccount = require('../json/schoolmanage87-serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
    const today = new Date();
    const offset = today.getTimezoneOffset() * 60000; 
    const dateOffset = new Date(today.getTime() - offset);
    const todayStr = dateOffset.toISOString().split("T")[0];

    const collectionRef = db.collection('schedules');
    const snapshot = await collectionRef.where('date', '<', todayStr).get();
    
    let found = [];

    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const main = (data.mainInstructor || '').trim();
        
        let subList = [];
        if (data.subInstructors) {
            if (Array.isArray(data.subInstructors)) subList = data.subInstructors;
            else if (typeof data.subInstructors === 'string') subList = data.subInstructors.split(',').map(s => s.trim());
        } else if (data.subInstructor) {
            if (Array.isArray(data.subInstructor)) subList = data.subInstructor;
            else if (typeof data.subInstructor === 'string') subList = data.subInstructor.split(',').map(s => s.trim());
        }

        // 강사가 '-' 인지 확인
        const hasHyphenMain = (main === '-');
        const hasHyphenSub = subList.includes('-');
        
        // 빈칸, 미정 등도 혹시 몰라 잡으려면 추가하지만, 요청은 '-'
        if (hasHyphenMain || hasHyphenSub) {
            found.push({
                id: docSnap.id,
                date: data.date,
                schoolName: data.schoolName || '',
                programName: data.programName || '',
                mainInstructor: main,
                subInstructor: subList.join(', ')
            });
        }
    });

    console.log(JSON.stringify(found, null, 2));
    process.exit(0);
}

run().catch(console.error);
