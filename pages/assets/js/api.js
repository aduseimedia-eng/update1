// KudiSave - API Service
// Handles all communication with backend

// API Configuration - set by config.js
const API_BASE_URL = window.KUDISAVE_API_URL;

// User preferences (loaded from API, cached in memory)
let userPreferences = {
  theme: 'light',
  currency: 'GHS',
  profile_picture: null,
  low_data_mode: false,
  last_visited_page: 'pages/dashboard.html',
  notification_preferences: {
    email: true,
    push: true,
    budget_alerts: true,
    goal_reminders: true,
    bill_reminders: true
  }
};

// Cache configuration for low data mode
const CACHE_CONFIG = {
  expenses: { key: 'kudisave_cache_expenses', ttl: 5 * 60 * 1000 }, // 5 minutes
  goals: { key: 'kudisave_cache_goals', ttl: 10 * 60 * 1000 }, // 10 minutes
  budget: { key: 'kudisave_cache_budget', ttl: 5 * 60 * 1000 },
  income: { key: 'kudisave_cache_income', ttl: 10 * 60 * 1000 },
  profile: { key: 'kudisave_cache_profile', ttl: 30 * 60 * 1000 }, // 30 minutes
  summary: { key: 'kudisave_cache_summary', ttl: 5 * 60 * 1000 }
};

// Check if low data mode is enabled (from user preferences)
function isLowDataMode() {
  return userPreferences.low_data_mode;
}

// Get user preference
function getUserPreference(key) {
  return userPreferences[key];
}

// Update user preference locally and sync to server
async function setUserPreference(key, value) {
  userPreferences[key] = value;
  
  // Sync to server if authenticated
  const token = localStorage.getItem('token');
  if (token && api) {
    try {
      await api.updateProfile({ [key]: value });
    } catch (e) {
      console.warn('Failed to sync preference to server:', e);
    }
  }
}

// Get cached data if valid
function getCachedData(cacheKey) {
  if (!isLowDataMode()) return null;
  
  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;
    
    const { data, timestamp, ttl } = JSON.parse(cached);
    const isExpired = Date.now() - timestamp > ttl;
    
    if (isExpired) {
      localStorage.removeItem(cacheKey);
      return null;
    }
    
    return data;
  } catch (e) {
    return null;
  }
}

// Save data to cache
function setCachedData(cacheKey, data, ttl) {
  if (!isLowDataMode()) return;
  
  try {
    localStorage.setItem(cacheKey, JSON.stringify({
      data,
      timestamp: Date.now(),
      ttl
    }));
  } catch (e) {
    // Clear old cache if storage is full
    clearOldCache();
  }
}

// Clear old cache entries
function clearOldCache() {
  Object.values(CACHE_CONFIG).forEach(config => {
    try {
      localStorage.removeItem(config.key);
    } catch (e) {}
  });
}

// Check if offline
function isOffline() {
  return !navigator.onLine;
}

class APIService {
  constructor() {
    this.token = localStorage.getItem('token');
    this.preferencesLoaded = false;
  }

