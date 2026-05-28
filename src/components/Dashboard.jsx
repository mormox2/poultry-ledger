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
  onShowInstallGuide
}) {
  const [showSettings, setShowSettings] = useState(false);
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
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 gap-4">
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
          { label: "نسبة تحصيل الديون", val: `${collectionRate}%`, sub: "كفاءة تحصيل المبيعات", color: "border-t-emerald-400/80 text-emerald-400 bg-gradient-to-br from-emerald-500/5 to-transparent" }
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
              </div>
            </div>

            {/* COMPANY SETTINGS CARD (FULL WIDTH IN DRAWER) */}
            <div className="bg-slate-900/30 backdrop-blur-md border border-slate-800/80 rounded-2xl p-5 md:p-6 shadow-lg col-span-1 md:col-span-2 lg:col-span-3">
              <h3 className="text-sm font-black text-amber-300 flex items-center gap-2 mb-5 justify-start">
                <span>🏢</span>
                <span>إعدادات هوية المؤسسة ورأس الفاتورة</span>
              </h3>
              
              <form 
                key={`${state.companyInfo?.name || ""}-${state.companyInfo?.address || ""}-${state.companyInfo?.phone || ""}-${state.companyInfo?.taxId || ""}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  const newName = e.target.elements.compName.value.trim();
                  const newAddr = e.target.elements.compAddr.value.trim();
                  const newPhone = e.target.elements.compPhone.value.trim();
                  const newTaxId = e.target.elements.compTaxId.value.trim();
                  if (!newName) {
                    alert("الرجاء إدخال اسم الشركة");
                    return;
                  }
                  onUpdateCompanyInfo({
                    name: newName,
                    address: newAddr || "—",
                    phone: newPhone || "—",
                    taxId: newTaxId || "—"
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
