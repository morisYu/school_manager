/* js/manage-handler.js - Firebase Firestore 버전 */
import { getAllSchedules, getAllInstructors, getInstructorProfile, saveInstructorProfile, deleteInstructor as dbDeleteInstructor, updateSchedule, getPrograms, getPaymentRules, savePaymentRule, deletePaymentRule } from './db_service.js';
import { auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

let rawData = [];
let programsData = []; // 프로그램 목록 저장용
let paymentRulesData = []; // 지급기준 규칙 목록 저장용
// 모달에서 현재 선택된 사진의 Base64 문자열 (null이면 변경 없음)
let pendingPhotoBase64 = null;

// 등록된 강사 목록 (모듈 전역 상태)
let registeredInstructors = [];
let currentSort = { field: 'name', direction: 'asc' }; // 정렬 상태

// 요일 설정 (영문 키 → 한글 라벨)
const DAY_CONFIG = [
    { key: 'monday',    label: '월' },
    { key: 'tuesday',   label: '화' },
    { key: 'wednesday', label: '수' },
    { key: 'thursday',  label: '목' },
    { key: 'friday',    label: '금' },
    { key: 'saturday',  label: '토' },
    { key: 'sunday',    label: '일' }
];

// ─── 인증 후 데이터 로드 ────────────────────────────────────────────────────────
// 로그인 상태 확인
onAuthStateChanged(auth, (user) => {
    if (!user) {
        window.location.href = 'login.html';
    }
});

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
        // 세 컬렉션을 병렬로 동시 조회하여 초기 로딩 시간 단축
        const [firestoreData, programs, rules] = await Promise.all([
            getAllSchedules(),
            getPrograms(),
            getPaymentRules(),
            loadInstructorList()
        ]);

        programsData = programs || [];
        paymentRulesData = rules || [];

        rawData = firestoreData.map(r => ({
            'id': r.id,
            '날짜': r.date,
            '시작시간': r.startTime,
            '종료시간': r.endTime,
            '지역구분': r.region,
            '프로그램명': r.programName,
            '기관명': r.schoolName,
            '주강사': r.mainInstructor,
            '보조강사들': normalizeSubInstructors(r.subInstructors || r.subInstructor),
            '교구목록': normalizeEquipments(r.equipments, r.equipType, r.equipCount),
            '비고': r.note,
            '색상': r.color,
            '학년': r.grade,
            '대상인원': r.targetCount,
            '차시': r.rounds !== undefined ? r.rounds : '',
            '강사비': r.instructorFee !== undefined ? r.instructorFee : '',
            '보조강사비': r.subInstructorFee !== undefined ? r.subInstructorFee : ''
        }));

    } catch (e) {
        console.error("Data Load Error:", e);
        alert("데이터를 불러오지 못했습니다.");
    }
});

/**
 * instructors 컬렉션에서 강사 목록을 불러와 드롭다운에 만듭니다.
 */
async function loadInstructorList() {
    const select = document.getElementById('teacherSelect');
    try {
        registeredInstructors = await getAllInstructors();
        select.innerHTML = '<option value="">강사 선택</option>';
        registeredInstructors.forEach(inst => {
            select.innerHTML += `<option value="${inst.name}">${inst.name}</option>`;
        });
    } catch (e) {
        console.error("강사 목록 로드 실패:", e);
        select.innerHTML = '<option value="">로드 실패</option>';
    }
}

// ─── 강사 선택 시 프로필 카드 표시 ────────────────────────────────────────────

window.onInstructorChange = async function () {
    const name = document.getElementById('teacherSelect').value;
    const card = document.getElementById('instructor-profile-card');

    if (!name) {
        // 강사 미선택 시 카드는 빈 상태로 유지
        card.style.display = 'flex';
        document.getElementById('profile-name').textContent = '-';
        document.getElementById('profile-birth').textContent = '-';
        document.getElementById('profile-hire').textContent = '-';
        document.getElementById('profile-programs').textContent = '-';
        document.getElementById('profile-note').textContent = '강사를 선택하면 프로필이 표시됩니다.';
        document.getElementById('profile-photo-img').style.display = 'none';
        document.getElementById('profile-photo-placeholder').style.display = 'flex';

        // 출강 및 정산 내역서 테이블 초기화
        const tbody = document.getElementById('report-table-body');
        const footer = document.getElementById('report-footer');
        if (tbody) tbody.innerHTML = '<tr><td colspan="10">강사를 선택하고 조회 조건을 설정하세요.</td></tr>';
        if (footer) footer.style.display = 'none';
        return;
    }

    card.style.display = 'flex';

    // 카드 초기화
    document.getElementById('profile-name').textContent = name;
    document.getElementById('profile-birth').textContent = '조회 중...';
    document.getElementById('profile-hire').textContent = '조회 중...';
    document.getElementById('profile-programs').textContent = '조회 중...';
    document.getElementById('profile-note').textContent = '조회 중...';
    document.getElementById('profile-photo-img').style.display = 'none';
    document.getElementById('profile-photo-placeholder').style.display = 'flex';

    // Firestore에서 프로필 가져오기
    try {
        const profile = await getInstructorProfile(name);
        renderProfileCard(name, profile);
        
        // 강사가 변경되었으므로 정산 내역서를 자동으로 새로 조회
        window.loadReport();
    } catch (e) {
        console.error("프로필 로드 실패:", e);
        renderProfileCard(name, null);
    }
};

/**
 * 가져온 프로필 데이터를 카드에 렌더링합니다.
 * @param {string} name 강사명
 * @param {Object|null} profile Firestore 프로필 데이터 (없으면 null)
 */
