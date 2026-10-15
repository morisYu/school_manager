import { 
    getPrograms, 
    addProgram, 
    updateProgram, 
    deleteProgram,
    getSchedulesByProgramName,
    getAllSchedules,
    updateSchedule
} from './db_service.js';
import { uploadImage, deleteImage } from './storage-service.js';
import {
    normalizeProgramName,
    auditProgramNameSpaces,
    executeNormalizeProgramNames
} from './db_service.js';
import { printProgramAsPDF } from './program-pdf.js';

// DOM Elements
const programListContainer = document.getElementById('program-list');
const btnNewProgram = document.getElementById('btn-new-program');
const btnSaveProgram = document.getElementById('btn-save-program');
const btnEditProgram = document.getElementById('btn-edit-program');
const btnDeleteProgram = document.getElementById('btn-delete-program');
const btnPrintPdf = document.getElementById('btn-print-pdf');
const detailTitle = document.getElementById('detail-title');
const searchInput = document.getElementById('search-program');
const filterCategory = document.getElementById('filter-category');

// Form Elements
const formId = document.getElementById('program-id');
const formName = document.getElementById('pg-name');
const formCategorySelect = document.getElementById('pg-category-select');
const formCategoryInput = document.getElementById('pg-category-input');
const formStatus = document.getElementById('pg-status');
const formDesc = document.getElementById('pg-desc');
const formInstructors = document.getElementById('pg-instructors');
const formMemo = document.getElementById('pg-memo');
const photoInput = document.getElementById('pg-photo-input');
const photoPreviewList = document.getElementById('pg-photo-preview');

// Materials Elements
const btnAddMaterial = document.getElementById('btn-add-material');
const materialsTbody = document.getElementById('materials-tbody');

// State Variables
let programsData = [];
let currentSelectedId = null;
let quillEditor = null;
let currentPhotos = []; // { file: File, url: string, isExisting: boolean }
let materialsData = []; // [{ id: string, name: string, quantityPerStudent: number, imageUrl: string, note: string, photoFile: File }]
let isEditMode = false;
let classHistoryData = []; // 현재 선택된 프로그램의 수업 내역

// Init
document.addEventListener('DOMContentLoaded', async () => {
    // Quill 에디터 초기화
    quillEditor = new Quill('#quill-editor', {
        theme: 'snow',
        placeholder: '수업 목표, 도구, 도입-전개-마무리 등 세부 내용을 작성해주세요...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                [{ 'color': [] }, { 'background': [] }],
                [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                ['link', 'image', 'video'],
                ['clean']
            ]
        }
    });

    // 탭 UI 이벤트 연결
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // 모든 탭 컨텐츠 숨기기
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            // 모든 탭 버튼 비활성화
            tabBtns.forEach(b => b.classList.remove('active'));
            // 선택된 탭 활성화
            btn.classList.add('active');
            document.getElementById(btn.dataset.tab).classList.add('active');
            
            // 수업 현황 탭 클릭 시 자동 로드
            if (btn.dataset.tab === 'tab-history' && currentSelectedId) {
                loadClassHistory();
            }
        });
    });

    // 이벤트 리스너 연결
    btnNewProgram.addEventListener('click', () => selectProgram(null));
    btnSaveProgram.addEventListener('click', handleSaveProgram);
    btnEditProgram.addEventListener('click', () => setEditMode(true));
    btnDeleteProgram.addEventListener('click', handleDeleteProgram);
    btnPrintPdf.addEventListener('click', handlePrintPDF);
    searchInput.addEventListener('input', renderProgramList);
    filterCategory.addEventListener('change', renderProgramList);
    
    // 카테고리 선택 변경 핸들러
    if (formCategorySelect && formCategoryInput) {
        formCategorySelect.addEventListener('change', () => {
            if (formCategorySelect.value === '__direct__') {
                formCategoryInput.style.display = 'block';
                formCategoryInput.value = '';
                formCategoryInput.focus();
            } else {
                formCategoryInput.style.display = 'none';
            }
        });
    }

    // 교구 추가 버튼
    btnAddMaterial.addEventListener('click', () => addMaterialRow());

    // 예시 사진 업로드 핸들러
    photoInput.addEventListener('change', (e) => {
        if (e.target.files) {
            Array.from(e.target.files).forEach(file => {
                const url = URL.createObjectURL(file);
                currentPhotos.push({ file, url, isExisting: false });
            });
            renderPhotoPreviews();
        }
    });

    // 메인 컨텐츠 표시
    document.body.style.display = 'flex';
    
    // 데이터 로드
    await loadPrograms();
});

// 카테고리 고유 색상 생성 (문자열 해시 기반 HSL)
function getCategoryColor(categoryName) {
    if (!categoryName) return { bg: '#ffffff', border: '#bdc3c7' };
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
        hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash) % 360;
    return {
        bg: `hsl(${hue}, 80%, 96%)`,
        border: `hsl(${hue}, 65%, 55%)`
    };
}

