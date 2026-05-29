import React, { useState } from 'react';
import { MONTHS, getRows, getTotals, calcBalance, fmt } from '../js/utils';

export default function InvoicePrint({ state, clientId, onClose }) {
  const [printMode, setPrintMode] = useState('a4'); // 'a4' or 'thermal'
  const [pdfLoading, setPdfLoading] = useState(false);
  const y = state.year;
  const m = state.month;
  
  const cl = state.clients.find(x => x.id === clientId);
  if (!cl) return null;

  const rows = getRows(state.ledger, cl.id, y, m);
  const totals = getTotals(state.ledger, cl.id, y, m);
  
  // Tunisian tax stamp is exactly 1.000 Dinar for printed invoices where transactions exist
  const timbreFiscal = totals.amt > 0 ? 1.000 : 0.000;
  const totalTTC = totals.amt > 0 ? totals.amt + timbreFiscal : 0.000;
  const remainingTTC = totalTTC - totals.paid;

  // Filter only days with active transactions
  const activeRows = rows.filter(r => r.tw || r.nw || r.amt || r.paid || r.holiday);

  // Auto-generate professional billing serial number
  const invoiceNumber = `FAC-${y}${String(m).padStart(2, '0')}-${String(cl.id).slice(-4).padStart(4, '0')}`;
  
  const issueDate = new Date().toLocaleDateString('ar-TN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const handleExportPDF = async () => {
    setPdfLoading(true);
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const selector = printMode === 'a4' ? '.a4-print-sheet' : '.thermal-print-sheet';
      const element = document.querySelector(selector);
      if (!element) throw new Error("Target sheet not found");

      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      let pdf;

      if (printMode === 'a4') {
        pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
      } else {
        const imgWidth = 58;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf = new jsPDF('p', 'mm', [imgWidth, imgHeight + 4]);
        pdf.addImage(imgData, 'JPEG', 0, 2, imgWidth, imgHeight);
      }

      const fileName = `dawajin_pro_${invoiceNumber}.pdf`;
      pdf.save(fileName);
    } catch (err) {
      console.error("Failed to generate PDF:", err);
      alert("فشل في توليد ملف PDF. يرجى المحاولة لاحقاً.");
    } finally {
      setPdfLoading(false);
    }
  };

  const handleShareWhatsApp = () => {
    // Format phone number
    let phoneDigits = cl.phone ? cl.phone.replace(/[^0-9+]/g, '') : '';
    
    // Strip leading 00 if present
    if (phoneDigits.startsWith('00')) {
      phoneDigits = phoneDigits.substring(2);
    }
    
    // If it's a standard local Tunisian number of 8 digits, prepend country code
    if (phoneDigits && !phoneDigits.startsWith('+') && !phoneDigits.startsWith('216') && phoneDigits.length === 8) {
      phoneDigits = '216' + phoneDigits;
    }
    
    // Strip starting + for WhatsApp API format
    if (phoneDigits.startsWith('+')) {
      phoneDigits = phoneDigits.substring(1);
    }

    const monthName = MONTHS.at(m - 1);
    const messageText = `*🐔 الودرني للدواجن — خلاصة الفاتورة*
----------------------------------------
👤 *الحريف:* ${cl.name}
📄 *رقم الفاتورة:* ${invoiceNumber}
📅 *الفترة:* ${monthName} ${y}
----------------------------------------
⚖️ *إجمالي الوزن الصافي:* ${Math.round(totals.nw)} كغ
💰 *المجموع الصافي (HT):* ${fmt(totals.amt)} د.ت
💸 *معلوم الطابع الجبائي:* ${fmt(timbreFiscal)} د.ت
💳 *المجموع الإجمالي (TTC):* ${fmt(totalTTC)} د.ت
----------------------------------------
✅ *إجمالي المدفوعات:* ${fmt(totals.paid)} د.ت
⚠️ *الصافي المتبقي للدفع:* ${fmt(remainingTTC)} د.ت
----------------------------------------
🤝 شكراً لتعاملكم معنا، ثقتكم سر نجاح مبيعاتنا!`;

    // Use api.whatsapp.com/send?phone=... which bypasses contact-saving restrictions and opens direct chat
    const url = `https://api.whatsapp.com/send?phone=${phoneDigits}&text=${encodeURIComponent(messageText)}`;
    window.open(url, '_blank');
  };

  const showLocalToast = (msg, type = "success") => {
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

  const handleWebShare = async () => {
    const monthName = MONTHS.at(m - 1);
    const messageText = `🐔 الودرني للدواجن — خلاصة الفاتورة
----------------------------------------
👤 الحريف: ${cl.name}
📄 رقم الفاتورة: ${invoiceNumber}
📅 الفترة: ${monthName} ${y}
----------------------------------------
⚖️ إجمالي الوزن الصافي: ${Math.round(totals.nw)} كغ
💰 المجموع الصافي (HT): ${fmt(totals.amt)} د.ت
💸 معلوم الطابع الجبائي: ${fmt(timbreFiscal)} د.ت
💳 المجموع الإجمالي (TTC): ${fmt(totalTTC)} د.ت
----------------------------------------
✅ إجمالي المدفوعات: ${fmt(totals.paid)} د.ت
⚠️ الصافي المتبقي للدفع: ${fmt(remainingTTC)} د.ت
----------------------------------------
🤝 شكراً لتعاملكم معنا، ثقتكم سر نجاح مبيعاتنا!`;

    if (navigator.share && navigator.canShare && navigator.canShare({ text: messageText })) {
      try {
        await navigator.share({
          title: `فاتورة الودرني للدواجن - ${invoiceNumber}`,
          text: messageText
        });
        showLocalToast("✓ تم مشاركة الفاتورة بنجاح");
      } catch (err) {
        if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
          console.error("Web Share failed:", err);
          fallbackCopyToClipboard(messageText);
        }
      }
    } else {
      fallbackCopyToClipboard(messageText);
    }
  };

  const fallbackCopyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        showLocalToast("✓ تم نسخ خلاصة الفاتورة إلى الحافظة!");
      })
      .catch((err) => {
        console.error("Clipboard copy failed:", err);
        alert("فشل نسخ الفاتورة. يرجى نسخها يدوياً.");
      });
  };


  return (
    <div id="print-invoice-area" style={{ 
      display: 'block', 
      position: 'fixed', 
      inset: 0, 
      background: 'rgba(10, 15, 29, 0.95)', 
      backdropFilter: 'blur(10px)', 
      zIndex: 9999, 
      overflowY: 'auto', 
      padding: '40px 20px' 
    }}>
      {/* TABS SELECTOR (no-print) */}
      <div className="no-print" style={{ 
        maxWidth: '850px', 
        width: '100%',
        margin: '0 auto 15px auto', 
        display: 'flex', 
        justifyContent: 'center', 
        gap: '8px',
        background: 'var(--bg2)',
        border: '1.5px solid var(--border)',
        padding: '6px',
        borderRadius: '12px',
        boxShadow: 'var(--shadow)'
      }}>
        <button 
          className={`btn btn-sm ${printMode === 'a4' ? 'btn-gold' : 'btn-outline'}`}
          onClick={() => setPrintMode('a4')}
          style={{ fontWeight: '700', flex: 1, height: '36px' }}
        >
          📄 فاتورة A4 قياسية
        </button>
        <button 
          className={`btn btn-sm ${printMode === 'thermal' ? 'btn-gold' : 'btn-outline'}`}
          onClick={() => setPrintMode('thermal')}
          style={{ fontWeight: '700', flex: 1, height: '36px' }}
        >
          🖨️ وصل حراري (58mm)
        </button>
      </div>

      {printMode === 'a4' ? (
        <div style={{ 
          direction: 'rtl', 
          fontFamily: "'IBM Plex Sans Arabic', sans-serif", 
          padding: '35px', 
          color: '#1e293b', 
          background: '#ffffff', 
          borderRadius: '16px', 
          border: '1px solid #e2e8f0', 
          maxWidth: '850px', 
          margin: '0 auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          position: 'relative'
        }} className="a4-print-sheet">
          
          {/* TOP COMPLIANT DECORATOR */}
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            height: '6px', 
            background: 'linear-gradient(90deg, #d4a843 0%, #f59e0b 50%, #d4a843 100%)',
            borderRadius: '16px 16px 0 0'
          }}></div>

          {/* Invoice Header */}
          <div className="invoice-header" style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            borderBottom: '2.5px solid #d4a843', 
            paddingBottom: '20px', 
            marginBottom: '25px',
            marginTop: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <img 
                src="/poultry-ledger/assets/icon.svg" 
                alt={state.companyInfo?.name || "الودرني للدواجن"} 
                style={{ 
                  width: '72px', 
                  height: '72px', 
                  borderRadius: '16px', 
                  objectFit: 'contain', 
                  border: '2px solid #d4a843', 
                  background: '#ffffff',
                  padding: '4px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.05)'
                }}
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div>
                <h1 style={{ fontSize: '26px', fontWeight: '800', color: '#b45309', margin: 0 }}>
                  {state.companyInfo?.name || "الودرني للدواجن"}
                </h1>
                <p style={{ fontSize: '13px', color: '#475569', margin: '4px 0 0 0', fontWeight: '600' }}>
                  🏢 {state.companyInfo?.address || "وادي النور الحامة,قابس"}
                </p>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                  📞 الهاتف: <span dir="ltr">{state.companyInfo?.phone || "96 101 651"}</span>
                </p>
                {(state.companyInfo?.taxId || "1895235/E") !== '—' && (
                  <p style={{ fontSize: '11px', color: '#b45309', margin: '2px 0 0 0', fontWeight: '700' }}>
                    🆔 المعرف الجبائي (M.F.): <span dir="ltr">{state.companyInfo?.taxId || "1895235/E"}</span>
                  </p>
                )}
              </div>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {/* DIGITAL QR CODE EMBED */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }} className="no-print">
                <svg viewBox="0 0 100 100" width="64" height="64" style={{ border: '1px solid #cbd5e1', padding: '4px', borderRadius: '8px', background: '#fff' }}>
                  <rect x="5" y="5" width="22" height="22" fill="none" stroke="#1e293b" strokeWidth="4" />
                  <rect x="10" y="10" width="12" height="12" fill="#1e293b" />
                  <rect x="73" y="5" width="22" height="22" fill="none" stroke="#1e293b" strokeWidth="4" />
                  <rect x="78" y="10" width="12" height="12" fill="#1e293b" />
                  <rect x="5" y="73" width="22" height="22" fill="none" stroke="#1e293b" strokeWidth="4" />
                  <rect x="10" y="78" width="12" height="12" fill="#1e293b" />
                  <path d="M 38 10 H 48 V 20 H 38 Z M 43 25 H 53 V 35 H 43 Z M 15 40 H 25 V 50 H 15 Z M 35 45 H 65 V 55 H 35 Z M 10 55 H 20 V 65 H 10 Z M 55 65 H 75 V 75 H 55 Z M 45 80 H 65 V 90 H 45 Z M 80 40 H 90 V 60 H 80 Z M 80 73 H 90 V 83 H 80 Z" fill="#1e293b" />
                </svg>
                <span style={{ fontSize: '9px', color: '#64748b', fontWeight: '700' }}>تحقق رقمي</span>
              </div>
              
              <div style={{ textAlign: 'left' }}>
                <span style={{ 
                  background: 'rgba(180, 83, 9, 0.1)', 
                  color: '#b45309', 
                  fontSize: '11px', 
                  fontWeight: '800', 
                  padding: '4px 10px', 
                  borderRadius: '20px', 
                  display: 'inline-block',
                  marginBottom: '6px'
                }}>
                  فاتورة تجارية قانونية
                </span>
                <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#1e293b', margin: 0 }}>
                  {invoiceNumber}
                </h2>
                <p style={{ fontSize: '12px', color: '#475569', margin: '4px 0 0 0', fontWeight: '500' }}>
                  تاريخ الإصدار: {issueDate}
                </p>
                <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>
                  الفترة الحسابية: {MONTHS.at(m - 1)} {y}
                </p>
              </div>
            </div>
          </div>
          
          {/* Customer Details Block */}
          <div style={{ 
            background: '#f8fafc', 
            borderRadius: '12px', 
            padding: '20px', 
            marginBottom: '25px', 
            border: '1px solid #e2e8f0',
            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
          }}>
            <h3 style={{ fontSize: '14px', color: '#b45309', margin: '0 0 12px 0', fontWeight: '800', borderBottom: '1px dashed #cbd5e1', paddingBottom: '6px' }}>
              👤 بيانات ومراجع الحريف الجبائية:
            </h3>
            <table className="invoice-meta-table" style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr>
                  <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '600', width: '110px', color: '#475569' }}>الاسم واللقب (Client):</td>
                  <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '700', color: '#1e293b', fontSize: '14px' }}>{cl.name}</td>
                  <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '600', width: '110px', color: '#475569' }}>رقم الهاتف (Tel):</td>
                  <td style={{ textAlign: 'right', padding: '6px 0', color: '#1e293b', fontWeight: '600' }}><span dir="ltr">{cl.phone}</span></td>
                </tr>
                <tr>
                  <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '600', color: '#475569' }}>المقر (Adresse):</td>
                  <td style={{ textAlign: 'right', padding: '6px 0', color: '#1e293b' }}>{cl.address}</td>
                  <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '600', color: '#475569' }}>سعر الكيلو الافتراضي:</td>
                  <td style={{ textAlign: 'right', padding: '6px 0', color: '#b45309', fontWeight: '700' }}>{fmt(state.pricePerKg)} د.ت</td>
                </tr>
                {cl.taxId && cl.taxId !== '—' && (
                  <tr>
                    <td style={{ textAlign: 'right', padding: '6px 0', fontWeight: '600', color: '#475569' }}>المعرف الجبائي (M.F.):</td>
                    <td colSpan="3" style={{ textAlign: 'right', padding: '6px 0', color: '#1e293b', fontWeight: '800', letterSpacing: '0.5px' }}>
                      <span dir="ltr">{cl.taxId}</span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          {/* Ledger Items Table */}
          <div className="invoice-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '30px' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', borderBottom: '2.5px solid #d4a843' }}>
                <th style={{ padding: '12px 8px', textAlign: 'center', color: '#b45309', fontWeight: '800' }}>التاريخ</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', color: '#b45309', fontWeight: '800' }}>الوزن الصافي (كغ)</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', color: '#b45309', fontWeight: '800' }}>السعر (د.ت)</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', color: '#b45309', fontWeight: '800' }}>المجموع (HT)</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', color: '#b45309', fontWeight: '800' }}>المدفوع الجاري</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', color: '#b45309', fontWeight: '800' }}>الباقي</th>
                <th style={{ padding: '12px 8px', textAlign: 'center', color: '#b45309', fontWeight: '800' }}>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.length === 0 ? (
                <tr>
                  <td colSpan="7" style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    لا توجد أي معاملات مسجلة في هذه الفترة الحسابية.
                  </td>
                </tr>
              ) : (
                activeRows.map((r, idx) => {
                  const bal = calcBalance(r);
                  const dateStr = `${y}/${String(m).padStart(2, "0")}/${String(r.d).padStart(2, "0")}`;
                  if (r.holiday) {
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: '#fffbeb' }}>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b', fontWeight: '600' }}>{dateStr}</td>
                        <td colSpan="5" style={{ padding: '10px 8px', textAlign: 'center', color: '#ea580c', fontWeight: '800', fontSize: '13px' }}>— عطلة إسبوعية / رسمية —</td>
                        <td style={{ padding: '10px 8px', textAlign: 'center', color: '#64748b', fontStyle: 'italic' }}>{r.notes || ""}</td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 1 ? '#f8fafc' : '' }}>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '600' }}>{dateStr}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.nw || 0}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#b45309', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{r.price || state.pricePerKg}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '700', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{fmt(r.amt) || "0"}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#16a34a', fontWeight: '700', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{fmt(r.paid) || "—"}</td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', fontWeight: '700', color: bal > 0 ? '#dc2626' : '#64748b', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                        {r.amt ? fmt(bal) : "—"}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'center', color: '#475569' }}>{r.notes || ""}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
            </table>
          </div>
          
          {/* Professional Tunisian Invoice Footer Calculations */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '35px', flexWrap: 'wrap', gap: '20px' }}>
            {/* LEGAL TERMS BLOCK */}
            <div style={{ flex: 1, minWidth: '280px', fontSize: '11px', color: '#64748b', lineHeight: '1.7', background: '#fafafa', padding: '15px', borderRadius: '8px', border: '1px solid #f1f5f9' }}>
              <span style={{ fontWeight: '800', color: '#475569', display: 'block', marginBottom: '6px' }}>ℹ️ شروط وإحاطة قانونية:</span>
              * الأداء على القيمة المضافة (TVA): **معفى / معفاة** بموجب القوانين المنظمة للقطاع الفلاحي في تونس.
              <br />
              * الطابع الجبائي قانوني ومحتسب بـ **1.000 د.ت** على جميع الفواتير الصادرة للمهنيين.
              <br />
              * يرجى تسديد المبلغ المتبقي المستحق في الآجال المحاسبية المتفق عليها مسبقاً.
            </div>

            <div className="invoice-summary-card" style={{ width: '330px', background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '12px', padding: '15px' }}>
              <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 0', color: '#475569', fontWeight: '600' }}>المجموع الصافي الإجمالي (HT):</td>
                    <td style={{ padding: '8px 0', textAlign: 'left', fontWeight: '700', color: '#1e293b', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{fmt(totals.amt)} د.ت</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '8px 0', color: '#475569' }}>الأداء على القيمة المضافة (TVA):</td>
                    <td style={{ padding: '8px 0', textAlign: 'left', fontWeight: '700', color: '#64748b' }}>معفى (0%)</td>
                  </tr>
                  <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                    <td style={{ padding: '8px 0', color: '#475569' }}>معلوم الطابع الجبائي (Timbre):</td>
                    <td style={{ padding: '8px 0', textAlign: 'left', fontWeight: '700', color: '#b45309', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{fmt(timbreFiscal)} د.ت</td>
                  </tr>
                  <tr style={{ borderBottom: '1px solid #e2e8f0', background: 'rgba(212, 168, 67, 0.05)' }}>
                    <td style={{ padding: '10px 0', color: '#b45309', fontWeight: '800', fontSize: '14px' }}>إجمالي الفاتورة المشمول (TTC):</td>
                    <td style={{ padding: '10px 0', textAlign: 'left', fontWeight: '800', color: '#b45309', fontSize: '14px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{fmt(totalTTC)} د.ت</td>
                  </tr>
                  <tr style={{ borderBottom: '1.5px solid #cbd5e1' }}>
                    <td style={{ padding: '8px 0', color: '#16a34a', fontWeight: '600' }}>إجمالي التنزيلات والوصولات:</td>
                    <td style={{ padding: '8px 0', textAlign: 'left', fontWeight: '700', color: '#16a34a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{fmt(totals.paid)} د.ت</td>
                  </tr>
                  <tr style={{ fontSize: '16px', background: remainingTTC > 0 ? 'rgba(220, 38, 38, 0.03)' : 'rgba(22, 163, 74, 0.03)' }}>
                    <td style={{ padding: '10px 0', color: remainingTTC > 0 ? '#dc2626' : '#16a34a', fontWeight: '800' }}>الصافي المتبقي للدفع (Net):</td>
                    <td style={{ padding: '10px 0', textAlign: 'left', fontWeight: '900', color: remainingTTC > 0 ? '#dc2626' : '#16a34a', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
                      {fmt(remainingTTC)} د.ت
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Hand Sign & Stamp Block */}
          <div className="invoice-signatures" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '45px', fontSize: '13px' }}>
            <div style={{ textAlign: 'center', width: '180px' }}>
              <p style={{ margin: 0, fontWeight: '700', color: '#475569' }}>✍️ إمضاء وقبول الحريف</p>
              <div style={{ height: '70px' }}></div>
              <p style={{ margin: 0, color: '#cbd5e1' }}>........................</p>
            </div>
            
            {/* PROFESSIONAL STAMP PLACEHOLDER */}
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center', 
              opacity: 0.12, 
              border: '2.5px dashed #b45309', 
              borderRadius: '50%', 
              width: '100px', 
              height: '100px',
              transform: 'rotate(-12deg)',
              padding: '5px',
              color: '#b45309',
              fontFamily: 'sans-serif',
              fontSize: '10px',
              fontWeight: 'bold',
              textAlign: 'center'
            }} className="print-stamp">
              <span>{"EL WADERNI"}</span>
              <span style={{ fontSize: '8px', borderTop: '1px solid #b45309', marginTop: '2px', paddingTop: '2px' }}>{"VOLAILLE"}</span>
            </div>

            <div style={{ textAlign: 'center', width: '180px' }}>
              <p style={{ margin: 0, fontWeight: '700', color: '#475569' }}>💼 ختم وإمضاء الإدارة</p>
              <div style={{ height: '70px' }}></div>
              <p style={{ margin: 0, color: '#cbd5e1' }}>........................</p>
            </div>
          </div>

          {/* Dynamic Watermark / Thank You Footer */}
          <div style={{ 
            borderTop: '1px dashed #cbd5e1', 
            marginTop: '35px', 
            paddingTop: '15px', 
            textAlign: 'center',
            fontSize: '12px',
            color: '#64748b',
            fontWeight: '500'
          }}>
            🤝 شكراً لتعاملكم مع مؤسستنا — ثقتكم هي سر تميزنا ونجاحنا دائماً
          </div>
        </div>
      ) : (
        /* Thermal sheet rendering */
        <div className="thermal-print-sheet" style={{
          direction: 'rtl',
          fontFamily: "'IBM Plex Sans Arabic', sans-serif",
          padding: '16px 8px',
          color: '#000000',
          background: '#ffffff',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          width: '58mm',
          maxWidth: '100%',
          margin: '0 auto',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
          position: 'relative'
        }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
            <h1 style={{ fontSize: '14px', fontWeight: '800', color: '#b45309', margin: '0 0 4px 0' }}>
              {state.companyInfo?.name || "الودرني للدواجن"}
            </h1>
            <p style={{ fontSize: '9.5px', color: '#475569', margin: '2px 0 0 0', fontWeight: '600' }}>
              🏢 {state.companyInfo?.address || "وادي النور الحامة,قابس"}
            </p>
            
            
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

          {/* Details */}
          <div style={{ fontSize: '9.5px', lineHeight: '1.6', marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>رقم الفاتورة:</span>
              <span style={{ fontWeight: '700' }}>{invoiceNumber}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>التاريخ:</span>
              <span>{issueDate}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>الفترة:</span>
              <span>{MONTHS.at(m - 1)} {y}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dotted #888', paddingTop: '4px', marginTop: '4px' }}>
              <span style={{ fontWeight: '700' }}>الحريف:</span>
              <span style={{ fontWeight: '800' }}>{cl.name}</span>
            </div>
            {cl.phone && cl.phone !== '—' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>الهاتف:</span>
                <span dir="ltr">{cl.phone}</span>
              </div>
            )}
            {cl.address && cl.address !== '—' && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>العنوان:</span>
                <span>{cl.address}</span>
              </div>
            )}
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

          {/* Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px' }}>
            <thead>
              <tr style={{ borderBottom: '1px dashed #000' }}>
                <th style={{ padding: '3px 1px', textAlign: 'right', fontWeight: '800' }}>التاريخ</th>
                <th style={{ padding: '3px 1px', textAlign: 'center', fontWeight: '800' }}>الوزن</th>
                <th style={{ padding: '3px 1px', textAlign: 'center', fontWeight: '800' }}>السعر</th>
                <th style={{ padding: '3px 1px', textAlign: 'left', fontWeight: '800' }}>المجموع</th>
              </tr>
            </thead>
            <tbody>
              {activeRows.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ padding: '10px 1px', textAlign: 'center', color: '#64748b' }}>
                    لا توجد معاملات.
                  </td>
                </tr>
              ) : (
                activeRows.map((r, idx) => {
                  const dateStr = `${String(r.d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
                  if (r.holiday) {
                    return (
                      <tr key={idx} style={{ borderBottom: '1px dotted #888' }}>
                        <td style={{ padding: '3px 1px', textAlign: 'right', color: '#64748b' }}>{dateStr}</td>
                        <td colSpan="3" style={{ padding: '3px 1px', textAlign: 'center', color: '#ea580c', fontWeight: '700' }}>— عطلة —</td>
                      </tr>
                    );
                  }
                  return (
                    <React.Fragment key={idx}>
                      <tr style={{ borderBottom: r.paid ? 'none' : '1px dotted #888' }}>
                        <td style={{ padding: '3px 1px', textAlign: 'right' }}>{dateStr}</td>
                        <td style={{ padding: '3px 1px', textAlign: 'center' }}>{r.nw || 0}</td>
                        <td style={{ padding: '3px 1px', textAlign: 'center' }}>{r.price || state.pricePerKg}</td>
                        <td style={{ padding: '3px 1px', textAlign: 'left', fontWeight: '700' }}>{fmt(r.amt) || "0"}</td>
                      </tr>
                      {r.paid && (
                        <tr style={{ borderBottom: '1px dotted #888' }}>
                          <td colSpan="4" style={{ padding: '2px 1px 4px 1px', textAlign: 'left', color: '#16a34a', fontSize: '8.5px', fontWeight: '700' }}>
                            ↳ تم دفع: {fmt(r.paid)} د.ت
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

          {/* Calculations */}
          <div style={{ fontSize: '9.5px', lineHeight: '1.6' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>إجمالي الوزن الصافي:</span>
              <span>{Math.round(totals.nw)} كغ</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>المجموع الصافي (HT):</span>
              <span>{fmt(totals.amt)} د.ت</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>معلوم الطابع الجبائي:</span>
              <span>{fmt(timbreFiscal)} د.ت</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dotted #888', paddingTop: '3px', marginTop: '3px', fontWeight: '700' }}>
              <span>إجمالي TTC:</span>
              <span>{fmt(totalTTC)} د.ت</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
              <span>إجمالي المدفوعات:</span>
              <span>{fmt(totals.paid)} د.ت</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #000', paddingTop: '4px', marginTop: '4px', fontSize: '11.5px', fontWeight: '900', color: remainingTTC > 0 ? '#dc2626' : '#16a34a' }}>
              <span>الصافي المتبقي:</span>
              <span>{fmt(remainingTTC)} د.ت</span>
            </div>
          </div>

          <div style={{ borderTop: '1px dashed #000', margin: '12px 0 8px 0' }}></div>

          {/* Simple Signature Area */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', marginTop: '10px', padding: '0 5px' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>إمضاء الحريف</p>
              <div style={{ height: '30px' }}></div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>ختم الإدارة</p>
              <div style={{ height: '30px' }}></div>
            </div>
          </div>

          <div style={{ textAlign: 'center', fontSize: '8.5px', color: '#64748b', marginTop: '15px', borderTop: '1px dotted #888', paddingTop: '8px' }}>
            🤝 شكراً لتعاملكم معنا ثقتكم سر نجاح مبيعاتنا
          </div>
        </div>
      )}

      {/* GLOBAL ACTION BUTTONS (no-print) */}
      <div className="no-print" style={{ 
        maxWidth: '850px', 
        width: '100%',
        margin: '20px auto 0 auto', 
        textAlign: 'center',
        display: 'flex',
        justifyContent: 'center',
        flexWrap: 'wrap',
        gap: '10px',
        padding: '0 10px'
      }}>
        <button 
          className="btn btn-gold" 
          onClick={() => window.print()} 
          style={{ flex: '1 1 130px', height: '40px', fontWeight: '700' }}
        >
          🖨️ طباعة الآن
        </button>
        <button 
          className="btn btn-outline" 
          onClick={handleExportPDF} 
          disabled={pdfLoading}
          style={{ 
            flex: '1 1 130px', 
            height: '40px', 
            fontWeight: '700', 
            color: 'var(--gold)', 
            borderColor: 'var(--gold)', 
            background: 'transparent' 
          }}
        >
          {pdfLoading ? "⏳ جاري التصدير..." : "📥 تصدير PDF"}
        </button>
        <button 
          className="btn btn-outline" 
          onClick={handleShareWhatsApp} 
          style={{ 
            flex: '1 1 130px', 
            height: '40px', 
            fontWeight: '700', 
            color: '#10b981', 
            borderColor: '#10b981', 
            background: 'transparent' 
          }}
        >
          🟢 مشاركة WhatsApp
        </button>
        <button 
          className="btn btn-outline" 
          onClick={handleWebShare} 
          style={{ 
            flex: '1 1 130px', 
            height: '40px', 
            fontWeight: '700', 
            color: '#3b82f6', 
            borderColor: '#3b82f6', 
            background: 'transparent' 
          }}
        >
          📲 مشاركة سريعة
        </button>
        <button 
          className="btn btn-outline" 
          onClick={onClose} 
          style={{ 
            flex: '1 1 130px', 
            height: '40px', 
            fontWeight: '700', 
            color: '#475569', 
            borderColor: '#cbd5e1', 
            background: '#ffffff' 
          }}
        >
          إلغاء وإغلاق
        </button>
      </div>
    </div>
  );
}
