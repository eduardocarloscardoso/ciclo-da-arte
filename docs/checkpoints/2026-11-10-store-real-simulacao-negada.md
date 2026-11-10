# CHECKPOINT — STORE TRANSACIONAL REAL / SIMULAÇÃO BLOQUEADA
Data: 10/11/2026. Branch `preview/campanha-mensagens`. Commit funcional `48dabe620fa1e9184ac08cfecf051b32a27649a2`.

## Implementado
- Módulo `supabase/functions/cda-executor-homologacao-preview/store-transacional.mjs`: encapsula consultas e RPCs de reserva, marcação e conclusão do lote, com credencial de serviço apenas server-side; sem fallback de escrita diante de erro.
- O endpoint `cda-executor-homologacao-preview` versão 10, ACTIVE, importa o store e o orquestrador. A ação `simular_orquestracao` agora chama a RPC real somente leitura `cda_resumo_preenvio_homologacao`, usando um payload **sintético**, e dispõe de adaptadores que lançam exceção em qualquer tentativa de escrita ou envio.
- A rota `enviar` ainda retorna HTTP 423 incondicional antes dos caminhos novos. Não existe chamada ao Resend a partir do endpoint.
- Testes versionados em `tests/store-transacional.test.mjs`, contendo mocks de permissão negada e contrato de RPC; **não foram executados em Node** nesta rodada.

## Verificações
- Edge Function v10 ACTIVE com quatro arquivos, `verify_jwt=true`, import do store verificado.
- A RPC consultada por service_role devolveu: campanha 4 Luedji Luna São Paulo, mensagem 1 LUEDJI20, cinco itens pendentes, autorização false, envio false.
- `anon` e `authenticated` não podem executar a RPC de resumo; service_role sim.
- Lote #1: 5 chaves distintas, zero operações, zero tentativas vinculadas, zero Resend IDs, zero envios e nenhuma autorização.
- **Pendente**: invocar a rota Edge via sessão real autenticada da equipe e executar testes JavaScript de orquestração/adapter em runtime antes de considerar E2E homologado.
- Sem mudanças visuais; `main` e produção Vercel preservadas.

## Próximo passo
Preparar mecanismo de aprovação de um lote exato sem conceder autorização ainda; testar circuito com JWT real e mocks. Manter todas as CHECKs do banco exigindo envio false/autorização null. Não enviar a cinco testes nem a 867 oficiais sem aprovação específica.
