import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('your-supabase-project')) {
  console.warn(
    "⚠️ تنبيه: لم يتم تهيئة متغيرات Supabase في ملف .env أو يتم استخدام قيم تجريبية. سيتم الانتقال للعمل المحلي كحالة احتياطية."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
