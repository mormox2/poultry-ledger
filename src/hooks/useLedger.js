import { useCallback } from 'react';
import { supabase } from '../js/supabaseClient';
import { ledgerKey, daysInMonth } from '../js/utils';
import { logActivity } from '../js/activityLog';

export default function useLedger({
  state,
  setState,
  stateRef,
  user,
  isSupabaseConfigured,
  syncLedgerEntryToCloud,
  toastMessage,
  triggerHaptic
}) {

  const handleSelectClient = useCallback((cid) => {
    triggerHaptic(12);
    setState(prev => ({
      ...prev,
      selectedClient: cid,
      view: cid === null ? "clients" : "ledger"
    }));
  }, [setState, triggerHaptic]);

  const handleUpdateRow = useCallback((idx, field, val) => {
    setState(prev => {
      const updatedLedger = { ...prev.ledger };
      const k = ledgerKey(prev.selectedClient, prev.year, prev.month);
      
      if (!updatedLedger[k]) {
        const days = daysInMonth(prev.year, prev.month);
        updatedLedger[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = [...updatedLedger[k]];
      const row = { ...rows.at(idx) };
      row.local_updated_at = new Date().toISOString();
      if (field === 'tw') {
        row.tw = val;
        if (val && !row.price) {
          row.price = prev.pricePerKg;
        }
      }
      else if (field === 'nw') {
        row.nw = val;
        if (val && !row.price) {
          row.price = prev.pricePerKg;
        }
      }
      else if (field === 'price') row.price = val;
      else if (field === 'amt') row.amt = val;
      else if (field === 'paid') row.paid = val;
      else if (field === 'holiday') row.holiday = val;
      else if (field === 'notes') row.notes = val;

      // Autocalculate values
      if (field === 'nw') {
        const nwFloat = parseFloat(val);
        if (!nwFloat) {
          row.amt = "";
        } else {
          const activePrice = parseFloat(row.price) || prev.pricePerKg || 0;
          row.amt = parseFloat((nwFloat * activePrice).toFixed(3));
        }
      } else if (field === 'price') {
        const customPrice = parseFloat(val);
        const nwFloat = parseFloat(row.nw) || 0;
        if (!nwFloat) {
          row.amt = "";
        } else {
          const activePrice = customPrice || prev.pricePerKg || 0;
          row.amt = parseFloat((nwFloat * activePrice).toFixed(3));
        }
      }

      rows.splice(idx, 1, row);
      updatedLedger[k] = rows;

      return {
        ...prev,
        ledger: updatedLedger
      };
    });
  }, [setState]);

  const handleSyncRow = useCallback((idx) => {
    // Delay slightly to ensure React state updates are flushed and rendered
    setTimeout(() => {
      const currentState = stateRef.current;
      const k = ledgerKey(currentState.selectedClient, currentState.year, currentState.month);
      const rows = Reflect.get(currentState.ledger, k);
      if (rows && rows.at(idx)) {
        const row = rows.at(idx);
        
        // Log this edit!
        const clientName = currentState.clients.find(c => c.id === currentState.selectedClient)?.name || "عميل";
        const dateStr = `${currentState.year}/${currentState.month}/${row.d}`;
        let details = [];
        if (row.nw) details.push(`وزن صافي: ${row.nw} كغ`);
        if (row.price) details.push(`سعر: ${row.price} د.ت`);
        if (row.paid) details.push(`دفعة: ${row.paid} د.ت`);
        if (row.notes) details.push(`ملاحظة: ${row.notes}`);
        
        logActivity(user?.id, "تحديث سجل يومي", `العميل: ${clientName} — التاريخ: ${dateStr} — التفاصيل: [${details.join(' ، ') || 'سجل فارغ'}]`);
        
        if (isSupabaseConfigured && user) {
          syncLedgerEntryToCloud(currentState.selectedClient, currentState.year, currentState.month, idx, row);
        }
      }
    }, 100);
  }, [stateRef, isSupabaseConfigured, user, syncLedgerEntryToCloud]);

  const handleToggleHoliday = useCallback(async (idx) => {
    triggerHaptic(15);
    let updatedRow = null;
    let targetClient = null;
    let targetYear = null;
    let targetMonth = null;

    setState(prev => {
      const updatedLedger = { ...prev.ledger };
      targetClient = prev.selectedClient;
      targetYear = prev.year;
      targetMonth = prev.month;
      const k = ledgerKey(targetClient, targetYear, targetMonth);
      
      if (!updatedLedger[k]) {
        const days = daysInMonth(targetYear, targetMonth);
        updatedLedger[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = [...updatedLedger[k]];
      const targetRow = rows.at(idx);
      const currentHoliday = targetRow.holiday;
      
      updatedRow = {
        ...targetRow,
        holiday: !currentHoliday,
        tw: !currentHoliday ? "" : targetRow.tw,
        nw: !currentHoliday ? "" : targetRow.nw,
        price: !currentHoliday ? "" : targetRow.price,
        amt: !currentHoliday ? "" : targetRow.amt,
        paid: !currentHoliday ? "" : targetRow.paid,
        notes: !currentHoliday ? "— عطلة رسمية —" : "",
        local_updated_at: new Date().toISOString()
      };
      
      rows.splice(idx, 1, updatedRow);
      updatedLedger[k] = rows;
      
      return { ...prev, ledger: updatedLedger };
    });

    logActivity(
      user?.id, 
      "تبديل حالة العطلة", 
      `العميل: ${stateRef.current.clients.find(c => c.id === targetClient)?.name || targetClient} — اليوم: ${idx + 1} — الحالة: ${!updatedRow?.holiday ? 'عمل' : 'عطلة'}`
    );

    if (isSupabaseConfigured && user && updatedRow) {
      try {
        await syncLedgerEntryToCloud(targetClient, targetYear, targetMonth, idx, updatedRow);
      } catch (err) {
        console.error("Holiday toggle sync error:", err);
      }
    }
  }, [setState, stateRef, triggerHaptic, isSupabaseConfigured, user, syncLedgerEntryToCloud]);

  const handleAddClient = useCallback(async (clientData) => {
    logActivity(user?.id, "إضافة عميل", `تم إضافة العميل الجديد: "${clientData.name}"`);
    const tempId = Date.now();

    if (isSupabaseConfigured && user) {
      try {
        const { data, error } = await supabase
          .from('clients')
          .insert({
            profile_id: user.id,
            name: clientData.name,
            address: clientData.address,
            phone: clientData.phone,
            tax_id: clientData.taxId,
            color: clientData.color
          })
          .select()
          .single();

        if (error) throw error;
        
        if (data) {
          setState(prev => ({
            ...prev,
            clients: [...prev.clients, {
              id: data.id,
              name: data.name,
              address: data.address,
              phone: data.phone,
              color: data.color,
              taxId: data.tax_id
            }],
            selectedClient: data.id
          }));
          toastMessage("✓ تم إضافة العميل الجديد بنجاح");
        }
      } catch (err) {
        console.error("Cloud insert client error:", err);
        toastMessage("❌ فشل إضافة العميل في السحابة", "error");
      }
    } else {
      const newClient = {
        id: tempId,
        ...clientData
      };
      setState(prev => ({
        ...prev,
        clients: [...prev.clients, newClient],
        selectedClient: newClient.id
      }));
      toastMessage("✓ تم إضافة العميل الجديد بنجاح");
    }
  }, [setState, user, isSupabaseConfigured, toastMessage]);

  const handleEditClient = useCallback(async (updatedClient) => {
    logActivity(user?.id, "تعديل بيانات عميل", `تعديل بيانات العميل: "${updatedClient.name}"`);
    setState(prev => ({
      ...prev,
      clients: prev.clients.map(c => c.id === updatedClient.id ? updatedClient : c)
    }));

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('clients')
          .update({
            name: updatedClient.name,
            address: updatedClient.address,
            phone: updatedClient.phone,
            tax_id: updatedClient.taxId,
            color: updatedClient.color
          })
          .eq('id', updatedClient.id);

        if (error) throw error;
      } catch (err) {
        console.error("Cloud edit client error:", err);
      }
    }
    toastMessage("✓ تم تعديل بيانات العميل بنجاح");
  }, [setState, user, isSupabaseConfigured, toastMessage]);

  const handleDeleteClient = useCallback(async (cid) => {
    const clientName = stateRef.current.clients.find(c => c.id === cid)?.name || cid;
    logActivity(user?.id, "حذف عميل", `تم حذف العميل نهائياً: "${clientName}"`);
    setState(prev => {
      const filteredClients = prev.clients.filter(c => c.id !== cid);
      const isSelectedDeleted = prev.selectedClient === cid;
      return {
        ...prev,
        clients: filteredClients,
        selectedClient: isSelectedDeleted ? (filteredClients.length ? filteredClients[0].id : null) : prev.selectedClient
      };
    });

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('clients')
          .delete()
          .eq('id', cid);

        if (error) throw error;
      } catch (err) {
        console.error("Cloud delete client error:", err);
      }
    }
    toastMessage("✓ تم حذف العميل بنجاح");
  }, [setState, stateRef, user, isSupabaseConfigured, toastMessage]);

  const handleQuickSettle = useCallback(async (cid, amount) => {
    let updatedRows = [];
    let targetYear = null;
    let targetMonth = null;

    setState(prev => {
      const updatedLedger = { ...prev.ledger };
      targetYear = prev.year;
      targetMonth = prev.month;
      const k = ledgerKey(cid, targetYear, targetMonth);
      
      if (!updatedLedger[k]) {
        const days = daysInMonth(targetYear, targetMonth);
        updatedLedger[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = updatedLedger[k].map(r => ({ ...r }));
      let remaining = amount;

      for (let i = 0; i < rows.length; i++) {
        const r = rows.at(i);
        if (r.holiday || !r.amt) continue;
        const amt = parseFloat(r.amt) || 0;
        const paid = parseFloat(r.paid) || 0;
        const due = amt - paid;
        if (due <= 0) continue;

        const oldPaid = r.paid;
        if (remaining >= due) {
          r.paid = amt;
          remaining -= due;
        } else {
          r.paid = parseFloat((paid + remaining).toFixed(3));
          remaining = 0;
        }
        r.local_updated_at = new Date().toISOString();

        if (r.paid !== oldPaid) {
          updatedRows.push({ idx: i, row: r });
        }
        if (remaining <= 0) break;
      }

      updatedLedger[k] = rows;

      return {
        ...prev,
        ledger: updatedLedger
      };
    });

    if (isSupabaseConfigured && user && updatedRows.length > 0) {
      try {
        const syncPromises = updatedRows.map(({ idx, row }) => 
          syncLedgerEntryToCloud(cid, targetYear, targetMonth, idx, row)
        );
        await Promise.all(syncPromises);
      } catch (err) {
        console.error("Cloud quick settle sync error:", err);
      }
    }
    
    toastMessage("✓ تم تسوية وتوزيع الدفعات بنجاح");
  }, [setState, isSupabaseConfigured, user, syncLedgerEntryToCloud, toastMessage]);

  return {
    handleSelectClient,
    handleUpdateRow,
    handleSyncRow,
    handleToggleHoliday,
    handleAddClient,
    handleEditClient,
    handleDeleteClient,
    handleQuickSettle
  };
}
