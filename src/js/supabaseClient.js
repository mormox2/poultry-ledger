import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

const isConfigured = 
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-supabase-project') &&
  supabaseUrl !== 'https://your-supabase-project.supabase.co';

if (!isConfigured) {
  console.warn(
    "⚠️ تنبيه: لم يتم تهيئة Supabase أو يتم استخدام قيم تجريبية. سيتم الانتقال للعمل المحلي كحالة احتياطية."
  );
}

export const supabase = isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ data: {}, error: new Error("Supabase not configured") }),
        signUp: async () => ({ data: {}, error: new Error("Supabase not configured") }),
        signOut: async () => ({ error: null })
      },
      storage: {
        from: () => ({
          upload: async () => ({ data: null, error: new Error("Supabase not configured") }),
          download: async () => ({ data: null, error: new Error("Supabase not configured") })
        })
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [], error: null }),
            single: async () => ({ data: null, error: new Error("Supabase not configured") })
          }),
          order: async () => ({ data: [], error: null }),
          single: async () => ({ data: null, error: new Error("Supabase not configured") })
        }),
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: new Error("Supabase not configured") })
          })
        }),
        update: () => ({
          eq: async () => ({ data: null, error: new Error("Supabase not configured") })
        }),
        delete: () => ({
          eq: async () => ({ data: null, error: new Error("Supabase not configured") })
        }),
        upsert: () => ({
          eq: async () => ({ data: null, error: new Error("Supabase not configured") })
        })
      })
    };

