const express = require('express');
const db = require('../database');

const router = express.Router();
const PROJECT_PAGE_SIZE = 10;

router.get('/', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'superadmin') {
    req.flash('error', 'You are not authorized to manage projects.');
    return res.redirect('/');
  }

  try {
    const { q, status } = req.query;
    const page = parseInt(req.query.page || '1', 10) || 1;

    const all = await db('projects').select('*').orderBy('name');

    let filtered = all;
    if (status) {
      filtered = filtered.filter(
        (p) => (p.status || '').toLowerCase() === status.toLowerCase()
      );
    }
    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return name.includes(qLower) || desc.includes(qLower);
      });
    }

    const totalFiltered = filtered.length;
    const startIdx = (page - 1) * PROJECT_PAGE_SIZE;
    const pageProjects = filtered.slice(
      startIdx,
      startIdx + PROJECT_PAGE_SIZE
    );
    const hasMore = page * PROJECT_PAGE_SIZE < totalFiltered;

    const totalProjects = all.length;
    const activeCount = all.filter((p) => (p.status || 'active') === 'active')
      .length;
    const completedCount = all.filter(
      (p) => (p.status || '').toLowerCase() === 'completed'
    ).length;
    const pendingCount = all.filter((p) => {
      const s = (p.status || '').toLowerCase();
      return s === 'planning' || s === 'on-hold' || s === 'pending';
    }).length;

    const queryParts = [];
    if (q) {
      queryParts.push(`q=${encodeURIComponent(q)}`);
    }
    if (status) {
      queryParts.push(`status=${encodeURIComponent(status)}`);
    }

    res.render('projects', {
      pageTitle: 'Projects',
      projects: pageProjects,
      totalProjects,
      activeCount,
      completedCount,
      pendingCount,
      searchQuery: q || '',
      activeStatus: status || '',
      pagination: {
        page,
        pageSize: PROJECT_PAGE_SIZE,
        total: totalFiltered,
        hasMore,
        query: queryParts.join('&')
      }
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load projects.');
    res.redirect('/');
  }
});

// Projects pagination JSON for infinite scroll
router.get('/page', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'superadmin') {
    return res
      .status(403)
      .json({ success: false, message: 'Not authorized to view projects.' });
  }

  try {
    const { q, status } = req.query;
    const page = parseInt(req.query.page || '1', 10) || 1;

    const all = await db('projects').select('*').orderBy('name');

    let filtered = all;
    if (status) {
      filtered = filtered.filter(
        (p) => (p.status || '').toLowerCase() === status.toLowerCase()
      );
    }
    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return name.includes(qLower) || desc.includes(qLower);
      });
    }

    const totalFiltered = filtered.length;
    const startIdx = (page - 1) * PROJECT_PAGE_SIZE;
    const pageProjects = filtered.slice(
      startIdx,
      startIdx + PROJECT_PAGE_SIZE
    );
    const hasMore = page * PROJECT_PAGE_SIZE < totalFiltered;

    res.json({ success: true, projects: pageProjects, hasMore });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ success: false, message: 'Failed to load more projects.' });
  }
});

router.post('/add', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'superadmin') {
    req.flash('error', 'You are not authorized to manage projects.');
    return res.redirect('/');
  }

  try {
    const { id, name, description, status } = req.body;
    if (!name) {
      req.flash('error', 'Project name is required.');
      return res.redirect('/projects');
    }

    const payload = {
      name: name.trim(),
      description: description ? description.trim() : null,
      status: (status || 'active').toLowerCase(),
    };

    if (id) {
      await db('projects').where({ id }).update(payload);
      req.flash('success', 'Project updated.');
    } else {
      await db('projects')
        .insert(payload)
        .onConflict('name')
        .ignore();
      req.flash('success', 'Project added.');
    }

    res.redirect('/projects');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to save project.');
    res.redirect('/projects');
  }
});

router.post('/:id/delete', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'superadmin') {
    req.flash('error', 'You are not authorized to manage projects.');
    return res.redirect('/');
  }

  try {
    const { id } = req.params;
    await db('projects').where({ id }).del();
    req.flash('success', 'Project deleted.');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to delete project.');
  }
  res.redirect('/projects');
});

module.exports = router;

