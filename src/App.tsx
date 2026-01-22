import { supabase } from '@/integrations/supabase/client'

supabase.auth.getSession().then(({ data, error }) => {
  console.log('SESSION:', data)
  console.log('ERROR:', error)
})
