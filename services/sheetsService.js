const { google } = require('googleapis');
const db = require('../database');

function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function columnToLetter(column) {
  let temp = '';
  let col = column;
  while (col > 0) {
    let modulo = (col - 1) % 26;
    temp = String.fromCharCode(65 + modulo) + temp;
    col = Math.floor((col - modulo) / 26);
  }
  return temp;
}

function findMemberColumnIndex(headers, memberName) {
  if (!headers || !memberName) return -1;

  // 1) Exact match
  let idx = headers.indexOf(memberName);
  if (idx !== -1) return idx;

  // 2) Fallback: match by first name prefix (e.g. "Deepak" for "Deepak Rathore")
  const firstToken = String(memberName).split(/\s+/)[0];
  if (!firstToken) return -1;

  idx = headers.findIndex(function (h) {
    if (!h) return false;
    return String(h).trim().startsWith(firstToken);
  });
  return idx;
}

function getSheetsConfig() {
  const spreadsheetId = process.env.GSHEET_SPREADSHEET_ID;
  const clientEmail = process.env.GSHEET_CLIENT_EMAIL;
  const privateKeyRaw = process.env.GSHEET_PRIVATE_KEY;

  if (!spreadsheetId || !clientEmail || !privateKeyRaw) {
    return null;
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  const jwt = new google.auth.JWT(clientEmail, null, privateKey, [
    'https://www.googleapis.com/auth/spreadsheets'
  ]);

  const sheets = google.sheets({ version: 'v4', auth: jwt });

  return { sheets, spreadsheetId };
}

function sheetLabelToISO(dateLabel) {
  // Expect format like "10 Mar 2026" from the sheet
  if (!dateLabel) return null;
  const parts = String(dateLabel).trim().split(/\s+/);
  if (parts.length !== 3) return null;

  const [dayStr, monStr, yearStr] = parts;
  const monthMap = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12'
  };

  const mm = monthMap[monStr];
  const dd = dayStr.padStart(2, '0');
  if (!mm || !/^\d{4}$/.test(yearStr)) return null;

  return `${yearStr}-${mm}-${dd}`;
}

function parseTaskLine(line) {
  const m = String(line)
    .trim()
    .match(/^\d+\.\s*(.+?)(?:\s*\((.+)\))?$/);
  if (!m) {
    return { taskText: String(line).trim(), projectName: null };
  }
  return {
    taskText: m[1].trim(),
    projectName: m[2] ? m[2].trim() : null
  };
}

async function appendTaskToSheet({ date, memberName, taskText }) {
  const cfg = getSheetsConfig();
  if (!cfg) return;

  const { sheets, spreadsheetId } = cfg;
  const sheetName = process.env.GSHEET_SHEET_NAME || 'Sheet1';

  // 1) Read header row to find member column
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`
  });
  const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
  const colIndex = findMemberColumnIndex(headers, memberName);
  if (colIndex === -1) {
    console.warn('[sheets] No column found for member:', memberName);
    return;
  }

  const dateLabel = formatDate(date);

  // 2) Find or create row for this date in column A
  const datesRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A:A`
  });
  const dateRows = datesRes.data.values || [];
  let rowIndex = -1;
  for (let i = 1; i < dateRows.length; i += 1) {
    if (dateRows[i] && dateRows[i][0] === dateLabel) {
      rowIndex = i + 1; // 1-based index
      break;
    }
  }

  if (rowIndex === -1) {
    rowIndex = dateRows.length + 1;
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[dateLabel]] }
    });
  }

  const colLetter = columnToLetter(colIndex + 1);
  const cellRange = `${sheetName}!${colLetter}${rowIndex}`;

  // 3) Read existing cell to append as numbered item
  const cellRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: cellRange
  });
  const existing =
    (cellRes.data.values &&
      cellRes.data.values[0] &&
      cellRes.data.values[0][0]) ||
    '';

  // Avoid duplicate entries in the sheet for same task + project
  const existingItems = parseCellTasks(existing);
  const parsedNew = parseTaskLine(`1. ${taskText}`);
  const alreadyInSheet = existingItems.find(
    (item) =>
      item.taskText === parsedNew.taskText &&
      ((item.projectName || null) === (parsedNew.projectName || null))
  );
  if (alreadyInSheet) {
    // Nothing to do, this task already exists in the cell
    return;
  }

  let newValue;
  if (!existing) {
    newValue = `1. ${taskText}`;
  } else {
    const lines = existing.split('\n').filter(Boolean);
    const next = lines.length + 1;
    newValue = `${existing}\n${next}. ${taskText}`;
  }

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: cellRange,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[newValue]] }
  });
}

async function syncTaskToSheet(taskId) {
  const cfg = getSheetsConfig();
  if (!cfg) return;

  const task = await db('tasks as t')
    .leftJoin('members as m', 't.member_id', 'm.id')
    .leftJoin('projects as p', 't.project_id', 'p.id')
    .select(
      't.date',
      't.task',
      'm.name as member_name',
      'p.name as project_name'
    )
    .where('t.id', taskId)
    .first();

  if (!task || !task.member_name) {
    return;
  }

  const text = task.project_name
    ? `${task.task} (${task.project_name})`
    : task.task;

  await appendTaskToSheet({
    date: task.date,
    memberName: task.member_name,
    taskText: text
  });
}

