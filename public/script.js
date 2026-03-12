function ready(fn) {
  if (document.readyState !== 'loading') {
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

ready(function () {
  var loader = document.getElementById('globalLoader');
  var toastContainer = document.getElementById('toastContainer');

  function showLoader() {
    if (loader) loader.style.display = 'flex';
  }

  function hideLoader() {
    if (loader) loader.style.display = 'none';
  }

  function showToast(message, type) {
    if (!toastContainer || !message) return;
    var el = document.createElement('div');
    el.className = 'toast ' + (type === 'error' ? 'toast-error' : 'toast-success');
    el.innerHTML =
      '<span class="toast-dot"></span>' +
      '<div class="toast-message">' + message + '</div>';
    toastContainer.appendChild(el);
    setTimeout(function () {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 3500);
  }

  // Expose helpers globally so inline scripts can reuse them
  window.showLoader = showLoader;
  window.hideLoader = hideLoader;
  window.showToast = showToast;

  // Theme toggle (light / dark)
  var THEME_KEY = 'worktrack_theme';
  var root = document.documentElement;

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    localStorage.setItem(THEME_KEY, theme);

    // Update any theme toggle buttons (header, login)
    document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
      var icon = btn.querySelector('svg');
      var label = btn.querySelector('span');
      if (!icon || !label) return;
      if (theme === 'light') {
        // Show moon icon, label dark mode
        icon.innerHTML =
          '<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>';
        label.textContent = 'Dark mode';
      } else {
        // Show sun icon, label light mode
        icon.innerHTML =
          '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>';
        label.textContent = 'Light mode';
      }
    });
  }

  var savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme);

  document.querySelectorAll('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var current = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
      var next = current === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    });
  });

  // Generic confirm modal for deletes (tasks page)
  var confirmModal = document.getElementById('confirmDeleteModal');
  var confirmText = document.getElementById('confirmDeleteText');
  var confirmCancelBackdrop = document.getElementById('confirmDeleteCancel');
  var confirmCancelBtn = document.getElementById('confirmDeleteCancelBtn');
  var confirmYesBtn = document.getElementById('confirmDeleteConfirmBtn');
  var pendingConfirm = null;

  function closeConfirm() {
    if (confirmModal) {
      confirmModal.classList.remove('open');
    }
    pendingConfirm = null;
  }

  function openConfirm(message, onConfirm) {
    if (!confirmModal || !confirmText || !confirmYesBtn) {
      // Fallback to native confirm if modal markup not present
      if (window.confirm(message) && typeof onConfirm === 'function') {
        onConfirm();
      }
      return;
    }
    confirmText.textContent = message || 'Are you sure?';
    pendingConfirm = typeof onConfirm === 'function' ? onConfirm : null;
    confirmModal.classList.add('open');
  }

  if (confirmCancelBackdrop) {
    confirmCancelBackdrop.addEventListener('click', closeConfirm);
  }
  if (confirmCancelBtn) {
    confirmCancelBtn.addEventListener('click', closeConfirm);
  }
  if (confirmYesBtn) {
    confirmYesBtn.addEventListener('click', function () {
      var fn = pendingConfirm;
      closeConfirm();
      if (typeof fn === 'function') {
        fn();
      }
    });
  }

  // Expose confirm helper globally so inline scripts (members, projects) can use it
  window.openConfirm = openConfirm;

  // Password visibility toggles (login / reset screens)
  document.querySelectorAll('.password-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var targetId = btn.getAttribute('data-target');
      if (!targetId) return;
      var input = document.getElementById(targetId);
      if (!input) return;
      var isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');

      // Toggle eye / eye-slash icon if present
      var icon = btn.querySelector('i');
      if (icon) {
        if (isPassword) {
          icon.classList.remove('fa-eye');
          icon.classList.add('fa-eye-slash');
        } else {
          icon.classList.remove('fa-eye-slash');
          icon.classList.add('fa-eye');
        }
      }
    });
  });

  // Show loader on all normal form submits (full-page requests)
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function () {
      // Skip forms that explicitly opt out (e.g. export downloads)
      if (form.hasAttribute('data-no-loader')) {
        return;
      }
      // Skip sheet sync forms – they use a custom loader
      var action = form.getAttribute('action') || '';
      if (action.indexOf('/sync-sheet') !== -1) {
        return;
      }
      if (window.showLoader) {
        window.showLoader();
      }
    });
  });

  // Show loader on internal navigation (sidebar tabs, in-app links)
  document.querySelectorAll('a[href]').forEach(function (link) {
    var href = link.getAttribute('href');
    if (!href) return;
    // Ignore anchors and JS links
    if (href.startsWith('#') || href.startsWith('javascript:')) return;

    link.addEventListener('click', function (e) {
      // Only left-click without modifier keys
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      if (href.startsWith('/summary/team')) {
        if (window.openTeamSummaryLoader) {
          window.openTeamSummaryLoader();
        } else if (window.showLoader) {
          window.showLoader();
        }
      } else if (window.showLoader) {
        window.showLoader();
      }
    });
  });

  var sidebarToggle = document.getElementById('sidebarToggle');
  var sidebar = document.querySelector('.sidebar');
  if (sidebarToggle && sidebar) {
    sidebarToggle.addEventListener('click', function () {
      sidebar.classList.toggle('open');
    });
  }

  var weekendWarning = document.getElementById('weekendWarning');
  if (weekendWarning) {
    var today = new Date();
    var day = today.getDay();
    if (day === 0 || day === 6) {
      weekendWarning.style.display = 'block';
    }
  }

  var addTaskModal = document.getElementById('addTaskModal');
  var openAddTaskModal = document.getElementById('openAddTaskModal');
  var closeAddTaskModal = document.getElementById('closeAddTaskModal');
  var closeAddTaskModalBtn = document.getElementById('closeAddTaskModalBtn');
  var cancelAddTask = document.getElementById('cancelAddTask');
  var memberSelect = document.getElementById('memberId');
  var dateInput = document.getElementById('taskDate');

  function openModal() {
    if (addTaskModal) {
      addTaskModal.classList.add('open');
      if (dateInput && !dateInput.value) {
        var today = new Date();
        dateInput.value = today.toISOString().slice(0, 10);
      }
    }
  }

  function closeModal() {
    if (addTaskModal) {
      addTaskModal.classList.remove('open');
    }
  }

  if (openAddTaskModal) openAddTaskModal.addEventListener('click', openModal);
  if (closeAddTaskModal) closeAddTaskModal.addEventListener('click', closeModal);
  if (closeAddTaskModalBtn) closeAddTaskModalBtn.addEventListener('click', closeModal);
  if (cancelAddTask) cancelAddTask.addEventListener('click', closeModal);

  // Sheet sync loader (Google Sheets extraction-style)
  (function initSheetSyncLoader() {
    var loader = document.getElementById('sheetSyncLoader');
    if (!loader) return;

    var pctNum = document.getElementById('sheetPctNum');
    var barFill = document.getElementById('sheetBarFill');
    var statusEl = document.getElementById('sheetStatus');
    var phaseEl = document.getElementById('sheetPhase');
    var etaEl = document.getElementById('sheetEta');
    var logEl = document.getElementById('sheetLogLine');
    var elapsedEl = document.getElementById('sheetElapsed');
    var stageEl = document.getElementById('sheetStage');
    var doneOverlay = document.getElementById('sheetDoneOverlay');
    var cancelBtn = document.getElementById('sheetCancelBtn');

    var pct = 0;
    var startTime = 0;
    var timerId = null;

    var fetchLogs = [
      '> authenticating with Google Sheets API...',
      '> resolving spreadsheet ID...',
      '> loading sheet metadata...',
      '> establishing secure connection...',
      '> verifying OAuth token...'
    ];
    var readLogs = [
      '> streaming task rows...',
      '> parsing cell values...',
      '> mapping columns to schema...',
      '> detecting duplicates...',
      '> normalising dates...'
    ];
    var genLogs = [
      '> writing tasks into TrackerBabu...',
      '> updating member summaries...',
      '> recomputing daily stats...',
      '> finalising sync session...'
    ];

    function getConfig(p) {
      if (p <= 20) return { delay: 300, status: 'Connecting to Google Sheets…', phase: 'Phase 1 / 3 — CONNECT', stage: 'Connect', pool: fetchLogs };
      if (p <= 50) return { delay: 500, status: 'Reading sheet rows…', phase: 'Phase 2 / 3 — READ', stage: 'Read', pool: readLogs };
      return { delay: 1000, status: 'Syncing tasks into TrackerBabu…', phase: 'Phase 3 / 3 — SYNC', stage: 'Sync', pool: genLogs };
    }

    function updateLog(pool) {
      if (!logEl) return;
      logEl.style.animation = 'none';
      // force reflow
      // eslint-disable-next-line no-unused-expressions
      logEl.offsetWidth;
      logEl.style.animation = 'logFade 0.3s ease';
      logEl.textContent = pool[Math.floor(Math.random() * pool.length)];
    }

    function updateEta(p) {
      if (!etaEl) return;
      var elapsed = (Date.now() - startTime) / 1000;
      if (!p) {
        etaEl.textContent = 'ETA —';
        return;
      }
      var rate = p / elapsed;
      var rem = (100 - p) / rate;
      etaEl.textContent = p >= 100 ? 'Done' : 'ETA ~' + Math.max(1, Math.ceil(rem)) + 's';
    }

    function step() {
      if (!loader || !loader.classList.contains('open')) return;
      if (pct > 100) return;

      var cfg = getConfig(pct);

      if (pctNum) pctNum.textContent = pct;
      if (barFill) barFill.style.width = pct + '%';
      if (statusEl) statusEl.textContent = cfg.status;
      if (phaseEl) phaseEl.textContent = cfg.phase;
      if (stageEl) stageEl.textContent = cfg.stage;

      if (pct % 3 === 0) updateLog(cfg.pool);
      updateEta(pct);

      if (elapsedEl) {
        var elapsed = (Date.now() - startTime) / 1000;
        elapsedEl.textContent = elapsed.toFixed(1) + 's';
      }

      if (pct === 100) {
        if (timerId) window.clearTimeout(timerId);
        if (doneOverlay) {
          setTimeout(function () {
            doneOverlay.classList.add('open');
          }, 450);
        }
        return;
      }

      pct += 1;
      timerId = window.setTimeout(step, getConfig(pct).delay);
    }

    function openSheetLoader() {
      if (!loader) return;
      loader.classList.add('open');
      if (doneOverlay) doneOverlay.classList.remove('open');
      pct = 0;
      startTime = Date.now();
      if (barFill) barFill.style.width = '0%';
      if (pctNum) pctNum.textContent = '0';
      if (statusEl) statusEl.textContent = 'Connecting to Google Sheets…';
      if (phaseEl) phaseEl.textContent = 'Phase 1 / 3 — CONNECT';
      if (etaEl) etaEl.textContent = 'ETA —';
      if (elapsedEl) elapsedEl.textContent = '0.0s';
      if (timerId) window.clearTimeout(timerId);
      timerId = window.setTimeout(step, 400);
    }

    function closeSheetLoader() {
      if (!loader) return;
      loader.classList.remove('open');
      if (timerId) window.clearTimeout(timerId);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        closeSheetLoader();
      });
    }

    // Attach to all sheet sync forms
    document.querySelectorAll('form[action*="/sync-sheet"]').forEach(function (form) {
      form.addEventListener('submit', function () {
        openSheetLoader();
      });
    });

    window.openSheetLoader = openSheetLoader;
    window.closeSheetLoader = closeSheetLoader;
  })();

  // Team / task summary AI loader (segmented progress style)
  (function initTeamSummaryLoader() {
    var loader = document.getElementById('teamSummaryLoader');
    if (!loader) return;

    var barWrap = document.getElementById('aiBarWrap');
    var pctNum = document.getElementById('aiPctNum');
    var statusEl = document.getElementById('aiProgStatus');
    var phaseEl = document.getElementById('aiProgPhase');
    var etaEl = document.getElementById('aiEtaLbl');
    var logEl = document.getElementById('aiLogLine');
    var elapsedEl = document.getElementById('aiElapsedVal');
    var tokensEl = document.getElementById('aiTokensVal');
    var stageEl = document.getElementById('aiStageVal');
    var cancelBtn = document.getElementById('aiCancelBtn');

    var SEGS = 50;
    if (barWrap && barWrap.children.length === 0) {
      for (var i = 0; i < SEGS; i++) {
        var seg = document.createElement('div');
        seg.className = 'ai-task-bar-seg';
        seg.id = 'aiSeg' + i;
        barWrap.appendChild(seg);
      }
    }

    var fetchLogs = [
      '> fetching recent tasks for this period…',
      '> collecting member activity metrics…',
      '> resolving project filters and date range…',
      '> loading task snapshots from database…',
      '> preparing context window for Gemini…'
    ];
    var readLogs = [
      '> analysing status transitions and throughput…',
      '> grouping tasks by member and priority…',
      '> scanning notes and descriptions for patterns…',
      '> computing streaks and completion rates…',
      '> aggregating per-day workload distribution…'
    ];
    var genLogs = [
      '> generating natural language task summary…',
      '> highlighting key wins and blockers…',
      '> extracting follow-up action items…',
      '> formatting output for TrackerBabu UI…',
      '> finalising AI summary payload…'
    ];

    var pct = 0;
    var timerId = null;
    var startTime = 0;
    var tokenCount = 0;

    function getConfig(p) {
      if (p <= 20) return { delay: 100, status: 'Fetching recent tasks…', phase: 'Phase 1 / 3 — Fetch', stage: 'Fetch', pool: fetchLogs }; // 0–20%
      if (p <= 50) return { delay: 200, status: 'Analysing patterns…', phase: 'Phase 2 / 3 — Read', stage: 'Read', pool: readLogs }; // 21–50%
      return { delay: 600, status: 'Generating AI task summary…', phase: 'Phase 3 / 3 — Generate', stage: 'Generate', pool: genLogs }; // 51–100%
    }

    function updateBar(p) {
      if (!barWrap) return;
      var filled = Math.round((p / 100) * SEGS);
      for (var i = 0; i < SEGS; i++) {
        var seg = document.getElementById('aiSeg' + i);
        if (!seg) continue;
        seg.classList.remove('filled-a', 'filled-b', 'filled-c', 'active');
        if (i < filled) {
          var segPct = (i / SEGS) * 100;
          if (segPct <= 20) seg.classList.add('filled-a');
          else if (segPct <= 50) seg.classList.add('filled-b');
          else seg.classList.add('filled-c');
        }
        if (i === filled - 1) {
          seg.classList.add('active');
        }
      }
    }

    function updateLog(pool) {
      if (!logEl) return;
      logEl.style.animation = 'none';
      // force reflow
      // eslint-disable-next-line no-unused-expressions
      logEl.offsetWidth;
      logEl.style.animation = 'aiTaskLogIn 0.25s ease';
      logEl.textContent = pool[Math.floor(Math.random() * pool.length)];
    }

    function updateEta(p) {
      if (!etaEl || !startTime) return;
      var elapsed = (Date.now() - startTime) / 1000;
      if (!p) {
        etaEl.textContent = 'ETA —';
        return;
      }
      var rate = p / elapsed;
      var rem = (100 - p) / rate;
      etaEl.textContent = p >= 100 ? 'Done' : 'ETA ~' + Math.max(1, Math.ceil(rem)) + 's';
    }

    function step() {
      if (!loader || !loader.classList.contains('open')) return;
      if (pct > 100) return;
      var cfg = getConfig(pct);
      if (pctNum) pctNum.textContent = pct;
      if (statusEl) statusEl.textContent = cfg.status;
      if (phaseEl) phaseEl.textContent = cfg.phase;
      if (stageEl) stageEl.textContent = cfg.stage;

      // simulated tokens
      tokenCount += Math.floor(Math.random() * 18) + 6;
      if (tokensEl) tokensEl.textContent = tokenCount;

      if (elapsedEl && startTime) {
        var elapsed = (Date.now() - startTime) / 1000;
        elapsedEl.textContent = elapsed.toFixed(1) + 's';
      }

      updateBar(pct);
      if (pct % 3 === 0) updateLog(cfg.pool);
      updateEta(pct);

      if (pct === 100) {
        updateEta(pct);
        return;
      }
      pct += 1;
      var nextDelay = getConfig(pct).delay;
      timerId = window.setTimeout(step, nextDelay);
    }

    function openTeamLoader() {
      if (!loader) return;
      loader.classList.add('open');
      pct = 0;
      startTime = Date.now();
      tokenCount = 0;
      if (pctNum) pctNum.textContent = '0';
      if (statusEl) statusEl.textContent = 'Fetching recent tasks…';
      if (phaseEl) phaseEl.textContent = 'Phase 1 / 3 — Fetch';
      if (etaEl) etaEl.textContent = 'ETA —';
      if (elapsedEl) elapsedEl.textContent = '0.0s';
      if (tokensEl) tokensEl.textContent = '0';
      updateBar(0);
      if (timerId) window.clearTimeout(timerId);
      timerId = window.setTimeout(step, 300);
    }

    function closeTeamLoader() {
      if (!loader) return;
      loader.classList.remove('open');
      if (timerId) window.clearTimeout(timerId);
    }

    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        closeTeamLoader();
      });
    }

    // Show loader on team summary regenerate submits
    document.querySelectorAll('form[data-team-summary-form]').forEach(function (form) {
      form.addEventListener('submit', function () {
        openTeamLoader();
      });
    });

    window.openTeamSummaryLoader = openTeamLoader;
    window.closeTeamSummaryLoader = closeTeamLoader;
  })();

  if (typeof window.initialQuickMemberId !== 'undefined' && window.initialQuickMemberId) {
    if (memberSelect) {
      memberSelect.value = window.initialQuickMemberId;
    }
    if (dateInput && window.initialQuickDate) {
      dateInput.value = window.initialQuickDate;
    } else if (dateInput && !dateInput.value) {
      var today = new Date();
      dateInput.value = today.toISOString().slice(0, 10);
    }
    openModal();
  }

  // Status change popup
  var statusModal = document.getElementById('statusModal');
  var statusModalBackdrop = document.getElementById('statusModalBackdrop');
  var statusSelect = document.getElementById('statusSelect');
  var statusTaskIdInput = document.getElementById('statusTaskId');
  var statusCancelBtn = document.getElementById('statusCancelBtn');
  var statusSaveBtn = document.getElementById('statusSaveBtn');

  function openStatusModal(taskId, currentStatus) {
    if (!statusModal || !statusSelect || !statusTaskIdInput) return;
    statusTaskIdInput.value = taskId;
    statusSelect.value = currentStatus || 'in-progress';
    statusModal.classList.add('open');
  }

  function closeStatusModal() {
    if (!statusModal) return;
    statusModal.classList.remove('open');
    statusTaskIdInput.value = '';
  }

  if (statusModalBackdrop) {
    statusModalBackdrop.addEventListener('click', closeStatusModal);
  }
  if (statusCancelBtn) {
    statusCancelBtn.addEventListener('click', closeStatusModal);
  }
  if (statusSaveBtn) {
    statusSaveBtn.addEventListener('click', function () {
      var taskId = statusTaskIdInput.value;
      if (!taskId) return closeStatusModal();
      var newStatus = statusSelect.value;

      showLoader();
      fetch('/tasks/' + taskId + '/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: newStatus })
      })
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to update status');
          return res.json();
        })
        .then(function (data) {
          if (!data.success) return;
          var updatedStatus = data.status;
          // update all badges for this task
          document
            .querySelectorAll('.status-toggle[data-task-id=\"' + taskId + '\"]')
            .forEach(function (btn) {
              btn.classList.remove(
                'status-in-progress',
                'status-done',
                'status-blocked',
                'ts-dn',
                'ts-ip',
                'ts-bl'
              );
              var statusClass = updatedStatus === 'done' ? 'ts-dn' : (updatedStatus === 'in-progress' ? 'ts-ip' : 'ts-bl');
              btn.classList.add('status-' + updatedStatus, statusClass);
              var label = updatedStatus === 'done' ? 'Done' : (updatedStatus === 'in-progress' ? 'In Progress' : 'Blocked');
              var dot = btn.querySelector('.tsdot');
              if (dot) {
                btn.innerHTML = '';
                btn.appendChild(dot);
                btn.appendChild(document.createTextNode(label));
              } else {
                btn.textContent = label;
              }
            });
          showToast('Status updated.', 'success');
        })
        .catch(function () {
          showToast('Could not update task status. Please try again.', 'error');
        })
        .finally(function () {
          hideLoader();
          closeStatusModal();
        });
    });
  }

  document.querySelectorAll('.status-toggle').forEach(function (btn) {
    if (btn._boundStatusToggle) return;
    btn._boundStatusToggle = true;
    btn.addEventListener('click', function () {
      var taskId = this.getAttribute('data-task-id');
      var currentStatus = this.getAttribute('data-status') || 'in-progress';
      if (!taskId) return;
      openStatusModal(taskId, currentStatus);
    });
  });

  document.querySelectorAll('.delete-task').forEach(function (btn) {
    if (btn._boundDelete) return;
    btn._boundDelete = true;
    btn.addEventListener('click', function () {
      var taskId = this.getAttribute('data-task-id');
      if (!taskId) return;
      openConfirm('Delete this task?', function () {
        showLoader();
        fetch('/tasks/' + taskId, {
          method: 'DELETE'
        })
          .then(function (res) {
            if (!res.ok) throw new Error('Failed to delete task');
            return res.json();
          })
          .then(function (data) {
            if (!data.success) return;
            var row = document.querySelector('tr[data-task-id="' + taskId + '"]');
            if (row && row.parentNode) {
              row.parentNode.removeChild(row);
            }
            var card = document.querySelector('.task-card[data-task-id="' + taskId + '"]');
            if (card && card.parentNode) {
              card.parentNode.removeChild(card);
            }
            showToast('Task deleted.', 'success');
          })
          .catch(function () {
            showToast('Could not delete task. Please try again.', 'error');
          })
          .finally(function () {
            hideLoader();
          });
      });
    });
  });

  // Contact admin placeholder on auth page
  var contactAdminLink = document.getElementById('contactAdminLink');
  if (contactAdminLink) {
    contactAdminLink.addEventListener('click', function (e) {
      e.preventDefault();
      if (window.showToast) {
        showToast('This functionality will be available soon.', 'success');
      } else {
        window.alert('This functionality will be available soon.');
      }
    });
  }

  // Infinite scroll for tasks (card layout)
  var taskCardsContainer = document.querySelector('.task-list');
  if (window.tasksPagination && taskCardsContainer) {
    var page = window.tasksPagination.page || 1;
    var hasMore = !!window.tasksPagination.hasMore;
    var loading = false;
    var baseQuery = window.tasksPagination.query || '';

    function createTaskCard(task) {
      var statusClass = task.status === 'done' ? 'tc-done' : task.status === 'in-progress' ? 'tc-prog' : 'tc-blk';
      var isDone = task.status === 'done';
      var isProg = task.status === 'in-progress';
      var statusLabel = isDone ? 'Done' : isProg ? 'In Progress' : 'Blocked';
      var div = document.createElement('div');
      div.className = 'task-card ' + statusClass;
      div.setAttribute('data-task-id', task.id);
      var initials =
        (task.member_name || '?')
          .split(' ')
          .map(function (p) {
            return p[0];
          })
          .join('')
          .slice(0, 2)
          .toUpperCase() || '?';
      div.innerHTML =
        '<div class="tc-left">' +
        '  <div class="tc-title">' + (task.task || '') + '</div>' +
        '  <div class="tc-meta">' +
        '    <div class="tc-field">' +
        '      <div class="tc-flbl">Date</div>' +
        '      <div class="tc-fval">' + (task.dateFormatted || '') + '</div>' +
        '    </div>' +
        '    <div class="tc-field">' +
        '      <div class="tc-flbl">Member</div>' +
        '      <div class="tc-fval member-val"><span class="m-tiny">' + initials + '</span>' + (task.member_name || '') + '</div>' +
        '    </div>' +
        '    <div class="tc-field">' +
        '      <div class="tc-flbl">Project</div>' +
        '      <div class="tc-fval">' +
        (task.project_name
          ? '<span class="proj-tag has-proj">' + task.project_name + '</span>'
          : '<span class="proj-tag">No project</span>') +
        '      </div>' +
        '    </div>' +
        '  </div>' +
        '</div>' +
        '<div class="tc-right">' +
        '  <button type="button" class="status-badge status-toggle ' +
        (isDone ? 'sb-done' : isProg ? 'sb-prog' : 'sb-blk') +
        '" data-task-id="' + task.id + '" data-status="' + task.status + '">' +
        '    <span class="sdot"></span>' + statusLabel +
        '  </button>' +
        '  <button type="button" class="del-btn delete-task" data-task-id="' + task.id + '">' +
        '    <i class="fa-solid fa-trash-can" style="font-size:11px;"></i> Delete' +
        '  </button>' +
        '</div>';
      return div;
    }

    function bindTaskInteractions(container) {
      container.querySelectorAll('.status-toggle').forEach(function (btn) {
        if (btn._boundStatusToggle) return;
        btn._boundStatusToggle = true;
        btn.addEventListener('click', function () {
          var taskId = this.getAttribute('data-task-id');
          if (!taskId) return;

          showLoader();
          fetch('/tasks/' + taskId + '/status', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({})
          })
            .then(function (res) {
              if (!res.ok) throw new Error('Failed to update status');
              return res.json();
            })
            .then(function (data) {
              if (!data.success) return;
              var newStatus = data.status;
              btn.classList.remove('status-in-progress', 'status-done', 'status-blocked', 'ts-dn', 'ts-ip', 'ts-bl');
              btn.classList.add('status-' + newStatus);
              var label = newStatus.replace('-', ' ');
              var dot = btn.querySelector('.tsdot');
              if (dot) {
                btn.innerHTML = '';
                btn.appendChild(dot);
                btn.appendChild(document.createTextNode(label));
              } else {
                btn.textContent = label;
              }
              showToast('Status updated.', 'success');
            })
            .catch(function () {
              showToast('Could not update task status. Please try again.', 'error');
            })
            .finally(function () {
              hideLoader();
            });
        });
      });

      container.querySelectorAll('.delete-task').forEach(function (btn) {
        if (btn._boundDelete) return;
        btn._boundDelete = true;
        btn.addEventListener('click', function () {
          var taskId = this.getAttribute('data-task-id');
          if (!taskId) return;
          openConfirm('Delete this task?', function () {
            showLoader();
            fetch('/tasks/' + taskId, {
              method: 'DELETE'
            })
              .then(function (res) {
                if (!res.ok) throw new Error('Failed to delete task');
                return res.json();
              })
              .then(function (data) {
                if (!data.success) return;
                var row = document.querySelector('tr[data-task-id="' + taskId + '"]');
                if (row && row.parentNode) {
                  row.parentNode.removeChild(row);
                }
                var card = document.querySelector('.task-card[data-task-id="' + taskId + '"]');
                if (card && card.parentNode) {
                  card.parentNode.removeChild(card);
                }
                showToast('Task deleted.', 'success');
              })
              .catch(function () {
                showToast('Could not delete task. Please try again.', 'error');
              })
              .finally(function () {
                hideLoader();
              });
          });
        });
      });
    }

    bindTaskInteractions(taskCardsContainer);

    function loadMoreTasks() {
      if (loading || !hasMore) return;
      loading = true;

      var qs = baseQuery ? baseQuery + '&' : '';
      qs += 'page=' + (page + 1);

      showLoader();
      fetch('/tasks/page?' + qs)
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to load more tasks');
          return res.json();
        })
        .then(function (data) {
          if (!data.success) return;
          page += 1;
          hasMore = data.hasMore;

          data.tasks.forEach(function (task) {
            var card = createTaskCard(task);
            taskCardsContainer.appendChild(card);
          });

          bindTaskInteractions(taskCardsContainer);
        })
        .catch(function () {
          // Silent fail, avoid spamming alerts on scroll
        })
        .finally(function () {
          loading = false;
          hideLoader();
        });
    }

    function handleScroll() {
      if (!hasMore || loading) return;

      var scrollPosition = window.innerHeight + window.scrollY;
      var threshold = document.body.offsetHeight - 200;

      if (scrollPosition >= threshold) {
        loadMoreTasks();
      }
    }

    window.addEventListener('scroll', handleScroll);
  }

  // Infinite scroll for members
  var memberGrid = document.getElementById('memberGrid');
  if (window.membersPagination && memberGrid) {
    var mPage = window.membersPagination.page || 1;
    var mHasMore = !!window.membersPagination.hasMore;
    var mLoading = false;
    var mBaseQuery = window.membersPagination.query || '';

    function createMemberCard(member) {
      var div = document.createElement('div');
      div.className = 'mcard';
      div.setAttribute('data-member-id', member.id);
      div.setAttribute('data-member-name', member.name || '');
      div.setAttribute('data-member-role', member.role || '');
      div.setAttribute('data-member-email', member.user_email || '');
      var initials =
        (member.name || '?')
          .split(' ')
          .map(function (p) {
            return p[0];
          })
          .join('')
          .slice(0, 2)
          .toUpperCase() || '?';
      var createdLabel = '';
      if (member.created_at) {
        try {
          createdLabel = new Date(member.created_at).toLocaleDateString('en-GB', {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
        } catch (e) {
          createdLabel = '';
        }
      }
      div.innerHTML =
        '<div class="mcard-inner">' +
        '  <div class="mav-wrap">' +
        '    <div class="mav">' + initials + '</div>' +
        '    <div class="mav-status"></div>' +
        '  </div>' +
        '  <div class="mcard-info">' +
        '    <div class="mcard-top">' +
        '      <div class="mcard-name">' + (member.name || '') + '</div>' +
        '      <div class="mcard-date">' + createdLabel + '</div>' +
        '    </div>' +
        '    <div class="mcard-role"><i class="fa-solid fa-briefcase" style="font-size:10px;"></i>' +
        (member.role || '') +
        '    </div>' +
        '    <div class="mcard-email"><i class="fa-regular fa-envelope" style="font-size:11px;"></i><span>' +
        (member.user_email || 'Not linked') +
        '</span></div>' +
        '  </div>' +
        '  <div class="mcard-right">' +
        '    <button type="button" class="mact-btn mact-view" onclick="window.location.href=\'/members/' + member.id + '\'">' +
        '      <i class="fa-regular fa-eye" style="font-size:11px;"></i> View' +
        '    </button>' +
        '    <button type="button" class="mact-btn mact-edit edit-member" data-member-id="' + member.id + '">' +
        '      <i class="fa-regular fa-pen-to-square" style="font-size:11px;"></i> Edit' +
        '    </button>' +
        '    <form method="post" action="/members/' + member.id + '/delete" class="member-delete-form" style="display:inline;">' +
        '      <button type="button" class="mact-btn mact-del member-delete-btn">' +
        '        <i class="fa-regular fa-trash-can" style="font-size:11px;"></i> Delete' +
        '      </button>' +
        '    </form>' +
        '  </div>' +
        '</div>';
      return div;
    }

    function bindMemberCardInteractions(card) {
      var editBtn = card.querySelector('.edit-member');
      if (editBtn && !editBtn._boundEdit) {
        editBtn._boundEdit = true;
        editBtn.addEventListener('click', function () {
          var modal = document.getElementById('memberModal');
          var memberId = document.getElementById('memberId');
          var memberName = document.getElementById('memberName');
          var memberRole = document.getElementById('memberRole');
          var memberEmail = document.getElementById('memberEmail');
          var modalTitle = document.getElementById('memberModalTitle');
          var submitBtn = document.getElementById('memberSubmitBtn');

          var id = card.getAttribute('data-member-id');
          var name = card.getAttribute('data-member-name') || '';
          var role = card.getAttribute('data-member-role') || '';
          var email = card.getAttribute('data-member-email') || '';

          if (modalTitle) modalTitle.textContent = 'Edit member';
          if (submitBtn) submitBtn.textContent = 'Update member';
          if (memberId) memberId.value = id || '';
          if (memberName) memberName.value = name || '';
          if (memberRole) memberRole.value = role || '';
          if (memberEmail) {
            memberEmail.value = email || '';
            memberEmail.disabled = true;
          }
          if (modal) {
            modal.classList.add('open');
          }
        });
      }

      var delBtn = card.querySelector('.member-delete-btn');
      if (delBtn && !delBtn._boundDelete) {
        delBtn._boundDelete = true;
        delBtn.addEventListener('click', function () {
          var formEl = delBtn.closest('form');
          if (!formEl) return;
          if (typeof openConfirm === 'function') {
            openConfirm(
              'Delete this member? All their tasks will also be removed.',
              function () {
                formEl.submit();
              }
            );
          } else if (
            window.confirm(
              'Delete this member? All their tasks will also be removed.'
            )
          ) {
            formEl.submit();
          }
        });
      }
    }

    function loadMoreMembers() {
      if (mLoading || !mHasMore) return;
      mLoading = true;

      var qs = mBaseQuery ? mBaseQuery + '&' : '';
      qs += 'page=' + (mPage + 1);

      showLoader();
      fetch('/members/page?' + qs)
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to load more members');
          return res.json();
        })
        .then(function (data) {
          if (!data.success) return;
          mPage += 1;
          mHasMore = data.hasMore;

          data.members.forEach(function (member) {
            var card = createMemberCard(member);
            memberGrid.appendChild(card);
            bindMemberCardInteractions(card);
          });
        })
        .catch(function () {
          // silent
        })
        .finally(function () {
          mLoading = false;
          hideLoader();
        });
    }

    function handleMemberScroll() {
      if (!mHasMore || mLoading) return;
      var scrollPosition = window.innerHeight + window.scrollY;
      var threshold = document.body.offsetHeight - 200;
      if (scrollPosition >= threshold) {
        loadMoreMembers();
      }
    }

    window.addEventListener('scroll', handleMemberScroll);
  }

  // Infinite scroll for projects
  var projectGrid = document.getElementById('projectGrid');
  if (window.projectsPagination && projectGrid) {
    var pPage = window.projectsPagination.page || 1;
    var pHasMore = !!window.projectsPagination.hasMore;
    var pLoading = false;
    var pBaseQuery = window.projectsPagination.query || '';

    function createProjectCard(project) {
      var div = document.createElement('div');
      div.className = 'pj-card';
      div.setAttribute('data-project-id', project.id);
      div.setAttribute('data-project-name', project.name || '');
      div.setAttribute('data-project-description', project.description || '');
      div.setAttribute(
        'data-project-status',
        (project.status || 'active').toLowerCase()
      );
      var initials =
        (project.name || '?')
          .split(' ')
          .map(function (p) {
            return p[0];
          })
          .join('')
          .slice(0, 2)
          .toUpperCase() || '?';
      var createdLabel = '';
      if (project.created_at) {
        try {
          createdLabel = new Date(project.created_at).toLocaleDateString(
            'en-GB',
            {
              day: '2-digit',
              month: 'short',
              year: 'numeric'
            }
          );
        } catch (e) {
          createdLabel = '';
        }
      }
      div.innerHTML =
        '<div class="pj-card-top">' +
        '  <div class="pj-logo">' +
        initials +
        '  </div>' +
        '  <div class="pj-top-right"><span class="pj-date">' +
        createdLabel +
        '</span></div>' +
        '</div>' +
        '<div class="pj-title">' +
        (project.name || '') +
        '</div>' +
        '<div class="pj-desc">' +
        (project.description || 'No description added yet.') +
        '</div>' +
        '<div class="pj-card-footer">' +
        '  <button type="button" class="mact-btn pj-edit edit-project" data-project-id="' +
        project.id +
        '"><i class="fa-regular fa-pen-to-square" style="font-size:11px;"></i> Edit</button>' +
        '  <form method="post" action="/projects/' +
        project.id +
        '/delete" class="project-delete-form" style="display:inline;">' +
        '    <button type="button" class="mact-btn pj-del project-delete-btn"><i class="fa-regular fa-trash-can" style="font-size:11px;"></i> Delete</button>' +
        '  </form>' +
        '</div>';
      return div;
    }

    function bindProjectCardInteractions(card) {
      var editBtn = card.querySelector('.edit-project');
      if (editBtn && !editBtn._boundEdit) {
        editBtn._boundEdit = true;
        editBtn.addEventListener('click', function () {
          var projectModal = document.getElementById('projectModal');
          var modalTitle = document.getElementById('projectModalTitle');
          var submitBtn = document.getElementById('projectSubmitBtn');
          var idInput = document.getElementById('projectId');
          var nameInput = document.getElementById('projectName');
          var descInput = document.getElementById('projectDescription');
          var statusSelect = document.getElementById('projectStatus');

          var project = {
            id: card.getAttribute('data-project-id'),
            name: card.getAttribute('data-project-name') || '',
            description: card.getAttribute('data-project-description') || '',
            status: card.getAttribute('data-project-status') || 'active'
          };

          if (modalTitle) modalTitle.textContent = 'Edit project';
          if (submitBtn) submitBtn.textContent = 'Update project';
          if (idInput) idInput.value = project.id || '';
          if (nameInput) nameInput.value = project.name || '';
          if (descInput) descInput.value = project.description || '';
          if (statusSelect) statusSelect.value = project.status || 'active';
          if (projectModal) {
            projectModal.classList.add('open');
            if (nameInput) nameInput.focus();
          }
        });
      }

      var delBtn = card.querySelector('.project-delete-btn');
      if (delBtn && !delBtn._boundDelete) {
        delBtn._boundDelete = true;
        delBtn.addEventListener('click', function () {
          var formEl = delBtn.closest('form');
          if (!formEl) return;
          if (typeof openConfirm === 'function') {
            openConfirm('Delete this project?', function () {
              formEl.submit();
            });
          } else if (window.confirm('Delete this project?')) {
            formEl.submit();
          }
        });
      }
    }

    function loadMoreProjects() {
      if (pLoading || !pHasMore) return;
      pLoading = true;

      var qs = pBaseQuery ? pBaseQuery + '&' : '';
      qs += 'page=' + (pPage + 1);

      showLoader();
      fetch('/projects/page?' + qs)
        .then(function (res) {
          if (!res.ok) throw new Error('Failed to load more projects');
          return res.json();
        })
        .then(function (data) {
          if (!data.success) return;
          pPage += 1;
          pHasMore = data.hasMore;

          data.projects.forEach(function (project) {
            var card = createProjectCard(project);
            projectGrid.appendChild(card);
            bindProjectCardInteractions(card);
          });
        })
        .catch(function () {
          // silent
        })
        .finally(function () {
          pLoading = false;
          hideLoader();
        });
    }

    function handleProjectScroll() {
      if (!pHasMore || pLoading) return;
      var scrollPosition = window.innerHeight + window.scrollY;
      var threshold = document.body.offsetHeight - 200;
      if (scrollPosition >= threshold) {
        loadMoreProjects();
      }
    }

    window.addEventListener('scroll', handleProjectScroll);
  }
});

