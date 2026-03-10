const express = require('express');
const db = require('../database');
const { GoogleGenerativeAI } = require('@google/generative-ai');

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
  const day = d.getDay();
  const diffToMonday = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { monday, sunday };
}

function buildMemberPrompt(memberName, tasks, customText) {
  const header = `You are a project manager assistant. Based on the following work log for ${memberName}, write a concise, professional report.

Work log:
`;

  const list = tasks
    .map(
      (t) =>
        `${formatDate(t.date)} - ${t.task} (${t.status.toUpperCase()})`
    )
    .join('\n');

  const custom = customText
    ? `\n\nAdditional instructions from the manager:\n${customText}\n`
    : '';

  const footer = `

Provide the report as clean HTML with the following structure:

<h3>Overall Summary</h3>
<p>2–3 sentence overview.</p>

<h3>Key Contributions</h3>
<ul><li>Bullet points of important work.</li></ul>

<h3>Productivity & Patterns</h3>
<ul><li>Notable trends and patterns.</li></ul>

<h3>Blockers & Concerns</h3>
<ul><li>Any risks, delays, or issues.</li></ul>

<h3>Next Steps</h3>
<ul><li>Clear, actionable recommendations.</li></ul>

Do NOT include <html> or <body> tags. Use short, direct bullets and bold key phrases where helpful.
`;

  return header + list + custom + footer;
}

function buildTeamPrompt(tasks, customText) {
  const header = `You are a project manager assistant. Based on the following work log for the whole team, write a concise professional report of contributions, patterns, productivity, and any concerns.

Work log:
`;

  const list = tasks
    .map(
      (t) =>
        `${formatDate(t.date)} - ${t.member_name}: ${t.task} (${t.status.toUpperCase()})`
    )
    .join('\n');

  const custom = customText
    ? `\n\nAdditional instructions from the manager:\n${customText}\n`
    : '';

  const footer = `

Provide the report as clean HTML with the following structure:

<h3>Overall Team Summary</h3>
<p>2–3 sentence overview of the team.</p>

<h3>Key Contributions</h3>
<ul><li>Team and individual highlights.</li></ul>

<h3>Productivity & Patterns</h3>
<ul><li>Trends, spikes, or slowdowns.</li></ul>

<h3>Blockers & Risks</h3>
<ul><li>Cross-team concerns or dependencies.</li></ul>

<h3>Next Steps</h3>
<ul><li>Clear, actionable recommendations.</li></ul>

Do NOT include <html> or <body> tags. Use short, direct bullets and bold key phrases where helpful.
`;

  return header + list + custom + footer;
}

async function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured.');
  }
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