// 카테고리 목록 동적 추출 및 렌더링
function renderCategoryOptions() {
    const categorySet = new Set();
    programsData.forEach(p => {
        if (p.category && p.category.trim() !== '') categorySet.add(p.category.trim());
    });
    // 기본 추천 카테고리
    ['로봇', '코딩', '드론', 'AI', '기타'].forEach(c => categorySet.add(c));
    const categories = Array.from(categorySet).sort();

    // 필터 select 갱신
    const currentFilter = filterCategory.value;
    filterCategory.innerHTML = '<option value="">모든 카테고리</option>';
    categories.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        filterCategory.appendChild(option);
    });
    if (categories.includes(currentFilter)) {
        filterCategory.value = currentFilter;
    }

    // 입력 폼 select 갱신
    if (formCategorySelect) {
        const prevVal = formCategorySelect.value;
        formCategorySelect.innerHTML = '';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            formCategorySelect.appendChild(option);
        });

        // 직접 입력 옵션 추가
        const directOption = document.createElement('option');
        directOption.value = '__direct__';
        directOption.textContent = '✏️ 직접 입력 (새로 추가)';
        formCategorySelect.appendChild(directOption);

        if (prevVal && Array.from(formCategorySelect.options).some(o => o.value === prevVal)) {
            formCategorySelect.value = prevVal;
        }
    }
}

// 데이터 로딩
async function loadPrograms() {
    try {
        programListContainer.innerHTML = '<div class="loading-msg">로딩 중...</div>';
        programsData = await getPrograms();
        
        renderCategoryOptions();
        renderProgramList();
        
        // 첫 번째 프로그램 자동 선택 (있을 경우)
        if (programsData.length > 0 && !currentSelectedId) {
            selectProgram(programsData[0].id);
        } else if (programsData.length === 0) {
            selectProgram(null);
        } else {
            // 기존 선택 유지
            selectProgram(currentSelectedId);
        }
    } catch (error) {
        alert("프로그램 목록을 불러오는데 실패했습니다.");
    }
}

// 목록 렌더링
function renderProgramList() {
    const term = searchInput.value.toLowerCase();
    const cat = filterCategory.value;

    const filtered = programsData.filter(p => {
        const matchName = p.programName.toLowerCase().includes(term);
        const matchCat = cat === "" || p.category === cat;
        return matchName && matchCat;
    }).sort((a, b) => {
        // 1순위: 카테고리 오름차순
        const catA = (a.category || '').localeCompare(b.category || '', 'ko');
        if (catA !== 0) return catA;
        // 2순위: 프로그램명 오름차순
        return (a.programName || '').localeCompare(b.programName || '', 'ko');
    });

    programListContainer.innerHTML = '';
    
    if (filtered.length === 0) {
        programListContainer.innerHTML = '<div style="text-align:center; padding: 20px; color: #7f8c8d;">결과가 없습니다.</div>';
        return;
    }

    filtered.forEach(p => {
        const div = document.createElement('div');
        div.className = `program-card ${p.id === currentSelectedId ? 'selected' : ''}`;
        const colors = getCategoryColor(p.category);
        div.style.backgroundColor = colors.bg;
        div.style.borderLeftColor = colors.border;
        div.onclick = () => selectProgram(p.id);
        
        const grades = p.targetGrades && p.targetGrades.length > 0 ? p.targetGrades.join(', ') : '전체';
        
        div.innerHTML = `
            <div class="card-title">${p.programName}</div>
            <div class="card-meta">
                <span class="status-badge ${p.status}">${p.status}</span>
                <span>${p.category}</span>
                <span>|</span>
                <span>${grades}</span>
            </div>
        `;
        programListContainer.appendChild(div);
    });
}

// 상세 정보 선택
function selectProgram(id) {
    currentSelectedId = id;
    renderProgramList(); // 선택 UI 갱신

    const program = programsData.find(p => p.id === id);

    // 초기화
    currentPhotos = [];
    materialsData = [];
    document.querySelectorAll('#pg-grades input[type="checkbox"]').forEach(cb => cb.checked = false);

    if (program) {
        // 조회 모드 (기본)
        detailTitle.textContent = '프로그램 상세';
        btnDeleteProgram.style.display = 'block';
        btnPrintPdf.style.display = 'block';
        setEditMode(false);

        formId.value = program.id;
        formName.value = program.programName || '';
        
        const categoryVal = program.category || '기타';
        const options = Array.from(formCategorySelect.options).map(opt => opt.value);
        if (options.includes(categoryVal)) {
            formCategorySelect.value = categoryVal;
            formCategoryInput.style.display = 'none';
        } else {
            formCategorySelect.value = '__direct__';
            formCategoryInput.style.display = 'block';
            formCategoryInput.value = categoryVal;
        }

        formStatus.value = program.status || '운영중';
        formDesc.value = program.description || '';
        formInstructors.value = (program.assignableInstructors || []).join(', ');
        formMemo.value = program.memo || '';
        
        // 대상 학년 체크
        if (program.targetGrades) {
            document.querySelectorAll('#pg-grades input[type="checkbox"]').forEach(cb => {
                if (program.targetGrades.includes(cb.value)) cb.checked = true;
            });
        }

        // 에디터
        if (program.educationPlan) {
            quillEditor.clipboard.dangerouslyPasteHTML(program.educationPlan);
        } else {
            quillEditor.setText('');
        }

        // 사진
        if (program.examplePhotos) {
            program.examplePhotos.forEach(url => {
                currentPhotos.push({ file: null, url: url, isExisting: true });
            });
        }

        // 교구
        if (program.materials) {
            materialsData = program.materials.map(m => ({
                id: Math.random().toString(36).substr(2, 9),
                name: m.name,
                quantityPerStudent: m.quantityPerStudent,
                imageUrl: m.imageUrl,
                note: m.note,
                photoFile: null
            }));
        }
    } else {
        // 신규 모드
        detailTitle.textContent = '신규 프로그램 등록';
        btnDeleteProgram.style.display = 'none';
        btnPrintPdf.style.display = 'none';

        formId.value = '';
        formName.value = '';
        formCategorySelect.value = '기타';
        formCategoryInput.style.display = 'none';
        formCategoryInput.value = '';
        formStatus.value = '준비중';
        formDesc.value = '';
        formInstructors.value = '';
        formMemo.value = '';
        quillEditor.setText('');
        
        // 기본 탭으로 이동
        document.querySelector('.tab-btn[data-tab="tab-basic"]').click();
        setEditMode(true);
    }

    renderPhotoPreviews();
    renderMaterialsTable();

    // 수업 현황 탭이 활성화된 상태에서 프로그램을 변경하면 즉시 갱신
    const activeTabBtn = document.querySelector('.tab-btn.active');
    if (activeTabBtn && activeTabBtn.dataset.tab === 'tab-history' && id) {
        loadClassHistory();
    }
}

