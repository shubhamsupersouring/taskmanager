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
    var chk = document.getElementById('themeChk');
    if (chk) chk.checked = theme === 'light';
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

  // Sidebar theme toggle (checkbox): clicking the label toggles checkbox, we react to change
  function initThemeChk() {
    var themeChk = document.getElementById('themeChk');
    if (themeChk && !themeChk._themeBound) {
      themeChk._themeBound = true;
      themeChk.addEventListener('change', function () {
        applyTheme(this.checked ? 'light' : 'dark');
      });
    }
  }
  initThemeChk();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initThemeChk);
  }

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

  // Infinite scroll for tasks
  var tasksTableBody = document.getElementById('tasksTableBody');
  var taskCardsContainer = document.getElementById('taskCardsContainer');
  if (window.tasksPagination && tasksTableBody && taskCardsContainer) {
    var page = window.tasksPagination.page || 1;
    var hasMore = !!window.tasksPagination.hasMore;
    var loading = false;
    var baseQuery = window.tasksPagination.query || '';

    function createTaskRow(task) {
      var statusClass = task.status === 'done' ? 'dn' : task.status === 'in-progress' ? 'ip' : 'bl';
      var statusLabel = task.status === 'done' ? 'Done' : task.status === 'in-progress' ? 'In Progress' : 'Blocked';
      var tr = document.createElement('tr');
      tr.setAttribute('data-task-id', task.id);
      tr.innerHTML =
        '<td>' + (task.task || '') + '</td>' +
        '<td style="color:var(--dim2)">' + (task.project_name || '—') + '</td>' +
        '<td>' +
        '  <button type="button" class="tstatus status-toggle ts-' + statusClass + ' status-' + task.status + '" data-task-id="' + task.id + '" data-status="' + task.status + '">' +
        '    <span class="tsdot"></span>' + statusLabel +
        '  </button>' +
        '</td>' +
        '<td style="color:var(--dim2)">' + (task.dateFormatted || '') + '</td>' +
        '<td style="color:var(--dim2)">' + (task.member_name || '') + '</td>' +
        '<td>' +
        '  <button type="button" class="ts-delete delete-task" data-task-id="' + task.id + '"><i class="fa-solid fa-trash-can" style="font-size:11px;"></i> Delete</button>' +
        '</td>';
      return tr;
    }

    function createTaskCard(task) {
      var statusClass = task.status === 'done' ? 'dn' : task.status === 'in-progress' ? 'ip' : 'bl';
      var statusLabel = task.status === 'done' ? 'Done' : task.status === 'in-progress' ? 'In Progress' : 'Blocked';
      var div = document.createElement('div');
      div.className = 'ts-task-card';
      div.setAttribute('data-task-id', task.id);
      div.innerHTML =
        '<div class="ts-task-card-h">' +
        '  <div class="ts-task-title">' + (task.task || '') + '</div>' +
        '  <button type="button" class="tstatus status-toggle ts-' + statusClass + ' status-' + task.status + '" data-task-id="' + task.id + '" data-status="' + task.status + '">' +
        '    <span class="tsdot"></span>' + statusLabel +
        '  </button>' +
        '</div>' +
        '<div class="ts-task-card-b">' +
        '  <div class="ts-meta"><span class="ts-meta-l">Project</span><span class="ts-meta-v">' + (task.project_name || '—') + '</span></div>' +
        '  <div class="ts-meta"><span class="ts-meta-l">Date</span><span class="ts-meta-v">' + (task.dateFormatted || '') + '</span></div>' +
        '  <div class="ts-meta"><span class="ts-meta-l">Member</span><span class="ts-meta-v">' + (task.member_name || '') + '</span></div>' +
        '</div>' +
        '<div class="ts-task-card-f">' +
        '  <button type="button" class="ts-delete delete-task" data-task-id="' + task.id + '"><i class="fa-solid fa-trash-can"></i> Delete</button>' +
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

    var scrollContainer = document.querySelector('.main-content') || window;

    function handleScroll() {
      if (!hasMore || loading) return;

      var scrollPosition;
      var threshold;

      if (scrollContainer === window) {
        scrollPosition = window.innerHeight + window.scrollY;
        threshold = document.body.offsetHeight - 200;
      } else {
        scrollPosition = scrollContainer.scrollTop + scrollContainer.clientHeight;
        threshold = scrollContainer.scrollHeight - 200;
      }

      if (scrollPosition >= threshold) {
        loadMoreTasks();
      }
    }

    scrollContainer.addEventListener('scroll', handleScroll);
  }
});

