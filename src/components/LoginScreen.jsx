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
    // Vibrate mobile device if API available
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
    setTimeout(() => {
      setShake(false);
    }, 500);
  };

  return (
    <div className="login-container">
      <div className={`login-card ${shake ? 'shake' : ''}`}>
        <div className="login-logo">🐔</div>
        
        <h1 className="login-title">الودرني للدواجن</h1>
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
                  >
                    {showPassword ? "👁️‍🗨️" : "👁️"}
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
                  placeholder="أدخل كلمة مرور الإدارة لوجوج"
                  required
                  style={{ paddingLeft: '44px' }}
                  autoFocus
                />
                <button 
                  type="button" 
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? "👁️‍🗨️" : "👁️"}
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
  );
}
