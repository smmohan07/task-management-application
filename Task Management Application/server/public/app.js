const apiBase = '/api';
const authSection = document.getElementById('authSection');
const taskSection = document.getElementById('taskSection');
const authForm = document.getElementById('authForm');
const authTitle = document.getElementById('authTitle');
const nameInput = document.getElementById('nameInput');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authMessage = document.getElementById('authMessage');
const showLogin = document.getElementById('showLogin');
const showRegister = document.getElementById('showRegister');
const logoutBtn = document.getElementById('logoutBtn');
const welcomeText = document.getElementById('welcomeText');
const newTaskBtn = document.getElementById('newTaskBtn');
const taskEditor = document.getElementById('taskEditor');
const editorTitle = document.getElementById('editorTitle');
const taskTitleInput = document.getElementById('taskTitleInput');
const taskDescInput = document.getElementById('taskDescInput');
const saveTaskBtn = document.getElementById('saveTaskBtn');
const cancelTaskBtn = document.getElementById('cancelTaskBtn');
const taskMessage = document.getElementById('taskMessage');
const taskList = document.getElementById('taskList');
const taskFilters = document.querySelectorAll('.task-filters button');

let currentMode = 'login';
let currentUser = null;
let currentToken = null;
let editingTaskId = null;
let currentFilter = 'all';
let tasks = [];

function setMessage(element, text, isError = true) {
  element.textContent = text;
  if (!text) element.textContent = '';
}

function setAuthMode(mode) {
  currentMode = mode;
  const isRegister = mode === 'register';
  authTitle.textContent = isRegister ? 'Register' : 'Login';
  showLogin.classList.toggle('active', mode === 'login');
  showRegister.classList.toggle('active', mode === 'register');
  nameInput.parentElement.style.display = isRegister ? 'block' : 'none';
  passwordInput.value = '';
  setMessage(authMessage, '');
}

function updateAuthState() {
  const savedToken = localStorage.getItem('taskAppToken');
  const savedUser = localStorage.getItem('taskAppUser');
  if (savedToken && savedUser) {
    currentToken = savedToken;
    currentUser = JSON.parse(savedUser);
    authSection.classList.add('hide');
    taskSection.classList.remove('hide');
    logoutBtn.classList.remove('hide');
    welcomeText.textContent = `Welcome back, ${currentUser.name}!`;
    loadTasks();
  } else {
    authSection.classList.remove('hide');
    taskSection.classList.add('hide');
    logoutBtn.classList.add('hide');
  }
}

async function apiRequest(path, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (currentToken) headers.Authorization = `Bearer ${currentToken}`;

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || 'Request failed');
  }

  if (response.status === 204) return null;
  return response.json();
}

async function loadTasks() {
  try {
    tasks = await apiRequest('/tasks');
    renderTasks();
  } catch (error) {
    setMessage(taskMessage, error.message);
  }
}

function renderTasks() {
  const filtered = tasks.filter((task) => {
    if (currentFilter === 'all') return true;
    return task.status === currentFilter;
  });

  taskList.innerHTML = filtered.length
    ? filtered.map(renderTaskCard).join('')
    : `<div class="task-item"><p>No ${currentFilter} tasks yet.</p></div>`;
}

