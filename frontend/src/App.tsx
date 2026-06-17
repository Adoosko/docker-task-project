import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import './App.css';

interface Task {
  id: number;
  text: string;
}

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // We read the backend URL from an environment variable if present, otherwise default to localhost:3000
  // Note: Vite exposes env variables prefixed with VITE_
  const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000') + '/tasks';

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const response = await fetch(API_URL);
      if (!response.ok) {
        throw new Error('Failed to fetch tasks');
      }
      const data = await response.json();
      setTasks(data);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError('Could not load tasks from API.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmedText = newTaskText.trim();
    if (!trimmedText) return;

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: trimmedText }),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      setNewTaskText('');
      // Reload tasks after successfully creating a new one
      fetchTasks();
    } catch (err: any) {
      console.error(err);
      setError('Could not add task. Please try again.');
    }
  };

  return (
    <div className="todo-container">
      <header className="todo-header">
        <h1>Task Manager</h1>
        <p className="todo-subtitle">Simple, containerized Full-Stack TODO Application</p>
      </header>

      <main className="todo-main">
        <section className="todo-card">
          <form onSubmit={handleSubmit} className="todo-form">
            <input
              type="text"
              placeholder="What needs to be done?"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              className="todo-input"
              required
            />
            <button type="submit" className="todo-button">
              Add Task
            </button>
          </form>

          {error && (
            <div className="todo-error">
              <span>⚠️</span> {error}
              <button onClick={fetchTasks} className="retry-button">Retry</button>
            </div>
          )}

          {loading ? (
            <div className="todo-loading">
              <div className="spinner"></div>
              <span>Loading tasks...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="todo-empty">
              <span className="empty-icon">🎉</span>
              <p>No tasks yet. Enjoy your free time or add one above!</p>
            </div>
          ) : (
            <ul className="todo-list">
              {tasks.map((task) => (
                <li key={task.id} className="todo-item">
                  <span className="task-badge">{task.id}</span>
                  <span className="task-text">{task.text}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="todo-footer">
        <p>API Endpoint: <code>{API_URL}</code></p>
      </footer>
    </div>
  );
}

export default App;
