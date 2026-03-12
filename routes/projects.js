const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'superadmin') {
    req.flash('error', 'You are not authorized to manage projects.');
    return res.redirect('/');
  }

  try {
    const { q, status } = req.query;

    const all = await db('projects').select('*').orderBy('name');

    let projects = all;
    if (status) {
      projects = projects.filter(
        (p) => (p.status || '').toLowerCase() === status.toLowerCase()
      );
    }
    if (q) {
      const qLower = q.toLowerCase();
      projects = projects.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const desc = (p.description || '').toLowerCase();
        return name.includes(qLower) || desc.includes(qLower);
      });
    }

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

    res.render('projects', {
      pageTitle: 'Projects',
      projects,
      totalProjects,
      activeCount,
      completedCount,
      pendingCount,
      searchQuery: q || '',
      activeStatus: status || ''
    });
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to load projects.');
    res.redirect('/');
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

