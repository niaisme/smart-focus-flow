/**
 * Smart Focus Flow - 핵심 스크립트 (최종 고도화 및 최적화 버전)
 * 뽀모도로 타이머, 카테고리, 대시보드, 다크 모드, 실시간 검색, 단축키,
 * JSON 데이터 내보내기/가져오기, 다중 정렬, 드래그 앤 드롭, 키워드 기반 자동 카테고리 분류
 */

// ==========================================
// 1. 상수 및 DOM 요소 선택
// ==========================================
const DEFAULT_FOCUS_SECONDS = 25 * 60; // 25분 (1500초)
const STORAGE_KEY_TODOS = 'smart_focus_flow_todos';
const STORAGE_KEY_SESSIONS = 'smart_focus_flow_completed_sessions';
const STORAGE_KEY_THEME = 'smart_focus_flow_theme';
const STORAGE_KEY_SORT = 'smart_focus_flow_sort';

// 카테고리 설정 메타데이터
const CATEGORIES = {
  work: { label: '업무', emoji: '💼', badgeClass: 'badge-work', order: 1 },
  personal: { label: '개인', emoji: '🌱', badgeClass: 'badge-personal', order: 2 },
  study: { label: '공부', emoji: '📚', badgeClass: 'badge-study', order: 3 }
};

// 키워드 기반 자동 카테고리 분류 사전
const CATEGORY_KEYWORDS = {
  work: [
    '회의', '미팅', '보고', '메일', '프로젝트', '기획', '개발', 
    '코딩', '배포', '결재', '마감', '업무', '이메일', 'jira', 'pr', '커밋'
  ],
  personal: [
    '장보기', '마트', '병원', '운동', '헬스', '청소', '빨래', 
    '약속', '여행', '요리', '쇼핑', '치과', '은행', '산책'
  ],
  study: [
    '공부', '복습', '예습', '시험', '강의', '과제', '독서', 
    '책', '자격증', '알고리즘', '인강', '수업', '영어', '수학'
  ]
};

// 상단 유틸리티 요소
const exportBtn = document.getElementById('exportBtn');
const importTriggerBtn = document.getElementById('importTriggerBtn');
const importFileInput = document.getElementById('importFileInput');
const themeToggleBtn = document.getElementById('themeToggleBtn');
const themeIcon = document.getElementById('themeIcon');
const themeText = document.getElementById('themeText');

// 대시보드 요소
const todayCountEl = document.getElementById('todayCount');
const completedSessionsCountEl = document.getElementById('completedSessionsCount');
const overallProgressText = document.getElementById('overallProgressText');
const overallProgressBar = document.getElementById('overallProgressBar');

const workProgressText = document.getElementById('workProgressText');
const workProgressBar = document.getElementById('workProgressBar');
const personalProgressText = document.getElementById('personalProgressText');
const personalProgressBar = document.getElementById('personalProgressBar');
const studyProgressText = document.getElementById('studyProgressText');
const studyProgressBar = document.getElementById('studyProgressBar');

// 타이머 요소
const timerDisplay = document.getElementById('timerDisplay');
const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const resetBtn = document.getElementById('resetBtn');

// 작업 관리 요소
const remainingBadge = document.getElementById('remainingBadge');
const searchInput = document.getElementById('searchInput');
const searchClearBtn = document.getElementById('searchClearBtn');
const sortSelect = document.getElementById('sortSelect');
const categoryFilters = document.getElementById('categoryFilters');
const categorySelect = document.getElementById('categorySelect');
const todoInput = document.getElementById('todoInput');
const addTodoBtn = document.getElementById('addTodoBtn');
const todoList = document.getElementById('todoList');
const emptyState = document.getElementById('emptyState');
const emptyText = document.getElementById('emptyText');
const clearCompletedBtn = document.getElementById('clearCompletedBtn');

// 모달 요소 (완료 삭제 확인 & 가져오기 백업 확인)
const confirmModal = document.getElementById('confirmModal');
const modalMessage = document.getElementById('modalMessage');
const modalCancelBtn = document.getElementById('modalCancelBtn');
const modalConfirmBtn = document.getElementById('modalConfirmBtn');

const importConfirmModal = document.getElementById('importConfirmModal');
const importModalCancelBtn = document.getElementById('importModalCancelBtn');
const importModalDirectBtn = document.getElementById('importModalDirectBtn');
const importModalBackupBtn = document.getElementById('importModalBackupBtn');

