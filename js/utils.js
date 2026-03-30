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