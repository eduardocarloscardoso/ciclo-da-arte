# Checkpoint 13/11/2026 — Black Friday 2026 (preparação, nada enviado)

Estado final após ajustes pedidos por Cardoso:
- Uma campanha só: "Black Friday 2026" (id 6), segmentação "Todos Clientes com E-mail"
  (filtro novo "Tem e-mail válido"), público 5.192 clientes; envio único em 20/11. Lista ainda não congelada.
- Biblioteca: uma mensagem, "Black Friday · Lançamento (20/11)" (id 3), flyer campanha-1794579345841-178336.jpg,
  sem "Como funciona".
- Removidos: campanha 7, mensagens 4–8, segmentação "RECÊNCIA DE COMPRA" (criadas sem pedido).
- Produção = preview = 2e01d54 (backup do main anterior: backup/main-antes-filtro-email-2026-11-13 → 8d0a9cd).
- Ritmo 60/min: código publicado (espera de 600 ms no cliente); migração
  20261113_transmissao_ritmo_60_por_minuto.sql NÃO aplicada — limites do banco seguem 10/min, 120/h, 300/dia.
- Atenção: preview e produção usam o MESMO banco Supabase; dados criados no preview valem em produção.