function renderProfileCard(name, profile) {
    document.getElementById('profile-name').textContent = name;

    if (profile) {
        document.getElementById('profile-affiliation').textContent = profile.affiliation || '-';
        document.getElementById('profile-birth').textContent = formatDate(profile.birthDate) || '-';
        document.getElementById('profile-hire').textContent  = formatDate(profile.hireDate)  || '-';
        const programsContainer = document.getElementById('profile-programs');
        programsContainer.innerHTML = ''; // 기존 내용 초기화
        const programsStr = profile.programs || '';
        if (programsStr.trim()) {
            const programs = programsStr.split(',').map(p => p.trim()).filter(p => p);
            programs.forEach(p => {
                const badge = document.createElement('span');
                badge.className = 'program-badge';
                badge.textContent = p;
                programsContainer.appendChild(badge);
            });
        } else {
            programsContainer.textContent = '-';
        }
        if (profile?.note) {
            document.getElementById('profile-note').textContent = profile.note;
        } else {
            document.getElementById('profile-note').innerHTML = '<span class="empty-placeholder">입력된 비고가 없습니다.</span>';
        }

        // ─── 계좌 정보 렌더링 ──────────────────────────────────────────
        const bankInfoContainer = document.getElementById('profile-bank-info');
        if (profile.bankName && profile.accountNumber && profile.accountHolder) {
            bankInfoContainer.innerHTML = `<button class="btn-bank-info" onclick="openBankModal('${profile.bankName}', '${profile.accountNumber}', '${profile.accountHolder}')">🏦 ${profile.bankName}</button>`;
        } else {
            bankInfoContainer.innerHTML = '<span class="empty-placeholder">계좌 정보가 없습니다.</span>';
        }

        // ─── 가용 시간 요약 렌더링 ────────────────────────────────────
        const badgesContainer = document.getElementById('availability-badges');
        if (badgesContainer) {
            badgesContainer.innerHTML = '';
            const avail = profile?.availability;

            if (!avail || Object.keys(avail).length === 0) {
                badgesContainer.innerHTML = '<span class="avail-placeholder">수업 불가능 시간이 없습니다. (모든 요일 종일 가능)</span>';
            } else {
                DAY_CONFIG.forEach(({ key, label }) => {
                    const slots = avail[key];
                    const badge = document.createElement('span');

                    if (!slots || slots.length === 0) {
                        badge.className = 'avail-day-badge'; // 종일 가능 (민트색)
                        badge.innerHTML = `<span class="avail-day-label">${label}</span> 종일 가능`;
                    } else {
                        badge.className = 'avail-day-badge unavailable'; // 불가 (빨간색)
                        const timeStr = slots.map(s => {
                            if (s.start === '00:00' && s.end === '23:59') return '종일';
                            return `${s.start}~${s.end}`;
                        }).join(', ');
                        badge.innerHTML = `<span class="avail-day-label">${label}</span> ${timeStr} 불가`;
                    }
                    badgesContainer.appendChild(badge);
                });
            }

            // 가용 시간 메모 표시
            if (profile?.availabilityNote) {
                const noteSpan = document.createElement('span');
                noteSpan.className = 'avail-placeholder';
                noteSpan.style.width = '100%';
                noteSpan.style.marginTop = '4px';
                noteSpan.textContent = `📝 ${profile.availabilityNote}`;
                badgesContainer.appendChild(noteSpan);
            }
        }

        const img = document.getElementById('profile-photo-img');
        const placeholder = document.getElementById('profile-photo-placeholder');
        if (profile.photoBase64) {
            img.src = profile.photoBase64;
            img.style.display = 'block';
            placeholder.style.display = 'none';
        } else {
            img.style.display = 'none';
            placeholder.style.display = 'flex';
        }
    } else {
        document.getElementById('profile-affiliation').textContent = '-';
        document.getElementById('profile-birth').textContent = '-';
        document.getElementById('profile-hire').textContent = '-';
        document.getElementById('profile-programs').textContent = '-';
        document.getElementById('profile-note').textContent     = '정보가 없습니다. 수정 버튼으로 등록하세요.';
        document.getElementById('profile-photo-img').style.display = 'none';
        document.getElementById('profile-photo-placeholder').style.display = 'flex';
    }
}

// ─── 프로필 수정 모달 열기/닫기 ──────────────────────────────────────────────

window.openProfileModal = async function () {
    const name = document.getElementById('teacherSelect').value;
    if (!name) return;

    pendingPhotoBase64 = null;

    // 모달 폼에 현재 값 채우기
    document.getElementById('modal-name').value = name;
    document.getElementById('modal-affiliation').value = '';
    document.getElementById('modal-birth').value = '';
    document.getElementById('modal-hire').value = '';
    document.getElementById('modal-programs').value = '';
    document.getElementById('modal-note').value = '';
    document.getElementById('modal-bank-name').value = '';
    document.getElementById('modal-account-number').value = '';
    document.getElementById('modal-account-holder').value = '';

    // 모달 사진 미리보기 초기화
    const previewImg = document.getElementById('modal-photo-preview');
    const previewPlaceholder = document.getElementById('modal-photo-placeholder');
    previewImg.style.display = 'none';
    previewPlaceholder.style.display = 'flex';

    // 기존 저장된 프로필 불러와서 폼 채우기
    try {
        const profile = await getInstructorProfile(name);
        if (profile) {
            document.getElementById('modal-affiliation').value = profile.affiliation || '';
            document.getElementById('modal-birth').value    = profile.birthDate || '';
            document.getElementById('modal-hire').value     = profile.hireDate  || '';
            document.getElementById('modal-programs').value = profile.programs  || '';
            document.getElementById('modal-note').value     = profile.note      || '';
            document.getElementById('modal-bank-name').value = profile.bankName || '';
            document.getElementById('modal-account-number').value = profile.accountNumber || '';
            document.getElementById('modal-account-holder').value = profile.accountHolder || '';

            if (profile.photoBase64) {
                previewImg.src = profile.photoBase64;
                previewImg.style.display = 'block';
                previewPlaceholder.style.display = 'none';
                // 기존 사진을 유지하기 위해 pendingPhotoBase64에 기존 값 저장
                pendingPhotoBase64 = profile.photoBase64;
            }
            
            // 가용 시간 UI 렌더링
            renderAvailabilityInputUI(profile.availability || null);
            document.getElementById('modal-availability-note').value = profile.availabilityNote || '';
        }
    } catch (e) {
        console.error("프로필 로드 실패:", e);
    }

    // 프로필이 없거나 로드 실패 시 빈 가용 시간 UI 렌더링
    if (!document.getElementById('availability-grid')?.children.length) {
        renderAvailabilityInputUI(null);
        document.getElementById('modal-availability-note').value = '';
    }

    const overlay = document.getElementById('profile-modal-overlay');
    const modal   = document.getElementById('profile-modal');
    overlay.style.display = 'block';
    modal.style.display   = 'flex';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.classList.add('is-open');
            modal.classList.add('is-open');
        });
    });
};

window.closeProfileModal = function () {
    const overlay = document.getElementById('profile-modal-overlay');
    const modal   = document.getElementById('profile-modal');

    overlay.classList.remove('is-open');
    modal.classList.remove('is-open');
    document.getElementById('modal-photo-input').value = '';
    pendingPhotoBase64 = null;

    modal.addEventListener('transitionend', () => {
        overlay.style.display = 'none';
        modal.style.display   = 'none';
    }, { once: true });
};

// ─── 계좌 정보 모달 ────────────────────────────────────────────────────────
window.openBankModal = function (bankName, accountNumber, accountHolder) {
    document.getElementById('bank-modal-name').textContent = bankName;
    document.getElementById('bank-modal-account').textContent = accountNumber;
    document.getElementById('bank-modal-holder').textContent = accountHolder;

    const overlay = document.getElementById('bank-modal-overlay');
    const modal   = document.getElementById('bank-modal');
    overlay.style.display = 'block';
    modal.style.display   = 'block';
    requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        modal.classList.add('is-open');
    });
};

window.closeBankModal = function () {
    const overlay = document.getElementById('bank-modal-overlay');
    const modal   = document.getElementById('bank-modal');
    overlay.classList.remove('is-open');
    modal.classList.remove('is-open');
    modal.addEventListener('transitionend', () => {
        overlay.style.display = 'none';
        modal.style.display   = 'none';
    }, { once: true });
};

// ─── 강사 추가 모달 ──────────────────────────────────────────────────────────────

