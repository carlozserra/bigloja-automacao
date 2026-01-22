import { useEffect } from 'react'
import { supabase } from './lib/supabase'

function App() {

  useEffect(() => {
    async function testSupabase() {
      const { data, error } = await supabase.auth.getSession()
      console.log('SESSION:', data)
      console.log('ERROR:', error)
    }

    testSupabase()
  }, [])

  return <h1>Teste Supabase</h1>
}

export default App
