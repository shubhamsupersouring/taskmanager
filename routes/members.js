const express = require('express');
const db = require('../database');
const ExcelJS = require('exceljs');
const { createMemberUserWithEmail } = require('../services/authService');
const { importMemberFromSheet } = require('../services/sheetsService');

const router = express.Router();

const MEMBER_PAGE_SIZE = 10;

function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function getWeekStart(dateStr) {
  const d = new Date(dateStr);
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function toISODateKey(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    return value.slice(0, 10);
  }
  const d = new Date(value);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Admin members management list
router.get('/', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'superadmin') {
    if (req.session.user && req.session.user.member_id) {
      return res.redirect(`/members/${req.session.user.member_id}`);
    }
    return res.redirect('/');
  }

  try {
    const members = await db('members as m')
      .leftJoin('users as u', 'u.member_id', 'm.id')
      .select('m.*', 'u.email as user_email')
      .orderBy('m.name');

    res.render('members-manage', {
      pageTitle: 'Members',
      members
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load members.');
    res.redirect('/');
  }
});

// Admin add / update member
router.post('/add', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'superadmin') {
    req.flash('error', 'You are not authorized to manage members.');
    return res.redirect('/');
  }

  try {
    const { id, name, role, email } = req.body;
    const trimmedName = (name || '').trim();
    const trimmedRole = (role || '').trim();
    const trimmedEmail = (email || '').trim();

    if (!trimmedName || !trimmedRole || (!id && !trimmedEmail)) {
      req.flash(
        'error',
        'Name, role, and email are required when adding a member.'
      );
      return res.redirect('/members');
    }

    const payload = {
      name: trimmedName,
      role: trimmedRole || 'Developer'
    };

    if (id) {
      await db('members').where({ id }).update(payload);
      req.flash('success', 'Member updated.');
    } else {
      const inserted = await db('members').insert(payload).returning(['id']);
      const createdMember = Array.isArray(inserted) ? inserted[0] : inserted;

      if (trimmedEmail) {
        try {
          await createMemberUserWithEmail(
            createdMember.id,
            payload.name,
            trimmedEmail
          );
        } catch (err) {
          console.error('Failed to create user / send welcome email for member', err);
        }
      }

      req.flash('success', 'Member added.');
    }

    res.redirect('/members');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to save member.');
    res.redirect('/members');
  }
});

// Admin delete member
router.post('/:id/delete', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'superadmin') {
    req.flash('error', 'You are not authorized to manage members.');
    return res.redirect('/');
  }

  try {
    const { id } = req.params;
    // Remove all tasks and linked user for this member first, then the member record
    await db.transaction(async (trx) => {
      await trx('tasks').where({ member_id: id }).del();
      await trx('users').where({ member_id: id }).del();
      await trx('members').where({ id }).del();
    });
    req.flash('success', 'Member deleted.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete member.');
  }
  res.redirect('/members');
});

// Import this member's data from Google Sheet
router.post('/:id/sync-sheet', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'superadmin') {
    req.flash('error', 'You are not authorized to sync with the sheet.');
    return res.redirect('/');
  }

  try {
    const { id } = req.params;
    await importMemberFromSheet(id);
    req.flash('success', 'Member tasks synced from sheet.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to sync member from sheet.');
  }
  res.redirect(`/members/${req.params.id}`);
});