function setEditMode(mode) {
    isEditMode = mode;
    
    // Toggle Inputs
    const inputs = document.querySelectorAll('#program-form input, #program-form select, #program-form textarea');
    inputs.forEach(el => el.disabled = !mode);
    
    // Toggle Quill Editor
    if (quillEditor) {
        quillEditor.enable(mode);
        const qToolbar = document.querySelector('.ql-toolbar');
        if (qToolbar) qToolbar.style.display = mode ? 'block' : 'none';
    }
    
    // Toggle Action Buttons
    if (mode) {
        btnSaveProgram.style.display = 'inline-block';
        btnEditProgram.style.display = 'none';
        btnAddMaterial.style.display = 'inline-block';
        const photoUploadBtn = document.querySelector('.photo-upload-area .btn-outline');
        if (photoUploadBtn) photoUploadBtn.style.display = 'inline-block';
    } else {
        btnSaveProgram.style.display = 'none';
        btnEditProgram.style.display = 'inline-block';
        btnAddMaterial.style.display = 'none';
        const photoUploadBtn = document.querySelector('.photo-upload-area .btn-outline');
        if (photoUploadBtn) photoUploadBtn.style.display = 'none';
    }
    
    renderPhotoPreviews();
    renderMaterialsTable();
}

// 예시 사진 렌더링
function renderPhotoPreviews() {
    photoPreviewList.innerHTML = '';
    currentPhotos.forEach((photo, index) => {
        const div = document.createElement('div');
        div.className = 'photo-item';
        let removeBtnHtml = isEditMode ? `<button type="button" class="btn-remove-photo" onclick="removePhoto(${index})">&times;</button>` : '';
        div.innerHTML = `
            <img src="${photo.url}" alt="미리보기">
            ${removeBtnHtml}
        `;
        photoPreviewList.appendChild(div);
    });
}

window.removePhoto = function(index) {
    // Note: 실제 Storage 삭제는 저장 시점(수정) 혹은 별도 정책으로 처리
    // 여기서는 UI 배열에서만 제거
    currentPhotos.splice(index, 1);
    renderPhotoPreviews();
}

// 교구/재료 테이블 렌더링
function renderMaterialsTable() {
    materialsTbody.innerHTML = '';
    
    if (materialsData.length === 0) {
        materialsTbody.innerHTML = '<tr class="empty-material-row"><td colspan="5" style="text-align:center; color:#7f8c8d;">등록된 교구/재료가 없습니다. 항목을 추가해주세요.</td></tr>';
        return;
    }

    materialsData.forEach((mat, index) => {
        const tr = document.createElement('tr');
        
        let imgHtml = isEditMode ? `<button type="button" class="btn-outline btn-sm" onclick="document.getElementById('mat-img-${index}').click()">사진 등록</button>` : '<span style="color:#bdc3c7;font-size:0.9em;">사진 없음</span>';
        if (mat.photoFile || mat.imageUrl) {
            const url = mat.photoFile ? URL.createObjectURL(mat.photoFile) : mat.imageUrl;
            imgHtml = `<img src="${url}" class="mat-img-preview" ${isEditMode ? `onclick="document.getElementById('mat-img-${index}').click()"` : ''} title="${isEditMode ? '클릭하여 변경' : ''}">`;
        }

        let actionHtml = isEditMode ? `<button type="button" class="btn-danger btn-sm" onclick="removeMaterial(${index})">삭제</button>` : '';

        tr.innerHTML = `
            <td><input type="text" value="${mat.name || ''}" onchange="updateMaterial(${index}, 'name', this.value)" placeholder="이름" ${!isEditMode ? 'disabled' : ''}></td>
            <td><input type="number" value="${mat.quantityPerStudent || ''}" onchange="updateMaterial(${index}, 'quantityPerStudent', this.value)" placeholder="수량" ${!isEditMode ? 'disabled' : ''}></td>
            <td style="text-align:center;">
                <input type="file" id="mat-img-${index}" accept="image/*" style="display:none;" onchange="updateMaterialImage(${index}, this)">
                ${imgHtml}
            </td>
            <td><input type="text" value="${mat.note || ''}" onchange="updateMaterial(${index}, 'note', this.value)" placeholder="비고" ${!isEditMode ? 'disabled' : ''}></td>
            <td style="text-align:center;">
                ${actionHtml}
            </td>
        `;
        materialsTbody.appendChild(tr);
    });
}

function addMaterialRow() {
    materialsData.push({
        id: Math.random().toString(36).substr(2, 9),
        name: '',
        quantityPerStudent: '',
        imageUrl: '',
        note: '',
        photoFile: null
    });
    renderMaterialsTable();
}

