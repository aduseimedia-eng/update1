// KudiSave - Dashboard Logic

utils.requireAuth();

let userData = null;
let budgetData = null;

// Get time-based greeting
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Get initials from name
function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

// Load profile picture from API (via userPreferences)
function loadProfilePicture() {
  // Get profile picture from user preferences (loaded from API)
  const savedPicture = (typeof getUserPreference === 'function') 
    ? getUserPreference('profile_picture') 
    : null;
  const avatarEl = document.getElementById('userAvatar');
  const initialsEl = document.getElementById('avatarInitials');
  
  if (savedPicture && avatarEl) {
    avatarEl.innerHTML = `<img src="${savedPicture}" alt="Profile">`;
    return true;
  } else if (initialsEl && userData) {
    initialsEl.textContent = getInitials(userData.name);
  }
  return false;
}

// Initialize dashboard
async function initDashboard() {
  try {
    // Set greeting
    document.getElementById('greetingTime').textContent = getTimeGreeting();
    
    // Load user profile (this also syncs preferences)
    const profileResponse = await api.getProfile();
    userData = profileResponse.data;
    
    document.getElementById('userName').textContent = userData.name || 'Welcome!';
    
    // Sync menu profile
    const menuName = document.getElementById('menuUserName');
    const menuInitials = document.getElementById('menuAvatarInitials');
    const menuEmail = document.getElementById('menuUserEmail');
    if (menuName) menuName.textContent = userData.name || 'Welcome!';
    if (menuInitials) menuInitials.textContent = getInitials(userData.name);
    if (menuEmail) menuEmail.textContent = userData.email || 'Manage your finances';
    
    // Load profile picture from profile data or localStorage
    const avatarEl = document.getElementById('userAvatar');
    const initialsEl = document.getElementById('avatarInitials');
    
    // Check for profile picture: API first, then localStorage fallback
    let profilePicture = userData.profile_picture || localStorage.getItem('profilePicture');
    
    if (profilePicture && avatarEl) {
      avatarEl.innerHTML = `<img src="${profilePicture}" alt="Profile">`;
    } else if (initialsEl) {
      initialsEl.textContent = getInitials(userData.name);
    }
    
    // Storage listener setup (only once)
    if (!window._dashboardStorageListenerAdded) {
      window._dashboardStorageListenerAdded = true;
      window.addEventListener('storage', (event) => {
        if (event.key === 'profilePicture') {
          const av = document.getElementById('userAvatar');
          if (av) {
            if (event.newValue) {
              av.innerHTML = `<img src="${event.newValue}" alt="Profile">`;
            } else {
              av.innerHTML = `<span id="avatarInitials">${getInitials(userData ? userData.name : '')}</span>`;
            }
          }
        }
      });
    }

    // Update streak on first open of the day
    const today = new Date().toISOString().split('T')[0];
    if (localStorage.getItem('lastStreakUpdate') !== today) {
      try {
        await api.put('/gamification/streak/update', {});
        localStorage.setItem('lastStreakUpdate', today);
      } catch (e) { console.warn('Streak update failed:', e); }
    }

    // Load all dashboard data
    await Promise.all([
      loadFinancialSummary(),
      loadRecentExpenses(),
      loadBudget(),
      loadGamificationData()
    ]);

  } catch (error) {
    console.error('Dashboard init error:', error);
    utils.showAlert('Failed to load dashboard data', 'error');
  }
}

// Load financial summary
async function loadFinancialSummary() {
  try {
    const summaryResponse = await api.getExpenseSummary('month');
    const summary = summaryResponse.data.summary || summaryResponse.data;
    const totalExpenses = parseFloat(summary.total_amount || summary.total || 0);

    // Get income for the month
    const dateRange = utils.getDateRange ? utils.getDateRange('month') : {};
    const incomeResponse = await api.getIncome(dateRange);
    const incomeData = Array.isArray(incomeResponse.data) ? incomeResponse.data : [];
    const totalIncome = incomeData.reduce((sum, inc) => sum + parseFloat(inc.amount || 0), 0);

    // Update balance card
    const balance = totalIncome - totalExpenses;
    const symbol = utils.getCurrencySymbol();
    document.getElementById('balanceAmount').textContent = utils.formatCurrency(balance);
    document.getElementById('totalIncome').textContent = `+${symbol} ${utils.formatCurrencyAmount(totalIncome)}`;
    document.getElementById('totalExpenses').textContent = `-${symbol} ${utils.formatCurrencyAmount(totalExpenses)}`;

    // Calculate savings rate
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome * 100) : 0;
    document.getElementById('savingsRate').textContent = `${savingsRate.toFixed(1)}%`;

  } catch (error) {
    console.error('Load summary error:', error);
  }
}

