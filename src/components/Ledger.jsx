import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { COLORS, getRows, getTotals, calcBalance, fmt } from '../js/utils';

export default function Ledger({ 
  state, 
  onSelectClient, 
  onUpdateRow, 
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
      <div className="empty">
        <div className="empty-icon">👥</div>
        <div>لا يوجد عملاء مضافين حالياً</div>
        <button className="btn btn-gold" style={{ marginTop: '15px' }} onClick={() => onSelectClient(null)}>إضافة عميل</button>
      </div>
    );
  }

  const rows = getRows(state.ledger, cl.id, y, m);
  const totals = getTotals(state.ledger, cl.id, y, m);
  const remaining = totals.amt - totals.paid;
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
    <div className="fade-in">
      {/* CLIENT PICKER */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
        <div className="chips">
          {state.clients.map(x => (
            <button 
              key={x.id}
              className={`chip ${x.id === cl.id ? 'active' : ''}`} 
              onClick={() => onSelectClient(x.id)}
            >
              {x.name}
            </button>
          ))}
        </div>
      </div>

      {/* CLIENT INFO CARD */}
      <div className="card" style={{ marginBottom: '14px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{
          width: '46px',
          height: '46px',
          borderRadius: '50%',
          background: COLORS[cl.color % COLORS.length],
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '20px',
          fontWeight: '800',
          color: '#0b1520',
          flexShrink: 0
        }}>
          {cl.name[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--gold)' }}>{cl.name}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)' }}>📍 {cl.address} &nbsp;|&nbsp; 📞 {cl.phone}</div>
        </div>
        <div style={{ flex: 1, minWidth: '160px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
            <span style={{ color: 'var(--muted)' }}>نسبة تسديد الديون</span>
            <span style={{ color: paidPct >= 100 ? 'var(--green)' : 'var(--gold)', fontWeight: '700' }}>{paidPct}%</span>
          </div>
          <div className="progress-wrap">
            <div className="progress-bar" style={{ width: `${Math.min(paidPct, 100)}%`, background: paidPct >= 100 ? 'var(--green)' : 'var(--gold)' }}></div>
          </div>
        </div>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{
            fontSize: '20px',
            fontWeight: '800',
            color: remaining > 0 ? 'var(--red)' : remaining < 0 ? 'var(--orange)' : 'var(--green)'
          }}>{fmt(remaining) || "—"}</div>
          <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
            {remaining > 0 ? 'متبقي' : remaining < 0 ? 'زيادة' : 'خالص ✓'}
          </div>
          {remaining > 0 && (
            <button 
              className="btn btn-gold btn-sm no-print" 
              style={{ padding: '4px 10px', fontSize: '10px', marginTop: '4px' }} 
              onClick={() => setQuickSettleOpen(true)}
            >
              💸 تسديد سريع
            </button>
          )}
        </div>
      </div>

      {/* STATS BAR */}
      <div className="stat-grid" id="stat-bar">
        <div className="stat blue">
          <div className="stat-label">الوزن الكامل الجملي</div>
          <div className="stat-value">{Math.round(totals.tw)} كغ</div>
          <div className="stat-sub">{totals.days} يوم تسليم</div>
        </div>
        <div className="stat green">
          <div className="stat-label">إجمالي الوزن الصافي</div>
          <div className="stat-value">{Math.round(totals.nw)} كغ</div>
          <div className="stat-sub">صافي المبيعات الكلي</div>
        </div>
        <div className="stat gold">
          <div className="stat-label">المبلغ الإجمالي</div>
          <div className="stat-value">{fmt(totals.amt) || "—"}</div>
          <div className="stat-sub">د.ت جملة الفواتير</div>
        </div>
        <div className="stat ledger-debt red">
          <div className="stat-label">الباقي بذمته</div>
          <div className="stat-value" style={{ color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>
            {remaining > 0 ? <span className="pulse-dot-red"></span> : <span className="pulse-dot-green"></span>}
            {fmt(remaining) || "—"}
          </div>
          <div className="stat-sub">{remaining > 0 ? 'دين معلق مستحق' : 'خالص بالكامل'}</div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }} className="no-print">
        <div></div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-outline btn-sm" onClick={onExportCSV}>📥 تصدير Excel (CSV)</button>
          <button className="btn btn-gold btn-sm" onClick={() => onPrintInvoice(cl.id)}>📄 معاينة وطباعة الفاتورة</button>
        </div>
      </div>

      {/* TABLE */}
      <div className="table-wrap" style={{ marginTop: '6px' }}>
        <table id="ledger-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>الوزن الكامل (كغ)</th>
              <th>الوزن الصافي (كغ)</th>
              <th>السعر (د.ت)</th>
              <th>المبلغ الجملي</th>
              <th>المدفوع</th>
              <th>الباقي</th>
              <th>ملاحظات</th>
              <th>عطلة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const bal = calcBalance(r);
              const dateStr = `${y}/${String(m).padStart(2, "0")}/${String(r.d).padStart(2, "0")}`;
              return (
                <tr key={idx} className={`${r.holiday ? 'holiday' : idx % 2 ? 'alt' : ''}`} id={`row-${idx}`}>
                  <td style={{ color: 'var(--muted)', fontWeight: '600', fontSize: '12px', whiteSpace: 'nowrap' }}>{dateStr}</td>
                  {r.holiday ? (
                    <td colSpan="6" style={{ color: 'var(--orange)', fontWeight: '700', fontSize: '13px' }}>— عطلة —</td>
                  ) : (
                    <>
                      <td>
                        <input 
                          className="table-input" 
                          type="number" 
                          value={r.tw} 
                          placeholder="0"
                          onChange={(e) => onUpdateRow(idx, 'tw', e.target.value)} 
                          onKeyDown={(e) => handleKeyDown(e, idx, 0)}
                          data-row={idx}
                          data-col={0}
                          style={{ width: '70px' }}
                        />
                      </td>
                      <td>
                        <input 
                          className="table-input" 
                          type="number" 
                          id={`nw-${idx}`} 
                          value={r.nw} 
                          placeholder="0"
                          onChange={(e) => onUpdateRow(idx, 'nw', e.target.value)} 
                          onKeyDown={(e) => handleKeyDown(e, idx, 1)}
                          data-row={idx}
                          data-col={1}
                          style={{ width: '70px' }}
                        />
                      </td>
                      <td>
                        <input 
                          className="table-input" 
                          type="number" 
                          id={`price-${idx}`} 
                          value={r.price || ''} 
                          placeholder={state.pricePerKg}
                          onChange={(e) => onUpdateRow(idx, 'price', e.target.value)} 
                          onKeyDown={(e) => handleKeyDown(e, idx, 2)}
                          data-row={idx}
                          data-col={2}
                          style={{ width: '70px', color: 'var(--gold)' }}
                        />
                      </td>
                      <td>
                        <input 
                          className="table-input" 
                          type="number" 
                          id={`amt-${idx}`} 
                          value={r.amt} 
                          placeholder="—"
                          onChange={(e) => onUpdateRow(idx, 'amt', e.target.value)} 
                          onKeyDown={(e) => handleKeyDown(e, idx, 3)}
                          data-row={idx}
                          data-col={3}
                          style={{ width: '90px' }}
                        />
                      </td>
                      <td>
                        <input 
                          className="table-input" 
                          type="number" 
                          value={r.paid} 
                          placeholder="—"
                          onChange={(e) => onUpdateRow(idx, 'paid', e.target.value)} 
                          onKeyDown={(e) => handleKeyDown(e, idx, 4)}
                          data-row={idx}
                          data-col={4}
                          style={{ width: '90px', color: r.paid ? 'var(--green)' : '' }} 
                        />
                      </td>
                      <td style={{ fontWeight: '700', color: bal > 0 ? 'var(--red)' : bal < 0 ? 'var(--orange)' : 'var(--muted)' }} id={`bal-${idx}`}>
                        {r.amt ? fmt(bal) : ""}
                      </td>
                    </>
                  )}
                  <td>
                    <input 
                      className="table-input" 
                      value={r.notes || ''} 
                      placeholder="..."
                      onChange={(e) => onUpdateRow(idx, 'notes', e.target.value)} 
                      onKeyDown={(e) => handleKeyDown(e, idx, 5)}
                      data-row={idx}
                      data-col={5}
                      style={{ width: '90px', color: 'var(--muted)' }}
                    />
                  </td>
                  <td>
                    <button 
                      className={`btn btn-sm ${r.holiday ? 'btn-gold' : 'btn-outline'}`} 
                      onClick={() => onToggleHoliday(idx)}
                    >
                      {r.holiday ? '✓' : 'عطلة'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td style={{ color: 'var(--gold)' }}>الإجمالي</td>
              <td id="tot-tw">{Math.round(totals.tw)}</td>
              <td id="tot-nw">{Math.round(totals.nw)}</td>
              <td></td>
              <td id="tot-amt" style={{ color: 'var(--gold)' }}>{fmt(totals.amt) || "—"}</td>
              <td id="tot-paid" style={{ color: 'var(--green)' }}>{fmt(totals.paid) || "—"}</td>
              <td id="tot-rem" style={{ color: remaining > 0 ? 'var(--red)' : 'var(--green)' }}>{fmt(remaining) || "—"}</td>
              <td colSpan="2"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* QUICK SETTLE MODAL */}
      {quickSettleOpen && createPortal(
        <div className="modal-overlay open" onClick={() => setQuickSettleOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">تسديد الديون السريع</div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>
              أدخل المبلغ المستلم وسيتم توزيعه آلياً لتسوية فواتير العميل <strong>{cl.name}</strong> القديمة أولاً بأول.
            </p>
            <form onSubmit={handleQuickSettleSubmit} style={{ display: 'grid', gap: '12px' }}>
              <div>
                <div className="input-label">مبلغ الدفع المستلم (د.ت) *</div>
                <input 
                  className="input" 
                  type="number" 
                  step="0.001"
                  value={settleAmount} 
                  onChange={(e) => setSettleAmount(e.target.value)}
                  placeholder="مثال: 300.000" 
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="submit" className="btn btn-gold" style={{ flex: 1 }}>توزيع وتسديد</button>
                <button type="button" className="btn btn-outline" onClick={() => setQuickSettleOpen(false)}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