async function generateWithRetry(model, prompt, maxRetries = 3) {
  let attempt = 0;
  let lastError;
  while (attempt < maxRetries) {
    try {
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (err) {
      lastError = err;
      // For 503s or transient errors, retry with simple backoff
      const message = (err && err.message) || '';
      if (
        message.includes('503') ||
        message.toLowerCase().includes('high demand') ||
        message.toLowerCase().includes('temporar')
      ) {
        attempt += 1;
        if (attempt >= maxRetries) break;
        const delay = 500 * attempt; // 500ms, 1s, 1.5s
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      // Non-transient error: break immediately
      break;
    }
  }
  throw lastError;
}

router.get('/member/:id', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'superadmin') {
      req.flash('error', 'You are not authorized to view AI summaries.');
      return res.redirect('/');
    }

    const { id } = req.params;
    const memberId = parseInt(id, 10);

    if (Number.isNaN(memberId)) {
      return res.redirect('/summary/team');
    }

    const member = await db('members').where({ id: memberId }).first();
    if (!member) {
      req.flash('error', 'Member not found.');
      return res.redirect('/');
    }

    const taskRows = await db('tasks')
      .where({ member_id: memberId })
      .orderBy([{ column: 'date', order: 'asc' }, { column: 'created_at', order: 'asc' }]);

    if (taskRows.length === 0) {
      return res.render('summary', {
        pageTitle: `AI Summary - ${member.name}`,
        type: 'member',
        targetName: member.name,
        summaryText: '',
        errorMessage: 'No tasks found for this member.',
        dateRangeLabel: 'N/A',
        backUrl: `/members/${member.id}`
      });
    }

    const model = await getModel();
    const custom = (req.query.custom || '').trim();
    const prompt = buildMemberPrompt(member.name, taskRows, custom);

    let aiText = '';
    try {
      aiText = await generateWithRetry(model, prompt);
    } catch (err) {
      console.error(err);
      return res.render('summary', {
        pageTitle: `AI Summary - ${member.name}`,
        type: 'member',
        targetName: member.name,
        summaryText: '',
        errorMessage:
          'Failed to generate AI summary. The AI service is currently busy, please try again in a moment.',
        dateRangeLabel: 'N/A',
        backUrl: `/members/${member.id}`
      });
    }

    const firstDate = taskRows[0].date;
    const lastDate = taskRows[taskRows.length - 1].date;
    const dateRangeLabel = `${formatDate(firstDate)} - ${formatDate(
      lastDate
    )}`;

    res.render('summary', {
      pageTitle: `AI Summary - ${member.name}`,
      type: 'member',
      targetName: member.name,
      summaryText: aiText,
      errorMessage: '',
      dateRangeLabel,
      backUrl: `/members/${member.id}`
    });
  } catch (err) {
    console.error(err);
    const ref = req.get('Referrer') || '/';
    req.flash('error', 'Failed to generate AI summary.');
    res.redirect(ref);
  }
});

router.get('/team/weekly', async (req, res) => {
  res.redirect('/summary/team');
});

router.get('/team', async (req, res) => {
  try {
    if (!req.session.user || req.session.user.role !== 'superadmin') {
      req.flash('error', 'You are not authorized to view AI summaries.');
      return res.redirect('/');
    }

    const { monday, sunday } = getWeekRange(new Date());
    const weekStartStr = monday.toISOString().slice(0, 10);
    const weekEndStr = sunday.toISOString().slice(0, 10);

    const tasks = await db('tasks as t')
      .select('t.*', 'm.name as member_name')
      .join('members as m', 't.member_id', 'm.id')
      .whereBetween('t.date', [weekStartStr, weekEndStr])
      .orderBy([{ column: 't.date', order: 'asc' }, { column: 't.created_at', order: 'asc' }]);

    if (tasks.length === 0) {
      return res.render('summary', {
        pageTitle: 'AI Team Weekly Summary',
        type: 'team',
        targetName: 'Team',
        summaryText: '',
        errorMessage: 'No tasks found for the current week.',
        dateRangeLabel: `${formatDate(weekStartStr)} - ${formatDate(
          weekEndStr
        )}`,
        backUrl: '/'
      });
    }

    const model = await getModel();
    const custom = (req.query.custom || '').trim();
    const prompt = buildTeamPrompt(tasks, custom);

    let aiText = '';
    try {
      aiText = await generateWithRetry(model, prompt);
    } catch (err) {
      console.error(err);
      return res.render('summary', {
        pageTitle: 'AI Team Weekly Summary',
        type: 'team',
        targetName: 'Team',
        summaryText: '',
        errorMessage:
          'Failed to generate AI summary. The AI service is currently busy, please try again in a moment.',
        dateRangeLabel: `${formatDate(weekStartStr)} - ${formatDate(
          weekEndStr
        )}`,
        backUrl: '/'
      });
    }

    const dateRangeLabel = `${formatDate(weekStartStr)} - ${formatDate(
      weekEndStr
    )}`;

    res.render('summary', {
      pageTitle: 'AI Team Weekly Summary',
      type: 'team',
      targetName: 'Team',
      summaryText: aiText,
      errorMessage: '',
      dateRangeLabel,
      backUrl: '/'
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to generate team AI summary.');
    res.redirect('/');
  }
});

module.exports = router;

