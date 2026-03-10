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
    const { name, description } = req.body;
    if (!name) {
      req.flash('error', 'Project name is required.');
      return res.redirect('/projects');
    }

    await db('projects')
      .insert({
        name: name.trim(),
        description: description ? description.trim() : null
      })
      .onConflict('name')
      .ignore();

    req.flash('success', 'Project saved.');
    res.redirect('/projects');
  } catch (err) {
    console.error(err);
    req.flash('error', 'Failed to save project.');
    res.redirect('/projects');
  }
});

module.exports = router;

