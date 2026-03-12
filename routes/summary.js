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

function buildTeamPrompt(tasks, customText, noUpdateMembers) {
  const { monday, sunday } = getWeekRange(new Date());
  const weekStartLabel = formatDate(monday);
  const weekEndLabel = formatDate(sunday);

  const list = tasks
    .map(
      (t) =>
        `${formatDate(t.date)} | ${t.member_name} | ${t.status.toUpperCase()} | ${
          t.task
        }`
    )
    .join('\n');

  const custom = customText && customText.trim()
    ? `\n\nAdditional instructions from the manager:\n${customText.trim()}\n`
    : '';

  const noUpdateSection =
    noUpdateMembers && noUpdateMembers.length
      ? `\n\nMembers with NO updates for this week:\n${noUpdateMembers.join(
          ', '
        )}\n`
      : '';

  return `You are an assistant that writes a concise, executive-friendly WEEKLY TEAM SUMMARY
for the TrackerBabu task manager.

WEEK RANGE: ${weekStartLabel} – ${weekEndLabel}

RAW TASK LOG (one per line):
${list}
${noUpdateSection}${custom}

GOAL:
Generate a weekly AI team summary as CLEAN HTML (no <html>, <head>, or <body> tags),
structured with the following sections and headings:

<h3>Overall Team Summary</h3>
<p>One short paragraph (3–5 sentences) summarising the whole week.</p>

<h3>Key Contributions</h3>
<ul>
  <li><strong>Name — Role:</strong> 2–4 short bullet points of their most important contributions.</li>
</ul>

<h3>Productivity &amp; Patterns</h3>
<ul>
  <li><strong>Title:</strong> Explanation about trends, DONE vs IN‑PROGRESS/BLOCKED, repeated logs, peak days, etc.</li>
</ul>

<h3>Blockers &amp; Risks</h3>
<ul>
  <li><strong>Title:</strong> Members with no updates, vague entries, or other risks.</li>
</ul>

<h3>Next Steps</h3>
<ol>
  <li><strong>Action:</strong> Clear, actionable recommendation.</li>
</ol>

REQUIREMENTS:
- Return valid HTML using only the elements above (h3, p, ul/li, ol/li, strong, br).
- Group Key Contributions by member; one list item per member with their name and role, and nested bullets if needed.
- Mention members with NO updates in the Blockers &amp; Risks section.
- Do NOT include any outer layout HTML (no <html>, <body>, sidebar, etc.).
- Keep total length within ~600–800 words.
- Do NOT invent members; only reference names from the log.`;
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

    const allMembers = await db('members').select('id', 'name').orderBy('name');
    const membersWithTasks = new Set(tasks.map((t) => t.member_id));
    const noUpdateMembers = allMembers.filter((m) => !membersWithTasks.has(m.id));
    const noUpdateNames = noUpdateMembers.map((m) => m.name);

    const model = await getModel();
    const custom = (req.query.custom || '').trim();
    const prompt = buildTeamPrompt(tasks, custom, noUpdateNames);

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
      backUrl: '/',
      noUpdateMembers: noUpdateNames
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to generate team AI summary.');
    res.redirect('/');
  }
});

module.exports = router;

