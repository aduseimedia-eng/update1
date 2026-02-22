// KudiSave - Utility Functions

// Theme Management - Uses localStorage for persistence across all pages
function initTheme() {
  // One-time reset: clear dark theme from old demo mode
  if (!localStorage.getItem('kudisave_theme_v2_reset')) {
    localStorage.setItem('kudisave_theme', 'light');
    localStorage.setItem('kudisave_theme_v2_reset', 'true');
  }
  const theme = localStorage.getItem('kudisave_theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

// Called by api.js after preferences are loaded (syncs localStorage)
function initThemeFromPreferences() {
  // If user has a API preference but localStorage differs, sync it
  const apiTheme = (typeof getUserPreference === 'function') ? getUserPreference('theme') : null;
  const localTheme = localStorage.getItem('kudisave_theme');
  
  // API takes priority if user logged in, otherwise use localStorage
  const theme = apiTheme || localTheme || 'light';
  localStorage.setItem('kudisave_theme', theme);
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeIcon(theme);
}

async function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  
  // Save to localStorage FIRST for instant persistence
  localStorage.setItem('kudisave_theme', newTheme);
  document.documentElement.setAttribute('data-theme', newTheme);
  updateThemeIcon(newTheme);
  
  // Sync to API if available
  if (typeof setUserPreference === 'function') {
    await setUserPreference('theme', newTheme);
  }
}

function updateThemeIcon(theme) {
  const themeButtons = document.querySelectorAll('.theme-toggle');
  themeButtons.forEach(btn => {
    btn.innerHTML = theme === 'dark' ? '☀️' : '🌙';
    btn.setAttribute('title', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
  });
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
});

// Currency configuration
const CURRENCY_CONFIG = {
  'GHS': { symbol: 'GH₵', name: 'Ghana Cedi', locale: 'en-GH' },
  'USD': { symbol: '$', name: 'US Dollar', locale: 'en-US' },
  'EUR': { symbol: '€', name: 'Euro', locale: 'de-DE' },
  'GBP': { symbol: '£', name: 'British Pound', locale: 'en-GB' },
  'NGN': { symbol: '₦', name: 'Nigerian Naira', locale: 'en-NG' },
  'KES': { symbol: 'KSh', name: 'Kenyan Shilling', locale: 'en-KE' },
  'ZAR': { symbol: 'R', name: 'South African Rand', locale: 'en-ZA' },
  'XOF': { symbol: 'CFA', name: 'West African CFA', locale: 'fr-SN' }
};

// Get current currency from user preferences (API) with localStorage fallback
function getCurrentCurrency() {
  if (typeof getUserPreference === 'function') {
    return getUserPreference('currency') || localStorage.getItem('currency') || 'GHS';
  }
  return localStorage.getItem('currency') || 'GHS';
}

// Set currency preference
async function setCurrency(currencyCode) {
  if (typeof setUserPreference === 'function') {
    await setUserPreference('currency', currencyCode);
  }
}

// Get currency symbol
function getCurrencySymbol(code = null) {
  const currency = code || getCurrentCurrency();
  return CURRENCY_CONFIG[currency]?.symbol || currency;
}

// Format currency with user's selected currency
function formatCurrency(amount, currencyCode = null) {
  const code = currencyCode || getCurrentCurrency();
  const config = CURRENCY_CONFIG[code] || CURRENCY_CONFIG['GHS'];
  const num = parseFloat(amount) || 0;
  return `${config.symbol} ${num.toLocaleString(config.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format currency without symbol (just the number)
function formatCurrencyAmount(amount) {
  const code = getCurrentCurrency();
  const config = CURRENCY_CONFIG[code] || CURRENCY_CONFIG['GHS'];
  const num = parseFloat(amount) || 0;
  return num.toLocaleString(config.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Format date
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { year: 'numeric', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-GB', options);
}

// Get today's date in YYYY-MM-DD format
function getTodayDate() {
  return new Date().toISOString().split('T')[0];
}

// Show toast notification (mobile-friendly)
function showAlert(message, type = 'success') {
  // Ensure toast container exists
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: '✓',
    error: '✕',
    warning: '!',
    info: 'i'
  };
  const icon = icons[type] || icons.info;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-body">
      <div class="toast-message">${message}</div>
    </div>
    <button class="toast-dismiss" onclick="this.parentElement.classList.add('toast-exit'); setTimeout(() => this.parentElement.remove(), 300)">&times;</button>
    <div class="toast-progress"></div>
  `;

  container.appendChild(toast);

  // Auto-dismiss after 4 seconds
  const timer = setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('toast-exit');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);

  // Swipe to dismiss
  let startX = 0;
  toast.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
  toast.addEventListener('touchmove', (e) => {
    const dx = e.touches[0].clientX - startX;
    if (Math.abs(dx) > 10) toast.style.transform = `translateX(${dx}px)`;
    toast.style.opacity = Math.max(0, 1 - Math.abs(dx) / 200);
  }, { passive: true });
  toast.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 80) {
      clearTimeout(timer);
      toast.remove();
    } else {
      toast.style.transform = '';
      toast.style.opacity = '';
    }
  });

  // Limit to 3 toasts visible
  const toasts = container.querySelectorAll('.toast');
  if (toasts.length > 3) toasts[0].remove();
}

