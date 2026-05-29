import { useCallback } from 'react';
import { supabase } from '../js/supabaseClient';
import { ledgerKey, daysInMonth } from '../js/utils';
import { logActivity } from '../js/activityLog';

export default function usePurchases({
  state,
  setState,
  stateRef,
  user,
  isSupabaseConfigured,
  syncPurchaseEntryToCloud,
  toastMessage,
  triggerHaptic
}) {

  const handleSelectSupplier = useCallback((sid) => {
    triggerHaptic(12);
    setState(prev => ({
      ...prev,
      selectedSupplier: sid,
      view: sid === null ? "suppliers" : "purchases_ledger"
    }));
  }, [setState, triggerHaptic]);

  const handleUpdatePurchaseRow = useCallback((idx, field, val) => {
    setState(prev => {
      const updatedPurchases = { ...prev.purchases };
      const k = ledgerKey(prev.selectedSupplier, prev.year, prev.month);
      
      if (!updatedPurchases[k]) {
        const days = daysInMonth(prev.year, prev.month);
        updatedPurchases[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = [...updatedPurchases[k]];
      const row = { ...rows.at(idx) };
      row.local_updated_at = new Date().toISOString();
      
      const activeSup = (prev.suppliers || []).find(s => s.id === prev.selectedSupplier);
      const supplierDefaultPrice = (activeSup && activeSup.defaultPrice) ? activeSup.defaultPrice : (prev.defaultPurchasePricePerKg || 5.200);

      if (field === 'tw') {
        row.tw = val;
        if (val && !row.price) {
          row.price = supplierDefaultPrice;
        }
      }
      else if (field === 'nw') {
        row.nw = val;
        if (val && !row.price) {
          row.price = supplierDefaultPrice;
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
          const activePrice = parseFloat(row.price) || supplierDefaultPrice;
          row.amt = parseFloat((nwFloat * activePrice).toFixed(3));
        }
      } else if (field === 'price') {
        const customPrice = parseFloat(val);
        const nwFloat = parseFloat(row.nw) || 0;
        if (!nwFloat) {
          row.amt = "";
        } else {
          const activePrice = customPrice || supplierDefaultPrice;
          row.amt = parseFloat((nwFloat * activePrice).toFixed(3));
        }
      }

      rows.splice(idx, 1, row);
      updatedPurchases[k] = rows;

      return {
        ...prev,
        purchases: updatedPurchases
      };
    });
  }, [setState]);

  const handleSyncPurchaseRow = useCallback((idx) => {
    setTimeout(() => {
      const currentState = stateRef.current;
      const k = ledgerKey(currentState.selectedSupplier, currentState.year, currentState.month);
      const rows = Reflect.get(currentState.purchases || {}, k);
      if (rows && rows.at(idx)) {
        const row = rows.at(idx);
        
        // Log this edit!
        const supplierName = (currentState.suppliers || []).find(s => s.id === currentState.selectedSupplier)?.name || "مورد";
        const dateStr = `${currentState.year}/${currentState.month}/${row.d}`;
        let details = [];
        if (row.nw) details.push(`وزن صافي: ${row.nw} كغ`);
        if (row.price) details.push(`سعر الشراء: ${row.price} د.ت`);
        if (row.paid) details.push(`المدفوع له: ${row.paid} د.ت`);
        if (row.notes) details.push(`ملاحظة: ${row.notes}`);
        
        logActivity(user?.id, "تحديث سجل المشتريات", `المورد: ${supplierName} — التاريخ: ${dateStr} — التفاصيل: [${details.join(' ، ') || 'سجل فارغ'}]`);
        
        if (isSupabaseConfigured && user) {
          syncPurchaseEntryToCloud(currentState.selectedSupplier, currentState.year, currentState.month, idx, row);
        }
      }
    }, 100);
  }, [stateRef, isSupabaseConfigured, user, syncPurchaseEntryToCloud]);

  const handleTogglePurchaseHoliday = useCallback(async (idx) => {
    triggerHaptic(15);
    let updatedRow = null;
    let targetSupplier = null;
    let targetYear = null;
    let targetMonth = null;

    setState(prev => {
      const updatedPurchases = { ...prev.purchases };
      targetSupplier = prev.selectedSupplier;
      targetYear = prev.year;
      targetMonth = prev.month;
      const k = ledgerKey(targetSupplier, targetYear, targetMonth);
      
      if (!updatedPurchases[k]) {
        const days = daysInMonth(targetYear, targetMonth);
        updatedPurchases[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = [...updatedPurchases[k]];
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
        notes: !currentHoliday ? "— عطلة رسمية للمورد —" : "",
        local_updated_at: new Date().toISOString()
      };

      rows.splice(idx, 1, updatedRow);
      updatedPurchases[k] = rows;

      return {
        ...prev,
        purchases: updatedPurchases
      };
    });

    logActivity(
      user?.id, 
      "تبديل عطلة المورد", 
      `المورد: ${stateRef.current.suppliers.find(s => s.id === targetSupplier)?.name || targetSupplier} — اليوم: ${idx + 1} — الحالة: ${!updatedRow?.holiday ? 'عمل' : 'عطلة'}`
    );

    if (isSupabaseConfigured && user && updatedRow && targetSupplier) {
      await syncPurchaseEntryToCloud(targetSupplier, targetYear, targetMonth, idx, updatedRow);
    }
  }, [setState, stateRef, triggerHaptic, isSupabaseConfigured, user, syncPurchaseEntryToCloud]);

  const handleAddSupplier = useCallback(async (supplierData) => {
    logActivity(user?.id, "إضافة مورد", `تم إضافة المورد الجديد: "${supplierData.name}"`);
    const tempId = Date.now();

    if (isSupabaseConfigured && user) {
      try {
        const { data, error } = await supabase
          .from('suppliers')
          .insert({
            profile_id: user.id,
            name: supplierData.name,
            address: supplierData.address,
            phone: supplierData.phone,
            tax_id: supplierData.taxId,
            color: supplierData.color,
            default_price: supplierData.defaultPrice || null
          })
          .select()
          .single();

        if (error) throw error;
        
        if (data) {
          setState(prev => ({
            ...prev,
            suppliers: [...prev.suppliers, {
              id: data.id,
              name: data.name,
              address: data.address,
              phone: data.phone,
              color: data.color,
              taxId: data.tax_id,
              defaultPrice: data.default_price
            }],
            selectedSupplier: data.id
          }));
          toastMessage("✓ تم إضافة المورد الجديد بنجاح");
        }
      } catch (err) {
        console.error("Cloud insert supplier error:", err);
        toastMessage("❌ فشل إضافة المورد في السحابة", "error");
      }
    } else {
      const newSupplier = {
        id: tempId,
        ...supplierData
      };
      setState(prev => ({
        ...prev,
        suppliers: [...prev.suppliers, newSupplier],
        selectedSupplier: newSupplier.id
      }));
      toastMessage("✓ تم إضافة المورد الجديد بنجاح");
    }
  }, [setState, user, isSupabaseConfigured, toastMessage]);

  const handleEditSupplier = useCallback(async (updatedSupplier) => {
    logActivity(user?.id, "تعديل بيانات مورد", `تعديل بيانات المورد: "${updatedSupplier.name}"`);
    setState(prev => ({
      ...prev,
      suppliers: prev.suppliers.map(s => s.id === updatedSupplier.id ? updatedSupplier : s)
    }));

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('suppliers')
          .update({
            name: updatedSupplier.name,
            address: updatedSupplier.address,
            phone: updatedSupplier.phone,
            tax_id: updatedSupplier.taxId,
            color: updatedSupplier.color,
            default_price: updatedSupplier.defaultPrice || null
          })
          .eq('id', updatedSupplier.id);

        if (error) throw error;
      } catch (err) {
        console.error("Cloud edit supplier error:", err);
      }
    }
    toastMessage("✓ تم تعديل بيانات المورد بنجاح");
  }, [setState, user, isSupabaseConfigured, toastMessage]);

  const handleDeleteSupplier = useCallback(async (sid) => {
    const supplierName = (stateRef.current.suppliers || []).find(s => s.id === sid)?.name || sid;
    logActivity(user?.id, "حذف مورد", `تم حذف المورد نهائياً: "${supplierName}"`);
    setState(prev => {
      const filteredSuppliers = prev.suppliers.filter(s => s.id !== sid);
      const isSelectedDeleted = prev.selectedSupplier === sid;
      return {
        ...prev,
        suppliers: filteredSuppliers,
        selectedSupplier: isSelectedDeleted ? (filteredSuppliers.length ? filteredSuppliers[0].id : null) : prev.selectedSupplier
      };
    });

    if (isSupabaseConfigured && user) {
      try {
        const { error } = await supabase
          .from('suppliers')
          .delete()
          .eq('id', sid);

        if (error) throw error;
      } catch (err) {
        console.error("Cloud delete supplier error:", err);
      }
    }
    toastMessage("✓ تم حذف المورد بنجاح");
  }, [setState, stateRef, user, isSupabaseConfigured, toastMessage]);

  const handleQuickPurchaseSettle = useCallback(async (sid, amount) => {
    let updatedRows = [];
    let targetYear = null;
    let targetMonth = null;

    setState(prev => {
      const updatedPurchases = { ...prev.purchases };
      targetYear = prev.year;
      targetMonth = prev.month;
      const k = ledgerKey(sid, targetYear, targetMonth);
      
      if (!updatedPurchases[k]) {
        const days = daysInMonth(targetYear, targetMonth);
        updatedPurchases[k] = Array.from({ length: days }, (_, i) => ({
          d: i + 1,
          tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
        }));
      }

      const rows = updatedPurchases[k].map(r => ({ ...r }));
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

      updatedPurchases[k] = rows;

      return {
        ...prev,
        purchases: updatedPurchases
      };
    });

    if (isSupabaseConfigured && user && updatedRows.length > 0) {
      try {
        const syncPromises = updatedRows.map(({ idx, row }) => 
          syncPurchaseEntryToCloud(sid, targetYear, targetMonth, idx, row)
        );
        await Promise.all(syncPromises);
      } catch (err) {
        console.error("Cloud quick supplier settle error:", err);
      }
    }
    
    toastMessage("✓ تم تسوية وتوزيع المدفوعات للمورد بنجاح");
  }, [setState, isSupabaseConfigured, user, syncPurchaseEntryToCloud, toastMessage]);

  return {
    handleSelectSupplier,
    handleUpdatePurchaseRow,
    handleSyncPurchaseRow,
    handleTogglePurchaseHoliday,
    handleAddSupplier,
    handleEditSupplier,
    handleDeleteSupplier,
    handleQuickPurchaseSettle
  };
}
