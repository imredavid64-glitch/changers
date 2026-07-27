"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showUserForm, setShowUserForm] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [userPreferences, setUserPreferences] = useState(null);
  const router = useRouter();

  useEffect(() => {
    fetchUsers();
    fetchCurrentUser();
    fetchUserPreferences();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await fetch('/api/users');
      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchCurrentUser = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      setCurrentUser(data.user);
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  };

  const fetchUserPreferences = async () => {
    try {
      const response = await fetch('/api/users/preferences');
      const data = await response.json();
      setUserPreferences(data.preferences);
    } catch (error) {
      console.error('Failed to fetch preferences:', error);
    }
  };

  const handleLogin = async (email, password) => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (data.user) {
        setCurrentUser(data.user);
        return { success: true };
      }
      return { success: false, error: data.error };
    } catch (error) {
      return { success: false, error: 'Network error' };
    }
  };

  const handleLogout = async () => {;
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setCurrentUser(null);
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const handleCreateUser = async (userData) => {
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData)
      });
      const data = await response.json();
      setUsers([...users, data.user]);
      setShowUserForm(false);
      return { success: true };
    } catch (error) {
      console.error('Create user error:', error);
      return { success: false, error: 'Failed to create user' };
    }
  };

  const handleUpdateUser = async (userId, updates) => {
    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await response.json();
      setUsers(users.map(u => u.id === userId ? data.user : u));
      if (currentUser && currentUser.id === userId) {
        setCurrentUser(data.user);
      }
      setEditingUser(null);
      return { success: true };
    } catch (error) {
      console.error('Update user error:', error);
      return { success: false, error: 'Failed to update user' };
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    try {
      await fetch(`/api/users/${userId}`, { method: 'DELETE' });
      setUsers(users.filter(u => u.id !== userId));
      if (currentUser && currentUser.id === userId) {
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('Delete user error:', error);
    }
  };

  const updateUserPreferences = async (newPreferences) => {
    try {
      const response = await fetch('/api/users/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newPreferences)
      });
      const data = await response.json();
      setUserPreferences(data.preferences);
      return { success: true };
    } catch (error) {
      console.error('Update preferences error:', error);
      return { success: false, error: 'Failed to update preferences' };
    }
  };

  return (
    <div className="user-management-container">
      <div className="um-header">
        <h2>User Management</h2>
        <div className="um-actions">
          {currentUser ? (
            <div className="user-info">
              <span>Welcome, {currentUser.name}</span>
              <span className={`role-badge ${currentUser.role}`}>{currentUser.role}</span>
              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          ) : (
            <button onClick={() => document.getElementById('login-modal').showModal()} className="login-btn">Login</button>
          )}
          <button onClick={() => setShowUserForm(!showUserForm)} className="add-user-btn">
            {showUserForm ? 'Cancel' : 'Add User'}
          </button>
        </div>
      </div>

      {showUserForm && (
        <div className="user-form-modal">
          <div className="modal-content">
            <h3>{editingUser ? 'Edit User' : 'Add New User'}</h3>
            <UserForm 
              user={editingUser} 
              onSave={editingUser ? 
                (data) => handleUpdateUser(editingUser.id, data).then(() => setShowUserForm(false)) : 
                (data) => handleCreateUser(data).then(() => setShowUserForm(false))
              } 
              onCancel={() => {
                setShowUserForm(false);
                setEditingUser(null);
              }}
            />
          </div>
        </div>
      )}

      <div className="user-dashboard">
        <div className="users-section">
          <h3>Users ({users.length})</h3>
          <div className="users-grid">
            {users.map(user => (
              <UserCard 
                key={user.id} 
                user={user} 
                onEdit={setEditingUser}
                onDelete={handleDeleteUser}
              />
            ))}
          </div>
        </div>

        {currentUser && (
          <div className="preferences-section">
            <h3>User Preferences</h3>
            <UserPreferencesForm 
              preferences={userPreferences} 
              onSave={updateUserPreferences}
            />
          </div>
        )}
      </div>

      {/* Login Modal */}
      <dialog id="login-modal" className="modal">
        <div className="modal-content">
          <h3>Login</h3>
          <LoginForm onLogin={handleLogin} />
        </div>
      </dialog>
    </div>
  );
}

