const express = require('express');
const db = require('../database');

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
    const { id, name, role } = req.body;
    if (!name) {
      req.flash('error', 'Member name is required.');
      return res.redirect('/members');
    }

    const payload = {
      name: name.trim(),
      role: (role && role.trim()) || 'Developer'
    };

    if (id) {
      await db('members').where({ id }).update(payload);
      req.flash('success', 'Member updated.');
    } else {
      await db('members').insert(payload);
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
    await db('members').where({ id }).del();
    req.flash('success', 'Member deleted.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete member.');
  }
  res.redirect('/members');
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

    // Build daily counts (last 14 days)
    const dailyCountsMap = {};
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - 13); // last 14 days including today

    for (const t of allTasksRows) {
      const d = new Date(t.date);
      if (d >= cutoff && d <= now) {
        const key = d.toISOString().slice(0, 10);
        dailyCountsMap[key] = (dailyCountsMap[key] || 0) + 1;
      }
    }

    const dailyLabels = [];
    const dailyData = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      dailyLabels.push(formatDate(d));
      dailyData.push(dailyCountsMap[key] || 0);
    }

    // Monthly done task counts (last 6 months)
    const monthlyDoneMap = {};
    for (const t of allTasksRows) {
      if (t.status !== 'done') continue;
      const d = new Date(t.date);
      const key = `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, '0')}`;
      monthlyDoneMap[key] = (monthlyDoneMap[key] || 0) + 1;
    }

    const monthlyKeys = Object.keys(monthlyDoneMap).sort().slice(-6);
    const monthlyLabels = monthlyKeys.map((k) => {
      const [year, month] = k.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      return d.toLocaleString('en-GB', { month: 'short', year: '2-digit' });
    });
    const monthlyData = monthlyKeys.map((k) => monthlyDoneMap[k]);

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