window.openAddInstructorModal = function () {
    const overlay = document.getElementById('add-instructor-modal-overlay');
    const modal   = document.getElementById('add-instructor-modal');
    const input   = document.getElementById('new-instructor-name');

    input.value = '';
    input.style.borderColor = '';

    // display:block을 한 번에 설정한 뒤 requestAnimationFrame으로 클래스 추가
    // → 브라우저가 레이아웃을 한 번만 계산하고 GPU 전환 애니메이션 실행
    overlay.style.display = 'block';
    modal.style.display   = 'block';
    requestAnimationFrame(() => {
        overlay.classList.add('is-open');
        modal.classList.add('is-open');
        input.focus();
    });
};

window.closeAddInstructorModal = function () {
    const overlay = document.getElementById('add-instructor-modal-overlay');
    const modal   = document.getElementById('add-instructor-modal');

    overlay.classList.remove('is-open');
    modal.classList.remove('is-open');

    // transition이 끝난 후 display:none 처리
    modal.addEventListener('transitionend', () => {
        overlay.style.display = 'none';
        modal.style.display   = 'none';
    }, { once: true });
};

window.confirmAddInstructor = async function () {
    const nameInput = document.getElementById('new-instructor-name');
    const name = nameInput.value.trim();

    if (!name) {
        nameInput.focus();
        nameInput.style.borderColor = '#e74c3c';
        return;
    }
    nameInput.style.borderColor = '';

    // 중복 이름 확인 (로컬 배열로 체크 - 네트워크 불필요)
    if (registeredInstructors.some(inst => inst.name === name)) {
        alert(`"​${name}"은(는) 이미 등록된 강사입니다.`);
        nameInput.focus();
        return;
    }

    const addBtn = document.querySelector('#add-instructor-modal .btn-modal-save');
    addBtn.disabled = true;
    addBtn.textContent = '추가 중...';

    try {
        // Firestore에 저장
        await saveInstructorProfile(name, { name });

        // ✅ 재조회 없이 로컬 배열과 드롭다운에 직접 추가 (네트워크 왕복 1회 절약)
        const newInstructor = { id: name, name };
        registeredInstructors.push(newInstructor);
        registeredInstructors.sort((a, b) => a.name.localeCompare(b.name, 'ko'));

        const select = document.getElementById('teacherSelect');
        select.innerHTML = '<option value="">강사 선택</option>';
        registeredInstructors.forEach(inst => {
            select.innerHTML += `<option value="${inst.name}">${inst.name}</option>`;
        });

        // 추가한 강사를 자동 선택
        select.value = name;
        await window.onInstructorChange();

        closeAddInstructorModal();
    } catch (e) {
        console.error('강사 추가 실패:', e);
        alert('⚠️ 등록에 실패했습니다. 다시 시도해주세요.');
    } finally {
        addBtn.disabled = false;
        addBtn.textContent = '➕ 추가하기';
    }
};

// ─── 강사 삭제 ─────────────────────────────────────────────────────────────────

window.deleteInstructor = async function () {
    const name = document.getElementById('teacherSelect').value;
    if (!name) {
        alert('삭제할 강사를 먼저 선택해주세요.');
        return;
    }

    const confirmed = confirm(`"​${name}" 강사를 목록에서 삭제하시겠습니까?\n(일정 데이터는 유지됩니다)`);
    if (!confirmed) return;

    const delBtn = document.querySelector('.btn-delete-instructor');
    delBtn.disabled = true;
    delBtn.textContent = '삭제 중...';

    try {
        await dbDeleteInstructor(name);

        // 목록 재로드 후 카드 초기화
        await loadInstructorList();
        document.getElementById('teacherSelect').value = '';
        window.onInstructorChange();

        alert(`✅ "​${name}" 강사가 목록에서 삭제되었습니다.`);
    } catch (e) {
        console.error('강사 삭제 실패:', e);
        alert('⚠️ 삭제에 실패했습니다. 다시 시도해주세요.');
    } finally {
        delBtn.disabled = false;
        delBtn.textContent = '🗑️ 삭제';
    }
};

// ─── 사진 선택 이벤트 ─────────────────────────────────────────────────────────