// Load recent expenses
async function loadRecentExpenses() {
  try {
    const response = await api.getExpenses({ limit: 5 });
    const expenses = response.data.expenses || response.data;

    const listContainer = document.getElementById('recentExpensesList');
    
    if (!expenses || expenses.length === 0) {
      listContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: var(--text-muted);">
          <div style="font-size: 32px; margin-bottom: 8px;">📝</div>
          <p>No transactions yet</p>
        </div>
      `;
      return;
    }

    listContainer.innerHTML = expenses.slice(0, 5).map(expense => `
      <div class="transaction-item" id="expense-${expense.id}">
        <div class="transaction-icon">${utils.getCategoryIcon(expense.category)}</div>
        <div class="transaction-info">
          <div class="transaction-category">${expense.category}</div>
          <div class="transaction-date">${utils.formatDate(expense.expense_date || expense.date)}</div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <div class="transaction-amount">-${utils.formatCurrencyAmount(expense.amount)}</div>
          <button class="transaction-delete-btn" onclick="deleteTransaction('${expense.id}')" title="Delete transaction" style="background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; font-size: 16px;">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      </div>
    `).join('');
    
    // Render lucide icons (scoped to list container only)
    const listEl = document.getElementById('recentExpensesList');
    if (listEl) lucide.createIcons({ node: listEl });

  } catch (error) {
    console.error('Load expenses error:', error);
    document.getElementById('recentExpensesList').innerHTML = 
      '<div style="text-align: center; color: var(--text-muted); padding: 20px;">Failed to load</div>';
  }
}

// Delete transaction
async function deleteTransaction(expenseId) {
  // Confirm deletion
  if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) {
    return;
  }

  try {
    utils.showLoading();
    await api.deleteExpense(expenseId);
    
    utils.hideLoading();
    utils.showAlert('Transaction deleted successfully ✓', 'success');
    
    // Animate deletion
    const element = document.getElementById(`expense-${expenseId}`);
    if (element) {
      element.style.animation = 'slideOut 0.3s ease forwards';
      setTimeout(() => {
        element.remove();
        loadRecentExpenses(); // Reload to ensure consistency
      }, 300);
    }
    
    // Reload dashboard to update totals
    await loadFinancialSummary();
  } catch (error) {
    utils.hideLoading();
    utils.showAlert('Failed to delete transaction', 'error');
  }
}

// Load budget
async function loadBudget() {
  try {
    const response = await api.getActiveBudget();
    budgetData = response.data;

    const budgetFill = document.getElementById('budgetFill');
    const budgetPercentage = document.getElementById('budgetPercentage');
    const budgetSpent = document.getElementById('budgetSpent');
    const budgetRemaining = document.getElementById('budgetRemaining');

    if (!budgetData) {
      budgetPercentage.textContent = 'Not set';
      budgetSpent.textContent = 'Tap Budget to set';
      budgetRemaining.textContent = '';
      budgetFill.style.width = '0%';
      return;
    }

    // Calculate usage based on spent vs budget amount
    const spent = parseFloat(budgetData.spent_amount || budgetData.spent || 0);
    const total = parseFloat(budgetData.budget_amount || budgetData.amount || budgetData.total_budget || 0);
    const remaining = Math.max(0, total - spent);
    const usage = total > 0 ? (spent / total * 100) : 0;
    
    // Update UI
    budgetPercentage.textContent = `${usage.toFixed(0)}%`;
    budgetFill.style.width = `${Math.min(100, usage)}%`;
    budgetSpent.textContent = `${utils.formatCurrency(spent)} spent`;
    budgetRemaining.textContent = `${utils.formatCurrency(remaining)} left`;
    
    // Update fill color based on usage
    budgetFill.classList.remove('safe', 'warning', 'danger');
    if (usage >= 90) {
      budgetFill.classList.add('danger');
    } else if (usage >= 70) {
      budgetFill.classList.add('warning');
    } else {
      budgetFill.classList.add('safe');
    }
    
    // Show budget status message
    if (usage >= 100) {
      utils.showAlert('⚠️ Budget exceeded! You\'re over your limit.', 'warning');
    } else if (usage >= 90) {
      utils.showAlert('🚨 Budget warning: You\'re at 90% of your budget', 'warning');
    }

  } catch (error) {
    console.error('Load budget error:', error);
    // Budget is optional - don't show error
    document.getElementById('budgetPercentage').textContent = 'Not set';
    document.getElementById('budgetSpent').textContent = 'Tap to set budget';
  }
}

// Load gamification data
async function loadGamificationData() {
  try {
    // Load streak
    const streakResponse = await api.getStreak();
    const streak = streakResponse.data;
    document.getElementById('currentStreak').textContent = `${streak.current_streak || 0} days`;
    
    // Celebrate streaks (only once per session)
    const streakKey = `streakCelebrated_${streak.current_streak}`;
    if ((streak.current_streak === 7 || streak.current_streak === 30) && !sessionStorage.getItem(streakKey)) {
      sessionStorage.setItem(streakKey, 'true');
      celebrateStreak(streak.current_streak);
    }

    // Load XP with level-up detection
    const xpResponse = await api.getXP();
    const xp = xpResponse.data;
    
    const level = xp.level || Math.floor((xp.total_xp || 0) / 100) + 1;
    const nextLevelXp = xp.next_level_xp || (level * 100);
    const progressPercent = (xp.progress_percentage != null ? xp.progress_percentage : ((xp.total_xp || 0) % 100));
    
    // Check for level up
    const previousLevel = parseInt(localStorage.getItem('userLevel') || '1');
    if (level > previousLevel) {
      localStorage.setItem('userLevel', level.toString());
      celebrateLevelUp(level);
    } else {
      localStorage.setItem('userLevel', level.toString());
    }
    
    document.getElementById('userLevel').textContent = `Level ${level}`;
    document.getElementById('levelBadge').textContent = level;
    document.getElementById('xpProgress').style.width = `${Math.min(100, progressPercent)}%`;
    document.getElementById('xpText').textContent = `${xp.total_xp || 0} / ${nextLevelXp} XP`;

    // Load badges with animation
    const badgesResponse = await api.getBadges();
    const badges = badgesResponse.data || [];
    
    const badgesContainer = document.getElementById('badgesContainer');
    const badgeEmojis = ['💰', '🎯', '📊', '⭐', '🔥', '💎'];
    
    if (badges.length === 0) {
      badgesContainer.innerHTML = badgeEmojis.map(emoji => 
        `<span class="badge-item">${emoji}</span>`
      ).join('');
    } else {
      const earnedBadgeNames = badges.map(b => b.badge_name || b.name);
      const badgeNamesToemoji = {
        'Saver': '💰',
        'Goal Achiever': '🎯',
        'Analyst': '📊',
        'Top Performer': '⭐',
        'Streak Master': '🔥',
        'Platinum Member': '💎'
      };
      
      badgesContainer.innerHTML = badgeEmojis.map((emoji, idx) => {
        const isBadgeEarned = badges.length > idx;
        return `<span class="badge-item ${isBadgeEarned ? 'earned' : ''}" title="${isBadgeEarned ? 'Earned' : 'Locked'}">${emoji}</span>`;
      }).join('');
    }

    // Set motivational message
    const quotes = [
      "Every cedi saved is a cedi earned! 💪",
      "Small steps lead to big wins! 🚀",
      "Your future self will thank you! 🌟",
      "Building wealth, one day at a time! 📈",
      "Stay consistent, stay wealthy! 💰"
    ];
    const motivationalEl = document.getElementById('motivationalMessage');
    if (motivationalEl) {
      motivationalEl.textContent = quotes[Math.floor(Math.random() * quotes.length)];
    }

  } catch (error) {
    console.error('Load gamification error:', error);
    // Set defaults if gamification API fails
    document.getElementById('userLevel').textContent = 'Level 1';
    document.getElementById('levelBadge').textContent = '1';
    document.getElementById('xpText').textContent = '0 / 100 XP';
  }
}

// Modal functions
function openExpenseModal() {
  populateSelectOptions();
  document.getElementById('expenseDate').value = utils.getTodayDate();
  document.getElementById('expenseModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function openIncomeModal() {
  populateIncomeOptions();
  document.getElementById('incomeDate').value = utils.getTodayDate();
  document.getElementById('incomeModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function openBudgetModal() {
  document.getElementById('budgetStartDate').value = utils.getTodayDate();
  document.getElementById('budgetModal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  document.body.style.overflow = '';
}

// Backdrop click to close modals
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', function(e) {
      if (e.target === this) closeModal(this.id);
    });
  });
});

function populateSelectOptions() {
  const categorySelect = document.getElementById('expenseCategory');
  categorySelect.innerHTML = utils.EXPENSE_CATEGORIES.map(cat => 
    `<option value="${cat}">${utils.getCategoryIcon(cat)} ${cat}</option>`
  ).join('');

  const methodSelect = document.getElementById('expensePaymentMethod');
  methodSelect.innerHTML = utils.PAYMENT_METHODS.map(method => 
    `<option value="${method}">${method}</option>`
  ).join('');
}

function populateIncomeOptions() {
  const sourceSelect = document.getElementById('incomeSource');
  sourceSelect.innerHTML = utils.INCOME_SOURCES.map(source => 
    `<option value="${source}">${source}</option>`
  ).join('');
}

// Handle add expense
async function handleAddExpense(event) {
  event.preventDefault();
  
  // Validate inputs
  const amount = parseFloat(document.getElementById('expenseAmount').value);
  const category = document.getElementById('expenseCategory').value;
  const paymentMethod = document.getElementById('expensePaymentMethod').value;
  const expenseDate = document.getElementById('expenseDate').value;
  
  if (!amount || amount <= 0) {
    utils.showAlert('Please enter a valid amount', 'error');
    return;
  }
  
  if (!category) {
    utils.showAlert('Please select a category', 'error');
    return;
  }
  
  if (!paymentMethod) {
    utils.showAlert('Please select a payment method', 'error');
    return;
  }
  
  if (!expenseDate) {
    utils.showAlert('Please select a date', 'error');
    return;
  }
  
  const noteValue = document.getElementById('expenseNote').value;
  const expenseData = {
    amount: amount,
    category: category,
    payment_method: paymentMethod,
    expense_date: expenseDate,
    is_recurring: false
  };
  
  // Only include optional fields if they have values
  if (noteValue) {
    expenseData.note = noteValue;
  }
  if (false) { // is_recurring is false, so don't include recurring_frequency
    expenseData.recurring_frequency = null;
  }

  try {
    utils.showLoading();
    const response = await api.createExpense(expenseData);
    
    utils.hideLoading();
    
    // Award XP for expense tracking
    celebrateXPGain(10); // Award 10 XP for tracking expense
    
    showFunToast('Expense added successfully! +10 XP earned! 🎉', '💸', 'success');
    
    closeModal('expenseModal');
    document.getElementById('expenseForm').reset();
    
    // Reload data and check for new achievements
    await initDashboard();
    await checkNewAchievements();
  } catch (error) {
    utils.hideLoading();
    utils.showAlert(error.message || 'Failed to add expense', 'error');
  }
}

// Handle add income
async function handleAddIncome(event) {
  event.preventDefault();
  
  // Validate inputs
  const amount = parseFloat(document.getElementById('incomeAmount').value);
  const source = document.getElementById('incomeSource').value;
  const incomeDate = document.getElementById('incomeDate').value;
  
  if (!amount || amount <= 0) {
    utils.showAlert('Please enter a valid amount', 'error');
    return;
  }
  
  if (!source) {
    utils.showAlert('Please select an income source', 'error');
    return;
  }
  
  if (!incomeDate) {
    utils.showAlert('Please select a date', 'error');
    return;
  }
  
  const noteValue = document.getElementById('incomeNote').value;
  const incomeData = {
    amount: amount,
    source: source,
    income_date: incomeDate
  };
  
  // Only include optional fields if they have values
  if (noteValue) {
    incomeData.note = noteValue;
  }

  try {
    utils.showLoading();
    await api.createIncome(incomeData);
    
    utils.hideLoading();
    showFunToast('Income added successfully! 💰', '💵', 'success');
    
    closeModal('incomeModal');
    document.getElementById('incomeForm').reset();
    
    await loadFinancialSummary();
    await checkNewAchievements();
  } catch (error) {
    utils.hideLoading();
    utils.showAlert(error.message || 'Failed to add income', 'error');
  }
}

// Handle set budget
async function handleSetBudget(event) {
  event.preventDefault();
  
  // Validate inputs
  const period = document.getElementById('budgetPeriod').value;
  const amount = parseFloat(document.getElementById('budgetAmount').value);
  const startDate = document.getElementById('budgetStartDate').value;
  
  if (!period) {
    utils.showAlert('Please select a budget period', 'error');
    return;
  }
  
  if (!amount || amount <= 0) {
    utils.showAlert('Please enter a valid budget amount', 'error');
    return;
  }
  
  if (!startDate) {
    utils.showAlert('Please select a start date', 'error');
    return;
  }
  
  // Calculate end date based on period
  const start = new Date(startDate);
  const end = new Date(start);
  if (period === 'weekly') {
    end.setDate(end.getDate() + 7);
  } else if (period === 'monthly') {
    end.setMonth(end.getMonth() + 1);
  }
  
  const budgetData = {
    period_type: period,
    amount: amount,
    start_date: startDate,
    end_date: end.toISOString().split('T')[0],
    is_active: true
  };

  try {
    utils.showLoading();
    await api.createBudget(budgetData);
    
    utils.hideLoading();
    showFunToast('Budget set successfully! 💼', '💰', 'success');
    
    closeModal('budgetModal');
    document.getElementById('budgetForm').reset();
    
    await loadBudget();
  } catch (error) {
    utils.hideLoading();
    utils.showAlert(error.message || 'Failed to set budget', 'error');
  }
}

// Add XP to user
async function addXP(amount) {
  try {
    // Call backend to add XP
    const response = await api.post('/gamification/xp/add', { amount });
    if (response.success) {
      // Check if level up occurred
      if (response.data.level_up) {
        celebrateAchievement(`Level ${response.data.new_level}`);
      }
      // Reload gamification data
      await loadGamificationData();
    }
  } catch (error) {
    console.warn('Failed to add XP:', error);
  }
}

// Award badge
async function awardBadge(badgeName) {
  try {
    const response = await api.post('/gamification/badges/award', { badge_name: badgeName });
    if (response.success) {
      celebrateAchievement(badgeName);
      await loadGamificationData();
    }
  } catch (error) {
    console.warn('Failed to award badge:', error);
  }
}

// Update streak
async function updateStreak() {
  try {
    const response = await api.put('/gamification/streak/update', {});
    if (response.success) {
      const streak = response.data;
      if (streak.new_milestone) {
        celebrateStreak(streak.current_streak);
      }
      await loadGamificationData();
    }
  } catch (error) {
    console.warn('Failed to update streak:', error);
  }
}

// Logout
function logout() {
  api.logout();
}

// Load widget data for new features
async function loadWidgets() {
  try {
    // Load bills summary
    try {
      const billsResponse = await api.get('/bills/summary');
      if (billsResponse.success && billsResponse.data) {
        const dueBills = (billsResponse.data.overdue_count || billsResponse.data.overdue || 0) + (billsResponse.data.due_soon_count || billsResponse.data.due_soon || 0);
        const billsCountEl = document.getElementById('billsDueCount');
        if (billsCountEl) billsCountEl.textContent = dueBills > 0 ? dueBills : '–';
      }
    } catch (e) { /* Bills API not available */ }

    // Load active challenges
    try {
      const challengesResponse = await api.get('/challenges/stats');
      if (challengesResponse.success) {
        const challengesEl = document.getElementById('activeChallenges');
        const n = challengesResponse.data.active_challenges || 0;
        if (challengesEl) challengesEl.textContent = n > 0 ? n : '–';
      }
    } catch (e) { /* Challenges API not available */ }

    // Load achievements count
    try {
      const achievementsResponse = await api.get('/achievements/stats');
      if (achievementsResponse.success) {
        const achievementsEl = document.getElementById('achievementsEarned');
        const n = achievementsResponse.data.earned_achievements || 0;
        if (achievementsEl) achievementsEl.textContent = n > 0 ? n : '–';
      }
    } catch (e) { /* Achievements API not available */ }

    // Load spending insights
    loadSpendingInsights();

  } catch (error) {
    console.log('Widgets loading skipped:', error.message);
  }
}

// Close modal on outside click
window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.classList.remove('active');
  }
}

// ================================
// SPENDING INSIGHTS SLIDER ENGINE
// ================================

let insightsSliderState = { index: 0, total: 0, autoPlay: null, paused: false };

async function loadSpendingInsights() {
  const container = document.getElementById('spendingInsights');
  const countBadge = document.getElementById('insightCount');
  const greetingEl = document.getElementById('insightsGreeting');
  const footer = document.getElementById('insightsFooter');

  if (!container) return;

  // Fun loading messages
  const loadingMsgs = [
    'Crunching your numbers... 🧮',
    'Analyzing your spending brain... 🧠',
    'Consulting the money oracle... 🔮',
    'Teaching your cedis some tricks... 🎪',
    'Reading your financial fortune... ⭐',
    'Summoning 30 insights... 🪄',
    'Scanning every cedi and pesewa... 💰'
  ];

  if (greetingEl) {
    greetingEl.textContent = loadingMsgs[Math.floor(Math.random() * loadingMsgs.length)];
  }

  // Show loading shimmer
  container.innerHTML = `
    <div class="insight-shimmer"></div>
    <div class="insight-shimmer"></div>
  `;
  if (countBadge) countBadge.textContent = '';
  if (footer) footer.style.display = 'none';

  try {
    // Fetch ALL insights (up to 30)
    const response = await api.get('/comparisons/insights?limit=30&all=true');

    if (response.success && response.data && response.data.length > 0) {
      const insights = response.data;
      insightsSliderState.total = insights.length;
      insightsSliderState.index = 0;

      if (countBadge) countBadge.textContent = `${insights.length} 🎯`;

      // Fun greeting based on insight count & mix
      if (greetingEl) {
        const hasPositive = insights.some(i => i.type === 'positive');
        const hasAlert = insights.some(i => i.type === 'alert');
        const count = insights.length;
        const greetings = count >= 10
          ? [`${count} insights about YOUR money! Swipe to explore 👉`, `Loaded ${count} smart insights! Your money has STORIES 📖`, `${count} insights ready! Slide through your financial storybook ✨`]
          : hasPositive && !hasAlert
          ? ['You\'re doing amazing! Here\'s why 👇', 'Look at you go! 🌟 Your highlights:', 'Your money game is strong! 💪 Check it:']
          : hasAlert
          ? ['Heads up! Some things need your attention 👀', 'Let\'s talk about your money moves 💬', 'A few things to keep an eye on 🔍']
          : ['Here\'s what your money has been up to 👇', 'Your spending story this week 📖', 'Fresh insights just for you ✨'];
        greetingEl.textContent = greetings[Math.floor(Math.random() * greetings.length)];
      }

      // Render all cards
      container.innerHTML = insights.map((insight, i) => `
        <div class="insight-card ${insight.type || 'info'}" data-mood="${insight.mood || 'chill'}" data-index="${i}" style="transition-delay: ${Math.min(i, 3) * 100}ms;">
          <div class="insight-card-top">
            <div class="insight-icon-wrap">
              <i data-lucide="${insight.icon}"></i>
            </div>
            <div class="insight-title">${insight.title}</div>
          </div>
          <div class="insight-msg">${insight.message}</div>
          ${insight.tip ? `<div class="insight-tip">${insight.tip}</div>` : ''}
          ${insight.source ? `<div class="insight-source"><i data-lucide="database" style="width:12px;height:12px;"></i> Based on: ${insight.source}</div>` : ''}
        </div>
      `).join('');

      // Initialize Lucide icons inside insight cards
      if (typeof lucide !== 'undefined') lucide.createIcons();

      // Animate first visible cards in
      requestAnimationFrame(() => {
        const cards = container.querySelectorAll('.insight-card');
        cards.forEach((card, i) => {
          if (i < 3) setTimeout(() => card.classList.add('visible'), i * 120);
        });
      });

      // Show footer with dots only
      if (footer && insights.length > 1) {
        footer.style.display = 'flex';
        buildInsightsDots(insights.length);
        setupInsightsSlider(container, insights.length);
      }

    } else {
      // Fun empty state
      if (greetingEl) greetingEl.textContent = '';
      if (footer) footer.style.display = 'none';
      const emptyMsgs = [
        { icon: 'search', title: 'Nothing to report... yet!', desc: 'Start logging expenses and I\'ll become your personal money detective!' },
        { icon: 'sprout', title: 'Plant your first expense!', desc: 'Your insights garden is empty. Add expenses and watch brilliant insights bloom!' },
        { icon: 'gamepad-2', title: 'Level 0: No Data', desc: 'Log some expenses to unlock 30 smart insights. It\'s like a game — but with real money!' },
        { icon: 'wand-2', title: '30 Insights Waiting!', desc: 'Add expenses, income, goals & budgets to unlock all 30 money insights! Magic awaits!' }
      ];
      const msg = emptyMsgs[Math.floor(Math.random() * emptyMsgs.length)];
      container.innerHTML = `
        <div class="insights-empty" style="width: 100%;">
          <div class="insights-empty-icon"><i data-lucide="${msg.icon}" style="width:32px;height:32px;"></i></div>
          <div class="insights-empty-title">${msg.title}</div>
          <div class="insights-empty-desc">${msg.desc}</div>
        </div>
      `;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
  } catch (e) {
    console.log('Insights loading:', e.message);
    if (greetingEl) greetingEl.textContent = '';
    if (footer) footer.style.display = 'none';
    container.innerHTML = `
      <div class="insights-empty" style="width: 100%;">
        <div class="insights-empty-icon"><i data-lucide="bot" style="width:32px;height:32px;"></i></div>
        <div class="insights-empty-title">Insights are napping</div>
        <div class="insights-empty-desc">Our insight engine is taking a quick break. Add some expenses and check back soon!</div>
      </div>
    `;
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

function buildInsightsDots(total) {
  const dotsContainer = document.getElementById('insightsDots');
  if (!dotsContainer) return;
  // Show max 8 dots, collapse the rest
  const maxDots = Math.min(total, 8);
  dotsContainer.innerHTML = Array.from({ length: maxDots }, (_, i) =>
    `<div class="insights-dot${i === 0 ? ' active' : ''}" data-dot="${i}"></div>`
  ).join('');
  // Click on dot to navigate
  dotsContainer.querySelectorAll('.insights-dot').forEach(dot => {
    dot.addEventListener('click', () => {
      const dotIdx = parseInt(dot.dataset.dot);
      const mappedIdx = total > 8 ? Math.round(dotIdx / 7 * (total - 1)) : dotIdx;
      scrollToInsight(mappedIdx);
    });
  });
}

function updateInsightsDots(current, total) {
  const dotsContainer = document.getElementById('insightsDots');
  if (!dotsContainer) return;
  const dots = dotsContainer.querySelectorAll('.insights-dot');
  const maxDots = dots.length;
  const activeDot = total > 8 ? Math.round(current / (total - 1) * 7) : current;
  dots.forEach((d, i) => d.classList.toggle('active', i === activeDot));
}

function scrollToInsight(index) {
  const container = document.getElementById('spendingInsights');
  if (!container) return;
  const cards = container.querySelectorAll('.insight-card');
  if (index < 0 || index >= cards.length) return;

  insightsSliderState.index = index;
  cards[index].scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' });

  // Make card visible if not already
  if (!cards[index].classList.contains('visible')) {
    cards[index].classList.add('visible');
  }

  updateInsightsDots(index, insightsSliderState.total);
}

function setupInsightsSlider(container, total) {
  // Scroll-based index tracking
  let scrollTimeout;
  container.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const cards = container.querySelectorAll('.insight-card');
      const containerRect = container.getBoundingClientRect();
      let closest = 0, minDist = Infinity;
      cards.forEach((card, i) => {
        const rect = card.getBoundingClientRect();
        const dist = Math.abs(rect.left - containerRect.left);
        if (dist < minDist) { minDist = dist; closest = i; }
        if (rect.left < containerRect.right && rect.right > containerRect.left) {
          card.classList.add('visible');
        }
      });
      insightsSliderState.index = closest;
      updateInsightsDots(closest, total);
    }, 60);
  }, { passive: true });

  // Touch pause (pause on touch, resume after)
  container.addEventListener('touchstart', () => pauseAutoPlay(), { passive: true });
  container.addEventListener('touchend', () => {
    setTimeout(() => resumeAutoPlay(), 5000);
  }, { passive: true });

  // Start auto-play (every 4 seconds)
  startAutoPlay(total);
}

function startAutoPlay(total) {
  stopAutoPlayTimer();
  insightsSliderState.paused = false;

  insightsSliderState.autoPlay = setInterval(() => {
    if (insightsSliderState.paused) return;
    const newIdx = (insightsSliderState.index + 1) % total;
    scrollToInsight(newIdx);
  }, 4000);
}

function pauseAutoPlay() {
  insightsSliderState.paused = true;
}

function resumeAutoPlay() {
  insightsSliderState.paused = false;
  if (!insightsSliderState.autoPlay) {
    startAutoPlay(insightsSliderState.total);
  }
}

function stopAutoPlayTimer() {
  if (insightsSliderState.autoPlay) {
    clearInterval(insightsSliderState.autoPlay);
    insightsSliderState.autoPlay = null;
  }
}

// Refresh insights button handler
document.addEventListener('DOMContentLoaded', () => {
  const refreshBtn = document.getElementById('insightsRefreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.classList.add('spinning');
      stopAutoPlayTimer();
      const greetingEl = document.getElementById('insightsGreeting');
      const refreshMsgs = ['Shuffling your insights... 🎲', 'Getting fresh data... 🍃', 'Recalculating genius... 🧠✨', 'Reloading 30 money wisdom bombs... 💣'];
      if (greetingEl) greetingEl.textContent = refreshMsgs[Math.floor(Math.random() * refreshMsgs.length)];
      await loadSpendingInsights();
      setTimeout(() => refreshBtn.classList.remove('spinning'), 600);
    });
  }
});

// ================================
// FUN & LIVELY INTERACTIONS 🎉
// ================================

// Animated number counter
function animateCounter(element, target, duration = 1000, prefix = '', suffix = '') {
  const start = 0;
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
    const current = Math.floor(start + (target - start) * easeProgress);
    element.textContent = prefix + current.toLocaleString() + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      element.textContent = prefix + target.toLocaleString() + suffix;
      // Add pop effect at the end
      element.classList.add('animate-pop');
      setTimeout(() => element.classList.remove('animate-pop'), 300);
    }
  }
  
  requestAnimationFrame(update);
}

// Confetti celebration effect
function showConfetti() {
  const colors = ['#006B3F', '#00a05e', '#ffffff', '#34d399'];
  const confettiCount = 50;
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.style.cssText = `
      position: fixed;
      width: 10px;
      height: 10px;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      left: ${Math.random() * 100}vw;
      top: 0;
      border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      z-index: 9999;
      pointer-events: none;
      animation: confetti-fall ${2 + Math.random() * 2}s linear forwards;
    `;
    document.body.appendChild(confetti);
    
    setTimeout(() => confetti.remove(), 4000);
  }
  
  // Add confetti keyframes if not exists
  if (!document.getElementById('confetti-style')) {
    const style = document.createElement('style');
    style.id = 'confetti-style';
    style.textContent = `
      @keyframes confetti-fall {
        0% { transform: translateY(-10px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
}

// Fun toast notification
function showFunToast(message, emoji = '🎉', type = 'success') {
  const existing = document.querySelector('.fun-toast');
  if (existing) existing.remove();
  
  const toast = document.createElement('div');
  toast.className = 'fun-toast';
  toast.innerHTML = `<span style="font-size: 24px;">${emoji}</span> ${message}`;
  toast.style.cssText = `
    position: fixed;
    bottom: 120px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: ${type === 'success' ? 'linear-gradient(135deg, #006B3F, #00a05e)' : 'var(--card-bg)'};
    color: white;
    padding: 12px 20px;
    border-radius: 50px;
    font-weight: 600;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 10px;
    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
    z-index: 9999;
    animation: toast-in 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255,255,255,0.2);
  `;
  
  document.body.appendChild(toast);
  
  // Add animation keyframes if not exists
  if (!document.getElementById('toast-style')) {
    const style = document.createElement('style');
    style.id = 'toast-style';
    style.textContent = `
      @keyframes toast-in {
        from { transform: translateX(-50%) translateY(100px) scale(0.8); opacity: 0; }
        to { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
      }
      @keyframes toast-out {
        from { transform: translateX(-50%) translateY(0) scale(1); opacity: 1; }
        to { transform: translateX(-50%) translateY(100px) scale(0.8); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Celebrate achievement unlock
function celebrateAchievement(title) {
  showConfetti();
  showFunToast(`Achievement Unlocked: ${title}!`, '🏆');
  
  // Add sound effect (web audio)
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
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.15 + 0.3);
      osc.start(audioCtx.currentTime + i * 0.15);
      osc.stop(audioCtx.currentTime + i * 0.15 + 0.3);
    });
  } catch (e) { /* Audio not supported */ }
}

// Money saved celebration
function celebrateSavings(amount) {
  if (amount > 100) {
    showFunToast(`You saved ${utils.formatCurrency(amount)} this month!`, '💰');
    document.querySelector('.balance-amount')?.classList.add('animate-heartbeat');
    setTimeout(() => {
      document.querySelector('.balance-amount')?.classList.remove('animate-heartbeat');
    }, 2000);
  }
}

// Streak celebration
function celebrateStreak(days) {
  if (days === 7) {
    showFunToast('7 Day Streak! Keep it up! 🔥', '🔥');
    showConfetti();
  } else if (days === 30) {
    showFunToast('30 Day Streak! You\'re amazing! 🏆', '🏆');
    showConfetti();
  }
}

// XP gain celebration
function celebrateXPGain(amount) {
  showFunToast(`+${amount} XP earned! 🌟`, '⭐');
  
  // Animate the XP bar
  const xpBar = document.getElementById('xpProgress');
  if (xpBar) {
    xpBar.style.transition = 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)';
  }
}

// Level up celebration
function celebrateLevelUp(newLevel) {
  // Show confetti
  showConfetti();
  
  // Create level-up overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 107, 63, 0.95);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s;
  `;
  
  overlay.innerHTML = `
    <div style="
      text-align: center;
      color: white;
      animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
    ">
      <div style="font-size: 80px; margin-bottom: 20px;">🎉</div>
      <h1 style="font-size: 36px; font-weight: 700; margin-bottom: 10px;">Level Up!</h1>
      <div style="
        font-size: 64px;
        font-weight: 700;
        background: linear-gradient(135deg, #FFD700, #FFA500);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        background-clip: text;
        margin-bottom: 10px;
      ">Level ${newLevel}</div>
      <p style="font-size: 18px; opacity: 0.9;">You're getting better at managing your money!</p>
      <button onclick="this.parentElement.parentElement.remove()" style="
        margin-top: 30px;
        background: white;
        color: var(--primary-color);
        border: none;
        padding: 12px 32px;
        border-radius: 25px;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
      ">Continue</button>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add animation styles if not exists
  if (!document.getElementById('levelup-animations')) {
    const style = document.createElement('style');
    style.id = 'levelup-animations';
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes bounceIn {
        0% { transform: scale(0); opacity: 0; }
        50% { transform: scale(1.1); opacity: 1; }
        100% { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Play level-up sound
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [261.63, 329.63, 392.00, 523.25, 659.25]; // C4, E4, G4, C5, E5
    
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.1 + 0.4);
      osc.start(audioCtx.currentTime + i * 0.1);
      osc.stop(audioCtx.currentTime + i * 0.1 + 0.4);
    });
  } catch (e) { /* Audio not supported */ }
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => overlay.remove(), 5000);
}

// Add bounce to navigation items on tap
document.querySelectorAll('.bottom-nav-item').forEach(item => {
  item.addEventListener('touchstart', function() {
    this.style.animation = 'bounce 0.3s ease';
  });
  item.addEventListener('animationend', function() {
    this.style.animation = '';
  });
});

// Add ripple effect to buttons
document.querySelectorAll('.btn').forEach(btn => {
  btn.addEventListener('click', function(e) {
    const ripple = document.createElement('span');
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;
    
    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(255,255,255,0.3);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple-effect 0.6s ease forwards;
      pointer-events: none;
    `;
    
    this.style.position = 'relative';
    this.style.overflow = 'hidden';
    this.appendChild(ripple);
    
    setTimeout(() => ripple.remove(), 600);
  });
});

// Add emoji reactions
function addEmojiReaction(element, emoji) {
  const reaction = document.createElement('span');
  reaction.textContent = emoji;
  reaction.style.cssText = `
    position: absolute;
    font-size: 20px;
    animation: float-up 1s ease forwards;
    pointer-events: none;
    z-index: 100;
  `;
  element.style.position = 'relative';
  element.appendChild(reaction);
  
  if (!document.getElementById('float-up-style')) {
    const style = document.createElement('style');
    style.id = 'float-up-style';
    style.textContent = `
      @keyframes float-up {
        0% { transform: translateY(0) scale(1); opacity: 1; }
        100% { transform: translateY(-50px) scale(1.5); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }
  
  setTimeout(() => reaction.remove(), 1000);
}

// Daily motivational quotes with time-based variety
function getDailyQuote() {
  const quotes = [
    { text: "Every cedi saved is a cedi earned! 💪", emoji: "💪" },
    { text: "Small steps lead to big wins! 🚀", emoji: "🚀" },
    { text: "Your future self will thank you! 🌟", emoji: "🌟" },
    { text: "Building wealth, one day at a time! 📈", emoji: "📈" },
    { text: "Stay consistent, stay wealthy! 💰", emoji: "💰" },
    { text: "Financial freedom starts today! 🎯", emoji: "🎯" },
    { text: "Smart money moves pay off! 🧠", emoji: "🧠" },
    { text: "Track today, prosper tomorrow! ✨", emoji: "✨" },
    { text: "Discipline is the bridge to success! 🌉", emoji: "🌉" },
    { text: "Every budget kept is a goal met! 🏆", emoji: "🏆" }
  ];
  
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / (1000 * 60 * 60 * 24));
  return quotes[dayOfYear % quotes.length];
}

// Check for new achievements (global function accessible from all pages)
async function checkNewAchievements() {
  try {
    const response = await api.post('/achievements/check');
    if (response.success && response.data.newly_earned && response.data.newly_earned.length > 0) {
      // Show achievement unlock for each new achievement (max 3 to avoid spam)
      const achievements = response.data.newly_earned.slice(0, 3);
      achievements.forEach((achievement, index) => {
        setTimeout(() => {
          showAchievementUnlockNotification(achievement);
        }, index * 1000); // Stagger notifications by 1 second each
      });
      
      // Reload gamification data to update badges/XP
      await loadGamificationData();
    }
  } catch (error) {
    console.warn('Achievement check error:', error);
  }
}

// Show achievement unlock notification (global popup)
function showAchievementUnlockNotification(achievement) {
  // Play celebration sound
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 659.25, 783.99]; // C5, E5, G5 (achievement jingle)
    
    notes.forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime + i * 0.1);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + i * 0.1 + 0.3);
      osc.start(audioCtx.currentTime + i * 0.1);
      osc.stop(audioCtx.currentTime + i * 0.1 + 0.3);
    });
  } catch (e) { /* Audio not supported */ }
  
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'achievement-unlock-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0,0,0,0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    animation: fadeIn 0.3s;
  `;
  
  overlay.innerHTML = `
    <div style="
      background: linear-gradient(135deg, #006B3F 0%, #004d2c 100%);
      border-radius: 24px;
      padding: 2.5rem;
      text-align: center;
      max-width: 340px;
      width: 90%;
      animation: bounceIn 0.6s cubic-bezier(0.68, -0.55, 0.265, 1.55);
      box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      border: 2px solid rgba(255,255,255,0.1);
    ">
      <div style="font-size: 4.5rem; margin-bottom: 1.2rem; animation: pulse 1s infinite;">🎉</div>
      <h2 style="color: #FFD700; margin-bottom: 0.8rem; font-size: 22px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
        Achievement Unlocked!
      </h2>
      <div style="font-size: 3.5rem; margin: 1.2rem 0; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3));">
        ${achievement.icon || '⭐'}
      </div>
      <h3 style="color: white; margin-bottom: 0.6rem; font-size: 20px; font-weight: 600;">
        ${achievement.name || 'New Achievement'}
      </h3>
      <p style="color: rgba(255,255,255,0.8); font-size: 14px; line-height: 1.5; margin-bottom: 1.2rem;">
        ${achievement.description || 'You did something amazing!'}
      </p>
      <div style="
        background: linear-gradient(135deg, #FFD700, #FFA500);
        color: #004d2c;
        padding: 10px 20px;
        border-radius: 20px;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        margin-top: 1rem;
        font-weight: 700;
        font-size: 15px;
        box-shadow: 0 4px 12px rgba(255,215,0,0.4);
      ">
        <span style="font-size: 18px;">⭐</span>
        +${achievement.xp_reward || 0} XP
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // Add animation styles if not exists
  if (!document.getElementById('achievement-animations')) {
    const style = document.createElement('style');
    style.id = 'achievement-animations';
    style.textContent = `
      @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.1); }
      }
    `;
    document.head.appendChild(style);
  }
  
  // Show confetti
  showConfetti();
  
  // Click to dismiss
  overlay.addEventListener('click', () => overlay.remove());
  
  // Auto-dismiss after 5 seconds
  setTimeout(() => overlay.remove(), 5000);
}

// Initialize currency display with correct symbol
function initCurrencyDisplay() {
  const symbol = utils.getCurrencySymbol();
  const balanceEl = document.getElementById('balanceAmount');
  const incomeEl = document.getElementById('totalIncome');
  const expenseEl = document.getElementById('totalExpenses');
  const budgetSpentEl = document.getElementById('budgetSpent');
  const budgetRemainingEl = document.getElementById('budgetRemaining');
  
  if (balanceEl) balanceEl.textContent = `${symbol} 0.00`;
  if (incomeEl) incomeEl.textContent = `+${symbol} 0`;
  if (expenseEl) expenseEl.textContent = `-${symbol} 0`;
  if (budgetSpentEl && budgetSpentEl.textContent.includes('spent')) {
    budgetSpentEl.textContent = `${symbol} 0 spent`;
  }
  if (budgetRemainingEl && budgetRemainingEl.textContent.includes('left')) {
    budgetRemainingEl.textContent = `${symbol} 0 left`;
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initCurrencyDisplay();
  initDashboard();
  loadWidgets();
  
  // Add fun entrance animations
  setTimeout(() => {
    document.querySelector('.mtn-profile-section')?.classList.add('animate-slide-up');
    document.querySelector('.balance-card')?.classList.add('animate-zoom');
  }, 100);
  
  // Make FAB more interactive
  const fab = document.querySelector('.fab');
  if (fab) {
    fab.addEventListener('touchstart', () => fab.classList.add('animate-pop'));
    fab.addEventListener('animationend', () => fab.classList.remove('animate-pop'));
  }
});