function getAlertIcon(type) {
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️'
  };
  return icons[type] || '💡';
}

// Show loading overlay
function showLoading() {
  if (document.getElementById('loading-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'loading-overlay';
  overlay.className = 'loading-overlay';
  overlay.innerHTML = `
    <div class="loading-spinner"></div>
    <div class="loading-text">Please wait...</div>
  `;
  document.body.appendChild(overlay);
}

function hideLoading() {
  const overlay = document.getElementById('loading-overlay');
  if (overlay) {
    overlay.style.opacity = '0';
    setTimeout(() => overlay.remove(), 200);
  }
}

// Check if user is authenticated
function isAuthenticated() {
  return !!localStorage.getItem('token');
}

// Redirect to login if not authenticated
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = '../index.html';
  }
}

// Save current page to user preferences (API)
async function saveCurrentPage() {
  const currentPath = window.location.pathname;
  // Extract just the page filename
  const pageName = currentPath.split('/').pop();
  
  // Don't save login, splash, or onboarding pages
  if (pageName && 
      pageName !== 'index.html' && 
      pageName !== 'splash.html' && 
      pageName !== 'onboarding.html' &&
      pageName.endsWith('.html')) {
    // Save relative path for pages folder
    const relativePath = currentPath.includes('/pages/') ? 
      'pages/' + pageName : pageName;
    
    // Save to API if available
    if (typeof setUserPreference === 'function') {
      await setUserPreference('last_visited_page', relativePath);
    }
  }
}

// Get last visited page from user preferences
function getLastVisitedPage() {
  if (typeof getUserPreference === 'function') {
    return getUserPreference('last_visited_page') || 'pages/dashboard.html';
  }
  return 'pages/dashboard.html';
}

// Check if user should be redirected to last page (for index.html)
function checkReturnToLastPage() {
  const token = localStorage.getItem('token');
  
  if (token) {
    // User is logged in, return to last page from preferences
    const lastPage = getLastVisitedPage();
    window.location.href = lastPage;
    return true;
  }
  return false;
}

// Ghana-specific expense categories
const EXPENSE_CATEGORIES = [
  'Food / Chop Bar',
  'Transport (Trotro / Bolt)',
  'Data / Airtime',
  'Rent / Hostel',
  'Utilities',
  'Church / Donations',
  'Betting / Gaming',
  'Entertainment',
  'Shopping',
  'Miscellaneous'
];

// Payment methods in Ghana
const PAYMENT_METHODS = [
  'Cash',
  'MTN MoMo',
  'Telecel Cash',
  'Bank Transfer',
  'AirtelTigo Money'
];

// Income sources
const INCOME_SOURCES = [
  'Allowance',
  'Salary',
  'Business',
  'Gift',
  'Hustle',
  'Investment',
  'Other'
];

// Get category icon
function getCategoryIcon(category) {
  const icons = {
    'Food / Chop Bar': '🍛',
    'Transport (Trotro / Bolt)': '🚌',
    'Data / Airtime': '📱',
    'Rent / Hostel': '🏠',
    'Utilities': '💡',
    'Church / Donations': '⛪',
    'Betting / Gaming': '🎲',
    'Entertainment': '🎬',
    'Shopping': '🛍️',
    'Miscellaneous': '📦'
  };
  return icons[category] || '💰';
}