// ==========================================
// 2. 상태 관리 (State)
// ==========================================
let timeLeft = DEFAULT_FOCUS_SECONDS;
let timerId = null;
let isRunning = false;
let todos = [];
let currentFilter = 'all'; // 'all' | 'work' | 'personal' | 'study'
let currentSort = 'created-desc'; // 'created-desc' | 'created-asc' | 'category' | 'uncompleted-first' | 'manual'
let searchQuery = '';
let completedSessions = 0;
let editingTodoId = null;
let activeModal = null; // 현재 열린 모달 ('clear' | 'import' | null)

// 드래그 앤 드롭 상태
let draggedTodoId = null;
let searchDebounceTimer = null;
let pendingImportFile = null;

// ==========================================
// 3. 다크 모드 관리
// ==========================================

function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    themeIcon.textContent = '☀️';
    themeText.textContent = '라이트 모드';
  } else {
    document.body.classList.remove('dark-mode');
    themeIcon.textContent = '🌙';
    themeText.textContent = '다크 모드';
  }
  localStorage.setItem(STORAGE_KEY_THEME, theme);
}

function toggleTheme() {
  const isDark = document.body.classList.contains('dark-mode');
  applyTheme(isDark ? 'light' : 'dark');
}

function initTheme() {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME);
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    applyTheme(prefersDark ? 'dark' : 'light');
  }
}

// ==========================================
// 4. 타이머 기능 로직
// ==========================================

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function updateTimerDisplay() {
  const formatted = formatTime(timeLeft);
  timerDisplay.textContent = formatted;

  if (isRunning) {
    document.title = `(${formatted}) Smart Focus Flow`;
  } else {
    document.title = 'Smart Focus Flow - 집중 작업 관리 앱';
  }
}

function playCompletionSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;

    const audioCtx = new AudioContextClass();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
    osc.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.18); // G5

    gainNode.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.6);

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.6);
  } catch (error) {
    console.warn('알림음 재생 오류:', error);
  }
}

function tick() {
  if (timeLeft > 0) {
    timeLeft -= 1;
    updateTimerDisplay();
  }

  if (timeLeft <= 0) {
    clearInterval(timerId);
    timerId = null;
    isRunning = false;
    updateTimerControls();
    updateTimerDisplay();
    playCompletionSound();

    completedSessions += 1;
    saveSessions();
    updateDashboard();

    setTimeout(() => {
      alert(`🎉 25분 집중 세션이 완료되었습니다!\n(오늘 누적 ${completedSessions}회 완료)\n잠시 휴식을 취해보세요.`);
      resetTimer();
    }, 100);
  }
}

function updateTimerControls() {
  startBtn.disabled = isRunning;
  pauseBtn.disabled = !isRunning;
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  updateTimerControls();
  timerId = setInterval(tick, 1000);
}

function pauseTimer() {
  if (!isRunning) return;
  clearInterval(timerId);
  timerId = null;
  isRunning = false;
  updateTimerControls();
  updateTimerDisplay();
}

function resetTimer() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  }
  isRunning = false;
  timeLeft = DEFAULT_FOCUS_SECONDS;
  updateTimerControls();
  updateTimerDisplay();
}

// ==========================================
// 5. 키워드 분석 & 유틸리티 함수
// ==========================================

/**
 * 입력 텍스트를 실시간 분석하여 매칭되는 카테고리('work'|'personal'|'study'|null) 반환
 * @param {string} text 
 * @returns {string|null}
 */
function detectCategoryFromText(text) {
  if (!text) return null;
  const lower = text.toLowerCase();

  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        return cat;
      }
    }
  }
  return null;
}

/**
 * 셀렉트 요소에 펄스 애니메이션 피드백 적용
 * @param {HTMLElement} selectElement 
 */
function triggerSelectPulse(selectElement) {
  if (!selectElement) return;
  selectElement.classList.remove('auto-selected-pulse');
  // 리플로우 트리거하여 애니메이션 재시작
  void selectElement.offsetWidth;
  selectElement.classList.add('auto-selected-pulse');
}

function formatRelativeTime(isoString) {
  if (!isoString) return '';
  const past = new Date(isoString);
  const now = new Date();
  const diffInSeconds = Math.max(0, Math.floor((now - past) / 1000));

  if (diffInSeconds < 60) return '방금 전';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}분 전`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}시간 전`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) return `${diffInDays}일 전`;

  return past.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ==========================================