window.onPhotoSelected = function (input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        // 이미지를 리사이징하여 Base64로 변환 (최대 600x600px, 화면에서는 140px로 표시)
        const img = new Image();
        img.onload = function () {
            const maxSize = 600; // 저장 크기 (px) - 충분한 화질 유지
            let { width, height } = img;
            if (width > maxSize || height > maxSize) {
                const ratio = Math.min(maxSize / width, maxSize / height);
                width  = Math.round(width  * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement('canvas');
            canvas.width  = width;
            canvas.height = height;
            canvas.getContext('2d').drawImage(img, 0, 0, width, height);

            // JPEG 품질 0.88로 저장 (용량 절감 + 충분한 화질)
            pendingPhotoBase64 = canvas.toDataURL('image/jpeg', 0.88);

            // 미리보기 업데이트
            const previewImg = document.getElementById('modal-photo-preview');
            previewImg.src = pendingPhotoBase64;
            previewImg.style.display = 'block';
            document.getElementById('modal-photo-placeholder').style.display = 'none';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.deletePhoto = function () {
    pendingPhotoBase64 = null;
    const previewImg = document.getElementById('modal-photo-preview');
    previewImg.src = '';
    previewImg.style.display = 'none';
    document.getElementById('modal-photo-placeholder').style.display = 'flex';
    document.getElementById('modal-photo-input').value = '';
};

// ─── 프로필 저장 ──────────────────────────────────────────────────────────────

window.saveProfile = async function () {
    const name = document.getElementById('modal-name').value;
    if (!name) return;

    const saveBtn = document.querySelector('.btn-modal-save');
    saveBtn.disabled = true;
    saveBtn.textContent = '저장 중...';

    const profileData = {
        name: name,
        affiliation: document.getElementById('modal-affiliation').value,
        birthDate:  document.getElementById('modal-birth').value,
        hireDate:   document.getElementById('modal-hire').value,
        programs:   document.getElementById('modal-programs').value,
        note:       document.getElementById('modal-note').value,
        bankName:   document.getElementById('modal-bank-name').value,
        accountNumber: document.getElementById('modal-account-number').value,
        accountHolder: document.getElementById('modal-account-holder').value,
        photoBase64: pendingPhotoBase64 || null,
        availability: collectAvailabilityData(),
        availabilityNote: document.getElementById('modal-availability-note')?.value?.trim() || ''
    };

    try {
        await saveInstructorProfile(name, profileData);

        // 카드 즉시 갱신 (DB 재조회 없이 UI 업데이트)
        renderProfileCard(name, profileData);

        closeProfileModal();
        alert('✅ 강사 정보가 저장되었습니다.');
    } catch (e) {
        console.error("프로필 저장 실패:", e);
        alert('⚠️ 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 저장';
    }
};

// ─── 출강 이력 조회 ───────────────────────────────────────────────────────────

window.loadReport = async function () {
    // 조회 전 혹시 저장되지 않은 차시/강사비 데이터가 있다면 즉시 강제 저장
    await window.flushUnsavedData();

    const region = document.getElementById('region-select').value;
    const name   = document.getElementById('teacherSelect').value;
    const start  = document.getElementById('startDate').value;
    const end    = document.getElementById('endDate').value;

    if (!name) { alert("강사를 선택해주세요."); return; }

    const filtered = rawData.filter(r => {
        const rDate = new Date(r['날짜']);
        const isRegionMatch = region === "전체" || String(r['지역구분']) === region;
        const subs = r['보조강사들'] || [];
        const isNameMatch = String(r['주강사']) === name || subs.includes(name);
        const isAfter  = !start || rDate >= new Date(start);
        const isBefore = !end   || rDate <= new Date(end);
        return isNameMatch && isAfter && isBefore && isRegionMatch;
    }).sort((a, b) => new Date(a['날짜']) - new Date(b['날짜']));

    const tbody  = document.getElementById('report-table-body');
    const footer = document.getElementById('report-footer');
    tbody.innerHTML = '';

    let mainTotal = 0;
    let subTotal  = 0;

    filtered.forEach((r, index) => {
        const hours = calculateHours(r['시작시간'], r['종료시간']);
        const role  = String(r['주강사']) === name ? "주강사" : "보조강사";

        if (role === "주강사") mainTotal += parseFloat(hours);
        else                   subTotal  += parseFloat(hours);

        let roundsVal = r['차시'] !== undefined ? r['차시'] : '';
        // 역할에 따라 해당 강사비 필드를 사용 (주강사: 강사비, 보조강사: 보조강사비)
        let feeVal;
        if (role === "주강사") {
            feeVal = r['강사비'] !== undefined ? r['강사비'] : '';
        } else {
            feeVal = r['보조강사비'] !== undefined ? r['보조강사비'] : '';
        }

        const feeStr = feeVal ? parseInt(feeVal, 10).toLocaleString() : '';

        tbody.innerHTML += `
            <tr class="report-row" data-role="${role}" data-id="${r['id']}" data-start="${r['시작시간']}" data-end="${r['종료시간']}">
                <td style="text-align:center;"><input type="checkbox" class="row-checkbox" checked></td>
                <td>${index + 1}</td>
                <td class="date-cell">${formatDate(r['날짜'])}</td>
                <td>${r['지역구분'] || '-'}</td>
                <td>${r['기관명']}</td>
                <td>${r['프로그램명']}</td>
                <td>${role}</td>
                <td class="hour-cell">${hours}</td>
                <td><input type="number" class="lesson-input" value="${roundsVal}" step="0.5" min="0" oninput="calculateAmount(); queueSaveRowData(this)"></td>
                <td><input type="text" class="fee-input" value="${feeStr}" oninput="formatFeeAndCalculate(this); queueSaveRowData(this)"></td>
                <td class="amount-cell" style="text-align:right;">0</td>
            </tr>
        `;
    });

    document.getElementById('main-total-hours').innerText = mainTotal.toFixed(1);
    document.getElementById('sub-total-hours').innerText  = subTotal.toFixed(1);
    document.getElementById('total-hours').innerText      = (mainTotal + subTotal).toFixed(1);
    
    // 초기 금액 합계 0으로 설정
    document.getElementById('main-total-amount').innerText = "0";
    document.getElementById('sub-total-amount').innerText = "0";
    document.getElementById('total-amount').innerText = "0";

    if (filtered.length > 0) {
        footer.style.display = 'table-footer-group';
        window.calculateAmount();
    } else {
        tbody.innerHTML = '<tr><td colspan="11">내역이 없습니다.</td></tr>';
        footer.style.display = 'none';
    }
};

window.toggleAllReportRows = function(checkbox) {
    const checkboxes = document.querySelectorAll('#report-table-body .row-checkbox');
    checkboxes.forEach(cb => cb.checked = checkbox.checked);
};

window.formatFeeAndCalculate = function(input) {
    let value = input.value.replace(/[^\d]/g, '');
    if (value) {
        input.value = parseInt(value, 10).toLocaleString();
    } else {
        input.value = '';
    }
    window.calculateAmount();
};

window.calculateAmount = function () {
    const rows = document.querySelectorAll('#report-table-body .report-row');
    let mainTotalAmount = 0;
    let subTotalAmount = 0;

    rows.forEach(row => {
        const role = row.getAttribute('data-role');
        const lessonInput = row.querySelector('.lesson-input').value;
        const feeInput = row.querySelector('.fee-input').value;
        const amountCell = row.querySelector('.amount-cell');

        const lesson = parseFloat(lessonInput) || 0;
        const fee = parseFloat(feeInput.replace(/,/g, '')) || 0;
        const amount = lesson * fee;

        amountCell.innerText = amount.toLocaleString();

        if (role === "주강사") {
            mainTotalAmount += amount;
        } else {
            subTotalAmount += amount;
        }
    });

    document.getElementById('main-total-amount').innerText = mainTotalAmount.toLocaleString();
    document.getElementById('sub-total-amount').innerText = subTotalAmount.toLocaleString();
    document.getElementById('total-amount').innerText = (mainTotalAmount + subTotalAmount).toLocaleString();
};

// ─── 출강 내역 자동 저장 (Debounce) 및 강제 저장 ────────────────────────────────
const saveTimeouts = new Map();
const pendingSaves = new Map();

window.flushUnsavedData = async function() {
    const promises = [];
    for (const [saveKey, data] of pendingSaves.entries()) {
        const timeout = saveTimeouts.get(saveKey);
        if (timeout) {
            clearTimeout(timeout);
            saveTimeouts.delete(saveKey);
        }
        
        promises.push(executeSave(data.docId, data));
    }
    pendingSaves.clear();
    if (promises.length > 0) {
        await Promise.all(promises);
    }
};

window.queueSaveRowData = function(input) {
    const row = input.closest('tr');
    const docId = row.getAttribute('data-id');
    if (!docId) return;

    const lessonInput = row.querySelector('.lesson-input');
    const feeInput = row.querySelector('.fee-input');
    const role = row.getAttribute('data-role'); // 주강사 or 보조강사

    // 입력 중 상태 시각적 피드백
    lessonInput.classList.remove('saved', 'save-error');
    feeInput.classList.remove('saved', 'save-error');
    lessonInput.classList.add('saving');
    feeInput.classList.add('saving');

    const roundsStr = lessonInput.value;
    const feeStr = feeInput.value;

    const rounds = roundsStr ? parseFloat(roundsStr) : null;
    const feeValue = feeStr ? parseInt(feeStr.replace(/,/g, ''), 10) : null;

    // 같은 docId로 주강사/보조강사가 각각 저장될 수 있으므로 복합 키 사용
    const saveKey = `${docId}__${role}`;
    pendingSaves.set(saveKey, { docId, rounds, feeValue, role, lessonInput, feeInput });

    if (saveTimeouts.has(saveKey)) {
        clearTimeout(saveTimeouts.get(saveKey));
    }

    const timeout = setTimeout(() => {
        saveTimeouts.delete(saveKey);
        const data = pendingSaves.get(saveKey);
        if (data) {
            pendingSaves.delete(saveKey);
            executeSave(data.docId, data);
        }
    }, 800); // 800ms 디바운싱
    
    saveTimeouts.set(saveKey, timeout);
};

async function executeSave(docId, data = null) {
    if (!data) return; // flush에서 넘어온 경우 이미 data를 받음

    try {
        // 역할에 따라 저장할 필드를 분기
        const updatePayload = { rounds: data.rounds };
        if (data.role === '보조강사') {
            updatePayload.subInstructorFee = data.feeValue;
        } else {
            updatePayload.instructorFee = data.feeValue;
        }

        await updateSchedule(docId, updatePayload);

        // 로컬 데이터 동기화
        const target = rawData.find(item => item.id === docId);
        if (target) {
            target['차시'] = data.rounds !== null ? data.rounds : '';
            if (data.role === '보조강사') {
                target['보조강사비'] = data.feeValue !== null ? data.feeValue : '';
            } else {
                target['강사비'] = data.feeValue !== null ? data.feeValue : '';
            }
        }

        if (data.lessonInput) data.lessonInput.classList.replace('saving', 'saved');
        if (data.feeInput) data.feeInput.classList.replace('saving', 'saved');
        
        // 1초 뒤 상태 제거
        setTimeout(() => {
            if (data.lessonInput) data.lessonInput.classList.remove('saved');
            if (data.feeInput) data.feeInput.classList.remove('saved');
        }, 1500);
        
    } catch (e) {
        console.error("차시/강사비 저장 실패:", e);
        if (data.lessonInput) data.lessonInput.classList.replace('saving', 'save-error');
        if (data.feeInput) data.feeInput.classList.replace('saving', 'save-error');
    }
}


// ─── 가용 시간 입력 UI ─────────────────────────────────────────────────────────

/**
 * 모달 내 요일별 가용 시간 입력 UI를 렌더링합니다.
 * @param {Object|null} availability 기존 가용 시간 데이터
 */
window.renderAvailabilityInputUI = function(availability) {
    const grid = document.getElementById('availability-grid');
    if (!grid) return;
    grid.innerHTML = '';

    DAY_CONFIG.forEach(({ key, label }) => {
        const slots = availability?.[key] || [];
        const isEnabled = slots.length > 0;

        const row = document.createElement('div');
        row.className = `avail-day-row ${isEnabled ? '' : 'disabled'}`;
        row.dataset.day = key;

        // 체크박스 + 요일 라벨
        const toggle = document.createElement('div');
        toggle.className = 'avail-day-toggle';
        toggle.innerHTML = `
            <input type="checkbox" id="avail-chk-${key}" ${isEnabled ? 'checked' : ''}
                   onchange="toggleDayAvailability('${key}', this.checked)">
            <label for="avail-chk-${key}">${label}요일</label>
        `;

        // 시간대 슬롯 컨테이너
        const slotsWrap = document.createElement('div');
        slotsWrap.className = 'avail-slots-wrap';
        slotsWrap.id = `avail-slots-${key}`;

        if (isEnabled) {
            slots.forEach((slot, idx) => {
                slotsWrap.appendChild(createSlotRow(key, slot.start, slot.end, idx > 0));
            });
        } else {
            // 비활성 시 기본 1개 빈 슬롯 (숨김 상태)
            slotsWrap.appendChild(createSlotRow(key, '', '', false));
            slotsWrap.style.display = 'none';
        }

        // + 시간대 추가 버튼
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'btn-add-slot';
        addBtn.textContent = '+ 시간대 추가';
        addBtn.onclick = () => addAvailabilitySlot(key);
        if (!isEnabled) addBtn.style.display = 'none';
        addBtn.id = `avail-add-${key}`;

        slotsWrap.appendChild(addBtn);

        row.appendChild(toggle);
        row.appendChild(slotsWrap);
        grid.appendChild(row);
    });
};

/**
 * 시간대 슬롯 행(input 2개 + 삭제 버튼)을 생성합니다.
 */
window.createSlotRow = function(dayKey, startVal, endVal, showRemove) {
    const slotRow = document.createElement('div');
    slotRow.className = 'avail-slot-row';
    slotRow.innerHTML = `
        <input type="text" class="avail-start" value="${startVal}" placeholder="09:00" maxlength="5" oninput="autoColon(this)" inputmode="numeric">
        <span class="avail-slot-separator">~</span>
        <input type="text" class="avail-end" value="${endVal}" placeholder="18:00" maxlength="5" oninput="autoColon(this)" inputmode="numeric">
        ${showRemove ? '<button type="button" class="btn-remove-slot" onclick="removeAvailabilitySlot(this)">✕</button>' : ''}
    `;
    return slotRow;
};

/**
 * 요일 체크박스 토글 시 해당 요일의 슬롯 표시/숨김을 전환합니다.
 */
window.toggleDayAvailability = function (dayKey, isChecked) {
    const row = document.querySelector(`.avail-day-row[data-day="${dayKey}"]`);
    const slotsWrap = document.getElementById(`avail-slots-${dayKey}`);
    const addBtn = document.getElementById(`avail-add-${dayKey}`);

    if (isChecked) {
        row.classList.remove('disabled');
        slotsWrap.style.display = '';
        addBtn.style.display = '';
        // 슬롯이 없으면 기본 1개 추가 (버튼만 남아있는 경우)
        if (slotsWrap.children.length === 1) {
            slotsWrap.insertBefore(createSlotRow(dayKey, '', '', false), addBtn);
        }
    } else {
        row.classList.add('disabled');
        slotsWrap.style.display = 'none';
        addBtn.style.display = 'none';
    }
};

/**
 * 특정 요일에 시간대 슬롯을 추가합니다.
 */
window.addAvailabilitySlot = function (dayKey) {
    const slotsWrap = document.getElementById(`avail-slots-${dayKey}`);
    const addBtn = document.getElementById(`avail-add-${dayKey}`);
    if (!slotsWrap) return;
    slotsWrap.insertBefore(createSlotRow(dayKey, '', '', true), addBtn);
};

/**
 * 시간대 슬롯을 삭제합니다.
 */
window.removeAvailabilitySlot = function (button) {
    const slotRow = button.closest('.avail-slot-row');
    if (slotRow) slotRow.remove();
};

/**
 * 모달에서 요일별 가용 시간 데이터를 수집합니다.
 * @returns {Object} availability 객체
 */
window.collectAvailabilityData = function() {
    const availability = {};

    DAY_CONFIG.forEach(({ key }) => {
        const checkbox = document.getElementById(`avail-chk-${key}`);
        if (!checkbox || !checkbox.checked) {
            availability[key] = [];
            return;
        }

        const slotsWrap = document.getElementById(`avail-slots-${key}`);
        const slotRows = slotsWrap ? slotsWrap.querySelectorAll('.avail-slot-row') : [];
        const slots = [];

        slotRows.forEach(row => {
            const start = row.querySelector('.avail-start')?.value?.trim();
            const end = row.querySelector('.avail-end')?.value?.trim();
            if (start && end) {
                slots.push({ start, end });
            }
        });

        // 체크는 했지만 시간을 입력하지 않은 경우 '종일 불가'로 간주 (00:00~23:59)
        if (slots.length === 0) {
            slots.push({ start: '00:00', end: '23:59' });
        }

        availability[key] = slots;
    });

    return availability;
};

// ─── 지급기준 (Payment Rules) 관련 로직 ───────────────────────────────────────

// 탭 전환 이벤트 설정
document.addEventListener('DOMContentLoaded', () => {
    const paymentTabBtns = document.querySelectorAll('#payment-modal .tab-btn');
    paymentTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            paymentTabBtns.forEach(b => b.classList.remove('active'));
            document.querySelectorAll('#payment-modal .tab-content').forEach(c => c.style.display = 'none');
            
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).style.display = 'block';

            if (targetId === 'tab-payment-apply') {
                renderPaymentApplyTable();
            } else if (targetId === 'tab-payment-rules') {
                renderPaymentRules();
            }
        });
    });
});

