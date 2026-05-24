import React, { useState } from 'react';
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

  const handleLocalSubmit = (e) => {
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
      if (password.trim() === savedPassword) {
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
    <div className="login-container">
      {/* RIGHT SIDE: SECURE LOGIN CARD PANEL */}
      <div className="login-form-panel">
        <div className={`login-card ${shake ? 'shake' : ''}`}>
          <div className="login-logo-container">
            <img 
              src="/poultry-ledger/assets/logo.png" 
              alt="شعار الودرني للدواجن" 
              className="login-logo-img"
              onError={(e) => {
                e.target.outerHTML = '<div style="font-size: 72px; width: 130px; height: 130px; background: linear-gradient(135deg, var(--gold), var(--gold2)); border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto; box-shadow: 0 10px 25px rgba(212, 168, 67, 0.3);">🐔</div>';
              }}
            />
          </div>
          
          <h2 className="login-title">الودرني للدواجن</h2>
          
          {isSupabaseConfigured ? (
            <>
              <p className="login-subtitle">
                تسجيل الدخول السحابي الآمن للوحة القيادة
              </p>

              {errorMsg && (
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.12)', 
                  border: '1px solid rgba(239, 68, 68, 0.25)', 
                  color: 'var(--red)', 
                  fontSize: '12px', 
                  padding: '10px', 
                  borderRadius: '8px', 
                  marginBottom: '16px',
                  fontWeight: '600'
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <form onSubmit={handleCloudSubmit} style={{ display: 'grid', gap: '10px' }}>
                <div>
                  <div className="input-label" style={{ textAlign: 'right' }}>البريد الإلكتروني *</div>
                  <input 
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    disabled={loading}
                    autoFocus
                  />
                </div>

                <div>
                  <div className="input-label" style={{ textAlign: 'right' }}>كلمة المرور *</div>
                  <div className="password-input-wrapper">
                    <input 
                      type={showPassword ? "text" : "password"}
                      className="input"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      disabled={loading}
                      style={{ paddingLeft: '44px' }}
                    />
                    <button 
                      type="button" 
                      className="password-toggle-btn"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="btn btn-gold" 
                  style={{ width: '100%', marginTop: '10px', height: '44px', fontWeight: '700' }}
                  disabled={loading}
                >
                  {loading ? "الرجاء الانتظار..." : "تسجيل الدخول السحابي"}
                </button>
              </form>
            </>
          ) : (
            <>
              {/* LOCAL STANDALONE FALLBACK */}
              <div style={{ 
                background: 'rgba(212, 168, 67, 0.08)', 
                border: '1px solid rgba(212, 168, 67, 0.2)', 
                color: 'var(--gold)', 
                fontSize: '11px', 
                padding: '8px 12px', 
                borderRadius: '8px', 
                marginBottom: '16px',
                lineHeight: '1.5',
                textAlign: 'right'
              }}>
                ℹ️ **وضع العمل المحلي**: لربط التطبيق بقاعدة البيانات السحابية (Supabase) والمزامنة فوريًا مع الأجهزة الأخرى، يرجى ملء ملف البيئة `.env` في جذر المشروع.
              </div>

              <p className="login-subtitle">
                {isLocalSetupMode 
                  ? "إنشاء كلمة مرور جديدة لوحة التحكم" 
                  : "لوحة التحكم الآمنة للحسابات"}
              </p>

              {errorMsg && (
                <div style={{ 
                  background: 'rgba(239, 68, 68, 0.12)', 
                  border: '1px solid rgba(239, 68, 68, 0.25)', 
                  color: 'var(--red)', 
                  fontSize: '12px', 
                  padding: '10px', 
                  borderRadius: '8px', 
                  marginBottom: '16px',
                  fontWeight: '600'
                }}>
                  ⚠️ {errorMsg}
                </div>
              )}

              <form onSubmit={handleLocalSubmit} style={{ display: 'grid', gap: '10px' }}>
                {isLocalSetupMode ? (
                  <>
                    <div>
                      <div className="input-label" style={{ textAlign: 'right' }}>حدد كلمة مرور الإدارة الجديدة *</div>
                      <div className="password-input-wrapper">
                        <input 
                          type={showPassword ? "text" : "password"}
                          className="input"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="كلمة المرور الجديدة"
                          required
                          style={{ paddingLeft: '44px' }}
                          autoFocus
                        />
                        <button 
                          type="button" 
                          className="password-toggle-btn"
                          onClick={() => setShowPassword(!showPassword)}
                          title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                        >
                          {showPassword ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </div>
                    <div>
                      <div className="input-label" style={{ textAlign: 'right' }}>تأكيد كلمة المرور *</div>
                      <input 
                        type="password"
                        className="input"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="أعد كتابة كلمة المرور"
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-gold" style={{ width: '100%', marginTop: '10px', height: '44px' }}>
                      حفظ كلمة المرور والدخول
                    </button>
                  </>
                ) : (
                  <>
                    <div className="password-input-wrapper">
                      <input 
                        type={showPassword ? "text" : "password"}
                        className="input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="أدخل كلمة مرور الإدارة لولوج"
                        required
                        style={{ paddingLeft: '44px' }}
                        autoFocus
                      />
                      <button 
                        type="button" 
                        className="password-toggle-btn"
                        onClick={() => setShowPassword(!showPassword)}
                        title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                      >
                        {showPassword ? "🙈" : "👁️"}
                      </button>
                    </div>
                    <button type="submit" className="btn btn-gold" style={{ width: '100%', height: '44px', fontWeight: '700' }}>
                      تسجيل الدخول
                    </button>
                  </>
                )}
              </form>
            </>
          )}
        </div>
      </div>

      {/* LEFT SIDE: SPLIT CORPORATE HERO PANEL */}
      <div className="login-hero-panel">
        <div className="login-hero-overlay"></div>
        <div className="login-hero-text">
          <h1 className="login-hero-h1">الودرني للدواجن</h1>
          <p className="login-hero-p">
            الريادة والتميز في تجارة الدواجن بالجملة والتفصيل في الحامة وقابس. 
            شريككم الموثوق وحلولنا الرقمية الذكية لإدارة مبيعاتكم وحساباتكم اليومية بكل دقة وسهولة.
          </p>
        </div>
      </div>
    </div>
  );
}
