import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { MONTHS, getRows, getTotals, fmt, getClientColor } from '../js/utils';

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
      <div className="bg-slate-950/70 border border-slate-900/60 p-4 rounded-xl text-center select-none">
        <div className="text-[10px] text-slate-500 font-bold">نمو مبيعات الشركة MoM</div>
        <div className={`text-base md:text-lg font-black font-mono mt-1 ${isUp ? 'text-emerald-400' : 'text-red-400'}`}>
          {isUp ? '▲ +' : '▼ -'}{Math.abs(Math.round(pctChange))}%
        </div>
      </div>
    );
  } else {
    growthWidget = (
      <div className="bg-slate-950/70 border border-slate-900/60 p-4 rounded-xl text-center select-none">
        <div className="text-[10px] text-slate-500 font-bold">نمو مبيعات الشركة MoM</div>
        <div className="text-[10px] text-slate-500 mt-2 font-medium">لا يوجد سجلات للشهر السابق</div>
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
      dPath = `M ${points.at(0).x} ${points.at(0).y}`;
      areaPath = `M ${points.at(0).x} ${height - paddingY} L ${points.at(0).x} ${points.at(0).y}`;

      for (let i = 1; i < points.length; i++) {
        dPath += ` L ${points.at(i).x} ${points.at(i).y}`;
        areaPath += ` L ${points.at(i).x} ${points.at(i).y}`;
      }

      areaPath += ` L ${points.at(-1).x} ${height - paddingY} Z`;
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
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" className="overflow-visible select-none">
        <defs>
          <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4a843" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#d4a843" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal Gridlines */}
        {gridLines.map((g, idx) => (
          <g key={idx}>
            <line x1={paddingX} y1={g.yPos} x2={width - paddingX} y2={g.yPos} stroke="rgba(255,255,255,0.06)" strokeDasharray="4 4" strokeWidth="1" />
            <text x={paddingX - 10} y={g.yPos + 4} fill="#64748b" fontSize="9" textAnchor="end" className="font-mono font-bold">{g.label}</text>
          </g>
        ))}

        {/* Vertical Day Guides */}
        {verticalGuides.map((vg, idx) => (
          <g key={idx}>
            <line x1={vg.xPos} y1={paddingY} x2={vg.xPos} y2={height - paddingY} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
            <text x={vg.xPos} y={height - paddingY + 16} fill="#64748b" fontSize="9" textAnchor="middle" className="font-mono font-bold">{vg.label}</text>
          </g>
        ))}

        {/* Area and Line Paths */}
        {points.length > 0 && (
          <>
            <path d={areaPath} fill="url(#chart-grad)" />
            <path d={dPath} fill="none" stroke="#d4a843" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </>
        )}

        {/* Circle Hotspots */}
        {points.map((pt, idx) => {
          if (pt.val <= 0) return null;
          const row = rows.at(pt.d - 1);
          const nw = parseFloat(row.nw) || 0;
          const price = parseFloat(row.price) || state.pricePerKg || 0;
          const dateStr = `${y}/${String(m).padStart(2, '0')}/${String(pt.d).padStart(2, '0')}`;

          const handleMouse = (e) => {
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
              r="4.5" 
              fill="#d4a843" 
              stroke="#0f172a" 
              strokeWidth="2" 
              className="transition-all hover:r-6 cursor-pointer" 
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
        <div className="py-16 text-slate-550 text-xs text-center font-medium">
          لا توجد مبيعات نشطة لهذا الشهر لعرض مخطط توزيع الحصص
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
      const color = getClientColor(share.color);
      
      currentOffset -= strokeLength;

      return {
        ...share,
        pct,
        strokeOffset,
        color
      };
    });

    return (
      <div className="flex flex-col sm:flex-row items-center gap-6 text-right">
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg viewBox="0 0 120 120" width="120" height="120">
            {slices.map((slice, idx) => (
              <circle 
                key={idx}
                cx="60" 
                cy="60" 
                r={R} 
                fill="transparent" 
                stroke={slice.color} 
                strokeWidth="9" 
                strokeDasharray={C} 
                strokeDashoffset={slice.strokeOffset} 
                transform="rotate(-90 60 60)" 
                className="transition-all duration-300"
              />
            ))}
            <circle cx="60" cy="60" r={R - 4.5} fill="#0b1222" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none text-center">
            <span className="text-[9px] text-slate-550 font-bold">المجموع</span>
            <span className="text-[11px] font-black text-amber-400 font-mono mt-0.5">{fmt(total)}</span>
          </div>
        </div>
        
        <div className="flex-1 max-h-[160px] overflow-y-auto pr-1 space-y-2.5 w-full scrollbar-thin">
          {slices.map((slice, idx) => (
            <div key={idx} className="flex items-center justify-between text-xs border-b border-slate-900/40 pb-1.5 last:border-none">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded bg-slate-950 flex-shrink-0" style={{ background: slice.color }} />
                <span className="font-bold text-slate-200">{slice.name}</span>
              </div>
              <span className="text-slate-450 font-semibold font-mono text-[11px]">
                {fmt(slice.amount)} د.ت ({Math.round(slice.pct)}%)
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* HEADER SECTION */}
      <div className="bg-slate-900/40 border border-slate-800/60 backdrop-blur-md rounded-2xl p-4 md:p-6 shadow-sm text-right">
        <h2 className="text-xl md:text-2xl font-black bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
          التحليلات والمؤشرات البيانية — {MONTHS.at(m - 1)} {y}
        </h2>
        <p className="text-xs text-slate-400 font-medium mt-1">قراءة بيانية شاملة لمستويات الطلب والنمو والحصص السوقية للعملاء</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ACTIVE CLIENT SALES CHART */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 md:p-6 shadow-lg lg:col-span-3 text-right">
          <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 mb-6 justify-start">
            <span>📈</span>
            <span>حركة مبيعات العميل النشط ({activeClient ? activeClient.name : '—'})</span>
          </h3>
          <div className="h-64 w-full relative">
            {activeClient ? renderSVGLineChart() : (
              <div className="text-slate-500 text-xs py-16 text-center">حدد عميلاً لعرض المخطط البياني</div>
            )}
          </div>
          <div className="text-[10px] text-slate-500 font-medium mt-4 text-center select-none">
            المحور الأفقي: أيام الشهر | المحور العمودي: المبيعات الإجمالية بالدينار (د.ت)
          </div>
        </div>

        {/* MARKET SHARE DISTRIBUTION CHART */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 md:p-6 shadow-lg lg:col-span-1 text-right">
          <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 mb-6 justify-start">
            <span>🍩</span>
            <span>توزيع مبيعات العملاء السوقية</span>
          </h3>
          <div>{renderSVGDonutChart()}</div>
        </div>

        {/* METRICS & STATISTICS PANEL */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 md:p-6 shadow-lg lg:col-span-2 text-right">
          <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 mb-6 justify-start">
            <span>📊</span>
            <span>إحصائيات الأداء البياني للشركة</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-950/40 border border-slate-900/60 p-3.5 rounded-xl text-center select-none">
              <div className="text-[10px] text-slate-500 font-bold">سعر الكيلوغرام الفعلي</div>
              <div className="text-sm font-black text-amber-400 font-mono mt-1">{fmt(avgPrice)} د.ت</div>
            </div>

            <div className="bg-slate-950/40 border border-slate-900/60 p-3.5 rounded-xl text-center select-none">
              <div className="text-[10px] text-slate-500 font-bold">شحنات تسليم الدواجن</div>
              <div className="text-sm font-black text-sky-400 font-mono mt-1">{totalActiveDays} شحنة</div>
            </div>

            <div className="bg-slate-950/40 border border-slate-900/60 p-3.5 rounded-xl text-center select-none">
              <div className="text-[10px] text-slate-500 font-bold">معدل الإيرادات اليومي</div>
              <div className="text-sm font-black text-amber-400 font-mono mt-1">{fmt(avgDailySales)} د.ت</div>
            </div>

            <div className="bg-slate-950/40 border border-slate-900/60 p-3.5 rounded-xl text-center select-none">
              <div className="text-[10px] text-slate-500 font-bold">معدل الوزن اليومي</div>
              <div className="text-sm font-black text-sky-400 font-mono mt-1">{Math.round(avgDailyWeight)} كغ</div>
            </div>

            {/* Peak volume info */}
            <div className="bg-slate-950/40 border border-slate-900/60 p-4 rounded-xl text-center select-none col-span-2">
              <div className="text-[10px] text-slate-500 font-bold">أعلى حجم تسليم للشركة في يوم واحد</div>
              <div className="text-sm font-black text-emerald-400 font-mono mt-1">
                {Math.round(maxDayVol)} كغ{' '}
                <span className="text-[9px] text-slate-500 font-medium">({maxDayDate || '—'})</span>
              </div>
            </div>

            {/* Best Buyer & Best payer */}
            <div className="bg-slate-950/40 border border-slate-900/60 p-3.5 rounded-xl text-center col-span-1">
              <div className="text-[10px] text-slate-500 font-bold">بطل الشراء للشهر 🏆</div>
              <div className="text-xs font-black text-amber-400 mt-1.5 truncate max-w-full block" title={bestBuyerName}>
                {bestBuyerName} <span className="text-[9px] text-slate-500 font-medium block mt-0.5">({Math.round(bestBuyerWt)} كغ)</span>
              </div>
            </div>

            <div className="bg-slate-950/40 border border-slate-900/60 p-3.5 rounded-xl text-center col-span-1">
              <div className="text-[10px] text-slate-500 font-bold">أفضل التزام بالتسديد 💸</div>
              <div className="text-xs font-black text-emerald-450 mt-1.5 truncate max-w-full block" title={bestPayName}>
                {bestPayName} <span className="text-[9px] text-slate-500 font-medium block mt-0.5">({bestPayPct}%)</span>
              </div>
            </div>

            {/* MoM Growth widget */}
            <div className="col-span-2 sm:col-span-4">{growthWidget}</div>
          </div>
        </div>
      </div>

      {/* RENDER DUST-FREE REACT PORTAL CHART TOOLTIP */}
      {tooltip.show && (
        <div 
          className="fixed z-[100] bg-slate-950/95 border border-slate-800/80 p-3.5 rounded-xl shadow-2xl min-w-[170px] select-none pointer-events-none text-right backdrop-blur-sm"
          style={{ 
            left: `${tooltip.x}px`, 
            top: `${tooltip.y}px` 
          }}
        >
          <div className="font-bold text-amber-400 text-[10px] border-b border-slate-900 pb-1.5 mb-2 font-mono">
            {tooltip.date}
          </div>
          <div className="space-y-1.5 text-[10px] font-semibold text-slate-400">
            <div className="flex justify-between gap-5">
              <span>الوزن الصافي:</span>
              <span className="text-sky-400 font-bold font-mono">{tooltip.nw} كغ</span>
            </div>
            <div className="flex justify-between gap-5">
              <span>السعر الفردي:</span>
              <span className="text-amber-450 font-bold font-mono">{fmt(tooltip.price)} د.ت</span>
            </div>
            <div className="flex justify-between gap-5 pt-2 mt-2 border-t border-slate-900 font-extrabold text-[11px]">
              <span>المجموع الفردي:</span>
              <span className="text-emerald-400 font-bold font-mono">{fmt(tooltip.amt)} د.ت</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
