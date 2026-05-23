import React from 'react';
import { MONTHS, getRows, getTotals, calcBalance, fmt } from '../js/utils';

export default function InvoicePrint({ state, clientId, onClose }) {
  const y = state.year;
  const m = state.month;
  
  const cl = state.clients.find(x => x.id === clientId);
  if (!cl) return null;

  const rows = getRows(state.ledger, cl.id, y, m);
  const totals = getTotals(state.ledger, cl.id, y, m);
  const remaining = totals.amt - totals.paid;

  // Filter only days with actions
  const activeRows = rows.filter(r => r.tw || r.nw || r.amt || r.paid || r.holiday);

  return (
    <div id="print-invoice-area" style={{ display: 'block', position: 'fixed', inset: 0, background: 'rgba(10, 15, 29, 0.95)', backdropFilter: 'blur(10px)', zIndex: 9999, overflowY: 'auto', padding: '40px 20px' }}>
      <div style={{ direction: 'rtl', fontFamily: "'IBM Plex Sans Arabic', sans-serif", padding: '30px', color: '#1e293b', background: '#fff', borderRadius: '8px', boxShadow: 'none', border: '1px solid #e2e8f0', maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Invoice Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #b3851b', paddingBottom: '15px', marginBottom: '25px' }}>
          <div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#b3851b', margin: 0 }}>الودرني للدواجن</h1>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '3px 0 0 0' }}>بيع الدواجن بالجملة والتفصيل — الحامة، قابس</p>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '2px 0 0 0' }}>الهاتف: 55 549 457</p>
          </div>
          <div style={{ textAlign: 'left' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: '#1e293b', margin: 0 }}>فاتورة حساب شهري</h2>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '4px 0 0 0' }}>التاريخ: {new Date().toLocaleDateString('ar-TN')}</p>
            <p style={{ fontSize: '13px', color: '#64748b', margin: '2px 0 0 0' }}>الفترة: {MONTHS[m - 1]} {y}</p>
          </div>
        </div>
        
        {/* Customer Details Block */}
        <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '15px', marginBottom: '25px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ fontSize: '14px', color: '#b3851b', margin: '0 0 8px 0', fontWeight: '700' }}>بيانات الحريف:</h3>
          <table style={{ width: '100%', fontSize: '13px', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: '600', width: '90px', color: '#64748b' }}>الاسم واللقب:</td>
                <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: '700', color: '#1e293b' }}>{cl.name}</td>
                <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: '600', width: '90px', color: '#64748b' }}>الهاتف:</td>
                <td style={{ textAlign: 'right', padding: '4px 0', color: '#1e293b' }}>{cl.phone}</td>
              </tr>
              <tr>
                <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: '600', color: '#64748b' }}>العنوان:</td>
                <td style={{ textAlign: 'right', padding: '4px 0', color: '#1e293b' }}>{cl.address}</td>
                <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: '600', color: '#64748b' }}>السعر الافتراضي:</td>
                <td style={{ textAlign: 'right', padding: '4px 0', color: '#1e293b', fontWeight: '700' }}>{fmt(state.pricePerKg)} د.ت</td>
              </tr>
            </tbody>
          </table>
        </div>
        
        {/* Ledger Items Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '25px' }}>
          <thead>
            <tr style={{ background: '#ebf0f6', borderBottom: '2px solid #b3851b' }}>
              <th style={{ padding: '10px 8px', textAlign: 'center', color: '#b3851b', fontWeight: '700' }}>التاريخ</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', color: '#b3851b', fontWeight: '700' }}>الوزن الكامل (كغ)</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', color: '#b3851b', fontWeight: '700' }}>الوزن الصافي (كغ)</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', color: '#b3851b', fontWeight: '700' }}>السعر (د.ت)</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', color: '#b3851b', fontWeight: '700' }}>المبلغ الجملي</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', color: '#b3851b', fontWeight: '700' }}>المدفوع</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', color: '#b3851b', fontWeight: '700' }}>الباقي</th>
              <th style={{ padding: '10px 8px', textAlign: 'center', color: '#b3851b', fontWeight: '700' }}>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map((r, idx) => {
              const bal = calcBalance(r);
              const dateStr = `${y}/${String(m).padStart(2, "0")}/${String(r.d).padStart(2, "0")}`;
              if (r.holiday) {
                return (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: '#fef3c7' }}>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{dateStr}</td>
                    <td colSpan="6" style={{ padding: '8px', textAlign: 'center', color: '#ea580c', fontWeight: '700' }}>— عطلة —</td>
                    <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{r.notes || ""}</td>
                  </tr>
                );
              }
              return (
                <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0', background: idx % 2 === 1 ? '#f8fafc' : '' }}>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{dateStr}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{r.tw || 0}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{r.nw || 0}</td>
                  <td style={{ padding: '8px', textAlign: 'center' }}>{r.price || state.pricePerKg}</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600' }}>{fmt(r.amt) || "0"}</td>
                  <td style={{ padding: '8px', textAlign: 'center', color: '#16a34a' }}>{fmt(r.paid) || "—"}</td>
                  <td style={{ padding: '8px', textAlign: 'center', fontWeight: '600', color: bal > 0 ? '#dc2626' : '#64748b' }}>
                    {r.amt ? fmt(bal) : "—"}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{r.notes || ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        
        {/* Invoice Footer Sums */}
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '35px' }}>
          <div style={{ width: '300px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '15px', marginRight: 'auto' }}>
            <table style={{ width: '100%', fontSize: '14px', borderCollapse: 'collapse' }}>
              <tbody>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 0', color: '#64748b' }}>المبلغ الإجمالي للمشتريات:</td>
                  <td style={{ padding: '6px 0', textAlign: 'left', fontWeight: '700', color: '#1e293b' }}>{fmt(totals.amt)} د.ت</td>
                </tr>
                <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '6px 0', color: '#64748b' }}>إجمالي المدفوعات:</td>
                  <td style={{ padding: '6px 0', textAlign: 'left', fontWeight: '700', color: '#16a34a' }}>{fmt(totals.paid)} د.ت</td>
                </tr>
                <tr style={{ fontSize: '16px' }}>
                  <td style={{ padding: '8px 0', color: '#b3851b', fontWeight: '700' }}>الباقي المستحق:</td>
                  <td style={{ padding: '8px 0', textAlign: 'left', fontWeight: '800', color: remaining > 0 ? '#dc2626' : '#16a34a' }}>
                    {fmt(remaining)} د.ت
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Hand Sign Block */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '50px', fontSize: '13px' }}>
          <div style={{ textAlign: 'center', width: '150px' }}>
            <p style={{ margin: 0, fontWeight: '600', color: '#64748b' }}>إمضاء العميل</p>
            <div style={{ height: '60px' }}></div>
            <p style={{ margin: 0, color: '#cbd5e1' }}>........................</p>
          </div>
          <div style={{ textAlign: 'center', width: '150px' }}>
            <p style={{ margin: 0, fontWeight: '600', color: '#64748b' }}>خاتم وإمضاء الإدارة</p>
            <div style={{ height: '60px' }}></div>
            <p style={{ margin: 0, color: '#cbd5e1' }}>........................</p>
          </div>
        </div>
        
        {/* Modal Action Buttons */}
        <div className="no-print" style={{ marginTop: '30px', borderTop: '1px dashed #e2e8f0', paddingTop: '20px', textAlign: 'center' }}>
          <button className="btn btn-gold" onClick={() => window.print()}>🖨️ طباعة الآن</button>
          <button className="btn btn-outline" onClick={onClose} style={{ marginRight: '8px' }}>إغلاق المعاينة</button>
        </div>
      </div>
    </div>
  );
}