// Get motivational message based on budget usage
function getMotivationalMessage(budgetUsage) {
  if (budgetUsage <= 50) {
    return "Chale, you dey do well! 💪";
  } else if (budgetUsage <= 75) {
    return "You dey on point! Keep pushing 🚀";
  } else if (budgetUsage <= 90) {
    return "Small small ooo, you go reach 😅";
  } else {
    return "Masa, check your spending waa 🤔";
  }
}

// Calculate progress percentage
function calculateProgress(current, target) {
  if (target === 0) return 0;
  return Math.min(100, (current / target) * 100);
}

// Get badge emoji
function getBadgeEmoji(badgeName) {
  const emojis = {
    'Data King/Queen': '👑',
    'Chop Saver': '🍽️',
    'Budget Boss': '💼',
    'Consistency Champ': '🔥',
    'Goal Getter': '🎯',
    'Transport Wise': '🚗'
  };
  return emojis[badgeName] || '🏆';
}

// Get tier color
function getTierColor(tier) {
  const colors = {
    'bronze': '#CD7F32',
    'silver': '#C0C0C0',
    'gold': '#FFD700',
    'platinum': '#E5E4E2'
  };
  return colors[tier] || '#FFD700';
}

// Validate Ghana phone number
function validateGhanaPhone(phone) {
  const regex = /^233[0-9]{9}$/;
  return regex.test(phone);
}

// Format phone number display
function formatPhoneNumber(phone) {
  if (phone.startsWith('233')) {
    return `+${phone.slice(0, 3)} ${phone.slice(3, 5)} ${phone.slice(5, 8)} ${phone.slice(8)}`;
  }
  return phone;
}

// Debounce function for search/filter
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Generate chart colors (Green & White theme)
function getChartColors(count) {
  const colors = [
    '#006B3F', // Primary Green
    '#00a05e', // Light Green
    '#004d2c', // Dark Green
    '#10b981', // Success green
    '#059669', // Emerald
    '#047857', // Deep emerald
    '#34d399', // Mint
    '#ffffff', // White
    '#6ee7b7', // Light mint
    '#a7f3d0'  // Pale green
  ];
  
  return colors.slice(0, count);
}

// Group expenses by date
function groupExpensesByDate(expenses) {
  const grouped = {};
  expenses.forEach(expense => {
    const date = expense.expense_date;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(expense);
  });
  return grouped;
}

// Calculate date range
function getDateRange(period) {
  const end = new Date();
  const start = new Date();
  
  switch(period) {
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
  }
  
  return {
    start_date: start.toISOString().split('T')[0],
    end_date: end.toISOString().split('T')[0]
  };
}

// ================================
// FUN & LIVELY UTILITIES 🎉
// ================================

// Confetti celebration
function showConfetti(particleCount = 50) {
  const colors = ['#006B3F', '#00a05e', '#ffffff', '#34d399', '#fbbf24'];
  
  // Add keyframes if not exist
  if (!document.getElementById('confetti-keyframes')) {
    const style = document.createElement('style');
    style.id = 'confetti-keyframes';
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translateY(-10px) rotate(0deg) scale(1); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg) scale(0); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  for (let i = 0; i < particleCount; i++) {
    const confetti = document.createElement('div');
    const size = Math.random() * 10 + 5;
    confetti.style.cssText = `
      position: fixed;
      width: ${size}px;
      height: ${size}px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}vw;
      top: -20px;
      border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
      z-index: 9999;
      pointer-events: none;
      animation: confetti-fall ${2 + Math.random() * 3}s linear forwards;
      animation-delay: ${Math.random() * 0.5}s;
    `;
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 5000);
  }
}

// Fun toast notification with emoji
function showFunToast(message, emoji = '🎉', duration = 3000) {
  // Remove existing toasts
  const existing = document.querySelector('.fun-toast');
  if (existing) existing.remove();
  
  // Add keyframes if not exist
  if (!document.getElementById('toast-keyframes')) {
    const style = document.createElement('style');
    style.id = 'toast-keyframes';
    style.textContent = `
      @keyframes toast-bounce-in {
        0% { transform: translateX(-50%) translateY(100px) scale(0.5); opacity: 0; }
        60% { transform: translateX(-50%) translateY(-10px) scale(1.05); }
        100% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
      }
      @keyframes toast-bounce-out {
        0% { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        100% { transform: translateX(-50%) translateY(100px) scale(0.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  const toast = document.createElement('div');
  toast.className = 'fun-toast';
  toast.innerHTML = `<span style="font-size: 24px; animation: bounce 1s ease infinite;">${emoji}</span> ${message}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #006B3F, #00a05e);
    color: white;
    padding: 14px 24px;
    border-radius: 50px;
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 10px 40px rgba(0, 107, 63, 0.4);
    z-index: 9999;
    animation: toast-bounce-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'toast-bounce-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// Celebration with sound
function celebrate(title = 'Great Job!', type = 'success') {
  showConfetti(60);
  showFunToast(title, type === 'success' ? '🎉' : '🏆', 4000);
  
  // Play celebration sound
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.08, audioCtx.currentTime + i * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.12 + 0.25);
      osc.start(audioCtx.currentTime + i * 0.12);
      osc.stop(audioCtx.currentTime + i * 0.12 + 0.25);
    });
  } catch (e) { /* Audio not supported */ }
}

