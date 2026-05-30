import React, { useState, useEffect, useRef, lazy, Suspense, useCallback } from 'react';
import './styles/main.css';
import { supabase } from './js/supabaseClient';

// Critical Components (Statically Imported for Instant Load)
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';
import SkeletonLoader from './components/SkeletonLoader';

// Secondary Components (Lazy Loaded for Code Splitting)
const Ledger = lazy(() => import('./components/Ledger'));
const Clients = lazy(() => import('./components/Clients'));
const Suppliers = lazy(() => import('./components/Suppliers'));
const PurchasesLedger = lazy(() => import('./components/PurchasesLedger'));
const Analytics = lazy(() => import('./components/Analytics'));
const Summary = lazy(() => import('./components/Summary'));
const InvoicePrint = lazy(() => import('./components/InvoicePrint'));
const InstallModal = lazy(() => import('./components/InstallModal'));
const Deadlines = lazy(() => import('./components/Deadlines'));
const StatementPrint = lazy(() => import('./components/StatementPrint'));
const SupplierStatementPrint = lazy(() => import('./components/SupplierStatementPrint'));
const CommandPalette = lazy(() => import('./components/CommandPalette'));
const NotificationCenter = lazy(() => import('./components/NotificationCenter'));
const CashBook = lazy(() => import('./components/CashBook'));

// Utilities Import
import { 
  MONTHS, 
  ledgerKey, 
  getRows, 
  getTotals, 
  daysInMonth, 
  calcBalance, 
  exportToCSV,
  exportPurchasesToCSV
} from './js/utils';

import { logActivity, getActivityLog, clearActivityLog } from './js/activityLog';

// Custom Hooks Import
import useLedger from './hooks/useLedger';
import usePurchases from './hooks/usePurchases';
import useBackup from './hooks/useBackup';

// --- Offline Sync Queue (IndexedDB) Setup ---
const syncDBName = 'PoultryLedgerDB';
const syncStoreName = 'sync_queue';