// Helper Components

const LoginForm = ({ onLogin }) => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    const result = await onLogin(formData.email, formData.password);
    if (result.success) {
      document.getElementById('login-modal').close();
    } else {
      alert(`Login failed: ${result.error}`);
    }
    setIsLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="login-form">
      <div>
        <label>Email:</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
        />
      </div>
      <div>
        <label>Password:</label>
        <input
          type="password"
          value={formData.password}
          onChange={(e) => setFormData({...formData, password: e.target.value})}
          required
        />
      </div>
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </form>
  );
};

const UserForm = ({ user, onSave, onCancel }) => {
  const [formData, setFormData] = useState(user || {
    name: '',
    email: '',
    password: '',
    role: 'user',
    preferences: {}
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="user-form">
      <div>
        <label>Name:</label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({...formData, name: e.target.value})}
          required
        />
      </div>
      <div>
        <label>Email:</label>
        <input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
        />
      </div>
      {!user && (
        <div>
          <label>Password:</label>
          <input
            type="password"
            value={formData.password}
            onChange={(e) => setFormData({...formData, password: e.target.value})}
            required
          />
        </div>
      )}
      <div>
        <label>Role:</label>
        <select
          value={formData.role}
          onChange={(e) => setFormData({...formData, role: e.target.value})}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="moderator">Moderator</option>
        </select>
      </div>
      <div className="form-actions">
        <button type="submit">
          {user ? 'Update User' : 'Create User'}
        </button>
        <button type="button" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};

const UserCard = ({ user, onEdit, onDelete }) => {
  return (
    <div className="user-card">
      <div className="user-info">
        <div className="user-avatar">{user.name.charAt(0)}</div>
        <div className="user-details">
          <h4>{user.name}</h4>
          <p>{user.email}</p>
          <span className={`role-badge ${user.role}`}>{user.role}</span>
        </div>
      </div>
      <div className="user-actions">
        <button onClick={() => onEdit(user)} className="edit-btn">Edit</button>
        <button onClick={() => onDelete(user.id)} className="delete-btn">Delete</button>
      </div>
    </div>
  );
};

const UserPreferencesForm = ({ preferences, onSave }) => {
  const [localPrefs, setLocalPrefs] = useState(preferences || {});

  const handleSave = () => {
    onSave(localPrefs);
  };

  return (
    <div className="preferences-form">
      <h4>Notification Settings</h4>
      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={localPrefs.emailNotifications || false}
            onChange={(e) => setLocalPrefs({
              ...localPrefs,
              emailNotifications: e.target.checked
            })}
          />
          Email Notifications
        </label>
      </div>
      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={localPrefs.pushNotifications || false}
            onChange={(e) => setLocalPrefs({
              ...localPrefs,
              pushNotifications: e.target.checked
            })}
          />
          Push Notifications
        </label>
      </div>
      <div className="preference-item">
        <label>
          <input
            type="checkbox"
            checked={localPrefs.theme || false}
            onChange={(e) => setLocalPrefs({
              ...localPrefs,
              theme: e.target.checked ? 'dark' : 'light'
            })}
          />
          Dark Theme
        </label>
      </div>
      <div className="preference-item">
        <label>Content Preferences:</label>
        <select
          value={localPrefs.contentFilter || 'all'}
          onChange={(e) => setLocalPrefs({
            ...localPrefs,
            contentFilter: e.target.value
          })}
        >
          <option value="all">All Content</option>
          <option value="sustainability_only">Sustainability Only</option>
          <option value="personal_only">Personal Only</option>
        </select>
      </div>
      <button onClick={handleSave} className="save-preferences-btn">
        Save Preferences
      </button>
    </div>
  );
};