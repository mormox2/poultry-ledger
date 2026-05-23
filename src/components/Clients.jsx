import React, { useState } from 'react';
import { COLORS, getTotals, fmt } from '../js/utils';

export default function Clients({ 
  state, 
  onSelectClient, 
  onAddClient, 
  onEditClient, 
  onDeleteClient 
}) {
  const y = state.year;
  const m = state.month;

  const [search, setSearch] = useState('');
  const [modalMode, setModalMode] = useState(null); // 'add', 'edit', 'delete'
  const [activeClient, setActiveClient] = useState(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formColor, setFormColor] = useState(0);
  const [formTaxId, setFormTaxId] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const filtered = state.clients.filter(x => 
    !search || 
    x.name.toLowerCase().includes(search.toLowerCase()) || 
    x.phone.includes(search)
  );

  // Compute VIP threshold
  const allAmts = state.clients.map(x => getTotals(state.ledger, x.id, y, m).amt);
  const maxAmt = Math.max(...allAmts, 0);

  const handleOpenAdd = () => {
    setFormName('');
    setFormAddress('');
    setFormPhone('');
    setFormColor(0);
    setFormTaxId('');
    setFormNotes('');
    setModalMode('add');
  };

  const handleOpenEdit = (cl) => {
    setActiveClient(cl);
    setFormName(cl.name);
    setFormAddress(cl.address === '—' ? '' : cl.address);
    setFormPhone(cl.phone === '—' ? '' : cl.phone);
    setFormColor(cl.color);
    setFormTaxId(cl.taxId === '—' ? '' : cl.taxId || '');
    setFormNotes(cl.notes === '—' ? '' : cl.notes || '');
    setModalMode('edit');
  };

  const handleOpenDelete = (cl) => {
    setActiveClient(cl);
    setModalMode('delete');
  };

  const handleAddSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("الرجاء إدخال اسم الحريف");
      return;
    }
    onAddClient({
      name: formName.trim(),
      address: formAddress.trim() || "—",
      phone: formPhone.trim() || "—",
      color: formColor,
      taxId: formTaxId.trim() || "—",
      notes: formNotes.trim() || "—"
    });
    setModalMode(null);
  };

  const handleEditSubmit = (e) => {
    e.preventDefault();
    if (!formName.trim()) {
      alert("الرجاء إدخال اسم الحريف");
      return;
    }
    onEditClient({
      id: activeClient.id,
      name: formName.trim(),
      address: formAddress.trim() || "—",
      phone: formPhone.trim() || "—",
      color: formColor,
      taxId: formTaxId.trim() || "—",
      notes: formNotes.trim() || "—"
    });
    setModalMode(null);
  };

  const handleDeleteConfirm = () => {
    onDeleteClient(activeClient.id);
    setModalMode(null);
  };

  return (
    <div className="fade-in">
      <div className="sec-header">
        <div className="sec-title">إدارة حسابات العملاء ({state.clients.length})</div>
        <button className="btn btn-gold" onClick={handleOpenAdd}>+ إضافة عميل جديد</button>
      </div>

      <div className="search-wrap" style={{ marginBottom: '16px', maxWidth: '320px' }}>
        <span className="icon">🔍</span>
        <input 
          className="input" 
          style={{ paddingRight: '36px' }} 
          placeholder="بحث عن عميل..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="card-grid">
        {filtered.map(cl => {
          const t = getTotals(state.ledger, cl.id, y, m);
          const rem = t.amt - t.paid;
          
          let badges = [];
          if (t.amt > 0) {
            if (rem <= 0) {
              badges.push(
                <span key="paid" className="badge badge-green" style={{ fontSize: '9px', padding: '2px 8px', marginRight: '4px' }}>مخلص 💸</span>
              );
            } else {
              badges.push(
                <span key="debt" className="badge badge-red" style={{ fontSize: '9px', padding: '2px 8px', marginRight: '4px' }}>مدين ⚠️</span>
              );
            }
            
            // VIP check
            if (t.amt >= maxAmt * 0.7 && t.amt > 100) {
              badges.push(
                <span key="vip" className="badge" style={{
                  fontSize: '9px',
                  padding: '2px 8px',
                  background: 'rgba(212,168,67,0.12)',
                  color: 'var(--gold)',
                  border: '1px solid rgba(212,168,67,0.25)',
                  marginRight: '4px'
                }}>كبير الحرفاء ⭐</span>
              );
            }
          }

          return (
            <div key={cl.id} className={`client-card ${cl.id === state.selectedClient ? 'selected' : ''}`} onClick={() => onSelectClient(cl.id)}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '50%',
                  background: COLORS[cl.color % COLORS.length],
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '20px',
                  fontWeight: '800',
                  color: '#0b1520'
                }}>
                  {cl.name[0]}
                </div>
                <div style={{ display: 'flex', gap: '6px' }} className="no-print">
                  <button 
                    className="btn btn-outline btn-sm" 
                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(cl); }}
                  >
                    ✏️
                  </button>
                  {state.clients.length > 1 && (
                    <button 
                      className="btn btn-danger btn-sm" 
                      onClick={(e) => { e.stopPropagation(); handleOpenDelete(cl); }}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              </div>
              <div style={{
                fontSize: '15px',
                fontWeight: '800',
                color: COLORS[cl.color % COLORS.length],
                marginBottom: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '6px'
              }}>
                <span>{cl.name}</span>
                <div style={{ display: 'flex', gap: '4px' }}>{badges}</div>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '2px' }}>📍 {cl.address}</div>
              <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '2px' }}>📞 {cl.phone}</div>
              {cl.taxId && cl.taxId !== '—' && (
                <div style={{ fontSize: '11px', color: 'var(--gold)', marginBottom: '2px', fontWeight: '600' }}>🆔 م.ج: {cl.taxId}</div>
              )}
              {cl.notes && cl.notes !== '—' && (
                <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '12px', fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={cl.notes}>📝 {cl.notes}</div>
              )}
              {(!cl.taxId || cl.taxId === '—') && (!cl.notes || cl.notes === '—') ? <div style={{ height: '8px' }}></div> : null}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--gold)' }}>{fmt(t.amt) || "—"}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>الجملي</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--green)' }}>{fmt(t.paid) || "—"}</div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>المدفوع</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '13px', fontWeight: '700', color: rem > 0 ? 'var(--red)' : 'var(--green)' }}>
                    {rem > 0 ? fmt(rem) : '✓'}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)' }}>الباقي</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADD MODAL */}
      {modalMode === 'add' && (
        <div className="modal-overlay open" onClick={() => setModalMode(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">إضافة عميل جديد</div>
            <form onSubmit={handleAddSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div className="input-label">الاسم الكامل للعميل *</div>
                <input 
                  className="input" 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: محمد بن علي" 
                  required
                  autoFocus 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div className="input-label">الهاتف</div>
                  <input 
                    className="input" 
                    value={formPhone} 
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="55 xxx xxx" 
                  />
                </div>
                <div>
                  <div className="input-label">المعرف الجبائي للعميل</div>
                  <input 
                    className="input" 
                    value={formTaxId} 
                    onChange={(e) => setFormTaxId(e.target.value)}
                    placeholder="1234567/A/P/M/000" 
                  />
                </div>
              </div>
              <div>
                <div className="input-label">العنوان الجغرافي</div>
                <input 
                  className="input" 
                  value={formAddress} 
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="مثال: الحامة 1" 
                />
              </div>
              <div>
                <div className="input-label">ملاحظات خاصة بالحريف</div>
                <textarea 
                  className="input" 
                  value={formNotes} 
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="شروط الدفع، تصنيفات خاصة، إلخ..." 
                  style={{ minHeight: '50px', resize: 'vertical' }}
                />
              </div>
              <div>
                <div className="input-label">رمز اللون المميز للعميل</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {COLORS.map((col, i) => (
                    <div 
                      key={i}
                      className="color-opt" 
                      style={{ 
                        background: col, 
                        outline: i === formColor ? '2px solid var(--gold)' : 'none' 
                      }} 
                      onClick={() => setFormColor(i)}
                    ></div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="submit" className="btn btn-gold" style={{ flex: 1, height: '40px', fontWeight: '700' }}>إضافة العميل</button>
                <button type="button" className="btn btn-outline" onClick={() => setModalMode(null)} style={{ flex: 1, height: '40px' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {modalMode === 'edit' && (
        <div className="modal-overlay open" onClick={() => setModalMode(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">تعديل بيانات العميل</div>
            <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <div className="input-label">الاسم الكامل للعميل *</div>
                <input 
                  className="input" 
                  value={formName} 
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="مثال: محمد بن علي" 
                  required
                  autoFocus 
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <div className="input-label">الهاتف</div>
                  <input 
                    className="input" 
                    value={formPhone} 
                    onChange={(e) => setFormPhone(e.target.value)}
                    placeholder="55 xxx xxx" 
                  />
                </div>
                <div>
                  <div className="input-label">المعرف الجبائي للعميل</div>
                  <input 
                    className="input" 
                    value={formTaxId} 
                    onChange={(e) => setFormTaxId(e.target.value)}
                    placeholder="1234567/A/P/M/000" 
                  />
                </div>
              </div>
              <div>
                <div className="input-label">العنوان الجغرافي</div>
                <input 
                  className="input" 
                  value={formAddress} 
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="مثال: الحامة 1" 
                />
              </div>
              <div>
                <div className="input-label">ملاحظات خاصة بالحريف</div>
                <textarea 
                  className="input" 
                  value={formNotes} 
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="شروط الدفع، تصنيفات خاصة، إلخ..." 
                  style={{ minHeight: '50px', resize: 'vertical' }}
                />
              </div>
              <div>
                <div className="input-label">رمز اللون المميز للعميل</div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {COLORS.map((col, i) => (
                    <div 
                      key={i}
                      className="color-opt" 
                      style={{ 
                        background: col, 
                        outline: i === formColor ? '2px solid var(--gold)' : 'none' 
                      }} 
                      onClick={() => setFormColor(i)}
                    ></div>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
                <button type="submit" className="btn btn-gold" style={{ flex: 1, height: '40px', fontWeight: '700' }}>حفظ التعديلات</button>
                <button type="button" className="btn btn-outline" onClick={() => setModalMode(null)} style={{ flex: 1, height: '40px' }}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DELETE MODAL */}
      {modalMode === 'delete' && (
        <div className="modal-overlay open" onClick={() => setModalMode(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title" style={{ color: 'var(--red)' }}>تأكيد حذف العميل</div>
            <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '16px' }}>
              هل أنت متأكد من حذف العميل <strong>{activeClient?.name}</strong>؟<br />
              سوف يتم حذف جميع بيانات وسجلات هذا العميل بشكل نهائي!
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn btn-danger" style={{ flex: 1 }} onClick={handleDeleteConfirm}>نعم، حذف العميل</button>
              <button className="btn btn-outline" onClick={() => setModalMode(null)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
