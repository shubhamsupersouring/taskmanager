require('dotenv').config();

const express = require('express');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');

const db = require('./database');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const tasksRoutes = require('./routes/tasks');
const membersRoutes = require('./routes/members');
const summaryRoutes = require('./routes/summary');
const projectsRoutes = require('./routes/projects');

const app = express();
const PORT = process.env.PORT || 3000;

db.migrate
  .latest()
  .then(() => db.seed.run())
  .catch((err) => {
    console.error('Failed to run migrations/seeds', err);
    process.exit(1);
  });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  session({
    secret: 'worktrack_secret_key',
    resave: false,
    saveUninitialized: false
  })
);
app.use(flash());

app.use((req, res, next) => {
  res.locals.successMessages = req.flash('success');
  res.locals.errorMessages = req.flash('error');
  res.locals.currentPath = req.path;
  res.locals.currentUser = req.session.user || null;

  if (!res.locals.todayFormatted) {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const month = today.toLocaleString('en-GB', { month: 'short' });
    const year = today.getFullYear();
    res.locals.todayFormatted = `${day} ${month} ${year}`;
  }

  next();
});

app.use(async (req, res, next) => {
  try {
    const members = await db('members').select('*').orderBy('name');
    res.locals.sidebarMembers = members;
  } catch (err) {
    console.error(err);
    res.locals.sidebarMembers = [];
  }
  next();
});

app.use('/', authRoutes);

function ensureAuthenticated(req, res, next) {
  const publicPaths = ['/login', '/forgot-password'];
  if (
    publicPaths.includes(req.path) ||
    req.path.startsWith('/reset-password') ||
    req.path.startsWith('/public')
  ) {
    return next();
  }
  if (!req.session.user) {
    return res.redirect('/login');
  }
  next();
}

app.use(ensureAuthenticated);

app.use('/', dashboardRoutes);
app.use('/tasks', tasksRoutes);
app.use('/members', membersRoutes);
app.use('/summary', summaryRoutes);
app.use('/projects', projectsRoutes);

app.use((req, res) => {
  res.status(404).render('dashboard', {
    pageTitle: 'Not Found',
    todayFormatted: '',
    memberCards: [],
    weeklyStats: { total: 0, in_progress: 0, done: 0, blocked: 0 },
    weekDays: [],
    weekRangeLabel: '',
    charts: {
      weeklyStatus: { labels: [], data: [] },
      todayByMember: { labels: [], data: [] }
    }
  });
});

app.listen(PORT, () => {
  console.log(`WorkTrack app listening on http://localhost:${PORT}`);
});