function parseCellTasks(cellText) {
  if (!cellText) return [];
  const normalized = String(cellText).replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  let parts = normalized.split('\n').filter(Boolean);
  if (parts.length === 1) {
    // Handle "1. foo (...) 2. bar (...)" on a single line
    parts = normalized
      .split(/(?=\d+\.\s)/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  return parts.map((line) => {
    return parseTaskLine(line);
  });
}

async function ensureProjectId(projectName) {
  if (!projectName) return null;
  const existing = await db('projects').where({ name: projectName }).first();
  if (existing) return existing.id;
  const inserted = await db('projects')
    .insert({ name: projectName })
    .returning(['id']);
  const created = Array.isArray(inserted) ? inserted[0] : inserted;
  return created.id;
}

async function importMemberFromSheet(memberId) {
  const cfg = getSheetsConfig();
  if (!cfg) return;

  const member = await db('members').where({ id: memberId }).first();
  if (!member) return;

  const { sheets, spreadsheetId } = cfg;
  const sheetName = process.env.GSHEET_SHEET_NAME || 'Sheet1';

  // Header row to find column for this member
  const headerRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!1:1`
  });
  const headers = (headerRes.data.values && headerRes.data.values[0]) || [];
  const colIndex = findMemberColumnIndex(headers, member.name);
  if (colIndex === -1) {
    console.warn('[sheets] No column found for member during import:', member.name);
    return;
  }
  const colLetter = columnToLetter(colIndex + 1);

  // Column A dates (starting from row 2) and this member's column
  const datesRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!A2:A`
  });
  const tasksRes = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${colLetter}2:${colLetter}`
  });

  const dateRows = datesRes.data.values || [];
  const taskCells = tasksRes.data.values || [];

  // Build a map of sheet tasks per date (ISO)
  const sheetTasksByDate = {};
  for (let i = 0; i < dateRows.length; i += 1) {
    const dateLabel = dateRows[i] && dateRows[i][0];
    const cellVal = taskCells[i] && taskCells[i][0];
    if (!dateLabel || !cellVal) continue;

    const iso = sheetLabelToISO(dateLabel);
    if (!iso) continue;

    const parsed = parseCellTasks(cellVal).filter(function (item) {
      return !(
        item.taskText &&
        item.taskText.trim().toLowerCase() === 'holiday'
      );
    });
    if (!parsed.length) continue;
    sheetTasksByDate[iso] = parsed;
  }

  // 1) Sheet -> DB: insert any tasks that exist in sheet but not DB
  const sheetDates = Object.keys(sheetTasksByDate);
  for (const date of sheetDates) {
    // eslint-disable-next-line no-await-in-loop
    const existingTasks = await db('tasks as t')
      .leftJoin('projects as p', 't.project_id', 'p.id')
      .select('t.task', 'p.name as project_name')
      .where('t.member_id', memberId)
      .andWhere('t.date', date);

    const items = sheetTasksByDate[date];
    // eslint-disable-next-line no-restricted-syntax
    for (const item of items) {
      const baseText = item.taskText;
      const projectName = item.projectName;

      const already = existingTasks.find(
        (t) =>
          t.task === baseText &&
          ((t.project_name || null) === (projectName || null))
      );
      if (already) continue;

      // eslint-disable-next-line no-await-in-loop
      const projectId = await ensureProjectId(projectName);
      // eslint-disable-next-line no-await-in-loop
      await db('tasks').insert({
        member_id: memberId,
        date,
        task: baseText,
        status: 'done',
        project_id: projectId
      });
    }
  }

  // 2) DB -> Sheet: append any tasks that exist in DB but not in sheet
  const allDbTasks = await db('tasks as t')
    .leftJoin('projects as p', 't.project_id', 'p.id')
    .select('t.date', 't.task', 'p.name as project_name')
    .where('t.member_id', memberId);

  const dbByDate = {};
  allDbTasks.forEach(function (row) {
    if (!dbByDate[row.date]) dbByDate[row.date] = [];
    dbByDate[row.date].push(row);
  });

  const dbDates = Object.keys(dbByDate);
  for (const date of dbDates) {
    const sheetItems = sheetTasksByDate[date] || [];

    // Normalize sheet tasks for comparison
    const sheetSet = sheetItems.map(function (item) {
      return {
        task: item.taskText,
        project: item.projectName || null
      };
    });

    const rows = dbByDate[date];
    // eslint-disable-next-line no-restricted-syntax
    for (const row of rows) {
      const text = row.project_name
        ? `${row.task} (${row.project_name})`
        : row.task;

      const alreadyInSheet = sheetSet.find(function (s) {
        return (
          s.task === row.task &&
          ((s.project || null) === (row.project_name || null))
        );
      });

      if (alreadyInSheet) continue;

      // eslint-disable-next-line no-await-in-loop
      await appendTaskToSheet({
        date,
        memberName: member.name,
        taskText: text
      });
    }
  }
}

async function importAllFromSheet() {
  const members = await db('members').select('id');
  for (const m of members) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await importMemberFromSheet(m.id);
    } catch (err) {
      console.error('Failed to import member from sheet', m.id, err);
    }
  }
}

module.exports = {
  syncTaskToSheet,
  importMemberFromSheet,
  importAllFromSheet
};