function renderTaskCard(task) {
  const completedClass = task.status === 'completed' ? 'badge completed' : 'badge';
  return `
    <article class="task-item">
      <div class="task-meta">
        <h3>${escapeHtml(task.title)}</h3>
        <span class="badge">${task.status}</span>
      </div>
      <p>${escapeHtml(task.description || 'No description provided.')}</p>
      <div class="task-meta">
        <small>Updated ${new Date(task.updatedAt).toLocaleString()}</small>
        <div class="task-actions">
          <button onclick="toggleComplete('${task.id}')">${task.status === 'completed' ? 'Mark Pending' : 'Mark Complete'}</button>
          <button onclick="editTask('${task.id}')">Edit</button>
          <button class="delete" onclick="deleteTask('${task.id}')">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const name = nameInput.value.trim();

  if (!email || !password || (currentMode === 'register' && !name)) {
    setMessage(authMessage, 'Please complete all required fields.');
    return;
  }

  try {
    const url = currentMode === 'register' ? '/register' : '/login';
    const payload = { email, password, ...(currentMode === 'register' ? { name } : {}) };
    const result = await apiRequest(url, 'POST', payload);
    currentToken = result.token;
    currentUser = result.user;
    localStorage.setItem('taskAppToken', currentToken);
    localStorage.setItem('taskAppUser', JSON.stringify(currentUser));
    updateAuthState();
  } catch (error) {
    setMessage(authMessage, error.message);
  }
}

function resetTaskEditor() {
  editingTaskId = null;
  taskTitleInput.value = '';
  taskDescInput.value = '';
  editorTitle.textContent = 'New Task';
  setMessage(taskMessage, '');
}

function openTaskEditor(task = null) {
  taskEditor.classList.remove('hide');
  if (task) {
    editingTaskId = task.id;
    taskTitleInput.value = task.title;
    taskDescInput.value = task.description;
    editorTitle.textContent = 'Edit Task';
  } else {
    resetTaskEditor();
  }
}

function closeTaskEditor() {
  taskEditor.classList.add('hide');
  resetTaskEditor();
}

async function saveTask() {
  const title = taskTitleInput.value.trim();
  const description = taskDescInput.value.trim();
  if (!title) {
    setMessage(taskMessage, 'A task title is required.');
    return;
  }

  try {
    if (editingTaskId) {
      const updated = await apiRequest(`/tasks/${editingTaskId}`, 'PUT', { title, description });
      tasks = tasks.map((task) => (task.id === updated.id ? updated : task));
    } else {
      const created = await apiRequest('/tasks', 'POST', { title, description });
      tasks.unshift(created);
    }
    closeTaskEditor();
    renderTasks();
  } catch (error) {
    setMessage(taskMessage, error.message);
  }
}

window.editTask = (id) => {
  const task = tasks.find((item) => item.id === id);
  if (task) openTaskEditor(task);
};

window.deleteTask = async (id) => {
  if (!confirm('Delete this task?')) return;
  try {
    await apiRequest(`/tasks/${id}`, 'DELETE');
    tasks = tasks.filter((task) => task.id !== id);
    renderTasks();
  } catch (error) {
    setMessage(taskMessage, error.message);
  }
};

window.toggleComplete = async (id) => {
  const task = tasks.find((item) => item.id === id);
  if (!task) return;
  const newStatus = task.status === 'completed' ? 'pending' : 'completed';
  try {
    const updated = await apiRequest(`/tasks/${id}`, 'PUT', { status: newStatus });
    tasks = tasks.map((item) => (item.id === id ? updated : item));
    renderTasks();
  } catch (error) {
    setMessage(taskMessage, error.message);
  }
};

function setFilter(filter) {
  currentFilter = filter;
  taskFilters.forEach((button) => button.classList.toggle('active', button.dataset.filter === filter));
  renderTasks();
}

authForm.addEventListener('submit', handleAuthSubmit);
showLogin.addEventListener('click', () => setAuthMode('login'));
showRegister.addEventListener('click', () => setAuthMode('register'));
logoutBtn.addEventListener('click', () => {
  localStorage.removeItem('taskAppToken');
  localStorage.removeItem('taskAppUser');
  currentToken = null;
  currentUser = null;
  updateAuthState();
});
newTaskBtn.addEventListener('click', () => openTaskEditor());
cancelTaskBtn.addEventListener('click', (event) => {
  event.preventDefault();
  closeTaskEditor();
});
saveTaskBtn.addEventListener('click', async (event) => {
  event.preventDefault();
  await saveTask();
});
taskFilters.forEach((button) => {
  button.addEventListener('click', () => setFilter(button.dataset.filter));
});

setAuthMode('login');
updateAuthState();
