# Mini Factory

## Deploy no GitHub Pages + Supabase

1. Cria um projeto no Supabase.
2. Em **SQL Editor**, executa `supabase/schema.sql`.
3. Vai a **Project Settings → API** e copia:
   - Project URL
   - anon public key
4. Abre `app.js` e substitui:
   - `COLE_AQUI_O_SUPABASE_URL`
   - `COLE_AQUI_A_ANON_KEY`
5. Cria um repositório no GitHub e envia:
   - `index.html`
   - `style.css`
   - `app.js`
   - `supabase/schema.sql`
6. Em GitHub → Settings → Pages:
   - Deploy from branch
   - `main`
   - `/ (root)`

### Nota
Este é um protótipo funcional. O estado da fábrica é guardado no Supabase. A autenticação usa Supabase Auth. O cliente não deve ser considerado um servidor autoritativo para uma economia competitiva: para um jogo público com anti-cheat forte, move a simulação económica e validação de produção para Edge Functions/backend.
