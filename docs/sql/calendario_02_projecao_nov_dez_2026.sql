-- ════════════════════════════════════════════════════════════════════
-- Calendário Comercial — fatia 2: projeção dos eventos de nov/dez 2026 — 30/10/2026 (aprovada por Cardoso).
-- Bases: média por evento 2025–2026 (cda_canal_eventos_mes; valor da Prestação quando existe, senão Histórico
-- limpo): Luedji R$ 13.478,41/show · Gilsons R$ 8.683,78/show · Feiras R$ 18.843,17/feira.
-- E-commerce: nov/dez 2025 × 0,625 (jan–ago 2026 R$ 168.862,63 ÷ jan–ago 2025 R$ 270.190,62 = queda de 37,5%);
-- média diária normal 1–19/11/2025 = R$ 939,13; Black Friday / Cyber / Natal = só o acima dessa média.
-- Ajustes de Cardoso: FACC Zudizilla 30 × R$ 180; D Space e Rosenbaum Natal R$ 10.000 cada; Hostel Gaia ticket R$ 150.
-- ════════════════════════════════════════════════════════════════════
alter table public.cda_cal_evento add column if not exists memoria_projecao text;

update public.cda_cal_evento e set projecao = v.proj, memoria_projecao = v.mem,
       qtd_prevista = coalesce(v.qtd, e.qtd_prevista), ticket_medio = coalesce(v.tkt, e.ticket_medio)
from (values
 (1 , 17608.07::numeric, null::numeric, null::numeric, 'Base e-commerce nov/2025 sem o extra da Black Friday: R$ 35.365,22 − R$ 7.191,23 = R$ 28.173,99 × 0,625 (desempenho 2026/2025)'),
 (2 , 13478.41, null, null, 'Média por show Luedji Luna 2025–2026: R$ 188.697,77 ÷ 14 shows'),
 (3 , null, null, null, 'Só informar — custo já incluso na Provisão Prevista'),
 (4 , 18843.17, null, null, 'Média por feira/evento 2025–2026: R$ 207.274,91 ÷ 11'),
 (5 , 13478.41, null, null, 'Média por show Luedji Luna 2025–2026: R$ 188.697,77 ÷ 14 shows'),
 (6 , 8683.78, null, null, 'Média por show Gilsons 2025–2026: R$ 95.521,62 ÷ 11 shows'),
 (7 , 18843.17, null, null, 'Média por feira/evento 2025–2026: R$ 207.274,91 ÷ 11'),
 (8 , 13478.41, null, null, 'Média por show Luedji Luna 2025–2026: R$ 188.697,77 ÷ 14 shows'),
 (9 , 18843.17, null, null, 'Média por feira/evento 2025–2026: R$ 207.274,91 ÷ 11'),
 (10, 5400.00, 30, 180, 'Manual (Cardoso): 30 peças × R$ 180 — vendas da collab em 2026 muito baixas para servir de base'),
 (11, 25000.00, 200, 125, 'Manual: 200 peças × R$ 125 (bonés e lenços)'),
 (12, 4494.34, null, null, 'Extra Black Friday 20–30/11/2025: R$ 17.521,69 − 11 dias × R$ 939,13 = R$ 7.191,23 × 0,625'),
 (13, 7000.00, 100, 70, 'Manual: 100 peças × R$ 70 (Private Label)'),
 (14, 418.82, null, null, 'Extra Cyber Monday 01/12/2025: R$ 1.609,27 − R$ 939,13 = R$ 670,14 × 0,625'),
 (15, 18373.11, null, null, 'Base e-commerce dez/2025 sem os extras de Cyber e Natal: R$ 41.010,86 − R$ 670,14 − R$ 10.942,62 = R$ 29.398,11 × 0,625'),
 (16, 6838.87, null, null, 'Extra Natal 02–24/12/2025: R$ 32.542,68 − 23 dias × R$ 939,13 = R$ 10.942,62 × 0,625'),
 (17, 10000.00, null, null, 'Manual (Cardoso): R$ 10.000 — feira longa (11 dias)'),
 (18, 10000.00, null, null, 'Manual (Cardoso): R$ 10.000 — feira longa (10 dias)'),
 (19, null, null, null, 'A definir'),
 (20, null, null, null, 'A definir'),
 (21, null, null, null, 'A definir'),
 (22, 7500.00, 50, 150, 'Manual: 50 peças × R$ 150 (Revenda Futura 1)'),
 (23, 10500.00, 150, 70, 'Manual: 150 peças × R$ 70 (Private Label)'),
 (24, 10500.00, 100, 105, 'Manual: 40 corta-ventos + 60 T-shirts = 100 peças × R$ 105 (R$ 10.500 informados)')
) as v(id, proj, qtd, tkt, mem)
where e.id = v.id;