// 6. 데이터 영속화 & 대시보드 통계
// ==========================================

function loadTodos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_TODOS);
    const parsed = saved ? JSON.parse(saved) : [];

    todos = parsed.map((item) => ({
      id: item.id || Date.now().toString(),
      text: item.text || '',
      completed: Boolean(item.completed),
      category: item.category && CATEGORIES[item.category] ? item.category : 'work',
      createdAt: item.createdAt || new Date().toISOString()
    }));
  } catch (error) {
    console.error('할 일 목록 불러오기 오류:', error);
    todos = [];
  }
}

function saveTodos() {
  try {
    localStorage.setItem(STORAGE_KEY_TODOS, JSON.stringify(todos));
  } catch (error) {
    console.error('할 일 목록 저장 오류:', error);
  }
  updateDashboard();
}

function loadSessions() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_SESSIONS);
    completedSessions = saved ? parseInt(saved, 10) || 0 : 0;
  } catch (e) {
    completedSessions = 0;
  }
}

function saveSessions() {
  try {
    localStorage.setItem(STORAGE_KEY_SESSIONS, completedSessions.toString());
  } catch (e) {
    console.error('세션 저장 오류:', e);
  }
}

function loadSortOption() {
  const savedSort = localStorage.getItem(STORAGE_KEY_SORT);
  if (savedSort && ['created-desc', 'created-asc', 'category', 'uncompleted-first', 'manual'].includes(savedSort)) {
    currentSort = savedSort;
    sortSelect.value = savedSort;
  }
}

function saveSortOption(sortVal) {
  currentSort = sortVal;
  sortSelect.value = sortVal;
  localStorage.setItem(STORAGE_KEY_SORT, sortVal);
}

function updateDashboard() {
  const total = todos.length;
  let completed = 0;
  let todayCount = 0;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

  const catCounts = {
    work: { total: 0, completed: 0 },
    personal: { total: 0, completed: 0 },
    study: { total: 0, completed: 0 }
  };

  for (let i = 0; i < total; i++) {
    const todo = todos[i];
    if (todo.completed) completed++;

    const createdTime = new Date(todo.createdAt).getTime();
    if (createdTime >= todayStart) todayCount++;

    if (catCounts[todo.category]) {
      catCounts[todo.category].total++;
      if (todo.completed) catCounts[todo.category].completed++;
    }
  }

  const uncompleted = total - completed;
  const overallPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  overallProgressText.textContent = `${completed}/${total} 완료 (${overallPercent}%)`;
  overallProgressBar.style.width = `${overallPercent}%`;

  ['work', 'personal', 'study'].forEach((cat) => {
    const data = catCounts[cat];
    const pct = data.total > 0 ? Math.round((data.completed / data.total) * 100) : 0;
    const textEl = document.getElementById(`${cat}ProgressText`);
    const barEl = document.getElementById(`${cat}ProgressBar`);
    if (textEl && barEl) {
      textEl.textContent = `${data.completed}/${data.total} (${pct}%)`;
      barEl.style.width = `${pct}%`;
    }
  });

  todayCountEl.textContent = todayCount;
  completedSessionsCountEl.textContent = completedSessions;
  remainingBadge.textContent = `남은 작업 ${uncompleted}개`;
  clearCompletedBtn.disabled = completed === 0;
}

// ==========================================
// 7. 정렬 및 필터링 로직
// ==========================================

function getFilteredAndSortedTodos() {
  let list = todos;

  // 1. 카테고리 필터
  if (currentFilter !== 'all') {
    list = list.filter((todo) => todo.category === currentFilter);
  }

  // 2. 실시간 검색어 필터
  if (searchQuery) {
    list = list.filter((todo) => todo.text.toLowerCase().includes(searchQuery));
  }

  // 3. 정렬 옵션 적용
  if (currentSort === 'manual') {
    return list;
  }

  const sorted = [...list];

  switch (currentSort) {
    case 'created-desc':
      sorted.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      break;
    case 'created-asc':
      sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      break;
    case 'category':
      sorted.sort((a, b) => {
        const orderA = CATEGORIES[a.category]?.order || 99;
        const orderB = CATEGORIES[b.category]?.order || 99;
        return orderA - orderB;
      });
      break;
    case 'uncompleted-first':
      sorted.sort((a, b) => Number(a.completed) - Number(b.completed));
      break;
  }

  return sorted;
}

