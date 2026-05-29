import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Atropos from 'atropos/react';
import 'atropos/css';
import { MONTHS, getTotals, fmt, getClientColor } from '../js/utils';

export default function Dashboard({ 
  state, 
  onSelectClient, 
  onPriceChange, 
  onBackupExport, 
  onBackupImport,
  onChangePassword,
  onUpdateCompanyInfo,
  installPrompt,
  onInstallApp,
  isStandalone,
  onShowInstallGuide,
  onBackupCloudExport,
  onBackupCloudRestore
}) {
  const [showSettings, setShowSettings] = useState(false);
  const [chartType, setChartType] = useState('line'); // 'line' or 'bar'
  const [hoveredIdx, setHoveredIdx] = useState(null); // active month inspect index
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

  const allPurchaseTotals = (state.suppliers || []).map(sup => ({
    ...sup,
    ...getTotals(state.purchases || {}, sup.id, y, m)
  }));

  const grandPurchaseAmt = allPurchaseTotals.reduce((a, x) => a + x.amt, 0);
  const grandPurchasePaid = allPurchaseTotals.reduce((a, x) => a + x.paid, 0);
  const grandPurchaseRem = grandPurchaseAmt - grandPurchasePaid;
  const grandPurchaseNw = allPurchaseTotals.reduce((a, x) => a + x.nw, 0);
  const grandPurchaseTw = allPurchaseTotals.reduce((a, x) => a + x.tw, 0);

  const netMargin = grandAmt - grandPurchaseAmt;

  const topClients = [...allTotals].sort((a, b) => b.amt - a.amt).slice(0, 5);
  const debtors = allTotals.filter(x => x.amt - x.paid > 0).sort((a, b) => (b.amt - b.paid) - (a.amt - a.paid));

  const collectionRate = grandAmt ? Math.round((grandPaid / grandAmt) * 100) : 0;
  const yieldRatio = grandTw ? Math.round((grandNw / grandTw) * 100) : 0;
  const shrinkageRate = grandTw ? parseFloat((((grandTw - grandNw) / grandTw) * 100).toFixed(1)) : 0;
  const isHighShrinkage = shrinkageRate > 5.0;

  // --- DAILY CASH BOOK LEDGER ---
  const days = new Date(y, m, 0).getDate();
  const dailyCashFlow = [];
  let cumulativeCash = 0;

  for (let d = 1; d <= days; d++) {
    let inflow = 0;
    let outflow = 0;

    // Compile customer payments (Inflow)
    state.clients.forEach(cl => {
      const k = `${cl.id}-${y}-${m}`;
      const rows = state.ledger[k];
      if (rows) {
        const row = rows.find(r => r.d === d);
        if (row && row.paid) {
          inflow += parseFloat(row.paid) || 0;
        }
      }
    });

    // Compile supplier payments (Outflow)
    (state.suppliers || []).forEach(sup => {
      const k = `${sup.id}-${y}-${m}`;
      const rows = state.purchases?.[k];
      if (rows) {
        const row = rows.find(r => r.d === d);
        if (row && row.paid) {
          outflow += parseFloat(row.paid) || 0;
        }
      }
    });

    if (inflow > 0 || outflow > 0) {
      const net = inflow - outflow;
      cumulativeCash += net;
      dailyCashFlow.push({
        day: d,
        inflow,
        outflow,
        net,
        cumulative: cumulativeCash
      });
    }
  }

  const totalInflow = dailyCashFlow.reduce((sum, item) => sum + item.inflow, 0);
  const totalOutflow = dailyCashFlow.reduce((sum, item) => sum + item.outflow, 0);
  const totalNet = totalInflow - totalOutflow;

  // Generate 6 months of historical data for the chart
  const chartData = [];
  for (let i = 5; i >= 0; i--) {
    let targetM = m - i;
    let targetY = y;
    if (targetM <= 0) {
      targetM += 12;
      targetY -= 1;
    }
    
    // Calculate sales total for this target month
    const mSales = state.clients.reduce((sum, cl) => {
      const totals = getTotals(state.ledger, cl.id, targetY, targetM);
      return sum + totals.amt;
    }, 0);
    
    // Calculate purchases total for this target month
    const mPurchases = (state.suppliers || []).reduce((sum, sup) => {
      const totals = getTotals(state.purchases || {}, sup.id, targetY, targetM);
      return sum + totals.amt;
    }, 0);
    
    const mMargin = mSales - mPurchases;
    
    chartData.push({
      monthLabel: `${MONTHS.at(targetM - 1)} ${targetY}`,
      sales: mSales,
      purchases: mPurchases,
      margin: mMargin
    });
  }

  // Finding maximum value to scale SVG elements beautifully
  const maxSales = Math.max(...chartData.map(d => d.sales), 0);
  const maxPurchases = Math.max(...chartData.map(d => d.purchases), 0);
  const maxVal = Math.max(maxSales, maxPurchases, 1000); // safety fallback of 1000 DT

  // Generate plotting points for pure SVG path rendering
  const points = chartData.map((d, idx) => {
    const cx = 60 + idx * 104;
    const ySales = 205 - ((d.sales / maxVal) * 180);
    const yPurchases = 205 - ((d.purchases / maxVal) * 180);
    const yMargin = 205 - ((Math.max(d.margin, 0) / maxVal) * 180);
    return { cx, ySales, yPurchases, yMargin };
  });

  const salesLinePath = "M " + points.map(p => `${p.cx} ${p.ySales}`).join(" L ");
  const salesAreaPath = `M ${points[0].cx} 205 L ` + points.map(p => `${p.cx} ${p.ySales}`).join(" L ") + ` L ${points[5].cx} 205 Z`;

  const purchasesLinePath = "M " + points.map(p => `${p.cx} ${p.yPurchases}`).join(" L ");
  const purchasesAreaPath = `M ${points[0].cx} 205 L ` + points.map(p => `${p.cx} ${p.yPurchases}`).join(" L ") + ` L ${points[5].cx} 205 Z`;

  const marginLinePath = "M " + points.map(p => `${p.cx} ${p.yMargin}`).join(" L ");
  const marginAreaPath = `M ${points[0].cx} 205 L ` + points.map(p => `${p.cx} ${p.yMargin}`).join(" L ") + ` L ${points[5].cx} 205 Z`;

  const handleFileImport = (event) => {
    const file = event.target.files[0];
    if (file) {
      onBackupImport(file);
    }
  };

  // Framer Motion Animation Settings
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 15 } }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* SECTION HEADER */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-900/40 border border-slate-800/60 backdrop-blur-md rounded-2xl p-4 md:p-6 shadow-sm">
        <div className="text-right">
          <h2 className="text-xl md:text-2xl font-black bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
            لوحة القيادة الرئيسية — {MONTHS.at(m - 1)} {y}
          </h2>
          <p className="text-xs text-slate-400 font-medium mt-1">{state.clients.length} عميل نشط مسجل في النظام</p>
        </div>
        <div className="flex gap-2.5 items-center w-full sm:w-auto">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold text-xs flex items-center justify-center gap-2 border transition-all duration-200 ${
              showSettings 
                ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-lg shadow-amber-500/10' 
                : 'bg-slate-900/60 text-slate-300 border-slate-850 hover:border-amber-500/40 hover:text-amber-400'
            }`}
            onClick={() => setShowSettings(!showSettings)}
          >
            <span>⚙️</span>
            <span>{showSettings ? "إخفاء الإعدادات" : "إعدادات النظام"}</span>
          </motion.button>
        </div>
      </motion.div>

      {/* STAT CARDS */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {[
          { label: "إجمالي المبيعات", val: fmt(grandAmt) || "—", sub: "لجميع العملاء", color: "border-t-amber-400/80 text-amber-400 bg-gradient-to-br from-amber-500/5 to-transparent" },
          { label: "إجمالي المشتريات", val: fmt(grandPurchaseAmt) || "—", sub: "من جميع الموردين", color: "border-t-sky-400/80 text-sky-400 bg-gradient-to-br from-sky-500/5 to-transparent" },
          { 
            label: "صافي الأرباح (الهامش)", 
            val: fmt(netMargin) || "—", 
            sub: "الأرباح المتوقعة", 
            color: netMargin >= 0 
              ? "border-t-emerald-400/80 text-emerald-400 bg-gradient-to-br from-emerald-500/5 to-transparent" 
              : "border-t-red-500/80 text-red-400 bg-gradient-to-br from-red-500/5 to-transparent" 
          },
          { label: "ديون العملاء المعلقة", val: fmt(grandRem) || "—", sub: `${debtors.length} عملاء عليهم ديون`, color: grandRem > 0 ? "border-t-red-400/80 text-red-400 bg-gradient-to-br from-red-500/5 to-transparent" : "border-t-emerald-400/80 text-emerald-400 bg-gradient-to-br from-emerald-500/5 to-transparent" },
          { label: "مستحقات الموردين", val: fmt(grandPurchaseRem) || "—", sub: "ديون المشتريات المتبقية علينا", color: grandPurchaseRem > 0 ? "border-t-orange-400/80 text-orange-400 bg-gradient-to-br from-orange-500/5 to-transparent" : "border-t-emerald-400/80 text-emerald-400 bg-gradient-to-br from-emerald-500/5 to-transparent" },
          { label: "الوزن الصافي المبيع", val: `${Math.round(grandNw)} كغ`, sub: `الكامل: ${Math.round(grandTw)} كغ`, color: "border-t-amber-400/80 text-amber-400 bg-gradient-to-br from-amber-500/5 to-transparent" },
          { label: "الوزن الصافي المشتري", val: `${Math.round(grandPurchaseNw)} كغ`, sub: `الكامل: ${Math.round(grandPurchaseTw)} كغ`, color: "border-t-sky-400/80 text-sky-400 bg-gradient-to-br from-sky-500/5 to-transparent" },
          { label: "نسبة تحصيل الديون", val: `${collectionRate}%`, sub: "كفاءة تحصيل المبيعات", color: "border-t-emerald-400/80 text-emerald-400 bg-gradient-to-br from-emerald-500/5 to-transparent" },
          { 
            label: "معدل مردودية الوزن والفاقد", 
            val: `${yieldRatio}%`, 
            sub: (
              <div className="flex justify-between items-center w-full mt-2 border-t border-slate-800/40 pt-1.5">
                <span className="text-[10px] text-slate-500">معدل الفاقد: {shrinkageRate}%</span>
                {shrinkageRate > 0 && (
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-full select-none ${
                    isHighShrinkage 
                      ? 'bg-red-500/10 text-red-400 border border-red-500/20 animate-pulse' 
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}>
                    {isHighShrinkage ? '⚠️ فاقد مرتفع' : '✓ مردود طبيعي'}
                  </span>
                )}
              </div>
            ), 
            color: isHighShrinkage 
              ? "border-t-red-400/80 text-red-400 bg-gradient-to-br from-red-500/5 to-transparent" 
              : "border-t-emerald-400/80 text-emerald-400 bg-gradient-to-br from-emerald-500/5 to-transparent"
          }
        ].map((st, i) => (
          <Atropos key={i} rotateXMax={10} rotateYMax={10} shadow={false} className="w-full" rotateTouch={false}>
            <div className={`h-full border border-slate-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden transition-all duration-300 hover:border-slate-700/80 border-t-[4px] bg-slate-900/30 backdrop-blur-sm ${st.color}`}>
              <div className="text-xs text-slate-400 font-semibold mb-2">{st.label}</div>
              <div className="text-xl md:text-2xl font-black tracking-tight font-mono">{st.val}</div>
              <div className="text-[10px] text-slate-500 mt-2 font-medium">{st.sub}</div>
            </div>
          </Atropos>
        ))}
      </motion.div>

      {/* FINANCIAL TRENDS CHART PANEL */}
      <motion.div 
        variants={itemVariants} 
        className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 md:p-6 shadow-lg relative overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
          <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 justify-start text-right w-full sm:w-auto">
            <span>📈</span>
            <span>مؤشرات التطور المالي (الـ 6 أشهر الأخيرة)</span>
          </h3>
          
          {/* Chart Type Toggle Pill */}
          <div className="flex bg-slate-950/80 p-1 border border-slate-850 rounded-xl self-end">
            <button 
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all duration-200 ${
                chartType === 'line' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setChartType('line')}
            >
              📈 منحنى بياني
            </button>
            <button 
              className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all duration-200 ${
                chartType === 'bar' 
                  ? 'bg-amber-500 text-slate-950 shadow-md' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              onClick={() => setChartType('bar')}
            >
              📊 أعمدة متقاربة
            </button>
          </div>
        </div>

        {/* Real-time Glowing Inspector (Detail Bar) */}
        {(() => {
          const inspectIndex = hoveredIdx !== null ? hoveredIdx : 5;
          const inspectItem = chartData[inspectIndex];
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 mb-6 bg-slate-950/50 border border-slate-850/60 rounded-xl text-right transition-all duration-300">
              <div>
                <span className="text-[10px] text-slate-500 block font-semibold">الشهر المحدد</span>
                <span className="text-xs font-black text-amber-300 mt-1 block">{inspectItem.monthLabel}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-semibold">المبيعات الإجمالية</span>
                <span className="text-xs font-black text-amber-400 mt-1 block font-mono">{fmt(inspectItem.sales)} د.ت</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-semibold">المشتريات الإجمالية</span>
                <span className="text-xs font-black text-sky-400 mt-1 block font-mono">{fmt(inspectItem.purchases)} د.ت</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block font-semibold text-slate-500">الصافي (الهامش)</span>
                <span className={`text-xs font-black mt-1 block font-mono ${
                  inspectItem.margin >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {inspectItem.margin >= 0 ? '+' : ''}{fmt(inspectItem.margin)} د.ت
                </span>
              </div>
            </div>
          );
        })()}

        {/* SVG PLOTTING VIEWPORT */}
        <div className="w-full overflow-x-auto pr-1 scrollbar-none">
          <div className="min-w-[560px]">
            <svg 
              viewBox="0 0 600 240" 
              className="w-full h-auto text-slate-300"
              style={{ direction: 'ltr' }}
            >
              <defs>
                <linearGradient id="sales-area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4a843" stopOpacity="0.25"/>
                  <stop offset="100%" stopColor="#d4a843" stopOpacity="0.00"/>
                </linearGradient>
                <linearGradient id="purchases-area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25"/>
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.00"/>
                </linearGradient>
                <linearGradient id="margin-area-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25"/>
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0.00"/>
                </linearGradient>
              </defs>

              {/* Reference Grid lines */}
              {[25, 70, 115, 160, 205].map((yVal, idx) => (
                <line 
                  key={idx}
                  x1="60" 
                  y1={yVal} 
                  x2="580" 
                  y2={yVal} 
                  stroke="var(--border)" 
                  strokeWidth="1" 
                  strokeDasharray={yVal === 205 ? "0" : "4,4"} 
                  opacity={yVal === 205 ? "0.6" : "0.3"} 
                />
              ))}

              {/* Y Axis Reference Labels */}
              {[
                { y: 25, val: maxVal },
                { y: 115, val: maxVal / 2 },
                { y: 205, val: 0 }
              ].map((lbl, idx) => (
                <text 
                  key={idx}
                  x="50" 
                  y={lbl.y} 
                  textAnchor="end" 
                  dominantBaseline="middle" 
                  className="text-[9px] fill-slate-500 font-mono font-bold"
                >
                  {lbl.val >= 1000 ? `${Math.round(lbl.val / 1000)}k` : Math.round(lbl.val)}
                </text>
              ))}

              {/* Month Labels X Axis */}
              {chartData.map((d, idx) => {
                const cx = 60 + idx * 104;
                return (
                  <text 
                    key={idx} 
                    x={cx} 
                    y="225" 
                    textAnchor="middle" 
                    className="text-[9px] fill-slate-400 font-bold"
                  >
                    {d.monthLabel.split(' ')[0]}
                  </text>
                );
              })}

              {/* RENDER LINE CHART */}
              {chartType === 'line' && (
                <>
                  {/* Volumetric Gradient Areas */}
                  <motion.path 
                    d={salesAreaPath} 
                    fill="url(#sales-area-grad)" 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                  />
                  <motion.path 
                    d={purchasesAreaPath} 
                    fill="url(#purchases-area-grad)" 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.6 }}
                  />

                  {/* Main Glowing Curved Paths */}
                  <motion.path 
                    d={salesLinePath} 
                    fill="none" 
                    stroke="#d4a843" 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.0, ease: "easeOut" }}
                  />
                  <motion.path 
                    d={purchasesLinePath} 
                    fill="none" 
                    stroke="#3b82f6" 
                    strokeWidth="3.5" 
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.0, ease: "easeOut" }}
                  />

                  {/* Connecting Nodes (Circles) */}
                  {points.map((p, idx) => (
                    <g key={idx}>
                      {/* Sales Node */}
                      <circle 
                        cx={p.cx} 
                        cy={p.ySales} 
                        r={hoveredIdx === idx ? "6" : "4"} 
                        fill="#d4a843" 
                        stroke="#0f172a" 
                        strokeWidth="2" 
                        style={{ transition: 'all 0.2s ease' }}
                      />
                      {/* Purchases Node */}
                      <circle 
                        cx={p.cx} 
                        cy={p.yPurchases} 
                        r={hoveredIdx === idx ? "6" : "4"} 
                        fill="#3b82f6" 
                        stroke="#0f172a" 
                        strokeWidth="2" 
                        style={{ transition: 'all 0.2s ease' }}
                      />
                    </g>
                  ))}
                </>
              )}

              {/* RENDER GROUPED BAR CHART */}
              {chartType === 'bar' && (
                <g>
                  {chartData.map((d, idx) => {
                    const cx = 60 + idx * 104;
                    
                    const hSales = (d.sales / maxVal) * 180;
                    const ySales = 205 - hSales;
                    
                    const hPurchases = (d.purchases / maxVal) * 180;
                    const yPurchases = 205 - hPurchases;

                    const hMargin = (Math.max(d.margin, 0) / maxVal) * 180;
                    const yMargin = 205 - hMargin;

                    return (
                      <g key={idx} opacity={hoveredIdx === null || hoveredIdx === idx ? "1" : "0.5"} style={{ transition: 'opacity 0.2s ease' }}>
                        {/* Sales Bar (Golden) */}
                        <motion.rect
                          x={cx - 24}
                          y={205}
                          width="14"
                          rx="3"
                          fill="#d4a843"
                          initial={{ height: 0, y: 205 }}
                          animate={{ height: hSales, y: ySales }}
                          transition={{ type: "spring", stiffness: 80, damping: 14, delay: idx * 0.04 }}
                        />
                        {/* Purchases Bar (Sky Blue) */}
                        <motion.rect
                          x={cx - 7}
                          y={205}
                          width="14"
                          rx="3"
                          fill="#3b82f6"
                          initial={{ height: 0, y: 205 }}
                          animate={{ height: hPurchases, y: yPurchases }}
                          transition={{ type: "spring", stiffness: 80, damping: 14, delay: idx * 0.04 + 0.02 }}
                        />
                        {/* Margin Bar (Emerald) */}
                        <motion.rect
                          x={cx + 10}
                          y={205}
                          width="14"
                          rx="3"
                          fill="#22c55e"
                          initial={{ height: 0, y: 205 }}
                          animate={{ height: hMargin, y: yMargin }}
                          transition={{ type: "spring", stiffness: 80, damping: 14, delay: idx * 0.04 + 0.04 }}
                        />
                      </g>
                    );
                  })}
                </g>
              )}

              {/* Hover Interceptor Overlays (Invisible Vertical Pillars) */}
              {points.map((p, idx) => (
                <rect
                  key={idx}
                  x={p.cx - 52}
                  y="20"
                  width="104"
                  height="190"
                  fill="transparent"
                  style={{ cursor: 'pointer', webkitTapHighlightColor: 'transparent' }}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  onTouchStart={() => setHoveredIdx(idx)}
                  onTouchEnd={() => setHoveredIdx(null)}
                />
              ))}
            </svg>
          </div>
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-6 mt-4 text-[10px] font-bold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#d4a843] block"></span>
            <span className="text-slate-300">📈 المبيعات (Ventes)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#3b82f6] block"></span>
            <span className="text-slate-300">📉 المشتريات (Achats)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#22c55e] block"></span>
            <span className="text-slate-300">❇️ صافي المرجعية</span>
          </div>
        </div>
      </motion.div>

      {/* PWA INSTALLATION BANNER */}
      {!isStandalone && (
        <motion.div 
          variants={itemVariants}
          className="relative bg-gradient-to-r from-amber-500/10 via-slate-900/70 to-slate-900/70 border border-amber-500/20 backdrop-blur-md rounded-2xl p-5 md:p-6 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4 overflow-hidden"
        >
          {/* Subtle decoration light inside banner */}
          <div className="absolute top-[-50%] left-[-20%] w-[30%] h-[150%] bg-amber-500/10 rotate-12 blur-[40px] pointer-events-none" />
          
          <div className="flex gap-4 items-center text-right z-10">
            <div className="text-3xl p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl leading-none">📲</div>
            <div>
              <h3 className="text-base font-extrabold text-amber-300">تثبيت التطبيق على جهازك</h3>
              <p className="text-xs text-slate-400 font-medium mt-1">ثبّت تطبيق الودرني للدواجن على هاتفك أو حاسوبك للوصول السريع وتسهيل المتابعة اليومية</p>
            </div>
          </div>
          
          <motion.button 
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="btn bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 text-slate-950 font-black text-xs py-3 px-6 rounded-xl shadow-lg shadow-amber-500/10 z-10 w-full md:w-auto"
            onClick={installPrompt ? onInstallApp : onShowInstallGuide}
          >
            {installPrompt ? '📥 تثبيت الآن' : '📲 دليل التثبيت'}
          </motion.button>
        </motion.div>
      )}

      {/* CHARTS / DETAILS GRID */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* TOP CLIENTS BAR CHART / LIST */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 md:p-6 shadow-lg">
          <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 mb-6 justify-start">
            <span>🏆</span>
            <span>أكثر العملاء مشتريات (هذا الشهر)</span>
          </h3>
          
          {topClients.length === 0 ? (
            <div className="text-slate-500 text-xs py-12 text-center">لا توجد بيانات متاحة لهذا الشهر</div>
          ) : (
            <div className="space-y-4">
              {topClients.map((cl, i) => {
                const pct = grandAmt ? Math.round(cl.amt / grandAmt * 100) : 0;
                return (
                  <motion.div 
                    whileHover={{ x: -2 }}
                    key={cl.id} 
                    className="group cursor-pointer text-right" 
                    onClick={() => onSelectClient(cl.id)}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2.5">
                        <div 
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black text-slate-950 shadow-md group-hover:scale-105 transition-transform"
                          style={{ background: getClientColor(cl.color) }}
                        >
                          {i + 1}
                        </div>
                        <span className="text-xs font-bold text-slate-200 group-hover:text-amber-300 transition-colors">{cl.name}</span>
                      </div>
                      <span className="text-xs font-extrabold text-amber-400/90 font-mono">{fmt(cl.amt) || "—"}</span>
                    </div>
                    {/* Visual Progress Bar Wrapper */}
                    <div className="w-full bg-slate-950/60 rounded-full h-2.5 overflow-hidden border border-slate-800/40 p-[1px]">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="h-full rounded-full"
                        style={{ background: getClientColor(cl.color) }}
                      />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* DEBTORS / ACCOUNTS RECEIVABLE LIST */}
        <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 md:p-6 shadow-lg">
          <h3 className="text-sm font-black text-red-400 flex items-center gap-2 mb-6 justify-start">
            <span>⚠️</span>
            <span>حسابات الديون المعلقة</span>
          </h3>
          
          {debtors.length === 0 ? (
            <div className="text-emerald-400 text-xs py-12 text-center font-bold">🎉 جميع الحسابات مسوّاة بشكل كامل</div>
          ) : (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin">
              {debtors.map(cl => (
                <motion.div 
                  whileHover={{ scale: 1.01, x: -2 }}
                  key={cl.id} 
                  className="flex justify-between items-center p-3 bg-red-500/5 hover:bg-red-500/10 border border-red-500/10 hover:border-red-500/20 rounded-xl cursor-pointer transition-all duration-200 text-right"
                  onClick={() => onSelectClient(cl.id)}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-bold text-slate-200">{cl.name}</span>
                    <span className="text-[10px] text-slate-500 font-semibold">{cl.address || "—"}</span>
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-black text-red-400 block font-mono">{fmt(cl.amt - cl.paid)}</span>
                    <span className="text-[9px] text-slate-500 block font-medium">متبقي بذمته</span>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* DAILY CASH BOOK LEDGER (Caisse de l'Admin) */}
      {state.role !== 'driver' && (
        <motion.div 
          variants={itemVariants} 
          className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 md:p-6 shadow-lg relative overflow-hidden text-right"
        >
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="text-right">
              <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 justify-start">
                <span>💰</span>
                <span>دفتر حركة النقود اليومي (Caisse)</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-medium mt-1">تتبع التدفقات النقدية الداخلة والخارجة بالخزينة بشكل تسلسلي</p>
            </div>
            
            <div className="flex items-center gap-3 select-none flex-wrap">
              <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-3 py-1.5 text-center">
                <span className="text-[9px] text-slate-500 font-bold block">إجمالي المقبوضات</span>
                <span className="text-xs font-black text-emerald-400 font-mono">{fmt(totalInflow)} د.ت</span>
              </div>
              <div className="bg-sky-500/5 border border-sky-500/10 rounded-xl px-3 py-1.5 text-center">
                <span className="text-[9px] text-slate-500 font-bold block">إجمالي المدفوعات</span>
                <span className="text-xs font-black text-sky-400 font-mono">{fmt(totalOutflow)} د.ت</span>
              </div>
              <div className={`border rounded-xl px-3 py-1.5 text-center ${
                totalNet >= 0 ? 'bg-amber-500/5 border-amber-500/10' : 'bg-red-500/5 border-red-500/10'
              }`}>
                <span className="text-[9px] text-slate-500 font-bold block">صافي الخزينة</span>
                <span className={`text-xs font-black font-mono ${totalNet >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  {totalNet >= 0 ? '+' : ''}{fmt(totalNet)} د.ت
                </span>
              </div>
            </div>
          </div>

          {dailyCashFlow.length === 0 ? (
            <div className="text-slate-500 text-xs py-12 text-center font-medium">لا توجد حركات مقبوضات أو مدفوعات نقدية مسجلة لهذا الشهر</div>
          ) : (
            <div className="overflow-x-auto select-none rounded-xl border border-slate-800/60 max-h-[350px] overflow-y-auto pr-1">
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="bg-slate-950/40 text-slate-400 font-bold border-b border-slate-800/80">
                    <th className="py-3 px-4">اليوم</th>
                    <th className="py-3 px-4">المداخيل (مقبوضات المبيعات)</th>
                    <th className="py-3 px-4">المصاريف (مدفوعات المشتريات)</th>
                    <th className="py-3 px-4">صافي التدفق اليومي</th>
                    <th className="py-3 px-4">الرصيد التراكمي للخزينة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-medium">
                  {dailyCashFlow.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-900/35 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-slate-300">
                        اليوم {String(item.day).padStart(2, '0')}
                      </td>
                      <td className="py-3 px-4 text-emerald-400 font-mono font-bold">
                        {item.inflow > 0 ? `+${fmt(item.inflow)}` : '—'}
                      </td>
                      <td className="py-3 px-4 text-sky-400 font-mono font-bold">
                        {item.outflow > 0 ? `-${fmt(item.outflow)}` : '—'}
                      </td>
                      <td className={`py-3 px-4 font-mono font-bold ${
                        item.net >= 0 ? 'text-amber-400' : 'text-red-400'
                      }`}>
                        {item.net >= 0 ? '+' : ''}{fmt(item.net)}
                      </td>
                      <td className="py-3 px-4 font-mono font-black text-slate-200">
                        {fmt(item.cumulative)} د.ت
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      )}

      {/* SETTINGS AREA */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0, height: 0, y: 15 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: 15 }}
            transition={{ duration: 0.4, cubicBezier: [0.16, 1, 0.3, 1] }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 overflow-hidden pt-4 border-t border-slate-800/40"
          >
            {/* DEFAULT PRICE CARD */}
            <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 mb-4 justify-start">
                  <span>⚙️</span>
                  <span>إعدادات السعر الافتراضي</span>
                </h3>
                
                <div className="space-y-4 text-right">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">سعر الكيلوغرام الافتراضي (د.ت)</label>
                    <input 
                      type="number" 
                      step="0.001"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 text-left font-mono" 
                      value={state.pricePerKg} 
                      onChange={(e) => onPriceChange(parseFloat(e.target.value) || 0)} 
                      placeholder="5.800"
                    />
                    <p className="text-[10px] text-slate-500 mt-1.5 font-medium">يُعتمد للتسعير التلقائي الفوري للوزن الصافي</p>
                  </div>
                </div>
              </div>
              
              <div className="p-3 bg-slate-950 rounded-xl text-xs flex justify-between items-center mt-6 border border-slate-900">
                <span className="text-slate-500 font-bold">المردودية:</span>
                <span className="text-emerald-400 font-black font-mono">{fmt(100 * state.pricePerKg)} د.ت / 100كغ</span>
              </div>
            </div>

            {/* PASSWORD SECURITY CARD */}
            <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 mb-4 justify-start">
                  <span>🔒</span>
                  <span>تغيير كلمة مرور الإدارة</span>
                </h3>
                
                <div className="space-y-4 text-right">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">كلمة المرور الجديدة</label>
                    <input 
                      type="password"
                      className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 text-left font-mono"
                      id="new-dashboard-password"
                      placeholder="أدخل كلمة المرور الجديدة"
                    />
                  </div>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs py-3 px-4 rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2 mt-6"
                onClick={() => {
                  const el = document.getElementById("new-dashboard-password");
                  const newPass = el?.value?.trim();
                  if (!newPass) {
                    alert("الرجاء إدخال كلمة مرور صالحة");
                    return;
                  }
                  onChangePassword(newPass);
                  if (el) el.value = "";
                }}
              >
                💾 تحديث كلمة المرور
              </motion.button>
            </div>

            {/* DATA MANAGEMENT CARD */}
            <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 shadow-lg flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 mb-4 justify-start">
                  <span>📁</span>
                  <span>إدارة البيانات والنسخ الاحتياطي</span>
                </h3>
                <p className="text-xs text-slate-400 font-medium leading-relaxed mb-4 text-right">
                  حمل نسخة كاملة من بيانات النظام أو استعدها من ملف خارجي بأمان لضمان عدم ضياع أي فاتورة.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 mt-4">
                <motion.button 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-slate-200 hover:text-amber-400 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2"
                  onClick={onBackupExport}
                >
                  <span>📤</span>
                  <span>تصدير ملف النسخة الاحتياطية (JSON)</span>
                </motion.button>

                <label className="w-full py-2.5 px-4 bg-slate-950 hover:bg-slate-900 border border-slate-800 hover:border-amber-500/40 text-slate-200 hover:text-amber-400 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer text-center">
                  <span>📥</span>
                  <span>استيراد نسخة احتياطية (JSON)</span>
                  <input type="file" accept=".json" onChange={handleFileImport} className="hidden" />
                </label>

                {import.meta.env.VITE_SUPABASE_URL && !import.meta.env.VITE_SUPABASE_URL.includes('your-supabase-project') && (
                  <>
                    <div className="border-t border-slate-800/40 my-1"></div>
                    
                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-2.5 px-4 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-550/20 hover:border-amber-500/55 text-amber-300 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2"
                      onClick={() => onBackupCloudExport()}
                    >
                      <span>☁️ 📤</span>
                      <span>نسخ احتياطي سحابي مشفر</span>
                    </motion.button>

                    <motion.button 
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-2.5 px-4 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-550/20 hover:border-emerald-500/55 text-emerald-300 rounded-xl font-bold text-xs transition-all duration-200 flex items-center justify-center gap-2"
                      onClick={() => onBackupCloudRestore()}
                    >
                      <span>☁️ 📥</span>
                      <span>استرجاع نسخة مشفرة من السحابة</span>
                    </motion.button>
                  </>
                )}
              </div>
            </div>

            {/* COMPANY SETTINGS CARD (FULL WIDTH IN DRAWER) */}
            <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 md:p-6 shadow-lg col-span-1 md:col-span-2 lg:col-span-3">
              <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 mb-5 justify-start">
                <span>🏢</span>
                <span>إعدادات هوية المؤسسة ورأس الفاتورة</span>
              </h3>
              
              <form 
                key={`${state.companyInfo?.name || ""}-${state.companyInfo?.address || ""}-${state.companyInfo?.phone || ""}-${state.companyInfo?.taxId || ""}-${state.companyInfo?.invoiceTemplate || ""}-${state.companyInfo?.invoiceFooter || ""}-${state.companyInfo?.invoiceLogoUrl || ""}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  const newName = e.target.elements.compName.value.trim();
                  const newAddr = e.target.elements.compAddr.value.trim();
                  const newPhone = e.target.elements.compPhone.value.trim();
                  const newTaxId = e.target.elements.compTaxId.value.trim();
                  const newTemplate = e.target.elements.invoiceTemplate.value;
                  const newFooter = e.target.elements.invoiceFooter.value.trim();
                  const newLogoUrl = e.target.elements.invoiceLogoUrl.value.trim();
                  if (!newName) {
                    alert("الرجاء إدخال اسم الشركة");
                    return;
                  }
                  onUpdateCompanyInfo({
                    name: newName,
                    address: newAddr || "—",
                    phone: newPhone || "—",
                    taxId: newTaxId || "—",
                    invoiceTemplate: newTemplate || "classic",
                    invoiceFooter: newFooter || "",
                    invoiceLogoUrl: newLogoUrl || ""
                  });
                }} 
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-right"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">اسم الشركة الموزعة *</label>
                  <input 
                    type="text"
                    name="compName"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200"
                    defaultValue={state.companyInfo?.name || "الودرني للدواجن"}
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">العنوان الجغرافي للشركة</label>
                  <input 
                    type="text"
                    name="compAddr"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200"
                    defaultValue={state.companyInfo?.address || "وادي النور الحامة,قابس"}
                    placeholder="وادي النور الحامة,قابس"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">رقم الهاتف للشركة</label>
                  <input 
                    type="text"
                    name="compPhone"
                    dir="ltr"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 input-ltr"
                    defaultValue={state.companyInfo?.phone || "96 101 651"}
                    placeholder="96 101 651"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">المعرف الجبائي للمؤسسة (Matricule Fiscal)</label>
                  <input 
                    type="text"
                    name="compTaxId"
                    dir="ltr"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 input-ltr font-mono"
                    defaultValue={state.companyInfo?.taxId || "1895235/E"}
                    placeholder="1895235/E"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">نموذج الفاتورة الافتراضي</label>
                  <select 
                    name="invoiceTemplate"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 cursor-pointer"
                    defaultValue={state.companyInfo?.invoiceTemplate || "classic"}
                  >
                    <option value="classic" className="bg-slate-950 text-slate-100">A4 كلاسيكي ذهبي</option>
                    <option value="receipt" className="bg-slate-950 text-slate-100">وصول حراري (Ticket 80mm)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">رابط شعار المؤسسة (Logo URL)</label>
                  <input 
                    type="url"
                    name="invoiceLogoUrl"
                    dir="ltr"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-555/40 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200 input-ltr"
                    defaultValue={state.companyInfo?.invoiceLogoUrl || ""}
                    placeholder="https://example.com/logo.png"
                  />
                </div>
                <div className="col-span-1 sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1.5">ملاحظة أو تذييل أسفل الفاتورة</label>
                  <input 
                    type="text"
                    name="invoiceFooter"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-2.5 px-3.5 text-xs text-slate-100 placeholder-slate-650 outline-none transition-all duration-200"
                    defaultValue={state.companyInfo?.invoiceFooter || ""}
                    placeholder="مثال: شكراً لثقتكم بنا، الرجاء تسوية الديون في الآجال المتفق عليها."
                  />
                </div>
                
                <div className="col-span-1 sm:col-span-2 lg:col-span-4 mt-3">
                  <motion.button 
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    type="submit" 
                    className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-extrabold text-xs py-3 px-6 rounded-xl shadow-md transition-all duration-200 flex items-center justify-center gap-2"
                  >
                    💾 حفظ وتحديث هوية المؤسسة
                  </motion.button>
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