  // Load user preferences from profile
  async loadUserPreferences() {
    if (this.preferencesLoaded || !this.token) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/profile`, {
        headers: this.getHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const profile = data.data;
          userPreferences.theme = profile.theme || 'light';
          userPreferences.currency = profile.currency || 'GHS';
          userPreferences.profile_picture = profile.profile_picture;
          userPreferences.low_data_mode = profile.low_data_mode || false;
          userPreferences.last_visited_page = profile.last_visited_page || 'pages/dashboard.html';
          userPreferences.notification_preferences = profile.notification_preferences || userPreferences.notification_preferences;
          
          this.preferencesLoaded = true;
          
          if (typeof initThemeFromPreferences === 'function') {
            initThemeFromPreferences();
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load user preferences:', e);
    }
  }

  // Get authorization headers
  getHeaders(includeAuth = true) {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (includeAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  // Handle API response
  async handleResponse(response) {
    const data = await response.json();
    
    if (!response.ok) {
      const error = new Error(data.message || 'API request failed');
      error.status = response.status;
      error.response = { data };
      throw error;
    }

    return data;
  }

  // Set token
  setToken(token) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  // Clear token
  clearToken() {
    this.token = null;
    localStorage.removeItem('token');
  }

  // AUTH ENDPOINTS

  async register(userData) {
    const response = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(userData)
    });

    const data = await this.handleResponse(response);
    if (data.data.token) {
      this.setToken(data.data.token);
    }
    return data;
  }

  async login(credentials) {
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: this.getHeaders(false),
      body: JSON.stringify(credentials)
    });

    const data = await this.handleResponse(response);
    if (data.data.token) {
      this.setToken(data.data.token);
      await this.loadUserPreferences();
    }
    return data;
  }

  async getProfile() {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      headers: this.getHeaders()
    });

    const result = await this.handleResponse(response);
    
    if (result.success && result.data) {
      const profile = result.data;
      userPreferences.theme = profile.theme || 'light';
      userPreferences.currency = profile.currency || 'GHS';
      userPreferences.profile_picture = profile.profile_picture;
      userPreferences.low_data_mode = profile.low_data_mode || false;
      userPreferences.last_visited_page = profile.last_visited_page || 'pages/dashboard.html';
      userPreferences.notification_preferences = profile.notification_preferences || userPreferences.notification_preferences;
      this.preferencesLoaded = true;
    }
    
    return result;
  }

  async updateProfile(profileData) {
    const response = await fetch(`${API_BASE_URL}/auth/profile`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(profileData)
    });

    return await this.handleResponse(response);
  }

  async changePassword({ currentPassword, newPassword }) {
    const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ currentPassword, newPassword })
    });

    return await this.handleResponse(response);
  }

  logout() {
    this.clearToken();
    this.preferencesLoaded = false;
    userPreferences = {
      theme: 'light',
      currency: 'GHS',
      profile_picture: null,
      low_data_mode: false,
      last_visited_page: 'pages/dashboard.html',
      notification_preferences: {
        email: true,
        push: true,
        budget_alerts: true,
        goal_reminders: true,
        bill_reminders: true
      }
    };
    clearOldCache();
    window.location.href = '../splash.html';
  }

  // EXPENSE ENDPOINTS

  async createExpense(expenseData) {
    const response = await fetch(`${API_BASE_URL}/expenses`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(expenseData)
    });

    return await this.handleResponse(response);
  }

  async getExpenses(filters = {}) {
    const cacheKey = CACHE_CONFIG.expenses.key;
    const cached = getCachedData(cacheKey);
    if (cached && Object.keys(filters).length === 0) return cached;
    if (isOffline() && cached) return cached;
    
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE_URL}/expenses?${params}`, {
      headers: this.getHeaders()
    });

