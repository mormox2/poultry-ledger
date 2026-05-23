import React, { useState } from 'react';

export default function LoginScreen({ savedPassword, onLogin, onSetPassword }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [shake, setShake] = useState(false);

  // Setup mode if no password has ever been saved
  const isSetupMode = !savedPassword;

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (isSetupMode) {
      if (!password.trim()) {
        triggerError();
        alert("الرجاء إدخال كلمة مرور صالحة");
        return;
      }
      if (password !== confirmPassword) {
        triggerError();
        alert("كلمات المرور غير متطابقة !");
        return;
      }
      onSetPassword(password.trim());
    } else {
      if (password.trim() === savedPassword) {
        onLogin();
      } else {
        triggerError();
      }
    }
  };

  const triggerError = () => {
    setShake(true);
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    setTimeout(() => {
      setShake(false);
    }, 500);
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
                // Fallback inside container if image somehow fails to load
                e.target.outerHTML = '<div style="font-size: 72px; width: 130px; height: 130px; background: linear-gradient(135deg, var(--gold), var(--gold2)); border-radius: 24px; display: flex; align-items: center; justify-content: center; margin: 0 auto; box-shadow: 0 10px 25px rgba(212, 168, 67, 0.3);">🐔</div>';
              }}
            />
          </div>
          
          <h2 className="login-title">الودرني للدواجن</h2>
          <p className="login-subtitle">
            {isSetupMode 
              ? "إنشاء كلمة مرور جديدة لوحة التحكم" 
              : "لوحة التحكم الآمنة للحسابات"}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '10px' }}>
            {isSetupMode ? (
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
