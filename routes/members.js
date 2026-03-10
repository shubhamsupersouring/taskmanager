const express = require('express');
const db = require('../database');

const router = express.Router();

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

    const taskRows = await db('tasks')
      .where({ member_id: id })
      .orderBy([{ column: 'date', order: 'desc' }, { column: 'created_at', order: 'desc' }]);

    const tasks = taskRows.map((t) => ({
      ...t,
      dateFormatted: formatDate(t.date)
    }));

    const totalTasks = tasks.length;
    const statusCounts = {
      'in-progress': 0,
      done: 0,
      blocked: 0
    };

    const weekMap = {};

    for (const t of tasks) {
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

    for (const t of tasks) {
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
    for (const t of tasks) {
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
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load member details.');
    res.redirect('/');
  }
});

module.exports = router;

