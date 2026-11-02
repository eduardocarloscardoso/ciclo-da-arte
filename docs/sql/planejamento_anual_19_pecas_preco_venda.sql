-- ════════════════════════════════════════════════════════════════════
-- Tabela de Peças a Comprar — preço unitário de venda (02/11/2026, Cardoso).
-- Cada peça passa a ter custo unitário de compra (valor_unitario) e preço unitário de venda (preco_venda):
-- custo total, receita total (potencial), % custo × ideal do segmento e cobertura da meta de receita.
-- Obrigatório na tela daqui em diante. Tabela sem linhas até 02/11/2026 (nenhum dado antigo afetado).
-- ════════════════════════════════════════════════════════════════════
alter table public.cda_pa_pecas_compra add column if not exists preco_venda numeric(12,2) not null default 0 check (preco_venda >= 0);