window.updateMaterial = function(index, field, value) {
    materialsData[index][field] = value;
}

window.updateMaterialImage = function(index, inputElement) {
    if (inputElement.files && inputElement.files[0]) {
        materialsData[index].photoFile = inputElement.files[0];
        renderMaterialsTable();
    }
}

window.removeMaterial = function(index) {
    materialsData.splice(index, 1);
    renderMaterialsTable();
}

// 프로그램 저장 처리
async function handleSaveProgram() {
    const rawName = formName.value.trim();
    const name = normalizeProgramName(rawName);
    formName.value = name;
    if (!name) {
        alert("프로그램명을 입력해주세요.");
        return;
    }

    const isUpdate = !!formId.value;

    // 프로그램명 중복 검사 (신규 등록이거나, 수정 시 이름이 변경된 경우)
    const isDuplicate = programsData.some(p => p.programName.trim() === name && p.id !== formId.value);
    if (isDuplicate) {
        alert(`❌ "${name}"은(는) 이미 등록된 프로그램명입니다.\n중복된 이름은 사용할 수 없습니다.`);
        return;
    }

    // 카테고리 값 구하기
    let categoryVal = formCategorySelect.value;
    if (categoryVal === '__direct__') {
        categoryVal = formCategoryInput.value.trim();
        if (!categoryVal) {
            alert("새로운 카테고리명을 입력해주세요.");
            return;
        }
    }

    btnSaveProgram.textContent = "저장 중...";
    btnSaveProgram.disabled = true;

    try {
        // 1. 체크된 학년 수집
        const targetGrades = Array.from(document.querySelectorAll('#pg-grades input:checked')).map(cb => cb.value);
        
        // 2. 강사 배열화
        const assignableInstructors = formInstructors.value
            .split(',')
            .map(s => s.trim())
            .filter(s => s.length > 0);

        // 3. 예시 사진 업로드 처리
        const finalPhotoUrls = [];
        for (const photo of currentPhotos) {
            if (photo.isExisting) {
                finalPhotoUrls.push(photo.url); // 기존 URL 유지
            } else if (photo.file) {
                const uploadedUrl = await uploadImage(photo.file, 'programs/photos');
                finalPhotoUrls.push(uploadedUrl);
            }
        }

        // 4. 교구 이미지 업로드 처리
        const finalMaterials = [];
        for (const mat of materialsData) {
            let matUrl = mat.imageUrl;
            if (mat.photoFile) {
                matUrl = await uploadImage(mat.photoFile, 'programs/materials');
            }
            // 빈 항목 방지 (이름이 있는 것만 저장)
            if (mat.name.trim() !== '') {
                finalMaterials.push({
                    name: mat.name,
                    quantityPerStudent: Number(mat.quantityPerStudent) || null,
                    imageUrl: matUrl,
                    note: mat.note
                });
            }
        }

        // 5. DB 저장용 데이터 구성
        const programData = {
            programName: name,
            category: categoryVal,
            targetGrades: targetGrades,
            status: formStatus.value,
            description: formDesc.value,
            examplePhotos: finalPhotoUrls,
            educationPlan: quillEditor.root.innerHTML, // HTML 구조 그대로 저장
            materials: finalMaterials,
            assignableInstructors: assignableInstructors,
            memo: formMemo.value
        };

        // 6. DB 호출
        if (isUpdate) {
            await updateProgram(formId.value, programData);
            alert("프로그램이 수정되었습니다.");
        } else {
            const newId = await addProgram(programData);
            currentSelectedId = newId;
            alert("새 프로그램이 등록되었습니다.");
        }

        await loadPrograms();

    } catch (error) {
        alert("저장 중 오류가 발생했습니다: " + error.message);
    } finally {
        btnSaveProgram.textContent = "💾 저장하기";
        btnSaveProgram.disabled = false;
    }
}

// 프로그램 삭제 처리
async function handleDeleteProgram() {
    if (!formId.value) return;

    if (confirm("정말로 이 프로그램을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없으며, 포함된 이미지도 함께 삭제될 수 있습니다.")) {
        try {
            // (옵션) Storage 이미지 삭제 로직을 추가할 수 있습니다. 
            // 현재는 구조상 데이터만 삭제하고 이미지는 orphan으로 남을 수 있습니다.
            // 엄밀히 하려면 currentPhotos와 materialsData의 imageUrl들을 순회하며 deleteImage를 호출해야 합니다.

            await deleteProgram(formId.value);
            alert("삭제되었습니다.");
            currentSelectedId = null;
            await loadPrograms();
        } catch (error) {
            alert("삭제 중 오류가 발생했습니다.");
        }
    }
}

// PDF 인쇄 처리
function handlePrintPDF() {
    const program = programsData.find(p => p.id === currentSelectedId);
    if (!program) return;
    
    printProgramAsPDF(program);
}

// =========================================================
// 수업 현황 탭 관련 함수
// =========================================================

/**
 * 현재 선택된 프로그램의 수업 내역을 Firestore에서 로드합니다.
 */
async function loadClassHistory() {
    const program = programsData.find(p => p.id === currentSelectedId);
    if (!program) return;

    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px; color:#7f8c8d;">🔄 로딩 중...</td></tr>';

    try {
        classHistoryData = await getSchedulesByProgramName(program.programName);
        renderHistoryStats();
        renderHistoryCharts();
        renderHistoryTable();
        setupHistoryFilters();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#e74c3c;">수업 내역을 불러오는 데 실패했습니다.<br><small>${error.message}</small></td></tr>`;
    }
}