    const result = await this.handleResponse(response);
    if (Object.keys(filters).length === 0) {
      setCachedData(cacheKey, result, CACHE_CONFIG.expenses.ttl);
    }
    return result;
  }

  async getExpenseSummary(period = 'month') {
    const cacheKey = CACHE_CONFIG.summary.key + '_' + period;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    if (isOffline() && cached) return cached;
    
    const response = await fetch(`${API_BASE_URL}/expenses/summary?period=${period}`, {
      headers: this.getHeaders()
    });

    const result = await this.handleResponse(response);
    setCachedData(cacheKey, result, CACHE_CONFIG.summary.ttl);
    return result;
  }

  async updateExpense(id, expenseData) {
    const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(expenseData)
    });

    return await this.handleResponse(response);
  }

  async deleteExpense(id) {
    const response = await fetch(`${API_BASE_URL}/expenses/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });

    return await this.handleResponse(response);
  }

  // INCOME ENDPOINTS

  async createIncome(incomeData) {
    const response = await fetch(`${API_BASE_URL}/income`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(incomeData)
    });

    return await this.handleResponse(response);
  }

  async getIncome(filters = {}) {
    const cacheKey = CACHE_CONFIG.income.key;
    const cached = getCachedData(cacheKey);
    if (cached && Object.keys(filters).length === 0) return cached;
    if (isOffline() && cached) return cached;
    
    const params = new URLSearchParams(filters);
    const response = await fetch(`${API_BASE_URL}/income?${params}`, {
      headers: this.getHeaders()
    });

    const result = await this.handleResponse(response);
    if (Object.keys(filters).length === 0) {
      setCachedData(cacheKey, result, CACHE_CONFIG.income.ttl);
    }
    return result;
  }

  // BUDGET ENDPOINTS

  async createBudget(budgetData) {
    const response = await fetch(`${API_BASE_URL}/budget`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(budgetData)
    });

    return await this.handleResponse(response);
  }

  async getActiveBudget() {
    const cacheKey = CACHE_CONFIG.budget.key;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    if (isOffline() && cached) return cached;
    
    const response = await fetch(`${API_BASE_URL}/budget/active`, {
      headers: this.getHeaders()
    });

    const result = await this.handleResponse(response);
    setCachedData(cacheKey, result, CACHE_CONFIG.budget.ttl);
    return result;
  }

  // GOALS ENDPOINTS

  async createGoal(goalData) {
    try {
      const response = await fetch(`${API_BASE_URL}/goals`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(goalData)
      });

      const result = await this.handleResponse(response);
      console.log('✅ Goal created successfully:', result.data.title);
      return result;
    } catch (error) {
      console.error('❌ Failed to create goal:', error.message);
      throw error;
    }
  }

  async getGoals() {
    const cacheKey = CACHE_CONFIG.goals.key;
    const cached = getCachedData(cacheKey);
    if (cached) return cached;
    if (isOffline() && cached) return cached;
    
    const response = await fetch(`${API_BASE_URL}/goals`, {
      headers: this.getHeaders()
    });

    const result = await this.handleResponse(response);
    setCachedData(cacheKey, result, CACHE_CONFIG.goals.ttl);
    return result;
  }

  async updateGoal(id, goalData) {
    const response = await fetch(`${API_BASE_URL}/goals/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(goalData)
    });

    return await this.handleResponse(response);
  }

  // REPORTS ENDPOINTS

  async getMonthlyReport(month = null) {
    const url = month 
      ? `${API_BASE_URL}/reports/monthly?month=${month}`
      : `${API_BASE_URL}/reports/monthly`;
    
    const response = await fetch(url, {
      headers: this.getHeaders()
    });

    return await this.handleResponse(response);
  }

  async getFinancialHealthScore() {
    const response = await fetch(`${API_BASE_URL}/reports/health-score`, {
      headers: this.getHeaders()
    });

    return await this.handleResponse(response);
  }

  async getSpendingTrends() {
    const response = await fetch(`${API_BASE_URL}/reports/trends`, {
      headers: this.getHeaders()
    });

    return await this.handleResponse(response);
  }

  // GAMIFICATION ENDPOINTS

  async getBadges() {
    const response = await fetch(`${API_BASE_URL}/gamification/badges`, {
      headers: this.getHeaders()
    });

    return await this.handleResponse(response);
  }

  async getStreak() {
    const response = await fetch(`${API_BASE_URL}/gamification/streak`, {
      headers: this.getHeaders()
    });

    return await this.handleResponse(response);
  }

  async getXP() {
    const response = await fetch(`${API_BASE_URL}/gamification/xp`, {
      headers: this.getHeaders()
    });

    return await this.handleResponse(response);
  }

  // Generic HTTP methods for flexible API calls
  async get(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: this.getHeaders()
    });
    return await this.handleResponse(response);
  }

  async post(endpoint, data = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return await this.handleResponse(response);
  }

  async put(endpoint, data = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(data)
    });
    return await this.handleResponse(response);
  }

  async delete(endpoint) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    return await this.handleResponse(response);
  }
}

// Create global API instance
const api = new APIService();
