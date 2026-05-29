import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MONTHS, fmt, getClientColor } from '../js/utils';

export default function CashBook({
  state,
  onAddCashEntry,
  onDeleteCashEntry
}) {
  const currentYear = state.year;
  const currentMonth = state.month;

  // Selected Day of the month to view/record transactions (default: today's day or day 1)
  const todayDay = new Date().getMonth() + 1 === currentMonth && new Date().getFullYear() === currentYear 
    ? new Date().getDate() 
    : 1;

  const [selectedDay, setSelectedDay] = useState(todayDay);
  const [modalMode, setModalMode] = useState(null); // 'add_in', 'add_out'
  const [formCategory, setFormCategory] = useState('');
  const [formAmount, setFormAmount] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // Selected Date in YYYY-MM-DD format
  const selectedDateStr = useMemo(() => {
    return `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
  }, [currentYear, currentMonth, selectedDay]);

  // Predefined categories lists with translation & icons
  const categories = {
    in: [
      { id: 'crates', label: '📦 بيع صناديق/أقفاص فارغة' },
      { id: 'capital', label: '💵 ضخ رأس مال / سلفة' },
      { id: 'other', label: '⚡ مداخيل أخرى متنوعة' }
    ],
    out: [
      { id: 'fuel', label: '⛽ وقود وتكاليف النقل' },
      { id: 'salary', label: '👥 أجور وتكلفة اليد العاملة' },
      { id: 'feed', label: '🌾 شراء علف ومستلزمات تربية' },
      { id: 'rent', label: '🏠 كراء ومصاريف قارّة' },
      { id: 'other', label: '⚙️ مصاريف تشغيلية أخرى' }
    ]
  };

  const getCategoryLabel = (type, catId) => {
    const list = categories[type] || [];
    const item = list.find(x => x.id === catId);
    return item ? item.label : '📁 أخرى';
  };

  // Helper to convert date parts to absolute date object for comparison
  const compareDateStr = (dateStr) => {
    return new Date(dateStr).getTime();
  };

  // 1. COMPUTE ALL BALANCES AND TRANSACTIONS (DYNAMIC CONSOLIDATION)
  const cashData = useMemo(() => {
    let prevBalance = 0;
    
    // Day's active lists
    const dailyInflows = [];
    const dailyOutflows = [];

    // Let's sweep through all historical transactions to build balance & filter today's row
    
    // --- PART A: Customer Payments from Ledger ---
    state.clients.forEach(cl => {
      // Loop all years/months in the ledger for this client
      Object.keys(state.ledger).forEach(key => {
        // key format: "ledger_${clientId}_${year}_${month}"
        if (key.startsWith(`ledger_${cl.id}_`)) {
          const parts = key.split('_');
          const y = parseInt(parts[2]);
          const m = parseInt(parts[3]);
          const monthRows = state.ledger[key] || [];

          monthRows.forEach(row => {
            if (row.paid > 0.005) {
              const rowDateStr = `${y}-${String(m).padStart(2, '0')}-${String(row.d).padStart(2, '0')}`;
              const rowTime = compareDateStr(rowDateStr);
              const selectedTime = compareDateStr(selectedDateStr);

              const entry = {
                id: `ledger-in-${cl.id}-${rowDateStr}`,
                source: 'ledger_client',
                title: `👥 دفعة من الحريف: ${cl.name}`,
                category: 'Client Collection',
                amount: row.paid,
                type: 'in',
                notes: row.notes || 'تسجيل تلقائي من دفتر المبيعات'
              };

              if (rowTime < selectedTime) {
                prevBalance += row.paid;
              } else if (rowDateStr === selectedDateStr) {
                dailyInflows.push(entry);
              }
            }
          });
        }
      });
    });

    // --- PART B: Supplier Payments from Purchases ---
    state.suppliers.forEach(sp => {
      Object.keys(state.purchases).forEach(key => {
        // key format: "purchases_${supplierId}_${year}_${month}"
        if (key.startsWith(`purchases_${sp.id}_`)) {
          const parts = key.split('_');
          const y = parseInt(parts[1]);
          const m = parseInt(parts[2]);
          const monthRows = state.purchases[key] || [];

          monthRows.forEach(row => {
            if (row.paid > 0.005) {
              const rowDateStr = `${y}-${String(m).padStart(2, '0')}-${String(row.d).padStart(2, '0')}`;
              const rowTime = compareDateStr(rowDateStr);
              const selectedTime = compareDateStr(selectedDateStr);

              const entry = {
                id: `purchases-out-${sp.id}-${rowDateStr}`,
                source: 'ledger_supplier',
                title: `🤝 دفعة للمورد: ${sp.name}`,
                category: 'Supplier Payment',
                amount: row.paid,
                type: 'out',
                notes: row.notes || 'تسجيل تلقائي من دفتر المشتريات'
              };

              if (rowTime < selectedTime) {
                prevBalance -= row.paid;
              } else if (rowDateStr === selectedDateStr) {
                dailyOutflows.push(entry);
              }
            }
          });
        }
      });
    });

    // --- PART C: Manual CashBook Transactions ---
    const manualEntries = state.cashBook || [];
    manualEntries.forEach(entry => {
      const entryTime = compareDateStr(entry.date);
      const selectedTime = compareDateStr(selectedDateStr);

      const consolidatedEntry = {
        id: entry.id,
        source: 'manual',
        title: entry.type === 'in' ? '📈 recette' : '📉 Dépense',
        category: getCategoryLabel(entry.type, entry.category),
        amount: entry.amount,
        type: entry.type,
        notes: entry.description
      };

      if (entryTime < selectedTime) {
        if (entry.type === 'in') {
          prevBalance += entry.amount;
        } else {
          prevBalance -= entry.amount;
        }
      } else if (entry.date === selectedDateStr) {
        if (entry.type === 'in') {
          dailyInflows.push(consolidatedEntry);
        } else {
          dailyOutflows.push(consolidatedEntry);
        }
      }
    });

    const totalSalesCollected = dailyInflows.reduce((acc, x) => acc + x.amount, 0);
    const totalExpensesPaid = dailyOutflows.reduce((acc, x) => acc + x.amount, 0);
    const finalBalance = prevBalance + totalSalesCollected - totalExpensesPaid;

    return {
      prevBalance,
      dailyInflows,
      dailyOutflows,
      totalSalesCollected,
      totalExpensesPaid,
      finalBalance
    };
  }, [state.clients, state.suppliers, state.ledger, state.purchases, state.cashBook, selectedDateStr]);

  const handleOpenAdd = (type) => {
    setFormCategory(categories[type][0].id);
    setFormAmount('');
    setFormDescription('');
    setModalMode(`add_${type}`);
  };

  const closeModal = () => {
    setModalMode(null);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const amtVal = parseFloat(formAmount);
    if (isNaN(amtVal) || amtVal <= 0) {
      alert("الرجاء إدخال مبلغ صحيح");
      return;
    }

    const type = modalMode === 'add_in' ? 'in' : 'out';
    const entryData = {
      date: selectedDateStr,
      type,
      category: formCategory,
      amount: amtVal,
      description: formDescription.trim() || "دون ملاحظات"
    };

    onAddCashEntry(entryData);
    closeModal();
  };

  const handleDelete = (id) => {
    if (confirm("هل أنت متأكد من حذف هذه المعاملة المالية اليدوية نهائيًا من الصندوق؟")) {
      onDeleteCashEntry(id);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-right"
      style={{ direction: 'rtl' }}
    >
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 border border-slate-800/60 backdrop-blur-md rounded-2xl p-4 md:p-6 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-black bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
            💵 دفتر الصندوق اليومي (Cash Book Ledger)
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">المتابعة المالية الفورية للسيولة النقدية والمصاريف التشغيلية للمزرعة</p>
        </div>
        
        {/* Quick Date Selector Slider */}
        <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-850 px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 select-none">
          <span>الـيـوم:</span>
          <select 
            className="bg-transparent text-amber-400 font-black outline-none border-none cursor-pointer"
            value={selectedDay}
            onChange={(e) => setSelectedDay(parseInt(e.target.value))}
          >
            {Array.from({ length: 31 }, (_, i) => i + 1).map(day => (
              <option key={day} value={day} className="bg-slate-950 text-slate-100">{day} / {MONTHS[currentMonth - 1]}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI TREASURY METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "📥 رصيد الصندوق الافتتاحي", val: `${fmt(cashData.prevBalance)} د.ت`, sub: "رصيد منقول من الأيام السابقة", border: "border-slate-800/80 bg-slate-900/10 text-slate-400" },
          { title: "📈 إجمالي مقبوضات اليوم (+)", val: `${fmt(cashData.totalSalesCollected)} د.ت`, sub: "دفعات العملاء + المداخيل اليدوية", border: "border-emerald-500/20 bg-emerald-950/5 text-emerald-400" },
          { title: "📉 إجمالي مصاريف اليوم (-)", val: `${fmt(cashData.totalExpensesPaid)} د.t`, sub: "دفعات الموردين + التكاليف الجارية", border: "border-rose-500/20 bg-rose-950/5 text-rose-400" },
          { title: "💰 الرصيد النقدي الحالي للسيولة", val: `${fmt(cashData.finalBalance)} د.ت`, sub: "الرصيد الفعلي المتوفر بالخزينة", border: `border-amber-500/30 bg-amber-950/5 ${cashData.finalBalance >= 0 ? 'text-amber-400' : 'text-red-400 animate-pulse'}` }
        ].map((k, i) => (
          <div key={i} className={`border rounded-2xl p-4 shadow-lg backdrop-blur-sm ${k.border} select-none`}>
            <div className="text-[10px] font-bold text-slate-500 mb-1">{k.title}</div>
            <div className="text-base md:text-lg font-black font-mono leading-tight">{k.val}</div>
            <div className="text-[8px] text-slate-500 mt-1">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* CASH ACTIONS ROW */}
      {state.role !== 'driver' && (
        <div className="flex gap-3 justify-start no-print">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenAdd('in')}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1.5"
          >
            <span>+</span>
            <span>تسجيل مداخيل / إيراد جديد</span>
          </motion.button>
          
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleOpenAdd('out')}
            className="px-4 py-2.5 bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white font-black text-xs rounded-xl shadow-md flex items-center gap-1.5"
          >
            <span>-</span>
            <span>تسجيل مصاريف / تكلفة جديدة</span>
          </motion.button>
        </div>
      )}

      {/* DETAILED DAILY JOURNAL LIST */}
      <div className="bg-slate-900/30 border border-slate-850/80 backdrop-blur-md rounded-2xl p-5 md:p-6 shadow-xl">
        <h3 className="text-sm md:text-base font-black text-amber-300 mb-4 border-b border-slate-800/80 pb-3 flex items-center justify-between">
          <span>📋 سجل حركة الصندوق ليوم: {selectedDay} / {MONTHS[currentMonth - 1]} / {currentYear}</span>
          <button 
            className="no-print border border-slate-800 text-slate-400 hover:text-slate-200 px-3 py-1 text-xs rounded-lg bg-slate-950/50"
            onClick={() => window.print()}
          >
            🖨️ طباعة
          </button>
        </h3>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-right border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                <th className="p-3 text-right font-black">المعاملة</th>
                <th className="p-3 text-center font-black">التصنيف</th>
                <th className="p-3 text-center font-black">الوارد (+)</th>
                <th className="p-3 text-center font-black">الصادر (-)</th>
                <th className="p-3 text-right font-black">ملاحظات / وصف</th>
                <th className="p-3 text-center font-black no-print">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {cashData.dailyInflows.length === 0 && cashData.dailyOutflows.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-12 text-center text-slate-500 text-xs italic">
                    📭 لا توجد أي تحركات مالية مسجلة في هذا اليوم.
                  </td>
                </tr>
              ) : (
                [...cashData.dailyInflows, ...cashData.dailyOutflows].map((item, i) => (
                  <tr 
                    key={item.id} 
                    className={`border-b border-slate-800/60 hover:bg-slate-950/20 transition-colors ${
                      item.type === 'in' ? 'bg-emerald-500/[0.01]' : 'bg-rose-500/[0.01]'
                    }`}
                  >
                    <td className="p-3 font-bold text-slate-100">{item.title}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                        item.source === 'ledger_client' 
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : item.source === 'ledger_supplier'
                            ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                            : item.type === 'in'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}>
                        {item.category}
                      </span>
                    </td>
                    <td className="p-3 text-center font-bold font-mono text-emerald-400">
                      {item.type === 'in' ? `+ ${fmt(item.amount)}` : '—'}
                    </td>
                    <td className="p-3 text-center font-bold font-mono text-rose-400">
                      {item.type === 'out' ? `- ${fmt(item.amount)}` : '—'}
                    </td>
                    <td className="p-3 text-slate-400 text-right leading-relaxed max-w-xs truncate" title={item.notes}>
                      {item.notes}
                    </td>
                    <td className="p-3 text-center no-print">
                      {item.source === 'manual' ? (
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-500/10 text-red-500/60 hover:text-red-400 border border-transparent hover:border-red-500/25 transition-all text-[11px]"
                          title="حذف المعاملة اليدوية"
                        >
                          🗑️
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-bold select-none cursor-help" title="معاملة تلقائية مأخوذة مباشرة من السجلات. لا يمكن تعديلها إلا من دفترها الخاص.">
                          🔒 تلقائي
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* QUICK ADD MODAL FORM */}
      <AnimatePresence>
        {modalMode && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
            onClick={closeModal}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl relative overflow-hidden text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className={`text-base md:text-lg font-black border-b border-slate-800/80 pb-3 mb-5 ${
                modalMode === 'add_in' ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {modalMode === 'add_in' ? '📈 إضافة وارد مالي جديد للصندوق' : '📉 تسجيل مصروف جديد من الصندوق'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">تصنيف الحركة المالية *</label>
                  <select 
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    required
                  >
                    {categories[modalMode === 'add_in' ? 'in' : 'out'].map(cat => (
                      <option key={cat.id} value={cat.id} className="bg-slate-950 text-slate-100">{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">المبلغ بالدينار التونسي (DT) *</label>
                  <input 
                    type="number"
                    step="0.005"
                    min="0.005"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 font-mono" 
                    value={formAmount} 
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="مثال: 45.500"
                    required
                    autoFocus 
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">وصف وملاحظات المعاملة</label>
                  <textarea 
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 min-h-[70px] resize-y" 
                    value={formDescription} 
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="اكتب توضيح سريع (مثال: خلاص وقود شاحنة التوزيع، أجر العامل سليم...)" 
                  />
                </div>

                <div className="flex gap-2.5 pt-4 mt-6">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit" 
                    className={`flex-1 font-bold text-xs py-3 rounded-xl shadow-md transition-all duration-200 text-slate-950 ${
                      modalMode === 'add_in'
                        ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500'
                        : 'bg-gradient-to-r from-rose-500 to-rose-600 hover:from-rose-400 hover:to-rose-500 text-white'
                    }`}
                  >
                    حفظ في الصندوق
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
      </AnimatePresence>
    </motion.div>
  );
}
