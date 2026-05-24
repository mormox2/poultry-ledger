import React from 'react';

export default function InstallModal({ isOpen, onClose, deviceType, onInstallApp, installPrompt }) {
  if (!isOpen) return null;

  return (
    <div className="install-modal-overlay" onClick={onClose}>
      <div className="install-modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="install-modal-close" onClick={onClose} title="إغلاق">✕</button>
        
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div className="install-modal-icon" style={{ fontSize: '42px', marginBottom: '8px' }}>📲</div>
          <h3 style={{ fontSize: '18px', fontWeight: '800', color: 'var(--gold)', marginBottom: '8px' }}>
            تثبيت التطبيق على هاتفك
          </h3>
          <p style={{ fontSize: '12.5px', color: 'var(--muted)', lineHeight: '1.6', maxWidth: '320px', margin: '0 auto' }}>
            ثبّت تطبيق الودرني للدواجن على شاشتك الرئيسية للوصول الفوري، الاستخدام بملء الشاشة، والعمل بكفاءة بدون إنترنت.
          </p>
        </div>

        {/* Dynamic Walkthrough Content based on OS */}
        {deviceType === 'ios' ? (
          <div className="install-steps">
            <div className="install-step">
              <div className="step-badge">1</div>
              <div className="step-text">
                اضغط على زر **المشاركة** <span style={{ fontSize: '16px', verticalAlign: 'middle' }}>📤</span> في شريط Safari السفلي.
              </div>
            </div>
            <div className="install-step">
              <div className="step-badge">2</div>
              <div className="step-text">
                قم بالتمرير للأسفل واختر **«إضافة إلى الصفحة الرئيسية»** <span style={{ fontSize: '16px', color: 'var(--gold)', verticalAlign: 'middle' }}>➕</span>.
              </div>
            </div>
            <div className="install-step">
              <div className="step-badge">3</div>
              <div className="step-text">
                اضغط على **«إضافة»** (Add) في الزاوية العلوية اليسرى/اليمنى لتأكيد التثبيت.
              </div>
            </div>
          </div>
        ) : (
          <div className="install-steps">
            {installPrompt ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '5px 0 15px', borderBottom: '1px dashed var(--border)', marginBottom: '15px' }}>
                <button 
                  className="btn btn-gold" 
                  onClick={() => {
                    onInstallApp();
                    onClose();
                  }}
                  style={{ width: '100%', fontWeight: '700', padding: '12px', fontSize: '13.5px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                >
                  📥 تثبيت فوري الآن
                </button>
                <span style={{ fontSize: '11px', color: 'var(--muted)' }}>أو اتبع الطريقة اليدوية بالأسفل:</span>
              </div>
            ) : null}
            <div className="install-step">
              <div className="step-badge">1</div>
              <div className="step-text">
                اضغط على **أيقونة النقاط الثلاث** <span style={{ fontSize: '16px', verticalAlign: 'middle' }}>⋮</span> في أعلى يسار/يمين المتصفح (Chrome/Edge).
              </div>
            </div>
            <div className="install-step">
              <div className="step-badge">2</div>
              <div className="step-text">
                اختر **«إضافة إلى الشاشة الرئيسية»** أو **«تثبيت التطبيق»** من القائمة.
              </div>
            </div>
            <div className="install-step">
              <div className="step-badge">3</div>
              <div className="step-text">
                أكّد الإضافة لتثبيت أيقونة التطبيق على شاشتك الرئيسية فوراً.
              </div>
            </div>
          </div>
        )}

        <div style={{ marginTop: '20px', borderTop: '1px solid var(--border)', paddingTop: '15px', textAlign: 'center' }}>
          <button className="btn btn-outline btn-sm" onClick={onClose} style={{ minWidth: '120px', fontWeight: '700' }}>
            حسنًا، فهمت
          </button>
        </div>
      </div>
    </div>
  );
}
