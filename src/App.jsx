import React, { useState, useEffect } from 'react';
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
      pricePerKg: 6.0,
      theme: "dark",
      month: currentMonth,
      year: currentYear,
      companyInfo: {
        name: "شركة دواجن",
        address: "",
        phone: "",
        taxId: ""
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
      // 1. Fetch Profile (Company settings)
      const { data: profile, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userUuid)
        .single();
        
      if (profError && profError.code !== 'PGRST116') throw profError;

      // 2. Fetch Clients
      const { data: dbClients, error: clError } = await supabase
        .from('clients')
        .select('*')
        .order('name');
        
      if (clError) throw clError;

      // 3. Fetch Ledger Entries
      const { data: dbLedger, error: ledError } = await supabase
        .from('ledger_entries')
        .select('*');
        
      if (ledError) throw ledError;

      // Now reconstruct state!
      const formattedClients = dbClients.map(c => ({
        id: c.id,
        name: c.name,
        address: c.address,
        phone: c.phone,
        color: c.color,
        taxId: c.tax_id
      }));

      // Reconstruct ledger entries map
      const formattedLedger = {};
      dbLedger.forEach(e => {
        const k = `${e.client_id}:${e.year}:${e.month}`;
        if (!formattedLedger[k]) {
          const days = daysInMonth(e.year, e.month);
          formattedLedger[k] = Array.from({ length: days }, (_, i) => ({
            d: i + 1,
            tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
          }));
        }
        
        const idx = e.day - 1;
        if (formattedLedger[k][idx]) {
          formattedLedger[k][idx] = {
            d: e.day,
            tw: e.total_weight !== null ? String(e.total_weight) : "",
            nw: e.net_weight !== null ? String(e.net_weight) : "",
            price: e.price !== null ? String(e.price) : "",
            amt: e.amount !== null ? parseFloat(e.amount) : "",
            paid: e.paid !== null ? String(e.paid) : "",
            holiday: e.holiday,
            notes: e.notes || ""
          };
        }
      });

      setState(prev => ({
        ...prev,
        clients: formattedClients,
        ledger: formattedLedger,
        selectedClient: formattedClients.length ? formattedClients[0].id : null,
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
    // Optimistic UI state update
    setState(prev => {
      const updatedLedger = { ...prev.ledger };
      const k = ledgerKey(prev.selectedClient, prev.year, prev.month);
      if (updatedLedger[k]) {
        updatedLedger[k] = updatedLedger[k].map(r => {
          if (!r.holiday && !r.price && r.nw) {
            return {
              ...r,
              amt: parseFloat((parseFloat(r.nw) * newPrice).toFixed(3))
            };
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

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .upsert({
            id: user.id,
            price_per_kg: newPrice
          });
        if (error) throw error;
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
      if (field === 'tw') row.tw = val;
      else if (field === 'nw') row.nw = val;
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
          if (activePrice && !row.amt) {
            row.amt = parseFloat((nwFloat * activePrice).toFixed(3));
          }
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

      // Trigger Cloud sync in background
      syncLedgerEntryToCloud(prev.selectedClient, prev.year, prev.month, idx, row);

      return {
        ...prev,
        ledger: updatedLedger
      };
    });
  };

  const handleToggleHoliday = (idx) => {
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
      const targetRow = rows.at(idx);
      const currentHoliday = targetRow.holiday;
      
      const updatedRow = {
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

      // Trigger Cloud sync in background
      syncLedgerEntryToCloud(prev.selectedClient, prev.year, prev.month, idx, updatedRow);

      return {
        ...prev,
        ledger: updatedLedger
      };
    });
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

  const handleQuickSettle = (cid, amount) => {
    setState(prev => {
      const updatedLedger = { ...prev.ledger };
      const k = ledgerKey(cid, prev.year, prev.month);
      
      if (!updatedLedger[k]) {
        const days = daysInMonth(prev.year, prev.month);
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

        if (remaining >= due) {
          r.paid = amt;
          remaining -= due;
        } else {
          r.paid = parseFloat((paid + remaining).toFixed(3));
          remaining = 0;
          break;
        }
      }

      updatedLedger[k] = rows;

      // Trigger Cloud sync in background for each updated row
      rows.forEach((row, idx) => {
        syncLedgerEntryToCloud(cid, prev.year, prev.month, idx, row);
      });

      return {
        ...prev,
        ledger: updatedLedger
      };
    });
    
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
          />
        );
      case "ledger":
        return (
          <Ledger 
            state={state}
            onSelectClient={handleSelectClient}
            onUpdateRow={handleUpdateRow}
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
              src="/poultry-ledger/assets/logo.png" 
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
