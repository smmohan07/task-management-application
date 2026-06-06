# Task Management Application

A full-stack task manager with user authentication, CRUD task operations, and a responsive web UI.

## Features

- Register and login users
- Create, read, update, and delete tasks
- Task status tracking (pending/completed)
- Responsive design for desktop and mobile
- Simple JSON persistence via lowdb

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Start the server:

   ```bash
   npm start
   ```

3. Open your browser at `http://localhost:3000`

## Project structure

- `server/app.js` - Express API and static file server
- `server/data/db.json` - Local JSON data storage
- `server/public` - Frontend static assets

Enjoy building and extending the task manager!