export default function App() {
  // --- Supabase Cloud States ---
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // --- Network & Offline Sync States ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  // Detect if Supabase is filled in .env
  const isSupabaseConfigured = 
    import.meta.env.VITE_SUPABASE_URL && 
    !import.meta.env.VITE_SUPABASE_URL.includes('your-supabase-project');

  // --- Authentication States ---
  const [password, setPassword] = useState(() => localStorage.getItem("dawajin_password") || "");
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    return localStorage.getItem("dawajin_logged_in") === "true";
  });
  const [plainPassword, setPlainPassword] = useState(() => sessionStorage.getItem("dawajin_plain_password") || "");

  // Initialize state from localStorage (standalone fallback)
  const getInitialState = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const defaultState = {
      clients: [],
      ledger: {},
      selectedClient: null,
      suppliers: [],
      purchases: {},
      selectedSupplier: null,
      deadlines: [],
      cashBook: [],
      pricePerKg: 5.800,
      defaultPurchasePricePerKg: 5.200,
      view: "dashboard",
      theme: "dark",
      month: currentMonth,
      year: currentYear,
      role: "admin",
      companyInfo: {
        name: "الودرني للدواجن",
        address: "وادي النور الحامة,قابس",
        phone: "96 101 651",
        taxId: "1895235/E",
        invoiceTemplate: "classic",
        invoiceFooter: "",
        invoiceLogoUrl: ""
      }
    };
    try {
      const saved = localStorage.getItem("dawajin_state");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultState,
          ...parsed,
          companyInfo: {
            ...defaultState.companyInfo,
            ...(parsed.companyInfo || {})
          },
          month: parsed.month || currentMonth,
          year: parsed.year || currentYear,
          view: parsed.view || "dashboard",
          suppliers: parsed.suppliers || defaultState.suppliers,
          purchases: parsed.purchases || defaultState.purchases,
          selectedSupplier: parsed.selectedSupplier || defaultState.selectedSupplier,
          deadlines: parsed.deadlines || defaultState.deadlines,
          cashBook: parsed.cashBook || defaultState.cashBook,
          defaultPurchasePricePerKg: parsed.defaultPurchasePricePerKg || defaultState.defaultPurchasePricePerKg,
          role: parsed.role || "admin"
        };
      }
    } catch (e) {
      console.error("Failed to load initial state from localStorage", e);
    }
    return defaultState;
  };

  const [state, setState] = useState(getInitialState);
  const [lastBackupTime, setLastBackupTime] = useState(0);

  useEffect(() => {
    if (!user) return;
    const updateTime = () => {
      const saved = localStorage.getItem(`dawajin_last_backup_time_${user.id}`);
      setLastBackupTime(saved ? parseInt(saved, 10) : 0);
    };
    updateTime();
    window.addEventListener('storage', updateTime);
    return () => window.removeEventListener('storage', updateTime);
  }, [user]);

  const [activeInvoiceClientId, setActiveInvoiceClientId] = useState(null);
  const [activeStatementClientId, setActiveStatementClientId] = useState(null);
  const [activeStatementSupplierId, setActiveStatementSupplierId] = useState(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [deviceType, setDeviceType] = useState('other');
  const syncDBRef = useRef(null);

  const triggerHaptic = (ms = 12) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        // ignore
      }
    }
  };

  const toastMessage = (msg, type = "success") => {
    // Add to Notification Center history
    const newNotif = {
      id: Date.now() + Math.random().toString(),
      title: type === 'success' ? 'عملية ناجحة' : type === 'warning' ? 'تنبيه بالنظام' : type === 'error' ? 'حدث خطأ' : 'معلومات النظام',
      message: msg,
      type: type,
      time: new Date().toLocaleTimeString('ar-TN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev].slice(0, 30));

    const el = document.getElementById("toast");
    if (!el) return;
    let icon = "✓";
    if (type === "error") icon = "❌";
    else if (type === "warning") icon = "⚠️";
    else if (type === "info") icon = "ℹ️";
    
    el.className = `no-print show ${type}`;
    el.textContent = "";
    
    const iconSpan = document.createElement("span");
    iconSpan.style.fontSize = "16px";
    iconSpan.textContent = icon;
    
    const msgSpan = document.createElement("span");
    msgSpan.textContent = msg;
    
    el.appendChild(iconSpan);
    el.appendChild(msgSpan);
    
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
      el.classList.remove("show");
    }, 2500);
  };

  // Helper to count pending offline sync actions in IndexedDB
  const updatePendingSyncCount = async () => {
    const db = syncDBRef.current;
    if (!db) return;
    try {
      const tx = db.transaction(syncStoreName, 'readonly');
      const store = tx.objectStore(syncStoreName);
      const countReq = store.count();
      countReq.onsuccess = () => {
        setPendingSyncCount(countReq.result);
      };
    } catch (err) {
      console.error("Failed to count pending sync actions:", err);
    }
  };

  // Initialize IndexedDB for offline sync queue
  useEffect(() => {
    if (!('indexedDB' in window)) {
      console.warn('IndexedDB not supported; offline sync queue disabled');
      return;
    }
    const request = indexedDB.open(syncDBName, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(syncStoreName)) {
        db.createObjectStore(syncStoreName, { autoIncrement: true });
      }
    };
    request.onsuccess = () => {
      syncDBRef.current = request.result;
      updatePendingSyncCount();
      // Process any pending items if we are already online
      if (navigator.onLine) processSyncQueue();
    };
    request.onerror = (e) => {
      console.error('Failed to open IndexedDB for sync queue', e);
    };
  }, []);

  // Listen for online/offline events to manage network status and flush queue
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      processSyncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Helper to enqueue a sync action
  const enqueueSync = async (action, payload) => {
    const db = syncDBRef.current;
    if (!db) return;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(syncStoreName, 'readwrite');
      const store = tx.objectStore(syncStoreName);
      store.add({ action, payload });
      tx.oncomplete = () => {
        updatePendingSyncCount();
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  };

  // Process all queued sync actions one by one safely
  const processSyncQueue = async () => {
    const db = syncDBRef.current;
    if (!db) return;

    // 1. Gather all items and their keys in a readonly transaction first
    // This decouples the network calls from the IndexedDB transaction event loop to avoid TransactionInactiveError
    const queue = [];
    try {
      const tx = db.transaction(syncStoreName, 'readonly');
      const store = tx.objectStore(syncStoreName);
      
      await new Promise((resolve) => {
        const request = store.openCursor();
        request.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            queue.push({ key: cursor.key, value: cursor.value });
            cursor.continue();
          } else {
            resolve();
          }
        };
        request.onerror = () => {
          resolve();
        };
      });
    } catch (err) {
      console.error('Failed to read sync queue from IndexedDB:', err);
      return;
    }

    if (queue.length === 0) return;

    // 2. Process each item one by one asynchronously
    for (const item of queue) {
      let success = false;
      try {
        if (item.value.action === 'ledger') {
          const { clientUuid, year, month, idx, row } = item.value.payload;
          // syncLedgerEntryToCloud now returns true on success, false on failure
          success = await syncLedgerEntryToCloud(clientUuid, year, month, idx, row);
        } else if (item.value.action === 'purchase') {
          const { supplierUuid, year, month, idx, row } = item.value.payload;
          success = await syncPurchaseEntryToCloud(supplierUuid, year, month, idx, row);
        } else if (item.value.action === 'deadline_add') {
          const { tempId, ...payload } = item.value.payload;
          try {
            const { data, error } = await supabase
              .from('deadlines')
              .insert({
                profile_id: user.id,
                client_id: payload.client_id,
                supplier_id: payload.supplier_id,
                amount: payload.amount,
                due_date: payload.due_date,
                status: payload.status,
                notes: payload.notes
              })
              .select()
              .single();
            if (!error && data) {
              setState(prev => ({
                ...prev,
                deadlines: (prev.deadlines || []).map(d => d.id === tempId ? { ...d, id: data.id } : d)
              }));
              success = true;
            } else {
              success = false;
            }
          } catch (err) {
            success = false;
          }
        } else if (item.value.action === 'deadline_edit') {
          const payload = item.value.payload;
          try {
            const { error } = await supabase
              .from('deadlines')
              .update({
                client_id: payload.client_id,
                supplier_id: payload.supplier_id,
                amount: payload.amount,
                due_date: payload.due_date,
                status: payload.status,
                notes: payload.notes
              })
              .eq('id', payload.id);
            success = !error;
          } catch (err) {
            success = false;
          }
        } else if (item.value.action === 'deadline_delete') {
          const { id } = item.value.payload;
          try {
            const { error } = await supabase
              .from('deadlines')
              .delete()
              .eq('id', id);
            success = !error;
          } catch (err) {
            success = false;
          }
        } else if (item.value.action === 'deadline_paid') {
          const { id } = item.value.payload;
          try {
            const { error } = await supabase
              .from('deadlines')
              .update({ status: 'paid' })
              .eq('id', id);
            success = !error;
          } catch (err) {
            success = false;
          }
        } else {
          // Unknown action, mark as success to clear it
          success = true;
        }
      } catch (err) {
        console.error("Failed to process sync queue item:", item.value, err);
      }

      // 3. If successful, delete this specific item from IndexedDB in a short atomic transaction
      if (success) {
        try {
          const deleteTx = db.transaction(syncStoreName, 'readwrite');
          const deleteStore = deleteTx.objectStore(syncStoreName);
          deleteStore.delete(item.key);
          await new Promise((resolve, reject) => {
            deleteTx.oncomplete = () => {
              updatePendingSyncCount();
              resolve();
            };
            deleteTx.onerror = () => reject(deleteTx.error);
          });
        } catch (err) {
          console.error("Failed to delete processed item from IndexedDB queue:", item.key, err);
        }
      } else {
        // If a sync fails (e.g. network timeout or drop), stop subsequent syncs
        // to preserve order of consecutive ledger operations
        break;
      }
    }
    // Final counter refresh
    updatePendingSyncCount();
  };

  // Sync a single daily ledger entry to Supabase (returns true on success, false on failure)
  const syncLedgerEntryToCloud = async (clientUuid, year, month, idx, row) => {
    if (!isSupabaseConfigured || !user) return false;
    const day = idx + 1;

    // If offline, enqueue the action and exit
    if (!navigator.onLine) {
      await enqueueSync('ledger', { clientUuid, year, month, idx, row });
      return false;
    }

    try {
      // 1. Fetch remote row for LWW conflict comparison
      const { data: remoteRow, error: fetchErr } = await supabase
        .from('ledger_entries')
        .select('updated_at, total_weight, net_weight, price, amount, paid, holiday, notes')
        .eq('client_id', clientUuid)
        .eq('year', year)
        .eq('month', month)
        .eq('day', day)
        .maybeSingle();

      if (!fetchErr && remoteRow && remoteRow.updated_at) {
        const remoteTime = new Date(remoteRow.updated_at).getTime();
        const localTime = row.local_updated_at ? new Date(row.local_updated_at).getTime() : 0;
        
        if (remoteTime > localTime) {
          // Server wins! Update local React state to match remote row
          setState(prev => {
            const updatedLedger = { ...prev.ledger };
            const k = ledgerKey(clientUuid, year, month);
            if (updatedLedger[k]) {
              const rows = [...updatedLedger[k]];
              if (rows[idx]) {
                rows[idx] = {
                  ...rows[idx],
                  tw: remoteRow.total_weight !== null ? String(remoteRow.total_weight) : "",
                  nw: remoteRow.net_weight !== null ? String(remoteRow.net_weight) : "",
                  price: remoteRow.price !== null ? String(remoteRow.price) : "",
                  amt: remoteRow.amount !== null ? parseFloat(remoteRow.amount) : "",
                  paid: remoteRow.paid !== null ? String(remoteRow.paid) : "",
                  holiday: remoteRow.holiday,
                  notes: remoteRow.notes || "",
                  local_updated_at: remoteRow.updated_at
                };
                updatedLedger[k] = rows;
              }
            }
            return { ...prev, ledger: updatedLedger };
          });
          return true; // Skip upsert and return success
        }
      }

      // 2. Perform regular upsert if local is newer (or no remote row found)
      const { error } = await supabase
        .from('ledger_entries')
        .upsert({
          client_id: clientUuid,
          year: year,
          month: month,
          day: day,
          total_weight: row.tw !== "" ? parseFloat(row.tw) : null,
          net_weight: row.nw !== "" ? parseFloat(row.nw) : null,
          price: row.price !== "" ? parseFloat(row.price) : null,
          amount: row.amt !== "" ? parseFloat(row.amt) : null,
          paid: row.paid !== "" ? parseFloat(row.paid) : null,
          holiday: row.holiday,
          notes: row.notes || null,
          updated_at: new Date()
        }, {
          onConflict: 'client_id,year,month,day'
        });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Cloud row upsert error:", err);
      return false;
    }
  };

  const syncPurchaseEntryToCloud = async (supplierUuid, year, month, idx, row) => {
    if (!isSupabaseConfigured || !user) return false;
    const day = idx + 1;

    // If offline, enqueue the action and exit
    if (!navigator.onLine) {
      await enqueueSync('purchase', { supplierUuid, year, month, idx, row });
      return false;
    }

    try {
      // 1. Fetch remote row for LWW conflict comparison
      const { data: remoteRow, error: fetchErr } = await supabase
        .from('purchases')
        .select('updated_at, total_weight, net_weight, price, amount, paid, holiday, notes, invoice_url')
        .eq('supplier_id', supplierUuid)
        .eq('year', year)
        .eq('month', month)
        .eq('day', day)
        .maybeSingle();

      if (!fetchErr && remoteRow && remoteRow.updated_at) {
        const remoteTime = new Date(remoteRow.updated_at).getTime();
        const localTime = row.local_updated_at ? new Date(row.local_updated_at).getTime() : 0;
        
        if (remoteTime > localTime) {
          // Server wins! Update local React state to match remote row
          setState(prev => {
            const updatedPurchases = { ...prev.purchases };
            const k = ledgerKey(supplierUuid, year, month);
            if (updatedPurchases[k]) {
              const rows = [...updatedPurchases[k]];
              if (rows[idx]) {
                rows[idx] = {
                  ...rows[idx],
                  tw: remoteRow.total_weight !== null ? String(remoteRow.total_weight) : "",
                  nw: remoteRow.net_weight !== null ? String(remoteRow.net_weight) : "",
                  price: remoteRow.price !== null ? String(remoteRow.price) : "",
                  amt: remoteRow.amount !== null ? parseFloat(remoteRow.amount) : "",
                  paid: remoteRow.paid !== null ? String(remoteRow.paid) : "",
                  holiday: remoteRow.holiday,
                  notes: remoteRow.notes || "",
                  invoice_url: remoteRow.invoice_url || "",
                  local_updated_at: remoteRow.updated_at
                };
                updatedPurchases[k] = rows;
              }
            }
            return { ...prev, purchases: updatedPurchases };
          });
          return true; // Skip upsert and return success
        }
      }

      // 2. Perform regular upsert if local is newer (or no remote row found)
      const { error } = await supabase
        .from('purchases')
        .upsert({
          supplier_id: supplierUuid,
          year: year,
          month: month,
          day: day,
          total_weight: row.tw !== "" ? parseFloat(row.tw) : null,
          net_weight: row.nw !== "" ? parseFloat(row.nw) : null,
          price: row.price !== "" ? parseFloat(row.price) : null,
          amount: row.amt !== "" ? parseFloat(row.amt) : null,
          paid: row.paid !== "" ? parseFloat(row.paid) : null,
          holiday: row.holiday,
          notes: row.notes || null,
          invoice_url: row.invoice_url || null,
          updated_at: new Date()
        }, {
          onConflict: 'supplier_id,year,month,day'
        });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error("Cloud purchase row upsert error:", err);
      return false;
    }
  };

  // Password hashing utility (SHA-256 with cryptographically secure Salt)
  const hashPassword = async (plain) => {
    const PASSWORD_SALT = 'dawajin_pro_secure_salt_983756291';
    const encoder = new TextEncoder();
    const data = encoder.encode(plain + PASSWORD_SALT);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  useEffect(() => {
    const checkStandalone = () => {
      const isMStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      setIsStandalone(isMStandalone);
    };

    checkStandalone();
    
    // Listen to media query changes (PWA modes)
    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', checkStandalone);
    } else {
      mediaQuery.addListener(checkStandalone);
    }

    // Detect device OS
    const ua = navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      setDeviceType('ios');
    } else if (/android/.test(ua)) {
      setDeviceType('android');
    } else {
      setDeviceType('other');
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', checkStandalone);
      } else {
        mediaQuery.removeListener(checkStandalone);
      }
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    installPrompt.userChoice.finally(() => {
      setInstallPrompt(null);
    });
  };

  const stateRef = useRef(state);
  const isFetchingRef = useRef(false);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Initialize modular custom hooks
  const {
    handleSelectClient,
    handleUpdateRow,
    handleSyncRow,
    handleToggleHoliday,
    handleAddClient,
    handleEditClient,
    handleDeleteClient,
    handleQuickSettle
  } = useLedger({
    state,
    setState,
    stateRef,
    user,
    isSupabaseConfigured,
    syncLedgerEntryToCloud,
    toastMessage,
    triggerHaptic
  });

  const {
    handleSelectSupplier,
    handleUpdatePurchaseRow,
    handleSyncPurchaseRow,
    handleTogglePurchaseHoliday,
    handleAddSupplier,
    handleEditSupplier,
    handleDeleteSupplier,
    handleQuickPurchaseSettle
  } = usePurchases({
    state,
    setState,
    stateRef,
    user,
    isSupabaseConfigured,
    syncPurchaseEntryToCloud,
    toastMessage,
    triggerHaptic
  });

  const {
    handleBackupCloudExport,
    handleBackupCloudRestore,
    handleBackupExport,
    handleBackupImport
  } = useBackup({
    state,
    setState,
    stateRef,
    user,
    plainPassword,
    isSupabaseConfigured,
    setIsCloudLoading,
    setLastBackupTime,
    toastMessage
  });

  // --- Supabase Session Hook & Listeners ---
  useEffect(() => {
    if (!isSupabaseConfigured) return;

    // Get active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setSession(session);
        setUser(session.user);
        localStorage.setItem("dawajin_logged_in", "true");
        setIsLoggedIn(true);
        fetchCloudData(session.user.id);
      }
    });

    // Listen for auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        setSession(newSession);
        setUser(newSession.user);
        localStorage.setItem("dawajin_logged_in", "true");
        setIsLoggedIn(true);
        fetchCloudData(newSession.user.id);
      } else {
        setSession(null);
        setUser(null);
        localStorage.removeItem("dawajin_logged_in");
        setIsLoggedIn(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Sync state to localStorage whenever it changes (Offline Cache)
  useEffect(() => {
    try {
      // Strip heavy Base64 invoice_url from purchases before localStorage save
      // to prevent QuotaExceededError (localStorage limit ~5-10 Mo)
      const purchasesForStorage = {};
      if (state.purchases) {
        for (const key of Object.keys(state.purchases)) {
          purchasesForStorage[key] = state.purchases[key].map(row => {
            if (row.invoice_url) {
              const { invoice_url, ...rest } = row;
              return { ...rest, has_invoice: true };
            }
            return row;
          });
        }
      }

      localStorage.setItem("dawajin_state", JSON.stringify({
        clients: state.clients,
        ledger: state.ledger,
        selectedClient: state.selectedClient,
        suppliers: state.suppliers,
        purchases: purchasesForStorage,
        selectedSupplier: state.selectedSupplier,
        deadlines: state.deadlines,
        cashBook: state.cashBook,
        view: state.view,
        pricePerKg: state.pricePerKg,
        defaultPurchasePricePerKg: state.defaultPurchasePricePerKg,
        theme: state.theme,
        month: state.month,
        year: state.year,
        role: state.role,
        companyInfo: state.companyInfo
      }));
    } catch (e) {
      console.error("Failed to save state to localStorage", e);
    }
  }, [state]);

  // Apply visual theme to page body
  useEffect(() => {
    const isLight = state.theme === "light";
    document.body.classList.toggle("light-theme", isLight);
    document.documentElement.classList.toggle("dark", !isLight);
  }, [state.theme]);

  // Prevent accidental reload or close of tab in browser
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (!isLoggedIn) return;
      e.preventDefault();
      const msg = "⚠️ هل تريد حقًا مغادرة التطبيق؟ قد تفقد التغييرات غير المحفوظة.";
      e.returnValue = msg;
      return msg;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isLoggedIn]);

  // --- Network Connection Listeners for Offline/Online Toasts ---
  useEffect(() => {
    const handleOnlineStatus = () => {
      setIsOnline(true);
      toastMessage("⚡ تم استعادة الاتصال بالإنترنت بنجاح ! جاري مزامنة البيانات...", "success");
      // Trigger background bridge sync
      if (isLoggedIn && user) {
        fetchCloudData(user.id);
      }
    };

    const handleOfflineStatus = () => {
      setIsOnline(false);
      toastMessage("⚠️ أنت غير متصل بالإنترنت حالياً. تم تفعيل وضع العمل المحلي الآمن.", "warning");
    };

    window.addEventListener('online', handleOnlineStatus);
    window.addEventListener('offline', handleOfflineStatus);

    return () => {
      window.removeEventListener('online', handleOnlineStatus);
      window.removeEventListener('offline', handleOfflineStatus);
    };
  }, [isLoggedIn, user]);

  // Keyboard Shortcut Listener for Command Palette (Ctrl+K / ⌘K)
  useEffect(() => {
    const handleShortcut = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleShortcut);
    return () => window.removeEventListener('keydown', handleShortcut);
  }, []);

  // --- Supabase Realtime Listeners ---
  useEffect(() => {
    if (!isSupabaseConfigured || !user || !isLoggedIn) return;

    let debounceTimeout = null;
    const triggerRefetch = () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        if (navigator.onLine) {
          fetchCloudData(user.id);
        }
      }, 1500); // 1.5s debounce to handle batch operations elegantly
    };

    const channel = supabase
      .channel('poultry-ledger-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ledger_entries' }, (payload) => {
        triggerRefetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'purchases' }, (payload) => {
        triggerRefetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'deadlines' }, (payload) => {
        triggerRefetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients' }, (payload) => {
        triggerRefetch();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'suppliers' }, (payload) => {
        triggerRefetch();
      })
      .subscribe();

    return () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      supabase.removeChannel(channel);
    };
  }, [isSupabaseConfigured, user, isLoggedIn]);

  // --- PWA Local Push Reminders for Deadlines ---
  useEffect(() => {
    if (!isLoggedIn || !state.deadlines || state.deadlines.length === 0) return;
    
    // Request permission politely 5s after boot
    if ('Notification' in window && Notification.permission === 'default') {
      setTimeout(() => {
        Notification.requestPermission().catch(err => {
          console.warn("Notification request permission failed:", err);
        });
      }, 5000);
    }

    // Check for due or overdue deadlines
    const todayStr = new Date().toISOString().split('T')[0];
    const dueToday = state.deadlines.filter(d => d.status === 'pending' && d.due_date === todayStr);
    const overdue = state.deadlines.filter(d => d.status === 'pending' && d.due_date < todayStr);

    if (dueToday.length > 0 || overdue.length > 0) {
      const showReminders = async () => {
        if ('Notification' in window && Notification.permission === 'granted') {
          // Check if we already showed reminders today to avoid spamming
          const lastShown = localStorage.getItem('dawajin_last_notification_date');
          if (lastShown === todayStr) return;

          let bodyText = "";
          if (dueToday.length > 0) {
            bodyText += `📅 اليوم: لديك ${dueToday.length} أجل مستحق للدفع.\n`;
          }
          if (overdue.length > 0) {
            bodyText += `⚠️ متأخر: لديك ${overdue.length} أقساط تجاوزت تاريخ السداد!`;
          }

          // Register service worker notification or trigger direct native notification
          try {
            navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification("🐔 Dawajin Pro — تذكير الأقساط", {
                body: bodyText,
                icon: "/poultry-ledger/assets/icon.svg",
                vibrate: [200, 100, 200],
                badge: "/poultry-ledger/assets/icon.svg",
                dir: 'rtl',
                tag: 'deadline-reminder'
              });
              localStorage.setItem('dawajin_last_notification_date', todayStr);
            }).catch(() => {
              // Fallback to direct window Notification if SW is not ready/registered
              new Notification("🐔 Dawajin Pro — تذكير الأقساط", {
                body: bodyText,
                icon: "/poultry-ledger/assets/icon.svg",
                dir: 'rtl'
              });
              localStorage.setItem('dawajin_last_notification_date', todayStr);
            });
          } catch (err) {
            console.warn("Notification trigger failed:", err);
          }
        }
      };

      // Delay checking slightly to ensure session is settled
      const timer = setTimeout(showReminders, 4000);
      return () => clearTimeout(timer);
    }
  }, [isLoggedIn, state.deadlines]);

  // Push a state to prevent immediate exit on Android/PWA back button
  useEffect(() => {
    if (!isLoggedIn) return;

    if (state.view === "dashboard" && window.history.state?.view !== "dashboard-prevent") {
      window.history.pushState({ view: "dashboard-prevent" }, "");
    }
  }, [state.view, isLoggedIn]);

  // Handle native back button navigation and PWA quit confirmation
  useEffect(() => {
    const handlePopState = (e) => {
      if (!isLoggedIn) return;

      let poppedView = e.state?.view;

      // If back button clicked on home screen (Dashboard)
      if (state.view === "dashboard") {
        const confirmQuit = window.confirm("⚠️ هل تريد حقًا إغلاق ومغادرة التطبيق؟");
        if (!confirmQuit) {
          // Push dashboard-prevent back to intercept next back click
          window.history.pushState({ view: "dashboard-prevent" }, "");
        } else {
          // Navigate back to exit
          window.history.go(-1);
        }
      } else {
        // Back button clicked on a sub-view (Clients, Ledger, etc.) -> return to Dashboard
        const targetView = poppedView === "dashboard-prevent" ? "dashboard" : (poppedView || "dashboard");
        setState(prev => {
          let updates = { ...prev, view: targetView };
          if (targetView === "clients" || targetView === "dashboard") {
            updates.selectedClient = null;
          }
          if (targetView === "suppliers" || targetView === "dashboard") {
            updates.selectedSupplier = null;
          }
          return updates;
        });
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [state.view, isLoggedIn]);

  // --- Cloud Database Fetch Loader ---
  const fetchCloudData = async (userUuid) => {
    if (!userUuid) return;
    if (isFetchingRef.current) {
      console.log("fetchCloudData is already in progress. Skipping parallel call.");
      return;
    }
    isFetchingRef.current = true;
    setIsCloudLoading(true);
    try {
      const currentState = stateRef.current;

      // 1. Fetch Profile (Company settings)
      const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userUuid)
        .single();
        
      if (profError && profError.code !== 'PGRST116') throw profError;

      // 2. Fetch Clients from Supabase
      const { data: dbClients, error: clError } = await supabase
        .from('clients')
        .select('*')
        .order('name');
        
      if (clError) throw clError;

      // 3. Fetch Ledger Entries from Supabase
      const { data: dbLedger, error: ledError } = await supabase
        .from('ledger_entries')
        .select('*');
        
      if (ledError) throw ledError;

      // 3b. Fetch Suppliers from Supabase (Graceful fallback if table doesn't exist)
      let dbSuppliers = [];
      try {
        const { data: sups, error: supErr } = await supabase
          .from('suppliers')
          .select('*')
          .order('name');
        if (!supErr) dbSuppliers = sups || [];
      } catch (err) {
        console.warn("Suppliers table might not exist yet:", err);
      }

      // 3c. Fetch Purchases from Supabase (Graceful fallback if table doesn't exist)
      let dbPurchases = [];
      try {
        const { data: purs, error: purErr } = await supabase
          .from('purchases')
          .select('*');
        if (!purErr) dbPurchases = purs || [];
      } catch (err) {
        console.warn("Purchases table might not exist yet:", err);
      }

      // 3d. Fetch Deadlines from Supabase (Graceful fallback if table doesn't exist)
      let dbDeadlines = [];
      try {
        const { data: dls, error: dlsErr } = await supabase
          .from('deadlines')
          .select('*')
          .order('due_date');
        if (!dlsErr) dbDeadlines = dls || [];
      } catch (err) {
        console.warn("Deadlines table might not exist yet:", err);
      }

      // --- OFFLINE-TO-ONLINE SYNC BRIDGE ---
      // Migrate any clients and daily rows created offline to the cloud database
      let currentClients = [...currentState.clients];
      let currentLedger = { ...currentState.ledger };
      let hasSyncChanges = false;
      const syncPromises = [];

      // Phase 1: Migrate new offline clients to Supabase and update their IDs/keys
      if (currentClients.length > 0) {
        for (const localCl of currentClients) {
          const isInCloud = dbClients && dbClients.some(dc => dc.id === localCl.id || dc.name === localCl.name);
          if (typeof localCl.id === 'number' || !isInCloud) {
            const { data: newCl, error: insError } = await supabase
              .from('clients')
              .insert({
                profile_id: userUuid,
                name: localCl.name,
                address: localCl.address || "—",
                phone: localCl.phone || "—",
                tax_id: localCl.taxId || "—",
                color: localCl.color || 0
              })
              .select()
              .single();

            if (!insError && newCl) {
              hasSyncChanges = true;
              const oldId = localCl.id;
              const newId = newCl.id;

              // Update the ID in currentClients
              localCl.id = newId;

              // Migrate all ledger keys from oldId to newId
              Object.keys(currentLedger).forEach(k => {
                if (k.startsWith(`${oldId}-`)) {
                  const parts = k.split('-');
                  const newKey = ledgerKey(newId, parseInt(parts.at(1)), parseInt(parts.at(2)));
                  Reflect.set(currentLedger, newKey, Reflect.get(currentLedger, k));
                  Reflect.deleteProperty(currentLedger, k);
                }
              });
            }
          }
        }
      }

      // Phase 2: Sync only modified or missing ledger entries to Supabase
      Object.keys(currentLedger).forEach(k => {
        const parts = k.split('-');
        if (parts.length === 3) {
          const clientUuid = parts.at(0);
          const year = parseInt(parts.at(1));
          const month = parseInt(parts.at(2));
          
          if (clientUuid && isNaN(Number(clientUuid))) {
            const activeRows = Reflect.get(currentLedger, k);
            if (activeRows) {
              activeRows.forEach((row, idx) => {
                const day = idx + 1;
                
                // Find matching entry in the cloud database
                const dbEntry = dbLedger && dbLedger.find(e => 
                  e.client_id === clientUuid && 
                  e.year === year && 
                  e.month === month && 
                  e.day === day
                );

                const hasLocalData = row.nw || row.paid || row.holiday || row.tw || row.notes;

                if (dbEntry) {
                  // Compare fields
                  const localTw = row.tw !== "" && row.tw !== null ? parseFloat(row.tw) : null;
                  const localNw = row.nw !== "" && row.nw !== null ? parseFloat(row.nw) : null;
                  const localPrice = row.price !== "" && row.price !== null ? parseFloat(row.price) : null;
                  const localAmt = row.amt !== "" && row.amt !== null ? parseFloat(row.amt) : null;
                  const localPaid = row.paid !== "" && row.paid !== null ? parseFloat(row.paid) : null;
                  const localHoliday = !!row.holiday;
                  const localNotes = row.notes ? String(row.notes).trim() : null;

                  const dbTw = dbEntry.total_weight !== null ? parseFloat(dbEntry.total_weight) : null;
                  const dbNw = dbEntry.net_weight !== null ? parseFloat(dbEntry.net_weight) : null;
                  const dbPrice = dbEntry.price !== null ? parseFloat(dbEntry.price) : null;
                  const dbAmt = dbEntry.amount !== null ? parseFloat(dbEntry.amount) : null;
                  const dbPaid = dbEntry.paid !== null ? parseFloat(dbEntry.paid) : null;
                  const dbHoliday = !!dbEntry.holiday;
                  const dbNotes = dbEntry.notes ? String(dbEntry.notes).trim() : null;

                  const isMatch = 
                    localTw === dbTw &&
                    localNw === dbNw &&
                    localPrice === dbPrice &&
                    localAmt === dbAmt &&
                    localPaid === dbPaid &&
                    localHoliday === dbHoliday &&
                    localNotes === dbNotes;

                  if (!isMatch) {
                    hasSyncChanges = true;
                    syncPromises.push(
                      syncLedgerEntryToCloud(clientUuid, year, month, idx, row)
                    );
                  }
                } else if (hasLocalData) {
                  hasSyncChanges = true;
                  syncPromises.push(
                    syncLedgerEntryToCloud(clientUuid, year, month, idx, row)
                  );
                }
              });
            }
          }
        }
      });

      // Phase 3: Wait for all ledger entries to finish syncing before refetching
      if (syncPromises.length > 0) {
        await Promise.all(syncPromises);
      }

      let finalClients = dbClients || [];
      let finalLedger = dbLedger || [];

      if (hasSyncChanges) {
        const { data: refClients } = await supabase.from('clients').select('*').order('name');
        const { data: refLedger } = await supabase.from('ledger_entries').select('*');
        if (refClients) finalClients = refClients;
        if (refLedger) finalLedger = refLedger;
      }

      // --- OFFLINE-TO-ONLINE SYNC BRIDGE FOR SUPPLIERS & PURCHASES ---
      let currentSuppliers = [...(currentState.suppliers || [])];
      let currentPurchases = { ...(currentState.purchases || {}) };
      let hasSupplierSyncChanges = false;
      const supplierSyncPromises = [];

      if (currentSuppliers.length > 0) {
        for (const localSup of currentSuppliers) {
          const isInCloud = dbSuppliers && dbSuppliers.some(ds => ds.id === localSup.id || ds.name === localSup.name);
          if (typeof localSup.id === 'number' || !isInCloud) {
            try {
              const { data: newSup, error: insErr } = await supabase
                .from('suppliers')
                .insert({
                  profile_id: userUuid,
                  name: localSup.name,
                  address: localSup.address || "—",
                  phone: localSup.phone || "—",
                  tax_id: localSup.taxId || "—",
                  color: localSup.color || 0
                })
                .select()
                .single();

              if (!insErr && newSup) {
                hasSupplierSyncChanges = true;
                const oldId = localSup.id;
                const newId = newSup.id;

                localSup.id = newId;

                // Migrate all purchases keys from oldId to newId
                Object.keys(currentPurchases).forEach(k => {
                  if (k.startsWith(`${oldId}-`)) {
                    const parts = k.split('-');
                    const newKey = ledgerKey(newId, parseInt(parts.at(1)), parseInt(parts.at(2)));
                    Reflect.set(currentPurchases, newKey, Reflect.get(currentPurchases, k));
                    Reflect.deleteProperty(currentPurchases, k);
                  }
                });
              }
            } catch (err) {
              console.warn("Could not sync supplier offline:", err);
            }
          }
        }
      }

      // Sync purchases entries
      Object.keys(currentPurchases).forEach(k => {
        const parts = k.split('-');
        if (parts.length === 3) {
          const supplierUuid = parts.at(0);
          const year = parseInt(parts.at(1));
          const month = parseInt(parts.at(2));
          
          if (supplierUuid && isNaN(Number(supplierUuid))) {
            const activeRows = Reflect.get(currentPurchases, k);
            if (activeRows) {
              activeRows.forEach((row, idx) => {
                const day = idx + 1;
                
                const dbEntry = dbPurchases && dbPurchases.find(e => 
                  e.supplier_id === supplierUuid && 
                  e.year === year && 
                  e.month === month && 
                  e.day === day
                );

                const hasLocalData = row.nw || row.paid || row.holiday || row.tw || row.notes;

                if (dbEntry) {
                  const localTw = row.tw !== "" && row.tw !== null ? parseFloat(row.tw) : null;
                  const localNw = row.nw !== "" && row.nw !== null ? parseFloat(row.nw) : null;
                  const localPrice = row.price !== "" && row.price !== null ? parseFloat(row.price) : null;
                  const localAmt = row.amt !== "" && row.amt !== null ? parseFloat(row.amt) : null;
                  const localPaid = row.paid !== "" && row.paid !== null ? parseFloat(row.paid) : null;
                  const localHoliday = !!row.holiday;
                  const localNotes = row.notes ? String(row.notes).trim() : null;

                  const dbTw = dbEntry.total_weight !== null ? parseFloat(dbEntry.total_weight) : null;
                  const dbNw = dbEntry.net_weight !== null ? parseFloat(dbEntry.net_weight) : null;
                  const dbPrice = dbEntry.price !== null ? parseFloat(dbEntry.price) : null;
                  const dbAmt = dbEntry.amount !== null ? parseFloat(dbEntry.amount) : null;
                  const dbPaid = dbEntry.paid !== null ? parseFloat(dbEntry.paid) : null;
                  const dbHoliday = !!dbEntry.holiday;
                  const dbNotes = dbEntry.notes ? String(dbEntry.notes).trim() : null;

                  const isMatch = 
                    localTw === dbTw &&
                    localNw === dbNw &&
                    localPrice === dbPrice &&
                    localAmt === dbAmt &&
                    localPaid === dbPaid &&
                    localHoliday === dbHoliday &&
                    localNotes === dbNotes;

                  if (!isMatch) {
                    hasSupplierSyncChanges = true;
                    supplierSyncPromises.push(
                      syncPurchaseEntryToCloud(supplierUuid, year, month, idx, row)
                    );
                  }
                } else if (hasLocalData) {
                  hasSupplierSyncChanges = true;
                  supplierSyncPromises.push(
                    syncPurchaseEntryToCloud(supplierUuid, year, month, idx, row)
                  );
                }
              });
            }
          }
        }
      });

      if (supplierSyncPromises.length > 0) {
        await Promise.all(supplierSyncPromises);
      }

      let finalSuppliers = dbSuppliers || [];
      let finalPurchases = dbPurchases || [];

      if (hasSupplierSyncChanges) {
        try {
          const { data: refSuppliers } = await supabase.from('suppliers').select('*').order('name');
          const { data: refPurchases } = await supabase.from('purchases').select('*');
          if (refSuppliers) finalSuppliers = refSuppliers;
          if (refPurchases) finalPurchases = refPurchases;
        } catch (err) {
          console.warn("Could not refetch synced suppliers:", err);
        }
      }

      // Reconstruct state using final synced values
      const formattedClients = finalClients.map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        phone: c.phone,
        color: c.color,
        taxId: c.tax_id
      }));

      const formattedLedger = {};
      finalLedger.forEach(e => {
        const k = ledgerKey(e.client_id, e.year, e.month);
        if (!Reflect.has(formattedLedger, k)) {
          const days = daysInMonth(e.year, e.month);
          Reflect.set(formattedLedger, k, Array.from({ length: days }, (_, i) => ({
            d: i + 1,
            tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
          })));
        }
        
        const idx = e.day - 1;
        const targetDays = Reflect.get(formattedLedger, k);
        if (targetDays && targetDays.at(idx)) {
          targetDays.splice(idx, 1, {
            d: e.day,
            tw: e.total_weight !== null ? String(e.total_weight) : "",
            nw: e.net_weight !== null ? String(e.net_weight) : "",
            price: e.price !== null ? String(e.price) : "",
            amt: e.amount !== null ? parseFloat(e.amount) : "",
            paid: e.paid !== null ? String(e.paid) : "",
            holiday: e.holiday,
            notes: e.notes || ""
          });
        }
      });

      const formattedSuppliers = finalSuppliers.map(s => {
        const existing = (stateRef.current?.suppliers || []).find(x => x.id === s.id);
        return {
          id: s.id,
          name: s.name,
          address: s.address,
          phone: s.phone,
          color: s.color,
          taxId: s.tax_id,
          defaultPrice: existing?.defaultPrice || null
        };
      });

      const formattedPurchases = {};
      finalPurchases.forEach(e => {
        const k = ledgerKey(e.supplier_id, e.year, e.month);
        if (!Reflect.has(formattedPurchases, k)) {
          const days = daysInMonth(e.year, e.month);
          Reflect.set(formattedPurchases, k, Array.from({ length: days }, (_, i) => ({
            d: i + 1,
            tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: "", invoice_url: ""
          })));
        }
        
        const idx = e.day - 1;
        const targetDays = Reflect.get(formattedPurchases, k);
        if (targetDays && targetDays.at(idx)) {
          targetDays.splice(idx, 1, {
            d: e.day,
            tw: e.total_weight !== null ? String(e.total_weight) : "",
            nw: e.net_weight !== null ? String(e.net_weight) : "",
            price: e.price !== null ? String(e.price) : "",
            amt: e.amount !== null ? parseFloat(e.amount) : "",
            paid: e.paid !== null ? String(e.paid) : "",
            holiday: e.holiday,
            notes: e.notes || "",
            invoice_url: e.invoice_url || ""
          });
        }
      });

      const formattedDeadlines = dbDeadlines.map(d => ({
        id: d.id,
        profile_id: d.profile_id,
        client_id: d.client_id,
        supplier_id: d.supplier_id,
        amount: parseFloat(d.amount),
        due_date: d.due_date,
        status: d.status,
        notes: d.notes || ""
      }));

      setState(prev => {
        const userRole = profile ? profile.role || 'admin' : prev.role || 'admin';
        const currentView = prev.view;
        const isViewAllowed = userRole !== 'driver' || currentView === 'ledger' || currentView === 'clients';
        const newView = isViewAllowed ? currentView : 'ledger';

        return {
          ...prev,
          clients: formattedClients,
          ledger: formattedLedger,
          selectedClient: formattedClients.length ? (formattedClients.some(c => c.id === prev.selectedClient) ? prev.selectedClient : formattedClients.at(0).id) : null,
          suppliers: formattedSuppliers,
          purchases: formattedPurchases,
          selectedSupplier: formattedSuppliers.length ? (formattedSuppliers.some(s => s.id === prev.selectedSupplier) ? prev.selectedSupplier : formattedSuppliers.at(0).id) : null,
          deadlines: formattedDeadlines,
          pricePerKg: profile && profile.price_per_kg !== null && !isNaN(parseFloat(profile.price_per_kg)) ? parseFloat(profile.price_per_kg) : prev.pricePerKg,
          role: userRole,
          view: newView,
          companyInfo: profile ? {
            name: profile.company_name,
            address: profile.company_address,
            phone: profile.company_phone,
            taxId: profile.company_tax_id
          } : prev.companyInfo
        };
      });

      toastMessage("⚡ تم مزامنة كامل البيانات مع السحابة بنجاح !");
    } catch (err) {
      console.error("Failed to load cloud data:", err);
      toastMessage("❌ فشل سحب البيانات السحابية، يرجى التثبت من الاتصال", "error");
    } finally {
      setIsCloudLoading(false);
      isFetchingRef.current = false;
    }
  };


  // --- Global Handlers ---
  const handleViewChange = useCallback((viewName) => {
    triggerHaptic(12);
    setState(prev => {
      const allowed = prev.role !== 'driver' || viewName === 'ledger' || viewName === 'clients';
      return { ...prev, view: allowed ? viewName : 'ledger' };
    });
    setMobileMenuOpen(false);
  }, []);

  const handleMonthChange = (e) => {
    triggerHaptic(8);
    const val = parseInt(e.target.value) || 5;
    setState(prev => ({ ...prev, month: val }));
  };

  const handleYearChange = (e) => {
    triggerHaptic(8);
    const val = parseInt(e.target.value) || 2026;
    setState(prev => ({ ...prev, year: val }));
  };

  const handleThemeToggle = () => {
    triggerHaptic(15);
    setState(prev => ({
      ...prev,
      theme: prev.theme === 'light' ? 'dark' : 'light'
    }));
  };

  const handleDefaultPriceChange = useCallback(async (newPrice) => {
    // 1. Update state locally
    let updatedRows = [];
    let targetClient = null;
    let targetYear = null;
    let targetMonth = null;

    setState(prev => {
      const updatedLedger = { ...prev.ledger };
      targetClient = prev.selectedClient;
      targetYear = prev.year;
      targetMonth = prev.month;
      const k = ledgerKey(targetClient, targetYear, targetMonth);
      if (updatedLedger[k]) {
        updatedLedger[k] = updatedLedger[k].map((r, idx) => {
          if (!r.holiday && !r.price && r.nw) {
            const updatedRow = {
              ...r,
              amt: parseFloat((parseFloat(r.nw) * newPrice).toFixed(3))
            };
            updatedRows.push({ idx, row: updatedRow });
            return updatedRow;
          }
          return r;
        });
      }
      return {
        ...prev,
        pricePerKg: newPrice,
        ledger: updatedLedger
      };
    });

    // 2. Sync profile to cloud and then sync updated ledger rows to cloud
    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            price_per_kg: newPrice
          });
        if (error) throw error;

        if (updatedRows.length > 0 && targetClient) {
          const syncPromises = updatedRows.map(({ idx, row }) => 
            syncLedgerEntryToCloud(targetClient, targetYear, targetMonth, idx, row)
          );
          await Promise.all(syncPromises);
        }
      } catch (err) {
        console.error("Cloud update default price error:", err);
      }
    }
    
    toastMessage("✓ تم تحديث السعر الافتراضي وتحديث الحسابات");
  }, [isSupabaseConfigured, user, syncLedgerEntryToCloud]);

  const handleChangePassword = useCallback(async (newPass) => {
    const hashed = await hashPassword(newPass);
    localStorage.setItem("dawajin_password", hashed);
    setPassword(hashed);
    toastMessage("✓ تم تحديث كلمة المرور بنجاح");
  }, []);

  const handleUpdateCompanyInfo = useCallback(async (newInfo) => {
    // Instant local state update
    setState(prev => ({
      ...prev,
      companyInfo: newInfo
    }));

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            company_name: newInfo.name,
            company_address: newInfo.address,
            company_phone: newInfo.phone,
            company_tax_id: newInfo.taxId
          });
        if (error) throw error;
      } catch (err) {
        console.error("Cloud update profile error:", err);
      }
    }
    toastMessage("✓ تم تحديث بيانات الشركة بنجاح");
  }, [isSupabaseConfigured, user]);



  // --- Deadlines Handlers ---
  const handleAddDeadline = useCallback(async (newDl) => {
    triggerHaptic(15);
    const tempId = 'temp_' + Date.now();
    const localDl = { id: tempId, profile_id: user?.id, ...newDl };
    
    // Add locally immediately
    setState(prev => ({
      ...prev,
      deadlines: [...(prev.deadlines || []), localDl]
    }));
    
    if (isSupabaseConfigured && user) {
      try {
        const { data, error } = await supabase
          .from('deadlines')
          .insert({
            profile_id: user.id,
            client_id: newDl.client_id,
            supplier_id: newDl.supplier_id,
            amount: newDl.amount,
            due_date: newDl.due_date,
            status: newDl.status,
            notes: newDl.notes
          })
          .select()
          .single();
        if (error) throw error;
        if (data) {
          // Replace temp id
          setState(prev => ({
            ...prev,
            deadlines: (prev.deadlines || []).map(d => d.id === tempId ? { ...d, id: data.id } : d)
          }));
          toastMessage("✓ تم حفظ الأجل بنجاح سحابياً");
        }
      } catch (err) {
        console.error("Cloud insert deadline failed, queueing offline:", err);
        await enqueueSync('deadline_add', { tempId, ...newDl });
        toastMessage("⚠️ تم حفظ الأجل محلياً، سيتم المزامنة لاحقاً", "warning");
      }
    } else {
      await enqueueSync('deadline_add', { tempId, ...newDl });
      toastMessage("⚠️ تم حفظ الأجل محلياً (وضع أوفلاين)", "warning");
    }
  }, [isSupabaseConfigured, user]);

  const handleEditDeadline = useCallback(async (updatedDl) => {
    triggerHaptic(15);
    
    // Update locally
    setState(prev => ({
      ...prev,
      deadlines: (prev.deadlines || []).map(d => d.id === updatedDl.id ? updatedDl : d)
    }));
    
    if (isSupabaseConfigured && user && !String(updatedDl.id).startsWith('temp_')) {
      try {
        const { error } = await supabase
          .from('deadlines')
          .update({
            client_id: updatedDl.client_id,
            supplier_id: updatedDl.supplier_id,
            amount: updatedDl.amount,
            due_date: updatedDl.due_date,
            status: updatedDl.status,
            notes: updatedDl.notes
          })
          .eq('id', updatedDl.id);
        if (error) throw error;
        toastMessage("✓ تم تعديل الأجل بنجاح سحابياً");
      } catch (err) {
        console.error("Cloud update deadline failed, queueing offline:", err);
        await enqueueSync('deadline_edit', updatedDl);
        toastMessage("⚠️ تم تعديل الأجل محلياً، سيتم المزامنة لاحقاً", "warning");
      }
    } else {
      await enqueueSync('deadline_edit', updatedDl);
      toastMessage("⚠️ تم تعديل الأجل محلياً (وضع أوفلاين)", "warning");
    }
  }, [isSupabaseConfigured, user]);

  const handleDeleteDeadline = useCallback(async (id) => {
    triggerHaptic(20);
    
    // Delete locally
    setState(prev => ({
      ...prev,
      deadlines: (prev.deadlines || []).filter(d => d.id !== id)
    }));
    
    if (isSupabaseConfigured && user && !String(id).startsWith('temp_')) {
      try {
        const { error } = await supabase
          .from('deadlines')
          .delete()
          .eq('id', id);
        if (error) throw error;
        toastMessage("✓ تم حذف الأجل بنجاح");
      } catch (err) {
        console.error("Cloud delete deadline failed, queueing offline:", err);
        await enqueueSync('deadline_delete', { id });
        toastMessage("⚠️ تم الحذف محلياً، سيتم المزامنة لاحقاً", "warning");
      }
    } else {
      await enqueueSync('deadline_delete', { id });
      toastMessage("⚠️ تم الحذف محلياً (وضع أوفلاين)", "warning");
    }
  }, [isSupabaseConfigured, user]);

  const handleMarkAsPaid = useCallback(async (deadline) => {
    triggerHaptic(20);
    
    // 1. Mark deadline as paid locally
    setState(prev => ({
      ...prev,
      deadlines: (prev.deadlines || []).map(d => d.id === deadline.id ? { ...d, status: 'paid' } : d)
    }));
    
    // 2. Cloud update for deadline status
    if (isSupabaseConfigured && user && !String(deadline.id).startsWith('temp_')) {
      try {
        const { error } = await supabase
          .from('deadlines')
          .update({ status: 'paid' })
          .eq('id', deadline.id);
        if (error) throw error;
        toastMessage("✓ تم تغيير حالة الأجل إلى خالص بنجاح");
      } catch (err) {
        console.error("Cloud update deadline status failed:", err);
        await enqueueSync('deadline_paid', { id: deadline.id });
      }
    } else {
      await enqueueSync('deadline_paid', { id: deadline.id });
    }

    // 3. Automatically insert this payment in the Ledger
    const [year, month, day] = deadline.due_date.split('-').map(Number);
    const amountStr = String(deadline.amount);
    
    if (deadline.client_id) {
      const k = ledgerKey(deadline.client_id, year, month);
      setState(prev => {
        const updatedLedger = { ...prev.ledger };
        if (!updatedLedger[k]) {
          const totalDays = daysInMonth(year, month);
          updatedLedger[k] = Array.from({ length: totalDays }, (_, i) => ({
            d: i + 1,
            tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
          }));
        }
        
        const idx = day - 1;
        const targetDays = [...updatedLedger[k]];
        if (targetDays[idx]) {
          const existingPaid = parseFloat(targetDays[idx].paid) || 0;
          const newPaid = existingPaid + parseFloat(amountStr);
          const updatedRow = {
            ...targetDays[idx],
            paid: String(newPaid),
            notes: targetDays[idx].notes 
              ? `${targetDays[idx].notes} (دفعة أجل)` 
              : "دفعة أجل مسددة"
          };
          targetDays[idx] = updatedRow;
          updatedLedger[k] = targetDays;
          
          if (isSupabaseConfigured && user) {
            syncLedgerEntryToCloud(deadline.client_id, year, month, idx, updatedRow);
          }
        }
        
        return { ...prev, ledger: updatedLedger };
      });
      toastMessage("✓ تم تسجيل الدفعة المالية تلقائياً في سجل المقبوضات !");
    } else if (deadline.supplier_id) {
      const k = ledgerKey(deadline.supplier_id, year, month);
      setState(prev => {
        const updatedPurchases = { ...prev.purchases };
        if (!updatedPurchases[k]) {
          const totalDays = daysInMonth(year, month);
          updatedPurchases[k] = Array.from({ length: totalDays }, (_, i) => ({
            d: i + 1,
            tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: "", invoice_url: ""
          }));
        }
        
        const idx = day - 1;
        const targetDays = [...updatedPurchases[k]];
        if (targetDays[idx]) {
          const existingPaid = parseFloat(targetDays[idx].paid) || 0;
          const newPaid = existingPaid + parseFloat(amountStr);
          const updatedRow = {
            ...targetDays[idx],
            paid: String(newPaid),
            notes: targetDays[idx].notes 
              ? `${targetDays[idx].notes} (دفعة أجل للمورد)` 
              : "دفعة أجل مسددة للمورد"
          };
          targetDays[idx] = updatedRow;
          updatedPurchases[k] = targetDays;
          
          if (isSupabaseConfigured && user) {
            syncPurchaseEntryToCloud(deadline.supplier_id, year, month, idx, updatedRow);
          }
        }
        
        return { ...prev, purchases: updatedPurchases };
      });
      toastMessage("✓ تم تسجيل الدفعة للمورد تلقائياً في سجل المدفوعات !");
    }
  }, [isSupabaseConfigured, user, syncLedgerEntryToCloud, syncPurchaseEntryToCloud]);

  // --- Daily Cash Book Management Handlers ---
  const handleAddCashEntry = useCallback(async (entryData) => {
    triggerHaptic(12);
    const tempId = 'cash-' + Date.now() + Math.random().toString(36).substring(2, 6);
    const newEntry = {
      id: tempId,
      ...entryData,
      createdAt: Date.now()
    };

    // Log the transaction in the activity log
    logActivity(
      user?.id,
      entryData.type === 'in' ? "إضافة إيراد" : "إضافة مصروف",
      `تم تسجيل حركة صندوق: "${entryData.description}" بمبلغ ${entryData.amount} د.ت`
    );

    // Save locally
    setState(prev => ({
      ...prev,
      cashBook: [newEntry, ...(prev.cashBook || [])]
    }));

    toastMessage(
      entryData.type === 'in' ? "✓ تم تسجيل الإيراد في الصندوق بنجاح" : "✓ تم تسجيل المصروف من الصندوق بنجاح",
      "success"
    );
  }, [user]);

  const handleDeleteCashEntry = useCallback(async (id) => {
    triggerHaptic(15);
    
    // Find entry to log
    setState(prev => {
      const entry = (prev.cashBook || []).find(x => x.id === id);
      if (entry) {
        logActivity(
          user?.id,
          "حذف حركة صندوق",
          `تم حذف حركة صندوق يدوية: "${entry.description}" بمبلغ ${entry.amount} د.ت`
        );
      }
      return {
        ...prev,
        cashBook: (prev.cashBook || []).filter(x => x.id !== id)
      };
    });

    toastMessage("✓ تم حذف الحركة المالية من الصندوق بنجاح", "success");
  }, [user]);



  // 6-Hour Active Auto Cloud Backup routine
  useEffect(() => {
    if (!isLoggedIn || !user || !isSupabaseConfigured || !plainPassword) return;

    const runAutoBackup = async () => {
      const lastBackup = localStorage.getItem(`dawajin_last_backup_time_${user.id}`);
      const sixHoursMs = 6 * 60 * 60 * 1000;
      const now = Date.now();

      if (!lastBackup || (now - parseInt(lastBackup, 10)) > sixHoursMs) {
        console.log("Starting automatic 6-hour cloud backup...");
        const success = await handleBackupCloudExport();
        if (success) {
          console.log("6-hour auto cloud backup completed successfully!");
        }
      }
    };

    // Run 10 seconds after boot to check if backup is overdue
    const initialTimer = setTimeout(runAutoBackup, 10000);

    // Set interval to check/run every 30 minutes of active usage
    const interval = setInterval(runAutoBackup, 30 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [isLoggedIn, user, isSupabaseConfigured, plainPassword]);




  const handleCSVExport = () => {
    exportToCSV(state);
  };

  const handleCloudLogin = (newSession, newUser, enteredPass) => {
    setSession(newSession);
    setUser(newUser);
    if (enteredPass) {
      setPlainPassword(enteredPass);
      sessionStorage.setItem("dawajin_plain_password", enteredPass);
    }
    localStorage.setItem("dawajin_logged_in", "true");
    setIsLoggedIn(true);
    // Note: fetchCloudData is fully handled by onAuthStateChange global listener to avoid race conditions!
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    // Clear localStorage offline cache completely to prevent data leak
    localStorage.removeItem("dawajin_state");
    localStorage.removeItem("dawajin_logged_in");

    // Clear IndexedDB offline sync queue to prevent data leak across users
    const db = syncDBRef.current;
    if (db) {
      try {
        const tx = db.transaction(syncStoreName, 'readwrite');
        const store = tx.objectStore(syncStoreName);
        store.clear();
      } catch (err) {
        console.error("Failed to clear offline sync queue on logout:", err);
      }
    }
    
    // Reset React state to a clean, default blank slate
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    setState({
      clients: [],
      ledger: {},
      selectedClient: null,
      view: "dashboard",
      pricePerKg: 5.800,
      theme: state.theme,
      month: currentMonth,
      year: currentYear,
      companyInfo: {
        name: "الودرني للدواجن",
        address: "وادي النور الحامة,قابس",
        phone: "96 101 651",
        taxId: "1895235/E"
      }
    });

    setIsLoggedIn(false);
    setSession(null);
    setUser(null);
  };

  // If user is not authenticated, render the login shield!
  if (!isLoggedIn) {
    return (
      <LoginScreen 
        savedPassword={password}
        onLogin={(enteredPass) => {
          if (enteredPass) {
            setPlainPassword(enteredPass);
            sessionStorage.setItem("dawajin_plain_password", enteredPass);
          }
          localStorage.setItem("dawajin_logged_in", "true");
          setIsLoggedIn(true);
        }}
        onSetPassword={async (newPass) => {
          await handleChangePassword(newPass);
          setPlainPassword(newPass);
          sessionStorage.setItem("dawajin_plain_password", newPass);
          localStorage.setItem("dawajin_logged_in", "true");
          setIsLoggedIn(true);
        }}
        onCloudLogin={handleCloudLogin}
      />
    );
  }

  // Render correct Active view
  const renderActiveView = () => {
    switch (state.view) {
      case "dashboard":
        return (
          <Dashboard 
            state={state} 
            onSelectClient={handleSelectClient}
            onPriceChange={handleDefaultPriceChange}
            onBackupExport={handleBackupExport}
            onBackupImport={handleBackupImport}
            onChangePassword={handleChangePassword}
            onUpdateCompanyInfo={handleUpdateCompanyInfo}
            installPrompt={installPrompt}
            onInstallApp={handleInstallClick}
            isStandalone={isStandalone}
            onShowInstallGuide={() => setShowInstallModal(true)}
            onBackupCloudExport={handleBackupCloudExport}
            onBackupCloudRestore={handleBackupCloudRestore}
            userId={user?.id}
          />
        );
      case "ledger":
        return (
          <Ledger 
            state={state}
            onSelectClient={handleSelectClient}
            onUpdateRow={handleUpdateRow}
            onSyncRow={handleSyncRow}
            onToggleHoliday={handleToggleHoliday}
            onQuickSettle={handleQuickSettle}
            onExportCSV={handleCSVExport}
            onPrintInvoice={(cid) => setActiveInvoiceClientId(cid)}
          />
        );
      case "clients":
        return (
          <Clients 
            state={state}
            onSelectClient={handleSelectClient}
            onAddClient={handleAddClient}
            onEditClient={handleEditClient}
            onDeleteClient={handleDeleteClient}
            onPrintStatement={(cid) => setActiveStatementClientId(cid)}
          />
        );
      case "suppliers":
        return (
          <Suppliers 
            state={state}
            onSelectSupplier={handleSelectSupplier}
            onAddSupplier={handleAddSupplier}
            onEditSupplier={handleEditSupplier}
            onDeleteSupplier={handleDeleteSupplier}
            onPrintSupplierStatement={(sid) => setActiveStatementSupplierId(sid)}
          />
        );
      case "purchases_ledger":
        return (
          <PurchasesLedger 
            state={state}
            onSelectSupplier={handleSelectSupplier}
            onUpdatePurchaseRow={handleUpdatePurchaseRow}
            onSyncPurchaseRow={handleSyncPurchaseRow}
            onTogglePurchaseHoliday={handleTogglePurchaseHoliday}
            onQuickPurchaseSettle={handleQuickPurchaseSettle}
            onExportPurchaseCSV={() => exportPurchasesToCSV(state)}
          />
        );
      case "deadlines":
        return (
          <Deadlines 
            state={state}
            onAddDeadline={handleAddDeadline}
            onEditDeadline={handleEditDeadline}
            onDeleteDeadline={handleDeleteDeadline}
            onMarkAsPaid={handleMarkAsPaid}
          />
        );
      case "analytics":
        return (
          <Analytics state={state} />
        );
      case "summary":
        return (
          <Summary 
            state={state}
            onSelectClient={handleSelectClient}
            onSelectSupplier={handleSelectSupplier}
          />
        );
      case "cashbook":
        return (
          <CashBook 
            state={state}
            onAddCashEntry={handleAddCashEntry}
            onDeleteCashEntry={handleDeleteCashEntry}
          />
        );
      default:
        return <div>{"View not found"}</div>;
    }
  };

  const getBackupStatus = () => {
    if (!user) return null;
    if (!lastBackupTime) {
      return { 
        text: "لم يتم الحفظ السحابي بعد", 
        style: "bg-red-500/5 border-red-500/20 text-red-400 shadow-md shadow-red-500/5", 
        pulse: "pulse-dot-red" 
      };
    }
    const diff = Date.now() - lastBackupTime;
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const mins = Math.floor((diff % (60 * 60 * 1000)) / (60 * 1000));
    
    let timeText = "";
    if (hours === 0) {
      timeText = `منذ ${mins} د`;
    } else {
      timeText = `منذ ${hours} س`;
    }
    
    // Warning if last backup > 24 hours
    if (diff > 24 * 60 * 60 * 1000) {
      return { 
        text: `نسخ قديم (${timeText})`, 
        style: "bg-amber-500/5 border-amber-500/25 text-amber-400 shadow-md animate-pulse",
        pulse: "pulse-dot-yellow" 
      };
    }
    
    return { 
      text: `تم الحفظ: ${timeText}`, 
      style: "bg-emerald-500/5 border-emerald-500/20 text-emerald-400 shadow-md",
      pulse: "pulse-dot-green" 
    };
  };

  const backupBadge = getBackupStatus();

  return (
    <>
      <div id="toast" className="no-print"></div>

      <header className="sticky top-0 z-40 w-full shadow-md no-print transition-all duration-300">
        <div className="header-inner max-w-[1600px] mx-auto px-4 md:px-8 flex flex-col py-4 md:py-5 h-auto gap-4">
          
          {/* Row 1: Logo & Actions */}
          <div className="flex flex-col md:flex-row items-center justify-between w-full gap-4">
            
            {/* Logo & Company details */}
            <div className="logo flex items-center gap-3.5 flex-shrink-0 w-full md:w-auto justify-between md:justify-start">
              <div className="flex items-center gap-3.5">
                <img 
                  src="/poultry-ledger/assets/icon.svg" 
                  alt={state.companyInfo.name} 
                  className="w-14 h-14 rounded-2xl object-contain border border-amber-500/35 p-1 bg-white shadow-md shadow-amber-500/5"
                  onError={(e) => {
                    e.target.outerHTML = '<div class="w-14 h-14 bg-gradient-to-tr from-amber-500 to-amber-300 text-2xl flex items-center justify-center rounded-2xl shadow-md border border-amber-400/30">🐔</div>';
                  }}
                />
                <div className="text-right">
                  <div className="font-black text-base md:text-lg bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent leading-snug">
                    {state.companyInfo.name}
                  </div>
                  <div className="text-[10px] md:text-xs text-slate-400 font-medium">{state.companyInfo.address}</div>
                </div>
              </div>

              {/* MOBILE QUICK NAVIGATION BUTTONS */}
              <div className="md:hidden flex items-center gap-2.5 no-print">
                {/* Quick Home/Dashboard Button */}
                <button 
                  className="flex items-center justify-center w-11 h-11 rounded-xl border-2 border-[var(--gold)] bg-[var(--bg2)] text-[var(--gold)] active:scale-90 transition-all duration-200 text-lg shadow-md shadow-black/20"
                  onClick={() => handleViewChange('dashboard')}
                  title="الرئيسية"
                >
                  🏠
                </button>

                {/* Hamburger Menu Toggle Button */}
                <button 
                  className={`menu-toggle flex items-center justify-center font-bold transition-all duration-200 ${
                    mobileMenuOpen ? 'open' : ''
                  }`}
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  title="القائمة"
                >
                  {mobileMenuOpen ? '✕' : '☰'}
                </button>
              </div>
            </div>
            
            {/* Actions: Badges, Search, Notification, selectors, theme toggle, logout */}
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              {/* DYNAMIC NETWORK & CLOUD SYNC STATUS BADGE */}
              {isSupabaseConfigured && (
                <div className={`no-print flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold select-none border transition-all duration-300 ${
                  !isOnline 
                    ? 'bg-red-500/5 border-red-500/20 text-red-400 shadow-md shadow-red-500/5'
                    : pendingSyncCount > 0 || isCloudLoading
                      ? 'bg-amber-500/5 border-amber-500/20 text-amber-400 shadow-md shadow-amber-500/5'
                      : 'bg-emerald-500/5 border-emerald-500/20 text-emerald-400 shadow-md'
                }`}>
                  <span className={
                    !isOnline 
                      ? 'pulse-dot-red'
                      : pendingSyncCount > 0 || isCloudLoading
                        ? 'pulse-dot-blue'
                        : 'pulse-dot-green'
                  }></span>
                  <span>
                    {!isOnline 
                      ? `غير متصل — ${pendingSyncCount > 0 ? `${pendingSyncCount} معلقة` : "العمل محلياً"}`
                      : pendingSyncCount > 0 || isCloudLoading
                        ? `جاري المزامنة (${pendingSyncCount} معلقة)...`
                        : "متصل بالسحابة (مزامنة كاملة)"
                    }
                  </span>
                </div>
              )}

              {/* DYNAMIC AUTO-BACKUP STATUS BADGE */}
              {isSupabaseConfigured && backupBadge && (
                <div className={`no-print flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold select-none border transition-all duration-300 ${backupBadge.style}`}>
                  <span className={backupBadge.pulse}></span>
                  <span>{backupBadge.text}</span>
                </div>
              )}

              {/* QUICK COMMAND PALETTE TRIGGER */}
              <button
                onClick={() => setCommandPaletteOpen(true)}
                className="hidden lg:flex items-center justify-center gap-2 px-3 py-1.5 rounded-full border border-slate-800 bg-slate-950/40 hover:border-amber-500/40 hover:text-amber-400 text-[10px] font-bold transition-all duration-200 select-none cursor-pointer"
                title="فتح لوحة البحث السريع (Ctrl+K)"
              >
                <span>🔍 بحث سريع</span>
                <kbd className="bg-slate-900/80 px-1 py-0.5 rounded border border-slate-750 font-mono text-[9px] text-slate-500">Ctrl+K</kbd>
              </button>

              {/* NOTIFICATION CENTER TRIGGER BELL */}
              <div className="relative no-print select-none cursor-pointer">
                <button
                  onClick={() => setNotificationsOpen(true)}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-slate-800 bg-slate-950/60 hover:border-amber-500/40 hover:text-amber-400 active:scale-95 transition-all duration-200 text-sm shadow-md"
                  title="مركز التنبيهات"
                >
                  🔔
                </button>
                {notifications.filter(n => !n.read).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center animate-bounce">
                    {notifications.filter(n => !n.read).length}
                  </span>
                )}
              </div>

              {/* THEME TOGGLE BUTTON */}
              <button 
                className="no-print flex items-center justify-center w-10 h-10 rounded-xl border border-slate-800 bg-slate-900/50 text-amber-500 hover:bg-slate-900 hover:border-amber-500/40 hover:scale-105 transition-all duration-200 text-base" 
                onClick={handleThemeToggle} 
                title="تغيير Mظهر"
              >
                {state.theme === 'light' ? '☀️' : '🌙'}
              </button>

              {/* CLOUD LOGOUT BUTTON */}
              <button 
                className="no-print flex items-center justify-center h-10 px-3.5 rounded-xl border border-red-500/20 bg-red-500/5 text-red-400 hover:bg-red-500/10 hover:border-red-500/40 font-bold text-xs transition-all duration-200" 
                onClick={handleLogout} 
                title="تسجيل الخروج"
              >
                <span>🔒 خروج</span>
              </button>

              {/* DATE CONTROLS SELECTORS */}
              <div className="flex items-center gap-1 bg-slate-900/40 border border-slate-800/80 rounded-xl p-1 h-10">
                <select 
                  id="month-sel" 
                  className="bg-transparent text-slate-200 font-bold text-xs outline-none cursor-pointer py-1 px-2 border-none" 
                  value={state.month} 
                  onChange={handleMonthChange}
                >
                  {MONTHS.map((name, i) => (
                    <option key={i} value={i + 1} className="bg-slate-950 text-slate-100">{name}</option>
                  ))}
                </select>
                <span className="text-slate-600">|</span>
                <input 
                  type="number" 
                  id="year-sel" 
                  className="bg-transparent text-slate-200 font-bold text-xs outline-none py-1 px-1 border-none w-14 text-center font-mono" 
                  value={state.year} 
                  min="2020" 
                  max="2035" 
                  onChange={handleYearChange}
                />
              </div>

            </div>

          </div>

          {/* Row 2: Navigation menu (centered/full-width on desktop) */}
          <div className="w-full flex md:border-t md:border-slate-800/40 md:pt-3.5 flex-col md:flex-row items-center justify-center">
            <nav id="nav" className={`no-print flex-col md:flex-row md:flex gap-1.5 ${mobileMenuOpen ? 'open flex w-full' : 'hidden'}`}>
              {[
                { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
                { id: 'ledger', label: 'السجل اليومي', icon: '📋' },
                { id: 'clients', label: 'العملاء', icon: '👥' },
                { id: 'purchases_ledger', label: 'سجل المشتريات', icon: '📦' },
                { id: 'suppliers', label: 'الموردين', icon: '🤝' },
                { id: 'deadlines', label: 'الآجال والأقساط', icon: '📅' },
                { id: 'analytics', label: 'التحليلات', icon: '📊' },
                { id: 'summary', label: 'الملخص المالي', icon: '📈' },
                { id: 'cashbook', label: 'دفتر الصندوق', icon: '💵' }
              ].filter(tab => state.role !== 'driver' || tab.id === 'ledger' || tab.id === 'clients').map(tab => (
                <button 
                  key={tab.id}
                  className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all duration-200 flex items-center gap-2 w-full md:w-auto ${
                    state.view === tab.id 
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' 
                      : 'bg-transparent text-slate-400 hover:text-amber-400 hover:bg-slate-900/60 border border-transparent hover:border-slate-850'
                  }`}
                  onClick={() => {
                    handleViewChange(tab.id);
                    if (mobileMenuOpen) setMobileMenuOpen(false);
                  }}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

        </div>
      </header>

      <main id="main-content" className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
        <Suspense fallback={<SkeletonLoader />}>
          {renderActiveView()}
        </Suspense>
      </main>

      {/* RENDER DYNAMIC BILL PREVIEW OVERLAY IF ACTIVE */}
      {activeInvoiceClientId !== null && (
        <Suspense fallback={null}>
          <InvoicePrint 
            state={state} 
            clientId={activeInvoiceClientId} 
            onClose={() => setActiveInvoiceClientId(null)} 
          />
        </Suspense>
      )}

      {/* RENDER DYNAMIC PWA INSTALL GUIDE MODAL */}
      <Suspense fallback={null}>
        <InstallModal 
          isOpen={showInstallModal}
          onClose={() => setShowInstallModal(false)}
          deviceType={deviceType}
          onInstallApp={handleInstallClick}
          installPrompt={installPrompt}
        />
      </Suspense>

      {/* FLOATING PWA APP INSTALL BUTTON */}
      {!isStandalone && (
        <div className="no-print fixed bottom-6 left-6 z-50">
          <button 
            className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm rounded-full shadow-lg shadow-amber-500/20 hover:shadow-amber-500/35 hover:scale-105 transition-all duration-200" 
            onClick={installPrompt ? handleInstallClick : () => setShowInstallModal(true)}
            title="تثبيت التطبيق على الجهاز"
          >
            <span>📥</span>
            <span>تثبيت التطبيق</span>
          </button>
        </div>
      )}

      {/* FLOATING PWA OFFLINE MODE INDICATOR */}
      {!isOnline && (
        <div className="no-print fixed bottom-24 md:bottom-6 right-6 z-50 animate-bounce">
          <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-950/80 border border-red-500/35 backdrop-blur-md text-red-400 font-bold text-xs rounded-full shadow-lg shadow-red-500/10 select-none">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
            <span>العمل محلياً (دون إنترنت)</span>
          </div>
        </div>
      )}

      {/* MOBILE BOTTOM NAVIGATION TAB BAR */}
      {isLoggedIn && (
        <div className="bottom-nav no-print">
          {[
            { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
            { id: 'ledger', label: 'اليومي', icon: '📋' },
            { id: 'clients', label: 'العملاء', icon: '👥' },
            { id: 'purchases_ledger', label: 'المشتريات', icon: '📦' },
            { id: 'summary', label: 'الملخص', icon: '📈' },
            { id: 'cashbook', label: 'الصندوق', icon: '💵' }
          ].filter(tab => state.role !== 'driver' || tab.id === 'ledger' || tab.id === 'clients').map(tab => (
            <button 
              key={tab.id} 
              className={`bottom-nav-item ${state.view === tab.id ? 'active' : ''}`}
              onClick={() => handleViewChange(tab.id)}
            >
              <span className="bottom-nav-icon">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* RENDER DYNAMIC DETAILED STATEMENT OVERLAY IF ACTIVE */}
      {activeStatementClientId !== null && (
        <Suspense fallback={null}>
          <StatementPrint 
            state={state} 
            clientId={activeStatementClientId} 
            onClose={() => setActiveStatementClientId(null)} 
          />
        </Suspense>
      )}

      {/* RENDER DYNAMIC DETAILED SUPPLIER STATEMENT OVERLAY IF ACTIVE */}
      {activeStatementSupplierId !== null && (
        <Suspense fallback={null}>
          <SupplierStatementPrint 
            state={state} 
            supplierId={activeStatementSupplierId} 
            onClose={() => setActiveStatementSupplierId(null)} 
          />
        </Suspense>
      )}

      {/* RENDER SMART COMMAND PALETTE OVERLAY */}
      <Suspense fallback={null}>
        <CommandPalette
          isOpen={commandPaletteOpen}
          onClose={() => setCommandPaletteOpen(false)}
          state={state}
          onSelectClient={handleSelectClient}
          onSelectSupplier={handleSelectSupplier}
          setView={(v) => {
            triggerHaptic(10);
            setState(prev => ({ ...prev, view: v }));
          }}
          onSaveBackup={handleBackupCloudExport}
          onRestoreBackup={handleBackupCloudRestore}
        />
      </Suspense>

      {/* RENDER SYSTEM NOTIFICATION SIDE DRAWER OVERLAY */}
      <Suspense fallback={null}>
        <NotificationCenter
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          notifications={notifications}
          onMarkAllAsRead={() => {
            triggerHaptic(10);
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
          }}
          onClearAll={() => {
            triggerHaptic(10);
            setNotifications([]);
          }}
        />
      </Suspense>
    </>
  );
}
