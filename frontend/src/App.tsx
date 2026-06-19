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
  const [backendVersion, setBackendVersion] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'date' | 'priority' | 'status'>('date');

  // Editing state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState('');
  const [editingPriority, setEditingPriority] = useState('medium');

  const BACKEND_ROOT_URL = (window as any).env?.VITE_API_URL || import.meta.env.VITE_API_URL || 'http://localhost:3000';
  const API_URL = BACKEND_ROOT_URL + '/tasks';
  const ENV_NAME = (window as any).env?.ENVIRONMENT_NAME || '';

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
    const fetchBackendVersion = async () => {
      try {
        const response = await fetch(API_URL + '/version');
        if (response.ok) {
          const data = await response.json();
          if (data && data.version) {
            setBackendVersion(data.version);
          }
        }
      } catch (err) {
        console.error('Error fetching backend version:', err);
      }
    };
    fetchBackendVersion();
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

  const handleClearCompleted = async () => {
    const completedTasks = tasks.filter(t => t.isCompleted);
    if (completedTasks.length === 0) return;
    if (!confirm(`Naozaj chcete vymazať všetkých ${completedTasks.length} dokončených úloh?`)) return;
    
    try {
      setLoading(true);
      await Promise.all(
        completedTasks.map(task => 
          fetch(`${API_URL}/${task.id}`, {
            method: 'DELETE',
          })
        )
      );
      fetchTasks();
    } catch (err) {
      console.error(err);
      setError('Nepodarilo sa vymazať dokončené úlohy.');
    } finally {
      setLoading(false);
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

  // Sort tasks helper
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'priority') {
      const priorityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
      const weightA = priorityWeight[a.priority] || 0;
      const weightB = priorityWeight[b.priority] || 0;
      return weightB - weightA;
    }
    if (sortBy === 'status') {
      if (a.isCompleted === b.isCompleted) return 0;
      return a.isCompleted ? 1 : -1;
    }
    return b.id - a.id;
  });

  return (
    <div className="todo-container">
      <header className="todo-header">
        <h1>Task Manager Pro</h1>
        <div className="badges-container" style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '8px', flexWrap: 'wrap' }}>
          {ENV_NAME && (
            <div style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '12px',
              fontSize: '0.85rem',
              fontWeight: 'bold',
              textTransform: 'uppercase',
              backgroundColor: ENV_NAME.toLowerCase() === 'prod' || ENV_NAME.toLowerCase() === 'production' ? '#ef4444' : (ENV_NAME.toLowerCase() === 'test' || ENV_NAME.toLowerCase() === 'testing' ? '#f59e0b' : '#3b82f6'),
              color: '#fff'
            }}>
              {ENV_NAME} Environment
            </div>
          )}
          <div style={{
            display: 'inline-block',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '0.85rem',
            fontWeight: 'bold',
            backgroundColor: '#10b981',
            color: '#fff'
          }}>
            v1.3.0
          </div>
        </div>
        <p className="todo-subtitle" style={{ marginTop: '12px' }}>An enhanced containerized Full-Stack Task Board</p>
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

          {/* Task Statistics Widget */}
          <div className="stats-widget" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
            gap: '12px',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            padding: '16px',
            borderRadius: '8px',
            marginBottom: '20px',
            border: '1px dashed rgba(255, 255, 255, 0.1)'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#60a5fa' }}>{tasks.length}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Celkovo</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f59e0b' }}>{tasks.filter(t => !t.isCompleted).length}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Aktívne</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>{tasks.filter(t => t.isCompleted).length}</div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Dokončené</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#a78bfa' }}>
                {tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.isCompleted).length / tasks.length) * 100)}%
              </div>
              <div style={{ fontSize: '0.75rem', opacity: 0.7 }}>Pokrok</div>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <div className="todo-controls" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="todo-search-input"
                style={{ flex: 1 }}
              />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="todo-select"
                style={{ width: 'auto', padding: '8px 12px' }}
              >
                <option value="date">📅 Najnovšie</option>
                <option value="priority">🔥 Podľa priority</option>
                <option value="status">✅ Podľa stavu</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div className="filter-tabs" style={{ margin: 0 }}>
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

              {tasks.some(t => t.isCompleted) && (
                <button
                  onClick={handleClearCompleted}
                  style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '8px 12px',
                    fontSize: '0.85rem',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                >
                  🗑️ Vymazať dokončené
                </button>
              )}
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
              {sortedTasks.map((task) => (
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
        <p>Connected to Backend API: <code>{API_URL}</code> {backendVersion && `[Backend version: ${backendVersion}]`}</p>
        <p style={{ marginTop: '6px', opacity: 0.8, fontSize: '0.85rem' }}>Frontend Version: <code>v1.3.0</code></p>
      </footer>
    </div>
  );
}

export default App;