function setCategoryFilter(filter) {
  if (!['all', 'work', 'personal', 'study'].includes(filter)) return;
  currentFilter = filter;

  document.querySelectorAll('.filter-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });

  renderTodos();
}

// ==========================================
// 8. 할 일 목록 렌더링 (DocumentFragment 최적화)
// ==========================================

function renderTodos() {
  const filteredList = getFilteredAndSortedTodos();
  todoList.innerHTML = '';

  if (filteredList.length === 0) {
    emptyState.classList.add('visible');
    if (searchQuery) {
      emptyText.innerHTML = `검색어 "<strong>${escapeHtml(searchQuery)}</strong>"에 일치하는 작업이 없습니다.`;
    } else if (currentFilter !== 'all') {
      const categoryName = CATEGORIES[currentFilter]?.label || '선택한';
      emptyText.innerHTML = `등록된 <strong>${categoryName}</strong> 작업이 없습니다.<br>새로운 작업을 추가해보세요!`;
    } else {
      emptyText.innerHTML = '등록된 작업이 없습니다.<br>새로운 집중 작업을 추가해보세요!';
    }
  } else {
    emptyState.classList.remove('visible');
  }

  const fragment = document.createDocumentFragment();

  filteredList.forEach((todo) => {
    const li = document.createElement('li');
    li.dataset.id = todo.id;
    li.setAttribute('draggable', editingTodoId === todo.id ? 'false' : 'true');

    if (editingTodoId === todo.id) {
      li.className = 'todo-item editing';
      li.innerHTML = `
        <div class="inline-edit-form">
          <input 
            type="text" 
            id="inline-input-${todo.id}" 
            class="inline-edit-input" 
            value="${escapeHtml(todo.text)}"
            maxlength="100"
          >
          <div class="inline-edit-controls">
            <select id="inline-select-${todo.id}" class="inline-edit-category">
              <option value="work" ${todo.category === 'work' ? 'selected' : ''}>💼 업무</option>
              <option value="personal" ${todo.category === 'personal' ? 'selected' : ''}>🌱 개인</option>
              <option value="study" ${todo.category === 'study' ? 'selected' : ''}>📚 공부</option>
            </select>
            <div class="inline-btn-group">
              <button type="button" class="btn btn-xs btn-save" onclick="saveInlineEdit('${todo.id}')">저장</button>
              <button type="button" class="btn btn-xs btn-cancel" onclick="cancelInlineEdit()">취소</button>
            </div>
          </div>
        </div>
      `;

      const inputEl = li.querySelector(`#inline-input-${todo.id}`);
      const selectEl = li.querySelector(`#inline-select-${todo.id}`);

      // 인라인 편집 시에도 키워드 실시간 자동 분류 연동
      inputEl.addEventListener('input', (e) => {
        const detected = detectCategoryFromText(e.target.value);
        if (detected && selectEl && selectEl.value !== detected) {
          selectEl.value = detected;
          triggerSelectPulse(selectEl);
        }
      });

      inputEl.addEventListener('keydown', (e) => {
        if (e.isComposing) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          saveInlineEdit(todo.id);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelInlineEdit();
        }
      });
    } else {
      li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
      const categoryInfo = CATEGORIES[todo.category] || CATEGORIES.work;
      const relativeTime = formatRelativeTime(todo.createdAt);

      li.innerHTML = `
        <span class="drag-handle" title="드래그하여 순서 변경">⋮⋮</span>
        <input 
          type="checkbox" 
          class="todo-checkbox" 
          ${todo.completed ? 'checked' : ''} 
          aria-label="완료 여부 체크"
        >
        <div class="todo-content">
          <div class="todo-text" title="더블클릭하여 수정">${escapeHtml(todo.text)}</div>
          <div class="todo-meta">
            <span class="category-badge ${categoryInfo.badgeClass}">
              ${categoryInfo.emoji} ${categoryInfo.label}
            </span>
            <span class="todo-time" title="${new Date(todo.createdAt).toLocaleString('ko-KR')}">
              ${relativeTime}
            </span>
          </div>
        </div>
        <button type="button" class="todo-delete-btn" title="작업 삭제" aria-label="작업 삭제">✕</button>
      `;

      attachDragEvents(li);
    }

    fragment.appendChild(li);
  });

  todoList.appendChild(fragment);
  updateDashboard();
}

