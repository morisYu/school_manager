import { 
    getPrograms, 
    addProgram, 
    updateProgram, 
    deleteProgram 
} from './db_service.js';
import { uploadImage, deleteImage } from './storage-service.js';
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
    const name = formName.value.trim();
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