/**
 * 통계 요약 카드를 렌더링합니다.
 */
function renderHistoryStats() {
    const total = classHistoryData.length;

    // 고유 기관 수 (schoolName 또는 기관명 필드)
    const schools = new Set(classHistoryData.map(s => s.schoolName || s['기관명'] || '').filter(Boolean));
    
    // 고유 주강사 수
    const instructors = new Set(classHistoryData.map(s => s.mainInstructor || s['주강사'] || '').filter(Boolean));
    
    // 총 대상 인원 합계 (숫자인 경우만)
    const totalStudents = classHistoryData.reduce((sum, s) => {
        const count = Number(s.targetCount || s['대상인원'] || 0);
        return sum + (isNaN(count) ? 0 : count);
    }, 0);

    document.getElementById('stat-total-count').textContent = total.toLocaleString() + '회';
    document.getElementById('stat-school-count').textContent = schools.size.toLocaleString() + '곳';
    document.getElementById('stat-instructor-count').textContent = instructors.size.toLocaleString() + '명';
    document.getElementById('stat-total-students').textContent = totalStudents > 0 ? totalStudents.toLocaleString() + '명' : '-';
}

/**
 * 기관별/강사별 바 차트를 순수 CSS로 렌더링합니다.
 */
function renderHistoryCharts() {
    // --- 주강사별 수업 횟수 ---
    const instructorCount = {};
    classHistoryData.forEach(s => {
        const inst = (s.mainInstructor || s['주강사'] || '').trim();
        if (inst) instructorCount[inst] = (instructorCount[inst] || 0) + 1;
    });
    renderBarChart('chart-by-instructor', instructorCount, '#3498db');

    // --- 보조강사별 수업 횟수 ---
    // subInstructors: 배열 (신규), subInstructor: 문자열 (구형), 보조강사: 한글 필드명
    const subInstructorCount = {};
    classHistoryData.forEach(s => {
        let subs = [];
        if (Array.isArray(s.subInstructors) && s.subInstructors.length > 0) {
            // 신규 포맷: 배열
            subs = s.subInstructors;
        } else {
            // 구형 포맷: 문자열 (쉼표 구분 가능)
            const raw = s.subInstructor || s['보조강사'] || '';
            subs = String(raw).split(/[,，]/).map(n => n.trim());
        }
        subs
            .filter(n => n && n !== '-' && n !== '없음' && n !== '미정')
            .forEach(sub => {
                subInstructorCount[sub] = (subInstructorCount[sub] || 0) + 1;
            });
    });
    renderBarChart('chart-by-sub-instructor', subInstructorCount, '#e67e22');
}

/**
 * 주어진 컨테이너에 바 차트를 렌더링합니다 (라이브러리 없이 순수 CSS).
 * @param {string} containerId - 렌더링할 요소의 ID
 * @param {Object} dataMap - { label: count } 형태의 데이터
 * @param {string} color - 바 색상
 */
function renderBarChart(containerId, dataMap, color) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const entries = Object.entries(dataMap)
        .sort((a, b) => b[1] - a[1])  // 내림차순 정렬
        .slice(0, 10);  // 상위 10개만 표시

    if (entries.length === 0) {
        container.innerHTML = '<div style="color:#aaa; text-align:center; padding:20px;">데이터 없음</div>';
        return;
    }

    const maxVal = entries[0][1];

    entries.forEach(([label, count]) => {
        const pct = Math.round((count / maxVal) * 100);
        const barWrapper = document.createElement('div');
        barWrapper.className = 'chart-bar-row';
        barWrapper.innerHTML = `
            <div class="chart-bar-label" title="${label}">${label}</div>
            <div class="chart-bar-track">
                <div class="chart-bar-fill" style="width: ${pct}%; background: ${color};">
                    <span class="chart-bar-value">${count}회</span>
                </div>
            </div>
        `;
        container.appendChild(barWrapper);
    });
}

/**
 * 수업 내역 테이블을 렌더링합니다.
 * @param {string} [searchTerm=''] - 검색어
 * @param {string} [yearFilter=''] - 연도 필터
 */
