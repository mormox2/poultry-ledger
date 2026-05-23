import React, { useState } from 'react';
import { MONTHS, COLORS, getRows, getTotals, fmt } from '../js/utils';

export default function Analytics({ state }) {
  const y = state.year;
  const m = state.month;

  const [tooltip, setTooltip] = useState({
    show: false,
    x: 0,
    y: 0,
    date: '',
    nw: 0,
    price: 0,
    amt: 0
  });

  const allTotals = state.clients.map(cl => ({ 
    ...cl, 
    ...getTotals(state.ledger, cl.id, y, m) 
  }));

  const shares = allTotals.filter(x => x.amt > 0).map(x => ({
    name: x.name,
    amount: x.amt,
    color: x.color
  }));

  let maxDayVol = 0;
  let maxDayDate = "";
  let totalActiveDays = 0;
  let priceCount = 0;
  let priceSum = 0;

  state.clients.forEach(cl => {
    const rows = getRows(state.ledger, cl.id, y, m);
    rows.forEach(r => {
      if (r.holiday) return;
      const nw = parseFloat(r.nw) || 0;
      if (nw > 0) totalActiveDays++;
      if (nw > maxDayVol) {
        maxDayVol = nw;
        maxDayDate = `${y}/${String(m).padStart(2, '0')}/${String(r.d).padStart(2, '0')}`;
      }
      const price = parseFloat(r.price) || state.pricePerKg;
      if (price) {
        priceSum += price;
        priceCount++;
      }
    });
  });

  const avgPrice = priceCount ? parseFloat((priceSum / priceCount).toFixed(3)) : state.pricePerKg;
  const activeClient = state.clients.find(x => x.id === state.selectedClient) || state.clients[0];

  const grandAmt = allTotals.reduce((a, x) => a + x.amt, 0);
  const grandNw = allTotals.reduce((a, x) => a + x.nw, 0);

  const avgDailySales = totalActiveDays ? parseFloat((grandAmt / totalActiveDays).toFixed(3)) : 0;
  const avgDailyWeight = totalActiveDays ? Math.round(grandNw / totalActiveDays) : 0;

  let bestBuyerName = "—";
  let bestBuyerWt = 0;
  allTotals.forEach(cl => {
    if (cl.nw > bestBuyerWt) {
      bestBuyerWt = cl.nw;
      bestBuyerName = cl.name;
    }
  });

  let bestPayName = "—";
  let bestPayPct = 0;
  allTotals.forEach(cl => {
    if (cl.amt > 0) {
      const pct = Math.round((cl.paid / cl.amt) * 100);
      if (pct > bestPayPct) {
        bestPayPct = pct;
        bestPayName = cl.name;
      }
    }
  });

  const prevM = m === 1 ? 12 : m - 1;
  const prevY = m === 1 ? y - 1 : y;
  let prevGrandAmt = 0;
  state.clients.forEach(cl => {
    const totals = getTotals(state.ledger, cl.id, prevY, prevM);
    prevGrandAmt += totals.amt;
  });

  let growthWidget = null;
  if (prevGrandAmt > 0) {
    const pctChange = ((grandAmt - prevGrandAmt) / prevGrandAmt) * 100;
    const isUp = pctChange >= 0;
    growthWidget = (
      <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>نمو مبيعات الشركة MoM</div>
        <div style={{
          fontSize: '16px',
          fontWeight: '800',
          color: isUp ? 'var(--green)' : 'var(--red)',
          fontFamily: "'Plus Jakarta Sans'",
          marginTop: '4px'
        }}>
          {isUp ? '▲ +' : '▼ -'}{Math.abs(Math.round(pctChange))}%
        </div>
      </div>
    );
  } else {
    growthWidget = (
      <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>نمو مبيعات الشركة MoM</div>
        <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>لا يوجد سجلات للشهر السابق</div>
      </div>
    );
  }

  // --- SVG line chart math ---
  const renderSVGLineChart = () => {
    if (!activeClient) return null;
    const rows = getRows(state.ledger, activeClient.id, y, m);
    const days = rows.length;
    const data = rows.map(r => ({ d: r.d, val: (parseFloat(r.amt) || 0) }));
    const maxVal = Math.max(...data.map(d => d.val), 1000);

    const width = 800;
    const height = 240;
    const paddingX = 50;
    const paddingY = 30;

    const chartW = width - paddingX * 2;
    const chartH = height - paddingY * 2;

    const points = data.map(pt => {
      const x = paddingX + (pt.d - 1) * (chartW / (days - 1));
      const y = height - paddingY - (pt.val * (chartH / maxVal));
      return { x, y, val: pt.val, d: pt.d };
    });

    let dPath = "";
    let areaPath = "";

    if (points.length > 0) {
      dPath = `M ${points[0].x} ${points[0].y}`;
      areaPath = `M ${points[0].x} ${height - paddingY} L ${points[0].x} ${points[0].y}`;

      for (let i = 1; i < points.length; i++) {
        dPath += ` L ${points[i].x} ${points[i].y}`;
        areaPath += ` L ${points[i].x} ${points[i].y}`;
      }

      areaPath += ` L ${points[points.length - 1].x} ${height - paddingY} Z`;
    }

    const gridLines = [];
    for (let i = 0; i <= 4; i++) {
      const val = (maxVal / 4) * i;
      const yPos = height - paddingY - (val * (chartH / maxVal));
      gridLines.push({ yPos, label: Math.round(val).toLocaleString() });
    }

    const keyDays = [1, 5, 10, 15, 20, 25, days];
    const verticalGuides = [];
    keyDays.forEach(kd => {
      const pt = points.find(p => p.d === kd);
      if (pt) {
        verticalGuides.push({ xPos: pt.x, label: kd });
      }
    });

    return (
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--gold)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Gridlines */}
        {gridLines.map((g, idx) => (
          <g key={idx}>
            <line x1={paddingX} y1={g.yPos} x2={width - paddingX} y2={g.yPos} stroke="var(--border)" strokeDasharray="4 4" strokeWidth="1" />
            <text x={paddingX - 10} y={g.yPos + 4} fill="var(--muted)" fontSize="10" textAnchor="end" fontFamily="'Plus Jakarta Sans', sans-serif">{g.label}</text>
          </g>
        ))}

        {/* Vertical Day Guides */}
        {verticalGuides.map((vg, idx) => (
          <g key={idx}>
            <line x1={vg.xPos} y1={paddingY} x2={vg.xPos} y2={height - paddingY} stroke="var(--border)" strokeOpacity="0.3" strokeWidth="1" />
            <text x={vg.xPos} y={height - paddingY + 16} fill="var(--muted)" fontSize="10" textAnchor="middle" fontFamily="'Plus Jakarta Sans', sans-serif">{vg.label}</text>
          </g>
        ))}

        {/* Area and Line Paths */}
        {points.length > 0 && (
          <>
            <path d={areaPath} fill="url(#chart-grad)" className="animated-chart-area" />
            <path d={dPath} fill="none" stroke="var(--gold)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animated-chart-line" />
          </>
        )}

        {/* Circle Hotspots */}
        {points.map((pt, idx) => {
          if (pt.val <= 0) return null;
          const row = rows[pt.d - 1];
          const nw = parseFloat(row.nw) || 0;
          const price = parseFloat(row.price) || state.pricePerKg || 0;
          const dateStr = `${y}/${String(m).padStart(2, '0')}/${String(pt.d).padStart(2, '0')}`;

          const handleMouse = (e) => {
            const rect = e.currentTarget.ownerSVGElement.getBoundingClientRect();
            // Calculate coordinate relative to SVG container or page
            setTooltip({
              show: true,
              x: e.pageX + 15,
              y: e.pageY - 15,
              date: dateStr,
              nw,
              price,
              amt: pt.val
            });
          };

          return (
            <circle 
              key={idx}
              cx={pt.x} 
              cy={pt.y} 
              r="4" 
              fill="var(--gold)" 
              stroke="var(--bg2)" 
              strokeWidth="1.5" 
              className="chart-dot" 
              style={{ cursor: 'pointer' }}
              onMouseEnter={handleMouse}
              onMouseMove={handleMouse}
              onMouseLeave={() => setTooltip(prev => ({ ...prev, show: false }))}
            />
          );
        })}
      </svg>
    );
  };

  // --- SVG donut chart math ---
  const renderSVGDonutChart = () => {
    const total = shares.reduce((a, c) => a + c.amount, 0);
    if (total === 0) {
      return (
        <div style={{ padding: '40px', color: 'var(--muted)', textAlign: 'center' }}>
          لا توجد مبيعات في هذا الشهر للرسم البياني
        </div>
      );
    }

    const R = 50;
    const C = 2 * Math.PI * R;
    let currentOffset = 0;

    const slices = shares.map((share, idx) => {
      const pct = (share.amount / total) * 100;
      const strokeLength = (pct / 100) * C;
      const strokeOffset = C - strokeLength + currentOffset;
      const color = COLORS[share.color % COLORS.length];
      
      currentOffset -= strokeLength;

      return {
        ...share,
        pct,
        strokeOffset,
        color
      };
    });

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '130px 1fr', gap: '20px', alignItems: 'center' }}>
        <div style={{ position: 'relative', width: '120px', height: '120px' }}>
          <svg viewBox="0 0 120 120" width="120" height="120">
            {slices.map((slice, idx) => (
              <circle 
                key={idx}
                cx="60" 
                cy="60" 
                r={R} 
                fill="transparent" 
                stroke={slice.color} 
                strokeWidth="10" 
                strokeDasharray={C} 
                strokeDashoffset={slice.strokeOffset} 
                transform="rotate(-90 60 60)" 
                style={{ 
                  '--target-offset': slice.strokeOffset,
                  '--circumference': C,
                  animation: 'drawDonut 1.5s cubic-bezier(0.22, 1, 0.36, 1) forwards'
                }} 
              />
            ))}
            <circle cx="60" cy="60" r={R - 5} fill="var(--bg2)" />
          </svg>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: '9px', color: 'var(--muted)' }}>المجموع</div>
            <div style={{ fontSize: '11px', fontWeight: '800', color: 'var(--gold)', fontFamily: "'Plus Jakarta Sans'" }}>{fmt(total)}</div>
          </div>
        </div>
        <div style={{ maxHeight: '150px', overflowY: 'auto', paddingRight: '4px' }}>
          {slices.map((slice, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: slice.color }}></div>
                <span style={{ fontWeight: '600' }}>{slice.name}</span>
              </div>
              <span style={{ color: 'var(--muted)', fontFamily: "'Plus Jakarta Sans'" }}>
                {fmt(slice.amount)} د.ت ({Math.round(slice.pct)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="fade-in">
      <div className="sec-header">
        <div className="sec-title">التحليلات والمؤشرات البيانية — {MONTHS[m - 1]} {y}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--gold)', marginBottom: '14px' }}>
            📈 حركة مبيعات العميل النشط ({activeClient ? activeClient.name : '—'})
          </div>
          <div style={{ height: '260px', width: '100%', position: 'relative' }}>
            {activeClient ? renderSVGLineChart() : (
              <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px' }}>
                حدد عميلاً لعرض المخطط
              </div>
            )}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px', textAlign: 'center' }}>
            المحور الأفقي: أيام الشهر | المحور العمودي: المبيعات الإجمالية بالدينار (د.ت)
          </div>
        </div>

        <div className="card">
          <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--gold)', marginBottom: '14px' }}>
            🍩 توزيع مبيعات العملاء السوقية
          </div>
          <div>{renderSVGDonutChart()}</div>
        </div>

        <div className="card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignContent: 'start' }}>
          <div style={{ gridColumn: 'span 2', fontSize: '14px', fontWeight: '700', color: 'var(--gold)', marginBottom: '4px' }}>
            📊 إحصائيات الأداء البياني للشركة
          </div>

          <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>معدل سعر الكيلوغرام الفعلي</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--gold)', fontFamily: "'Plus Jakarta Sans'", marginTop: '4px' }}>
              {fmt(avgPrice)} د.ت
            </div>
          </div>

          <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>أيام تسليم الدواجن النشطة</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--blue)', fontFamily: "'Plus Jakarta Sans'", marginTop: '4px' }}>
              {totalActiveDays} يوم تسليم
            </div>
          </div>

          <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>معدل الإيرادات اليومية</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--gold)', fontFamily: "'Plus Jakarta Sans'", marginTop: '4px' }}>
              {fmt(avgDailySales)} د.ت
            </div>
          </div>

          <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>معدل شحنات التوزيع اليومي</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--blue)', fontFamily: "'Plus Jakarta Sans'", marginTop: '4px' }}>
              {Math.round(avgDailyWeight)} كغ
            </div>
          </div>

          <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px', textAlign: 'center', gridColumn: 'span 2' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>أعلى حجم تسليم للشركة في يوم واحد</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--green)', fontFamily: "'Plus Jakarta Sans'", marginTop: '4px' }}>
              {Math.round(maxDayVol)} كغ{' '}
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: '400' }}>
                بتاريخ ({maxDayDate || '—'})
              </span>
            </div>
          </div>

          <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>بطل الشراء للشهر 🏆</div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--gold)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={bestBuyerName}>
              {bestBuyerName}{' '}
              <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: '400' }}>
                ({Math.round(bestBuyerWt)} كغ)
              </span>
            </div>
          </div>

          <div style={{ background: 'var(--bg3)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>أفضل التزام بالتسديد 💸</div>
            <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--green)', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={bestPayName}>
              {bestPayName}{' '}
              <span style={{ fontSize: '10px', color: 'var(--muted)', fontWeight: '400' }}>
                ({bestPayPct}%)
              </span>
            </div>
          </div>

          <div style={{ gridColumn: 'span 2' }}>{growthWidget}</div>
        </div>
      </div>

      {/* REACT DIRECT PORTED CHART TOOLTIP */}
      {tooltip.show && (
        <div 
          id="chart-tooltip" 
          style={{ 
            display: 'block', 
            left: `${tooltip.x}px`, 
            top: `${tooltip.y}px` 
          }}
        >
          <div style={{ fontWeight: '700', color: 'var(--gold)', marginBottom: '6px', borderBottom: '1px solid var(--border)', paddingBottom: '4px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {tooltip.date}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '3px' }}>
            <span style={{ color: 'var(--muted)' }}>الوزن الصافي:</span>
            <span style={{ fontWeight: '700', color: 'var(--blue)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {tooltip.nw} كغ
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', marginBottom: '3px' }}>
            <span style={{ color: 'var(--muted)' }}>السعر الفردي:</span>
            <span style={{ fontWeight: '700', color: 'var(--gold)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {fmt(tooltip.price)} د.ت
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px', fontWeight: '800', marginTop: '6px', borderTop: '1px dashed var(--border)', paddingTop: '6px' }}>
            <span style={{ color: 'var(--muted)' }}>المبلغ الجملي:</span>
            <span style={{ color: 'var(--green)', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {fmt(tooltip.amt)} د.ت
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
