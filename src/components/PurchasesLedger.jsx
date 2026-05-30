import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { COLORS, getRows, getTotals, calcBalance, fmt, getClientColor } from '../js/utils';

export default function PurchasesLedger({ 
  state, 
  onSelectSupplier, 
  onUpdatePurchaseRow, 
  onSyncPurchaseRow,
  onTogglePurchaseHoliday, 
  onQuickPurchaseSettle, 
  onExportPurchaseCSV
}) {
  const y = state.year;
  const m = state.month;
  
  const sup = (state.suppliers || []).find(x => x.id === state.selectedSupplier) || (state.suppliers || [])[0];
  
  const [quickSettleOpen, setQuickSettleOpen] = useState(false);
  const [settleAmount, setSettleAmount] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');

  const handleFileChange = (e, rowIdx) => {
    const file = e.target.files[0];
    e.target.value = ''; // M3: Reset input to allow re-uploading same file
    if (!file) return;

    // C3: Strict MIME type validation (block SVG to prevent XSS)
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/webp', 'image/gif',
      'application/pdf'
    ];
    if (!allowedTypes.includes(file.type)) {
      alert("نوع الملف غير مدعوم. يُرجى اختيار صورة (JPG/PNG/WebP) أو ملف PDF.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      alert("حجم الملف كبير جداً. الحد الأقصى هو 5 ميغابايت.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      onUpdatePurchaseRow(rowIdx, 'invoice_url', evt.target.result);
      if (onSyncPurchaseRow) {
        onSyncPurchaseRow(rowIdx);
      }
    };
    // M2: Handle FileReader errors
    reader.onerror = () => {
      alert("فشل في قراءة الملف. يُرجى المحاولة مجدداً.");
    };
    reader.readAsDataURL(file);
  };

  // B3+C2+M4: Helper to safely convert Data URL to Blob
  const dataUrlToBlob = useCallback((dataUrl) => {
    try {
      const arr = dataUrl.split(',');
      const mimeMatch = arr[0].match(/:(.*?);/);
      const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
      const bstr = atob(arr[1]);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while (n--) { u8arr[n] = bstr.charCodeAt(n); }
      return new Blob([u8arr], { type: mime });
    } catch (err) {
      console.error('dataUrlToBlob error:', err);
      return null;
    }
  }, []);

  // B1: Helper to get file extension from MIME
  const getExtFromMime = useCallback((dataUrl) => {
    if (dataUrl.startsWith('data:application/pdf')) return 'pdf';
    if (dataUrl.startsWith('data:image/jpeg')) return 'jpg';
    if (dataUrl.startsWith('data:image/png')) return 'png';
    if (dataUrl.startsWith('data:image/webp')) return 'webp';
    if (dataUrl.startsWith('data:image/gif')) return 'gif';
    return 'bin';
  }, []);

  // B2: Close preview modal on Escape key
  useEffect(() => {
    if (!previewUrl) return;
    const handleEsc = (e) => {
      if (e.key === 'Escape') setPreviewUrl(null);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [previewUrl]);

  // Excel-like spreadsheet keyboard navigation helper
  const focusTarget = (r, c) => {
    const el = document.querySelector(`[data-prow="${r}"][data-pcol="${c}"]`);
    if (el) {
      el.focus();
      if (el.select) el.select();
      return true;
    }
    return false;
  };

  const handleKeyDown = (e, rowIdx, colIdx) => {
    const maxRows = rows.length;
    const maxCols = 5;

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

  if (!sup) {
    return (
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-slate-900/40 border border-slate-850 rounded-2xl p-16 text-center text-slate-500 text-xs text-right max-w-md mx-auto"
      >
        <div className="text-5xl mb-4 text-center">🤝</div>
        <div className="text-sm font-bold text-slate-350 text-center">لا يوجد موردون مضافون حالياً</div>
        <div className="flex justify-center mt-6">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-bold text-xs rounded-xl shadow-md"
            onClick={() => onSelectSupplier(null)}
          >
            إضافة مورد
          </motion.button>
        </div>
      </motion.div>
    );
  }

  const rows = getRows(state.purchases || {}, sup.id, y, m);
  const totals = getTotals(state.purchases || {}, sup.id, y, m);
  const remaining = totals.amt - totals.paid;
  const paidPct = totals.amt ? Math.round(totals.paid / totals.amt * 100) : 0;

  const handleQuickSettleSubmit = (e) => {
    e.preventDefault();
    const amt = parseFloat(settleAmount);
    if (!amt || amt <= 0) {
      alert("الرجاء إدخال مبلغ صالح");
      return;
    }
    onQuickPurchaseSettle(sup.id, amt);
    setSettleAmount('');
    setQuickSettleOpen(false);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* SUPPLIER PICKER HORIZONTAL BAR */}
      <div className="bg-slate-900/20 border border-slate-850 p-3 rounded-2xl overflow-x-auto text-right">
        <div className="flex gap-2 justify-start min-w-max">
          {(state.suppliers || []).map(x => (
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              key={x.id}
              className={`px-4 py-2 rounded-xl font-bold text-xs border transition-all duration-200 ${
                x.id === sup.id 
                  ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-md shadow-amber-500/10' 
                  : 'bg-slate-900/40 text-slate-400 border-slate-850 hover:border-amber-500/30 hover:text-amber-400'
              }`}
              onClick={() => onSelectSupplier(x.id)}
            >
              {x.name}
            </motion.button>
          ))}
        </div>
      </div>

      {/* ACTIVE SUPPLIER INFORMATION WIDGET */}
      <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col md:flex-row items-center justify-between gap-5 text-right">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div 
            className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black text-slate-950 shadow-md"
            style={{ background: getClientColor(sup.color) }}
          >
            {sup.name[0]}
          </div>
          <div>
            <h3 className="text-base md:text-lg font-black" style={{ color: getClientColor(sup.color) }}>{sup.name}</h3>
            <p className="text-xs text-slate-400 font-medium mt-1">
              📍 {sup.address} &nbsp;•&nbsp; 📞 {sup.phone}
            </p>
          </div>
        </div>

        {/* Payment bar */}
        <div className="w-full md:w-64 max-w-full">
          <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 mb-1.5">
            <span>نسبة تسديد الديون للمورد</span>
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
            remaining > 0 ? 'text-red-400' : remaining < 0 ? 'text-orange-400' : 'text-emerald-400'
          }`}>
            {fmt(remaining) || "—"}
          </div>
          <div className="text-[10px] text-slate-500 font-semibold">
            {remaining > 0 ? 'متبقي له بذمتنا' : remaining < 0 ? 'رصيد زائد لنا عند المورد' : 'خالص بالكامل ✓'}
          </div>
          {remaining > 0 && (
            <motion.button 
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-[10px] rounded-lg shadow-md transition-all duration-200 mt-1.5 no-print"
              onClick={() => setQuickSettleOpen(true)}
            >
              💸 تسديد سريع للمورد
            </motion.button>
          )}
        </div>
      </div>

      {/* QUICK SUB-METRICS BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: "إجمالي الوزن الصافي المشتري", val: `${Math.round(totals.nw)} كغ`, sub: "صافي المشتريات الكلي", border: "border-emerald-500/10 text-emerald-400" },
          { label: "المبلغ الإجمالي للمشتريات", val: fmt(totals.amt) || "—", sub: "د.ت جملة الفواتير", border: "border-amber-500/10 text-amber-400" },
          { label: "الباقي للمورد", val: fmt(remaining) || "—", sub: remaining > 0 ? 'دين غير خالص' : 'حساب مستقر ✓', border: remaining > 0 ? "border-red-500/10 text-red-400" : "border-emerald-500/10 text-emerald-400" }
        ].map((st, i) => (
          <div key={i} className={`bg-slate-900/30 backdrop-blur-sm border rounded-xl p-4 shadow-md text-right ${st.border}`}>
            <div className="text-[10px] text-slate-500 font-bold mb-1.5">{st.label}</div>
            <div className="text-lg md:text-xl font-black tracking-tight font-mono">{st.val}</div>
            <div className="text-[9px] text-slate-500 mt-1 font-semibold">{st.sub}</div>
          </div>
        ))}
      </div>

      {/* EXPORTS BAR */}
      <div className="flex justify-between items-center gap-4 flex-wrap text-right no-print">
        <div className="text-slate-400 text-xs font-semibold">سجل المشتريات اليومي لهذا الشهر</div>
        <div className="flex gap-2">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-4 py-2 bg-slate-900 border border-slate-800 hover:border-amber-500/30 text-slate-300 hover:text-amber-400 rounded-xl font-bold text-xs transition-colors" 
            onClick={onExportPurchaseCSV}
          >
            📥 تصدير Excel (CSV)
          </motion.button>
        </div>
      </div>

      {/* SPREADSHEET TABLE */}
      <div className="overflow-x-auto rounded-2xl border border-slate-850 shadow-xl bg-slate-900/20 backdrop-blur-sm">
        <table className="w-full border-collapse text-xs text-center">
          <thead>
            <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-200">
              <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">التاريخ</th>
              <th className="py-4 px-3 text-amber-500/90 font-black text-[10px] tracking-wider select-none">الوزن الصافي (كغ)</th>
              <th className="py-4 px-3 text-amber-500/90 font-black text-[10px] tracking-wider select-none">سعر الشراء (د.ت / كغ)</th>
              <th className="py-4 px-3 text-amber-500/90 font-black text-[10px] tracking-wider select-none">المبلغ الجملي للشراء</th>
              <th className="py-4 px-3 text-emerald-400/90 font-black text-[10px] tracking-wider select-none">المدفوع له</th>
              <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">الباقي له</th>
              <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">ملاحظات اليوم</th>
              <th className="py-4 px-3 text-amber-500/90 font-black text-[10px] tracking-wider select-none no-print">الفاتورة</th>
              <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none no-print">عطلة</th>
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
                    <td colSpan="6" className="py-2.5 px-3 text-amber-500/80 font-black text-center select-none text-[11px] tracking-widest italic">— عطلة / لا توجد مشتريات —</td>
                  ) : (
                    <>
                      {/* Net Weight */}
                      <td className="py-1 px-1.5">
                        <input 
                          type="number" 
                          inputMode="decimal"
                          className="w-16 bg-slate-950/60 border border-transparent focus:border-amber-500/50 hover:bg-slate-950 focus:bg-slate-950 rounded-lg py-1.5 px-2 text-center text-slate-200 outline-none transition-all font-mono font-bold" 
                          value={r.nw} 
                          placeholder="0"
                          onChange={(e) => onUpdatePurchaseRow(idx, 'nw', e.target.value)} 
                          onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                          onBlur={() => onSyncPurchaseRow && onSyncPurchaseRow(idx)}
                          data-prow={idx}
                          data-pcol={0}
                        />
                      </td>

                      {/* Price (Modifiable each day!) */}
                      <td className="py-1 px-1.5">
                        <input 
                          type="number" 
                          inputMode="decimal"
                          step="0.001"
                          className="w-18 bg-slate-950/60 border border-transparent focus:border-amber-500/50 hover:bg-slate-950 focus:bg-slate-950 rounded-lg py-1.5 px-2 text-center text-amber-400 outline-none transition-all font-mono font-bold" 
                          value={r.price || ''} 
                          placeholder={sup.defaultPrice || state.defaultPurchasePricePerKg || "5.200"}
                          onChange={(e) => onUpdatePurchaseRow(idx, 'price', e.target.value)} 
                          onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                          onBlur={() => onSyncPurchaseRow && onSyncPurchaseRow(idx)}
                          data-prow={idx}
                          data-pcol={1}
                        />
                      </td>

                      {/* Automatic amount */}
                      <td className="py-1 px-1.5">
                        <input 
                          type="number" 
                          inputMode="decimal"
                          className="w-20 bg-slate-950/60 border border-transparent focus:border-amber-500/50 hover:bg-slate-950 focus:bg-slate-950 rounded-lg py-1.5 px-2 text-center text-slate-200 outline-none transition-all font-mono font-bold" 
                          value={r.amt} 
                          placeholder="—"
                          onChange={(e) => onUpdatePurchaseRow(idx, 'amt', e.target.value)} 
                          onKeyDown={(e) => handleKeyDown(e, idx, 2)}
                          onBlur={() => onSyncPurchaseRow && onSyncPurchaseRow(idx)}
                          data-prow={idx}
                          data-pcol={2}
                        />
                      </td>

                      {/* Paid */}
                      <td className="py-1 px-1.5">
                        <input 
                          type="number" 
                          inputMode="decimal"
                          className="w-20 bg-slate-950/60 border border-transparent focus:border-amber-500/50 hover:bg-slate-950 focus:bg-slate-950 rounded-lg py-1.5 px-2 text-center text-emerald-400 outline-none transition-all font-mono font-bold" 
                          value={r.paid} 
                          placeholder="—"
                          onChange={(e) => onUpdatePurchaseRow(idx, 'paid', e.target.value)} 
                          onKeyDown={(e) => handleKeyDown(e, idx, 3)}
                          onBlur={() => onSyncPurchaseRow && onSyncPurchaseRow(idx)}
                          data-prow={idx}
                          data-pcol={3}
                        />
                      </td>

                      {/* Balance cell */}
                      <td className={`py-2.5 px-3 font-bold font-mono tracking-tight ${
                        bal > 0 ? 'text-red-400' : bal < 0 ? 'text-orange-400' : 'text-slate-500'
                      }`}>
                        {r.amt ? fmt(bal) : ""}
                      </td>
                    </>
                  )}

                  {/* Daily memo/notes */}
                  <td className="py-1 px-1.5">
                    <input 
                      type="text"
                      className="w-24 bg-slate-950/60 border border-transparent focus:border-amber-500/50 hover:bg-slate-950 focus:bg-slate-950 rounded-lg py-1.5 px-2 text-center text-slate-400 outline-none transition-all font-bold" 
                      value={r.notes || ''} 
                      placeholder="..."
                      onChange={(e) => onUpdatePurchaseRow(idx, 'notes', e.target.value)} 
                      onKeyDown={(e) => handleKeyDown(e, idx, 4)}
                      onBlur={() => onSyncPurchaseRow && onSyncPurchaseRow(idx)}
                      data-prow={idx}
                      data-pcol={4}
                    />
                  </td>

                  {/* Invoice file attachment */}
                  <td className="py-1 px-1.5 no-print">
                    <div className="flex items-center justify-center">
                      {!r.invoice_url ? (
                        <label className="cursor-pointer p-1.5 hover:bg-slate-800/60 rounded-xl transition-all duration-200 text-slate-500 hover:text-amber-400 flex items-center justify-center" title="إرفاق فاتورة">
                          <span className="text-sm">📎</span>
                          <input 
                            type="file" 
                            accept="image/*,application/pdf" 
                            className="hidden" 
                            onChange={(e) => handleFileChange(e, idx)} 
                          />
                        </label>
                      ) : (
                        <div className="flex items-center justify-center gap-1.5">
                          <motion.button
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition-all duration-150 flex items-center justify-center"
                            onClick={() => {
                              setPreviewUrl(r.invoice_url);
                              setPreviewTitle(`فاتورة يوم ${dateStr}`);
                            }}
                            title="عرض الفاتورة"
                          >
                            <span className="text-xs">👁️</span>
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.15 }}
                            whileTap={{ scale: 0.9 }}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all duration-150 flex items-center justify-center"
                            onClick={() => {
                              if (confirm("هل أنت متأكد من حذف هذا المرفق؟")) {
                                onUpdatePurchaseRow(idx, 'invoice_url', '');
                                if (onSyncPurchaseRow) onSyncPurchaseRow(idx);
                              }
                            }}
                            title="حذف الفاتورة"
                          >
                            <span className="text-xs">✕</span>
                          </motion.button>
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Holiday toggle switch */}
                  <td className="py-2.5 px-3 no-print">
                    <motion.button 
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`px-3 py-1 rounded-lg font-bold text-[10px] border transition-colors ${
                        r.holiday 
                          ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-md' 
                          : 'bg-transparent border-slate-800 text-slate-400 hover:border-amber-500/40 hover:text-amber-400'
                      }`}
                      onClick={() => onTogglePurchaseHoliday(idx)}
                    >
                      {r.holiday ? 'عطلة ✓' : 'عطلة'}
                    </motion.button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-950/90 font-black text-slate-100 border-t-2 border-amber-500 select-none">
              <td className="py-4 px-3 text-amber-400 text-xs">إجمالي الشهر</td>
              <td className="py-4 px-3 font-mono text-sm">{Math.round(totals.nw)}</td>
              <td className="py-4 px-3"></td>
              <td className="py-4 px-3 font-mono text-sm text-amber-400">{fmt(totals.amt) || "—"}</td>
              <td className="py-4 px-3 font-mono text-sm text-emerald-400">{fmt(totals.paid) || "—"}</td>
              <td className={`py-4 px-3 font-mono text-sm ${remaining > 0 ? 'text-red-400' : 'text-emerald-400'}`}>{fmt(remaining) || "—"}</td>
              <td colSpan="3" className="no-print"></td>
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
              <h3 className="text-base md:text-lg font-black text-amber-300 border-b border-slate-800/80 pb-3 mb-4">توزيع وتسديد الديون السريع للمورد</h3>
              
              <p className="text-xs text-slate-400 leading-relaxed mb-6">
                أدخل المبلغ الإجمالي النقدي المدفوع وسيتم توزيعه آلياً لتسوية ديون فواتير الشراء للمورد <strong className="text-amber-300">{sup.name}</strong> بدءًا من المعاملات الأقدم فالأحدث بشكل فوري.
              </p>

              <form onSubmit={handleQuickSettleSubmit} className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">مبلغ الدفع المرسل للمورد (د.ت) *</label>
                  <input 
                    type="number" 
                    step="0.001"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-sm text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 text-left font-mono" 
                    value={settleAmount} 
                    onChange={(e) => setSettleAmount(e.target.value)}
                    placeholder="مثال: 500.000" 
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
                    className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-white rounded-xl font-bold text-xs transition-all duration-200"
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

      {/* PREMIUM INVOICE PREVIEW MODAL */}
      <AnimatePresence>
        {previewUrl && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 no-print"
            onClick={() => setPreviewUrl(null)}
          >
            <motion.div 
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-3xl max-h-[85vh] p-5 shadow-2xl relative overflow-hidden flex flex-col text-right"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                <motion.button 
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-3 py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl font-bold text-xs"
                  onClick={() => setPreviewUrl(null)}
                >
                  إغلاق
                </motion.button>
                <div className="flex items-center gap-3">
                  <h3 className="text-sm md:text-base font-black text-amber-300">{previewTitle}</h3>
                  <span className="text-xl">📄</span>
                </div>
              </div>

              <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950/50 rounded-2xl p-4 min-h-[300px]">
                {previewUrl.startsWith('data:application/pdf') ? (
                  <div className="text-center space-y-4 py-8">
                    <div className="text-5xl">📕</div>
                    <div className="text-xs text-slate-400 font-bold">مستند PDF جاهز للمعاينة أو التحميل</div>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-2 mx-auto"
                      onClick={() => {
                        const blob = dataUrlToBlob(previewUrl);
                        if (blob) {
                          const blobUrl = URL.createObjectURL(blob);
                          window.open(blobUrl, '_blank');
                          // C2: Revoke Blob URL after delay to prevent memory leak
                          setTimeout(() => URL.revokeObjectURL(blobUrl), 15000);
                        } else {
                          window.open(previewUrl, '_blank');
                        }
                      }}
                    >
                      <span>فتح المستند في علامة تبويب جديدة ↗</span>
                    </motion.button>
                  </div>
                ) : (
                  <img 
                    src={previewUrl} 
                    alt="Aperçu facture" 
                    className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md"
                  />
                )}
              </div>

              <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-slate-800/80">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-350 hover:text-white rounded-xl text-xs font-bold transition-all duration-200"
                  onClick={() => {
                    // M4: Use Blob for download (Chrome blocks large Data URL downloads)
                    const blob = dataUrlToBlob(previewUrl);
                    if (blob) {
                      const blobUrl = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = blobUrl;
                      a.download = `facture-${previewTitle.replace(/\s+/g, '-')}.${getExtFromMime(previewUrl)}`;
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
                    }
                  }}
                >
                  📥 تحميل الملف
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
