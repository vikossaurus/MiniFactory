# Mini Factory

Jogo de fábrica infinito para GitHub Pages + Supabase.

## 1. Supabase

No teu projeto Supabase abre **SQL Editor**, cola o conteúdo de:

`supabase/schema.sql`

e executa.

## 2. GitHub Pages

Manda estes ficheiros para o repositório:

- index.html
- style.css
- app.js
- supabase/schema.sql

Depois vai a Settings → Pages → Deploy from branch → main → / (root).

## 3. Funcionalidades

- Login/registo
- Save na cloud
- Fábrica infinita
- Mineradores
- Tapetes
- Fornalhas
- Armazéns
- Geradores
- Energia
- Produção automática
- Venda de barras
- Leaderboard
- Fábricas públicas
- Visitar fábricas
- Controlos por toque para telemóvel

## 4. Nota de segurança

A publishable key fica no frontend por design. Nunca coloques uma `sb_secret_...` ou `service_role` no GitHub.

Este protótipo calcula a economia no cliente. Para um jogo competitivo grande, a produção, dinheiro e compras devem ser validados no backend/Edge Functions para impedir cheats.
