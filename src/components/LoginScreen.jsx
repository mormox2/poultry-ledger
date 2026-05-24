import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Atropos from 'atropos/react';
import 'atropos/css';
import { supabase } from '../js/supabaseClient';

export default function LoginScreen({ savedPassword, onLogin, onSetPassword, onCloudLogin }) {
  // Input fields state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // UI states
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Detect if Supabase has been filled in the environment variables
  const isSupabaseConfigured = 
    import.meta.env.VITE_SUPABASE_URL && 
    !import.meta.env.VITE_SUPABASE_URL.includes('your-supabase-project');

  // Local setup mode if no password has ever been saved
  const isLocalSetupMode = !savedPassword;

  const triggerError = (msg = '') => {
    setShake(true);
    if (msg) setErrorMsg(msg);
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    setTimeout(() => {
      setShake(false);
    }, 500);
  };

  const handleLocalSubmit = async (e) => {
    e.preventDefault();
    if (isLocalSetupMode) {
      if (!password.trim()) {
        triggerError("الرجاء إدخال كلمة مرور صالحة");
        return;
      }
      if (password !== confirmPassword) {
        triggerError("كلمات المرور غير متطابقة !");
        return;
      }
      onSetPassword(password.trim());
    } else {
      // 1. Verify using the new salted hashing format
      const PASSWORD_SALT = 'dawajin_pro_secure_salt_983756291';
      const encoder = new TextEncoder();
      const saltedData = encoder.encode(password.trim() + PASSWORD_SALT);
      const saltedHashBuffer = await crypto.subtle.digest('SHA-256', saltedData);
      const saltedHashArray = Array.from(new Uint8Array(saltedHashBuffer));
      const saltedHashed = saltedHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (saltedHashed === savedPassword) {
        onLogin();
        return;
      }

      // 2. Fallback migration path: verify using the old unsalted format
      const unsaltedData = encoder.encode(password.trim());
      const unsaltedHashBuffer = await crypto.subtle.digest('SHA-256', unsaltedData);
      const unsaltedHashArray = Array.from(new Uint8Array(unsaltedHashBuffer));
      const unsaltedHashed = unsaltedHashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (unsaltedHashed === savedPassword) {
        // Upgrade password locally to the new salted hash
        onSetPassword(password.trim());
        onLogin();
      } else {
        triggerError("كلمة المرور غير صحيحة !");
      }
    }
  };

  const handleCloudSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    if (!email.trim() || !password.trim()) {
      triggerError("الرجاء تعبئة جميع الحقول المطلوبة.");
      setLoading(false);
      return;
    }

    try {
      // Logging in an existing user
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password.trim()
      });

      if (error) throw error;

      if (data?.session && data?.user) {
        onCloudLogin(data.session, data.user);
      }
    } catch (err) {
      console.error("Auth error:", err);
      let friendlyMsg = err.message || "فشل الاتصال بالخادم.";
      if (friendlyMsg.includes("Invalid login credentials")) {
        friendlyMsg = "البريد الإلكتروني أو كلمة المرور غير صحيحة !";
      } else if (friendlyMsg.includes("Email not confirmed")) {
        friendlyMsg = "الرجاء تأكيد حسابك عبر رسالة البريد المرسلة إليك أولاً.";
      }
      triggerError(friendlyMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container min-h-screen w-full flex flex-col lg:flex-row bg-[#070b13] font-sans text-slate-100 overflow-hidden relative">
      
      {/* Background Ambient Decorative Lights */}
      <div className="absolute top-[-20%] right-[-10%] w-[50vw] h-[50vw] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[50vw] h-[50vw] bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none z-0" />

      {/* RIGHT SIDE: SECURE LOGIN CARD PANEL */}
      <div className="login-form-panel flex-1 flex items-center justify-center p-6 md:p-12 relative z-10 lg:order-2">
        <Atropos 
          className="w-full max-w-[420px] my-auto"
          activeOffset={40}
          shadow={false} // Custom Tailwind shadow instead
          rotateXMax={12}
          rotateYMax={12}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, cubicBezier: [0.16, 1, 0.3, 1] }}
            className={`login-card w-full bg-slate-950/60 backdrop-blur-xl border border-slate-800/80 rounded-[2rem] p-8 md:p-10 shadow-2xl relative overflow-hidden transition-all duration-300 hover:border-amber-500/30 ${shake ? 'animate-shake shake' : ''}`}
            style={{ boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7)' }}
          >
            {/* Top gold line accent */}
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-60" />

            <div className="flex flex-col items-center">
              {/* Logo / Badge */}
              <motion.div 
                whileHover={{ scale: 1.05 }}
                className="login-logo-container mb-6 relative cursor-pointer"
                data-atropos-offset="5"
              >
                <div className="absolute -inset-1 rounded-[1.8rem] bg-gradient-to-r from-amber-500 to-amber-300 opacity-20 blur-sm animate-pulse" />
                <img 
                  src="/poultry-ledger/assets/icon.svg" 
                  alt="شعار الودرني للدواجن" 
                  className="login-logo-img w-24 h-24 rounded-[1.6rem] object-contain border-2 border-amber-500/40 p-2.5 bg-slate-900 shadow-xl relative z-10"
                  onError={(e) => {
                    e.target.outerHTML = '<div class="login-logo-img w-24 h-24 rounded-[1.6rem] bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center text-5xl shadow-xl border border-amber-400/40 relative z-10">🐔</div>';
                  }}
                />
              </motion.div>
              
              <h2 className="login-title text-2xl md:text-3xl font-extrabold tracking-tight mb-2" data-atropos-offset="3">
                <span className="bg-gradient-to-r from-amber-200 via-amber-300 to-amber-500 bg-clip-text text-transparent">
                  الودرني للدواجن
                </span>
              </h2>
              
              <p className="login-subtitle text-xs text-slate-400 font-medium mb-6" data-atropos-offset="2">
                {isSupabaseConfigured ? "تسجيل الدخول السحابي الآمن للوحة القيادة" : "لوحة التحكم الآمنة للحسابات"}
              </p>
            </div>

            {/* Error Message Box */}
            <AnimatePresence>
              {errorMsg && (
                <motion.div 
                  initial={{ opacity: 0, height: 0, y: -10 }}
                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                  exit={{ opacity: 0, height: 0, y: -10 }}
                  className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl mb-4 font-semibold text-right flex items-center gap-2"
                >
                  <span className="text-base leading-none">⚠️</span>
                  <span className="flex-1">{errorMsg}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {isSupabaseConfigured ? (
              <form onSubmit={handleCloudSubmit} className="space-y-4 text-right">
                <div data-atropos-offset="2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 mr-1">البريد الإلكتروني *</label>
                  <input 
                    type="email"
                    className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 text-left direction-ltr"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div data-atropos-offset="2">
                  <label className="block text-xs font-semibold text-slate-400 mb-1.5 mr-1">كلمة المرور *</label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 text-left direction-ltr"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={loading}
                    />
                    <button 
                      type="button" 
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-500 transition-colors p-1"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <motion.button 
                  whileHover={{ scale: 1.02, translateY: -1 }}
                  whileTap={{ scale: 0.98, translateY: 0 }}
                  type="submit" 
                  className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 transition-all duration-200 flex items-center justify-center gap-2 mt-6"
                  disabled={loading}
                  data-atropos-offset="4"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    "تسجيل الدخول السحابي"
                  )}
                </motion.button>
              </form>
            ) : (
              <div className="space-y-4">
                {/* Local environment fallback note */}
                <div className="bg-amber-500/5 border border-amber-500/10 text-amber-400/90 text-xs py-3 px-4 rounded-2xl mb-5 text-right leading-relaxed" data-atropos-offset="1">
                  <div className="font-semibold mb-1 flex items-center gap-1.5 justify-end">
                    <span>وضع العمل المحلي</span>
                    <span className="text-base">ℹ️</span>
                  </div>
                  لربط التطبيق بقاعدة البيانات السحابية (Supabase) والمزامنة فوريًا مع الأجهزة الأخرى، يرجى ملء ملف البيئة <code className="bg-slate-900 px-1.5 py-0.5 rounded text-amber-300 font-mono">.env</code> في جذر المشروع.
                </div>

                <p className="text-sm font-semibold text-slate-300 mb-4 text-center">
                  {isLocalSetupMode ? "إنشاء كلمة مرور جديدة لوحة التحكم" : "لوحة التحكم الآمنة للحسابات"}
                </p>

                <form onSubmit={handleLocalSubmit} className="space-y-4 text-right">
                  {isLocalSetupMode ? (
                    <>
                      <div data-atropos-offset="2">
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 mr-1">حدد كلمة مرور الإدارة الجديدة *</label>
                        <div className="relative">
                          <input 
                            type={showPassword ? "text" : "password"}
                            className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 text-left direction-ltr"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="كلمة المرور الجديدة"
                            required
                            autoFocus
                          />
                          <button 
                            type="button" 
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-500 transition-colors p-1"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? "🙈" : "👁️"}
                          </button>
                        </div>
                      </div>

                      <div data-atropos-offset="2">
                        <label className="block text-xs font-semibold text-slate-400 mb-1.5 mr-1">تأكيد كلمة المرور *</label>
                        <input 
                          type="password"
                          className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-3 px-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 text-left direction-ltr"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="أعد كتابة كلمة المرور"
                          required
                        />
                      </div>

                      <motion.button 
                        whileHover={{ scale: 1.02, translateY: -1 }}
                        whileTap={{ scale: 0.98, translateY: 0 }}
                        type="submit" 
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 transition-all duration-200 flex items-center justify-center mt-6"
                        data-atropos-offset="4"
                      >
                        حفظ كلمة المرور والدخول
                      </motion.button>
                    </>
                  ) : (
                    <>
                      <div className="relative" data-atropos-offset="2">
                        <input 
                          type={showPassword ? "text" : "password"}
                          className="w-full bg-slate-900/80 border border-slate-800 focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/20 rounded-xl py-3 pl-12 pr-4 text-sm text-slate-100 placeholder-slate-600 outline-none transition-all duration-200 text-left direction-ltr"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="أدخل كلمة مرور الإدارة لولوج"
                          required
                          autoFocus
                        />
                        <button 
                          type="button" 
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-amber-500 transition-colors p-1"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? "🙈" : "👁️"}
                        </button>
                      </div>

                      <motion.button 
                        whileHover={{ scale: 1.02, translateY: -1 }}
                        whileTap={{ scale: 0.98, translateY: 0 }}
                        type="submit" 
                        className="w-full bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-sm py-3.5 px-6 rounded-xl shadow-lg shadow-amber-500/15 hover:shadow-amber-500/25 transition-all duration-200 flex items-center justify-center mt-4"
                        data-atropos-offset="4"
                      >
                        تسجيل الدخول
                      </motion.button>
                    </>
                  )}
                </form>
              </div>
            )}
          </motion.div>
        </Atropos>
      </div>

      {/* LEFT SIDE: SPLIT CORPORATE HERO PANEL */}
      <div className="login-hero-panel flex-1 min-h-[30vh] lg:min-h-screen relative lg:flex flex-col justify-end p-8 md:p-16 overflow-hidden bg-slate-950 z-0 lg:order-1">
        
        {/* Visual Hero Image & Shadow Overlay */}
        <div className="absolute inset-0 bg-[url('/poultry-ledger/assets/hero.webp')] bg-cover bg-center opacity-40 mix-blend-luminosity" />
        <div className="login-hero-overlay absolute inset-0 bg-gradient-to-t from-[#070b13] via-[#070b13]/60 to-transparent lg:bg-gradient-to-l lg:from-slate-950 lg:via-slate-950/70 lg:to-transparent" />
        
        <div className="login-hero-text relative z-10 max-w-lg mt-auto text-right mr-auto lg:mr-0">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, duration: 0.8 }}
          >
            <h1 className="login-hero-h1 text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 leading-tight">
              <span className="bg-gradient-to-r from-amber-100 via-amber-200 to-amber-400 bg-clip-text text-transparent">
                الودرني للدواجن
              </span>
            </h1>
            <p className="login-hero-p text-sm md:text-base text-slate-300 font-medium leading-relaxed mb-6 max-w-md">
              الريادة والتميز في تجارة الدواجن بالجملة والتفصيل في الحامة وقابس. 
              شريككم الموثوق وحلولنا الرقمية الذكية لإدارة مبيعاتكم وحساباتكم اليومية بكل دقة وسهولة.
            </p>
            
            {/* Visual Quick Badges */}
            <div className="flex flex-wrap gap-2.5 justify-start md:justify-end lg:justify-start">
              <span className="bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs px-3.5 py-1.5 rounded-full font-semibold backdrop-blur-md">
                ⚡ سحابي وتلقائي
              </span>
              <span className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs px-3.5 py-1.5 rounded-full font-semibold backdrop-blur-md">
                📱 يدعم الأجهزة المحمولة
              </span>
              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-3.5 py-1.5 rounded-full font-semibold backdrop-blur-md">
                🔒 أمان عالي
              </span>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
