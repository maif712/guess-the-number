import { createClient } from '@supabase/supabase-js'
import Cookies from 'js-cookie';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true, // Enable session persistence
      storage: {
        getItem: (key) => {
          // Try to get from cookie first
          const cookieValue = Cookies.get(key);
          return cookieValue ? Promise.resolve(cookieValue) : Promise.resolve(null);
        },
        setItem: (key, value) => {
          Cookies.set(key, value, { 
            expires: 7,
            secure: true,
            sameSite: 'strict'
          });
          return Promise.resolve();
        },
        removeItem: (key) => {
          Cookies.remove(key);
          return Promise.resolve();
        },
      },
    },
  }
);
