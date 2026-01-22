// This file was cleaned and adapted to work with a custom Supabase project
// Compatible with Vite + EasyPanel + VPS deployment

import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

// Environment variables (Vite only exposes variables with VITE_)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// Safety check to avoid silent errors
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('❌ Supabase environment variables are missing')
}

// Create Supabase client
export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)

/*
How to use:

import { supabase } from '@/integrations/supabase/client'

const { data, error } = await supabase
  .from('your_table')
  .select('*')
*/