window.openPaymentModal = async function() {
    const overlay = document.getElementById('payment-modal-overlay');
    const modal = document.getElementById('payment-modal');
    
    overlay.style.display = 'block';
    modal.style.display = 'flex';
    
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.classList.add('is-open');
            modal.classList.add('is-open');
        });
    });

    // 기본 탭 활성화
    document.querySelector('#payment-modal .tab-btn[data-target="tab-payment-rules"]').click();
    
    // DB 데이터 강제 리로드
    paymentRulesData = await getPaymentRules() || [];
    renderPaymentRules();
};

window.closePaymentModal = function() {
    const overlay = document.getElementById('payment-modal-overlay');
    const modal = document.getElementById('payment-modal');
    
    overlay.classList.remove('is-open');
    modal.classList.remove('is-open');
    
    setTimeout(() => {
        overlay.style.display = 'none';
        modal.style.display = 'none';
    }, 180);
};

window.toggleRuleInput = function() {
    const type = document.getElementById('new-rule-type').value;
    const keywordInput = document.getElementById('new-rule-keyword');
    const schoolLevelInput = document.getElementById('new-rule-schoolLevel');

    if (type === 'schoolLevel') {
        keywordInput.style.display = 'none';
        schoolLevelInput.style.display = 'block';
    } else {
        keywordInput.style.display = 'block';
        schoolLevelInput.style.display = 'none';
    }
};

