import React, { useState, useEffect, useRef } from 'react';
import './styles/main.css';
import { supabase } from './js/supabaseClient';

// Component Imports
import Dashboard from './components/Dashboard';
import Ledger from './components/Ledger';
import Clients from './components/Clients';
import Analytics from './components/Analytics';
import Summary from './components/Summary';
import InvoicePrint from './components/InvoicePrint';
import LoginScreen from './components/LoginScreen';

// Utilities Import
import { 
  MONTHS, 
  ledgerKey, 
  getRows, 
  getTotals, 
  daysInMonth, 
  calcBalance, 
  exportToCSV 
} from './js/utils';

export default function App() {
  // --- Supabase Cloud States ---
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [isCloudLoading, setIsCloudLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Detect if Supabase is filled in .env
  const isSupabaseConfigured = 
    import.meta.env.VITE_SUPABASE_URL && 
    !import.meta.env.VITE_SUPABASE_URL.includes('your-supabase-project');

  // --- Authentication States ---
  const [password, setPassword] = useState(() => localStorage.getItem("dawajin_password") || "");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Initialize state from localStorage (standalone fallback)
  const getInitialState = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const defaultState = {
      clients: [],
      ledger: {},
      selectedClient: null,
      view: "dashboard",
      pricePerKg: 5.800,
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
          view: parsed.view || "dashboard"
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
    installPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
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
        setIsLoggedIn(true);
        fetchCloudData(session.user.id);
      }
    });

    // Listen for auth events
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (newSession) {
        setSession(newSession);
        setUser(newSession.user);
        setIsLoggedIn(true);
        fetchCloudData(newSession.user.id);
      } else {
        setSession(null);
        setUser(null);
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
        view: state.view,
        pricePerKg: state.pricePerKg,
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
  }, [state.theme]);

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

      setState(prev => ({
        ...prev,
        clients: formattedClients,
        ledger: formattedLedger,
        selectedClient: formattedClients.length ? (formattedClients.some(c => c.id === prev.selectedClient) ? prev.selectedClient : formattedClients.at(0).id) : null,
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

  // --- Global Handlers ---
  const handleViewChange = (viewName) => {
    setState(prev => ({ ...prev, view: viewName }));
    setMobileMenuOpen(false);
  };

  const handleMonthChange = (e) => {
    const val = parseInt(e.target.value) || 5;
    setState(prev => ({ ...prev, month: val }));
  };

  const handleYearChange = (e) => {
    const val = parseInt(e.target.value) || 2026;
    setState(prev => ({ ...prev, year: val }));
  };

  const handleThemeToggle = () => {
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

  const handleChangePassword = (newPass) => {
    localStorage.setItem("dawajin_password", newPass);
    setPassword(newPass);
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

  // Sync a single daily ledger entry to Supabase
  const syncLedgerEntryToCloud = async (clientUuid, year, month, idx, row) => {
    if (!isSupabaseConfigured || !user) return;
    const day = idx + 1;

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
    } catch (err) {
      console.error("Cloud row upsert error:", err);
    }
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
    setIsLoggedIn(true);
    fetchCloudData(newUser.id);
  };

  const handleLogout = async () => {
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
    }
    
    // Clear localStorage offline cache completely to prevent data leak
    localStorage.removeItem("dawajin_state");
    
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
        onLogin={() => setIsLoggedIn(true)}
        onSetPassword={(newPass) => {
          localStorage.setItem("dawajin_password", newPass);
          setPassword(newPass);
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
      case "analytics":
        return (
          <Analytics state={state} />
        );
      case "summary":
        return (
          <Summary 
            state={state}
            onSelectClient={handleSelectClient}
          />
        );
      default:
        return <div>{"View not found"}</div>;
    }
  };

  return (
    <>
      <div id="toast" className="no-print"></div>

      <header>
        <div className="header-inner">
          <div className="logo">
            <img 
              src="/poultry-ledger/assets/icon.svg" 
              alt={state.companyInfo.name} 
              style={{ 
                width: '64px', 
                height: '64px', 
                borderRadius: '12px', 
                objectFit: 'contain', 
                border: '1.5px solid rgba(212, 168, 67, 0.45)', 
                background: '#ffffff',
                padding: '3px'
              }}
              onError={(e) => {
                e.target.outerHTML = '<div class="logo-icon" style="width: 64px; height: 64px; font-size: 30px; border-radius: 12px;">🐔</div>';
              }}
            />
            <div>
              <div className="logo-text">{state.companyInfo.name}</div>
              <div className="logo-sub">{state.companyInfo.address}</div>
            </div>
          </div>
          
          {/* CLOUD CONNECTION SYNC BADGE INDICATOR */}
          {isSupabaseConfigured && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: 'rgba(16, 185, 129, 0.08)', 
              border: '1.5px solid rgba(16, 185, 129, 0.25)',
              borderRadius: '20px',
              padding: '4px 12px',
              fontSize: '11px',
              fontWeight: '700',
              color: 'var(--green)'
            }} className="no-print">
              <span className="pulse-dot-green" style={{ margin: 0 }}></span>
              <span>
                {isCloudLoading ? "جاري المزامنة..." : "متصل بالسحابة"}
              </span>
            </div>
          )}

          {/* HAMBURGER MENU TOGGLE BUTTON */}
          <button 
            className={`menu-toggle no-print ${mobileMenuOpen ? 'open' : ''}`}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            title="القائمة"
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>

          <nav id="nav" className={mobileMenuOpen ? 'open' : ''}>
            <button 
              className={state.view === 'dashboard' ? 'active' : ''} 
              onClick={() => handleViewChange('dashboard')}
            >
              🏠 <span>الرئيسية</span>
            </button>
            <button 
              className={state.view === 'ledger' ? 'active' : ''} 
              onClick={() => handleViewChange('ledger')}
            >
              📋 <span>السجل اليومي</span>
            </button>
            <button 
              className={state.view === 'clients' ? 'active' : ''} 
              onClick={() => handleViewChange('clients')}
            >
              👥 <span>العملاء</span>
            </button>
            <button 
              className={state.view === 'analytics' ? 'active' : ''} 
              onClick={() => handleViewChange('analytics')}
            >
              📊 <span>التحليلات</span>
            </button>
            <button 
              className={state.view === 'summary' ? 'active' : ''} 
              onClick={() => handleViewChange('summary')}
            >
              📈 <span>الملخص المالي</span>
            </button>
          </nav>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }} className="no-print">
            {installPrompt && (
              <button 
                className="btn btn-gold btn-sm no-print" 
                onClick={handleInstallClick}
                style={{ fontWeight: '700', gap: '4px', height: '44px' }}
                title="تثبيت التطبيق"
              >
                📲 <span>تثبيت</span>
              </button>
            )}

            <button 
              className="theme-toggle no-print" 
              onClick={handleThemeToggle} 
              title="تغيير المظهر"
            >
              {state.theme === 'light' ? '☀️' : '🌙'}
            </button>

            <button 
              className="btn btn-outline btn-sm no-print" 
              onClick={handleLogout} 
              title="تسجيل الخروج"
              style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.05)', fontWeight: '700' }}
            >
              🔒 خروج
            </button>
            <select 
              id="month-sel" 
              className="input" 
              style={{ width: 'auto', padding: '8px 12px', fontSize: '14px', fontWeight: '600' }} 
              value={state.month} 
              onChange={handleMonthChange}
            >
              {MONTHS.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
            <input 
              type="number" 
              id="year-sel" 
              className="input" 
              style={{ width: '80px', padding: '8px 10px', fontSize: '14px', fontWeight: '600', textAlign: 'center' }} 
              value={state.year} 
              min="2020" 
              max="2035" 
              onChange={handleYearChange}
            />
          </div>
        </div>
      </header>

      <main id="main-content">
        {renderActiveView()}
      </main>

      {/* RENDER DYNAMIC BILL PREVIEW OVERLAY IF ACTIVE */}
      {activeInvoiceClientId !== null && (
        <InvoicePrint 
          state={state} 
          clientId={activeInvoiceClientId} 
          onClose={() => setActiveInvoiceClientId(null)} 
        />
      )}
    </>
  );
}
