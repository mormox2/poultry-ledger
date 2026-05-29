export function logActivity(userId, action, details) {
  try {
    const key = `dawajin_activity_log_${userId || 'guest'}`;
    const saved = localStorage.getItem(key);
    let logs = saved ? JSON.parse(saved) : [];
    
    const newLog = {
      id: Date.now() + Math.random().toString(36).substr(2, 5),
      timestamp: new Date().toISOString(),
      action, // e.g. 'CLIENT_ADD', 'CLIENT_DELETE', 'LEDGER_UPDATE', 'PURCHASE_UPDATE', 'QUICK_SETTLE', 'PASSWORD_CHANGE', 'BACKUP_EXPORT'
      details // string with detailed description
    };
    
    logs.unshift(newLog);
    // Limit to 500 entries (circular buffer)
    if (logs.length > 500) {
      logs = logs.slice(0, 500);
    }
    
    localStorage.setItem(key, JSON.stringify(logs));
  } catch (err) {
    console.error("Failed to log activity:", err);
  }
}

export function getActivityLog(userId) {
  try {
    const key = `dawajin_activity_log_${userId || 'guest'}`;
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : [];
  } catch (err) {
    console.error("Failed to get activity log:", err);
    return [];
  }
}

export function clearActivityLog(userId) {
  try {
    const key = `dawajin_activity_log_${userId || 'guest'}`;
    localStorage.removeItem(key);
  } catch (err) {
    console.error("Failed to clear activity log:", err);
  }
}
