import React from 'react';
import { MONTHS, COLORS, getTotals, fmt } from '../js/utils';

export default function Summary({ state, onSelectClient }) {
  const y = state.year;
  const m = state.month;

  const rows = state.clients.map(cl => ({ 
    ...cl, 
    ...getTotals(state.ledger, cl.id, y, m) 
  }));

  const grand = rows.reduce((a, x) => ({ 
    amt: a.amt + x.amt, 
    paid: a.paid + x.paid, 
    nw: a.nw + x.nw, 
    tw: a.tw + x.tw 
  }), { amt: 0, paid: 0, nw: 0, tw: 0 });

  return (
    <div className="fade-in">
      <div className="sec-header">
        <div className="sec-title">الملخص المالي الشامل — {MONTHS[m - 1]} {y}</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>العميل</th>
              <th>الوزن الكامل</th>
              <th>الوزن الصافي</th>
              <th>المبلغ الجملي</th>
              <th>المدفوع</th>
              <th>الباقي</th>
              <th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const rem = r.amt - r.paid;
              return (
                <tr 
                  key={r.id} 
                  className={i % 2 ? 'alt' : ''} 
                  style={{ cursor: 'pointer' }} 
                  onClick={() => onSelectClient(r.id)}
                >
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '30px',
                        height: '30px',
                        borderRadius: '50%',
                        background: COLORS[r.color % COLORS.length],
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '13px',
                        fontWeight: '800',
                        color: '#0b1520'
                      }}>
                        {r.name[0]}
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontWeight: '700', fontSize: '13px' }}>{r.name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{r.address}</div>
                      </div>
                    </div>
                  </td>
                  <td>{r.tw ? Math.round(r.tw) + ' كغ' : '—'}</td>
                  <td>{r.nw ? Math.round(r.nw) + ' كغ' : '—'}</td>
                  <td style={{ fontWeight: '600', color: 'var(--gold)' }}>{fmt(r.amt) || '—'}</td>
                  <td style={{ color: 'var(--green)' }}>{fmt(r.paid) || '—'}</td>
                  <td style={{ fontWeight: '700', color: rem > 0 ? 'var(--red)' : rem < 0 ? 'var(--orange)' : 'var(--muted)' }}>
                    {rem > 0 ? fmt(rem) : rem < 0 ? 'زيادة' : '—'}
                  </td>
                  <td>
                    <span className={`badge ${rem <= 0 ? 'badge-green' : rem > 0 ? 'badge-red' : 'badge-orange'}`}>
                      {rem <= 0 ? '✓ مسوّى' : '⚠️ متبقي بذمته'}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="total-row">
              <td style={{ color: 'var(--gold)' }}>الإجمالي</td>
              <td>{Math.round(grand.tw)} كغ</td>
              <td>{Math.round(grand.nw)} كغ</td>
              <td style={{ color: 'var(--gold)' }}>{fmt(grand.amt) || '—'}</td>
              <td style={{ color: 'var(--green)' }}>{fmt(grand.paid) || '—'}</td>
              <td style={{ color: grand.amt - grand.paid > 0 ? 'var(--red)' : 'var(--green)' }}>
                {fmt(grand.amt - grand.paid) || '—'}
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