let editingRuleId = null;

window.editPaymentRuleRow = function(id) {
    editingRuleId = id;
    renderPaymentRules();
};

window.cancelEditPaymentRuleRow = function() {
    editingRuleId = null;
    renderPaymentRules();
};

window.saveEditedPaymentRuleRow = async function(id) {
    const type = document.getElementById(`edit-rule-type-${id}`).value;
    const keyword = type === 'schoolLevel' 
        ? document.getElementById(`edit-rule-schoolLevel-${id}`).value 
        : document.getElementById(`edit-rule-keyword-${id}`).value.trim();
    const minutes = parseInt(document.getElementById(`edit-rule-minutes-${id}`).value, 10);
    const mainFee = parseInt(document.getElementById(`edit-rule-mainfee-${id}`).value, 10);
    const subFee = parseInt(document.getElementById(`edit-rule-subfee-${id}`).value, 10);

    if (!keyword || isNaN(minutes) || isNaN(mainFee) || isNaN(subFee)) {
        alert("모든 필드를 올바르게 입력해주세요.");
        return;
    }

    const updatedRule = {
        id: id,
        ruleType: type,
        keyword: keyword,
        baseMinutes: minutes,
        mainFee: mainFee,
        subFee: subFee
    };

    try {
        await savePaymentRule(updatedRule);
        
        // 로컬 데이터 업데이트
        const index = paymentRulesData.findIndex(r => r.id === id);
        if (index !== -1) {
            paymentRulesData[index] = { ...paymentRulesData[index], ...updatedRule };
        }
        
        editingRuleId = null;
        renderPaymentRules();
    } catch (error) {
        alert("규칙 수정에 실패했습니다.");
    }
};

window.toggleEditRuleInput = function(id) {
    const type = document.getElementById(`edit-rule-type-${id}`).value;
    const keywordInput = document.getElementById(`edit-rule-keyword-${id}`);
    const schoolLevelInput = document.getElementById(`edit-rule-schoolLevel-${id}`);

    if (type === 'schoolLevel') {
        keywordInput.style.display = 'none';
        schoolLevelInput.style.display = 'block';
    } else {
        keywordInput.style.display = 'block';
        schoolLevelInput.style.display = 'none';
    }
};

function renderPaymentRules() {
    const tbody = document.getElementById('payment-rules-tbody');
    tbody.innerHTML = '';

    if (paymentRulesData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#7f8c8d;">등록된 지급기준이 없습니다.</td></tr>';
        return;
    }

    paymentRulesData.forEach(rule => {
        const tr = document.createElement('tr');

        if (rule.id === editingRuleId) {
            const isSchoolLevel = rule.ruleType === 'schoolLevel';
            tr.innerHTML = `
                <td>
                    <select id="edit-rule-type-${rule.id}" onchange="toggleEditRuleInput('${rule.id}')" style="width:100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box;">
                        <option value="keyword" ${!isSchoolLevel ? 'selected' : ''}>키워드 포함</option>
                        <option value="schoolLevel" ${isSchoolLevel ? 'selected' : ''}>학교급 일치</option>
                    </select>
                </td>
                <td>
                    <input type="text" id="edit-rule-keyword-${rule.id}" value="${!isSchoolLevel ? rule.keyword : ''}" style="width:100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; display: ${!isSchoolLevel ? 'block' : 'none'}; box-sizing: border-box;">
                    <select id="edit-rule-schoolLevel-${rule.id}" style="width:100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; display: ${isSchoolLevel ? 'block' : 'none'}; box-sizing: border-box;">
                        <option value="초등학교" ${isSchoolLevel && rule.keyword === '초등학교' ? 'selected' : ''}>초등학교</option>
                        <option value="중학교" ${isSchoolLevel && rule.keyword === '중학교' ? 'selected' : ''}>중학교</option>
                        <option value="고등학교" ${isSchoolLevel && rule.keyword === '고등학교' ? 'selected' : ''}>고등학교</option>
                    </select>
                </td>
                <td><input type="number" id="edit-rule-minutes-${rule.id}" value="${rule.baseMinutes}" style="width:100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box;"></td>
                <td><input type="number" id="edit-rule-mainfee-${rule.id}" value="${rule.mainFee}" style="width:100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box;"></td>
                <td><input type="number" id="edit-rule-subfee-${rule.id}" value="${rule.subFee}" style="width:100%; padding: 6px; border: 1px solid #cbd5e1; border-radius: 4px; box-sizing: border-box;"></td>
                <td style="text-align:center; white-space:nowrap;">
                    <button class="btn-primary btn-sm" onclick="saveEditedPaymentRuleRow('${rule.id}')" style="margin-bottom:4px;">저장</button>
                    <button class="btn-modal-cancel btn-sm" onclick="cancelEditPaymentRuleRow()" style="padding:4px 8px; font-size:0.75rem;">취소</button>
                </td>
            `;
        } else {
            const displayType = rule.ruleType === 'schoolLevel' 
                ? '<span style="color:#0284c7; font-weight:500;">[학교급]</span>' 
                : '<span style="color:#475569; font-weight:500;">[키워드]</span>';

            tr.innerHTML = `
                <td style="text-align:center;">${displayType}</td>
                <td>${rule.keyword}</td>
                <td style="text-align:center;">${rule.baseMinutes}분</td>
                <td style="text-align:right;">${rule.mainFee.toLocaleString()}원</td>
                <td style="text-align:right;">${rule.subFee.toLocaleString()}원</td>
                <td style="text-align:center; white-space:nowrap;">
                    <button class="btn-primary btn-sm" onclick="editPaymentRuleRow('${rule.id}')">수정</button>
                    <button class="btn-danger btn-sm" onclick="deletePaymentRuleRow('${rule.id}')">삭제</button>
                </td>
            `;
        }
        tbody.appendChild(tr);
    });
}

