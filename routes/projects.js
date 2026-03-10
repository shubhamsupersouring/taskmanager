const express = require('express');
const db = require('../database');

const router = express.Router();

router.get('/', async (req, res) => {
  if (!req.session.user || req.session.user.role !== 'superadmin') {
    req.flash('error', 'You are not authorized to manage projects.');
    return res.redirect('/');
  }

  try {
    const projects = await db('projects').select('*').orderBy('name');
    res.render('projects', {
      pageTitle: 'Projects',
      projects
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
    const { id, name, description } = req.body;
    if (!name) {
      req.flash('error', 'Project name is required.');
      return res.redirect('/projects');
    }

    const payload = {
      name: name.trim(),
      description: description ? description.trim() : null
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

