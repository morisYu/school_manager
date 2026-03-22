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

function isValidTime(timeStr) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    return timeRegex.test(timeStr);
}