window.addPaymentRule = async function() {
    const ruleType = document.getElementById('new-rule-type').value;
    const keyword = ruleType === 'schoolLevel' 
        ? document.getElementById('new-rule-schoolLevel').value 
        : document.getElementById('new-rule-keyword').value.trim();

    const minutes = parseInt(document.getElementById('new-rule-minutes').value, 10);
    const mainFee = parseInt(document.getElementById('new-rule-mainfee').value, 10);
    const subFee = parseInt(document.getElementById('new-rule-subfee').value, 10);

    if (!keyword || isNaN(minutes) || isNaN(mainFee) || isNaN(subFee)) {
        alert("모든 필드를 올바르게 입력해주세요.");
        return;
    }

    const newRule = {
        ruleType: ruleType,
        keyword: keyword,
        baseMinutes: minutes,
        mainFee: mainFee,
        subFee: subFee,
        order: Date.now() // 임시 정렬값
    };

    try {
        const newId = await savePaymentRule(newRule);
        newRule.id = newId;
        paymentRulesData.push(newRule);
        
        // 입력창 초기화
        document.getElementById('new-rule-keyword').value = '';
        document.getElementById('new-rule-minutes').value = '';
        document.getElementById('new-rule-mainfee').value = '';
        document.getElementById('new-rule-subfee').value = '';
        
        renderPaymentRules();
    } catch (error) {
        alert("규칙 저장에 실패했습니다.");
    }
};

window.deletePaymentRuleRow = async function(id) {
    if (!confirm("이 지급기준을 삭제하시겠습니까?")) return;
    try {
        await deletePaymentRule(id);
        paymentRulesData = paymentRulesData.filter(r => r.id !== id);
        renderPaymentRules();
    } catch (error) {
        alert("삭제에 실패했습니다.");
    }
};

