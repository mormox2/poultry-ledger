import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function CommandPalette({
  isOpen,
  onClose,
  state,
  onSelectClient,
  onSelectSupplier,
  setView,
  onSaveBackup,
  onRestoreBackup,
  onChangePassword
}) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [filterType, setFilterType] = useState('all'); // 'all', 'clients', 'suppliers', 'actions'
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  // Autofocus input when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setFilterType('all');
      setTimeout(() => {
        if (inputRef.current) inputRef.current.focus();
      }, 80);
    }
  }, [isOpen]);

  // Static quick actions list with Arabic descriptions
  const staticActions = useMemo(() => [
    {
      id: 'action-dashboard',
      type: 'action',
      title: '🏠 لوحة التحكم الرئيسيّة والضبط',
      description: 'الذهاب إلى الإعدادات العامة للشركة، تغيير كلمة المرور والنسخ الاحتياطي',
      action: () => setView('dashboard')
    },
    {
      id: 'action-ledger',
      type: 'action',
      title: '📖 دفتر المبيعات اليومي (الحساب العام)',
      description: 'تسجيل وتحديث مبيعات الدواجن والأوزان والمدفوعات اليومية للعملاء',
      action: () => {
        onSelectClient(state.selectedClient || (state.clients[0]?.id || null));
        setView('ledger');
      }
    },
    {
      id: 'action-clients',
      type: 'action',
      title: '👥 إدارة حسابات العملاء',
      description: 'إضافة عميل جديد، تعديل بيانات الاتصال، وعرض الأرصدة المتراكمة للعملاء',
      action: () => setView('clients')
    },
    {
      id: 'action-suppliers',
      type: 'action',
      title: '🤝 إدارة حسابات الموردين',
      description: 'إضافة وتعديل بيانات الموردين ووضع أسعار الشراء الافتراضية لكل مورد',
      action: () => setView('suppliers')
    },
    {
      id: 'action-purchases',
      type: 'action',
      title: '💵 دفتر المشتريات اليومي (الموردين)',
      description: 'متابعة أوزان وسلع الدواجن المشتراة وتصفية مستحقات الموردين',
      action: () => {
        onSelectSupplier(state.selectedSupplier || (state.suppliers[0]?.id || null));
        setView('purchases_ledger');
      }
    },
    {
      id: 'action-deadlines',
      type: 'action',
      title: '📅 جدول إدارة الآجال والتنبيهات',
      description: 'متابعة الكمبيالات والديون المستحقة والتواريخ المحددة للسداد',
      action: () => setView('deadlines')
    },
    {
      id: 'action-analytics',
      type: 'action',
      title: '📊 تحليلات ومؤشرات الأداء',
      description: 'عرض الرسوم البيانية لأرباح المبيعات، ومعدلات الأوزان والنمو المالي للمؤسسة',
      action: () => setView('analytics')
    },
    {
      id: 'action-summary',
      type: 'action',
      title: '📄 جدول الخلاصة الشهرية والموازنة',
      description: 'عرض الكشوفات الشهرية المجمعة للمقبوضات والمبيعات والمشتريات الكلية',
      action: () => setView('summary')
    },
    {
      id: 'action-backup',
      type: 'action',
      title: '☁️ حفظ نسخة احتياطية سحابية فورية',
      description: 'تشغيل تشفير AES-GCM ورفع البيانات الحالية بأمان إلى خوادم Supabase',
      action: () => {
        if (onSaveBackup) onSaveBackup();
      }
    },
    {
      id: 'action-restore',
      type: 'action',
      title: '📥 استيراد نسخة احتياطية سحابية',
      description: 'استعادة السجلات المحفوظة مسبقًا على السحابة ودمجها مع الجهاز',
      action: () => {
        if (onRestoreBackup) onRestoreBackup();
      }
    }
  ], [state, setView, onSelectClient, onSelectSupplier, onSaveBackup, onRestoreBackup]);

  // Combine and search items
  const filteredItems = useMemo(() => {
    const list = [];

    // 1. Add actions if filter permits
    if (filterType === 'all' || filterType === 'actions') {
      staticActions.forEach(act => {
        if (!query || act.title.toLowerCase().includes(query.toLowerCase()) || act.description.toLowerCase().includes(query.toLowerCase())) {
          list.push(act);
        }
      });
    }

    // 2. Add clients if filter permits
    if (filterType === 'all' || filterType === 'clients') {
      state.clients.forEach(cl => {
        if (!query || cl.name.toLowerCase().includes(query.toLowerCase()) || (cl.phone && cl.phone.includes(query))) {
          list.push({
            id: `client-${cl.id}`,
            type: 'client',
            title: `👥 ${cl.name}`,
            description: `عميل نشط | هاتف: ${cl.phone || 'لا يوجد'} | عنوان: ${cl.address || 'لا يوجد'}`,
            action: () => {
              onSelectClient(cl.id);
              setView('ledger');
            }
          });
        }
      });
    }

    // 3. Add suppliers if filter permits
    if (filterType === 'all' || filterType === 'suppliers') {
      state.suppliers.forEach(sp => {
        if (!query || sp.name.toLowerCase().includes(query.toLowerCase()) || (sp.phone && sp.phone.includes(query))) {
          list.push({
            id: `supplier-${sp.id}`,
            type: 'supplier',
            title: `🤝 ${sp.name}`,
            description: `مورد نشط | هاتف: ${sp.phone || 'لا يوجد'} | السعر الافتراضي: ${sp.defaultPrice ? sp.defaultPrice + ' د.ت' : 'سعر السوق'}`,
            action: () => {
              onSelectSupplier(sp.id);
              setView('purchases_ledger');
            }
          });
        }
      });
    }

    return list;
  }, [query, filterType, staticActions, state.clients, state.suppliers, onSelectClient, onSelectSupplier, setView]);

  // Keep selection within bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, filterType]);

  // Auto-scroll inside list container
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  // Key handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          filteredItems[selectedIndex].action();
          onClose();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredItems, onClose]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[99999] flex items-start justify-center pt-[10vh] px-4 bg-slate-950/70 backdrop-blur-md"
      onClick={onClose}
      style={{ direction: 'rtl' }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: -20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: -20 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-2xl bg-slate-900 border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[65vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Area */}
        <div className="relative border-b border-slate-800/60 p-4">
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-lg text-slate-500">🔍</span>
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent pl-4 pr-10 py-1 text-slate-100 placeholder-slate-500 text-sm outline-none w-full"
            placeholder="البحث الذكي عن عميل، مورد، صفحة أو إجراء سريع... (مثال: محمد، سحابي، تحليلات)"
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs px-2 py-1 rounded bg-slate-800"
            >
              مسح
            </button>
          )}
        </div>

        {/* Filters pills */}
        <div className="flex gap-2 p-3 bg-slate-950/40 border-b border-slate-850/40 text-xs px-4 overflow-x-auto no-scrollbar">
          {[
            { id: 'all', label: '⚡ الكل' },
            { id: 'clients', label: '👥 العملاء' },
            { id: 'suppliers', label: '🤝 الموردين' },
            { id: 'actions', label: '⚙️ إجراءات' }
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterType(f.id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors select-none ${
                filterType === f.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Results Container */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 max-h-[40vh]"
        >
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              <span className="text-xl block mb-2">🔍</span>
              لم يتم العثور على أي نتائج مطابقة
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isActive = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  data-active={isActive}
                  className={`p-3 rounded-xl cursor-pointer flex justify-between items-center transition-all duration-150 ${
                    isActive 
                      ? 'bg-gradient-to-r from-amber-500/15 to-transparent border-r-4 border-amber-500 text-white' 
                      : 'hover:bg-slate-800/40 text-slate-300'
                  }`}
                  onClick={() => {
                    item.action();
                    onClose();
                  }}
                >
                  <div className="text-right flex-1 min-w-0 pr-1">
                    <div className="font-bold text-xs flex items-center gap-1.5 truncate">
                      <span className={isActive ? 'text-amber-300' : 'text-slate-100'}>
                        {item.title}
                      </span>
                      {item.type === 'client' && (
                        <span className="text-[9px] bg-sky-500/10 text-sky-400 px-1.5 py-0.5 rounded-full">حريف</span>
                      )}
                      {item.type === 'supplier' && (
                        <span className="text-[9px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-full">مورد</span>
                      )}
                      {item.type === 'action' && (
                        <span className="text-[9px] bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full">إجراء</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                      {item.description}
                    </div>
                  </div>
                  
                  {isActive && (
                    <span className="text-[10px] text-amber-500 font-bold ml-2 select-none">
                      اضغط Enter ↩
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="bg-slate-950/70 border-t border-slate-850/60 p-3 px-4 flex justify-between items-center text-[10px] text-slate-500 select-none">
          <div className="flex gap-3">
            <span>
              <kbd className="bg-slate-850 px-1 py-0.5 rounded border border-slate-750 font-mono text-[9px]">↑↓</kbd> للتنقل
            </span>
            <span>
              <kbd className="bg-slate-850 px-1 py-0.5 rounded border border-slate-750 font-mono text-[9px]">Enter</kbd> للاختيار
            </span>
            <span>
              <kbd className="bg-slate-850 px-1 py-0.5 rounded border border-slate-750 font-mono text-[9px]">Esc</kbd> للإغلاق
            </span>
          </div>
          <div>
            <span>Dawajin Pro — لوحة البحث السريع</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
