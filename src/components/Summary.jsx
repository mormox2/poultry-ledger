import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MONTHS, getTotals, fmt, getClientColor } from '../js/utils';

export default function Summary({ state, onSelectClient, onSelectSupplier }) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const y = state.year;
  const m = state.month;

  // 1. Clients / Sales Data
  const clientRows = state.clients.map(cl => ({ 
    ...cl, 
    ...getTotals(state.ledger, cl.id, y, m) 
  }));

  const grandClient = clientRows.reduce((a, x) => ({ 
    amt: a.amt + x.amt, 
    paid: a.paid + x.paid, 
    nw: a.nw + x.nw, 
    tw: a.tw + x.tw 
  }), { amt: 0, paid: 0, nw: 0, tw: 0 });

  // 2. Suppliers / Purchases Data
  const supplierRows = (state.suppliers || []).map(sup => ({
    ...sup,
    ...getTotals(state.purchases || {}, sup.id, y, m)
  }));

  const grandSupplier = supplierRows.reduce((a, x) => ({
    amt: a.amt + x.amt,
    paid: a.paid + x.paid,
    nw: a.nw + x.nw,
    tw: a.tw + x.tw
  }), { amt: 0, paid: 0, nw: 0, tw: 0 });

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const element = document.getElementById("summary-print-area");
      if (!element) throw new Error("Target print area not found");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#0a0f1d'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      
      const fileName = `dawajin_bilan_${y}_${m}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error("Failed to generate summary PDF:", err);
      alert("فشل في توليد ملف PDF. يرجى المحاولة لاحقاً.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
      id="summary-print-area"
    >
      {/* HEADER ROW */}
      <div className="bg-slate-900/40 border border-slate-800/60 backdrop-blur-md rounded-2xl p-4 md:p-6 shadow-sm text-right flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="text-right">
          <h2 className="text-xl md:text-2xl font-black bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
            الملخص المالي الشامل — {MONTHS.at(m - 1)} {y}
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">كشف عام مجمع بمدفوعات ومبيعات وحسابات العملاء والموردين للشهر الحالي</p>
        </div>
        
        <button 
          className="btn btn-gold no-print w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border border-amber-500/30 hover:border-amber-500 transition-all duration-200 shadow-md shadow-amber-500/5"
          onClick={handleExportPDF}
          disabled={pdfLoading}
        >
          {pdfLoading ? "⏳ جاري التصدير..." : "📥 تصدير التقرير (PDF)"}
        </button>
      </div>

      {/* SECTION 1: CLIENTS SALES SUMMARY */}
      <div className="space-y-4">
        <div className="text-right">
          <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 justify-start">
            <span>📈</span>
            <span>ملخص حسابات مبيعات العملاء (المقبوضات)</span>
          </h3>
        </div>
        
        <div className="overflow-x-auto rounded-2xl border border-slate-850 shadow-xl bg-slate-900/20 backdrop-blur-sm">
          <table className="w-full border-collapse text-xs text-center">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-200">
                <th className="py-4 px-4 text-amber-500/90 font-black text-right text-[10px] tracking-wider select-none">العميل</th>
                <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">الوزن الكامل</th>
                <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">الوزن الصافي</th>
                <th className="py-4 px-3 text-amber-500/90 font-black text-[10px] tracking-wider select-none">المبلغ الجملي</th>
                <th className="py-4 px-3 text-emerald-400/90 font-black text-[10px] tracking-wider select-none">المدفوع</th>
                <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">الباقي</th>
                <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60">
              {clientRows.map((r, i) => {
                const rem = r.amt - r.paid;
                return (
                  <tr 
                    key={r.id} 
                    className={`transition-colors duration-150 cursor-pointer ${
                      i % 2 === 0 ? 'bg-slate-900/10 hover:bg-slate-900/35' : 'bg-slate-900/40 hover:bg-slate-900/50'
                    }`}
                    onClick={() => onSelectClient && onSelectClient(r.id)}
                  >
                    {/* Name and avatar info */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center gap-3 justify-start">
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-slate-950 shadow-md flex-shrink-0"
                          style={{ background: getClientColor(r.color) }}
                        >
                          {r.name[0]}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-slate-200 text-xs">{r.name}</div>
                          <div className="text-[10px] text-slate-500 font-semibold">{r.address}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3 font-mono font-medium text-slate-350">{r.tw ? Math.round(r.tw) + ' كغ' : '—'}</td>
                    <td className="py-3 px-3 font-mono font-medium text-slate-350">{r.nw ? Math.round(r.nw) + ' كغ' : '—'}</td>
                    <td className="py-3 px-3 font-mono font-extrabold text-amber-400/90">{fmt(r.amt) || '—'}</td>
                    <td className="py-3 px-3 font-mono font-semibold text-emerald-450">{fmt(r.paid) || '—'}</td>
                    <td className={`py-3 px-3 font-mono font-black ${
                      rem > 0 ? 'text-red-400' : rem < 0 ? 'text-orange-400' : 'text-slate-500'
                    }`}>
                      {rem > 0 ? fmt(rem) : rem < 0 ? 'زيادة' : '✓ خالص'}
                    </td>
                    
                    {/* Status Badge */}
                    <td className="py-3 px-3 select-none">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black border ${
                        rem <= 0 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                          : 'bg-red-500/10 border-red-500/20 text-red-400'
                      }`}>
                        {rem <= 0 ? (
                          <>
                            <span className="pulse-dot-green"></span>
                            <span>مسوّى</span>
                          </>
                        ) : (
                          <>
                            <span className="pulse-dot-red"></span>
                            <span>متبقي بذمته</span>
                          </>
                        )}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-950/90 font-black text-slate-100 border-t-2 border-amber-500 select-none">
                <td className="py-4 px-4 text-amber-400 text-xs text-right">إجمالي مبيعات الشهر</td>
                <td className="py-4 px-3 font-mono text-sm">{Math.round(grandClient.tw)} كغ</td>
                <td className="py-4 px-3 font-mono text-sm">{Math.round(grandClient.nw)} كغ</td>
                <td className="py-4 px-3 font-mono text-sm text-amber-400">{fmt(grandClient.amt) || '—'}</td>
                <td className="py-4 px-3 font-mono text-sm text-emerald-400">{fmt(grandClient.paid) || '—'}</td>
                <td className={`py-4 px-3 font-mono text-sm ${grandClient.amt - grandClient.paid > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {fmt(grandClient.amt - grandClient.paid) || '—'}
                </td>
                <td className="py-4 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* SECTION 2: SUPPLIERS PURCHASES SUMMARY */}
      <div className="space-y-4">
        <div className="text-right">
          <h3 className="text-sm font-black text-sky-300 flex items-center gap-2 justify-start">
            <span>📉</span>
            <span>ملخص حسابات مشتريات الموردين (المدفوعات)</span>
          </h3>
        </div>
        
        <div className="overflow-x-auto rounded-2xl border border-slate-850 shadow-xl bg-slate-900/20 backdrop-blur-sm">
          <table className="w-full border-collapse text-xs text-center">
            <thead>
              <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-200">
                <th className="py-4 px-4 text-sky-400/90 font-black text-right text-[10px] tracking-wider select-none">المورد</th>
                <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">الوزن الكامل</th>
                <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">الوزن الصافي</th>
                <th className="py-4 px-3 text-amber-500/90 font-black text-[10px] tracking-wider select-none">المبلغ الجملي</th>
                <th className="py-4 px-3 text-emerald-400/90 font-black text-[10px] tracking-wider select-none">المدفوع</th>
                <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">الباقي</th>
                <th className="py-4 px-3 text-slate-400 font-bold text-[10px] tracking-wider select-none">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/60">
              {supplierRows.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-8 text-slate-500 text-xs text-center">لا توجد بيانات مشتريات متاحة حاليًا</td>
                </tr>
              ) : (
                supplierRows.map((r, i) => {
                  const rem = r.amt - r.paid;
                  return (
                    <tr 
                      key={r.id} 
                      className={`transition-colors duration-150 cursor-pointer ${
                        i % 2 === 0 ? 'bg-slate-900/10 hover:bg-slate-900/35' : 'bg-slate-900/40 hover:bg-slate-900/50'
                      }`}
                      onClick={() => onSelectSupplier && onSelectSupplier(r.id)}
                    >
                      {/* Name and avatar info */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center gap-3 justify-start">
                          <div 
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-slate-950 shadow-md flex-shrink-0"
                            style={{ background: getClientColor(r.color) }}
                          >
                            {r.name[0]}
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-200 text-xs">{r.name}</div>
                            <div className="text-[10px] text-slate-500 font-semibold">{r.address}</div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono font-medium text-slate-350">{r.tw ? Math.round(r.tw) + ' كغ' : '—'}</td>
                      <td className="py-3 px-3 font-mono font-medium text-slate-350">{r.nw ? Math.round(r.nw) + ' كغ' : '—'}</td>
                      <td className="py-3 px-3 font-mono font-extrabold text-amber-400/90">{fmt(r.amt) || '—'}</td>
                      <td className="py-3 px-3 font-mono font-semibold text-emerald-450">{fmt(r.paid) || '—'}</td>
                      <td className={`py-3 px-3 font-mono font-black ${
                        rem > 0 ? 'text-red-400' : rem < 0 ? 'text-orange-400' : 'text-slate-500'
                      }`}>
                        {rem > 0 ? fmt(rem) : rem < 0 ? 'رصيد زائد' : '✓ خالص'}
                      </td>
                      
                      {/* Status Badge */}
                      <td className="py-3 px-3 select-none">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black border ${
                          rem <= 0 
                            ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                            : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                          {rem <= 0 ? (
                            <>
                              <span className="pulse-dot-green"></span>
                              <span>مسوّى</span>
                            </>
                          ) : (
                            <>
                              <span className="pulse-dot-red"></span>
                              <span>متبقي له</span>
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="bg-slate-950/90 font-black text-slate-100 border-t-2 border-amber-500 select-none">
                <td className="py-4 px-4 text-sky-400 text-xs text-right">إجمالي مشتريات الشهر</td>
                <td className="py-4 px-3 font-mono text-sm">{Math.round(grandSupplier.tw)} كغ</td>
                <td className="py-4 px-3 font-mono text-sm">{Math.round(grandSupplier.nw)} كغ</td>
                <td className="py-4 px-3 font-mono text-sm text-amber-400">{fmt(grandSupplier.amt) || '—'}</td>
                <td className="py-4 px-3 font-mono text-sm text-emerald-400">{fmt(grandSupplier.paid) || '—'}</td>
                <td className={`py-4 px-3 font-mono text-sm ${grandSupplier.amt - grandSupplier.paid > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {fmt(grandSupplier.amt - grandSupplier.paid) || '—'}
                </td>
                <td className="py-4 px-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
