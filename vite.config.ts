
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Carica le variabili d'ambiente (incluse quelle di Vercel)
  // Utilizzo il casting a any su process per evitare l'errore "Property 'cwd' does not exist on type 'Process'"
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // Mappa process.env.API_KEY (usato nel codice Gemini) alla variabile VITE_API_KEY
      'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY),
      // Le variabili VITE_SUPABASE_* sono gestite automaticamente da Vite su import.meta.env
    },
    build: {
      chunkSizeWarningLimit: 1600, // Aumenta il limite a 1600kB per evitare il warning sui chunk vendor
    }
  }
})
