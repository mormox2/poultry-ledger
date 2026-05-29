import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { fmt, getClientColor } from '../js/utils';

export default function Deadlines({ 
  state, 
  onAddDeadline, 
  onEditDeadline, 
  onDeleteDeadline, 
  onMarkAsPaid 
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'pending', 'paid', 'overdue'
  const [modalMode, setModalMode] = useState(null); // 'add', 'edit', 'delete'
  const [activeDeadline, setActiveDeadline] = useState(null);

  // Form states
  const [formType, setFormType] = useState('client'); // 'client' or 'supplier'
  const [formTargetId, setFormTargetId] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  // Helper to resolve entity name (client or supplier)
  const getEntity = (item) => {
    if (item.client_id) {
      return { 
        name: state.clients.find(c => c.id === item.client_id)?.name || "حريف غير معروف",
        color: state.clients.find(c => c.id === item.client_id)?.color || 0,
        type: 'client',
        phone: state.clients.find(c => c.id === item.client_id)?.phone || ''
      };
    } else {
      return { 
        name: (state.suppliers || []).find(s => s.id === item.supplier_id)?.name || "مورد غير معروف",
        color: (state.suppliers || []).find(s => s.id === item.supplier_id)?.color || 0,
        type: 'supplier',
        phone: (state.suppliers || []).find(s => s.id === item.supplier_id)?.phone || ''
      };
    }
  };

  const isOverdue = (item) => {
    return item.status === 'pending' && item.due_date < todayStr;
  };

  // Filter deadlines list
  const filtered = (state.deadlines || []).filter(item => {
    const entity = getEntity(item);
    
    // Status Filter
    if (statusFilter === 'pending' && item.status !== 'pending') return false;
    if (statusFilter === 'paid' && item.status !== 'paid') return false;
    if (statusFilter === 'overdue' && !isOverdue(item)) return false;
    
    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const nameMatch = entity.name.toLowerCase().includes(q);
      const notesMatch = item.notes && item.notes.toLowerCase().includes(q);
      const amtMatch = String(item.amount).includes(q);
      return nameMatch || notesMatch || amtMatch;
    }
    
    return true;
  });

  // Calculate statistics
  const stats = (state.deadlines || []).reduce((acc, item) => {
    const overdue = isOverdue(item);
    if (item.status === 'paid') {
      acc.paid += parseFloat(item.amount) || 0;
    } else if (overdue) {
      acc.overdue += parseFloat(item.amount) || 0;
      acc.pendingCount++;
    } else {
      acc.pending += parseFloat(item.amount) || 0;
      acc.pendingCount++;
    }
    return acc;
  }, { paid: 0, pending: 0, overdue: 0, pendingCount: 0 });

  const handleOpenAdd = () => {
    setFormType('client');
    setFormTargetId(state.clients[0]?.id || '');
    setFormAmount('');
    setFormDueDate(todayStr);
    setFormNotes('');
    setModalMode('add');
  };

  const handleOpenEdit = (item) => {
    setActiveDeadline(item);
    setFormType(item.client_id ? 'client' : 'supplier');
    setFormTargetId(item.client_id || item.supplier_id || '');
    setFormAmount(item.amount);
    setFormDueDate(item.due_date);
    setFormNotes(item.notes === '—' ? '' : item.notes || '');
    setModalMode('edit');
  };

  const handleOpenDelete = (item) => {
    setActiveDeadline(item);
    setModalMode('delete');
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveDeadline(null);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!formTargetId) {
      alert("الرجاء تحديد العميل أو المورد");
      return;
    }
    if (!formAmount || parseFloat(formAmount) <= 0) {
      alert("الرجاء إدخال مبلغ صحيح");
      return;
    }
    if (!formDueDate) {
      alert("الرجاء تحديد تاريخ الاستحقاق");
      return;
    }

    onAddDeadline({
      client_id: formType === 'client' ? formTargetId : null,
      supplier_id: formType === 'supplier' ? formTargetId : null,
      amount: parseFloat(formAmount),
      due_date: formDueDate,
      status: 'pending',
      notes: formNotes.trim() || "—"
    });
    closeModal();
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!formAmount || parseFloat(formAmount) <= 0) {
      alert("الرجاء إدخال مبلغ صحيح");
      return;
    }
    if (!formDueDate) {
      alert("الرجاء تحديد تاريخ الاستحقاق");
      return;
    }

    onEditDeadline({
      id: activeDeadline.id,
      client_id: formType === 'client' ? formTargetId : null,
      supplier_id: formType === 'supplier' ? formTargetId : null,
      amount: parseFloat(formAmount),
      due_date: formDueDate,
      status: activeDeadline.status,
      notes: formNotes.trim() || "—"
    });
    closeModal();
  };

  const handleDeleteConfirm = () => {
    onDeleteDeadline(activeDeadline.id);
    closeModal();
  };

  const handleWhatsAppReminder = (item) => {
    const entity = getEntity(item);
    let rawPhone = entity.phone || '';
    let phoneDigits = rawPhone.replace(/[^0-9+]/g, '');
    
    // Strip leading 00
    if (phoneDigits.startsWith('00')) {
      phoneDigits = phoneDigits.substring(2);
    }
    // Convert 8 digit local Tunisian to 216 format
    if (phoneDigits && !phoneDigits.startsWith('+') && !phoneDigits.startsWith('216') && phoneDigits.length === 8) {
      phoneDigits = '216' + phoneDigits;
    }
    // Strip +
    if (phoneDigits.startsWith('+')) {
      phoneDigits = phoneDigits.substring(1);
    }

    const dateFormatted = new Date(item.due_date).toLocaleDateString('ar-TN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const labelTarget = entity.type === 'client' ? '👤 *الحريف الكريم:*' : '🏢 *المورد الكريم:*';
    const relationMsg = entity.type === 'client' ? 'لديكم دفعة مستحقة الدفع لفائدتنا.' : 'لدينا دفعة مستحقة الدفع لفائدتكم.';

    const message = `*🐔 الودرني للدواجن — تذكير بموعد استحقاق الدفع*
----------------------------------------
${labelTarget} ${entity.name}
⚠️ *تذكير:* ${relationMsg}
💰 *المبلغ المطلوب:* ${fmt(item.amount)} د.ت
📅 *آخر أجل للدفع:* ${dateFormatted}
----------------------------------------
🤝 شكراً لتعاملكم معنا ووفائكم بآجال الدفع دائماً!`;

    window.open(`https://api.whatsapp.com/send?phone=${phoneDigits}&text=${encodeURIComponent(message)}`, '_blank');
  };

  // Stagger animation configurations
  const gridVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.04
      }
    }
  };

  const cardVariants = {
    hidden: { opacity: 0, scale: 0.95, y: 15 },
    show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* HEADER ROW */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 border border-slate-800/60 backdrop-blur-md rounded-2xl p-4 md:p-6 shadow-sm text-right">
        <div>
          <h2 className="text-xl md:text-2xl font-black bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
            إدارة الآجال والإقساط المالية ({(state.deadlines || []).length})
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">تتبع تواريخ استحقاق الديون والشيكات للحرفاء والموردين وجدولتها</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleOpenAdd}
          className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
        >
          <span>+</span>
          <span>إضافة أجل جديد</span>
        </motion.button>
      </div>

      {/* STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* STAT 1: Overdue */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 text-right relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-red-500" />
          <div className="text-[11px] text-slate-400 font-bold mb-2">إجمالي المتأخرات الفائتة</div>
          <div className="text-2xl font-black text-red-400 font-mono">{fmt(stats.overdue)} <span className="text-xs text-slate-500">د.ت</span></div>
          <div className="text-[10px] text-slate-500 mt-1.5">مستحقات تجاوزت تاريخ الأجل المحدد</div>
        </div>

        {/* STAT 2: Pending */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 text-right relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-amber-500" />
          <div className="text-[11px] text-slate-400 font-bold mb-2">الآجال القادمة (غير المسددة)</div>
          <div className="text-2xl font-black text-amber-400 font-mono">{fmt(stats.pending)} <span className="text-xs text-slate-500">د.ت</span></div>
          <div className="text-[10px] text-slate-500 mt-1.5">{stats.pendingCount} أقساط مالية قيد الانتظار</div>
        </div>

        {/* STAT 3: Paid */}
        <div className="bg-slate-900/30 border border-slate-800 rounded-2xl p-5 text-right relative overflow-hidden">
          <div className="absolute top-0 right-0 left-0 h-1 bg-emerald-500" />
          <div className="text-[11px] text-slate-400 font-bold mb-2">إجمالي الآجال المسددة</div>
          <div className="text-2xl font-black text-emerald-400 font-mono">{fmt(stats.paid)} <span className="text-xs text-slate-500">د.ت</span></div>
          <div className="text-[10px] text-slate-500 mt-1.5">تم تسوية وضعيتها وإضافتها للمداخيل</div>
        </div>
      </div>

      {/* FILTER AND SEARCH BAR */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between text-right">
        {/* Search */}
        <div className="w-full md:max-w-md relative">
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">🔍</span>
          <input 
            type="text" 
            className="w-full bg-slate-900/50 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-3 pl-4 pr-10 text-xs text-slate-100 placeholder-slate-550 outline-none transition-all duration-200" 
            placeholder="بحث عن أقساط بمبلغ أو باسم حريف..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status selection chips */}
        <div className="flex gap-2 flex-wrap">
          <button 
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
              statusFilter === 'all' 
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/5' 
                : 'bg-transparent border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            الكل ({(state.deadlines || []).length})
          </button>
          <button 
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
              statusFilter === 'pending' 
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/5' 
                : 'bg-transparent border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            قيد الانتظار
          </button>
          <button 
            onClick={() => setStatusFilter('overdue')}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
              statusFilter === 'overdue' 
                ? 'bg-red-500/85 text-white border-red-500/85 shadow-md' 
                : 'bg-transparent border-slate-800 text-slate-400 hover:text-red-400'
            }`}
          >
            تجاوزت الأجل
          </button>
          <button 
            onClick={() => setStatusFilter('paid')}
            className={`px-4 py-2 text-xs font-bold rounded-xl border transition-all duration-150 ${
              statusFilter === 'paid' 
                ? 'bg-emerald-500 text-slate-950 border-emerald-500 shadow-md shadow-emerald-500/5' 
                : 'bg-transparent border-slate-800 text-slate-400 hover:text-emerald-400'
            }`}
          >
            خالصة
          </button>
        </div>
      </div>

      {/* DEADLINES GRIDS */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-16 text-center text-slate-500 text-xs">
          <div className="text-4xl mb-3">📅</div>
          <div>لا توجد أي آجال دفع مطابقة للتصفية الحالية</div>
        </div>
      ) : (
        <motion.div 
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {filtered.map(item => {
            const entity = getEntity(item);
            const overdue = isOverdue(item);
            
            let badgeText = "قيد الانتظار";
            let badgeStyle = "bg-amber-500/15 text-amber-400 border-amber-500/20";
            if (item.status === 'paid') {
              badgeText = "تم تسديدها ✓";
              badgeStyle = "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
            } else if (overdue) {
              badgeText = "متأخرة ⚠️";
              badgeStyle = "bg-red-500/15 text-red-400 border-red-500/25";
            }

            const targetLabel = entity.type === 'client' ? 'حريف' : 'مورد';
            const targetColor = getClientColor(entity.color);

            return (
              <motion.div 
                variants={cardVariants}
                whileHover={{ y: -4, borderColor: 'rgba(245, 158, 11, 0.25)' }}
                key={item.id} 
                className={`group border rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all duration-300 bg-slate-900/30 backdrop-blur-sm border-slate-800/80 hover:border-slate-700/80`}
              >
                <div>
                  {/* Top layout */}
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-[9px] font-black px-2 py-0.5 rounded-full border ${badgeStyle}`}>
                      {badgeText}
                    </span>
                    
                    {/* Action buttons (pencil & bin) */}
                    <div className="flex gap-1.5 items-center no-print opacity-80 group-hover:opacity-100 transition-opacity">
                      {item.status === 'pending' && (
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="p-2 border border-slate-800 bg-slate-950/60 hover:border-amber-500/40 hover:text-amber-400 rounded-lg text-[10px] transition-colors" 
                          onClick={() => handleOpenEdit(item)}
                          title="تعديل الأجل"
                        >
                          ✏️
                        </motion.button>
                      )}
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-2 border border-slate-850 bg-slate-950/60 hover:border-red-500/40 hover:text-red-400 rounded-lg text-[10px] transition-colors" 
                        onClick={() => handleOpenDelete(item)}
                        title="حذف الأجل"
                      >
                        🗑️
                      </motion.button>
                    </div>
                  </div>

                  {/* Entity details & amount */}
                  <div className="space-y-2 text-right">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="text-sm font-black text-slate-100 group-hover:text-amber-300 transition-colors" style={{ color: targetColor }}>
                        {entity.name}
                      </span>
                      <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                        {targetLabel}
                      </span>
                    </div>

                    {/* Amount */}
                    <div className="font-mono text-lg font-black text-amber-400 pt-1">
                      {fmt(item.amount)} <span className="text-[10px] text-slate-500 font-sans font-bold">د.ت</span>
                    </div>
                    
                    {/* Due Date & remaining details */}
                    <div className="space-y-1 text-slate-400 text-xs mt-3">
                      <div className="flex items-center gap-1.5 justify-end font-semibold text-slate-300">
                        <span className="font-mono">{item.due_date}</span>
                        <span className="text-slate-500 text-[10px]">📅 تاريخ الأجل:</span>
                      </div>
                      
                      {item.notes && item.notes !== '—' && (
                        <p className="text-[10px] text-slate-500 font-medium italic border-t border-slate-800/40 pt-1.5 text-right w-full mt-2" title={item.notes}>
                          <span>📝 {item.notes}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Encaissement and WhatsApp quick actions (for pending ones) */}
                {item.status === 'pending' && (
                  <div className="flex gap-2 pt-4 mt-4 border-t border-slate-800/60">
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => onMarkAsPaid(item)}
                      className="flex-1 py-2 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-[10px] rounded-xl flex items-center justify-center gap-1 shadow shadow-emerald-500/5 transition-all"
                    >
                      <span>✓</span>
                      <span>سجل كدفع</span>
                    </motion.button>
                    {entity.phone && entity.phone !== '—' && (
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleWhatsAppReminder(item)}
                        className="p-2 border border-emerald-500/25 hover:border-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 rounded-xl transition-all"
                        title="إرسال تذكير عبر واتساب"
                      >
                        💬
                      </motion.button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* DYNAMIC MODALS */}
      {(modalMode === 'add' || modalMode === 'edit') && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <motion.div 
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl relative overflow-hidden text-right"
            onClick={(e) => e.stopPropagation()}
          >
              <h3 className="text-base md:text-lg font-black text-amber-300 border-b border-slate-800/80 pb-3 mb-5">
                {modalMode === 'add' ? "جدولة أجل دفع مالي جديد" : "تعديل موعد استحقاق الدفع"}
              </h3>
              
              <form onSubmit={modalMode === 'add' ? handleAddSubmit : handleEditSubmit} className="space-y-4">
                {modalMode === 'add' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">نوع الحساب المستهدف *</label>
                    <div className="flex gap-2">
                      <button 
                        type="button"
                        onClick={() => { setFormType('client'); setFormTargetId(state.clients[0]?.id || ''); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all ${
                          formType === 'client' 
                            ? 'bg-amber-500 text-slate-950 border-amber-500' 
                            : 'bg-transparent border-slate-800 text-slate-400'
                        }`}
                      >
                        حريف (عميل)
                      </button>
                      <button 
                        type="button"
                        disabled={!(state.suppliers && state.suppliers.length > 0)}
                        onClick={() => { setFormType('supplier'); setFormTargetId(state.suppliers[0]?.id || ''); }}
                        className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all disabled:opacity-40 ${
                          formType === 'supplier' 
                            ? 'bg-amber-500 text-slate-950 border-amber-500' 
                            : 'bg-transparent border-slate-800 text-slate-400'
                        }`}
                      >
                        مورد دواجن
                      </button>
                    </div>
                  </div>
                )}

                {modalMode === 'add' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">
                      {formType === 'client' ? "اختر الحريف *" : "اختر المورد *"}
                    </label>
                    <select
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none transition-all duration-200" 
                      value={formTargetId}
                      onChange={(e) => setFormTargetId(e.target.value)}
                      required
                    >
                      {formType === 'client' 
                        ? state.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)
                        : (state.suppliers || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                      }
                    </select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">المبلغ المستحق (د.ت) *</label>
                    <input 
                      type="number"
                      step="0.001"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 font-mono text-left" 
                      value={formAmount} 
                      onChange={(e) => setFormAmount(e.target.value)}
                      placeholder="0.000" 
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">تاريخ الاستحقاق *</label>
                    <input 
                      type="date"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 outline-none transition-all duration-200 text-left font-mono" 
                      value={formDueDate} 
                      onChange={(e) => setFormDueDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">ملاحظات أو رقم شيك/سند</label>
                  <textarea 
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 min-h-[60px] resize-y" 
                    value={formNotes} 
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="مثال: شيك بنكي رقم 98765432" 
                  />
                </div>

                <div className="flex gap-2.5 pt-4 mt-6">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit" 
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-md transition-all duration-200"
                  >
                    {modalMode === 'add' ? "حفظ وجدولة الأجل" : "حفظ التعديلات"}
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button" 
                    className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl font-bold text-xs transition-all duration-200"
                    onClick={closeModal}
                  >
                    إلغاء
                  </motion.button>
                </div>
              </form>
            </motion.div>
        </motion.div>
      )}

      {/* DELETE DEADLINE CONFIRMATION MODAL */}
      {modalMode === 'delete' && activeDeadline && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <motion.div 
            initial={{ scale: 0.95, y: 15 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl relative overflow-hidden text-right"
            onClick={(e) => e.stopPropagation()}
          >
              <h3 className="text-base md:text-lg font-black text-red-400 border-b border-slate-800/80 pb-3 mb-4">حذف أجل دفع مالي</h3>
              
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed mb-6">
                هل أنت متأكد تمامًا من إلغاء وحذف أجل الدفع الخاص بـ <strong className="text-amber-400">{getEntity(activeDeadline).name}</strong>؟<br />
                بمبلغ وقدره <strong className="text-amber-400 font-mono">{fmt(activeDeadline.amount)} د.ت</strong>.<br />
                <span className="text-red-400 font-bold block mt-1.5">⚠️ تحذير: هذا الإجراء سيقوم بحذف هذا السجل نهائيًا دون التأثير على حسابات الأرصدة الحالية.</span>
              </p>
              
              <div className="flex gap-2.5">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all duration-200" 
                  onClick={handleDeleteConfirm}
                >
                  نعم، احذف الأجل
                </motion.button>
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl font-bold text-xs transition-all duration-200"
                  onClick={closeModal}
                >
                  إلغاء التراجع
                </motion.button>
              </div>
            </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
}