// ==========================================
// 9. 드래그 앤 드롭 수동 정렬
// ==========================================

function attachDragEvents(li) {
  li.addEventListener('dragstart', (e) => {
    draggedTodoId = li.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', draggedTodoId);
    setTimeout(() => {
      li.classList.add('dragging');
    }, 0);
  });

  li.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = li.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;

    if (offsetY < rect.height / 2) {
      li.classList.add('drag-over-top');
      li.classList.remove('drag-over-bottom');
    } else {
      li.classList.add('drag-over-bottom');
      li.classList.remove('drag-over-top');
    }
  });

  li.addEventListener('dragleave', () => {
    li.classList.remove('drag-over-top', 'drag-over-bottom');
  });

  li.addEventListener('drop', (e) => {
    e.preventDefault();
    const targetId = li.dataset.id;
    const isTop = li.classList.contains('drag-over-top');
    li.classList.remove('drag-over-top', 'drag-over-bottom');

    if (!draggedTodoId || draggedTodoId === targetId) return;

    const fromIndex = todos.findIndex((t) => t.id === draggedTodoId);
    let toIndex = todos.findIndex((t) => t.id === targetId);

    if (fromIndex === -1 || toIndex === -1) return;

    const [movedTodo] = todos.splice(fromIndex, 1);
    toIndex = todos.findIndex((t) => t.id === targetId);
    const insertIndex = isTop ? toIndex : toIndex + 1;

    todos.splice(insertIndex, 0, movedTodo);

    saveSortOption('manual');
    saveTodos();
    renderTodos();
  });

  li.addEventListener('dragend', () => {
    draggedTodoId = null;
    document.querySelectorAll('.todo-item').forEach((item) => {
      item.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
    });
  });
}

// ==========================================
// 10. 할 일 추가, 수정, 삭제 인터랙션
// ==========================================

function handleAddTodo() {
  const text = todoInput.value.trim();
  if (!text) {
    todoInput.focus();
    return;
  }

  const selectedCategory = categorySelect.value in CATEGORIES ? categorySelect.value : 'work';

  const newTodo = {
    id: Date.now().toString(),
    text: text,
    category: selectedCategory,
    completed: false,
    createdAt: new Date().toISOString()
  };

  todos.unshift(newTodo);
  saveTodos();
  renderTodos();

  todoInput.value = '';
  todoInput.focus();
}

function startInlineEdit(id) {
  editingTodoId = id;
  renderTodos();

  const editInput = document.getElementById(`inline-input-${id}`);
  if (editInput) {
    editInput.focus();
    editInput.select();
  }
}

function cancelInlineEdit() {
  editingTodoId = null;
  renderTodos();
}

function saveInlineEdit(id) {
  const editInput = document.getElementById(`inline-input-${id}`);
  const editSelect = document.getElementById(`inline-select-${id}`);

  if (!editInput || !editSelect) return;

  const newText = editInput.value.trim();
  const newCategory = editSelect.value in CATEGORIES ? editSelect.value : 'work';

  if (!newText) {
    alert('작업 내용을 비워둘 수 없습니다.');
    editInput.focus();
    return;
  }

  todos = todos.map((todo) => {
    if (todo.id === id) {
      return { ...todo, text: newText, category: newCategory };
    }
    return todo;
  });

  editingTodoId = null;
  saveTodos();
  renderTodos();
}

function toggleTodo(id) {
  todos = todos.map((todo) => {
    if (todo.id === id) {
      return { ...todo, completed: !todo.completed };
    }
    return todo;
  });

  saveTodos();
  renderTodos();
}

function deleteTodoWithAnimation(id, itemElement) {
  if (itemElement) {
    itemElement.classList.add('deleting');
    setTimeout(() => {
      todos = todos.filter((todo) => todo.id !== id);
      saveTodos();
      renderTodos();
    }, 240);
  } else {
    todos = todos.filter((todo) => todo.id !== id);
    saveTodos();
    renderTodos();
  }
}

// ==========================================
// 11. 데이터 내보내기/가져오기 (Export/Import)
// ==========================================

