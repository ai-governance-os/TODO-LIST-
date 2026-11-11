// ============================================================================
// 华小 GPK Pentadbiran 专属日程与统筹系统 (PWA + Google Sheet & Drive 云端同步)
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
  currentMonth: new Date().getMonth(), // 0-11
  selectedDate: formatDateYMD(new Date()),
  categoryFilter: 'all', // 'all' | 'bidang' | 'school' | 'personal' | 'delegate'
  boardStatusFilter: 'active', // 'active' | 'done' | 'all'
  activeTab: 'calendar',
  tasks: [],
  customHolidays: [],
  standaloneFiles: [],
  gasUrl: '',
  sheetUrl: '',
  modalAttachments: [],
  modalCategory: 'bidang',
  modalActionType: 'my_prep',
  pendingExcelRows: []
};

// 初始化入口
document.addEventListener('DOMContentLoaded', () => {
  loadLocalData();
  initDefaultDates();
  renderAll();
  registerServiceWorker();

  // 如果已配置 Google Sheet Web App URL，启动时自动静默拉取最新云端数据
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

// ==================== 顶部筛选与底部 Tab 切换 ====================
function switchTab(tabName) {
  state.activeTab = tabName;
  document.querySelectorAll('.tab-view').forEach((el) => el.classList.remove('active'));
  const target = document.getElementById(`tab-${tabName}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.bottom-nav .nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
}

function setCategoryFilter(filter) {
  state.categoryFilter = filter;
  document.querySelectorAll('.filter-bar .filter-chip').forEach((chip) => {
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

// ==================== 多色日历核心渲染 ====================
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
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 (Sun) - 6 (Sat)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const todayStr = formatDateYMD(new Date());
  const totalCells = 42; // 6行 x 7列

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

    // 检查当天存在哪些颜色分类（用于实现“同日多色同时显示”）
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

    // 1. 顶部同日多色条 (当该日期有事项时，每个出现的颜色平分顶部彩条)
    let multiBarHtml = '<div class="day-multi-bar">';
    if (hasBidang) multiBarHtml += '<span class="day-multi-segment seg-bidang" title="我的 Bidang (蓝)"></span>';
    if (hasSchool) multiBarHtml += '<span class="day-multi-segment seg-school" title="学校/配合其他 Bidang (青)"></span>';
    if (hasPersonal) multiBarHtml += '<span class="day-multi-segment seg-personal" title="个人事务 (紫)"></span>';
    multiBarHtml += '</div>';

    // 2. 日期数字 + 右侧多色圆点簇
    let dotsHtml = '<div class="cal-day-dots">';
    if (hasBidang) dotsHtml += '<span class="cal-dot dot-bidang"></span>';
    if (hasSchool) dotsHtml += '<span class="cal-dot dot-school"></span>';
    if (hasPersonal) dotsHtml += '<span class="cal-dot dot-personal"></span>';
    dotsHtml += '</div>';

    // 3. 假期微章
    let holidayHtml = '';
    if (dayHolidays.length > 0) {
      const topHol = dayHolidays[0];
      const holClass = topHol.type === 'public' ? 'public' : (topHol.type === 'peristiwa' ? 'peristiwa' : 'school');
      holidayHtml = `<div class="cal-holiday-tag ${holClass}" title="${escapeHtml(topHol.title)}">${escapeHtml(topHol.title)}</div>`;
    }

    // 4. 事项微胶囊（确保同日不同颜色优先各展示一条或按顺序展示）
    let pillsHtml = '<div class="cal-events-mini">';
    const maxPills = dayHolidays.length > 0 ? 2 : 3;
    const visibleTasks = pickRepresentativeTasksForCell(dayTasks, maxPills);

    visibleTasks.forEach((t) => {
      const icon = t.actionType === 'delegate' ? '👥' : (t.actionType === 'my_prep' ? '👤' : '📌');
      const doneClass = t.status === 'done' ? 'is-done' : '';
      pillsHtml += `<div class="cal-pill pill-${t.category} ${doneClass}" title="${escapeHtml(t.title)}">${icon} ${escapeHtml(t.title)}</div>`;
    });

    if (dayTasks.length > visibleTasks.length) {
      pillsHtml += `<div class="cal-more-count">+${dayTasks.length - visibleTasks.length} 项</div>`;
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

// 当同一天有多种颜色事项时，优先让每种颜色至少露出一项在日历格子里
function pickRepresentativeTasksForCell(tasks, limit) {
  if (tasks.length <= limit) return tasks;
  const picked = [];
  const categories = ['bidang', 'school', 'personal'];
  categories.forEach((cat) => {
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

// ==================== 右侧：选中日期的多色详情与附件 ====================
function renderSelectedDayDetails() {
  const dateStr = state.selectedDate;
  const dateObj = new Date(dateStr + 'T00:00:00');
  const weekdays = ['星期日 Ahad', '星期一 Isnin', '星期二 Selasa', '星期三 Rabu', '星期四 Khamis', '星期五 Jumaat', '星期六 Sabtu'];
  const dayName = weekdays[dateObj.getDay()] || '';

  setText('selectedDateBadge', `${dateStr} (${dayName})`);

  const holidays = getHolidaysForDate(dateStr);
  const dayTasks = state.tasks
    .filter((t) => t.date === dateStr && filterTaskByCurrentMode(t))
    .sort((a, b) => (a.time || '23:59').localeCompare(b.time || '23:59'));

  // 1. 渲染同日多色统计条
  const summaryEl = document.getElementById('selectedDayColorSummary');
  if (summaryEl) {
    const bCount = dayTasks.filter((t) => t.category === 'bidang').length;
    const sCount = dayTasks.filter((t) => t.category === 'school').length;
    const pCount = dayTasks.filter((t) => t.category === 'personal').length;

    let sumHtml = '';
    if (bCount > 0) sumHtml += `<span class="summary-pill bidang">🔵 我的 Bidang: ${bCount} 项</span>`;
    if (sCount > 0) sumHtml += `<span class="summary-pill school">🟢 学校/配合: ${sCount} 项</span>`;
    if (pCount > 0) sumHtml += `<span class="summary-pill personal">🟣 个人: ${pCount} 项</span>`;
    if (!sumHtml) {
      sumHtml = `<span style="font-size:12px;color:#64748b;">此日暂无记录，点击右上角【＋ 加在此日】即可添加。</span>`;
    }
    summaryEl.innerHTML = sumHtml;
  }

  // 2. 渲染当日假期横幅
  const holEl = document.getElementById('selectedDayHolidays');
  if (holEl) {
    holEl.innerHTML = holidays
      .map((h) => {
        const label = h.type === 'public' ? '🇲🇾 公共假期' : (h.type === 'peristiwa' ? '🏫 学校特假' : '🎒 学校假期');
        return `<div class="holiday-banner ${h.type}">
          <span>${label}：${escapeHtml(h.title)}</span>
          <small>${h.date}${h.endDate && h.endDate !== h.date ? ' 至 ' + h.endDate : ''}</small>
        </div>`;
      })
      .join('');
  }

  // 3. 渲染当日事项卡片
  const listEl = document.getElementById('selectedDayTasks');
  if (!listEl) return;

  if (dayTasks.length === 0) {
    listEl.innerHTML = '';
    return;
  }

  listEl.innerHTML = dayTasks.map((t) => buildTaskCardHtml(t, false)).join('');
}

function buildTaskCardHtml(t, showDateBadge = true) {
  const catLabelMap = {
    bidang: '🔵 我的 Bidang',
    school: '🟢 学校/配合他组',
    personal: '🟣 个人 Peribadi'
  };
  const actionLabelMap = {
    my_prep: t.category === 'school' ? '👤 我需配合/完成' : '👤 我需准备/处理',
    delegate: '👥 交代老师/待收齐',
    event: '📌 行程/会议'
  };
  const statusLabelMap = {
    pending: '⏳ 待处理',
    in_progress: '🔄 进行中/部分已交',
    done: '✅ 已完成'
  };

  const attachmentsHtml = (t.attachments || [])
    .map((att, idx) => {
      const icon = getFileIcon(att.name || att.type);
      const href = att.url || att.dataUrl || '#';
      return `<a class="attach-chip" href="${href}" target="_blank" rel="noopener noreferrer" download="${att.dataUrl ? escapeHtml(att.name) : ''}">
        ${icon} ${escapeHtml(att.name || '查看附件')}
      </a>`;
    })
    .join('');

  return `
    <div class="task-card cat-${t.category} status-${t.status}">
      <div class="task-card-top">
        <div class="task-check-wrap">
          <input type="checkbox" class="task-checkbox" ${t.status === 'done' ? 'checked' : ''} onchange="toggleTaskDone('${t.id}', this.checked)" />
          <div style="flex:1;" onclick="openTaskModal('${t.id}')">
            <div class="task-title">${t.time ? `<span style="color:#2563eb">[${t.time}]</span> ` : ''}${escapeHtml(t.title)}</div>
            <div class="task-badges">
              ${showDateBadge ? `<span class="tag tag-action">📅 ${t.date}</span>` : ''}
              <span class="tag tag-${t.category}">${catLabelMap[t.category] || '事项'}</span>
              <span class="tag tag-action">${actionLabelMap[t.actionType] || ''}</span>
              ${t.assignee ? `<span class="tag tag-assignee">🎯 ${escapeHtml(t.assignee)}</span>` : ''}
              ${t.status === 'in_progress' ? `<span class="tag tag-status-in_progress">${statusLabelMap[t.status]}</span>` : ''}
            </div>
          </div>
        </div>
        <button class="btn-col-add" onclick="openTaskModal('${t.id}')" title="编辑事项">✎</button>
      </div>
      ${t.notes ? `<div class="task-notes">${escapeHtml(t.notes)}</div>` : ''}
      ${attachmentsHtml ? `<div class="task-attachments">${attachmentsHtml}</div>` : ''}
    </div>
  `;
}

// ==================== 近期筹备雷达 (Countdown Reminder) ====================
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
      // 距离截止在 0~10 天内，或者设置了提前准备天数且已进入准备期
      const prepWindow = Math.max(Number(t.prepDays) || 2, 5);
      return t.diffDays >= -3 && t.diffDays <= prepWindow;
    })
    .sort((a, b) => a.diffDays - b.diffDays);

  if (upcoming.length === 0) {
    radarEl.innerHTML = `<div style="font-size:12px;color:#64748b;">近期无紧急倒数事项 👍</div>`;
    return;
  }

  radarEl.innerHTML = upcoming
    .slice(0, 6)
    .map((t) => {
      let badge = '';
      if (t.diffDays < 0) badge = `<strong style="color:#dc2626">已逾期 ${Math.abs(t.diffDays)} 天</strong>`;
      else if (t.diffDays === 0) badge = `<strong style="color:#dc2626">就是今天！</strong>`;
      else badge = `<strong style="color:#b45309">还有 ${t.diffDays} 天 (${t.date})</strong>`;

      const dotColor = t.category === 'bidang' ? '🔵' : (t.category === 'school' ? '🟢' : '🟣');
      const roleTag = t.actionType === 'delegate' ? '👥催交老师' : '👤我需准备';

      return `<div class="radar-item" onclick="selectDate('${t.date}')">
        <span>${dotColor} [${roleTag}] ${escapeHtml(t.title)}</span>
        <span>${badge}</span>
      </div>`;
    })
    .join('');
}

// ==================== TAB 2: 四分栏 Bidang 统筹看板 ====================
function setBoardStatusFilter(status) {
  state.boardStatusFilter = status;
  document.querySelectorAll('.board-status-tabs .status-pill').forEach((btn) => {
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

  // 分入四个专属栏目：
  // 1. 我的 Bidang — 我自己准备/行程 (bidang + non-delegate)
  const bidangMy = filtered.filter((t) => t.category === 'bidang' && t.actionType !== 'delegate');
  // 2. 我的 Bidang — 交代老师做/跟进收齐 (bidang + delegate)
  const bidangDelegate = filtered.filter((t) => t.category === 'bidang' && t.actionType === 'delegate');
  // 3. 青色：学校事务 / 配合其他 Bidang
  const schoolAll = filtered.filter((t) => t.category === 'school');
  // 4. 紫色：个人事务
  const personalAll = filtered.filter((t) => t.category === 'personal');

  renderColumnList('col-bidang-my', bidangMy, '暂无待准备的 Bidang 事项');
  renderColumnList('col-bidang-delegate', bidangDelegate, '暂无待老师提交的事项');
  renderColumnList('col-school-all', schoolAll, '暂无学校或配合其他 Bidang 事项');
  renderColumnList('col-personal-all', personalAll, '暂无个人行程记录');
}

function renderColumnList(containerId, items, emptyText) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (items.length === 0) {
    el.innerHTML = `<div style="font-size:12px;color:#94a3b8;padding:12px 0;text-align:center;">${emptyText}</div>`;
    return;
  }
  el.innerHTML = items.map((t) => buildTaskCardHtml(t, true)).join('');
}

// ==================== 新增 / 编辑事项 Modal 控制 ====================
function openQuickCategoryModal(category, actionType) {
  openTaskModal(null, state.selectedDate, category, actionType);
}

function openTaskModal(taskId = null, defaultDate = null, defaultCat = 'bidang', defaultAct = 'my_prep') {
  const modal = document.getElementById('taskModalOverlay');
  if (!modal) return;

  const deleteBtn = document.getElementById('deleteTaskBtn');
  document.getElementById('quickLinkInputBox').style.display = 'none';

  if (taskId) {
    const task = state.tasks.find((t) => t.id === taskId);
    if (!task) return;
    setText('taskModalTitle', '编辑事项 / 跟进状态');
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
    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
  } else {
    setText('taskModalTitle', '新增日程 / 任务');
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
  }

  renderModalAttachments();
  modal.classList.add('open');
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
  document.querySelectorAll('#categorySelector .cat-option').forEach((el) => {
    const input = el.querySelector('input');
    const isMatch = input && input.value === cat;
    el.classList.toggle('active', isMatch);
    if (input) input.checked = isMatch;
  });
}

function selectModalActionType(act) {
  state.modalActionType = act;
  document.querySelectorAll('.action-type-selector .act-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.act === act);
  });

  const assigneeLabel = document.getElementById('assigneeLabel');
  const assigneeInput = document.getElementById('taskAssigneeInput');
  if (act === 'delegate') {
    if (assigneeLabel) assigneeLabel.textContent = '👥 交代哪位老师 / 哪个 Panitia 负责？';
    if (assigneeInput) assigneeInput.placeholder = '例：全体 Ketua Panitia / 4年级科任老师 / 某某老师';
  } else if (state.modalCategory === 'school') {
    if (assigneeLabel) assigneeLabel.textContent = '🤝 配合哪个部门 / 负责人？';
    if (assigneeInput) assigneeInput.placeholder = '例：配合 GPK HEM / GPK Koko / 校长 / PPD';
  } else {
    if (assigneeLabel) assigneeLabel.textContent = '👤 负责对象 / 备注对象 (选填)';
    if (assigneeInput) assigneeInput.placeholder = '例：GPK Pentadbiran 亲自准备';
  }
}

// 华小 GPK Pentadbiran 常用快捷模板
function applyQuickTemplate(tplKey) {
  const templates = {
    kurikulum: {
      cat: 'bidang',
      act: 'my_prep',
      title: '准备 Mesyuarat Kurikulum 课程会议议程与简报',
      assignee: 'GPK Pentadbiran',
      prepDays: '3',
      notes: '1. 发出 Surat Panggilan Mesyuarat\n2. 准备会议 PPT 与各科表现分析表\n3. 提醒书记录会议记录 (Minit Mesyuarat)'
    },
    panitia: {
      cat: 'bidang',
      act: 'delegate',
      title: '各科主任 (Ketua Panitia) 提交科委报告与活动记录',
      assignee: '全体 Ketua Panitia (华/国/英/数/科/史/艺/体)',
      prepDays: '2',
      notes: '待收齐科目：华文、国文、英文、数学、科学。收齐后存入 Google Drive 文件夹。'
    },
    pbd: {
      cat: 'bidang',
      act: 'delegate',
      title: '跟进全体科任老师完成 PBD / UASA 分数输入与分析',
      assignee: '全体科任老师 (Guru Mata Pelajaran)',
      prepDays: '3',
      notes: '检查各班输入进度，汇整不及格或需辅导学生名单 (Intervensi / Pemulihan)。'
    },
    pencerapan: {
      cat: 'bidang',
      act: 'my_prep',
      title: '教学视察与作业检阅 (Pencerapan PdPc & Semakan Buku Latihan)',
      assignee: 'GPK Pentadbiran & 科主任',
      prepDays: '1',
      notes: '准备好 Borang Pencerapan SKPM Kualiti@Sekolah，视察后与老师进行回馈交流。'
    },
    hem_koko: {
      cat: 'school',
      act: 'my_prep',
      title: '配合学校活动 / 其他 Bidang (HEM / Koko) 协调事项',
      assignee: '配合 GPK HEM / GPK Kokurikulum',
      prepDays: '2',
      notes: '协助调动当天代课表 (Jadual Relief) 及核对参与学生/负责老师名单。'
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
}

function saveTaskFromModal() {
  const title = document.getElementById('taskTitleInput').value.trim();
  const date = document.getElementById('taskDateInput').value;
  if (!title || !date) {
    showToast('⚠️ 请填写事项名称与日期');
    return;
  }

  const id = document.getElementById('taskIdInput').value || 'task-' + Date.now();
  const taskObj = {
    id,
    title,
    date,
    time: document.getElementById('taskTimeInput').value || '',
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
  showToast('✅ 事项已保存');

  // 若已配置 Google Sheet Web App URL，自动后台同步到云端
  syncToGoogleSheetBackground();
}

function toggleTaskDone(taskId, isChecked) {
  const task = state.tasks.find((t) => t.id === taskId);
  if (!task) return;
  task.status = isChecked ? 'done' : 'pending';
  saveLocalTasks();
  renderAll();
  showToast(isChecked ? '✅ 已标记为完成/收齐' : '⏳ 已恢复为待处理');
  syncToGoogleSheetBackground();
}

function deleteTaskFromModal() {
  const id = document.getElementById('taskIdInput').value;
  if (!id) return;
  state.tasks = state.tasks.filter((t) => t.id !== id);
  saveLocalTasks();
  closeTaskModal();
  renderAll();
  showToast('🗑️ 事项已删除');
  syncToGoogleSheetBackground();
}

// ==================== 文件上传 (直存 Google Drive) 与云端链接附件 ====================
function toggleQuickLinkInputs() {
  const box = document.getElementById('quickLinkInputBox');
  if (box) {
    box.style.display = box.style.display === 'none' ? 'grid' : 'none';
  }
}

function addLinkAttachmentToModal() {
  const nameInput = document.getElementById('attachLinkName');
  const urlInput = document.getElementById('attachLinkUrl');
  const name = nameInput.value.trim() || 'Google Drive / Sheet 链接';
  const url = urlInput.value.trim();

  if (!url) {
    showToast('⚠️ 请粘贴有效的 Google Drive 或网页链接');
    return;
  }

  state.modalAttachments.push({
    name,
    url,
    type: 'link',
    size: '云端链接'
  });

  nameInput.value = '';
  urlInput.value = '';
  document.getElementById('quickLinkInputBox').style.display = 'none';
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
    if (uploaded) {
      state.modalAttachments.push(uploaded);
    }
  }

  if (progressEl) progressEl.style.display = 'none';
  event.target.value = '';
  renderModalAttachments();
}

async function handleStandaloneFileUpload(event) {
  const files = Array.from(event.target.files || []);
  if (files.length === 0) return;

  showToast('⏳ 正在处理并上传文件...');
  for (const file of files) {
    const uploaded = await uploadOrStoreFile(file, '独立文件库');
    if (uploaded) {
      state.standaloneFiles.unshift({
        ...uploaded,
        uploadedAt: new Date().toISOString().slice(0, 10)
      });
    }
  }
  saveLocalStandaloneFiles();
  event.target.value = '';
  renderFilesLibrary();
  showToast('✅ 文件已加入工作表与文件库');
}

function openAddDriveLinkModal() {
  const name = prompt('请输入工作表或文件名称（例如：2027 排课总表 Jadual Waktu）：');
  if (!name) return;
  const url = prompt('请粘贴 Google Sheet 或 Google Drive 分享链接：');
  if (!url) return;

  state.standaloneFiles.unshift({
    name: name.trim(),
    url: url.trim(),
    type: 'link',
    size: 'Google Drive 链接',
    uploadedAt: formatDateYMD(new Date())
  });
  saveLocalStandaloneFiles();
  renderFilesLibrary();
  showToast('✅ 云端链接已保存');
}

// 如果已配置 Google Apps Script，直接把文件上传到用户的 Google Drive 专属文件夹；否则保存在本机
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
        showToast(`☁️ 已存入 Google Drive: ${file.name}`);
        return {
          name: file.name,
          url: data.fileUrl,
          fileId: data.fileId,
          type: file.type,
          size: formatBytes(file.size) + ' · Google Drive'
        };
      }
    } catch (err) {
      console.warn('上传至 Google Drive 失败，转为本机保存:', err);
    }
  }

  // 本机保存模式（若文件小于 3MB 直接存 DataURL 供随时下载预览）
  return {
    name: file.name,
    dataUrl: file.size <= 3 * 1024 * 1024 ? base64DataUrl : '',
    url: '',
    type: file.type,
    size: formatBytes(file.size) + ' · 本机附件'
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
      const icon = getFileIcon(att.name || att.type);
      const href = att.url || att.dataUrl || '#';
      return `
        <div class="modal-attach-item">
          <a href="${href}" target="_blank" rel="noopener noreferrer" style="text-decoration:none;color:#1e40af;font-weight:600;">
            ${icon} ${escapeHtml(att.name)} <small style="color:#64748b;">(${escapeHtml(att.size || '')})</small>
          </a>
          <button type="button" class="btn-close" style="width:22px;height:22px;font-size:11px;" onclick="removeModalAttachment(${idx})">✕</button>
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

  // 汇总所有日程下的附件 + 独立上传的工作表/文件
  const combined = [];

  state.tasks.forEach((t) => {
    (t.attachments || []).forEach((att) => {
      combined.push({
        ...att,
        taskTitle: t.title,
        taskDate: t.date,
        category: t.category
      });
    });
  });

  state.standaloneFiles.forEach((f) => {
    combined.push({
      ...f,
      taskTitle: '常用独立工作表/文件',
      taskDate: f.uploadedAt || '',
      category: 'bidang'
    });
  });

  const filtered = combined.filter((item) => {
    if (!query) return true;
    return `${item.name} ${item.taskTitle} ${item.taskDate}`.toLowerCase().includes(query);
  });

  setText('totalFilesCount', `${filtered.length} 个文件`);

  if (filtered.length === 0) {
    listEl.innerHTML = `<div style="text-align:center;color:#94a3b8;padding:24px;font-size:13px;">尚无上传的工作表或附件。您可以在新增日程时上传，或点击左侧按钮直接上传。</div>`;
    return;
  }

  listEl.innerHTML = filtered
    .map((item) => {
      const icon = getFileIcon(item.name || item.type);
      const href = item.url || item.dataUrl || '#';
      const catDot = item.category === 'bidang' ? '🔵' : (item.category === 'school' ? '🟢' : '🟣');
      return `
        <div class="file-item-card">
          <div>
            <div style="font-weight:700;font-size:13px;">${icon} ${escapeHtml(item.name)}</div>
            <div style="font-size:11px;color:#64748b;">
              ${catDot} 关联：${escapeHtml(item.taskTitle)} ${item.taskDate ? `(${item.taskDate})` : ''} · ${escapeHtml(item.size || '')}
            </div>
          </div>
          <a class="btn-primary-sm" href="${href}" target="_blank" rel="noopener noreferrer" download="${item.dataUrl ? escapeHtml(item.name) : ''}" style="text-decoration:none;">
            打开 / 查看
          </a>
        </div>
      `;
    })
    .join('');
}

function getFileIcon(nameOrType = '') {
  const s = nameOrType.toLowerCase();
  if (s.includes('xls') || s.includes('csv') || s.includes('sheet')) return '📊';
  if (s.includes('pdf')) return '📕';
  if (s.includes('doc') || s.includes('word')) return '📘';
  if (s.includes('png') || s.includes('jpg') || s.includes('jpeg') || s.includes('image')) return '🖼️';
  return '📎';
}

function formatBytes(bytes) {
  if (!bytes) return '0 KB';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ==================== Excel / CSV 工作表批量导入与导出 ====================
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
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
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
          .map((t) => {
            const dot = t.category === 'bidang' ? '🔵' : (t.category === 'school' ? '🟢' : '🟣');
            return `<div style="padding:4px 0;border-bottom:1px solid #f1f5f9;">
              ${dot} <strong>${t.date}</strong> — ${escapeHtml(t.title)} ${t.assignee ? `<small style="color:#c2410c;">(${escapeHtml(t.assignee)})</small>` : ''}
            </div>`;
          })
          .join('');
      } else {
        showToast('⚠️ 未能在工作表中识别出有效日期与事项，请参考标准模板');
      }
    } catch (err) {
      console.error(err);
      showToast('❌ 读取 Excel 工作表失败，请确认文件格式');
    }
  };
  reader.readAsArrayBuffer(file);
  event.target.value = '';
}