// 현재 화면의 데이터를 그룹핑하여 보여주기
function renderPaymentApplyTable() {
    const tbody = document.getElementById('payment-apply-tbody');
    const tableRows = Array.from(document.getElementById('report-table-body').querySelectorAll('.report-row'));
    
    if (tableRows.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">현재 조회된 수업 내역이 없습니다.</td></tr>';
        return;
    }

    // 그룹화: [기관명 - 프로그램명] -> 대표 소요 시간 추출
    const groups = {};

    tableRows.forEach(row => {
        // 체크박스가 선택된 항목만 그룹화 및 표시 (모달에 띄울 때부터 필터링)
        const checkbox = row.querySelector('.row-checkbox');
        if (!checkbox || !checkbox.checked) return;

        const schoolName = row.children[4].textContent.trim();
        const programName = row.children[5].textContent.trim();
        const startTimeStr = row.getAttribute('data-start');
        const endTimeStr = row.getAttribute('data-end');
        const groupKey = `${schoolName} | ${programName}`;

        if (!groups[groupKey]) {
            // 시간 계산 (분)
            let diffMinutes = 0;
            if (startTimeStr && endTimeStr) {
                const start = startTimeStr.split(':').map(Number);
                const end = endTimeStr.split(':').map(Number);
                if (start.length === 2 && end.length === 2) {
                    diffMinutes = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]);
                }
            }
            
            // 키워드 및 학교급 매칭 로직
            const matchedRules = paymentRulesData.filter(r => {
                let targetName = schoolName;
                const match = schoolName.match(/\(([^)]+)\)/);
                if (match) {
                    targetName = match[1].trim(); // 괄호 안의 이름 추출. 예: "수성미래교육관 (지산초)" -> "지산초"
                }

                if (r.ruleType === 'schoolLevel') {
                    if (r.keyword === '초등학교') {
                        return /(초|초등학교)$/.test(targetName);
                    } else if (r.keyword === '중학교') {
                        return /(중|중학교)$/.test(targetName);
                    } else if (r.keyword === '고등학교') {
                        return /(고|고등학교)$/.test(targetName);
                    }
                    return false;
                } else {
                    return schoolName.includes(r.keyword) || (r.keyword && programName.includes(r.keyword));
                }
            });
            
            groups[groupKey] = {
                schoolName,
                programName,
                duration: diffMinutes > 0 ? diffMinutes : '알 수 없음',
                matchedRules: matchedRules
            };
        }
    });

    tbody.innerHTML = '';
    
    Object.keys(groups).forEach(key => {
        const g = groups[key];
        const tr = document.createElement('tr');
        
        let selectHtml = `<select class="rule-select" data-key="${key}" style="width:100%; padding: 4px;">`;
        if (g.matchedRules.length === 0) {
            selectHtml += `<option value="">매칭된 규칙 없음</option>`;
            // 매칭 안 된 경우 직접 선택할 수 있도록 전체 규칙 추가
            paymentRulesData.forEach(r => {
                selectHtml += `<option value="${r.id}">[수동선택] ${r.keyword} (${r.baseMinutes}분)</option>`;
            });
        } else {
            g.matchedRules.forEach(r => {
                selectHtml += `<option value="${r.id}">${r.keyword} (${r.baseMinutes}분 기준)</option>`;
            });
            // 다른 것도 고를 수 있도록 전체 규칙도 추가
            selectHtml += `<optgroup label="기타 규칙">`;
            paymentRulesData.filter(r => !g.matchedRules.find(mr => mr.id === r.id)).forEach(r => {
                selectHtml += `<option value="${r.id}">${r.keyword} (${r.baseMinutes}분)</option>`;
            });
            selectHtml += `</optgroup>`;
        }
        selectHtml += `</select>`;

        tr.innerHTML = `
            <td>${g.schoolName}</td>
            <td>${g.programName}</td>
            <td style="text-align:center;">${g.duration}분</td>
            <td>${selectHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

// 일괄 차시/강사비 적용 로직
window.applyPaymentRules = async function() {
    await window.flushUnsavedData();

    const applyTbody = document.getElementById('payment-apply-tbody');
    const ruleSelects = Array.from(applyTbody.querySelectorAll('.rule-select'));
    const selectionMap = {}; // "schoolName | programName" -> rule ID

    ruleSelects.forEach(sel => {
        if (sel.value) {
            selectionMap[sel.getAttribute('data-key')] = sel.value;
        }
    });

    if (Object.keys(selectionMap).length === 0) {
        alert("적용할 규칙이 선택되지 않았습니다.");
        return;
    }

    if (!confirm("선택한 지급기준에 따라 차시와 강사비를 일괄 계산하시겠습니까?\n(기존 입력값은 덮어씌워집니다)")) {
        return;
    }

    const tableRows = Array.from(document.getElementById('report-table-body').querySelectorAll('.report-row'));
    let updateCount = 0;

    tableRows.forEach(row => {
        const checkbox = row.querySelector('.row-checkbox');
        if (!checkbox || !checkbox.checked) return;

        const schoolName = row.children[4].textContent.trim();
        const programName = row.children[5].textContent.trim();
        const startTimeStr = row.getAttribute('data-start');
        const endTimeStr = row.getAttribute('data-end');
        const groupKey = `${schoolName} | ${programName}`;

        const selectedRuleId = selectionMap[groupKey];
        if (!selectedRuleId) return;

        const rule = paymentRulesData.find(r => r.id === selectedRuleId);
        if (!rule) return;

        // 소요 시간 계산
        let diffMinutes = 0;
        if (startTimeStr && endTimeStr) {
            const start = startTimeStr.split(':').map(Number);
            const end = endTimeStr.split(':').map(Number);
            if (start.length === 2 && end.length === 2) {
                diffMinutes = (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]);
            }
        }

        if (diffMinutes > 0 && rule.baseMinutes > 0) {
            // 자투리 시간 버림 (Math.floor)
            const rounds = Math.floor(diffMinutes / rule.baseMinutes);
            
            if (rounds > 0) {
                const lessonInput = row.querySelector('.lesson-input');
                const feeInput = row.querySelector('.fee-input');
                
                lessonInput.value = rounds;
                
                // 주강사 여부 확인
                const role = row.getAttribute('data-role');
                const isMain = role === '주강사';
                const feeAmount = isMain ? rule.mainFee : rule.subFee;
                feeInput.value = feeAmount.toLocaleString();
                
                // 임시 저장 큐에 등록
                window.queueSaveRowData(lessonInput);
                window.queueSaveRowData(feeInput);
                updateCount++;
            }
        }
    });

    if (updateCount > 0) {
        window.calculateAmount();
        alert(`총 ${updateCount}건의 데이터에 차시 및 강사비가 적용되었습니다.`);
        closePaymentModal();
    } else {
        alert("조건을 만족하여 업데이트된 내역이 없습니다. (수업 시간이 입력되어 있는지 확인하세요)");
    }
};

// ─── 엑셀 다운로드 (템플릿 기반) ────────────────────────────────────────────────────────
window.downloadExcel = async function() {
    const name = document.getElementById('teacherSelect').value;
    if (!name) {
        alert("강사를 먼저 선택해주세요.");
        return;
    }

    // 테이블에서 데이터 수집 (체크된 항목만)
    const rows = document.querySelectorAll('#report-table-body .report-row');
    const exportData = [];

    rows.forEach((row) => {
        const checkbox = row.querySelector('.row-checkbox');
        // 체크박스가 없거나 해제되어 있으면 제외
        if (!checkbox || !checkbox.checked) return;

        const date = row.querySelector('.date-cell').innerText;
        const school = row.children[4].innerText;
        const program = row.children[5].innerText;
        const role = row.children[6].innerText;
        const lesson = row.querySelector('.lesson-input').value;
        const fee = row.querySelector('.fee-input').value;
        const amount = row.querySelector('.amount-cell').innerText;

        exportData.push([
            date,           // 날짜
            school,         // 기관명
            program,        // 프로그램명
            role,           // 강사 구분
            lesson,         // 차시
            fee,            // 강사비
            amount          // 합계금액
        ]);
    });

    if (exportData.length === 0) {
        alert("다운로드할 내역이 없습니다.");
        return;
    }

    const btn = document.querySelector('.btn-excel');
    if (btn) {
        btn.innerText = '생성 중...';
        btn.disabled = true;
    }

    try {
        // 1. 템플릿 파일 가져오기 (루트 폴더의 template.xlsx 파일 가정)
        const response = await fetch('../template.xlsx');
        
        const workbook = new ExcelJS.Workbook();
        
        if (response.ok) {
            const arrayBuffer = await response.arrayBuffer();
            await workbook.xlsx.load(arrayBuffer);
        } else {
            console.warn("template.xlsx 템플릿 파일을 찾을 수 없어 새 시트로 생성합니다.");
            const worksheet = workbook.addWorksheet('정산내역서');
            worksheet.getCell('B1').value = '급여계산서';
            worksheet.getRow(5).values = [null, '날짜', '기관명', '프로그램명', '강사 구분', '차시', '합계금액'];
        }

        const worksheet = workbook.worksheets[0];

        // F3:G3 병합 셀에 강사명 안전하게 입력
        const nameCell = worksheet.getCell('F3');
        if (nameCell.isMerged) {
            nameCell.master.value = `강사명: ${name}`;
        } else {
            nameCell.value = `강사명: ${name}`;
        }

        // 2. 데이터 맵핑 (내용 입력은 6행부터)
        let startRowIndex = 6;
        
        // 데이터가 24줄(29행까지)을 초과할 경우 30행(합계행) 위에 새로운 행들을 삽입
        if (response.ok && exportData.length > 24) {
            const extraRows = exportData.length - 24;
            
            // 30행 위치에 필요한 만큼 빈 행 삽입 (기존 30행 합계는 아래로 밀려남)
            const emptyRows = Array(extraRows).fill([]);
            worksheet.spliceRows(30, 0, ...emptyRows);

            // 29행(마지막 데이터행)의 스타일(테두리, 폰트 등)을 새로 생긴 행들에 복사
            const styleRow = worksheet.getRow(29);
            for (let i = 0; i < extraRows; i++) {
                const newRow = worksheet.getRow(30 + i);
                newRow.height = 30; // 새로 삽입되는 행의 높이를 30으로 설정
                styleRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    newRow.getCell(colNumber).style = cell.style;
                });
            }

            // 밑으로 밀려난 기존 합계행의 수식을 늘어난 범위에 맞춰 업데이트 (G열)
            const totalRow = worksheet.getRow(30 + extraRows);
            const sumCell = totalRow.getCell(7);
            sumCell.value = { formula: `SUM(G6:G${29 + extraRows})` };
        }

        exportData.forEach((dataRow, idx) => {
            const currentRow = worksheet.getRow(startRowIndex + idx);
            
            // B6 ~ G6 에 데이터 입력 (강사비 제외)
            currentRow.getCell(2).value = dataRow[0]; // B: 날짜
            currentRow.getCell(3).value = dataRow[1]; // C: 기관명
            currentRow.getCell(4).value = dataRow[2]; // D: 프로그램명
            currentRow.getCell(5).value = dataRow[3]; // E: 강사 구분
            currentRow.getCell(6).value = Number(dataRow[4]) || 0; // F: 차시
            currentRow.getCell(7).value = Number(dataRow[6].replace(/,/g, '')) || 0; // G: 합계금액
        });

        // 3. 엑셀 파일 다운로드
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const today = new Date().toISOString().slice(0,10).replace(/-/g,'');
        saveAs(blob, `정산내역서_${today}_${name}.xlsx`);

    } catch (error) {
        console.error("Excel 생성 중 오류 발생:", error);
        alert("엑셀 생성 중 오류가 발생했습니다. 양식 파일(template.xlsx) 존재 여부를 확인해주세요.");
    } finally {
        if (btn) {
            btn.innerText = '엑셀다운';
            btn.disabled = false;
        }
    }
};