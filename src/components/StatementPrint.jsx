import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { MONTHS, getRows, getTotals, calcBalance, fmt, getPreviousMonthsBalance, getCumulativeBalance } from '../js/utils';

export default function StatementPrint({ state, clientId, onClose }) {
  const currentYear = state.year;
  const currentMonth = state.month;

  // Range selectors state (default: January of current year to current month)
  const [startYear, setStartYear] = useState(currentYear);
  const [startMonth, setStartMonth] = useState(1);
  const [endYear, setEndYear] = useState(currentYear);
  const [endMonth, setEndMonth] = useState(currentMonth);
  const [pdfLoading, setPdfLoading] = useState(false);

  const cl = state.clients.find(x => x.id === clientId);
  if (!cl) return null;

  // List of all months in the selected range chronologically
  const monthsRange = useMemo(() => {
    const list = [];
    let y = startYear;
    let m = startMonth;

    while (y < endYear || (y === endYear && m <= endMonth)) {
      list.push({ year: y, month: m });
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return list;
  }, [startYear, startMonth, endYear, endMonth]);

  // Aggregate monthly data and detailed rows
  const aggregatedData = useMemo(() => {
    let prevBalance = getPreviousMonthsBalance(state.ledger, cl.id, startYear, startMonth);
    let totalSales = 0;
    let totalPaid = 0;
    let totalTw = 0;
    let totalNw = 0;
    const monthlySummaries = [];
    const allDetailedRows = [];

    monthsRange.forEach(({ year, month }) => {
      const totals = getTotals(state.ledger, cl.id, year, month);
      const rows = getRows(state.ledger, cl.id, year, month);

      totalSales += totals.amt;
      totalPaid += totals.paid;
      totalTw += totals.tw;
      totalNw += totals.nw;

      if (totals.amt > 0 || totals.paid > 0) {
        monthlySummaries.push({
          year,
          month,
          name: `${MONTHS[month - 1]} ${year}`,
          ...totals
        });
      }

      // Extract days with active transactions
      rows.forEach(r => {
        if (r.tw || r.nw || r.amt || r.paid || r.holiday) {
          allDetailedRows.push({
            year,
            month,
            dateStr: `${year}/${String(month).padStart(2, '0')}/${String(r.d).padStart(2, '0')}`,
            ...r
          });
        }
      });
    });

    const netPeriodBalance = totalSales - totalPaid;
    const finalBalance = prevBalance + netPeriodBalance;

    return {
      prevBalance,
      totalSales,
      totalPaid,
      totalTw,
      totalNw,
      monthlySummaries,
      allDetailedRows,
      finalBalance
    };
  }, [monthsRange, cl.id, state.ledger, startYear, startMonth]);

  const issueDate = new Date().toLocaleDateString('ar-TN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const statementSerial = `RELEVE-${startYear}${String(startMonth).padStart(2, '0')}-${endYear}${String(endMonth).padStart(2, '0')}-${String(cl.id).slice(-4).padStart(4, '0')}`;

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const element = document.querySelector('.statement-print-sheet');
      if (!element) throw new Error("Print sheet not found");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      pdf.save(`releve_${cl.name.replace(/\s+/g, '_')}_${startYear}_${startMonth}_to_${endYear}_${endMonth}.pdf`);
    } catch (err) {
      console.error("Failed to generate Statement PDF:", err);
      alert("فشل في توليد ملف PDF. يرجى المحاولة لاحقاً.");
    } finally {
      setPdfLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(10, 15, 29, 0.95)',
      backdropFilter: 'blur(12px)',
      zIndex: 99999,
      overflowY: 'auto',
      direction: 'rtl',
      textAlign: 'right',
      fontFamily: "'IBM Plex Sans Arabic', sans-serif",
      padding: '24px 16px'
    }}>
      {/* CONTROL ACTIONS PANEL */}
      <div style={{
        maxWidth: '820px',
        margin: '0 auto 20px auto',
        background: '#111827',
        border: '1px solid #1f2937',
        padding: '16px',
        borderRadius: '20px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.3)'
      }} className="no-print">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '900', color: '#f59e0b', margin: 0 }}>
            📑 كشف حساب عميل مفصل (Relevé de Compte Multi-Mois)
          </h2>
          <button 
            style={{ background: 'transparent', border: 'none', color: '#9ca3af', fontSize: '18px', cursor: 'pointer' }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Filters Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '12px', marginBottom: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '4px' }}>من سنة</label>
            <select style={{ width: '100%', background: '#030712', border: '1px solid #374151', borderRadius: '8px', padding: '6px', color: '#f3f4f6', fontSize: '12px' }} value={startYear} onChange={e => setStartYear(parseInt(e.target.value))}>
              <option value={currentYear}>{currentYear}</option>
              <option value={currentYear - 1}>{currentYear - 1}</option>
              <option value={currentYear - 2}>{currentYear - 2}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '4px' }}>من شهر</label>
            <select style={{ width: '100%', background: '#030712', border: '1px solid #374151', borderRadius: '8px', padding: '6px', color: '#f3f4f6', fontSize: '12px' }} value={startMonth} onChange={e => setStartMonth(parseInt(e.target.value))}>
              {MONTHS.map((mName, i) => <option key={i} value={i + 1}>{mName}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '4px' }}>إلى سنة</label>
            <select style={{ width: '100%', background: '#030712', border: '1px solid #374151', borderRadius: '8px', padding: '6px', color: '#f3f4f6', fontSize: '12px' }} value={endYear} onChange={e => setEndYear(parseInt(e.target.value))}>
              <option value={currentYear}>{currentYear}</option>
              <option value={currentYear - 1}>{currentYear - 1}</option>
              <option value={currentYear - 2}>{currentYear - 2}</option>
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '10px', fontWeight: 'bold', color: '#9ca3af', marginBottom: '4px' }}>إلى شهر</label>
            <select style={{ width: '100%', background: '#030712', border: '1px solid #374151', borderRadius: '8px', padding: '6px', color: '#f3f4f6', fontSize: '12px' }} value={endMonth} onChange={e => setEndMonth(parseInt(e.target.value))}>
              {MONTHS.map((mName, i) => <option key={i} value={i + 1}>{mName}</option>)}
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-start' }}>
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              background: 'linear-gradient(90deg, #d4a843 0%, #fbbf24 100%)',
              color: '#0f172a',
              border: 'none',
              borderRadius: '10px',
              padding: '10px 20px',
              fontSize: '12px',
              fontWeight: '900',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(245,158,11,0.2)'
            }}
            onClick={handleExportPDF}
            disabled={pdfLoading}
          >
            {pdfLoading ? "جاري التوليد..." : "📄 تصدير كملف PDF"}
          </motion.button>
          
          <button
            style={{
              background: 'transparent',
              color: '#cbd5e1',
              border: '1px solid #475569',
              borderRadius: '10px',
              padding: '10px 20px',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer'
            }}
            onClick={() => window.print()}
          >
            🖨️ طباعة فورية
          </button>
        </div>
      </div>

      {/* PRINTABLE SHEET */}
      <div style={{
        background: '#ffffff',
        color: '#0f172a',
        width: '210mm',
        minHeight: '297mm',
        margin: '0 auto',
        padding: '24px',
        boxShadow: '0 4px 30px rgba(0,0,0,0.15)',
        borderRadius: '16px',
        boxSizing: 'border-box',
        position: 'relative'
      }} className="statement-print-sheet">
        
        {/* Border header line */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '6px',
          background: 'linear-gradient(90deg, #d4a843 0%, #f59e0b 50%, #d4a843 100%)',
          borderRadius: '16px 16px 0 0'
        }}></div>

        {/* Corporate header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '2.5px solid #d4a843',
          paddingBottom: '16px',
          marginBottom: '20px',
          marginTop: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img 
              src={state.companyInfo?.invoiceLogoUrl || "/poultry-ledger/assets/icon.svg"} 
              alt={state.companyInfo?.name || "الودرني للدواجن"} 
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '12px',
                objectFit: 'contain',
                border: '2px solid #d4a843',
                background: '#ffffff',
                padding: '3px'
              }}
              onError={e => { e.target.style.display = 'none'; }}
            />
            <div>
              <h1 style={{ fontSize: '22px', fontWeight: '800', color: '#b45309', margin: 0 }}>
                {state.companyInfo?.name || "الودرني للدواجن"}
              </h1>
              <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0 0', fontWeight: '600' }}>
                🏢 {state.companyInfo?.address || "وادي النور الحامة,قابس"}
              </p>
              <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>
                📞 الهاتف: <span dir="ltr">{state.companyInfo?.phone || "96 101 651"}</span>
              </p>
            </div>
          </div>
          <div style={{ textAlign: 'left' }}>
            <span style={{ 
              background: 'rgba(180, 83, 9, 0.1)', 
              color: '#b45309', 
              fontSize: '10px', 
              fontWeight: '900', 
              padding: '3px 8px', 
              borderRadius: '20px', 
              display: 'inline-block',
              marginBottom: '4px'
            }}>
              كشف حساب مالي مفصل
            </span>
            <h2 style={{ fontSize: '16px', fontWeight: '800', color: '#1e293b', margin: 0 }}>
              {statementSerial}
            </h2>
            <p style={{ fontSize: '11px', color: '#475569', margin: '4px 0 0 0', fontWeight: '500' }}>
              تاريخ الطباعة: {issueDate}
            </p>
            <p style={{ fontSize: '11px', color: '#64748b', margin: '2px 0 0 0' }}>
              الفترة: من {MONTHS[startMonth - 1]} {startYear} إلى {MONTHS[endMonth - 1]} {endYear}
            </p>
          </div>
        </div>

        {/* Customer Information Block */}
        <div style={{ 
          background: '#f8fafc', 
          borderRadius: '12px', 
          padding: '16px', 
          marginBottom: '20px', 
          border: '1px solid #e2e8f0'
        }}>
          <h3 style={{ fontSize: '13px', color: '#b45309', margin: '0 0 10px 0', fontWeight: '800', borderBottom: '1px dashed #cbd5e1', paddingBottom: '4px' }}>
            👤 مراجع الحساب وبيانات العميل:
          </h3>
          <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: '600', width: '110px', color: '#475569' }}>اسم الحريف (Client):</td>
                <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: '700', color: '#1e293b', fontSize: '13px' }}>{cl.name}</td>
                <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: '600', width: '115px', color: '#475569' }}>رقم الهاتف (Tel):</td>
                <td style={{ textAlign: 'right', padding: '4px 0', color: '#1e293b', fontWeight: '650' }}><span dir="ltr">{cl.phone}</span></td>
              </tr>
              <tr>
                <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: '600', color: '#475569' }}>العنوان (Adresse):</td>
                <td style={{ textAlign: 'right', padding: '4px 0', color: '#1e293b' }}>{cl.address}</td>
                <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: '600', color: '#475569' }}>المعرف الجبائي (M.F.):</td>
                <td style={{ textAlign: 'right', padding: '4px 0', color: '#1e293b', fontWeight: '650' }}><span dir="ltr">{cl.taxId || '—'}</span></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Global Financial Carry-Forward Summary Box */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '10px',
          marginBottom: '20px'
        }}>
          {[
            { title: "رصيد سابق منقول", val: `${fmt(aggregatedData.prevBalance)} د.ت`, sub: "ما قبل بداية الفترة", border: "border-slate-200 text-slate-800" },
            { title: "مبيعات الفترة الجارية", val: `${fmt(aggregatedData.totalSales)} د.ت`, sub: "قيمة البضائع المسلمة", border: "border-amber-200 text-amber-600" },
            { title: "المدفوعات المستلمة", val: `${fmt(aggregatedData.totalPaid)} د.ت`, sub: "إجمالي المقبوضات النقدا", border: "border-emerald-200 text-emerald-600" },
            { title: "الرصيد الجملي المتبقي", val: `${fmt(aggregatedData.finalBalance)} د.ت`, sub: "الباقي المعلق بذمته", border: "border-rose-200 text-rose-600 bg-rose-50/20" }
          ].map((st, i) => (
            <div key={i} style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '10px', textAlign: 'center' }} className={st.border}>
              <div style={{ fontSize: '9px', fontWeight: '700', color: '#64748b', marginBottom: '4px' }}>{st.title}</div>
              <div style={{ fontSize: '13px', fontWeight: '900', fontFamily: 'monospace' }}>{st.val}</div>
              <div style={{ fontSize: '8px', color: '#64748b', marginTop: '2px' }}>{st.sub}</div>
            </div>
          ))}
        </div>

        {/* MONTHLY BREAKDOWN SUMMARY TABLE */}
        <h3 style={{ fontSize: '12px', fontWeight: '900', color: '#b45309', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          📊 خلاصة الحساب الشهرية (Monthly Summary)
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '25px' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #d4a843' }}>
              <th style={{ padding: '8px', textAlign: 'right', fontWeight: '800' }}>الشهر</th>
              <th style={{ padding: '8px', textAlign: 'center', fontWeight: '800' }}>الوزن الكامل (كغ)</th>
              <th style={{ padding: '8px', textAlign: 'center', fontWeight: '800' }}>الوزن الصافي (كغ)</th>
              <th style={{ padding: '8px', textAlign: 'center', fontWeight: '850', color: '#b45309' }}>المبلغ المبيعات</th>
              <th style={{ padding: '8px', textAlign: 'center', fontWeight: '850', color: '#10b981' }}>المدفوع الجاري</th>
              <th style={{ padding: '8px', textAlign: 'center', fontWeight: '800' }}>الرصيد الشهري</th>
            </tr>
          </thead>
          <tbody>
            {aggregatedData.monthlySummaries.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '16px', color: '#64748b', textAlign: 'center', italic: 'true' }}>لا توجد معاملات مسجلة في هذه الفترة</td>
              </tr>
            ) : (
              aggregatedData.monthlySummaries.map((mSum, i) => {
                const bal = mSum.amt - mSum.paid;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: i % 2 === 0 ? '#f8fafc' : '#ffffff' }}>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: '700' }}>{mSum.name}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace' }}>{Math.round(mSum.tw)}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace' }}>{Math.round(mSum.nw)}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#b45309' }}>{fmt(mSum.amt)}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#10b981' }}>{fmt(mSum.paid)}</td>
                    <td style={{ padding: '8px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: bal > 0.005 ? '#ef4444' : '#10b981' }}>
                      {bal > 0.005 ? `+ ${fmt(bal)}` : bal < -0.005 ? fmt(bal) : '✓ خالص'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* DETAILED ACTIVE DAYS LEDGER */}
        <h3 style={{ fontSize: '12px', fontWeight: '900', color: '#b45309', marginBottom: '10px' }}>
          📋 كشف تفصيلي بالأيام النشطة (Detailed Statement)
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #d4a843' }}>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: '800' }}>التاريخ</th>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: '800' }}>الوزن الكامل</th>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: '800' }}>الوزن الصافي</th>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: '800' }}>سعر الكيلو</th>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: '850', color: '#b45309' }}>المبلغ HT</th>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: '850', color: '#10b981' }}>المدفوع</th>
              <th style={{ padding: '6px', textAlign: 'center', fontWeight: '800' }}>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {aggregatedData.allDetailedRows.length === 0 ? (
              <tr>
                <td colSpan="7" style={{ padding: '12px', color: '#64748b', textAlign: 'center' }}>لا توجد تفاصيل نشطة مسجلة</td>
              </tr>
            ) : (
              aggregatedData.allDetailedRows.map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e2e8f0', background: r.holiday ? 'rgba(245,158,11,0.04)' : '#ffffff' }}>
                  <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '750' }}>{r.dateStr}</td>
                  {r.holiday ? (
                    <td colSpan="5" style={{ padding: '6px', textAlign: 'center', color: '#f59e0b', fontWeight: '700', italic: 'true' }}>— عطلة رسمية —</td>
                  ) : (
                    <>
                      <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace' }}>{r.tw || '—'}</td>
                      <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace' }}>{r.nw || '—'}</td>
                      <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace' }}>{r.price ? `${fmt(r.price)}` : '—'}</td>
                      <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#b45309' }}>{r.amt ? fmt(r.amt) : '—'}</td>
                      <td style={{ padding: '6px', textAlign: 'center', fontFamily: 'monospace', fontWeight: '700', color: '#10b981' }}>{r.paid ? fmt(r.paid) : '—'}</td>
                    </>
                  )}
                  <td style={{ padding: '6px', textAlign: 'right', color: '#64748b', fontSize: '9px' }}>{r.notes || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Corporate Legal Footer */}
        <div style={{ 
          marginTop: '45px', 
          borderTop: '1px solid #e2e8f0', 
          paddingTop: '20px', 
          display: 'flex', 
          justifyContent: 'space-between',
          fontSize: '11px',
          color: '#475569'
        }}>
          <div>
            <p style={{ margin: 0, fontWeight: '700' }}>إمضاء وختم المؤسسة:</p>
            <div style={{ height: '50px' }}></div>
            <p style={{ margin: 0, fontSize: '9px', color: '#94a3b8' }}>المسؤول القانوني للمزرعة</p>
          </div>
          <div style={{ textAlign: 'left', maxWidth: '300px' }}>
            <p style={{ margin: 0, fontWeight: '700' }}>ملاحظات وشروط عامة:</p>
            <p style={{ margin: '4px 0 0 0', fontSize: '9.5px', color: '#64748b', lineHeight: '1.4' }}>
              {state.companyInfo?.invoiceFooter || "تم إصدار كشف الحساب المالي آلياً بواسطة تطبيق Dawajin Pro المشفر. المبالغ الموضحة نهائية وتعتبر معتمدة قانونياً."}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