function parseExcelRowsToTasks(rows, defaultCat) {
  const result = [];
  rows.forEach((row, idx) => {
    // 智能匹配中/国/英表头
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
  if (val instanceof Date && !isNaN(val)) {
    return formatDateYMD(val);
  }
  const s = String(val).trim();
  // YYYY-MM-DD or YYYY/MM/DD
  const matchISO = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (matchISO) {
    return `${matchISO[1]}-${matchISO[2].padStart(2, '0')}-${matchISO[3].padStart(2, '0')}`;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const matchDMY = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (matchDMY) {
    return `${matchDMY[3]}-${matchDMY[2].padStart(2, '0')}-${matchDMY[1].padStart(2, '0')}`;
  }
  return '';
}

function confirmExcelImport() {
  if (state.pendingExcelRows.length === 0) return;
  state.tasks.push(...state.pendingExcelRows);
  saveLocalTasks();
  closeWorksheetImportModal();
  renderAll();
  showToast(`✅ 成功导入 ${state.pendingExcelRows.length} 条日程！`);
  syncToGoogleSheetBackground();
}

function exportToExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('⚠️ Excel 组件加载中，请稍候再试');
    return;
  }
  const rows = state.tasks.map((t) => ({
    '日期 (Tarikh)': t.date,
    '时间 (Masa)': t.time || '',
    '事项名称 (Perkara)': t.title,
    '分类 (Bidang)': t.category === 'bidang' ? '我的 Bidang (蓝)' : (t.category === 'school' ? '学校/配合他组 (青)' : '个人事务 (紫)'),
    '性质 (Jenis)': t.actionType === 'delegate' ? '交代老师做' : (t.actionType === 'my_prep' ? '我需准备/完成' : '会议/活动'),
    '负责对象/配合部门 (Tindakan)': t.assignee || '',
    '状态 (Status)': t.status === 'done' ? '已完成' : (t.status === 'in_progress' ? '进行中' : '待处理'),
    '备注 (Catatan)': t.notes || ''
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'GPK_Pentadbiran_Takwim');
  XLSX.writeFile(wb, `GPK_Pentadbiran_日程表_${formatDateYMD(new Date())}.xlsx`);
  showToast('📤 已导出 Excel 工作表');
}

function downloadTemplateExcel() {
  if (typeof XLSX === 'undefined') return;
  const sampleRows = [
    {
      '日期': '2026-11-25',
      '事项名称': 'Mesyuarat Panitia Bahasa Cina Bil.4',
      '分类': '我的 Bidang',
      '性质': '交代老师做',
      '负责老师': '华文科主任 Ketua Panitia BC',
      '备注': '提交会议记录与年终检讨报告'
    },
    {
      '日期': '2026-11-26',
      '事项名称': '配合毕业典礼彩排与音响场地协调',
      '分类': '学校/配合',
      '性质': '我需准备',
      '负责老师': '配合 GPK Koko',
      '备注': '安排当天节数代课表'
    },
    {
      '日期': '2026-11-28',
      '事项名称': '家庭周末聚餐',
      '分类': '个人',
      '性质': '活动',
      '负责老师': '个人',
      '备注': ''
    }
  ];
  const ws = XLSX.utils.json_to_sheet(sampleRows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Takwim导入模板');
  XLSX.writeFile(wb, 'GPK_Takwim_导入模板.xlsx');
}

// ==================== TAB 4: Google Sheet & Drive 双向同步与假期管理 ====================
function updateSyncStatusUI() {
  const dot = document.getElementById('syncDot');
  const text = document.getElementById('syncStatusText');
  const tag = document.getElementById('connStatusTag');

  if (state.gasUrl) {
    dot?.classList.add('online');
    if (text) text.textContent = '已连 Google Drive';
    if (tag) {
      tag.textContent = '✅ 已连接 Google Sheet & Drive';
      tag.style.color = '#059669';
    }
  } else {
    dot?.classList.remove('online');
    if (text) text.textContent = '本机模式 (可连 Drive)';
    if (tag) {
      tag.textContent = '⚪ 未配置云端 URL (数据保存在本机)';
      tag.style.color = '#64748b';
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
    showToast('已切换回纯本机保存模式');
    return;
  }

  await manualCloudSync();
}

async function manualCloudSync() {
  if (!state.gasUrl) {
    switchTab('sync');
    showToast('💡 请先粘贴您的 Google Apps Script 网址以启用 Google Drive 同步');
    return;
  }

  showToast('🔄 正在与您的 Google Sheet 同步...');
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
      showToast('☁️ 已成功同步至您的 Google Sheet！');
    } else {
      showToast('⚠️ 同步返回异常: ' + (data?.message || ''));
    }
  } catch (err) {
    console.error(err);
    showToast('⚠️ 无法连接 Google Apps Script，请检查网址与部署权限 (Anyone)');
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
    console.warn('后台同步至 Google Sheet 暂缓:', err);
  }
}

async function pullFromGoogleSheet(silent = false) {
  if (!state.gasUrl) {
    if (!silent) showToast('⚠️ 请先填写 Google Apps Script 网址');
    return;
  }
  if (!silent) showToast('⬇️ 正在从 Google Sheet 拉取数据...');

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
      if (!silent) showToast('✅ 已从 Google Sheet 更新最新日程！');
    }
  } catch (err) {
    if (!silent) showToast('⚠️ 拉取失败，请检查网络连接或 Apps Script 部署设置');
  }
}

function openConnectedGoogleSheet() {
  if (state.sheetUrl) {
    window.open(state.sheetUrl, '_blank');
  } else {
    showToast('💡 您可以在上方填入您的 Google Sheet 表格网址，方便一键打开');
  }
}

function toggleSetupGuide() {
  const body = document.getElementById('setupGuideBody');
  if (body) {
    body.style.display = body.style.display === 'none' ? 'block' : 'none';
  }
}

function copyAppsScriptCode() {
  fetch('./google-apps-script/Code.gs')
    .then((r) => r.text())
    .then((code) => {
      navigator.clipboard.writeText(code);
      showToast('📋 已复制 Google Apps Script 完整代码！请去 Google Sheet -> 扩展程序 -> Apps Script 粘贴');
    })
    .catch(() => {
      showToast('请打开项目文件夹中的 google-apps-script/Code.gs 复制');
    });
}

// ==================== 自定义学校特假 (Cuti Peristiwa) 管理 ====================
function addCustomHoliday() {
  const title = document.getElementById('newHolidayTitle').value.trim();
  const start = document.getElementById('newHolidayStart').value;
  const end = document.getElementById('newHolidayEnd').value || start;
  const type = document.getElementById('newHolidayType').value;

  if (!title || !start) {
    showToast('⚠️ 请填写假期名称与开始日期');
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
  showToast('🏖️ 假期已添加至日历');
  syncToGoogleSheetBackground();
}

function deleteCustomHoliday(id) {
  state.customHolidays = state.customHolidays.filter((h) => h.id !== id);
  saveLocalHolidays();
  renderAll();
  showToast('已移除该自定义假期');
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
      const badge = h.type === 'public' ? '🇲🇾 公假' : (h.type === 'peristiwa' ? '🏫 特假' : '🎒 校假');
      return `
        <div class="holiday-manage-item">
          <div>
            <strong>${badge} ${escapeHtml(h.title)}</strong>
            <div style="font-size:11px;color:#64748b;">${h.date}${h.endDate && h.endDate !== h.date ? ' ~ ' + h.endDate : ''}</div>
          </div>
          ${h.isCustom ? `<button class="btn-danger-outline" style="padding:4px 8px;font-size:11px;" onclick="deleteCustomHoliday('${h.id}')">删除</button>` : `<span style="font-size:10px;color:#94a3b8;">系统内置</span>`}
        </div>
      `;
    })
    .join('');
}

// ==================== JSON 备份与还原 ====================
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
      showToast('✅ 数据备份已成功恢复！');
    } catch (err) {
      showToast('❌ 备份文件格式错误');
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
  setTimeout(() => {
    t.remove();
  }, 3200);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}
