import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { COLORS, getRows, getTotals, calcBalance, fmt, getClientColor, getPreviousMonthsBalance, getCumulativeBalance } from '../js/utils';

export default function Ledger({ 
  state, 
  onSelectClient, 
  onUpdateRow, 
  onSyncRow,
  onToggleHoliday, 
  onQuickSettle, 
  onExportCSV, 
  onPrintInvoice 
}) {
  const y = state.year;
  const m = state.month;
  
  const cl = state.clients.find(x => x.id === state.selectedClient) || state.clients[0];
  
  const [quickSettleOpen, setQuickSettleOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');

  // Excel-like spreadsheet keyboard navigation helper
  const focusTarget = (r, c) => {
    const el = document.querySelector(`[data-row="${r}"][data-col="${c}"]`);
    if (el) {
      el.focus();
      if (el.select) el.select();
      return true;
    }
    return false;
  };

  const handleKeyDown = (e, rowIdx, colIdx) => {
    const maxRows = rows.length;
    const maxCols = 6;

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      let r = rowIdx - 1;
      while (r >= 0) {
        if (focusTarget(r, colIdx)) break;
        r--;
      }
    } else if (e.key === 'ArrowDown' || e.key === 'Enter') {
      e.preventDefault();
      let r = rowIdx + 1;
      while (r < maxRows) {
        if (focusTarget(r, colIdx)) break;
        r++;
      }
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      let c = colIdx + 1;
      while (c < maxCols) {
        if (focusTarget(rowIdx, c)) break;
        c++;
      }
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      let c = colIdx - 1;
      while (c >= 0) {
        if (focusTarget(rowIdx, c)) break;
        c--;
      }
    }
  };

  if (!cl) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/40 border border-slate-850 rounded-2xl p-16 text-center text-slate-500 text-xs text-right max-w-md mx-auto"
      >
        <div className="text-5xl mb-4 text-center">👥</div>
        <div className="text-sm font-bold text-slate-350 text-center">لا يوجد عملاء مضافين حالياً</div>
        <div className="flex justify-center mt-6">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md"
            onClick={() => onSelectClient(null)}
          >
            إضافة عميل
          </motion.button>
        </div>
      </motion.div>
    );
  }

  const rows = getRows(state.ledger, cl.id, y, m);
  const totals = getTotals(state.ledger, cl.id, y, m);
  const remaining = totals.amt - totals.paid;
  const prevMonthsBal = getPreviousMonthsBalance(state.ledger, cl.id, y, m);
  const cumulativeBal = getCumulativeBalance(state.ledger, cl.id, y, m);
  const paidPct = totals.amt ? Math.round(totals.paid / totals.amt * 100) : 0;

  const handleQuickSettleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0) {
      alert("الرجاء إدخال مبلغ صالح");
      return;
    }
    onQuickSettle(cl.id, amt);
    setSettleAmount('');
    setQuickSettleOpen(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* CLIENT PICKER HORIZONTAL BAR */}
      <div className="bg-slate-900/20 border border-slate-850 p-3 rounded-2xl overflow-x-auto text-right">
        <div className="flex gap-2 justify-start min-w-max">
          {state.clients.map(x => (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={x.id}
              className={`px-4 py-2 rounded-xl font-bold text-xs border transition-all duration-200 ${
                x.id === cl.id 
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/10' 
                  : 'bg-slate-900/40 text-slate-400 border-slate-850 hover:border-amber-500/30 hover:text-amber-400'
              }`}
              onClick={() => onSelectClient(x.id)}
            >
              {x.name}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ACTIVE CLIENT INFORMATION WIDGET */}
      <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-5 text-right">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black text-slate-950 shadow-md"
            style={{ background: getClientColor(cl.color) }}
          >
            {cl.name[0]}
          </div>
          <div>
            <h3 className="text-base md:text-lg font-black" style={{ color: getClientColor(cl.color) }}>{cl.name}</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
              📍 {cl.address} &nbsp;•&nbsp; 📞 {cl.phone}
            </p>
          </div>
        </div>

        {state.role !== 'driver' && (
          <>
            {/* Payment bar */}
            <div className="w-full md:w-64 max-w-full">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-1.5">
                <span>نسبة تسديد الديون</span>
                <span className={paidPct >= 100 ? 'text-emerald-400' : 'text-amber-400'}>{paidPct}%</span>
              </div>
              <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden p-[1px] border border-slate-800/40">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(paidPct, 100)}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                  className={`h-full rounded-full`}
                  style={{ background: paidPct >= 100 ? '#10b981' : '#f59e0b' }}
                />
              </div>
            </div>

            {/* Settlement quick actions */}
            <div className="flex flex-col items-center sm:items-end justify-center gap-1 w-full md:w-auto">
              <div className={`text-xl md:text-2xl font-black tracking-tight font-mono ${
                cumulativeBal > 0.005 ? 'text-red-400' : cumulativeBal < -0.005 ? 'text-orange-400' : 'text-emerald-400'
              }`}>
                {fmt(cumulativeBal) || "—"}
              </div>
              <div className="text-[10px] text-slate-500 font-semibold">
                {cumulativeBal > 0.005 ? 'الحساب الجملي المتراكم' : cumulativeBal < -0.005 ? 'رصيد زائد متراكم للعميل' : 'خالص بالكامل ✓'}
              </div>
              
              {Math.abs(prevMonthsBal) > 0.005 && (
                <div className="text-[9px] text-slate-400 font-medium mt-0.5">
                  (الباقي لهذا الشهر: {fmt(remaining)} د.ت)
                </div>
              )}
              
              {cumulativeBal > 0.005 && (
                <motion.button 
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[10px] rounded-lg shadow-md transition-all duration-200 mt-1.5 no-print"
                  onClick={() => setQuickSettleOpen(true)}
                >
                  💸 تسديد سريع
                </motion.button>
              )}
            </div>
          </>
        )}
      </div>

      {/* CARRY-FORWARD BANNER */}
      {state.role !== 'driver' && prevMonthsBal > 0.005 && (
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-right">
          <div className="flex items-center gap-2">
            <span className="text-base select-none">⚠️</span>
            <div>
              <span className="text-xs font-black text-rose-350">تنبيه: يوجد ديون سابقة معلقة!</span>
              <p className="text-[10px] text-slate-400 mt-0.5">تم ترحيل مبلغ <strong>{fmt(prevMonthsBal)} د.ت</strong> من حسابات الأشهر الماضية لهذا العميل.</p>
            </div>
          </div>
          <div className="text-xs bg-rose-500/20 text-rose-300 px-3 py-1 rounded-lg font-black font-mono">
            + {fmt(prevMonthsBal)} د.ت
          </div>
        </div>
      )}

      {state.role !== 'driver' && prevMonthsBal < -0.005 && (
        <div className="bg-emerald-550/10 border border-emerald-500/20 rounded-xl p-3.5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-right">
          <div className="flex items-center gap-2">
            <span className="text-base select-none">💰</span>
            <div>
              <span className="text-xs font-black text-emerald-350 font-bold">العميل لديه رصيد دائن سابق!</span>
              <p className="text-[10px] text-slate-400 mt-0.5">العميل دفع مبالغ زائدة في الأشهر السابقة بمقدار <strong>{fmt(Math.abs(prevMonthsBal))} د.ت</strong>.</p>
            </div>
          </div>
          <div className="text-xs bg-emerald-500/20 text-emerald-350 px-3 py-1 rounded-lg font-black font-mono">
            - {fmt(Math.abs(prevMonthsBal))} د.t
          </div>
        </div>
      )}

      {/* QUICK SUB-METRICS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "الوزن الكامل الجملي", val: `${Math.round(totals.tw)} كغ`, sub: `${totals.days} يوم تسليم`, border: "border-sky-500/10 text-sky-400" },
          { label: "إجمالي الوزن الصافي", val: `${Math.round(totals.nw)} كغ`, sub: "صافي المبيعات الكلي", border: "border-emerald-500/10 text-emerald-400" },
          { label: "المبلغ الإجمالي", val: fmt(totals.amt) || "—", sub: "د.ت جمعة الفواتير", border: "border-amber-500/10 text-amber-400" },
          { label: "الباقي المعلق", val: fmt(remaining) || "—", sub: remaining > 0 ? 'دين غير خالص' : 'حساب مستقر ✓', border: remaining > 0 ? "border-red-500/10 text-red-450" : "border-emerald-500/10 text-emerald-400" }
        ].filter((_, idx) => state.role !== 'driver' || idx < 2).map((st, i) => (
          <div key={i} className={`bg-slate-900/30 backdrop-blur-sm border rounded-xl p-4 shadow-md text-right ${st.border}`}>
            <div className="text-[10px] text-slate-500 font-bold mb-1.5">{st.label}</div>
            <div className="text-lg md:text-xl font-black tracking-tight font-mono">{st.val}</div>
            <div className="text-[9px] text-slate-500 mt-1 font-semibold">{st.sub}</div>
          </div>
        ))}
      </div>

      {/* EXPORTS BAR */}
      <div className="flex justify-between items-center gap-4 flex-wrap text-right no-print">
        <div className="text-slate-400 text-xs font-semibold">سجل المعاملات اليومي لهذا الشهر</div>
        {state.role !== 'driver' && (
          <div className="flex gap-2">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-amber-500/30 text-slate-300 hover:text-amber-400 rounded-xl font-bold text-xs transition-colors" 
              onClick={onExportCSV}
            >
              📥 تصدير Excel (CSV)
            </motion.button>
            
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs rounded-xl shadow-md"
              onClick={() => onPrintInvoice(cl.id)}
            >
              📄 معاينة وطباعة الفاتورة
            </motion.button>
          </div>
        )}
      </div>

      {/* SPREADSHEET TABLE */}
      <div className="overflow-x-auto rounded-2xl border border-slate-850 shadow-xl bg-slate-900/20 backdrop-blur-sm">
        <table className="w-full border-collapse text-xs text-center">
          <thead>
            <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-200">
              <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">التاريخ</th>
              <th className="py-4 px-3 text-amber-500/90 font-black text-[10px] tracking-wider select-none">الوزن الكامل (كغ)</th>
              <th className="py-4 px-3 text-amber-500/90 font-black text-[10px] tracking-wider select-none">الوزن الصافي (كغ)</th>
              {state.role !== 'driver' && (
                <>
                  <th className="py-4 px-3 text-amber-500/90 font-black text-[10px] tracking-wider select-none">سعر 1 كغ (د.ت)</th>
                  <th className="py-4 px-3 text-amber-500/90 font-black text-[10px] tracking-wider select-none">المبلغ الجملي</th>
                  <th className="py-4 px-3 text-emerald-400/90 font-black text-[10px] tracking-wider select-none">المدفوع الكلي</th>
                  <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">الباقي الفردي</th>
                </>
              )}
              <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">ملاحظات اليوم</th>
              {state.role !== 'driver' && (
                <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none no-print">عطلة</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-900">
            {rows.map((r, idx) => {
              const bal = calcBalance(r);
              const dateStr = `${y}/${String(m).padStart(2, "0")}/${String(r.d).padStart(2, "0")}`;
              return (
                <tr 
                  key={idx} 
                  className={`transition-colors duration-150 ${
                    r.holiday 
                      ? 'bg-amber-500/5 hover:bg-amber-500/10' 
                      : idx % 2 === 0 
                        ? 'bg-slate-900/10 hover:bg-slate-900/35' 
                        : 'bg-slate-900/40 hover:bg-slate-900/50'
                  }`}
                >
                  {/* Date label */}
                  <td className="py-2.5 px-3 text-slate-500 font-bold font-mono tracking-tight text-[10px] select-none">{dateStr}</td>
                  
                  {r.holiday ? (
                    <td colSpan={state.role === 'driver' ? "2" : "6"} className="py-2.5 px-3 text-amber-500/80 font-black text-center select-none text-[11px] tracking-widest italic">— عطلة رسمية —</td>
                  ) : (
                    <>
                      {/* Total Weight */}
                      <td className="py-1 px-1.5">
                        <input 
                          type="number" 
                          inputMode="decimal"
                          className="w-16 bg-slate-950/60 border border-transparent focus:border-amber-500/50 hover:bg-slate-950 focus:bg-slate-950 rounded-lg py-1.5 px-2 text-center text-slate-200 outline-none transition-all font-mono font-bold" 
                          value={r.tw} 
                          placeholder="0"
                          onChange={(e) => onUpdateRow(idx, 'tw', e.target.value)} 
                          onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                          onBlur={() => onSyncRow && onSyncRow(idx)}
                          data-row={idx}
                          data-col={0}
                        />
                      </td>

                      {/* Net Weight */}
                      <td className="py-1 px-1.5">
                        <input 
                          type="number" 
                          inputMode="decimal"
                          id={`nw-${idx}`} 
                          className="w-16 bg-slate-950/60 border border-transparent focus:border-amber-500/50 hover:bg-slate-950 focus:bg-slate-950 rounded-lg py-1.5 px-2 text-center text-slate-200 outline-none transition-all font-mono font-bold" 
                          value={r.nw} 
                          placeholder="0"
                          onChange={(e) => onUpdateRow(idx, 'nw', e.target.value)} 
                          onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                          onBlur={() => onSyncRow && onSyncRow(idx)}
                          data-row={idx}
                          data-col={1}
                        />
                      </td>

                      {state.role !== 'driver' && (
                        <>
                          {/* Custom Price */}
                          <td className="py-1 px-1.5">
                            <input 
                              type="number" 
                              inputMode="decimal"
                              id={`price-${idx}`} 
                              className="w-16 bg-slate-950/60 border border-transparent focus:border-amber-500/50 hover:bg-slate-950 focus:bg-slate-950 rounded-lg py-1.5 px-2 text-center text-amber-400 outline-none transition-all font-mono font-bold" 
                              value={r.price || ''} 
                              placeholder={state.pricePerKg}
                              onChange={(e) => onUpdateRow(idx, 'price', e.target.value)} 
                              onKeyDown={(e) => handleKeyDown(e, idx, 2)}
                              onBlur={() => onSyncRow && onSyncRow(idx)}
                              data-row={idx}
                              data-col={2}
                            />
                          </td>

                          {/* Automatic amount */}
                          <td className="py-1 px-1.5">
                            <input 
                              type="number" 
                              inputMode="decimal"
                              id={`amt-${idx}`} 
                              className="w-20 bg-slate-950/60 border border-transparent focus:border-amber-500/50 hover:bg-slate-950 focus:bg-slate-950 rounded-lg py-1.5 px-2 text-center text-slate-200 outline-none transition-all font-mono font-bold" 
                              value={r.amt} 
                              placeholder="—"
                              onChange={(e) => onUpdateRow(idx, 'amt', e.target.value)} 
                              onKeyDown={(e) => handleKeyDown(e, idx, 3)}
                              onBlur={() => onSyncRow && onSyncRow(idx)}
                              data-row={idx}
                              data-col={3}
                            />
                          </td>

                          {/* Payment */}
                          <td className="py-1 px-1.5">
                            <input 
                              type="number" 
                              inputMode="decimal"
                              className="w-20 bg-slate-950/60 border border-transparent focus:border-amber-500/50 hover:bg-slate-950 focus:bg-slate-950 rounded-lg py-1.5 px-2 text-center text-emerald-400 outline-none transition-all font-mono font-bold" 
                              value={r.paid} 
                              placeholder="—"
                              onChange={(e) => onUpdateRow(idx, 'paid', e.target.value)} 
                              onKeyDown={(e) => handleKeyDown(e, idx, 4)}
                              onBlur={() => onSyncRow && onSyncRow(idx)}
                              data-row={idx}
                              data-col={4}
                            />
                          </td>

                          {/* Balance cell */}
                          <td className={`py-2.5 px-3 font-bold font-mono tracking-tight ${
                            bal > 0 ? 'text-red-400' : bal < 0 ? 'text-orange-400' : 'text-slate-500'
                          }`} id={`bal-${idx}`}>
                            {r.amt ? fmt(bal) : ""}
                          </td>
                        </>
                      )}
                    </>
                  )}

                  {/* Daily memo/notes */}
                  <td className="py-1 px-1.5">
                    <input 
                      type="text"
                      className="w-24 bg-slate-950/60 border border-transparent focus:border-amber-500/50 hover:bg-slate-950 focus:bg-slate-950 rounded-lg py-1.5 px-2 text-center text-slate-400 outline-none transition-all font-bold" 
                      value={r.notes || ''} 
                      placeholder="..."
                      onChange={(e) => onUpdateRow(idx, 'notes', e.target.value)} 
                      onKeyDown={(e) => handleKeyDown(e, idx, 5)}
                      onBlur={() => onSyncRow && onSyncRow(idx)}
                      data-row={idx}
                      data-col={5}
                    />
                  </td>

                  {/* Holiday toggle switch */}
                  {state.role !== 'driver' && (
                    <td className="py-2.5 px-3 no-print">
                      <motion.button 
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className={`px-3 py-1 rounded-lg font-bold text-[10px] border transition-colors ${
                          r.holiday 
                            ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-md' 
                            : 'bg-transparent border-slate-800 text-slate-400 hover:border-amber-500/40 hover:text-amber-400'
                        }`}
                        onClick={() => onToggleHoliday(idx)}
                      >
                        {r.holiday ? 'عطلة ✓' : 'عطلة'}
                      </motion.button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-950/90 font-black text-slate-100 border-t-2 border-amber-500 select-none">
              <td className="py-4 px-3 text-amber-400 text-xs">إجمالي الشهر</td>
              <td className="py-4 px-3 font-mono text-sm" id="tot-tw">{Math.round(totals.tw)}</td>
              <td className="py-4 px-3 font-mono text-sm" id="tot-nw">{Math.round(totals.nw)}</td>
              {state.role !== 'driver' && (
                <>
                  <td className="py-4 px-3"></td>
                  <td className="py-4 px-3 font-mono text-sm text-amber-400" id="tot-amt">{fmt(totals.amt) || "—"}</td>
                  <td className="py-4 px-3 font-mono text-sm text-emerald-400" id="tot-paid">{fmt(totals.paid) || "—"}</td>
                  <td className={`py-4 px-3 font-mono text-sm ${remaining > 0 ? 'text-red-400' : 'text-emerald-400'}`} id="tot-rem">{fmt(remaining) || "—"}</td>
                </>
              )}
              <td colSpan={state.role === 'driver' ? "1" : "2"} className="no-print"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* QUICK DEBT SETTLEMENT MODAL */}
      <AnimatePresence>
        {quickSettleOpen && createPortal(
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4"
            onClick={() => setQuickSettleOpen(false)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 md:p-8 shadow-2xl relative overflow-hidden text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-base md:text-lg font-black text-amber-300 border-b border-slate-800/80 pb-3 mb-4">توزيع وتسديد الديون السريع</h3>
              
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                أدخل المبلغ الإجمالي النقدي المستلم وسيتم توزيعه آلياً لتسوية ديون فواتير اليومية للعميل <strong className="text-amber-300">{cl.name}</strong> بدءًا من المعاملات الأقدم فالأحدث بشكل فوري وسلس.
              </p>

              <form onSubmit={handleQuickSettleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">مبلغ الدفع المستلم (د.ت) *</label>
                  <input 
                    type="number" 
                    step="0.001"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-sm text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 text-left font-mono" 
                    value={settleAmount} 
                    onChange={(e) => setSettleAmount(e.target.value)}
                    placeholder="مثال: 300.000" 
                    required
                    autoFocus
                  />
                </div>

                <div className="flex gap-2.5 pt-4">
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit" 
                    className="flex-1 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs py-3 rounded-xl shadow-md"
                  >
                    توزيع وتسديد
                  </motion.button>
                  <motion.button 
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="button" 
                    className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl font-bold text-xs transition-all duration-200"
                    onClick={() => setQuickSettleOpen(false)}
                  >
                    إلغاء
                  </motion.button>
                </div>
              </form>
            </motion.div>
          </motion.div>,
          document.body
        )}
      </AnimatePresence>
    </motion.div>
  );
}
