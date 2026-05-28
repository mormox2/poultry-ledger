import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import './styles/main.css';
import { supabase } from './js/supabaseClient';

// Critical Components (Statically Imported for Instant Load)
import Dashboard from './components/Dashboard';
import LoginScreen from './components/LoginScreen';

// Secondary Components (Lazy Loaded for Code Splitting)
const Ledger = lazy(() => import('./components/Ledger'));
const Clients = lazy(() => import('./components/Clients'));
const Suppliers = lazy(() => import('./components/Suppliers'));
const PurchasesLedger = lazy(() => import('./components/PurchasesLedger'));
const Analytics = lazy(() => import('./components/Analytics'));
const Summary = lazy(() => import('./components/Summary'));
const InvoicePrint = lazy(() => import('./components/InvoicePrint'));
const InstallModal = lazy(() => import('./components/InstallModal'));

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
      pricePerKg: 5.800,
      defaultPurchasePricePerKg: 5.200,
      view: "dashboard",
      theme: "dark",
      month: currentMonth,
      year: currentYear,
      companyInfo: {
        name: "الودرني للدواجن",
        address: "وادي النور الحامة,قابس",
        phone: "96 101 651",
        taxId: "1895235/E"
      }
    };
    try {
      const saved = localStorage.getItem("dawajin_state");
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultState,
          ...parsed,
          companyInfo: parsed.companyInfo || defaultState.companyInfo,
          month: parsed.month || currentMonth,
          year: parsed.year || currentYear,
          view: parsed.view || "dashboard",
          suppliers: parsed.suppliers || defaultState.suppliers,
          purchases: parsed.purchases || defaultState.purchases,
          selectedSupplier: parsed.selectedSupplier || defaultState.selectedSupplier,
          defaultPurchasePricePerKg: parsed.defaultPurchasePricePerKg || defaultState.defaultPurchasePricePerKg
        };
      }
    } catch (e) {
      console.error("Failed to load initial state from localStorage", e);
    }
    return defaultState;
  };

  const [state, setState] = useState(getInitialState);
  const [activeInvoiceClientId, setActiveInvoiceClientId] = useState(null);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [deviceType, setDeviceType] = useState('other');
  const syncDBRef = useRef(null);

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
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
      localStorage.setItem("dawajin_state", JSON.stringify({
        clients: state.clients,
        ledger: state.ledger,
        selectedClient: state.selectedClient,
        suppliers: state.suppliers,
        purchases: state.purchases,
        selectedSupplier: state.selectedSupplier,
        view: state.view,
        pricePerKg: state.pricePerKg,
        defaultPurchasePricePerKg: state.defaultPurchasePricePerKg,
        theme: state.theme,
        month: state.month,
        year: state.year,
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

      const formattedSuppliers = finalSuppliers.map(s => ({
        id: s.id,
        name: s.name,
        address: s.address,
        phone: s.phone,
        color: s.color,
        taxId: s.tax_id
      }));

      const formattedPurchases = {};
      finalPurchases.forEach(e => {
        const k = ledgerKey(e.supplier_id, e.year, e.month);
        if (!Reflect.has(formattedPurchases, k)) {
          const days = daysInMonth(e.year, e.month);
          Reflect.set(formattedPurchases, k, Array.from({ length: days }, (_, i) => ({
            d: i + 1,
            tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
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
            notes: e.notes || ""
          });
        }
      });

      setState(prev => ({
        ...prev,
        clients: formattedClients,
        ledger: formattedLedger,
        selectedClient: formattedClients.length ? (formattedClients.some(c => c.id === prev.selectedClient) ? prev.selectedClient : formattedClients.at(0).id) : null,
        suppliers: formattedSuppliers,
        purchases: formattedPurchases,
        selectedSupplier: formattedSuppliers.length ? (formattedSuppliers.some(s => s.id === prev.selectedSupplier) ? prev.selectedSupplier : formattedSuppliers.at(0).id) : null,
        pricePerKg: profile ? parseFloat(profile.price_per_kg) : prev.pricePerKg,
        companyInfo: profile ? {
          name: profile.company_name,
          address: profile.company_address,
          phone: profile.company_phone,
          taxId: profile.company_tax_id
        } : prev.companyInfo
      }));

      toastMessage("⚡ تم مزامنة كامل البيانات مع السحابة بنجاح !");
    } catch (err) {
      console.error("Failed to load cloud data:", err);
      toastMessage("❌ فشل سحب البيانات السحابية، يرجى التثبت من الاتصال", "error");
    } finally {
      setIsCloudLoading(false);
    }
  };

  const triggerHaptic = (ms = 12) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(ms);
      } catch (e) {
        // ignore
      }
    }
  };

  // --- Global Handlers ---
  const handleViewChange = (viewName) => {
    triggerHaptic(12);
    setState(prev => ({ ...prev, view: viewName }));
    setMobileMenuOpen(false);
  };

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

  const handleDefaultPriceChange = async (newPrice) => {
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
  };

  const handleChangePassword = async (newPass) => {
    const hashed = await hashPassword(newPass);
    localStorage.setItem("dawajin_password", hashed);
    setPassword(hashed);
    toastMessage("✓ تم تحديث كلمة المرور بنجاح");
  };

  const handleUpdateCompanyInfo = async (newInfo) => {
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
  };

  const toastMessage = (msg, type = "success") => {
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

  // --- Row Manipulation ---
  const handleUpdateRow = (idx, field, val) => {
    setState(prev => {
      const updatedLedger = { ...prev.ledger };
      const k = ledgerKey(prev.selectedClient, prev.year, prev.month);
      
      if (!updatedLedger[k]) {
        const days = daysInMonth(prev.year, prev.month);
        updatedLedger[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = [...updatedLedger[k]];
      const row = { ...rows.at(idx) };
      if (field === 'tw') {
        row.tw = val;
        if (val && !row.price) {
          row.price = prev.pricePerKg;
        }
      }
      else if (field === 'nw') {
        row.nw = val;
        if (val && !row.price) {
          row.price = prev.pricePerKg;
        }
      }
      else if (field === 'price') row.price = val;
      else if (field === 'amt') row.amt = val;
      else if (field === 'paid') row.paid = val;
      else if (field === 'holiday') row.holiday = val;
      else if (field === 'notes') row.notes = val;

      // Autocalculate values
      if (field === 'nw') {
        const nwFloat = parseFloat(val);
        if (!nwFloat) {
          row.amt = "";
        } else {
          const activePrice = parseFloat(row.price) || prev.pricePerKg || 0;
          row.amt = parseFloat((nwFloat * activePrice).toFixed(3));
        }
      } else if (field === 'price') {
        const customPrice = parseFloat(val);
        const nwFloat = parseFloat(row.nw) || 0;
        if (!nwFloat) {
          row.amt = "";
        } else {
          const activePrice = customPrice || prev.pricePerKg || 0;
          row.amt = parseFloat((nwFloat * activePrice).toFixed(3));
        }
      }

      rows.splice(idx, 1, row);
      updatedLedger[k] = rows;

      return {
        ...prev,
        ledger: updatedLedger
      };
    });
  };

  const handleSyncRow = (idx) => {
    if (!isSupabaseConfigured || !user) return;
    // Delay slightly to ensure React state updates are flushed and rendered
    setTimeout(() => {
      const currentState = stateRef.current;
      const k = ledgerKey(currentState.selectedClient, currentState.year, currentState.month);
      const rows = Reflect.get(currentState.ledger, k);
      if (rows && rows.at(idx)) {
        const row = rows.at(idx);
        syncLedgerEntryToCloud(currentState.selectedClient, currentState.year, currentState.month, idx, row);
      }
    }, 100);
  };

  const handleToggleHoliday = async (idx) => {
    triggerHaptic(15);
    let updatedRow = null;
    let targetClient = null;
    let targetYear = null;
    let targetMonth = null;

    setState(prev => {
      const updatedLedger = { ...prev.ledger };
      targetClient = prev.selectedClient;
      targetYear = prev.year;
      targetMonth = prev.month;
      const k = ledgerKey(targetClient, targetYear, targetMonth);
      
      if (!updatedLedger[k]) {
        const days = daysInMonth(targetYear, targetMonth);
        updatedLedger[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = [...updatedLedger[k]];
      const targetRow = rows.at(idx);
      const currentHoliday = targetRow.holiday;
      
      updatedRow = {
        ...targetRow,
        holiday: !currentHoliday,
        tw: !currentHoliday ? "" : targetRow.tw,
        nw: !currentHoliday ? "" : targetRow.nw,
        price: !currentHoliday ? "" : targetRow.price,
        amt: !currentHoliday ? "" : targetRow.amt,
        paid: !currentHoliday ? "" : targetRow.paid
      };

      rows.splice(idx, 1, updatedRow);
      updatedLedger[k] = rows;

      return {
        ...prev,
        ledger: updatedLedger
      };
    });

    // Trigger Cloud sync outside setState
    if (isSupabaseConfigured && user && updatedRow && targetClient) {
      await syncLedgerEntryToCloud(targetClient, targetYear, targetMonth, idx, updatedRow);
    }
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

  // --- Purchase Row Manipulation ---
  const handleUpdatePurchaseRow = (idx, field, val) => {
    setState(prev => {
      const updatedPurchases = { ...prev.purchases };
      const k = ledgerKey(prev.selectedSupplier, prev.year, prev.month);
      
      if (!updatedPurchases[k]) {
        const days = daysInMonth(prev.year, prev.month);
        updatedPurchases[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = [...updatedPurchases[k]];
      const row = { ...rows.at(idx) };
      
      if (field === 'tw') {
        row.tw = val;
        if (val && !row.price) {
          row.price = prev.defaultPurchasePricePerKg || 5.200;
        }
      }
      else if (field === 'nw') {
        row.nw = val;
        if (val && !row.price) {
          row.price = prev.defaultPurchasePricePerKg || 5.200;
        }
      }
      else if (field === 'price') row.price = val;
      else if (field === 'amt') row.amt = val;
      else if (field === 'paid') row.paid = val;
      else if (field === 'holiday') row.holiday = val;
      else if (field === 'notes') row.notes = val;

      // Autocalculate values
      if (field === 'nw') {
        const nwFloat = parseFloat(val);
        if (!nwFloat) {
          row.amt = "";
        } else {
          const activePrice = parseFloat(row.price) || prev.defaultPurchasePricePerKg || 5.200;
          row.amt = parseFloat((nwFloat * activePrice).toFixed(3));
        }
      } else if (field === 'price') {
        const customPrice = parseFloat(val);
        const nwFloat = parseFloat(row.nw) || 0;
        if (!nwFloat) {
          row.amt = "";
        } else {
          const activePrice = customPrice || prev.defaultPurchasePricePerKg || 5.200;
          row.amt = parseFloat((nwFloat * activePrice).toFixed(3));
        }
      }

      rows.splice(idx, 1, row);
      updatedPurchases[k] = rows;

      return {
        ...prev,
        purchases: updatedPurchases
      };
    });
  };

  const handleSyncPurchaseRow = (idx) => {
    if (!isSupabaseConfigured || !user) return;
    setTimeout(() => {
      const currentState = stateRef.current;
      const k = ledgerKey(currentState.selectedSupplier, currentState.year, currentState.month);
      const rows = Reflect.get(currentState.purchases || {}, k);
      if (rows && rows.at(idx)) {
        const row = rows.at(idx);
        syncPurchaseEntryToCloud(currentState.selectedSupplier, currentState.year, currentState.month, idx, row);
      }
    }, 100);
  };

  const handleTogglePurchaseHoliday = async (idx) => {
    triggerHaptic(15);
    let updatedRow = null;
    let targetSupplier = null;
    let targetYear = null;
    let targetMonth = null;

    setState(prev => {
      const updatedPurchases = { ...prev.purchases };
      targetSupplier = prev.selectedSupplier;
      targetYear = prev.year;
      targetMonth = prev.month;
      const k = ledgerKey(targetSupplier, targetYear, targetMonth);
      
      if (!updatedPurchases[k]) {
        const days = daysInMonth(targetYear, targetMonth);
        updatedPurchases[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = [...updatedPurchases[k]];
      const targetRow = rows.at(idx);
      const currentHoliday = targetRow.holiday;
      
      updatedRow = {
        ...targetRow,
        holiday: !currentHoliday,
        tw: !currentHoliday ? "" : targetRow.tw,
        nw: !currentHoliday ? "" : targetRow.nw,
        price: !currentHoliday ? "" : targetRow.price,
        amt: !currentHoliday ? "" : targetRow.amt,
        paid: !currentHoliday ? "" : targetRow.paid
      };

      rows.splice(idx, 1, updatedRow);
      updatedPurchases[k] = rows;

      return {
        ...prev,
        purchases: updatedPurchases
      };
    });

    if (isSupabaseConfigured && user && updatedRow && targetSupplier) {
      await syncPurchaseEntryToCloud(targetSupplier, targetYear, targetMonth, idx, updatedRow);
    }
  };

  const syncPurchaseEntryToCloud = async (supplierUuid, year, month, idx, row) => {
    if (!isSupabaseConfigured || !user) return false;
    const day = idx + 1;

    try {
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

  const handleQuickPurchaseSettle = async (sid, amount) => {
    let updatedRows = [];
    let targetYear = null;
    let targetMonth = null;

    setState(prev => {
      const updatedPurchases = { ...prev.purchases };
      targetYear = prev.year;
      targetMonth = prev.month;
      const k = ledgerKey(sid, targetYear, targetMonth);
      
      if (!updatedPurchases[k]) {
        const days = daysInMonth(targetYear, targetMonth);
        updatedPurchases[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = updatedPurchases[k].map(r => ({ ...r }));
      let remaining = amount;

      for (let i = 0; i < rows.length; i++) {
        const r = rows.at(i);
        if (r.holiday || !r.amt) continue;
        const amt = parseFloat(r.amt) || 0;
        const paid = parseFloat(r.paid) || 0;
        const due = amt - paid;
        if (due <= 0) continue;

        const oldPaid = r.paid;
        if (remaining >= due) {
          r.paid = amt;
          remaining -= due;
        } else {
          r.paid = parseFloat((paid + remaining).toFixed(3));
          remaining = 0;
        }

        if (r.paid !== oldPaid) {
          updatedRows.push({ idx: i, row: r });
        }
        if (remaining <= 0) break;
      }

      updatedPurchases[k] = rows;

      return {
        ...prev,
        purchases: updatedPurchases
      };
    });

    if (isSupabaseConfigured && user && updatedRows.length > 0) {
      try {
        const syncPromises = updatedRows.map(({ idx, row }) => 
          syncPurchaseEntryToCloud(sid, targetYear, targetMonth, idx, row)
        );
        await Promise.all(syncPromises);
      } catch (err) {
        console.error("Cloud quick purchase settle sync error:", err);
      }
    }
    
    toastMessage("✓ تم تسوية وتوزيع المدفوعات للمورد بنجاح");
  };


  const handleQuickSettle = async (cid, amount) => {
    let updatedRows = [];
    let targetYear = null;
    let targetMonth = null;

    setState(prev => {
      const updatedLedger = { ...prev.ledger };
      targetYear = prev.year;
      targetMonth = prev.month;
      const k = ledgerKey(cid, targetYear, targetMonth);
      
      if (!updatedLedger[k]) {
        const days = daysInMonth(targetYear, targetMonth);
        updatedLedger[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = updatedLedger[k].map(r => ({ ...r }));
      let remaining = amount;

      for (let i = 0; i < rows.length; i++) {
        const r = rows.at(i);
        if (r.holiday || !r.amt) continue;
        const amt = parseFloat(r.amt) || 0;
        const paid = parseFloat(r.paid) || 0;
        const due = amt - paid;
        if (due <= 0) continue;

        const oldPaid = r.paid;
        if (remaining >= due) {
          r.paid = amt;
          remaining -= due;
        } else {
          r.paid = parseFloat((paid + remaining).toFixed(3));
          remaining = 0;
        }

        if (r.paid !== oldPaid) {
          updatedRows.push({ idx: i, row: r });
        }
        if (remaining <= 0) break;
      }

      updatedLedger[k] = rows;

      return {
        ...prev,
        ledger: updatedLedger
      };
    });

    // Trigger Cloud sync outside setState!
    if (isSupabaseConfigured && user && updatedRows.length > 0) {
      try {
        const syncPromises = updatedRows.map(({ idx, row }) => 
          syncLedgerEntryToCloud(cid, targetYear, targetMonth, idx, row)
        );
        await Promise.all(syncPromises);
      } catch (err) {
        console.error("Cloud quick settle sync error:", err);
      }
    }
    
    toastMessage("✓ تم تسوية وتوزيع الدفعات بنجاح");
  };

  // --- Client Management Handlers ---
  const handleSelectClient = (cid) => {
    triggerHaptic(12);
    setState(prev => ({
      ...prev,
      selectedClient: cid,
      view: cid === null ? "clients" : "ledger"
    }));
  };

  const handleAddClient = async (clientData) => {
    const tempId = Date.now();

    if (isSupabaseConfigured && user) {
      try {
        const { data, error } = await supabase
          .from('clients')
          .insert({
            profile_id: user.id,
            name: clientData.name,
            address: clientData.address,
            phone: clientData.phone,
            tax_id: clientData.taxId,
            color: clientData.color
          })
          .select()
          .single();

        if (error) throw error;
        
        if (data) {
          setState(prev => ({
            ...prev,
            clients: [...prev.clients, {
              id: data.id,
              name: data.name,
              address: data.address,
              phone: data.phone,
              color: data.color,
              taxId: data.tax_id
            }],
            selectedClient: data.id
          }));
          toastMessage("✓ تم إضافة العميل الجديد بنجاح");
        }
      } catch (err) {
        console.error("Cloud insert client error:", err);
        toastMessage("❌ فشل إضافة العميل في السحابة", "error");
      }
    } else {
      // Local Fallback
      const newClient = {
        id: tempId,
        ...clientData
      };
      setState(prev => ({
        ...prev,
        clients: [...prev.clients, newClient],
        selectedClient: newClient.id
      }));
      toastMessage("✓ تم إضافة العميل الجديد بنجاح");
    }
  };

  const handleEditClient = async (updatedClient) => {
    // Optimistic state update
    setState(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.id === updatedClient.id ? updatedClient : c)
    }));

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('clients')
          .update({
            name: updatedClient.name,
            address: updatedClient.address,
            phone: updatedClient.phone,
            tax_id: updatedClient.taxId,
            color: updatedClient.color
          })
          .eq('id', updatedClient.id);

        if (error) throw error;
      } catch (err) {
        console.error("Cloud edit client error:", err);
      }
    }
    toastMessage("✓ تم تعديل بيانات العميل بنجاح");
  };

  const handleDeleteClient = async (cid) => {
    setState(prev => {
      const filteredClients = prev.clients.filter(c => c.id !== cid);
      const isSelectedDeleted = prev.selectedClient === cid;
      return {
        ...prev,
        clients: filteredClients,
        selectedClient: isSelectedDeleted ? (filteredClients.length ? filteredClients[0].id : null) : prev.selectedClient
      };
    });

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', cid);

        if (error) throw error;
      } catch (err) {
        console.error("Cloud delete client error:", err);
      }
    }
    toastMessage("✓ تم حذف العميل بنجاح");
  };

  // --- Supplier Management Handlers ---
  const handleSelectSupplier = (sid) => {
    triggerHaptic(12);
    setState(prev => ({
      ...prev,
      selectedSupplier: sid,
      view: sid === null ? "suppliers" : "purchases_ledger"
    }));
  };

  const handleAddSupplier = async (supplierData) => {
    const tempId = Date.now();

    if (isSupabaseConfigured && user) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .insert({
            profile_id: user.id,
            name: supplierData.name,
            address: supplierData.address,
            phone: supplierData.phone,
            tax_id: supplierData.taxId,
            color: supplierData.color
          })
          .select()
          .single();

        if (error) throw error;
        
        if (data) {
          setState(prev => ({
            ...prev,
            suppliers: [...(prev.suppliers || []), {
              id: data.id,
              name: data.name,
              address: data.address,
              phone: data.phone,
              color: data.color,
              taxId: data.tax_id
            }],
            selectedSupplier: data.id
          }));
          toastMessage("✓ تم إضافة المورد الجديد بنجاح");
        }
      } catch (err) {
        console.error("Cloud insert supplier error:", err);
        toastMessage("❌ فشل إضافة المورد في السحابة", "error");
      }
    } else {
      // Local Fallback
      const newSupplier = {
        id: tempId,
        ...supplierData
      };
      setState(prev => ({
        ...prev,
        suppliers: [...(prev.suppliers || []), newSupplier],
        selectedSupplier: newSupplier.id
      }));
      toastMessage("✓ تم إضافة المورد الجديد بنجاح");
    }
  };

  const handleEditSupplier = async (updatedSupplier) => {
    // Optimistic state update
    setState(prev => ({
      ...prev,
      suppliers: (prev.suppliers || []).map(s => s.id === updatedSupplier.id ? updatedSupplier : s)
    }));

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('suppliers')
          .update({
            name: updatedSupplier.name,
            address: updatedSupplier.address,
            phone: updatedSupplier.phone,
            tax_id: updatedSupplier.taxId,
            color: updatedSupplier.color
          })
          .eq('id', updatedSupplier.id);

        if (error) throw error;
      } catch (err) {
        console.error("Cloud edit supplier error:", err);
      }
    }
    toastMessage("✓ تم تعديل بيانات المورد بنجاح");
  };

  const handleDeleteSupplier = async (sid) => {
    setState(prev => {
      const filteredSuppliers = (prev.suppliers || []).filter(s => s.id !== sid);
      const isSelectedDeleted = prev.selectedSupplier === sid;
      return {
        ...prev,
        suppliers: filteredSuppliers,
        selectedSupplier: isSelectedDeleted ? (filteredSuppliers.length ? filteredSuppliers[0].id : null) : prev.selectedSupplier
      };
    });

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('suppliers')
          .delete()
          .eq('id', sid);

        if (error) throw error;
      } catch (err) {
        console.error("Cloud delete supplier error:", err);
      }
    }
    toastMessage("✓ تم حذف المورد بنجاح");
  };


  // --- Backup & Import ---
  const handleBackupExport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `dawajin_pro_backup_${Date.now()}.json`);
    dlAnchorElem.click();
    toastMessage("✓ تم تحميل ملف النسخة الاحتياطية");
  };

  const handleBackupImport = (file) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedState = JSON.parse(e.target.result);
        if (importedState.clients && importedState.ledger) {
          setState(prev => ({
            ...prev,
            ...importedState,
            month: importedState.month || prev.month,
            year: importedState.year || prev.year,
            view: "dashboard"
          }));
          toastMessage("✓ تم استيراد البيانات بنجاح !");
        } else {
          alert("ملف غير صالح.");
        }
      } catch (err) {
        alert("فشل قراءة الملف.");
      }
    };
    reader.readAsText(file);
  };

  const handleCSVExport = () => {
    exportToCSV(state);
  };

  const handleCloudLogin = (newSession, newUser) => {
    setSession(newSession);
    setUser(newUser);
    localStorage.setItem("dawajin_logged_in", "true");
    setIsLoggedIn(true);
    fetchCloudData(newUser.id);
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
        onLogin={() => {
          localStorage.setItem("dawajin_logged_in", "true");
          setIsLoggedIn(true);
        }}
        onSetPassword={async (newPass) => {
          await handleChangePassword(newPass);
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
      default:
        return <div>{"View not found"}</div>;
    }
  };

  return (
    <>
      <div id="toast" className="no-print"></div>

      <header className="sticky top-0 z-40 w-full shadow-md no-print transition-all duration-300">
        <div className="header-inner max-w-[1600px] mx-auto px-4 md:px-8 flex flex-col md:flex-row items-center justify-between py-4 md:h-24 gap-4">
          
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
          
          {/* DYNAMIC NETWORK & CLOUD SYNC STATUS BADGE */}
          {isSupabaseConfigured && (
            <div className={`no-print flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold md:ml-auto select-none border transition-all duration-300 ${
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

          {/* MAIN VIEW NAVIGATION TABS */}
          <nav id="nav" className={`no-print flex-col md:flex-row md:flex gap-1.5 ${mobileMenuOpen ? 'open flex w-full' : 'hidden'}`}>
            {[
              { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
              { id: 'ledger', label: 'السجل اليومي', icon: '📋' },
              { id: 'clients', label: 'العملاء', icon: '👥' },
              { id: 'purchases_ledger', label: 'سجل المشتريات', icon: '📦' },
              { id: 'suppliers', label: 'الموردين', icon: '🤝' },
              { id: 'analytics', label: 'التحليلات', icon: '📊' },
              { id: 'summary', label: 'الملخص المالي', icon: '📈' }
            ].map(tab => (
              <button 
                key={tab.id}
                className={`px-4 py-2.5 rounded-xl font-extrabold text-xs transition-all duration-200 flex items-center gap-2 w-full md:w-auto ${
                  state.view === tab.id 
                    ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/10' 
                    : 'bg-transparent text-slate-400 hover:text-amber-400 hover:bg-slate-900/60 border border-transparent hover:border-slate-850'
                }`}
                onClick={() => handleViewChange(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* ACTIONS & SELECTORS ROW */}
          <div className="no-print flex items-center gap-2 flex-shrink-0 w-full md:w-auto justify-end">
            

            {/* THEME TOGGLE BUTTON */}
            <button 
              className="no-print flex items-center justify-center w-10 h-10 rounded-xl border border-slate-800 bg-slate-900/50 text-amber-500 hover:bg-slate-900 hover:border-amber-500/40 hover:scale-105 transition-all duration-200 text-base" 
              onClick={handleThemeToggle} 
              title="تغيير المظهر"
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
      </header>

      <main id="main-content" className="max-w-[1600px] mx-auto px-4 md:px-8 py-6">
        <Suspense fallback={
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
            <div className="text-xs text-slate-400 font-bold select-none">جاري تحميل الصفحة...</div>
          </div>
        }>
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

      {/* MOBILE BOTTOM NAVIGATION TAB BAR */}
      {isLoggedIn && (
        <div className="bottom-nav no-print">
          {[
            { id: 'dashboard', label: 'الرئيسية', icon: '🏠' },
            { id: 'ledger', label: 'اليومي', icon: '📋' },
            { id: 'clients', label: 'العملاء', icon: '👥' },
            { id: 'purchases_ledger', label: 'المشتريات', icon: '📦' },
            { id: 'summary', label: 'الملخص', icon: '📈' }
          ].map(tab => (
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
    </>
  );
}
