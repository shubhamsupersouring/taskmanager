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

function getWeekRange(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 (Sun) - 6 (Sat)
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

router.get('/', async (req, res) => {
  try {
    if (req.session.user && req.session.user.role !== 'superadmin') {
      if (req.session.user.member_id) {
        return res.redirect(`/members/${req.session.user.member_id}`);
      }
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);

    const members = await db('members').select('*').orderBy('name');

    const taskCountsRows = await db('tasks')
      .select('member_id')
      .count('* as count')
      .where('date', todayStr)
      .groupBy('member_id');

    const taskCountsMap = {};
    for (const row of taskCountsRows) {
      taskCountsMap[row.member_id] = Number(row.count);
    }

    const memberCards = members.map((m) => {
      const count = taskCountsMap[m.id] || 0;
      return {
        ...m,
        todayCount: count,
        statusLabel: count > 0 ? 'Active' : 'No Update'
      };
    });

    const { monday, sunday } = getWeekRange(today);
    const weekStartStr = monday.toISOString().slice(0, 10);
    const weekEndStr = sunday.toISOString().slice(0, 10);

    const weeklyStatsRowRaw = await db('tasks')
      .whereBetween('date', [weekStartStr, weekEndStr])
      .count('* as total')
      .sum({
        in_progress: db.raw("CASE WHEN status = 'in-progress' THEN 1 ELSE 0 END"),
        done: db.raw("CASE WHEN status = 'done' THEN 1 ELSE 0 END"),
        blocked: db.raw("CASE WHEN status = 'blocked' THEN 1 ELSE 0 END")
      })
      .first();

    const weeklyStatsRow = weeklyStatsRowRaw || {
      total: 0,
      in_progress: 0,
      done: 0,
      blocked: 0
    };

    weeklyStatsRow.total = Number(weeklyStatsRow.total || 0);
    weeklyStatsRow.in_progress = Number(weeklyStatsRow.in_progress || 0);
    weeklyStatsRow.done = Number(weeklyStatsRow.done || 0);
    weeklyStatsRow.blocked = Number(weeklyStatsRow.blocked || 0);

    const weekDays = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
      weekDays.push({
        label: d.toLocaleString('en-GB', { weekday: 'short' }),
        dateLabel: formatDate(d),
        isToday: d.toDateString() === today.toDateString(),
        isWeekend,
        isWorkday: !isWeekend
      });
    }

    res.render('dashboard', {
      pageTitle: 'Dashboard',
      todayFormatted: formatDate(today),
      memberCards,
      weeklyStats: weeklyStatsRow,
      weekDays,
      weekRangeLabel:
        weekDays.length > 0
          ? `${weekDays[0].dateLabel} - ${weekDays[6].dateLabel}`
          : '',
      // For charts
      charts: {
        weeklyStatus: {
          labels: ['In progress', 'Done', 'Blocked'],
          data: [
            weeklyStatsRow.in_progress,
            weeklyStatsRow.done,
            weeklyStatsRow.blocked
          ]
        },
        todayByMember: {
          labels: memberCards.map((m) => m.name),
          data: memberCards.map((m) => m.todayCount)
        }
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load dashboard.');
    res.render('dashboard', {
      pageTitle: 'Dashboard',
      todayFormatted: formatDate(new Date()),
      memberCards: [],
      weeklyStats: { total: 0, in_progress: 0, done: 0, blocked: 0 },
      weekDays: [],
      weekRangeLabel: '',
      charts: {
        weeklyStatus: { labels: [], data: [] },
        todayByMember: { labels: [], data: [] }
      }
    });
  }
});

module.exports = router;

