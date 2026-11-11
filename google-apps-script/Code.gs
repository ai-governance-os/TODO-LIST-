/**
 * ============================================================================
 * 华小 GPK Pentadbiran 专属日程与任务系统 — Google Sheet + Google Drive 云端后台脚本
 * ============================================================================
 * 【使用步骤】（只需 2 分钟）：
 * 1. 打开您的 Google Drive，新建一个 Google Sheet（命名为：GPK Pentadbiran 日程表）。
 * 2. 点击顶部菜单【扩展程序 (Extensions)】 -> 【Apps Script】。
 * 3. 删除里面原有的代码，把本文件的全部代码复制粘贴进去，按 Ctrl+S 保存。
 * 4. 点击右上角蓝色按钮【部署 (Deploy)】 -> 【新建部署 (New deployment)】。
 * 5. 点击左上角齿轮图标，选择【网页应用 (Web app)】：
 *    - 执行身份 (Execute as)：选择【我 (Me)】
 *    - 谁可以访问 (Who has access)：选择【所有人 (Anyone)】
 * 6. 点击【部署 (Deploy)】，授权允许访问您的 Google Sheet 与 Google Drive。
 * 7. 复制生成的【网页应用网址 (Web App URL)】，粘贴到手机/电脑 App 的【云同步设置】即可！
 * ============================================================================
 */

const FOLDER_NAME = 'GPK_Pentadbiran_Drive_Files';
const SHEET_TASKS = 'Tasks';
const SHEET_HOLIDAYS = 'CustomHolidays';
const SHEET_FILES = 'DriveFilesLog';

function ensureSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. 初始化 Tasks 工作表
  let taskSheet = ss.getSheetByName(SHEET_TASKS);
  if (!taskSheet) {
    taskSheet = ss.insertSheet(SHEET_TASKS);
    const headers = [
      'id', 'date', 'time', 'title', 'category', 'actionType',
      'assignee', 'status', 'priority', 'prepDays', 'notes', 'attachments', 'updatedAt'
    ];
    taskSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    taskSheet.getRange(1, 1, 1, headers.length)
      .setBackground('#1e3a8a')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    taskSheet.setFrozenRows(1);
  }

  // 2. 初始化 CustomHolidays 工作表
  let holidaySheet = ss.getSheetByName(SHEET_HOLIDAYS);
  if (!holidaySheet) {
    holidaySheet = ss.insertSheet(SHEET_HOLIDAYS);
    const headers = ['id', 'date', 'endDate', 'title', 'type'];
    holidaySheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    holidaySheet.getRange(1, 1, 1, headers.length)
      .setBackground('#991b1b')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    holidaySheet.setFrozenRows(1);
  }

  // 3. 初始化 DriveFilesLog 工作表
  let fileSheet = ss.getSheetByName(SHEET_FILES);
  if (!fileSheet) {
    fileSheet = ss.insertSheet(SHEET_FILES);
    const headers = ['uploadedAt', 'fileName', 'mimeType', 'fileUrl', 'fileId', 'taskTitle'];
    fileSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    fileSheet.getRange(1, 1, 1, headers.length)
      .setBackground('#065f46')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    fileSheet.setFrozenRows(1);
  }

  return { ss, taskSheet, holidaySheet, fileSheet };
}

function doGet(e) {
  try {
    const { taskSheet, holidaySheet } = ensureSetup();
    const tasks = readSheetRows(taskSheet, true);
    const customHolidays = readSheetRows(holidaySheet, false);

    return ContentService
      .createTextOutput(JSON.stringify({
        status: 'ok',
        tasks: tasks,
        customHolidays: customHolidays,
        serverTime: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const { taskSheet, holidaySheet, fileSheet } = ensureSetup();
    const payload = JSON.parse(e.postData.contents);
    const action = payload.action;

    // 动作 1：双向/全量同步日程与自定义假期到 Google Sheet
    if (action === 'syncAll') {
      if (Array.isArray(payload.tasks)) {
        writeTasksToSheet(taskSheet, payload.tasks);
      }
      if (Array.isArray(payload.customHolidays)) {
        writeHolidaysToSheet(holidaySheet, payload.customHolidays);
      }
      return jsonResponse({ status: 'ok', message: '已同步至 Google Sheet' });
    }

    // 动作 2：上传工作表 (Excel) / PDF / 图片等附件至 Google Drive 专属文件夹
    if (action === 'uploadFile') {
      const folder = getOrCreateDriveFolder(FOLDER_NAME);
      const bytes = Utilities.base64Decode(payload.base64Data);
      const blob = Utilities.newBlob(bytes, payload.mimeType || 'application/octet-stream', payload.fileName);
      const file = folder.createFile(blob);

      // 设置拥有链接者可查看，方便在手机或分享给老师时直接点开
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch (permErr) {
        // 若使用的是受限机构账号不允许公开链接，则保持默认权限
      }

      const fileUrl = file.getUrl();
      const fileId = file.getId();

      fileSheet.appendRow([
        new Date().toISOString(),
        payload.fileName,
        payload.mimeType || '',
        fileUrl,
        fileId,
        payload.taskTitle || ''
      ]);

      return jsonResponse({
        status: 'ok',
        fileName: payload.fileName,
        fileUrl: fileUrl,
        fileId: fileId,
        folderName: FOLDER_NAME
      });
    }

    return jsonResponse({ status: 'error', message: '未知的操作类型: ' + action });
  } catch (err) {
    return jsonResponse({ status: 'error', message: err.toString() });
  }
}

function getOrCreateDriveFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

function readSheetRows(sheet, isTaskSheet) {
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow <= 1 || lastCol === 0) return [];

  const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  const headers = values[0];
  const result = [];

  for (let r = 1; r < values.length; r++) {
    const row = values[r];
    if (!row[0] && !row[3]) continue; // 跳过空行
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      const key = headers[c];
      let val = row[c];
      if ((key === 'date' || key === 'endDate') && val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      }
      if (key === 'attachments') {
        try {
          val = val ? JSON.parse(val) : [];
        } catch (e) {
          val = [];
        }
      }
      if (key === 'prepDays') {
        val = Number(val) || 0;
      }
      obj[key] = val;
    }
    result.push(obj);
  }
  return result;
}

function writeTasksToSheet(sheet, tasks) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 13).clearContent();
  }
  if (!tasks || tasks.length === 0) return;

  const rows = tasks.map(t => [
    t.id || Utilities.getUuid(),
    t.date || '',
    t.time || '',
    t.title || '',
    t.category || 'bidang',
    t.actionType || 'my_prep',
    t.assignee || '',
    t.status || 'pending',
    t.priority || 'normal',
    Number(t.prepDays) || 0,
    t.notes || '',
    JSON.stringify(t.attachments || []),
    new Date().toISOString()
  ]);

  sheet.getRange(2, 1, rows.length, 13).setValues(rows);
}

function writeHolidaysToSheet(sheet, holidays) {
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, 5).clearContent();
  }
  if (!holidays || holidays.length === 0) return;

  const rows = holidays.map(h => [
    h.id || Utilities.getUuid(),
    h.date || '',
    h.endDate || h.date || '',
    h.title || '',
    h.type || 'custom'
  ]);

  sheet.getRange(2, 1, rows.length, 5).setValues(rows);
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