// Animated counter
function animateNumber(element, target, duration = 1000, prefix = '', suffix = '') {
  const start = parseFloat(element.textContent.replace(/[^0-9.-]+/g, '')) || 0;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = start + (target - start) * easeProgress;
    element.textContent = prefix + current.toFixed(2) + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = prefix + target.toFixed(2) + suffix;
      element.style.animation = 'pop 0.3s ease';
      setTimeout(() => element.style.animation = '', 300);
    }
  }
  
  requestAnimationFrame(update);
}

// Add floating emoji
function floatEmoji(element, emoji) {
  const float = document.createElement('span');
  float.textContent = emoji;
  float.style.cssText = `
    position: absolute;
    font-size: 20px;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    animation: float-away 1.5s ease-out forwards;
    pointer-events: none;
    z-index: 100;
  `;
  
  if (!document.getElementById('float-emoji-keyframes')) {
    const style = document.createElement('style');
    style.id = 'float-emoji-keyframes';
    style.textContent = `
      @keyframes float-away {
        0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }
        100% { transform: translate(-50%, -150%) scale(1.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  element.style.position = 'relative';
  element.appendChild(float);
  setTimeout(() => float.remove(), 1500);
}

// Haptic feedback (for mobile)
function vibrate(pattern = [10]) {
  if (navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

// Success pulse effect
function pulseSuccess(element) {
  element.style.animation = 'pulse-success 0.5s ease';
  
  if (!document.getElementById('pulse-success-keyframes')) {
    const style = document.createElement('style');
    style.id = 'pulse-success-keyframes';
    style.textContent = `
      @keyframes pulse-success {
        0% { box-shadow: 0 0 0 0 rgba(0, 160, 94, 0.7); }
        70% { box-shadow: 0 0 0 15px rgba(0, 160, 94, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 160, 94, 0); }
      }
    `;
    document.head.appendChild(style);
  }
  
  setTimeout(() => element.style.animation = '', 500);
}

// Get random encouraging message
function getRandomEncouragement() {
  const messages = [
    { text: "You're doing great! 💪", emoji: "💪" },
    { text: "Keep up the good work! 🌟", emoji: "🌟" },
    { text: "Awesome progress! 🚀", emoji: "🚀" },
    { text: "You're on fire! 🔥", emoji: "🔥" },
    { text: "Financial ninja! 🥷", emoji: "🥷" },
    { text: "Money master! 💰", emoji: "💰" },
    { text: "Saving superstar! ⭐", emoji: "⭐" },
    { text: "Budget boss! 👑", emoji: "👑" }
  ];
  return messages[Math.floor(Math.random() * messages.length)];
}

// Export functions
window.utils = {
  formatCurrency,
  formatCurrencyAmount,
  getCurrentCurrency,
  getCurrencySymbol,
  CURRENCY_CONFIG,
  formatDate,
  getTodayDate,
  showAlert,
  showLoading,
  hideLoading,
  isAuthenticated,
  requireAuth,
  saveCurrentPage,
  getLastVisitedPage,
  checkReturnToLastPage,
  EXPENSE_CATEGORIES,
  PAYMENT_METHODS,
  INCOME_SOURCES,
  getCategoryIcon,
  getMotivationalMessage,
  calculateProgress,
  getBadgeEmoji,
  getTierColor,
  validateGhanaPhone,
  formatPhoneNumber,
  debounce,
  getChartColors,
  groupExpensesByDate,
  getDateRange,
  // Fun utilities
  showConfetti,
  showFunToast,
  celebrate,
  animateNumber,
  floatEmoji,
  vibrate,
  pulseSuccess,
  getRandomEncouragement
};
