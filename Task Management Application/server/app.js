const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Low } = require('lowdb');
const { JSONFile } = require('lowdb/node');
const { nanoid } = require('nanoid');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'task-management-secret';

const dataDir = path.join(__dirname, 'data');
const dbFile = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const adapter = new JSONFile(dbFile);
const db = new Low(adapter, { users: [], tasks: [] });

async function initializeDb() {
  await db.read();
  db.data = db.data || { users: [], tasks: [] };
  await db.write();
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Missing token' });

  jwt.verify(token, JWT_SECRET, (err, payload) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.user = payload;
    next();
  });
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required.' });
  }

  await db.read();
  const existing = db.data.users.find((user) => user.email === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: 'Email already registered.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: nanoid(),
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    createdAt: new Date().toISOString(),
  };

  db.data.users.push(user);
  await db.write();

  const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
  res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  await db.read();
  const user = db.data.users.find((item) => item.email === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const matched = await bcrypt.compare(password, user.password);
  if (!matched) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const token = jwt.sign({ userId: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/me', authenticateToken, async (req, res) => {
  await db.read();
  const user = db.data.users.find((item) => item.id === req.user.userId);
  if (!user) return res.status(404).json({ message: 'User not found.' });
  res.json({ id: user.id, name: user.name, email: user.email });
});

app.get('/api/tasks', authenticateToken, async (req, res) => {
  await db.read();
  const tasks = db.data.tasks.filter((task) => task.userId === req.user.userId);
  res.json(tasks.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)));
});

app.post('/api/tasks', authenticateToken, async (req, res) => {
  const { title, description } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'Task title is required.' });
  }

  await db.read();
  const newTask = {
    id: nanoid(),
    userId: req.user.userId,
    title,
    description: description || '',
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  db.data.tasks.push(newTask);
  await db.write();
  res.status(201).json(newTask);
});

app.put('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { title, description, status } = req.body;
  await db.read();

  const task = db.data.tasks.find((item) => item.id === id && item.userId === req.user.userId);
  if (!task) return res.status(404).json({ message: 'Task not found.' });

  if (title !== undefined) task.title = title;
  if (description !== undefined) task.description = description;
  if (status === 'pending' || status === 'completed') task.status = status;
  task.updatedAt = new Date().toISOString();

  await db.write();
  res.json(task);
});

app.delete('/api/tasks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  await db.read();

  const index = db.data.tasks.findIndex((item) => item.id === id && item.userId === req.user.userId);
  if (index === -1) return res.status(404).json({ message: 'Task not found.' });

  db.data.tasks.splice(index, 1);
  await db.write();
  res.status(204).send();
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initializeDb().then(() => {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
});
