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

// ============================================================
// 동적 보조강사 / 교구 행 관리 유틸리티
// ============================================================

/**
 * 보조강사 행을 동적으로 추가합니다.
 * @param {string} containerId - 행을 추가할 컨테이너의 ID
 * @param {string} [value=''] - 초기값 (모달 복원 시 사용)
 */
function addSubInstructorRow(containerId, value = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
        <input type="text" class="sub-instructor-input" value="${value}" placeholder="보조강사명">
        <button type="button" class="btn-remove-item" onclick="removeDynamicRow(this)" title="삭제">×</button>
    `;
    container.appendChild(row);
}

/**
 * 교구(종류+수량) 행을 동적으로 추가합니다.
 * @param {string} containerId - 행을 추가할 컨테이너의 ID
 * @param {string} [type=''] - 교구 종류 초기값
 * @param {number|string} [count=''] - 교구 수량 초기값
 */
function addEquipmentRow(containerId, type = '', count = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'dynamic-row';
    row.innerHTML = `
        <input type="text" class="equip-type-input" value="${type}" placeholder="교구 종류">
        <input type="number" class="equip-count-input" value="${count}" placeholder="수량" min="0">
        <button type="button" class="btn-remove-item" onclick="removeDynamicRow(this)" title="삭제">×</button>
    `;
    container.appendChild(row);
}

/**
 * 동적 행의 삭제(×) 버튼 클릭 시 해당 행을 제거합니다.
 * @param {HTMLElement} button - 클릭된 삭제 버튼
 */
function removeDynamicRow(button) {
    const row = button.closest('.dynamic-row');
    if (row) row.remove();
}

/**
 * 컨테이너에서 보조강사 이름 배열을 수집합니다. (빈 값 제외)
 * @param {string} containerId
 * @returns {string[]}
 */
function collectSubInstructors(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const inputs = container.querySelectorAll('.sub-instructor-input');
    return Array.from(inputs).map(el => el.value.trim()).filter(v => v !== '');
}

/**
 * 컨테이너에서 교구 배열 [{type, count}]을 수집합니다. (빈 값 제외)
 * @param {string} containerId
 * @returns {Array<{type: string, count: number}>}
 */
function collectEquipments(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return [];
    const rows = container.querySelectorAll('.dynamic-row');
    return Array.from(rows)
        .map(row => ({
            type: row.querySelector('.equip-type-input')?.value.trim() || '',
            count: Number(row.querySelector('.equip-count-input')?.value) || 0
        }))
        .filter(item => item.type !== '');
}

/**
 * 기존 단일 문자열 데이터를 배열로 안전하게 변환합니다 (하위 호환).
 * @param {*} value - 문자열 또는 배열
 * @returns {string[]}
 */
function normalizeSubInstructors(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') return [value.trim()];
    return [];
}

/**
 * 기존 단일 교구 데이터를 배열로 안전하게 변환합니다 (하위 호환).
 * @param {*} equipments - 배열 또는 기존 type/count 단일값
 * @param {string} [fallbackType] - 기존 equipType 필드값
 * @param {number} [fallbackCount] - 기존 equipCount 필드값
 * @returns {Array<{type: string, count: number}>}
 */
function normalizeEquipments(equipments, fallbackType, fallbackCount) {
    if (Array.isArray(equipments)) return equipments;
    if (fallbackType && fallbackType.trim() !== '') {
        return [{ type: fallbackType.trim(), count: Number(fallbackCount) || 0 }];
    }
    return [];
}
