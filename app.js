// ============================================================================
// 华小 GPK Pentadbiran · 商业级 3D 极简日程与统筹系统 (PWA + Google Sheet & Drive)
// ============================================================================

const STORAGE_KEYS = {
  TASKS: 'gpk_tasks_v1',
  CUSTOM_HOLIDAYS: 'gpk_custom_holidays_v1',
  GAS_URL: 'gpk_gas_webapp_url_v1',
  SHEET_URL: 'gpk_google_sheet_url_v1',
  STANDALONE_FILES: 'gpk_standalone_files_v1'
};

const state = {
  currentYear: new Date().getFullYear(),
  currentMonth: new Date().getMonth(),
  selectedDate: formatDateYMD(new Date()),
  categoryFilter: 'all',
  boardStatusFilter: 'active',
  activeTab: 'calendar',
  tasks: [],
  customHolidays: [],
  standaloneFiles: [],
  gasUrl: '',
  sheetUrl: '',
  // 内联1步录入状态
  inlineCategory: 'bidang',
  inlineActionType: 'my_prep',
  // 弹窗状态
  modalAttachments: [],
  modalCategory: 'bidang',
  modalActionType: 'my_prep',
  pendingExcelRows: []
};

document.addEventListener('DOMContentLoaded', () => {
  loadLocalData();
  initDefaultDates();
  renderAll();
  registerServiceWorker();

  // 键盘快捷键：Esc 关闭弹窗，弹窗标题栏回车直接保存
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeTaskModal();
      closeWorksheetImportModal();
    }
  });

  const modalTitleInput = document.getElementById('taskTitleInput');
  modalTitleInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveTaskFromModal();
    }
  });

  if (state.gasUrl) {
    pullFromGoogleSheet(true);
  }
});

function formatDateYMD(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function loadLocalData() {
  try {
    const savedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);
    if (savedTasks) {
      state.tasks = JSON.parse(savedTasks);
    } else {
      state.tasks = JSON.parse(JSON.stringify(SAMPLE_TASKS));
      saveLocalTasks();
    }

    const savedHolidays = localStorage.getItem(STORAGE_KEYS.CUSTOM_HOLIDAYS);
    state.customHolidays = savedHolidays ? JSON.parse(savedHolidays) : [];

    const savedFiles = localStorage.getItem(STORAGE_KEYS.STANDALONE_FILES);
    state.standaloneFiles = savedFiles ? JSON.parse(savedFiles) : [];

    state.gasUrl = localStorage.getItem(STORAGE_KEYS.GAS_URL) || '';
    state.sheetUrl = localStorage.getItem(STORAGE_KEYS.SHEET_URL) || '';

    const gasInput = document.getElementById('gasUrlInput');
    const sheetInput = document.getElementById('googleSheetLinkInput');
    if (gasInput) gasInput.value = state.gasUrl;
    if (sheetInput) sheetInput.value = state.sheetUrl;
    updateSyncStatusUI();
  } catch (err) {
    console.error('读取本机数据失败:', err);
    state.tasks = JSON.parse(JSON.stringify(SAMPLE_TASKS));
  }
}

function saveLocalTasks() {
  localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
}

function saveLocalHolidays() {
  localStorage.setItem(STORAGE_KEYS.CUSTOM_HOLIDAYS, JSON.stringify(state.customHolidays));
}

function saveLocalStandaloneFiles() {
  localStorage.setItem(STORAGE_KEYS.STANDALONE_FILES, JSON.stringify(state.standaloneFiles));
}

function initDefaultDates() {
  const todayStr = formatDateYMD(new Date());
  state.selectedDate = todayStr;
  const startInput = document.getElementById('newHolidayStart');
  const endInput = document.getElementById('newHolidayEnd');
  if (startInput) startInput.value = todayStr;
  if (endInput) endInput.value = todayStr;
}

function renderAll() {
  updateCountsAndBadges();
  renderCalendar();
  renderSelectedDayDetails();
  renderPrepRadar();
  renderBoard();
  renderFilesLibrary();
  renderHolidayManageList();
}

// ==================== 视图切换 (桌面分段胶囊 + 手机底部悬浮 Dock) ====================
function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.tab-view').forEach((el) => el.classList.remove('active'));
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.desktop-segmented-nav .seg-nav-btn, .mobile-glass-dock .dock-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
}

function setCategoryFilter(filter) {
  state.categoryFilter = filter;
  document.querySelectorAll('.filter-pills .f-pill').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });
  renderCalendar();
  renderSelectedDayDetails();
  renderBoard();
}

function filterTaskByCurrentMode(task) {
  if (state.categoryFilter === 'all') return true;
  if (state.categoryFilter === 'delegate') {
    return task.actionType === 'delegate';
  }
  return task.category === state.categoryFilter;
}