// Export member's done work as Excel within a date range
router.get('/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin =
      req.session.user && req.session.user.role === 'superadmin';

    // Allow superadmin or the member themselves
    if (!isSuperAdmin) {
      if (!req.session.user || String(req.session.user.member_id) !== String(id)) {
        req.flash('error', 'You are not allowed to export this member work.');
        return res.redirect('/');
      }
    }

    const start = req.query.start;
    const end = req.query.end;

    if (!start || !end) {
      req.flash('error', 'Please select both start and end date to export work.');
      return res.redirect(`/members/${id}`);
    }

    const member = await db('members').where({ id }).first();
    if (!member) {
      req.flash('error', 'Member not found.');
      return res.redirect('/');
    }

    const tasks = await db('tasks as t')
      .leftJoin('projects as p', 't.project_id', 'p.id')
      .select(
        't.date',
        't.task',
        'p.name as project_name'
      )
      .where('t.member_id', id)
      .andWhere('t.status', 'done')
      .andWhereBetween('t.date', [start, end])
      .orderBy([{ column: 't.date', order: 'asc' }, { column: 't.created_at', order: 'asc' }]);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Work Export');

    // Title row
    const title = `${member.name} (${formatDate(start)} - ${formatDate(end)})`;
    sheet.mergeCells('A1:B1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = title;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    // Header row
    const headerRow = sheet.getRow(3);
    headerRow.values = ['Date', title];
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.alignment = { horizontal: 'center' };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0FA36C' }
    };

    sheet.columns = [
      { header: 'Date', key: 'date', width: 18 },
      { header: title, key: 'work', width: 80 }
    ];

    // Group done tasks by date
    const byDate = {};
    for (const t of tasks) {
      const key = t.date;
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(t);
    }

    let currentRowIndex = 4;
    const dateKeys = Object.keys(byDate).sort();
    for (const dateKey of dateKeys) {
      const items = byDate[dateKey];
      const displayDate = formatDate(dateKey);

      const workText = items
        .map((item, idx) => {
          const proj = item.project_name ? ` (${item.project_name})` : '';
          return `${idx + 1}. ${item.task}${proj}`;
        })
        .join('  ');

      const row = sheet.getRow(currentRowIndex++);
      row.values = [displayDate, workText];
      row.alignment = { vertical: 'top', wrapText: true };
      row.border = {
        top: { style: 'thin', color: { argb: 'FFB4E0C8' } },
        left: { style: 'thin', color: { argb: 'FFB4E0C8' } },
        bottom: { style: 'thin', color: { argb: 'FFB4E0C8' } },
        right: { style: 'thin', color: { argb: 'FFB4E0C8' } }
      };
    }

    const safeName = member.name.replace(/[^a-z0-9]+/gi, '_');
    const filename = `${safeName}_${start}_to_${end}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${filename}"`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to export work.');
    res.redirect('back');
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin =
      req.session.user && req.session.user.role === 'superadmin';

    if (!isSuperAdmin) {
      if (!req.session.user || String(req.session.user.member_id) !== String(id)) {
        req.flash('error', 'You are not allowed to view this member.');
        return res.redirect('/');
      }
    }

    const member = await db('members').where({ id }).first();

    if (!member) {
      req.flash('error', 'Member not found.');
      return res.redirect('/');
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const filterDate = req.query.date || todayStr;
    const page = parseInt(req.query.page || '1', 10) || 1;

    const baseQuery = db('tasks').where({ member_id: id });
    const countedBase = db('tasks').where({ member_id: id });
    if (filterDate) {
      countedBase.andWhere('date', filterDate);
    }

    const countRow = await countedBase.count('* as count').first();
    const total = Number(countRow?.count || 0);

    const rows = await baseQuery
      .clone()
      .modify((qb) => {
        if (filterDate) {
          qb.andWhere('date', filterDate);
        }
      })
      .orderBy([
        { column: 'date', order: 'desc' },
        { column: 'created_at', order: 'desc' }
      ])
      .limit(MEMBER_PAGE_SIZE)
      .offset((page - 1) * MEMBER_PAGE_SIZE);

    const tasks = rows.map((t) => ({
      ...t,
      dateFormatted: formatDate(t.date)
    }));

    const hasMore = page * MEMBER_PAGE_SIZE < total;

    const allTasksRows = await db('tasks')
      .where({ member_id: id })
      .orderBy([{ column: 'date', order: 'desc' }, { column: 'created_at', order: 'desc' }]);

    const totalTasks = allTasksRows.length;
    const statusCounts = {
      'in-progress': 0,
      done: 0,
      blocked: 0
    };

    const weekMap = {};

    for (const t of allTasksRows) {
      if (statusCounts[t.status] !== undefined) {
        statusCounts[t.status] += 1;
      }

      const weekStart = getWeekStart(t.date);
      const key = weekStart.toISOString().slice(0, 10);
      if (!weekMap[key]) {
        weekMap[key] = 0;
      }
      weekMap[key] += 1;
    }

    let mostProductiveWeekLabel = 'N/A';
    if (Object.keys(weekMap).length > 0) {
      let maxKey = null;
      let maxVal = -1;
      for (const [key, val] of Object.entries(weekMap)) {
        if (val > maxVal) {
          maxVal = val;
          maxKey = key;
        }
      }
      const monday = new Date(maxKey);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      mostProductiveWeekLabel = `${formatDate(monday)} - ${formatDate(sunday)} (${maxVal} tasks)`;
    }

    // Build daily counts (last 14 days) without timezone shifts
    const dailyCountsMap = {};
    for (const t of allTasksRows) {
      const key = toISODateKey(t.date);
      if (!key) continue;
      dailyCountsMap[key] = (dailyCountsMap[key] || 0) + 1;
    }

    const dailyLabels = [];
    const dailyData = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = toISODateKey(d);
      dailyLabels.push(formatDate(d));
      dailyData.push(dailyCountsMap[key] || 0);
    }

    // Monthly done tasks: daily progress for current month (1–31)
    const current = new Date();
    const currentYear = current.getFullYear();
    const currentMonth = current.getMonth(); // 0-based

    const monthlyDayMap = {};
    for (const t of allTasksRows) {
      if (t.status !== 'done') continue;
      const d = new Date(t.date);
      if (d.getFullYear() !== currentYear || d.getMonth() !== currentMonth) {
        continue;
      }
      const day = d.getDate();
      monthlyDayMap[day] = (monthlyDayMap[day] || 0) + 1;
    }

    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const monthlyLabels = [];
    const monthlyData = [];
    for (let day = 1; day <= daysInMonth; day++) {
      monthlyLabels.push(String(day));
      monthlyData.push(monthlyDayMap[day] || 0);
    }

    res.render('member-detail', {
      pageTitle: member.name,
      member,
      tasks,
      totalTasks,
      statusCounts,
      mostProductiveWeekLabel,
      dailyChart: {
        labels: dailyLabels,
        data: dailyData
      },
      monthlyChart: {
        labels: monthlyLabels,
        data: monthlyData
      },
      historyFilters: {
        date: filterDate
      },
      historyPagination: {
        page,
        pageSize: MEMBER_PAGE_SIZE,
        total,
        hasMore
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load member details.');
    res.redirect('/');
  }
});

router.get('/:id/page', async (req, res) => {
  try {
    const { id } = req.params;
    const isSuperAdmin =
      req.session.user && req.session.user.role === 'superadmin';

    if (!isSuperAdmin) {
      if (!req.session.user || String(req.session.user.member_id) !== String(id)) {
        return res
          .status(403)
          .json({ success: false, message: 'Not allowed to view this member.' });
      }
    }

    const page = parseInt(req.query.page || '1', 10) || 1;
    const filterDate = req.query.date || null;

    const baseQuery = db('tasks').where({ member_id: id });
    const countedBase = db('tasks').where({ member_id: id });
    if (filterDate) {
      countedBase.andWhere('date', filterDate);
    }

    const countRow = await countedBase.count('* as count').first();
    const total = Number(countRow?.count || 0);

    const rows = await baseQuery
      .clone()
      .modify((qb) => {
        if (filterDate) {
          qb.andWhere('date', filterDate);
        }
      })
      .orderBy([
        { column: 'date', order: 'desc' },
        { column: 'created_at', order: 'desc' }
      ])
      .limit(MEMBER_PAGE_SIZE)
      .offset((page - 1) * MEMBER_PAGE_SIZE);

    const tasks = rows.map((t) => ({
      ...t,
      dateFormatted: formatDate(t.date)
    }));

    const hasMore = page * MEMBER_PAGE_SIZE < total;

    res.json({ success: true, tasks, hasMore });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to load more history.' });
  }
});

module.exports = router;

