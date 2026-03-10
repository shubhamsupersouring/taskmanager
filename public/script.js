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
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
    }
    localStorage.setItem(THEME_KEY, theme);
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
    });
  });

  // Show loader on all normal form submits (full-page requests)
  document.querySelectorAll('form').forEach(function (form) {
    form.addEventListener('submit', function () {
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
      if (window.showLoader) {
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

  document.querySelectorAll('.status-toggle').forEach(function (btn) {
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
          btn.classList.remove('status-in-progress', 'status-done', 'status-blocked');
          btn.classList.add('status-' + newStatus);
          btn.textContent = newStatus.replace('-', ' ');
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

  // Infinite scroll for tasks
  var tasksTableBody = document.getElementById('tasksTableBody');
  var taskCardsContainer = document.getElementById('taskCardsContainer');
  if (window.tasksPagination && tasksTableBody && taskCardsContainer) {
    var page = window.tasksPagination.page || 1;
    var hasMore = !!window.tasksPagination.hasMore;
    var loading = false;
    var baseQuery = window.tasksPagination.query || '';

    function createTaskRow(task) {
      var tr = document.createElement('tr');
      tr.setAttribute('data-task-id', task.id);
      tr.innerHTML =
        '<td>' + task.dateFormatted + '</td>' +
        '<td>' + task.member_name + '</td>' +
        '<td>' + task.task + '</td>' +
        '<td>' + (task.project_name || '-') + '</td>' +
        '<td>' +
        '  <button class="status-toggle status-pill status-' + task.status + '" data-task-id="' + task.id + '">' +
        task.status.replace('-', ' ') +
        '  </button>' +
        '</td>' +
        '<td>' +
        '  <button class="btn-link text-danger delete-task" data-task-id="' + task.id + '">Delete</button>' +
        '</td>';
      return tr;
    }

    function createTaskCard(task) {
      var div = document.createElement('div');
      div.className = 'task-card';
      div.setAttribute('data-task-id', task.id);
      div.innerHTML =
        '<div class="task-card-header">' +
        '  <div class="task-card-title">' + task.task + '</div>' +
        '  <button class="status-toggle status-pill status-' + task.status + '" data-task-id="' + task.id + '">' +
        task.status.replace('-', ' ') +
        '  </button>' +
        '</div>' +
        '<div class="task-card-body">' +
        '  <div class="task-card-meta">' +
        '    <span class="task-meta-label">Date</span>' +
        '    <span class="task-meta-value">' + task.dateFormatted + '</span>' +
        '  </div>' +
        '  <div class="task-card-meta">' +
        '    <span class="task-meta-label">Member</span>' +
        '    <span class="task-meta-value">' + task.member_name + '</span>' +
        '  </div>' +
        '  <div class="task-card-meta">' +
        '    <span class="task-meta-label">Project</span>' +
        '    <span class="task-meta-value">' + (task.project_name || '-') + '</span>' +
        '  </div>' +
        '</div>' +
        '<div class="task-card-footer">' +
        '  <button class="btn-link text-danger delete-task" data-task-id="' + task.id + '">Delete</button>' +
        '</div>';
      return div;
    }

    function bindTaskRowInteractions(container) {
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
              btn.classList.remove('status-in-progress', 'status-done', 'status-blocked');
              btn.classList.add('status-' + newStatus);
              btn.textContent = newStatus.replace('-', ' ');
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

    bindTaskRowInteractions(tasksTableBody);
    bindTaskRowInteractions(taskCardsContainer);

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
            var tr = createTaskRow(task);
            tasksTableBody.appendChild(tr);
            var card = createTaskCard(task);
            taskCardsContainer.appendChild(card);
          });

          bindTaskRowInteractions(tasksTableBody);
          bindTaskRowInteractions(taskCardsContainer);
        })
        .catch(function () {
          // Silent fail, avoid spamming alerts on scroll
        })
        .finally(function () {
          loading = false;
          hideLoader();
        });
    }

    window.addEventListener('scroll', function () {
      if (!hasMore || loading) return;
      var scrollPosition = window.innerHeight + window.scrollY;
      var threshold = document.body.offsetHeight - 200;
      if (scrollPosition >= threshold) {
        loadMoreTasks();
      }
    });
  }
});

