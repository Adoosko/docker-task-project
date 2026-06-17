import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import './App.css';

interface Task {
  id: number;
  text: string;
  isCompleted: boolean;
  priority: string;
  createdAt: string;
}

type FilterType = 'all' | 'active' | 'completed';

function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingPriority, setEditingPriority] = useState('medium');

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
        body: JSON.stringify({
          text: trimmedText,
          priority: newTaskPriority,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create task');
      }

      setNewTaskText('');
      setNewTaskPriority('medium');
      fetchTasks();
    } catch (err: any) {
      console.error(err);
      setError('Could not add task. Please try again.');
    }
  };

  const handleToggleComplete = async (task: Task) => {
    try {
      const response = await fetch(`${API_URL}/${task.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isCompleted: !task.isCompleted,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update task');
      }

      fetchTasks();
    } catch (err: any) {
      console.error(err);
      setError('Could not update task status.');
    }
  };

  const handleStartEdit = (task: Task) => {
    setEditingId(task.id);
    setEditingText(task.text);
    setEditingPriority(task.priority);
  };

  const handleSaveEdit = async (id: number) => {
    const trimmedText = editingText.trim();
    if (!trimmedText) return;

    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: trimmedText,
          priority: editingPriority,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save task edit');
      }

      setEditingId(null);
      fetchTasks();
    } catch (err: any) {
      console.error(err);
      setError('Could not save task details.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete task');
      }

      fetchTasks();
    } catch (err: any) {
      console.error(err);
      setError('Could not delete task.');
    }
  };

  // Filter & Search tasks
  const filteredTasks = tasks.filter((task) => {
    const matchesSearch = task.text.toLowerCase().includes(searchTerm.toLowerCase());
    if (filter === 'active') {
      return !task.isCompleted && matchesSearch;
    }
    if (filter === 'completed') {
      return task.isCompleted && matchesSearch;
    }
    return matchesSearch;
  });

  return (
    <div className="todo-container">
      <header className="todo-header">
        <h1>Task Manager Pro</h1>
        <p className="todo-subtitle">An enhanced containerized Full-Stack Task Board</p>
      </header>

      <main className="todo-main">
        <section className="todo-card">
          {/* Create Task Form */}
          <form onSubmit={handleSubmit} className="todo-form">
            <input
              type="text"
              placeholder="What needs to be done?"
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              className="todo-input"
              required
            />
            <div className="form-controls">
              <label htmlFor="priority-select">Priority:</label>
              <select
                id="priority-select"
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
                className="todo-select"
              >
                <option value="low">🟢 Low</option>
                <option value="medium">🟡 Medium</option>
                <option value="high">🔴 High</option>
              </select>
              <button type="submit" className="todo-button">
                Add Task
              </button>
            </div>
          </form>

          {/* Search and Filter Controls */}
          <div className="todo-controls">
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="todo-search-input"
            />
            <div className="filter-tabs">
              <button
                className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                onClick={() => setFilter('all')}
              >
                All ({tasks.length})
              </button>
              <button
                className={`filter-tab ${filter === 'active' ? 'active' : ''}`}
                onClick={() => setFilter('active')}
              >
                Active ({tasks.filter(t => !t.isCompleted).length})
              </button>
              <button
                className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
                onClick={() => setFilter('completed')}
              >
                Completed ({tasks.filter(t => t.isCompleted).length})
              </button>
            </div>
          </div>

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
          ) : filteredTasks.length === 0 ? (
            <div className="todo-empty">
              <span className="empty-icon">✨</span>
              <p>No tasks found. Relax or add a new task!</p>
            </div>
          ) : (
            <ul className="todo-list">
              {filteredTasks.map((task) => (
                <li key={task.id} className={`todo-item ${task.isCompleted ? 'completed' : ''}`}>
                  <div className="todo-item-left">
                    <input
                      type="checkbox"
                      checked={task.isCompleted}
                      onChange={() => handleToggleComplete(task)}
                      className="todo-checkbox"
                    />
                    
                    {editingId === task.id ? (
                      <div className="edit-container">
                        <input
                          type="text"
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className="todo-edit-input"
                          autoFocus
                        />
                        <select
                          value={editingPriority}
                          onChange={(e) => setEditingPriority(e.target.value)}
                          className="todo-edit-select"
                        >
                          <option value="low">🟢 Low</option>
                          <option value="medium">🟡 Medium</option>
                          <option value="high">🔴 High</option>
                        </select>
                      </div>
                    ) : (
                      <div className="task-content">
                        <span className="task-text">{task.text}</span>
                        <span className={`priority-badge ${task.priority}`}>
                          {task.priority.toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="todo-item-actions">
                    {editingId === task.id ? (
                      <>
                        <button
                          onClick={() => handleSaveEdit(task.id)}
                          className="action-btn save-btn"
                          title="Save changes"
                        >
                          💾 Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="action-btn cancel-btn"
                          title="Cancel editing"
                        >
                          ❌ Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleStartEdit(task)}
                          className="action-btn edit-btn"
                          title="Edit task"
                          disabled={task.isCompleted}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => handleDelete(task.id)}
                          className="action-btn delete-btn"
                          title="Delete task"
                        >
                          🗑️ Delete
                        </button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <footer className="todo-footer">
        <p>Connected to Backend API: <code>{API_URL}</code></p>
      </footer>
    </div>
  );
}

export default App;

