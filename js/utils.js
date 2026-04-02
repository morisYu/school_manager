function extractTime(val) {
    if (!val) return "09:00";
    const valStr = String(val);
    if (valStr.includes('T') || valStr.includes('Z')) {
        const d = new Date(valStr);
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    }
    const match = valStr.match(/\d{2}:\d{2}/);
    return match ? match[0] : "09:00";
}

function autoColon(target) {
    let val = target.value.replace(/\D/g, "");
    if (val.length > 2) {
        target.value = val.substring(0, 2) + ":" + val.substring(2, 4);
    } else {
        target.value = val;
    }
}

function formatDate(isoString) {
    if (!isoString) return "-";
    const d = new Date(isoString);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function calculateHours(startStr, endStr) {
    try {
        const sMatch = String(startStr).match(/(\d{2}):(\d{2})/);
        const eMatch = String(endStr).match(/(\d{2}):(\d{2})/);
        if (!sMatch || !eMatch) return 0;
        const diff = (parseInt(eMatch[1]) * 60 + parseInt(eMatch[2])) - (parseInt(sMatch[1]) * 60 + parseInt(sMatch[2]));
        return diff > 0 ? (diff / 60).toFixed(1) : 0;
    } catch (e) { return 0; }
}

/**
 * Stale-while-revalidate 하이브리드 캐싱 함수
 * @param {string} url - 데이터를 가져올 API URL
 * @param {string} cacheKey - sessionStorage에 저장할 키 이름
 * @param {function} onDataReady - 데이터가 준비되었을 때 실행할 콜백 함수 (data, isCache)
 */
async function fetchAndCache(url, cacheKey, onDataReady) {
    // 1. 캐시 확인 및 즉시 화면 렌더링
    const cachedData = sessionStorage.getItem(cacheKey);
    let cachedString = "";
    
    if (cachedData) {
        try {
            const parsed = JSON.parse(cachedData);
            cachedString = JSON.stringify(parsed); // 비교용
            onDataReady(parsed, true); // true: 캐시 데이터임을 알림
        } catch (e) {
            console.warn("캐시 파싱 오류, 초기화합니다.");
            sessionStorage.removeItem(cacheKey);
        }
    }

    // 2. 백그라운드 데이터 갱신 요청
    try {
        const res = await fetch(url);
        const freshData = await res.json();
        const freshString = JSON.stringify(freshData);

        // 3. 캐시와 최신 데이터가 다르면 화면 새로고침
        if (cachedString !== freshString) {
            sessionStorage.setItem(cacheKey, freshString);
            onDataReady(freshData, false); // false: 최신 데이터임을 알림
        }
    } catch (error) {
        console.error("데이터 동기화 실패:", error);
        if (!cachedData) {
            throw error; // 캐시도 없고 통신도 실패하면 에러를 던짐
        }
    }
}