function renderHistoryTable(searchTerm = '', yearFilter = '') {
    const tbody = document.getElementById('history-tbody');
    tbody.innerHTML = '';

    // 보조강사 값을 표시용 문자열로 변환하는 헬퍼
    const getSubText = (s) => {
        if (Array.isArray(s.subInstructors) && s.subInstructors.length > 0) {
            return s.subInstructors.join(', ');
        }
        return s.subInstructor || s['보조강사'] || '';
    };

    const filtered = classHistoryData.filter(s => {
        const date = s.date || s['날짜'] || '';
        const school = s.schoolName || s['기관명'] || '';
        const main = s.mainInstructor || s['주강사'] || '';
        const sub = getSubText(s);

        const matchSearch = !searchTerm ||
            school.includes(searchTerm) ||
            main.includes(searchTerm) ||
            sub.includes(searchTerm);
        
        const matchYear = !yearFilter || date.startsWith(yearFilter);
        
        return matchSearch && matchYear;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#aaa; padding: 20px;">해당하는 수업 내역이 없습니다.</td></tr>';
        return;
    }

    filtered.forEach(s => {
        const tr = document.createElement('tr');
        const date = s.date || s['날짜'] || '-';
        const school = s.schoolName || s['기관명'] || '-';
        const main = s.mainInstructor || s['주강사'] || '-';
        const sub = getSubText(s);
        const grade = s.grade || s['학년'] || '-';
        const target = s.targetCount || s['대상인원'] || '-';

        // 날짜를 한국식으로 포맷 (YYYY-MM-DD -> YYYY년 M월 D일)
        let formattedDate = date;
        if (date && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [y, m, d] = date.split('-');
            formattedDate = `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`;
        }

        const subDisplay = sub && sub !== '-' && sub !== '없음' && sub !== '미정' ? sub : '-';

        tr.innerHTML = `
            <td><span class="history-date-badge">${formattedDate}</span></td>
            <td>${school}</td>
            <td><span class="instructor-badge main">${main}</span></td>
            <td>${subDisplay !== '-' ? `<span class="instructor-badge sub">${subDisplay}</span>` : '-'}</td>
            <td>${grade}</td>
            <td>${target !== '-' && target !== '' ? Number(target).toLocaleString() + '명' : '-'}</td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * 수업 현황 탭의 검색/필터 이벤트를 설정합니다.
 */
function setupHistoryFilters() {
    // 연도 옵션 생성
    const yearSelect = document.getElementById('history-year-filter');
    const years = new Set(classHistoryData.map(s => {
        const date = s.date || s['날짜'] || '';
        return date.substring(0, 4);
    }).filter(y => y));
    
    yearSelect.innerHTML = '<option value="">전체 연도</option>';
    Array.from(years).sort((a, b) => b - a).forEach(year => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.textContent = year + '년';
        yearSelect.appendChild(opt);
    });

    // 이벤트 연결 (기존 리스너 중복 방지를 위해 교체)
    const searchInput = document.getElementById('history-search');
    const newSearch = searchInput.cloneNode(true);
    const newYear = yearSelect.cloneNode(true);
    // 연도 옵션 복사
    yearSelect.parentNode.replaceChild(newYear, yearSelect);
    searchInput.parentNode.replaceChild(newSearch, searchInput);

    // 연도 옵션 재설정 (cloneNode 후)
    newYear.innerHTML = '<option value="">전체 연도</option>';
    Array.from(years).sort((a, b) => b - a).forEach(year => {
        const opt = document.createElement('option');
        opt.value = year;
        opt.textContent = year + '년';
        newYear.appendChild(opt);
    });

    const onFilter = () => {
        renderHistoryTable(newSearch.value.trim(), newYear.value);
    };
    newSearch.addEventListener('input', onFilter);
    newYear.addEventListener('change', onFilter);
}

// =========================================================
// 데이터 클렌징 (미등록 일정 정리) 관련 함수
// =========================================================

const btnCleanseData = document.getElementById('btn-cleanse-data');
const cleanseModal = document.getElementById('cleanse-modal');
const cleanseTbody = document.getElementById('cleanse-tbody');
const btnApplyCleanse = document.getElementById('btn-apply-cleanse');
let mismatchGroups = {};

if (btnCleanseData) {
    btnCleanseData.addEventListener('click', openCleanseModal);
}
if (btnApplyCleanse) {
    btnApplyCleanse.addEventListener('click', applyCleanseData);
}

async function openCleanseModal() {
    cleanseModal.style.display = 'flex';
    cleanseTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; padding:20px;">데이터를 분석 중입니다...</td></tr>';
    
    try {
        const allSchedules = await getAllSchedules();
        const validProgramNames = programsData.map(p => p.programName);
        
        mismatchGroups = {};
        
        allSchedules.forEach(s => {
            const progName = s.programName;
            if (progName && !validProgramNames.includes(progName)) {
                if (!mismatchGroups[progName]) {
                    mismatchGroups[progName] = [];
                }
                mismatchGroups[progName].push(s);
            }
        });
        
        renderCleanseTable();
        
    } catch (error) {
        cleanseTbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:#e74c3c;">오류 발생: ${error.message}</td></tr>`;
    }
}

function renderCleanseTable() {
    cleanseTbody.innerHTML = '';
    const keys = Object.keys(mismatchGroups);
    
    if (keys.length === 0) {
        cleanseTbody.innerHTML = '<tr><td colspan="3" style="text-align:center;color:#27ae60;font-weight:bold;padding:30px;">🎉 미매칭 프로그램명이 없습니다. 완벽합니다!</td></tr>';
        btnApplyCleanse.disabled = true;
        return;
    }
    
    btnApplyCleanse.disabled = false;
    
    let optionsHtml = '<option value="">-- 변경 안함 --</option>';
    const sortedValid = programsData.map(p => p.programName).sort();
    sortedValid.forEach(name => {
        optionsHtml += `<option value="${name}">${name}</option>`;
    });

    keys.forEach(badName => {
        const count = mismatchGroups[badName].length;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="color:#e74c3c; font-weight:bold;">"${badName}"</td>
            <td>${count}건</td>
            <td>
                <select class="cleanse-select" data-badname="${badName}" style="width:100%; padding:8px; border:1px solid #bdc3c7; border-radius:4px;">
                    ${optionsHtml}
                </select>
            </td>
        `;
        cleanseTbody.appendChild(tr);
    });
}

async function applyCleanseData() {
    const selects = document.querySelectorAll('.cleanse-select');
    const updates = [];
    
    selects.forEach(sel => {
        const newName = sel.value;
        if (newName) {
            const badName = sel.dataset.badname;
            const schedulesToUpdate = mismatchGroups[badName];
            schedulesToUpdate.forEach(s => {
                updates.push({ docId: s.id, newProgramName: newName });
            });
        }
    });
    
    if (updates.length === 0) {
        alert("선택된 변경 사항이 없습니다.");
        return;
    }
    
    if (!confirm(`총 ${updates.length}건의 일정을 수정하시겠습니까?`)) {
        return;
    }
    
    btnApplyCleanse.textContent = "적용 중...";
    btnApplyCleanse.disabled = true;
    
    try {
        await Promise.all(updates.map(u => updateSchedule(u.docId, { programName: u.newProgramName })));
        
        alert(`성공적으로 ${updates.length}건이 수정되었습니다.`);
        
        cleanseModal.style.display = 'none';
        
        // 내역 갱신
        const activeTabBtn = document.querySelector('.tab-btn.active');
        if (activeTabBtn && activeTabBtn.dataset.tab === 'tab-history' && currentSelectedId) {
            loadClassHistory();
        }
        
    } catch (error) {
        alert(`일괄 수정 중 오류가 발생했습니다: ${error.message}`);
    } finally {
        btnApplyCleanse.textContent = "💾 일괄 수정 적용";
        btnApplyCleanse.disabled = false;
    }
}


// =========================================================
// 프로그램 명칭 공백 정제 (GALAXY탐사 (과학) -> GALAXY탐사(과학))
// =========================================================
const btnNormalizeSpaces = document.getElementById('btn-normalize-spaces');
const normalizeModal = document.getElementById('normalize-modal');
const normalizeModalBody = document.getElementById('normalize-modal-body');
const btnCloseNormalizeModal = document.getElementById('btn-close-normalize-modal');
const btnCancelNormalize = document.getElementById('btn-cancel-normalize');
const btnExecuteNormalize = document.getElementById('btn-execute-normalize');
const normalizeStatusMsg = document.getElementById('normalize-status-msg');

let currentAuditResult = null;

if (btnNormalizeSpaces) {
    btnNormalizeSpaces.addEventListener('click', openNormalizeModal);
}
if (btnCloseNormalizeModal) {
    btnCloseNormalizeModal.addEventListener('click', () => normalizeModal.style.display = 'none');
}
if (btnCancelNormalize) {
    btnCancelNormalize.addEventListener('click', () => normalizeModal.style.display = 'none');
}
if (btnExecuteNormalize) {
    btnExecuteNormalize.addEventListener('click', handleExecuteNormalize);
}

async function openNormalizeModal() {
    normalizeModal.style.display = 'flex';
    normalizeStatusMsg.textContent = '';
    btnExecuteNormalize.disabled = true;
    normalizeModalBody.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #7f8c8d;">
            <div style="font-size: 2em; margin-bottom: 10px;">🔍</div>
            <div>데이터베이스 전체에서 프로그램명 괄호 앞 공백을 검사 중입니다...</div>
        </div>
    `;

    try {
        currentAuditResult = await auditProgramNameSpaces();
        renderNormalizeModalBody(currentAuditResult);
    } catch (error) {
        normalizeModalBody.innerHTML = `
            <div style="text-align: center; color: #e74c3c; padding: 30px;">
                검사 중 오류가 발생했습니다: ${error.message}
            </div>
        `;
    }
}

function renderNormalizeModalBody(result) {
    if (!result || !result.hasChanges) {
        btnExecuteNormalize.disabled = true;
        normalizeModalBody.innerHTML = `
            <div style="text-align: center; padding: 40px 20px;">
                <div style="font-size: 3em; margin-bottom: 15px;">🎉</div>
                <h3 style="color: #27ae60; margin: 0 0 10px 0; font-size: 1.3em;">모든 명칭이 표준 규격입니다</h3>
                <p style="color: #7f8c8d; margin: 0; line-height: 1.6;">
                    괄호 앞 공백(' <code> ( </code>')이 포함된 프로그램, 수업 일정, 강사 정보가 없습니다.<br>
                    정제할 항목이 발견되지 않았습니다.
                </p>
            </div>
        `;
        return;
    }

    btnExecuteNormalize.disabled = false;

    const duplicateCount = result.programs.filter(p => p.isDuplicate).length;

    let html = `
        <div style="margin-bottom: 18px; color: #34495e; font-size: 0.95em; line-height: 1.5;">
            프로그램명에서 <strong>'(' 앞 공백</strong>(예: <code>GALAXY탐사 (과학)</code>)을 제거하여 <code>GALAXY탐사(과학)</code> 형태로 표준화합니다.
        </div>

        <div style="display: flex; gap: 12px; margin-bottom: 20px;">
            <div style="flex: 1; background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 0.85em; color: #718096; margin-bottom: 4px;">정제 대상 프로그램</div>
                <div style="font-size: 1.3em; font-weight: bold; color: #2d3748;">
                    ${result.programs.length}건
                    ${duplicateCount > 0 ? `<span style="font-size: 0.7em; color: #dd6b20;">(${duplicateCount}건 병합)</span>` : ''}
                </div>
            </div>
            <div style="flex: 1; background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 0.85em; color: #718096; margin-bottom: 4px;">연관 수업 일정</div>
                <div style="font-size: 1.3em; font-weight: bold; color: #2b6cb0;">${result.totalSchedulesCount}건</div>
            </div>
            <div style="flex: 1; background: #f8f9fa; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 0.85em; color: #718096; margin-bottom: 4px;">강사 배정 과목</div>
                <div style="font-size: 1.3em; font-weight: bold; color: #2f855a;">${result.instructors.length}명</div>
            </div>
        </div>
    `;

    // 1. 프로그램 목록 테이블
    if (result.programs.length > 0) {
        html += `
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 8px 0; color: #2d3748; font-size: 1em;">📦 프로그램 목록 변경 내역 (${result.programs.length}건)</h4>
                <div class="table-responsive" style="max-height: 180px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <table class="history-table" style="margin: 0;">
                        <thead>
                            <tr style="background: #f7fafc;">
                                <th>현재 명칭</th>
                                <th>변경(표준) 명칭</th>
                                <th style="width: 150px; text-align: center;">처리 방식</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${result.programs.map(p => `
                                <tr>
                                    <td style="color: #e53e3e; font-weight: 500;">"${p.oldName}"</td>
                                    <td style="color: #3182ce; font-weight: bold;">"${p.newName}"</td>
                                    <td style="text-align: center;">
                                        ${p.isDuplicate 
                                            ? '<span style="background: #feebc8; color: #c05621; padding: 2px 8px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">중복 병합 후 정리</span>' 
                                            : '<span style="background: #e2e8f0; color: #4a5568; padding: 2px 8px; border-radius: 12px; font-size: 0.85em;">단순 명칭 수정</span>'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // 2. 수업 일정 테이블
    if (result.schedules.length > 0) {
        html += `
            <div style="margin-bottom: 20px;">
                <h4 style="margin: 0 0 8px 0; color: #2d3748; font-size: 1em;">📅 수업 일정 일괄 변경 내역 (총 ${result.totalSchedulesCount}건)</h4>
                <div class="table-responsive" style="max-height: 160px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <table class="history-table" style="margin: 0;">
                        <thead>
                            <tr style="background: #f7fafc;">
                                <th>현재 등록된 명칭</th>
                                <th>변경될 명칭</th>
                                <th style="width: 90px; text-align: center;">일정 수</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${result.schedules.map(s => `
                                <tr>
                                    <td style="color: #e53e3e;">"${s.oldName}"</td>
                                    <td style="color: #3182ce; font-weight: bold;">"${s.newName}"</td>
                                    <td style="text-align: center; font-weight: bold;">${s.count}건</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // 3. 강사 프로필 테이블
    if (result.instructors.length > 0) {
        html += `
            <div style="margin-bottom: 15px;">
                <h4 style="margin: 0 0 8px 0; color: #2d3748; font-size: 1em;">👤 강사 프로필 배정 과목 변경 (${result.instructors.length}명)</h4>
                <div class="table-responsive" style="max-height: 140px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 6px;">
                    <table class="history-table" style="margin: 0;">
                        <thead>
                            <tr style="background: #f7fafc;">
                                <th style="width: 100px;">강사명</th>
                                <th>변경 전</th>
                                <th>변경 후</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${result.instructors.map(inst => `
                                <tr>
                                    <td style="font-weight: bold;">${inst.name}</td>
                                    <td style="color: #718096; font-size: 0.9em;">${inst.oldPrograms}</td>
                                    <td style="color: #2b6cb0; font-size: 0.9em; font-weight: 500;">${inst.newPrograms}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    html += `
        <div style="background: #ebf8ff; border-left: 4px solid #3182ce; padding: 12px; border-radius: 4px; font-size: 0.88em; color: #2c5282;">
            💡 <strong>[일괄 정제 실행]</strong>을 클릭하면 프로그램, 수업 일정, 강사 정보의 괄호 앞 공백이 일제히 제거되며, 이미 동일한 이름의 프로그램이 존재하는 경우 계획안 및 재료 데이터를 안전하게 병합한 뒤 정리합니다.
        </div>
    `;

    normalizeModalBody.innerHTML = html;
}

async function handleExecuteNormalize() {
    if (!currentAuditResult || !currentAuditResult.hasChanges) return;

    const progLen = currentAuditResult.programs.length;
    const schedLen = currentAuditResult.totalSchedulesCount;
    const instLen = currentAuditResult.instructors.length;

    const confirmMsg = `총 ${progLen}개의 프로그램, ${schedLen}개의 수업 일정, ${instLen}명의 강사 정보가 일괄 정제됩니다.\n\n정제를 진행하시겠습니까?`;
    if (!confirm(confirmMsg)) return;

    btnExecuteNormalize.disabled = true;
    btnExecuteNormalize.textContent = "정제 실행 중...";
    normalizeStatusMsg.textContent = "작업을 시작합니다...";

    try {
        const stats = await executeNormalizeProgramNames(currentAuditResult, (msg) => {
            normalizeStatusMsg.textContent = msg;
        });

        alert(
            `🎉 프로그램 명칭 공백 정제가 성공적으로 완료되었습니다!\n\n` +
            `• 프로그램: ${stats.updatedProgramsCount}건 수정, ${stats.mergedProgramsCount}건 중복 병합\n` +
            `• 수업 일정: ${stats.updatedSchedulesCount}건 표준화 완료\n` +
            `• 강사 정보: ${stats.updatedInstructorsCount}명 표준화 완료`
        );

        normalizeModal.style.display = 'none';

        // 프로그램 목록 새로고침
        await loadPrograms();

        // 현재 선택된 프로그램이 있었다면 내역도 갱신
        if (currentSelectedId) {
            selectProgram(currentSelectedId);
        }

    } catch (error) {
        alert("일괄 정제 처리 중 오류가 발생했습니다: " + error.message);
        normalizeStatusMsg.textContent = "오류 발생: " + error.message;
    } finally {
        btnExecuteNormalize.disabled = false;
        btnExecuteNormalize.textContent = "💾 일괄 정제 실행";
    }
}
