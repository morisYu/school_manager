/* js/manage-handler.js - Firebase Firestore 버전 */
import { getAllSchedules, getAllInstructors, getInstructorProfile, saveInstructorProfile, deleteInstructor as dbDeleteInstructor, updateSchedule } from './db_service.js';
import { auth } from './firebase_config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

let rawData = [];
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

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
        // 두 컬렉션을 병렬로 동시 조회하여 초기 로딩 시간 단축
        const [firestoreData] = await Promise.all([
            getAllSchedules(),
            loadInstructorList()
        ]);

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
            '강사비': r.instructorFee !== undefined ? r.instructorFee : ''
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
        overlay.classList.add('is-open');
        modal.classList.add('is-open');
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

window.loadReport = function () {
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

        const roundsVal = r['차시'] !== undefined ? r['차시'] : '';
        const feeVal = r['강사비'] !== undefined ? r['강사비'] : '';
        const feeStr = feeVal ? parseInt(feeVal, 10).toLocaleString() : '';

        tbody.innerHTML += `
            <tr class="report-row" data-role="${role}" data-id="${r['id']}">
                <td>${index + 1}</td>
                <td class="date-cell">${formatDate(r['날짜'])}</td>
                <td>${r['지역구분'] || '-'}</td>
                <td>${r['기관명']}</td>
                <td>${r['프로그램명']}</td>
                <td>${role}</td>
                <td class="hour-cell">${hours}</td>
                <td><input type="number" class="lesson-input" value="${roundsVal}" step="0.5" min="0" oninput="calculateAmount()" onblur="saveRowData(this)"></td>
                <td><input type="text" class="fee-input" value="${feeStr}" oninput="formatFeeAndCalculate(this)" onblur="saveRowData(this)"></td>
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
        tbody.innerHTML = '<tr><td colspan="10">내역이 없습니다.</td></tr>';
        footer.style.display = 'none';
    }
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


window.saveRowData = async function(input) {
    const row = input.closest('tr');
    const docId = row.getAttribute('data-id');
    if (!docId) return;

    const lessonInput = row.querySelector('.lesson-input').value;
    const feeInput = row.querySelector('.fee-input').value;

    const rounds = lessonInput ? parseFloat(lessonInput) : null;
    const instructorFee = feeInput ? parseInt(feeInput.replace(/,/g, ''), 10) : null;

    try {
        await updateSchedule(docId, {
            rounds: rounds,
            instructorFee: instructorFee
        });

        // 로컬 rawData 동기화
        const target = rawData.find(item => item.id === docId);
        if (target) {
            target['차시'] = rounds !== null ? rounds : '';
            target['강사비'] = instructorFee !== null ? instructorFee : '';
        }
    } catch (e) {
        console.error("차시/강사비 저장 실패:", e);
    }
};

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