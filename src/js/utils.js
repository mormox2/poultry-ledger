export const MONTHS = ["يناير","فبراير","مارس","أبريل","مايو","يونيو","يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر"];
export const COLORS = ["#d4a843","#3b82f6","#22c55e","#ef4444","#a855f7","#f97316","#14b8a6","#ec4899"];

export function ledgerKey(cid, y, m) { 
  return `${cid}-${y}-${m}`; 
}

export function daysInMonth(y, m) { 
  return new Date(y, m, 0).getDate(); 
}

export function getRows(ledger, cid, y, m) {
  const k = ledgerKey(cid, y, m);
  if (!ledger[k]) {
    const days = daysInMonth(y, m);
    return Array.from({length: days}, (_, i) => ({
      d: i + 1,
      tw: "", nw: "", price: "", amt: "", paid: "", holiday: false, notes: ""
    }));
  }
  return ledger[k];
}

export function calcBalance(row) {
  return (parseFloat(row.amt) || 0) - (parseFloat(row.paid) || 0);
}

export function getTotals(ledger, cid, y, m) {
  const rows = getRows(ledger, cid, y, m);
  return rows.filter(r => !r.holiday).reduce((a, r) => ({
    tw: a.tw + (parseFloat(r.tw)||0),
    nw: a.nw + (parseFloat(r.nw)||0),
    amt: a.amt + (parseFloat(r.amt)||0),
    paid: a.paid + (parseFloat(r.paid)||0),
    days: a.amt ? a.days + 1 : a.days,
  }), { tw:0, nw:0, amt:0, paid:0, days:0 });
}

export function fmt(n) {
  if (!n && n !== 0) return "";
  return Number(n).toLocaleString("fr-TN", { minimumFractionDigits: 3, maximumFractionDigits: 3 });
}

export function exportToCSV(state) {
  const y = state.year;
  const m = state.month;
  const cl = state.clients.find(x => x.id === state.selectedClient) || state.clients[0];
  if (!cl) return;
  
  const rows = getRows(state.ledger, cl.id, y, m);
  const totals = getTotals(state.ledger, cl.id, y, m);
  
  let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
  csvContent += "سجل المبيعات اليومي - الودرني للدواجن\n";
  csvContent += `العميل: ${cl.name}, العنوان: ${cl.address}, الهاتف: ${cl.phone}\n`;
  csvContent += `الشهر: ${MONTHS[m-1]} ${y}\n\n`;
  
  csvContent += "التاريخ,الوزن الكامل (كغ),الوزن الصافي (كغ),السعر (د.ت),المبلغ الجملي,المدفوع,الباقي,ملاحظات\n";
  
  rows.forEach(r => {
    const dateStr = `${y}/${String(m).padStart(2,"0")}/${String(r.d).padStart(2,"0")}`;
    if (r.holiday) {
      csvContent += `${dateStr},عطلة,عطلة,عطلة,عطلة,عطلة,عطلة,${r.notes || ""}\n`;
    } else {
      const bal = calcBalance(r);
      csvContent += `${dateStr},${r.tw || 0},${r.nw || 0},${r.price || state.pricePerKg},${r.amt || 0},${r.paid || 0},${r.amt ? bal : 0},${r.notes || ""}\n`;
    }
  });
  
  const remaining = totals.amt - totals.paid;
  csvContent += `الإجمالي,${Math.round(totals.tw)},${Math.round(totals.nw)},-,${totals.amt},${totals.paid},${remaining},-\n`;
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `ouderni_ledger_${cl.name.replace(/\s+/g, '_')}_${y}_${m}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
