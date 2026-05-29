import { useCallback } from 'react';
import { supabase } from '../js/supabaseClient';
import { logActivity } from '../js/activityLog';

export default function useBackup({
  state,
  setState,
  stateRef,
  user,
  plainPassword,
  isSupabaseConfigured,
  setIsCloudLoading,
  setLastBackupTime,
  toastMessage
}) {

  // --- Cryptographic Helpers ---
  const getEncryptionKey = async (pass) => {
    const enc = new TextEncoder();
    const bytes = enc.encode(pass + "dawajin_pro_backup_salt_92837492");
    const hash = await window.crypto.subtle.digest("SHA-256", bytes);
    return await window.crypto.subtle.importKey(
      "raw",
      hash,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"]
    );
  };

  const encryptBackup = async (dataStr, pass) => {
    const key = await getEncryptionKey(pass);
    const enc = new TextEncoder();
    const encoded = enc.encode(dataStr);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      encoded
    );
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted), iv.length);
    return combined;
  };

  const decryptBackup = async (combinedBytes, pass) => {
    const key = await getEncryptionKey(pass);
    const iv = combinedBytes.slice(0, 12);
    const ciphertext = combinedBytes.slice(12);
    const decrypted = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      key,
      ciphertext
    );
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  };

  // --- Main Actions ---
  const handleBackupCloudExport = useCallback(async (customPass = null) => {
    const keyPass = customPass || plainPassword;
    if (!keyPass) {
      toastMessage("⚠️ الرجاء تسجيل الدخول أو توفير كلمة مرور لتشفير النسخة الاحتياطية", "warning");
      return false;
    }
    if (!isSupabaseConfigured || !user) {
      toastMessage("⚠️ لم يتم تهيئة المزامنة السحابية للنسخ الاحتياطي", "warning");
      return false;
    }
    setIsCloudLoading(true);
    try {
      const currentState = stateRef.current;
      const dataStr = JSON.stringify(currentState);
      const encryptedBytes = await encryptBackup(dataStr, keyPass);
      const blob = new Blob([encryptedBytes], { type: "application/octet-stream" });
      const fileName = `backup_${user.id}.bin`;

      const { error } = await supabase.storage
        .from('backups')
        .upload(fileName, blob, {
          upsert: true,
          contentType: 'application/octet-stream'
        });

      if (error) throw error;

      const nowStr = Date.now().toString();
      localStorage.setItem(`dawajin_last_backup_time_${user.id}`, nowStr);
      setLastBackupTime(parseInt(nowStr, 10));
      toastMessage("⚡ تم رفع النسخة الاحتياطية المشفرة بنجاح إلى السحابة !");
      logActivity(user?.id, "نسخ احتياطي سحابي", "تم رفع نسخة احتياطية سحابية مشفرة بنجاح");
      return true;
    } catch (err) {
      console.error("Cloud backup failed:", err);
      toastMessage("❌ فشل رفع النسخة الاحتياطية. يرجى التحقق من وجود الحاوية (backups)", "error");
      return false;
    } finally {
      setIsCloudLoading(false);
    }
  }, [plainPassword, isSupabaseConfigured, user, stateRef, setIsCloudLoading, setLastBackupTime, toastMessage]);

  const handleBackupCloudRestore = useCallback(async (customPass = null) => {
    const keyPass = customPass || plainPassword;
    if (!keyPass) {
      const promptPass = prompt("الرجاء إدخال كلمة مرور فك التشفير للنسخة الاحتياطية:");
      if (!promptPass) return;
      return handleBackupCloudRestore(promptPass);
    }
    if (!isSupabaseConfigured || !user) {
      toastMessage("⚠️ لم يتم تهيئة المزامنة السحابية للاسترجاع", "warning");
      return false;
    }
    setIsCloudLoading(true);
    try {
      const fileName = `backup_${user.id}.bin`;
      const { data, error } = await supabase.storage
        .from('backups')
        .download(fileName);

      if (error) {
        if (error.message?.includes("Object not found")) {
          alert("لم يتم العثور على أي نسخة احتياطية سحابية لهذا الحساب.");
          return false;
        }
        throw error;
      }

      const buffer = await data.arrayBuffer();
      const combinedBytes = new Uint8Array(buffer);
      const decryptedStr = await decryptBackup(combinedBytes, keyPass);
      const importedState = JSON.parse(decryptedStr);

      if (importedState.clients && importedState.ledger) {
        setState(prev => ({
          ...prev,
          ...importedState,
          month: importedState.month || prev.month,
          year: importedState.year || prev.year,
          view: "dashboard"
        }));
        toastMessage("⚡ تم استعادة البيانات المشفرة السحابية بنجاح !");
        logActivity(user?.id, "استعادة نسخ سحابي", "تم استيراد نسخة احتياطية سحابية بنجاح");
        return true;
      } else {
        alert("ملف النسخة الاحتياطية غير صالح.");
        return false;
      }
    } catch (err) {
      console.error("Cloud restore failed:", err);
      alert("فشل فك تشفير النسخة الاحتياطية السحابية. يرجى التحقق من كلمة المرور.");
      return false;
    } finally {
      setIsCloudLoading(false);
    }
  }, [plainPassword, isSupabaseConfigured, user, setState, setIsCloudLoading, toastMessage]);

  const handleBackupExport = useCallback(() => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", `dawajin_pro_backup_${Date.now()}.json`);
    dlAnchorElem.click();
    toastMessage("✓ تم تحميل ملف النسخة الاحتياطية");
    logActivity(user?.id, "نسخ احتياطي محلي", "تم تحميل ملف نسخ احتياطي بصيغة JSON");
  }, [state, user, toastMessage]);

  const handleBackupImport = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = function(e) {
      try {
        const importedState = JSON.parse(e.target.result);
        if (importedState.clients && importedState.ledger) {
          setState(prev => ({
            ...prev,
            ...importedState,
            month: importedState.month || prev.month,
            year: importedState.year || prev.year,
            view: "dashboard"
          }));
          toastMessage("✓ تم استيراد البيانات بنجاح !");
          logActivity(user?.id, "استيراد نسخ محلي", "تم استيراد ملف نسخ احتياطي بصيغة JSON");
        } else {
          alert("ملف غير صالح.");
        }
      } catch (err) {
        alert("فشل قراءة الملف.");
      }
    };
    reader.readAsText(file);
  }, [setState, user, toastMessage]);

  return {
    handleBackupCloudExport,
    handleBackupCloudRestore,
    handleBackupExport,
    handleBackupImport
  };
}
