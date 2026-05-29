import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationCenter({
  isOpen,
  onClose,
  notifications,
  onMarkAllAsRead,
  onClearAll
}) {
  const unreadCount = notifications.filter(n => !n.read).length;

  const getIcon = (type) => {
    switch (type) {
      case 'success':
        return <span className="w-7 h-7 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs select-none">✓</span>;
      case 'warning':
        return <span className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold text-xs select-none">⚠️</span>;
      case 'error':
        return <span className="w-7 h-7 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center font-bold text-xs select-none">❌</span>;
      default:
        return <span className="w-7 h-7 rounded-full bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold text-xs select-none">ℹ️</span>;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[99999] bg-slate-950/70 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="fixed top-0 bottom-0 right-0 z-[999999] w-full max-w-sm bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col"
            style={{ direction: 'rtl' }}
          >
            {/* Header */}
            <div className="p-4 md:p-5 border-b border-slate-850 flex justify-between items-center bg-slate-950/50">
              <div className="text-right">
                <h3 className="text-sm md:text-base font-black text-amber-300 flex items-center gap-2">
                  <span>🔔 مركز الإشعارات والتنبيهات</span>
                  {unreadCount > 0 && (
                    <span className="bg-red-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full select-none animate-pulse">
                      {unreadCount} جديد
                    </span>
                  )}
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">تتبع عمليات المزامنة التلقائية والنسخ الاحتياطي وحالة النظام</p>
              </div>
              <button
                onClick={onClose}
                className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-100 transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Actions Bar */}
            <div className="px-4 py-2 border-b border-slate-850 flex justify-between items-center text-[10px] bg-slate-950/20">
              <button
                onClick={onMarkAllAsRead}
                disabled={unreadCount === 0}
                className="text-amber-500/90 hover:text-amber-400 font-bold disabled:opacity-40 disabled:hover:text-amber-500/90 transition-colors"
              >
                ✓ قراءة الكل
              </button>
              <button
                onClick={onClearAll}
                disabled={notifications.length === 0}
                className="text-red-500/90 hover:text-red-400 font-bold disabled:opacity-40 disabled:hover:text-red-500/90 transition-colors"
              >
                🗑️ مسح السجل
              </button>
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs py-20 text-center">
                  <span className="text-3xl block mb-2 select-none">🔔</span>
                  سجل التنبيهات فارغ تمامًا
                  <p className="text-[10px] text-slate-600 mt-1">ستظهر هنا إشعارات المزامنة والنسخ السحابي</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-xl border transition-all duration-150 relative ${
                      notif.read
                        ? 'bg-slate-950/20 border-slate-850 text-slate-400'
                        : 'bg-slate-850/40 border-slate-800/80 text-slate-200 shadow-sm shadow-amber-500/5'
                    }`}
                  >
                    {/* Unread marker dot */}
                    {!notif.read && (
                      <span className="absolute top-3 left-3 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                    )}

                    <div className="flex gap-2.5 items-start">
                      <div className="mt-0.5 shrink-0">{getIcon(notif.type)}</div>
                      <div className="text-right flex-1 min-w-0 pr-1">
                        <div className={`text-xs font-bold ${!notif.read ? 'text-slate-100' : 'text-slate-400'}`}>
                          {notif.title}
                        </div>
                        <div className="text-[10px] text-slate-400 leading-relaxed mt-1">
                          {notif.message}
                        </div>
                        <div className="text-[8px] text-slate-550 mt-1.5 font-semibold font-mono">
                          {notif.time}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="p-3 border-t border-slate-850 bg-slate-950/40 text-center text-[9px] text-slate-500 select-none">
              Dawajin Pro — نظام حماية ومزامنة مشفر
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
