import React from 'react';
import { MONTHS, COLORS, getTotals, fmt } from '../js/utils';

export default function Dashboard({ 
  state, 
  onSelectClient, 
  onPriceChange, 
  onBackupExport, 
  onBackupImport 
}) {
  const y = state.year;
  const m = state.month;
  
  const allTotals = state.clients.map(cl => ({ 
    ...cl, 
    ...getTotals(state.ledger, cl.id, y, m) 
  }));
  
  const grandAmt = allTotals.reduce((a, x) => a + x.amt, 0);
  const grandPaid = allTotals.reduce((a, x) => a + x.paid, 0);
  const grandRem = grandAmt - grandPaid;
  const grandNw = allTotals.reduce((a, x) => a + x.nw, 0);
  const grandTw = allTotals.reduce((a, x) => a + x.tw, 0);

  const topClients = [...allTotals].sort((a, b) => b.amt - a.amt).slice(0, 5);
  const debtors = allTotals.filter(x => x.amt - x.paid > 0).sort((a, b) => (b.amt - b.paid) - (a.amt - a.paid));

  const collectionRate = grandAmt ? Math.round((grandPaid / grandAmt) * 100) : 0;
  const yieldRatio = grandTw ? Math.round((grandNw / grandTw) * 100) : 0;

  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      onBackupImport(file);
    }
  };

  return (
    <div className="fade-in">
      <div className="sec-header">
        <div className="sec-title">لوحة القيادة الرئيسية — {MONTHS[m - 1]} {y}</div>
        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{state.clients.length} عميل نشط</div>
      </div>

      <div className="stat-grid" style={{ marginBottom: '20px' }}>
        <div className="stat gold">
          <div className="stat-label">إجمالي المبيعات</div>
          <div className="stat-value">{fmt(grandAmt) || "—"}</div>
          <div className="stat-sub">لجميع العملاء</div>
        </div>
        <div className="stat green">
          <div className="stat-label">إجمالي المدفوع</div>
          <div className="stat-value">{fmt(grandPaid) || "—"}</div>
          <div className="stat-sub">النقد المستلم للشركة</div>
        </div>
        <div className="stat grand-debt red">
          <div className="stat-label">إجمالي الديون المعلقة</div>
          <div className="stat-value" style={{ color: grandRem > 0 ? 'var(--red)' : 'var(--blue)' }}>{fmt(grandRem) || "—"}</div>
          <div className="stat-sub">{debtors.length} عملاء متبقين</div>
        </div>
        <div className="stat blue">
          <div className="stat-label">إجمالي الوزن الصافي</div>
          <div className="stat-value">{Math.round(grandNw)} كغ</div>
          <div className="stat-sub">الكامل: {Math.round(grandTw)} كغ</div>
        </div>
        <div className="stat green">
          <div className="stat-label">نسبة تحصيل الديون</div>
          <div className="stat-value">{collectionRate}%</div>
          <div className="stat-sub">كفاءة تحصيل المبيعات</div>
        </div>
        <div className="stat gold">
          <div className="stat-label">نسبة الوزن الصافي المردودية</div>
          <div className="stat-value">{yieldRatio}%</div>
          <div className="stat-sub">صافي الوزن / كامل الوزن</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }} className="db-details-grid">
        <div className="card">
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--gold)', marginBottom: '14px' }}>🏆 أكثر العملاء مشتريات (هذا الشهر)</div>
          {topClients.length === 0 ? (
            <div style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>لا توجد بيانات</div>
          ) : (
            topClients.map((cl, i) => {
              const pct = grandAmt ? Math.round(cl.amt / grandAmt * 100) : 0;
              return (
                <div key={cl.id} style={{ marginBottom: '12px', cursor: 'pointer' }} onClick={() => onSelectClient(cl.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        background: COLORS[cl.color % COLORS.length],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '11px',
                        fontWeight: '800',
                        color: '#0b1520'
                      }}>{i + 1}</div>
                      <span style={{ fontSize: '13px', fontWeight: '600' }}>{cl.name}</span>
                    </div>
                    <span style={{ fontSize: '12px', color: 'var(--gold)', fontWeight: '700' }}>{fmt(cl.amt) || "—"}</span>
                  </div>
                  <div className="progress-wrap">
                    <div className="progress-bar" style={{ width: `${pct}%`, background: COLORS[cl.color % COLORS.length] }}></div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="card">
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--red)', marginBottom: '14px' }}>⚠️ حسابات الديون المعلقة</div>
          {debtors.length === 0 ? (
            <div style={{ color: 'var(--green)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>🎉 جميع الحسابات مسوّاة بشكل كامل</div>
          ) : (
            debtors.map(cl => (
              <div key={cl.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', background: 'rgba(239,68,68,.07)', borderRadius: '8px', marginBottom: '6px', cursor: 'pointer' }} onClick={() => onSelectClient(cl.id)}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '600' }}>{cl.name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{cl.address}</div>
                </div>
                <div style={{ textAlign: 'left' }}>
                  <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--red)' }}>{fmt(cl.amt - cl.paid)}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>متبقي بذمته</div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--gold)' }}>⚙️ إعدادات السعر الافتراضي</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div>
              <div className="input-label">سعر الكيلوغرام الافتراضي (د.ت)</div>
              <input 
                type="number" 
                step="0.001"
                className="input" 
                style={{ width: '140px' }} 
                value={state.pricePerKg} 
                onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)} 
                placeholder="5.800"
              />
              <div className="price-hint">يُعتمد للتسعير التلقائي الفوري</div>
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--bg3)', borderRadius: '8px', fontSize: '13px', flex: 1, minWidth: '180px' }}>
              <span style={{ color: 'var(--muted)' }}>مثال: 100كغ × </span>
              <span style={{ color: 'var(--gold)', fontWeight: '700' }}>{fmt(state.pricePerKg)}</span>
              <span style={{ color: 'var(--muted)' }}> = </span>
              <span style={{ color: 'var(--green)', fontWeight: '700' }}>{fmt(100 * state.pricePerKg)} د.ت</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--gold)', marginBottom: '14px' }}>📁 إدارة البيانات والنسخ الاحتياطي</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '12px' }}>
            <button className="btn btn-outline btn-sm" onClick={onBackupExport}>
              📤 تصدير ملف النسخة الاحتياطية (JSON)
            </button>
            <label className="btn btn-outline btn-sm" style={{ margin: 0, cursor: 'pointer' }}>
              📥 استيراد نسخة احتياطية (JSON)
              <input type="file" accept=".json" onChange={handleFileImport} style={{ display: 'none' }} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