function exportData() {
  const exportPayload = {
    appName: 'Smart Focus Flow',
    version: '1.0',
    exportDate: new Date().toISOString(),
    completedSessions: completedSessions,
    theme: localStorage.getItem(STORAGE_KEY_THEME) || 'light',
    sortOption: currentSort,
    todos: todos
  };

  const jsonStr = JSON.stringify(exportPayload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

  const link = document.createElement('a');
  link.href = url;
  link.download = `smart-focus-flow-backup-${dateStr}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function handleFileSelect(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  pendingImportFile = file;
  importFileInput.value = '';

  if (todos.length > 0) {
    openImportConfirmModal();
  } else {
    executeImport(pendingImportFile);
  }
}

function executeImport(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);

      let importedTodos = [];
      if (Array.isArray(data)) {
        importedTodos = data;
      } else if (data && Array.isArray(data.todos)) {
        importedTodos = data.todos;
        if (typeof data.completedSessions === 'number') {
          completedSessions = data.completedSessions;
          saveSessions();
        }
        if (data.theme) {
          applyTheme(data.theme);
        }
        if (data.sortOption) {
          saveSortOption(data.sortOption);
        }
      } else {
        throw new Error('유효한 Smart Focus Flow JSON 포맷이 아닙니다.');
      }

      todos = importedTodos.map((item) => ({
        id: item.id || Date.now().toString() + Math.random().toString(36).substr(2, 4),
        text: item.text || '',
        completed: Boolean(item.completed),
        category: item.category && CATEGORIES[item.category] ? item.category : 'work',
        createdAt: item.createdAt || new Date().toISOString()
      }));

      saveTodos();
      renderTodos();
      alert(`🎉 성공적으로 데이터를 가져왔습니다!\n총 ${todos.length}개의 작업이 복원되었습니다.`);
    } catch (err) {
      alert(`⚠️ 데이터 가져오기 실패:\n${err.message || '파일 형식이 올바르지 않습니다.'}`);
    } finally {
      pendingImportFile = null;
      closeImportConfirmModal();
    }
  };

  reader.onerror = () => {
    alert('파일을 읽는 도중 오류가 발생했습니다.');
    pendingImportFile = null;
    closeImportConfirmModal();
  };

  reader.readAsText(file, 'UTF-8');
}

// ==========================================
// 12. 커스텀 모달 다이얼로그 관리
// ==========================================

function openClearConfirmModal() {
  const completedCount = todos.filter((todo) => todo.completed).length;
  if (completedCount === 0) return;

  modalMessage.innerHTML = `완료된 작업 <strong>${completedCount}개</strong>를 정말 모두 삭제하시겠습니까?<br>삭제 후에는 복구할 수 없습니다.`;
  confirmModal.classList.add('visible');
  confirmModal.setAttribute('aria-hidden', 'false');
  activeModal = 'clear';
  modalConfirmBtn.focus();
}

function closeClearConfirmModal() {
  confirmModal.classList.remove('visible');
  confirmModal.setAttribute('aria-hidden', 'true');
  if (activeModal === 'clear') activeModal = null;
}

function handleConfirmClearCompleted() {
  todos = todos.filter((todo) => !todo.completed);
  saveTodos();
  renderTodos();
  closeClearConfirmModal();
}

function openImportConfirmModal() {
  importConfirmModal.classList.add('visible');
  importConfirmModal.setAttribute('aria-hidden', 'false');
  activeModal = 'import';
  importModalBackupBtn.focus();
}

function closeImportConfirmModal() {
  importConfirmModal.classList.remove('visible');
  importConfirmModal.setAttribute('aria-hidden', 'true');
  if (activeModal === 'import') activeModal = null;
}

// ==========================================
// 13. 이벤트 리스너 등록
// ==========================================

// 유틸리티 버튼
exportBtn.addEventListener('click', exportData);
importTriggerBtn.addEventListener('click', () => importFileInput.click());
importFileInput.addEventListener('change', handleFileSelect);
themeToggleBtn.addEventListener('click', toggleTheme);

// 타이머
startBtn.addEventListener('click', startTimer);
pauseBtn.addEventListener('click', pauseTimer);
resetBtn.addEventListener('click', resetTimer);

// 할 일 추가
addTodoBtn.addEventListener('click', handleAddTodo);

todoInput.addEventListener('keydown', (e) => {
  if (e.isComposing) return;
  if (e.key === 'Enter') {
    e.preventDefault();
    handleAddTodo();
  }
});

// 키워드 기반 실시간 자동 카테고리 감지
todoInput.addEventListener('input', (e) => {
  const text = e.target.value;
  const detected = detectCategoryFromText(text);
  if (detected && categorySelect.value !== detected) {
    categorySelect.value = detected;
    triggerSelectPulse(categorySelect);
  }
});

// 검색 디바운스 (120ms)
searchInput.addEventListener('input', (e) => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    searchQuery = e.target.value.trim().toLowerCase();
    searchClearBtn.style.display = searchQuery ? 'inline-block' : 'none';
    renderTodos();
  }, 120);
});

searchClearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchQuery = '';
  searchClearBtn.style.display = 'none';
  searchInput.focus();
  renderTodos();
});

// 정렬 셀렉트 변경
sortSelect.addEventListener('change', (e) => {
  saveSortOption(e.target.value);
  renderTodos();
});

// 카테고리 필터
categoryFilters.addEventListener('click', (e) => {
  const filterBtn = e.target.closest('.filter-btn');
  if (!filterBtn) return;
  setCategoryFilter(filterBtn.dataset.filter);
});

// 목록 내 클릭 위임
todoList.addEventListener('click', (e) => {
  const todoItem = e.target.closest('.todo-item');
  if (!todoItem) return;

  const id = todoItem.dataset.id;
  if (e.target.matches('.todo-checkbox')) {
    toggleTodo(id);
    return;
  }
  if (e.target.closest('.todo-delete-btn')) {
    deleteTodoWithAnimation(id, todoItem);
  }
});

// 더블클릭 -> 인라인 수정
todoList.addEventListener('dblclick', (e) => {
  const todoTextEl = e.target.closest('.todo-text');
  if (!todoTextEl) return;
  const todoItem = todoTextEl.closest('.todo-item');
  if (!todoItem) return;

  startInlineEdit(todoItem.dataset.id);
});

// 완료 항목 일괄 정리 모달 이벤트
clearCompletedBtn.addEventListener('click', openClearConfirmModal);
modalCancelBtn.addEventListener('click', closeClearConfirmModal);
modalConfirmBtn.addEventListener('click', handleConfirmClearCompleted);
confirmModal.addEventListener('click', (e) => {
  if (e.target === confirmModal) closeClearConfirmModal();
});

// 가져오기 백업 확인 모달 이벤트
importModalCancelBtn.addEventListener('click', () => {
  pendingImportFile = null;
  closeImportConfirmModal();
});

importModalDirectBtn.addEventListener('click', () => {
  executeImport(pendingImportFile);
});

importModalBackupBtn.addEventListener('click', () => {
  exportData();
  executeImport(pendingImportFile);
});

importConfirmModal.addEventListener('click', (e) => {
  if (e.target === importConfirmModal) {
    pendingImportFile = null;
    closeImportConfirmModal();
  }
});

// 전역 단축키
window.addEventListener('keydown', (e) => {
  // 모달 닫기
  if (activeModal && e.key === 'Escape') {
    e.preventDefault();
    if (activeModal === 'clear') closeClearConfirmModal();
    if (activeModal === 'import') {
      pendingImportFile = null;
      closeImportConfirmModal();
    }
    return;
  }

  // Alt + N: 새 작업 인풋 포커스
  if (e.altKey && (e.key === 'n' || e.key === 'N' || e.code === 'KeyN')) {
    e.preventDefault();
    todoInput.focus();
    return;
  }

  // Alt + 1, 2, 3, 4: 필터 전환
  if (e.altKey && (e.key === '1' || e.code === 'Digit1')) {
    e.preventDefault();
    setCategoryFilter('all');
    return;
  }
  if (e.altKey && (e.key === '2' || e.code === 'Digit2')) {
    e.preventDefault();
    setCategoryFilter('work');
    return;
  }
  if (e.altKey && (e.key === '3' || e.code === 'Digit3')) {
    e.preventDefault();
    setCategoryFilter('personal');
    return;
  }
  if (e.altKey && (e.key === '4' || e.code === 'Digit4')) {
    e.preventDefault();
    setCategoryFilter('study');
    return;
  }
});

// ==========================================
// 14. 초기화
// ==========================================
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  loadSessions();
  loadSortOption();
  loadTodos();
  updateTimerDisplay();
  renderTodos();

  setInterval(() => {
    renderTodos();
  }, 60000);
});
