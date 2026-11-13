# Checkpoint 13/11/2026 — Black Friday 2026 (preparação, nada enviado)

- Segmentação nova: RECÊNCIA DE COMPRA (filtro "Sem comprar há X dias"; valores na campanha).
- Campanha 6 → "Black Friday 2026 · Compradores últimos 2 anos (19/11)": recência < 731 dias (2.615 clientes).
- Campanha 7 → "Black Friday 2026 · Demais clientes (20/11)": recência > 730 dias, inclui quem nunca comprou (3.649 clientes).
- Mensagens (mesmo flyer, sem "Como funciona"):
  - 3 Lançamento · Compradores 2 anos (19/11) — campanha 6
  - 4 Lançamento · Demais clientes (20/11) — campanha 7
  - 5/6 É hoje (27/11) — campanhas 6/7
  - 7/8 Últimas horas (30/11) — campanhas 6/7
  - 27/11 e 30/11 saem por Retransmitir na transmissão de cada campanha.
- Ritmo 60/min: cliente (espera 600 ms) no branch preview (465d4b4); migração
  20261113_transmissao_ritmo_60_por_minuto.sql AINDA NÃO APLICADA (Supabase MCP fora do ar).
  Sem ela, novas transmissões usam o padrão antigo (10/min, 120/h, 300/dia).