function updateCountsAndBadges() {
  const activeTasks = state.tasks.filter((t) => t.status !== 'done');
  const countAll = activeTasks.length;
  const countBidang = activeTasks.filter((t) => t.category === 'bidang').length;
  const countSchool = activeTasks.filter((t) => t.category === 'school').length;
  const countPersonal = activeTasks.filter((t) => t.category === 'personal').length;
  const countDelegate = activeTasks.filter((t) => t.actionType === 'delegate').length;

  setText('count-all', countAll);
  setText('count-bidang', countBidang);
  setText('count-school', countSchool);
  setText('count-personal', countPersonal);
  setText('count-delegate', countDelegate);
  setText('navPendingBadge', countAll);
  setText('deskPendingBadge', countAll);
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ==================== 假期查询引擎 ====================
function getAllHolidays() {
  return [...DEFAULT_HOLIDAYS, ...state.customHolidays];
}

function getHolidaysForDate(dateStr) {
  const all = getAllHolidays();
  return all.filter((h) => {
    const start = h.date;
    const end = h.endDate || h.date;
    return dateStr >= start && dateStr <= end;
  });
}

// ==================== 立体月历核心渲染 ====================
function changeMonth(delta) {
  state.currentMonth += delta;
  if (state.currentMonth < 0) {
    state.currentMonth = 11;
    state.currentYear -= 1;
  } else if (state.currentMonth > 11) {
    state.currentMonth = 0;
    state.currentYear += 1;
  }
  renderCalendar();
}

function goToToday() {
  const now = new Date();
  state.currentYear = now.getFullYear();
  state.currentMonth = now.getMonth();
  state.selectedDate = formatDateYMD(now);
  renderCalendar();
  renderSelectedDayDetails();
}

function selectDate(dateStr) {
  state.selectedDate = dateStr;
  renderCalendar();
  renderSelectedDayDetails();
}

function renderCalendar() {
  const year = state.currentYear;
  const month = state.currentMonth;
  setText('currentMonthLabel', `${year}年 ${month + 1}月`);

  const grid = document.getElementById('calendarGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const todayStr = formatDateYMD(new Date());
  const totalCells = 42;

  for (let i = 0; i < totalCells; i++) {
    let cellYear = year;
    let cellMonth = month;
    let dayNum = 0;
    let isOtherMonth = false;

    if (i < startDayOfWeek) {
      dayNum = prevMonthDays - startDayOfWeek + i + 1;
      cellMonth = month - 1;
      if (cellMonth < 0) {
        cellMonth = 11;
        cellYear = year - 1;
      }
      isOtherMonth = true;
    } else if (i >= startDayOfWeek + daysInMonth) {
      dayNum = i - (startDayOfWeek + daysInMonth) + 1;
      cellMonth = month + 1;
      if (cellMonth > 11) {
        cellMonth = 0;
        cellYear = year + 1;
      }
      isOtherMonth = true;
    } else {
      dayNum = i - startDayOfWeek + 1;
    }

    const dateStr = `${cellYear}-${String(cellMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
    const dayHolidays = getHolidaysForDate(dateStr);
    const dayTasks = state.tasks
      .filter((t) => t.date === dateStr && filterTaskByCurrentMode(t))
      .sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));

    const hasBidang = dayTasks.some((t) => t.category === 'bidang');
    const hasSchool = dayTasks.some((t) => t.category === 'school');
    const hasPersonal = dayTasks.some((t) => t.category === 'personal');

    const cell = document.createElement('div');
    cell.className = 'cal-day';
    if (isOtherMonth) cell.classList.add('other-month');
    if (dateStr === todayStr) cell.classList.add('is-today');
    if (dateStr === state.selectedDate) cell.classList.add('is-selected');

    const hasPublicHoliday = dayHolidays.some((h) => h.type === 'public');
    const hasSchoolHoliday = dayHolidays.some((h) => h.type === 'school' || h.type === 'peristiwa');
    if (hasPublicHoliday) {
      cell.classList.add('is-public-holiday');
    } else if (hasSchoolHoliday) {
      cell.classList.add('is-school-holiday');
    }

    // 顶部同日多色微光条
    let multiBarHtml = '<div class="day-multi-bar">';
    if (hasBidang) multiBarHtml += '<span class="day-multi-segment seg-bidang"></span>';
    if (hasSchool) multiBarHtml += '<span class="day-multi-segment seg-school"></span>';
    if (hasPersonal) multiBarHtml += '<span class="day-multi-segment seg-personal"></span>';
    multiBarHtml += '</div>';

    // 同日多色发光珠
    let dotsHtml = '<div class="cal-day-dots">';
    if (hasBidang) dotsHtml += '<span class="cal-dot dot-bidang"></span>';
    if (hasSchool) dotsHtml += '<span class="cal-dot dot-school"></span>';
    if (hasPersonal) dotsHtml += '<span class="cal-dot dot-personal"></span>';
    dotsHtml += '</div>';

    let holidayHtml = '';
    if (dayHolidays.length > 0) {
      const topHol = dayHolidays[0];
      const holClass = topHol.type === 'public' ? 'public' : (topHol.type === 'peristiwa' ? 'peristiwa' : 'school');
      holidayHtml = `<div class="cal-holiday-tag ${holClass}" title="${escapeHtml(topHol.title)}">${escapeHtml(topHol.title)}</div>`;
    }

    let pillsHtml = '<div class="cal-events-mini">';
    const maxPills = dayHolidays.length > 0 ? 2 : 3;
    const visibleTasks = pickRepresentativeTasksForCell(dayTasks, maxPills);

    visibleTasks.forEach((t) => {
      const doneClass = t.status === 'done' ? 'is-done' : '';
      pillsHtml += `<div class="cal-pill pill-${t.category} ${doneClass}" title="${escapeHtml(t.title)}">${escapeHtml(t.title)}</div>`;
    });

    if (dayTasks.length > visibleTasks.length) {
      pillsHtml += `<div class="cal-more-count">+${dayTasks.length - visibleTasks.length}</div>`;
    }
    pillsHtml += '</div>';

    cell.innerHTML = `
      ${multiBarHtml}
      <div class="cal-day-top">
        <span class="cal-day-num">${dayNum}</span>
        ${dotsHtml}
      </div>
      ${holidayHtml}
      ${pillsHtml}
    `;

    cell.onclick = () => selectDate(dateStr);
    grid.appendChild(cell);
  }
}

function pickRepresentativeTasksForCell(tasks, limit) {
  if (tasks.length <= limit) return tasks;
  const picked = [];
  ['bidang', 'school', 'personal'].forEach((cat) => {
    if (picked.length < limit) {
      const found = tasks.find((t) => t.category === cat && !picked.includes(t));
      if (found) picked.push(found);
    }
  });
  for (const t of tasks) {
    if (picked.length >= limit) break;
    if (!picked.includes(t)) picked.push(t);
  }
  return picked;
}

// ==================== 1步极简内联快速录入 (Things 3 / Fantastical 风格) ====================
function setInlineCategory(cat) {
  state.inlineCategory = cat;
  document.querySelectorAll('.qc-cat-group .qc-cat').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.cat === cat);
  });
}

function toggleInlineRole() {
  state.inlineActionType = state.inlineActionType === 'my_prep' ? 'delegate' : 'my_prep';
  const btn = document.getElementById('inlineRoleToggle');
  const txt = document.getElementById('inlineRoleText');
  const isDel = state.inlineActionType === 'delegate';
  btn?.classList.toggle('is-delegate', isDel);
  if (txt) txt.textContent = isDel ? '👥 交代老师' : '👤 我做';
}

function handleInlineQuickKey(event) {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitInlineQuickTask();
  }
}

function parseQuickText(raw) {
  let text = raw.trim();
  let time = '';
  // 提取开头或中间的 HH:MM 时间，例如 "14:00 课程会议"
  const timeMatch = text.match(/(?:^|\s)(\d{1,2}:\d{2})(?:\s|$)/);
  if (timeMatch) {
    const [hh, mm] = timeMatch[1].split(':');
    if (Number(hh) < 24 && Number(mm) < 60) {
      time = `${hh.padStart(2, '0')}:${mm}`;
      text = text.replace(timeMatch[0], ' ').trim();
    }
  }
  return { title: text, time };
}

function submitInlineQuickTask() {
  const input = document.getElementById('inlineQuickInput');
  const raw = input?.value.trim();
  if (!raw) {
    input?.focus();
    return;
  }

  const { title, time } = parseQuickText(raw);
  const newTask = {
    id: 'task-' + Date.now(),
    title: title || raw,
    date: state.selectedDate,
    time,
    category: state.inlineCategory,
    actionType: state.inlineActionType,
    assignee: '',
    status: 'pending',
    priority: 'normal',
    prepDays: 0,
    notes: '',
    attachments: []
  };

  state.tasks.push(newTask);
  input.value = '';
  saveLocalTasks();
  renderAll();
  showToast('已记入 ' + state.selectedDate);
  syncToGoogleSheetBackground();
}

function openTaskModalWithDraft() {
  const draft = document.getElementById('inlineQuickInput')?.value.trim() || '';
  openTaskModal(null, state.selectedDate, state.inlineCategory, state.inlineActionType);
  if (draft) {
    const { title, time } = parseQuickText(draft);
    document.getElementById('taskTitleInput').value = title;
    if (time) document.getElementById('taskTimeInput').value = time;
    document.getElementById('inlineQuickInput').value = '';
  }
  // 直接展开细节面板，方便用户填时间/备注/传工作表
  const drawer = document.getElementById('modalDetailsDrawer');
  if (drawer && drawer.style.display === 'none') {
    toggleModalDetails();
  }
}

// ==================== 右侧：选中日期详情 ====================
function renderSelectedDayDetails() {
  const dateStr = state.selectedDate;
  const dateObj = new Date(dateStr + 'T00:00:00');
  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const dayName = weekdays[dateObj.getDay()] || '';

  setText('selectedDateBadge', `${dateStr} · ${dayName}`);

  const holidays = getHolidaysForDate(dateStr);
  const dayTasks = state.tasks
    .filter((t) => t.date === dateStr && filterTaskByCurrentMode(t))
    .sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));

  const summaryEl = document.getElementById('selectedDayColorSummary');
  if (summaryEl) {
    const bCount = dayTasks.filter((t) => t.category === 'bidang').length;
    const sCount = dayTasks.filter((t) => t.category === 'school').length;
    const pCount = dayTasks.filter((t) => t.category === 'personal').length;

    let sumHtml = '';
    if (bCount > 0) sumHtml += `<span class="summary-pill bidang"><i class="jewel jewel-bidang"></i>${bCount}</span>`;
    if (sCount > 0) sumHtml += `<span class="summary-pill school"><i class="jewel jewel-school"></i>${sCount}</span>`;
    if (pCount > 0) sumHtml += `<span class="summary-pill personal"><i class="jewel jewel-personal"></i>${pCount}</span>`;
    summaryEl.innerHTML = sumHtml;
  }

  const holEl = document.getElementById('selectedDayHolidays');
  if (holEl) {
    holEl.innerHTML = holidays
      .map((h) => {
        const label = h.type === 'public' ? '公共假期' : (h.type === 'peristiwa' ? '学校特假' : '学校假期');
        return `<div class="holiday-banner ${h.type}">
          <span>${label} · ${escapeHtml(h.title)}</span>
          <small>${h.date}${h.endDate && h.endDate !== h.date ? ' ~ ' + h.endDate : ''}</small>
        </div>`;
      })
      .join('');
  }

  const listEl = document.getElementById('selectedDayTasks');
  if (!listEl) return;

  if (dayTasks.length === 0) {
    listEl.innerHTML = `<div style="text-align:center;padding:24px 10px;color:#94a3b8;font-size:12.5px;">这一天暂无事项，直接在上方输入框记一事吧。</div>`;
    return;
  }

  listEl.innerHTML = dayTasks.map((t) => buildTaskCardHtml(t, false)).join('');
}

function buildTaskCardHtml(t, showDateBadge = true) {
  const catLabelMap = {
    bidang: '我的 Bidang',
    school: '配合/学校',
    personal: '个人'
  };
  const actionLabelMap = {
    my_prep: t.category === 'school' ? '我需配合' : '我需准备',
    delegate: '交代老师',
    event: '行程'
  };

  const attachmentsHtml = (t.attachments || [])
    .map((att) => {
      const href = att.url || att.dataUrl || '#';
      return `<a class="attach-chip" href="${href}" target="_blank" rel="noopener noreferrer" download="${att.dataUrl ? escapeHtml(att.name) : ''}">
        <svg class="ico-xs" viewBox="0 0 24 24"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
        ${escapeHtml(att.name || '附件')}
      </a>`;
    })
    .join('');

  return `
    <div class="task-card cat-${t.category} status-${t.status}">
      <div class="task-card-top">
        <div class="task-check-wrap">
          <input type="checkbox" class="task-checkbox" ${t.status === 'done' ? 'checked' : ''} onchange="toggleTaskDone('${t.id}', this.checked)" />
          <div style="flex:1;" onclick="openTaskModal('${t.id}')">
            <div class="task-title">${t.time ? `<span style="color:#2563eb;font-variant-numeric:tabular-nums;margin-right:5px;">${t.time}</span>` : ''}${escapeHtml(t.title)}</div>
            <div class="task-badges">
              ${showDateBadge ? `<span class="tag tag-action">${t.date}</span>` : ''}
              <span class="tag tag-${t.category}">${catLabelMap[t.category] || '事项'}</span>
              <span class="tag tag-action">${actionLabelMap[t.actionType] || ''}</span>
              ${t.assignee ? `<span class="tag tag-assignee">${escapeHtml(t.assignee)}</span>` : ''}
              ${t.status === 'in_progress' ? `<span class="tag tag-status-in_progress">进行中</span>` : ''}
            </div>
          </div>
        </div>
        <button class="btn-icon-soft" style="width:28px;height:28px;" onclick="openTaskModal('${t.id}')" title="编辑">
          <svg class="ico-xs" viewBox="0 0 24 24"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
        </button>
      </div>
      ${t.notes ? `<div class="task-notes">${escapeHtml(t.notes)}</div>` : ''}
      ${attachmentsHtml ? `<div class="task-attachments">${attachmentsHtml}</div>` : ''}
    </div>
  `;
}

// ==================== 近期筹备雷达 ====================
function renderPrepRadar() {
  const radarEl = document.getElementById('prepRadarList');
  if (!radarEl) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const upcoming = state.tasks
    .filter((t) => t.status !== 'done' && t.date)
    .map((t) => {
      const targetDate = new Date(t.date + 'T00:00:00');
      const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));
      return { ...t, diffDays };
    })
    .filter((t) => {
      const prepWindow = Math.max(Number(t.prepDays) || 2, 5);
      return t.diffDays >= -3 && t.diffDays <= prepWindow;
    })
    .sort((a, b) => a.diffDays - b.diffDays);

  if (upcoming.length === 0) {
    radarEl.innerHTML = `<div style="font-size:12px;color:#94a3b8;">近期无紧迫倒数事项</div>`;
    return;
  }

  radarEl.innerHTML = upcoming
    .slice(0, 5)
    .map((t) => {
      let badge = '';
      if (t.diffDays < 0) badge = `<strong style="color:#e11d48">逾期 ${Math.abs(t.diffDays)} 天</strong>`;
      else if (t.diffDays === 0) badge = `<strong style="color:#e11d48">今天</strong>`;
      else badge = `<strong style="color:#b45309">${t.diffDays} 天后</strong>`;

      const jewelClass = t.category === 'bidang' ? 'jewel-bidang' : (t.category === 'school' ? 'jewel-school' : 'jewel-personal');
      return `<div class="radar-item" onclick="selectDate('${t.date}')">
        <span style="display:flex;align-items:center;gap:7px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          <i class="jewel ${jewelClass}"></i>
          <span style="overflow:hidden;text-overflow:ellipsis;">${escapeHtml(t.title)}</span>
        </span>
        <span style="flex-shrink:0;">${badge}</span>
      </div>`;
    })
    .join('');
}

// ==================== 统筹看板 ====================
function setBoardStatusFilter(status) {
  state.boardStatusFilter = status;
  document.querySelectorAll('.segmented-mini .seg-mini').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
  renderBoard();
}

function renderBoard() {
  const query = (document.getElementById('boardSearchInput')?.value || '').trim().toLowerCase();

  const filtered = state.tasks
    .filter((t) => {
      if (!filterTaskByCurrentMode(t)) return false;
      if (state.boardStatusFilter === 'active' && t.status === 'done') return false;
      if (state.boardStatusFilter === 'done' && t.status !== 'done') return false;
      if (query) {
        const hay = `${t.title} ${t.assignee} ${t.notes} ${t.date}`.toLowerCase();
        if (!hay.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  renderColumnList('col-bidang-my', filtered.filter((t) => t.category === 'bidang' && t.actionType !== 'delegate'), '暂无待准备事项');
  renderColumnList('col-bidang-delegate', filtered.filter((t) => t.category === 'bidang' && t.actionType === 'delegate'), '暂无待老师提交事项');
  renderColumnList('col-school-all', filtered.filter((t) => t.category === 'school'), '暂无配合事项');
  renderColumnList('col-personal-all', filtered.filter((t) => t.category === 'personal'), '暂无个人行程');
}

function renderColumnList(containerId, items, emptyText) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (items.length === 0) {
    el.innerHTML = `<div style="font-size:12px;color:#94a3b8;padding:18px 0;text-align:center;">${emptyText}</div>`;
    return;
  }
  el.innerHTML = items.map((t) => buildTaskCardHtml(t, true)).join('');
}

// ==================== 极简弹窗 + 渐进式展开 ====================
function toggleTemplateBar() {
  const el = document.getElementById('templateDrawer');
  if (el) el.style.display = el.style.display === 'none' ? 'flex' : 'none';
}

function toggleModalDetails(forceOpen = null) {
  const drawer = document.getElementById('modalDetailsDrawer');
  const text = document.getElementById('toggleDetailsText');
  if (!drawer) return;
  const shouldOpen = forceOpen !== null ? forceOpen : drawer.style.display === 'none';
  drawer.style.display = shouldOpen ? 'block' : 'none';
  if (text) text.textContent = shouldOpen ? '收起细节栏' : '补充时间、老师、备注或上传工作表';
}

function openQuickCategoryModal(category, actionType) {
  openTaskModal(null, state.selectedDate, category, actionType);
}

function openTaskModal(taskId = null, defaultDate = null, defaultCat = 'bidang', defaultAct = 'my_prep') {
  const modal = document.getElementById('taskModalOverlay');
  if (!modal) return;

  const deleteBtn = document.getElementById('deleteTaskBtn');
  document.getElementById('templateDrawer').style.display = 'none';

  if (taskId) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    setText('taskModalTitle', '编辑事项');
    document.getElementById('taskIdInput').value = task.id;
    document.getElementById('taskTitleInput').value = task.title || '';
    document.getElementById('taskDateInput').value = task.date || state.selectedDate;
    document.getElementById('taskTimeInput').value = task.time || '';
    document.getElementById('taskPrepDaysInput').value = String(task.prepDays || 0);
    document.getElementById('taskAssigneeInput').value = task.assignee || '';
    document.getElementById('taskStatusInput').value = task.status || 'pending';
    document.getElementById('taskNotesInput').value = task.notes || '';
    state.modalAttachments = JSON.parse(JSON.stringify(task.attachments || []));
    selectModalCategory(task.category || 'bidang');
    selectModalActionType(task.actionType || 'my_prep');
    if (deleteBtn) deleteBtn.style.display = 'inline-block';

    const hasExtra = !!(task.time || task.assignee || task.notes || task.prepDays > 0 || task.status !== 'pending');
    toggleModalDetails(hasExtra);
  } else {
    setText('taskModalTitle', '记一事');
    document.getElementById('taskIdInput').value = '';
    document.getElementById('taskTitleInput').value = '';
    document.getElementById('taskDateInput').value = defaultDate || state.selectedDate;
    document.getElementById('taskTimeInput').value = '';
    document.getElementById('taskPrepDaysInput').value = '0';
    document.getElementById('taskAssigneeInput').value = '';
    document.getElementById('taskStatusInput').value = 'pending';
    document.getElementById('taskNotesInput').value = '';
    state.modalAttachments = [];
    selectModalCategory(defaultCat);
    selectModalActionType(defaultAct);
    if (deleteBtn) deleteBtn.style.display = 'none';
    toggleModalDetails(false);
  }

  renderModalAttachments();
  modal.classList.add('open');
  setTimeout(() => document.getElementById('taskTitleInput')?.focus(), 60);
}

function closeTaskModal() {
  document.getElementById('taskModalOverlay')?.classList.remove('open');
}

function closeModalOnBg(event, overlayId) {
  if (event.target.id === overlayId) {
    document.getElementById(overlayId)?.classList.remove('open');
  }
}

function selectModalCategory(cat) {
  state.modalCategory = cat;
  document.querySelectorAll('#categorySelector .c-pill').forEach((el) => {
    const input = el.querySelector('input');
    const isMatch = input && input.value === cat;
    el.classList.toggle('active', isMatch);
    if (input) input.checked = isMatch;
  });
}

function selectModalActionType(act) {
  state.modalActionType = act;
  document.querySelectorAll('.action-seg-3d .act-seg').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.act === act);
  });

  const assigneeLabel = document.getElementById('assigneeLabel');
  const assigneeInput = document.getElementById('taskAssigneeInput');
  if (act === 'delegate') {
    if (assigneeLabel) assigneeLabel.textContent = '交代哪位老师 / Panitia';
    if (assigneeInput) assigneeInput.placeholder = '例如：全体 Ketua Panitia / 4年级科任';
  } else if (state.modalCategory === 'school') {
    if (assigneeLabel) assigneeLabel.textContent = '配合哪个部门 / 单位';
    if (assigneeInput) assigneeInput.placeholder = '例如：配合 GPK HEM / Koko / 校长';
  } else {
    if (assigneeLabel) assigneeLabel.textContent = '负责对象 (选填)';
    if (assigneeInput) assigneeInput.placeholder = '例如：GPK Pentadbiran';
  }
}

function applyQuickTemplate(tplKey) {
  const templates = {
    kurikulum: {
      cat: 'bidang', act: 'my_prep',
      title: '准备 Mesyuarat Kurikulum 课程会议议程与简报',
      assignee: 'GPK Pentadbiran', prepDays: '3',
      notes: '1. 发 Surat Panggilan\n2. 准备会议 PPT 与分析表\n3. 跟进 Minit Mesyuarat'
    },
    panitia: {
      cat: 'bidang', act: 'delegate',
      title: '各科主任 (Ketua Panitia) 提交科委报告',
      assignee: '全体 Ketua Panitia', prepDays: '2',
      notes: '待收齐：华文、国文、英文、数学、科学。'
    },
    pbd: {
      cat: 'bidang', act: 'delegate',
      title: '跟进科任老师完成 PBD / UASA 分数输入',
      assignee: '全体科任老师', prepDays: '3',
      notes: '检查输入率并汇整 Intervensi 名单。'
    },
    pencerapan: {
      cat: 'bidang', act: 'my_prep',
      title: '教学视察与作业检阅 (Pencerapan PdPc)',
      assignee: 'GPK Pentadbiran', prepDays: '1',
      notes: '准备 Borang Pencerapan SKPM。'
    },
    hem_koko: {
      cat: 'school', act: 'my_prep',
      title: '配合学校活动 / 其他 Bidang (HEM / Koko)',
      assignee: '配合 GPK HEM / Koko', prepDays: '2',
      notes: '协助调动代课表与核对参与老师名单。'
    }
  };

  const tpl = templates[tplKey];
  if (!tpl) return;
  selectModalCategory(tpl.cat);
  selectModalActionType(tpl.act);
  document.getElementById('taskTitleInput').value = tpl.title;
  document.getElementById('taskAssigneeInput').value = tpl.assignee;
  document.getElementById('taskPrepDaysInput').value = tpl.prepDays;
  document.getElementById('taskNotesInput').value = tpl.notes;
  toggleModalDetails(true);
  document.getElementById('templateDrawer').style.display = 'none';
}

function saveTaskFromModal() {
  const rawTitle = document.getElementById('taskTitleInput').value.trim();
  const date = document.getElementById('taskDateInput').value;
  if (!rawTitle || !date) {
    showToast('请填写事项名称与日期');
    return;
  }

  const parsed = parseQuickText(rawTitle);
  const explicitTime = document.getElementById('taskTimeInput').value;
  const id = document.getElementById('taskIdInput').value || 'task-' + Date.now();

  const taskObj = {
    id,
    title: parsed.title || rawTitle,
    date,
    time: explicitTime || parsed.time || '',
    category: state.modalCategory,
    actionType: state.modalActionType,
    assignee: document.getElementById('taskAssigneeInput').value.trim(),
    status: document.getElementById('taskStatusInput').value,
    priority: 'normal',
    prepDays: Number(document.getElementById('taskPrepDaysInput').value) || 0,
    notes: document.getElementById('taskNotesInput').value.trim(),
    attachments: state.modalAttachments
  };

  const existingIndex = state.tasks.findIndex((t) => t.id === id);
  if (existingIndex >= 0) {
    state.tasks[existingIndex] = taskObj;
  } else {
    state.tasks.push(taskObj);
  }

  state.selectedDate = date;
  saveLocalTasks();
  closeTaskModal();
  renderAll();
  showToast('已保存');
  syncToGoogleSheetBackground();
}

function toggleTaskDone(taskId, isChecked) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.status = isChecked ? 'done' : 'pending';
  saveLocalTasks();
  renderAll();
  showToast(isChecked ? '已完成' : '已恢复待处理');
  syncToGoogleSheetBackground();
}

function deleteTaskFromModal() {
  const id = document.getElementById('taskIdInput').value;
  if (!id) return;
  state.tasks = state.tasks.filter((t) => t.id !== id);
  saveLocalTasks();
  closeTaskModal();
  renderAll();
  showToast('已删除');
  syncToGoogleSheetBackground();
}

// ==================== 文件上传 (直存 Google Drive) ====================
function addLinkAttachmentToModal() {
  const nameInput = document.getElementById('attachLinkName');
  const urlInput = document.getElementById('attachLinkUrl');
  const name = nameInput.value.trim() || 'Google Drive 链接';
  const url = urlInput.value.trim();

  if (!url) {
    showToast('请粘贴有效链接');
    return;
  }

  state.modalAttachments.push({ name, url, type: 'link', size: '云端链接' });
  nameInput.value = '';
  urlInput.value = '';
  renderModalAttachments();
}

async function handleTaskModalFileSelect(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  const progressEl = document.getElementById('uploadProgressBar');
  if (progressEl) progressEl.style.display = 'block';

  const taskTitle = document.getElementById('taskTitleInput').value.trim() || 'GPK日程附件';

  for (const file of files) {
    const uploaded = await uploadOrStoreFile(file, taskTitle);
    if (uploaded) state.modalAttachments.push(uploaded);
  }

  if (progressEl) progressEl.style.display = 'none';
  event.target.value = '';
  renderModalAttachments();
}

async function handleStandaloneFileUpload(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  showToast('正在上传处理…');
  for (const file of files) {
    const uploaded = await uploadOrStoreFile(file, '独立文件库');
    if (uploaded) {
      state.standaloneFiles.unshift({
        ...uploaded,
        uploadedAt: formatDateYMD(new Date())
      });
    }
  }
  saveLocalStandaloneFiles();
  event.target.value = '';
  renderFilesLibrary();
  showToast('已存入文件库');
}

function openAddDriveLinkModal() {
  const name = prompt('工作表或文件名称（如：2027 排课总表）：');
  if (!name) return;
  const url = prompt('请粘贴 Google Sheet 或 Google Drive 链接：');
  if (!url) return;

  state.standaloneFiles.unshift({
    name: name.trim(),
    url: url.trim(),
    type: 'link',
    size: 'Drive 链接',
    uploadedAt: formatDateYMD(new Date())
  });
  saveLocalStandaloneFiles();
  renderFilesLibrary();
  showToast('已保存链接');
}

async function uploadOrStoreFile(file, taskTitle) {
  const base64DataUrl = await readFileAsDataURL(file);
  const base64Pure = base64DataUrl.split(',')[1] || '';

  if (state.gasUrl) {
    try {
      const res = await fetch(state.gasUrl, {
        method: 'POST',
        body: JSON.stringify({
          action: 'uploadFile',
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
          base64Data: base64Pure,
          taskTitle: taskTitle
        })
      });
      const data = await res.json();
      if (data && data.status === 'ok' && data.fileUrl) {
        showToast(`已上传至 Google Drive: ${file.name}`);
        return {
          name: file.name,
          url: data.fileUrl,
          fileId: data.fileId,
          type: file.type,
          size: formatBytes(file.size) + ' · Drive'
        };
      }
    } catch (err) {
      console.warn('上传至 Google Drive 失败，转为本机保存:', err);
    }
  }

  return {
    name: file.name,
    dataUrl: file.size <= 3 * 1024 * 1024 ? base64DataUrl : '',
    url: '',
    type: file.type,
    size: formatBytes(file.size) + ' · 本机'
  };
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

function renderModalAttachments() {
  const el = document.getElementById('modalAttachmentsList');
  if (!el) return;
  if (state.modalAttachments.length === 0) {
    el.innerHTML = '';
    return;
  }

  el.innerHTML = state.modalAttachments
    .map((att, idx) => {
      const href = att.url || att.dataUrl || '#';
      return `
        <div class="modal-attach-item">
          <a href="${href}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:#1d4ed8;font-weight:600;">
            ${escapeHtml(att.name)} <small style="color:#64748b;">(${escapeHtml(att.size || '')})</small>
          </a>
          <button type="button" class="btn-icon-soft" style="width:24px;height:24px;" onclick="removeModalAttachment(${idx})">
            <svg class="ico-xs" viewBox="0 0 24 24"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
      `;
    })
    .join('');
}

function removeModalAttachment(idx) {
  state.modalAttachments.splice(idx, 1);
  renderModalAttachments();
}

function renderFilesLibrary() {
  const listEl = document.getElementById('filesLibraryList');
  if (!listEl) return;

  const query = (document.getElementById('fileSearchInput')?.value || '').trim().toLowerCase();
  const combined = [];

  state.tasks.forEach((t) => {
    (t.attachments || []).forEach((att) => {
      combined.push({ ...att, taskTitle: t.title, taskDate: t.date, category: t.category });
    });
  });

  state.standaloneFiles.forEach((f) => {
    combined.push({ ...f, taskTitle: '常用独立工作表', taskDate: f.uploadedAt || '', category: 'bidang' });
  });

  const filtered = combined.filter((item) => {
    if (!query) return true;
    return `${item.name} ${item.taskTitle} ${item.taskDate}`.toLowerCase().includes(query);
  });

  setText('totalFilesCount', `${filtered.length} 个已关联文件`);

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:28px;font-size:13px;">尚无文件，可随时上传工作表或贴入 Google Drive 链接。</div>`;
    return;
  }

  listEl.innerHTML = filtered
    .map((item) => {
      const href = item.url || item.dataUrl || '#';
      const jewelClass = item.category === 'bidang' ? 'jewel-bidang' : (item.category === 'school' ? 'jewel-school' : 'jewel-personal');
      return `
        <div class="file-item-card">
          <div style="min-width:0;flex:1;">
            <div style="font-weight:700;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.name)}</div>
            <div style="font-size:11px;color:#64748b;display:flex;align-items:center;gap:6px;margin-top:2px;">
              <i class="jewel ${jewelClass}"></i>
              <span>${escapeHtml(item.taskTitle)} ${item.taskDate ? `· ${item.taskDate}` : ''} · ${escapeHtml(item.size || '')}</span>
            </div>
          </div>
          <a class="btn-soft-sm" href="${href}" target="_blank" rel="noopener noreferrer" download="${item.dataUrl ? escapeHtml(item.name) : ''}" style="text-decoration:none;">
            打开
          </a>
        </div>
      `;
    })
    .join('');
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ==================== Excel 批量导入导出 ====================
function openWorksheetImportModal() {
  state.pendingExcelRows = [];
  document.getElementById('importPreviewBox').style.display = 'none';
  document.getElementById('confirmImportBtn').disabled = true;
  document.getElementById('importModalOverlay')?.classList.add('open');
}

function closeWorksheetImportModal() {
  document.getElementById('importModalOverlay')?.classList.remove('open');
}

function handleExcelImportFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      const defaultCat = document.getElementById('importDefaultCategory')?.value || 'bidang';
      const parsed = parseExcelRowsToTasks(jsonRows, defaultCat);

      state.pendingExcelRows = parsed;
      const previewBox = document.getElementById('importPreviewBox');
      const previewList = document.getElementById('importPreviewList');
      setText('importPreviewCount', parsed.length);

      if (parsed.length > 0) {
        previewBox.style.display = 'block';
        document.getElementById('confirmImportBtn').disabled = false;
        previewList.innerHTML = parsed
          .slice(0, 30)
          .map((t) => `<div style="padding:5px 0;border-bottom:1px solid rgba(15,23,42,0.06);">
            <strong>${t.date}</strong> · ${escapeHtml(t.title)}
          </div>`)
          .join('');
      } else {
        showToast('未识别到有效日期与事项，请参考标准模板');
      }
    } catch (err) {
      showToast('读取 Excel 文件失败');
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

function parseExcelRowsToTasks(rows, defaultCat) {
  const result = [];
  rows.forEach((row, idx) => {
    const rawDate = row['日期'] || row['Date'] || row['Tarikh'] || row['date'] || row['tarikh'] || Object.values(row)[0];
    const rawTitle = row['事项'] || row['事项名称'] || row['活动'] || row['Title'] || row['Perkara'] || row['Program'] || row['Aktiviti'] || Object.values(row)[1];
    const rawCat = String(row['分类'] || row['领域'] || row['Category'] || row['Bidang'] || '').toLowerCase();
    const rawAct = String(row['性质'] || row['Action'] || row['Jenis'] || '').toLowerCase();
    const rawAssignee = String(row['负责老师'] || row['负责对象'] || row['Assignee'] || row['Tindakan'] || '');
    const rawNotes = String(row['备注'] || row['Notes'] || row['Catatan'] || '');

    const normalizedDate = normalizeExcelDate(rawDate);
    if (!normalizedDate || !rawTitle) return;

    let category = defaultCat;
    if (rawCat.includes('bidang') || rawCat.includes('kurikulum') || rawCat.includes('pentadbiran') || rawCat.includes('蓝') || rawCat.includes('我的')) {
      category = 'bidang';
    } else if (rawCat.includes('school') || rawCat.includes('sekolah') || rawCat.includes('hem') || rawCat.includes('koko') || rawCat.includes('青') || rawCat.includes('配合') || rawCat.includes('学校')) {
      category = 'school';
    } else if (rawCat.includes('personal') || rawCat.includes('peribadi') || rawCat.includes('个人') || rawCat.includes('紫')) {
      category = 'personal';
    }

    let actionType = 'my_prep';
    if (rawAct.includes('老师') || rawAct.includes('guru') || rawAct.includes('panitia') || rawAct.includes('delegate')) {
      actionType = 'delegate';
    } else if (rawAct.includes('活动') || rawAct.includes('event') || rawAct.includes('mesyuarat')) {
      actionType = 'event';
    }

    result.push({
      id: `imp-${Date.now()}-${idx}`,
      title: String(rawTitle).trim(),
      date: normalizedDate,
      time: '',
      category,
      actionType,
      assignee: rawAssignee.trim(),
      status: 'pending',
      priority: 'normal',
      prepDays: 0,
      notes: rawNotes.trim(),
      attachments: []
    });
  });
  return result;
}

function normalizeExcelDate(val) {
  if (!val) return '';
  if (val instanceof Date && !isNaN(val)) return formatDateYMD(val);
  const s = String(val).trim();
  const matchISO = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (matchISO) return `${matchISO[1]}-${matchISO[2].padStart(2, '0')}-${matchISO[3].padStart(2, '0')}`;
  const matchDMY = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (matchDMY) return `${matchDMY[3]}-${matchDMY[2].padStart(2, '0')}-${matchDMY[1].padStart(2, '0')}`;
  return '';
}

function confirmExcelImport() {
  if (state.pendingExcelRows.length === 0) return;
  state.tasks.push(...state.pendingExcelRows);
  saveLocalTasks();
  closeWorksheetImportModal();
  renderAll();
  showToast(`已导入 ${state.pendingExcelRows.length} 条日程`);
  syncToGoogleSheetBackground();
}

function exportToExcel() {
  if (typeof XLSX === 'undefined') return;
  const rows = state.tasks.map((t) => ({
    '日期 (Tarikh)': t.date,
    '时间 (Masa)': t.time || '',
    '事项名称 (Perkara)': t.title,
    '分类 (Bidang)': t.category === 'bidang' ? '我的 Bidang' : (t.category === 'school' ? '学校/配合他组' : '个人事务'),
    '性质 (Jenis)': t.actionType === 'delegate' ? '交代老师做' : (t.actionType === 'my_prep' ? '我需准备' : '行程'),
    '负责对象 (Tindakan)': t.assignee || '',
    '状态 (Status)': t.status === 'done' ? '已完成' : (t.status === 'in_progress' ? '进行中' : '待处理'),
    '备注 (Catatan)': t.notes || ''
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'GPK_Pentadbiran_Takwim');
  XLSX.writeFile(wb, `GPK_Pentadbiran_日程表_${formatDateYMD(new Date())}.xlsx`);
  showToast('已导出 Excel 工作表');
}

function downloadTemplateExcel() {
  if (typeof XLSX === 'undefined') return;
  const sampleRows = [
    { '日期': '2026-11-25', '事项名称': 'Mesyuarat Panitia Bahasa Cina Bil.4', '分类': '我的 Bidang', '性质': '交代老师做', '负责老师': '华文科主任', '备注': '提交会议记录' },
    { '日期': '2026-11-26', '事项名称': '配合毕业典礼彩排协调', '分类': '学校/配合', '性质': '我需准备', '负责老师': '配合 GPK Koko', '备注': '安排代课表' }
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Takwim导入模板');
  XLSX.writeFile(wb, 'GPK_Takwim_导入模板.xlsx');
}

// ==================== Google Sheet & Drive 同步 ====================
function updateSyncStatusUI() {
  const dot = document.getElementById('syncDot');
  const text = document.getElementById('syncStatusText');
  const tag = document.getElementById('connStatusTag');

  if (state.gasUrl) {
    dot?.classList.add('online');
    if (text) text.textContent = 'Google Drive 已连';
    if (tag) {
      tag.textContent = '已连接 Google';
      tag.style.color = '#059669';
      tag.style.background = 'rgba(16, 185, 129, 0.12)';
    }
  } else {
    dot?.classList.remove('online');
    if (text) text.textContent = '本机存储';
    if (tag) {
      tag.textContent = '本机模式';
      tag.style.color = '#64748b';
      tag.style.background = 'rgba(15, 23, 42, 0.06)';
    }
  }
}

async function saveAndTestCloudConnection() {
  const gasUrl = document.getElementById('gasUrlInput').value.trim();
  const sheetUrl = document.getElementById('googleSheetLinkInput').value.trim();

  state.gasUrl = gasUrl;
  state.sheetUrl = sheetUrl;
  localStorage.setItem(STORAGE_KEYS.GAS_URL, gasUrl);
  localStorage.setItem(STORAGE_KEYS.SHEET_URL, sheetUrl);
  updateSyncStatusUI();

  if (!gasUrl) {
    showToast('已切换回本机存储');
    return;
  }
  await manualCloudSync();
}

async function manualCloudSync() {
  if (!state.gasUrl) {
    switchTab('vault');
    showToast('请先填入 Google Apps Script 网址');
    return;
  }

  showToast('正在同步至 Google Sheet…');
  try {
    const res = await fetch(state.gasUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'syncAll',
        tasks: state.tasks,
        customHolidays: state.customHolidays
      })
    });
    const data = await res.json();
    if (data && data.status === 'ok') {
      showToast('已同步至 Google Sheet');
    } else {
      showToast('同步返回异常: ' + (data?.message || ''));
    }
  } catch (err) {
    showToast('无法连接 Google Apps Script，请检查权限设置');
  }
}

async function syncToGoogleSheetBackground() {
  if (!state.gasUrl) return;
  try {
    await fetch(state.gasUrl, {
      method: 'POST',
      body: JSON.stringify({
        action: 'syncAll',
        tasks: state.tasks,
        customHolidays: state.customHolidays
      })
    });
  } catch (err) {
    console.warn('后台同步暂缓:', err);
  }
}

async function pullFromGoogleSheet(silent = false) {
  if (!state.gasUrl) {
    if (!silent) showToast('请先配置 Google Apps Script 网址');
    return;
  }
  if (!silent) showToast('正在从 Google Sheet 拉取…');

  try {
    const res = await fetch(state.gasUrl);
    const data = await res.json();
    if (data && data.status === 'ok') {
      if (Array.isArray(data.tasks) && data.tasks.length > 0) {
        state.tasks = data.tasks;
        saveLocalTasks();
      }
      if (Array.isArray(data.customHolidays) && data.customHolidays.length > 0) {
        state.customHolidays = data.customHolidays;
        saveLocalHolidays();
      }
      renderAll();
      if (!silent) showToast('已从 Google Sheet 更新');
    }
  } catch (err) {
    if (!silent) showToast('拉取失败，请检查网络连接');
  }
}

function openConnectedGoogleSheet() {
  if (state.sheetUrl) {
    window.open(state.sheetUrl, '_blank');
  } else {
    showToast('请先在上方填入您的 Google Sheet 网址');
  }
}

function copyAppsScriptCode() {
  fetch('./google-apps-script/Code.gs')
    .then((r) => r.text())
    .then((code) => {
      navigator.clipboard.writeText(code);
      showToast('已复制 Apps Script 代码');
    })
    .catch(() => {
      showToast('请打开 google-apps-script/Code.gs 复制');
    });
}

// ==================== 自定义学校特假管理 ====================
function addCustomHoliday() {
  const title = document.getElementById('newHolidayTitle').value.trim();
  const start = document.getElementById('newHolidayStart').value;
  const end = document.getElementById('newHolidayEnd').value || start;
  const type = document.getElementById('newHolidayType').value;

  if (!title || !start) {
    showToast('请填写假期名称与日期');
    return;
  }

  state.customHolidays.push({
    id: 'cust-hol-' + Date.now(),
    title,
    date: start,
    endDate: end >= start ? end : start,
    type
  });

  document.getElementById('newHolidayTitle').value = '';
  saveLocalHolidays();
  renderAll();
  showToast('假期已添加');
  syncToGoogleSheetBackground();
}

function deleteCustomHoliday(id) {
  state.customHolidays = state.customHolidays.filter((h) => h.id !== id);
  saveLocalHolidays();
  renderAll();
  showToast('已移除');
  syncToGoogleSheetBackground();
}

function renderHolidayManageList() {
  const el = document.getElementById('holidayManageList');
  if (!el) return;

  const all = [
    ...state.customHolidays.map((h) => ({ ...h, isCustom: true })),
    ...DEFAULT_HOLIDAYS.map((h) => ({ ...h, isCustom: false }))
  ].sort((a, b) => a.date.localeCompare(b.date));

  el.innerHTML = all
    .map((h) => {
      const badge = h.type === 'public' ? '公假' : (h.type === 'peristiwa' ? '特假' : '校假');
      return `
        <div class="holiday-manage-item">
          <div>
            <strong>[${badge}] ${escapeHtml(h.title)}</strong>
            <div style="font-size:11px;color:#64748b;">${h.date}${h.endDate && h.endDate !== h.date ? ' ~ ' + h.endDate : ''}</div>
          </div>
          ${h.isCustom ? `<button class="btn-danger-ghost" style="padding:4px 8px;font-size:11px;" onclick="deleteCustomHoliday('${h.id}')">删除</button>` : `<span style="font-size:10px;color:#94a3b8;">内置</span>`}
        </div>
      `;
    })
    .join('');
}

// ==================== 备份与还原 ====================
function exportJsonBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    tasks: state.tasks,
    customHolidays: state.customHolidays,
    standaloneFiles: state.standaloneFiles
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `GPK_Pentadbiran_Backup_${formatDateYMD(new Date())}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importJsonBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data.tasks)) state.tasks = data.tasks;
      if (Array.isArray(data.customHolidays)) state.customHolidays = data.customHolidays;
      if (Array.isArray(data.standaloneFiles)) state.standaloneFiles = data.standaloneFiles;
      saveLocalTasks();
      saveLocalHolidays();
      saveLocalStandaloneFiles();
      renderAll();
      showToast('备份已恢复');
    } catch (err) {
      showToast('备份文件格式错误');
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}

// ==================== 工具函数 ====================
function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(msg) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
