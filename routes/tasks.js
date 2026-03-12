const express = require('express');
const db = require('../database');
const {
  syncTaskToSheet,
  importAllFromSheet,
  importMemberFromSheet
} = require('../services/sheetsService');

const router = express.Router();

const PAGE_SIZE = 10;

function formatDate(date) {
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, '0');
  const month = d.toLocaleString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function applyTaskFilters(baseQuery, req, isSuperAdmin) {
  const { member, date, status, project } = req.query;

  if (isSuperAdmin && member) {
    baseQuery.where('t.member_id', member);
  } else if (!isSuperAdmin && req.session.user.member_id) {
    baseQuery.where('t.member_id', req.session.user.member_id);
  }
  if (date) {
    baseQuery.where('t.date', date);
  }
  if (status) {
    baseQuery.where('t.status', status);
  }
  if (project) {
    baseQuery.where('t.project_id', project);
  }

  return baseQuery;
}

function mapTaskRows(rows) {
  return rows.map((t) => ({
    ...t,
    dateFormatted: formatDate(t.date)
  }));
}

router.get('/', async (req, res) => {
  try {
    const isSuperAdmin =
      req.session.user && req.session.user.role === 'superadmin';

    const members = isSuperAdmin
      ? await db('members').select('*').orderBy('name')
      : await db('members')
          .where({ id: req.session.user.member_id })
          .select('*')
          .orderBy('name');

    const projects = await db('projects').select('*').orderBy('name');

    const page = parseInt(req.query.page || '1', 10) || 1;
    const { member, date, status, project } = req.query;

    const countBase = applyTaskFilters(
      db('tasks as t').join('members as m', 't.member_id', 'm.id'),
      req,
      isSuperAdmin
    );
    const countRow = await countBase
      .clone()
      .clearSelect()
      .count('* as count')
      .first();
    const total = Number(countRow?.count || 0);

    const statusCounts = { 'in-progress': 0, done: 0, blocked: 0 };
    for (const s of ['done', 'in-progress', 'blocked']) {
      const r = await countBase
        .clone()
        .clearSelect()
        .where('t.status', s)
        .count('* as count')
        .first();
      statusCounts[s] = Number(r?.count || 0);
    }

    const dataQuery = applyTaskFilters(
      db('tasks as t')
        .select('t.*', 'm.name as member_name')
        .join('members as m', 't.member_id', 'm.id')
        .orderBy([
          { column: 't.date', order: 'desc' },
          { column: 't.created_at', order: 'desc' }
        ]),
      req,
      isSuperAdmin
    )
      .leftJoin('projects as p', 't.project_id', 'p.id')
      .select('p.name as project_name')
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    const taskRows = await dataQuery;
    const tasks = mapTaskRows(taskRows);

    const hasMore = page * PAGE_SIZE < total;

    const queryParts = [];
    if (isSuperAdmin && member) {
      queryParts.push(`member=${encodeURIComponent(member)}`);
    }
    if (date) {
      queryParts.push(`date=${encodeURIComponent(date)}`);
    }
    if (status) {
      queryParts.push(`status=${encodeURIComponent(status)}`);
    }
    if (project) {
      queryParts.push(`project=${encodeURIComponent(project)}`);
    }

    const today = new Date();
    const isWeekend = today.getDay() === 0 || today.getDay() === 6;

    res.render('tasks', {
      pageTitle: 'Tasks',
      topBarVariant: 'tasks',
      members,
      tasks,
      projects,
      statusCounts,
      totalTasks: total,
      filters: {
        member: isSuperAdmin ? member || '' : '',
        date: date || '',
        status: status || '',
        project: project || ''
      },
      isWeekend,
      quickMemberId: req.query.member_id || '',
      quickDate: req.query.date || '',
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        hasMore,
        query: queryParts.join('&')
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load tasks.');
    res.render('tasks', {
      pageTitle: 'Tasks',
      topBarVariant: 'tasks',
      members: [],
      tasks: [],
      projects: [],
      statusCounts: { 'in-progress': 0, done: 0, blocked: 0 },
      totalTasks: 0,
      filters: { member: '', date: '', status: '', project: '' },
      isWeekend: false,
      quickMemberId: '',
      quickDate: '',
      pagination: { page: 1, pageSize: PAGE_SIZE, total: 0, hasMore: false, query: '' }
    });
  }
});

router.get('/page', async (req, res) => {
  try {
    const isSuperAdmin =
      req.session.user && req.session.user.role === 'superadmin';
    const page = parseInt(req.query.page || '1', 10) || 1;
    const baseQuery = applyTaskFilters(
      db('tasks as t')
        .select('t.*', 'm.name as member_name')
        .join('members as m', 't.member_id', 'm.id'),
      req,
      isSuperAdmin
    );

    const countRow = await baseQuery
      .clone()
      .clearSelect()
      .count('* as count')
      .first();
    const total = Number(countRow?.count || 0);

    const taskRows = await baseQuery
      .clone()
      .orderBy([
        { column: 't.date', order: 'desc' },
        { column: 't.created_at', order: 'desc' }
      ])
      .leftJoin('projects as p', 't.project_id', 'p.id')
      .select('p.name as project_name')
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE);

    const tasks = mapTaskRows(taskRows);
    const hasMore = page * PAGE_SIZE < total;

    res.json({ success: true, tasks, hasMore });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to load more tasks.' });
  }
});

router.post('/add', async (req, res) => {
  try {
    const { date, task, status, project_id } = req.body;
    const isSuperAdmin =
      req.session.user && req.session.user.role === 'superadmin';
    const bodyMemberId = req.body.member_id;

    const effectiveMemberId = isSuperAdmin
      ? bodyMemberId
      : req.session.user.member_id;

    if (!effectiveMemberId || !date || !task) {
      req.flash('error', 'Member, date and task are required.');
      return res.redirect('/tasks');
    }

    const validStatuses = ['in-progress', 'done', 'blocked'];
    const finalStatus = validStatuses.includes(status) ? status : 'in-progress';

    const inserted = await db('tasks')
      .insert({
      member_id: effectiveMemberId,
      date,
      task: task.trim(),
      status: finalStatus,
      project_id: project_id || null
    })
      .returning(['id']);

    const created = Array.isArray(inserted) ? inserted[0] : inserted;

    // Fire-and-forget sync to Google Sheet
    if (created && created.id) {
      syncTaskToSheet(created.id).catch((err) => {
        console.error('Failed to sync task to Google Sheet', err);
      });
    }

    req.flash('success', 'Task added successfully.');
    res.redirect('/tasks');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to add task.');
    res.redirect('/tasks');
  }
});

// Admin: import all members' data from Google Sheet
router.post('/sync-sheet', async (req, res) => {
  try {
    const isSuperAdmin =
      req.session.user && req.session.user.role === 'superadmin';
    if (!isSuperAdmin) {
      req.flash('error', 'You are not authorized to sync with the sheet.');
      return res.redirect('/tasks');
    }

    await importAllFromSheet();
    req.flash('success', 'All member tasks synced from sheet.');
    res.redirect('/tasks');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to sync tasks from sheet.');
    res.redirect('/tasks');
  }
});

// Member: sync only their own data from Google Sheet
router.post('/sync-own', async (req, res) => {
  try {
    if (!req.session.user || !req.session.user.member_id) {
      req.flash('error', 'You are not authorized to sync tasks.');
      return res.redirect('/tasks');
    }

    const memberId = req.session.user.member_id;
    await importMemberFromSheet(memberId);
    req.flash('success', 'Your tasks have been synced from the sheet.');
    res.redirect('/tasks');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to sync your tasks from sheet.');
    res.redirect('/tasks');
  }
});

router.post('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status: requestedStatus } = req.body || {};
    const task = await db('tasks').where({ id }).first();
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const isSuperAdmin =
      req.session.user && req.session.user.role === 'superadmin';
    const isOwner =
      req.session.user &&
      req.session.user.member_id &&
      task.member_id === req.session.user.member_id;

    if (!isSuperAdmin && !isOwner) {
      return res
        .status(403)
        .json({ success: false, message: 'Not allowed to update this task' });
    }

    const validStatuses = ['in-progress', 'done', 'blocked'];
    let nextStatus;
    if (requestedStatus && validStatuses.includes(requestedStatus)) {
      nextStatus = requestedStatus;
    } else {
      nextStatus = 'in-progress';
      if (task.status === 'in-progress') nextStatus = 'done';
      else if (task.status === 'done') nextStatus = 'blocked';
    }

    await db('tasks').where({ id }).update({ status: nextStatus });

    res.json({ success: true, status: nextStatus });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to update status' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const task = await db('tasks').where({ id }).first();
    if (!task) {
      return res.status(404).json({ success: false, message: 'Task not found' });
    }

    const isSuperAdmin =
      req.session.user && req.session.user.role === 'superadmin';
    const isOwner =
      req.session.user &&
      req.session.user.member_id &&
      task.member_id === req.session.user.member_id;

    if (!isSuperAdmin && !isOwner) {
      return res
        .status(403)
        .json({ success: false, message: 'Not allowed to delete this task' });
    }

    await db('tasks').where({ id }).del();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Failed to delete task' });
  }
});

module.exports = router;

