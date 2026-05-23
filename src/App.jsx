import React, { useState, useEffect } from 'react';
import './styles/main.css';

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
  // Authentication State
  const [password, setPassword] = useState(() => localStorage.getItem("dawajin_password") || "");
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Initialize state from localStorage
  const getInitialState = () => {
    const defaultState = {
      clients: [
        { id: 1, name: "محمد بن علي", address: "الحامة 1", phone: "55 549 457", color: 0 },
      ],
      ledger: {},
      selectedClient: 1,
      view: "dashboard",
      pricePerKg: 5.8,
      theme: "dark",
      month: 5,
      year: 2026
    };
    try {
      const saved = localStorage.getItem("dawajin_state");
      if (saved) {
        const parsed = JSON.parse(saved);
        // Clean defaults and merge
        return {
          ...defaultState,
          ...parsed,
          month: parsed.month || 5,
          year: parsed.year || 2026,
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

  // Sync state to localStorage whenever it changes
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
        year: state.year
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

  // Global Handlers
  const handleViewChange = (viewName) => {
    setState(prev => ({ ...prev, view: viewName }));
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

  const handleDefaultPriceChange = (newPrice) => {
    // Also recalculate ledger values for current active client where no custom price is set
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
    
    // Fire success toast
    toastMessage("✓ تم تحديث السعر الافتراضي وتحديث الحسابات");
  };

  // Password Modification Handler
  const handleChangePassword = (newPass) => {
    localStorage.setItem("dawajin_password", newPass);
    setPassword(newPass);
    toastMessage("✓ تم تحديث كلمة المرور بنجاح");
  };

  // Toast Helpers
  const toastMessage = (msg, type = "success") => {
    const el = document.getElementById("toast");
    if (!el) return;
    let icon = "✓";
    if (type === "error") icon = "❌";
    else if (type === "warning") icon = "⚠️";
    else if (type === "info") icon = "ℹ️";
    
    el.className = `no-print show ${type}`;
    el.innerHTML = `<span style="font-size:16px">${icon}</span> <span>${msg}</span>`;
    
    if (window.toastTimeout) clearTimeout(window.toastTimeout);
    window.toastTimeout = setTimeout(() => {
      el.classList.remove("show");
    }, 2500);
  };

  // Row Manipulation
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
      const row = { ...rows[idx], [field]: val };

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

      rows[idx] = row;
      updatedLedger[k] = rows;

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
      const currentHoliday = rows[idx].holiday;
      
      rows[idx] = {
        ...rows[idx],
        holiday: !currentHoliday,
        tw: !currentHoliday ? "" : rows[idx].tw,
        nw: !currentHoliday ? "" : rows[idx].nw,
        price: !currentHoliday ? "" : rows[idx].price,
        amt: !currentHoliday ? "" : rows[idx].amt,
        paid: !currentHoliday ? "" : rows[idx].paid
      };

      updatedLedger[k] = rows;
      return {
        ...prev,
        ledger: updatedLedger
      };
    });
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
        const r = rows[i];
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
      return {
        ...prev,
        ledger: updatedLedger
      };
    });
    
    toastMessage("✓ تم تسوية وتوزيع الدفعات بنجاح");
  };

  // Client Management Handlers
  const handleSelectClient = (cid) => {
    setState(prev => ({
      ...prev,
      selectedClient: cid,
      view: cid === null ? "clients" : "ledger"
    }));
  };

  const handleAddClient = (clientData) => {
    const newClient = {
      id: Date.now(),
      ...clientData
    };
    setState(prev => ({
      ...prev,
      clients: [...prev.clients, newClient],
      selectedClient: newClient.id
    }));
    toastMessage("✓ تم إضافة العميل الجديد بنجاح");
  };

  const handleEditClient = (updatedClient) => {
    setState(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.id === updatedClient.id ? updatedClient : c)
    }));
    toastMessage("✓ تم تعديل بيانات العميل بنجاح");
  };

  const handleDeleteClient = (cid) => {
    setState(prev => {
      const filteredClients = prev.clients.filter(c => c.id !== cid);
      const isSelectedDeleted = prev.selectedClient === cid;
      return {
        ...prev,
        clients: filteredClients,
        selectedClient: isSelectedDeleted ? (filteredClients.length ? filteredClients[0].id : null) : prev.selectedClient
      };
    });
    toastMessage("✓ تم حذف العميل بنجاح");
  };

  // Backup & Import
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
        return <div>View not found</div>;
    }
  };

  return (
    <>
      <div id="toast" className="no-print"></div>

      <header>
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">🐔</div>
            <div>
              <div className="logo-text">الودرني للدواجن</div>
              <div className="logo-sub">الحامة — قابس</div>
            </div>
          </div>
          <nav id="nav">
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
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
            <button 
              className="theme-toggle no-print" 
              onClick={handleThemeToggle} 
              title="تغيير المظهر"
            >
              {state.theme === 'light' ? '☀️' : '🌙'}
            </button>
            <button 
              className="btn btn-outline btn-sm no-print" 
              onClick={() => window.print()} 
              title="طباعة"
            >
              🖨️
            </button>
            <button 
              className="btn btn-outline btn-sm no-print" 
              onClick={() => setIsLoggedIn(false)} 
              title="تسجيل الخروج"
              style={{ color: 'var(--red)', borderColor: 'rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.05)', fontWeight: '700' }}
            >
              🔒 خروج
            </button>
            <select 
              id="month-sel" 
              className="input" 
              style={{ width: 'auto', padding: '6px 10px', fontSize: '12px' }} 
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
              style={{ width: '72px', padding: '6px 8px', fontSize: '12px', textAlign: 'center' }} 
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
