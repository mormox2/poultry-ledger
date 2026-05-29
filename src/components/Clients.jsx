import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { COLORS, getTotals, fmt, getClientColor } from '../js/utils';

export default function Clients({ 
  state, 
  onSelectClient, 
  onAddClient, 
  onEditClient, 
  onDeleteClient 
}) {
  const y = state.year;
  const m = state.month;

  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState(null); // 'add', 'edit', 'delete'
  const [activeClient, setActiveClient] = useState(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formColor, setFormColor] = useState(0);
  const [formTaxId, setFormTaxId] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const filtered = useMemo(() => {
    return state.clients.filter(x => 
      !search || 
      x.name.toLowerCase().includes(search.toLowerCase()) || 
      (x.phone && x.phone.includes(search))
    );
  }, [state.clients, search]);

  // Compute VIP threshold
  const maxAmt = useMemo(() => {
    const allAmts = state.clients.map(x => getTotals(state.ledger, x.id, y, m).amt);
    return Math.max(...allAmts, 0);
  }, [state.clients, state.ledger, y, m]);

  const handleOpenAdd = () => {
    setFormName('');
    setFormAddress('');
    setFormPhone('');
    setFormColor(0);
    setFormTaxId('');
    setFormNotes('');
    setModalMode('add');
  };

  const handleOpenEdit = (cl) => {
    setActiveClient(cl);
    setFormName(cl.name);
    setFormAddress(cl.address === '—' ? '' : cl.address);
    setFormPhone(cl.phone === '—' ? '' : cl.phone);
    setFormColor(cl.color);
    setFormTaxId(cl.taxId === '—' ? '' : cl.taxId || '');
    setFormNotes(cl.notes === '—' ? '' : cl.notes || '');
    setModalMode('edit');
  };

  const handleOpenDelete = (cl) => {
    setActiveClient(cl);
    setModalMode('delete');
  };

  const closeModal = () => {
    setModalMode(null);
    setActiveClient(null);
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("الرجاء إدخال اسم الحريف");
      return;
    }
    onAddClient({
      name: formName.trim(),
      address: formAddress.trim() || "—",
      phone: formPhone.trim() || "—",
      color: formColor,
      taxId: formTaxId.trim() || "—",
      notes: formNotes.trim() || "—"
    });
    closeModal();
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("الرجاء إدخال اسم الحريف");
      return;
    }
    onEditClient({
      id: activeClient.id,
      name: formName.trim(),
      address: formAddress.trim() || "—",
      phone: formPhone.trim() || "—",
      color: formColor,
      taxId: formTaxId.trim() || "—",
      notes: formNotes.trim() || "—"
    });
    closeModal();
  };

  const handleDeleteConfirm = () => {
    onDeleteClient(activeClient.id);
    closeModal();
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
            إدارة حسابات العملاء ({state.clients.length})
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">تتبع مستحقات المشترين والموردين وتحديث بيانات الاتصال الخاصة بهم</p>
        </div>
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleOpenAdd}
          className="w-full sm:w-auto px-5 py-3 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
        >
          <span>+</span>
          <span>إضافة عميل جديد</span>
        </motion.button>
      </div>

      {/* SEARCH AND FILTERS BAR */}
      <div className="w-full max-w-md relative text-right">
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none">🔍</span>
        <input 
          type="text" 
          className="w-full bg-slate-900/50 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-3 pl-4 pr-10 text-xs text-slate-100 placeholder-slate-550 outline-none transition-all duration-200" 
          placeholder="بحث سريع عن عميل بالاسم أو الهاتف..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* CLIENT CARDS GRID */}
      {filtered.length === 0 ? (
        <div className="bg-slate-900/20 border border-slate-850 rounded-2xl p-16 text-center text-slate-500 text-xs">
          <div className="text-4xl mb-3">👥</div>
          <div>لم يتم العثور على أي حريف يطابق البحث</div>
        </div>
      ) : (
        <motion.div 
          variants={gridVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          {filtered.map(cl => {
            const t = getTotals(state.ledger, cl.id, y, m);
            const rem = t.amt - t.paid;
            
            let badges = [];
            if (t.amt > 0) {
              if (rem <= 0) {
                badges.push(
                  <span key="paid" className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-[9px] font-black px-2 py-0.5 rounded-full select-none">مخلص 💸</span>
                );
              } else {
                badges.push(
                  <span key="debt" className="bg-red-500/15 text-red-400 border border-red-500/25 text-[9px] font-black px-2 py-0.5 rounded-full select-none">مدين ⚠️</span>
                );
              }
              
              // VIP check
              if (t.amt >= maxAmt * 0.7 && t.amt > 100) {
                badges.push(
                  <span key="vip" className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black px-2 py-0.5 rounded-full select-none">كبير العملاء ⭐</span>
                );
              }
            }

            return (
              <motion.div 
                variants={cardVariants}
                whileHover={{ y: -4, borderColor: 'rgba(245, 158, 11, 0.25)' }}
                key={cl.id} 
                className={`group border rounded-2xl p-5 shadow-lg cursor-pointer flex flex-col justify-between transition-all duration-300 bg-slate-900/30 backdrop-blur-sm ${
                  cl.id === state.selectedClient ? 'border-amber-500 shadow-amber-500/5' : 'border-slate-800/80 hover:border-slate-700/80'
                }`}
                onClick={() => onSelectClient(cl.id)}
              >
                <div>
                  {/* Top layout */}
                  <div className="flex justify-between items-start mb-4">
                    <div 
                      className="w-11 h-11 rounded-full flex items-center justify-center text-lg font-black text-slate-950 shadow-md group-hover:scale-105 transition-transform"
                      style={{ background: getClientColor(cl.color) }}
                    >
                      {cl.name[0]}
                    </div>
                    
                    {/* Action buttons (pencil & bin) */}
                    <div className="flex gap-1.5 items-center no-print opacity-80 group-hover:opacity-100 transition-opacity">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="p-2 border border-slate-800 bg-slate-950/60 hover:border-amber-500/40 hover:text-amber-400 rounded-lg text-[10px] transition-colors" 
                        onClick={(e) => { e.stopPropagation(); handleOpenEdit(cl); }}
                        title="تعديل بيانات الحريف"
                      >
                        ✏️
                      </motion.button>
                      {state.clients.length > 1 && (
                        <motion.button 
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className="p-2 border border-slate-850 bg-slate-950/60 hover:border-red-500/40 hover:text-red-400 rounded-lg text-[10px] transition-colors" 
                          onClick={(e) => { e.stopPropagation(); handleOpenDelete(cl); }}
                          title="حذف الحريف نهائيًا"
                        >
                          🗑️
                        </motion.button>
                      )}
                    </div>
                  </div>

                  {/* Name and Badges */}
                  <div className="space-y-1.5 text-right">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-black text-slate-100 group-hover:text-amber-300 transition-colors" style={{ color: getClientColor(cl.color) }}>
                        {cl.name}
                      </span>
                      <div className="flex gap-1 flex-wrap">{badges}</div>
                    </div>
                    
                    {/* Address & Contacts details */}
                    <div className="space-y-1 text-slate-400 text-xs mt-3">
                      {cl.address && cl.address !== '—' && (
                        <div className="flex items-center gap-1.5 justify-end">
                          <span>{cl.address}</span>
                          <span className="text-slate-600 font-bold select-none text-[10px]">📍</span>
                        </div>
                      )}
                      
                      {cl.phone && cl.phone !== '—' && (
                        <a 
                          href={`tel:${cl.phone}`} 
                          onClick={(e) => e.stopPropagation()} 
                          className="flex items-center gap-1.5 justify-end hover:text-amber-400 transition-colors"
                        >
                          <span className="font-mono text-[11px] font-semibold">{cl.phone}</span>
                          <span className="text-slate-600 font-bold select-none text-[10px]">📞</span>
                        </a>
                      )}
                      
                      {cl.taxId && cl.taxId !== '—' && (
                        <div className="flex items-center gap-1.5 justify-end text-[10px] text-amber-500/80 font-bold">
                          <span className="font-mono">{cl.taxId}</span>
                          <span className="select-none">🆔 م.ج:</span>
                        </div>
                      )}
                      
                      {cl.notes && cl.notes !== '—' && (
                        <p className="text-[10px] text-slate-500 font-medium italic truncate mt-2 border-t border-slate-800/40 pt-1.5 text-right w-full" title={cl.notes}>
                          <span>📝 {cl.notes}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer totals layout */}
                <div className="grid grid-cols-3 gap-2 pt-3 mt-4 border-t border-slate-800/60 text-center select-none">
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold">المجموع الجملي</div>
                    <div className="text-xs font-black text-amber-400/90 font-mono mt-0.5">{fmt(t.amt) || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold">المدفوع الكلي</div>
                    <div className="text-xs font-black text-emerald-400/90 font-mono mt-0.5">{fmt(t.paid) || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-bold">الباقي بذمته</div>
                    <div className={`text-xs font-black font-mono mt-0.5 ${rem > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {rem > 0 ? fmt(rem) : '✓'}
                    </div>
                  </div>
                </div>

              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* DYNAMIC MODALS */}
      {modalMode === 'add' && (
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
              <h3 className="text-base md:text-lg font-black text-amber-300 border-b border-slate-800/80 pb-3 mb-5">إضافة عميل جديد للنظام</h3>
              
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">الاسم الكامل للعميل *</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200" 
                    value={formName} 
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="مثال: محمد بن علي" 
                    required
                    autoFocus 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">المعرف الجبائي للعميل</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 font-mono" 
                      value={formTaxId} 
                      onChange={(e) => setFormTaxId(e.target.value)}
                      placeholder="1234567/A/P/M/000" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">رقم الهاتف</label>
                    <input 
                      type="tel"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 font-mono" 
                      value={formPhone} 
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="55 xxx xxx" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">العنوان الجغرافي</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200" 
                    value={formAddress} 
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="مثال: الحامة 1" 
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">ملاحظات وشروط خاصة بالحساب</label>
                  <textarea 
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 min-h-[50px] resize-y" 
                    value={formNotes} 
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="شروط الدفع والتسليم، تصنيفات معينة، إلخ..." 
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">رمز اللون المميز للحساب</label>
                  <div className="flex gap-2 justify-start mt-2">
                    {COLORS.map((col, i) => (
                      <motion.div 
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        key={i}
                        className="w-8 h-8 rounded-full cursor-pointer shadow-md transition-all duration-150 relative" 
                        style={{ 
                          background: col,
                          border: i === formColor ? '2px solid white' : '1px solid rgba(0,0,0,0.15)',
                          boxShadow: i === formColor ? '0 0 10px rgba(255,255,255,0.3)' : 'none'
                        }} 
                        onClick={() => setFormColor(i)}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2.5 pt-4 mt-6">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit" 
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-md transition-all duration-200"
                  >
                    إضافة العميل
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

        {/* EDIT CLIENT MODAL */}
      {modalMode === 'edit' && activeClient && (
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
              <h3 className="text-base md:text-lg font-black text-amber-300 border-b border-slate-800/80 pb-3 mb-5">تعديل بيانات الحريف</h3>
              
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">الاسم الكامل للعميل *</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200" 
                    value={formName} 
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="مثال: محمد بن علي" 
                    required
                    autoFocus 
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">المعرف الجبائي للعميل</label>
                    <input 
                      type="text"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 font-mono" 
                      value={formTaxId} 
                      onChange={(e) => setFormTaxId(e.target.value)}
                      placeholder="1234567/A/P/M/000" 
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">رقم الهاتف</label>
                    <input 
                      type="tel"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 font-mono" 
                      value={formPhone} 
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="55 xxx xxx" 
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">العنوان الجغرافي</label>
                  <input 
                    type="text"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200" 
                    value={formAddress} 
                    onChange={(e) => setFormAddress(e.target.value)}
                    placeholder="مثال: الحامة 1" 
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">ملاحظات وشروط خاصة بالحساب</label>
                  <textarea 
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 min-h-[50px] resize-y" 
                    value={formNotes} 
                    onChange={(e) => setFormNotes(e.target.value)}
                    placeholder="شروط الدفع والتسليم، تصنيفات معينة، إلخ..." 
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">رمز اللون المميز للحساب</label>
                  <div className="flex gap-2 justify-start mt-2">
                    {COLORS.map((col, i) => (
                      <motion.div 
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        key={i}
                        className="w-8 h-8 rounded-full cursor-pointer shadow-md transition-all duration-150 relative" 
                        style={{ 
                          background: col,
                          border: i === formColor ? '2px solid white' : '1px solid rgba(0,0,0,0.15)',
                          boxShadow: i === formColor ? '0 0 10px rgba(255,255,255,0.3)' : 'none'
                        }} 
                        onClick={() => setFormColor(i)}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2.5 pt-4 mt-6">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit" 
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-md transition-all duration-200"
                  >
                    حفظ التعديلات
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

        {/* DELETE CLIENT CONFIRMATION MODAL */}
      {modalMode === 'delete' && activeClient && (
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
              <h3 className="text-base md:text-lg font-black text-red-400 border-b border-slate-800/80 pb-3 mb-4">تأكيد حذف الحساب نهائيًا</h3>
              
              <p className="text-xs md:text-sm text-slate-300 leading-relaxed mb-6">
                هل أنت متأكد تمامًا من حذف حساب العميل <strong className="text-amber-400">{activeClient?.name}</strong>؟<br />
                <span className="text-red-400 font-bold block mt-1.5">⚠️ تحذير: ستقوم هذه العملية بحذف جميع السجلات اليومية والمعاملات والديون المرتبطة به بشكل نهائي وغير قابل للاسترداد!</span>
              </p>
              
              <div className="flex gap-2.5">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold text-xs py-3 rounded-xl shadow-md transition-all duration-200" 
                  onClick={handleDeleteConfirm}
                >
                  نعم، حذف العميل نهائيًا
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
