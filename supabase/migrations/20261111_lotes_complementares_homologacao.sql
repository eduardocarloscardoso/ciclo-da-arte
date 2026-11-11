-- Complementos de homologação: preservar histórico e autorização própria.
ALTER TABLE public.cda_envio_lotes
 ADD COLUMN IF NOT EXISTS lote_origem_id bigint REFERENCES public.cda_envio_lotes(id) ON DELETE RESTRICT;
ALTER TABLE public.cda_envio_lotes
 DROP CONSTRAINT IF EXISTS cda_envio_lotes_campanha_id_mensagem_id_modo_key;
CREATE UNIQUE INDEX IF NOT EXISTS cda_lote_principal_unico
 ON public.cda_envio_lotes(campanha_id,mensagem_id,modo) WHERE lote_origem_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS cda_lote_complementar_origem_unico
 ON public.cda_envio_lotes(lote_origem_id) WHERE lote_origem_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.cda_preparar_lote_homologacao(
 p_campanha_id bigint,p_mensagem_id bigint,p_usuario uuid)
RETURNS jsonb LANGUAGE plpgsql SET search_path='' AS $$
DECLARE v_lote_id bigint;v_criado boolean:=false;v_quantidade integer;
BEGIN
 IF p_campanha_id IS NULL OR p_mensagem_id IS NULL OR p_usuario IS NULL
 THEN RAISE EXCEPTION 'Parâmetros obrigatórios';END IF;
 IF NOT EXISTS(SELECT 1 FROM public.cda_campanha_mensagens
  WHERE id=p_mensagem_id AND campanha_id=p_campanha_id)
 THEN RAISE EXCEPTION 'Mensagem não pertence à campanha';END IF;
 SELECT id INTO v_lote_id FROM public.cda_envio_lotes
 WHERE campanha_id=p_campanha_id AND mensagem_id=p_mensagem_id
   AND modo='homologacao' AND lote_origem_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN
  INSERT INTO public.cda_envio_lotes(campanha_id,mensagem_id,modo,criado_por)
  VALUES(p_campanha_id,p_mensagem_id,'homologacao',p_usuario)
  RETURNING id INTO v_lote_id;
  v_criado:=true;
  INSERT INTO public.cda_envio_lote_itens
   (lote_id,destinatario_origem_id,pessoa_id,nome,email)
  SELECT v_lote_id,d.id,d.pessoa_id,p.nome,lower(btrim(d.email))
  FROM (SELECT DISTINCT ON(lower(btrim(email))) * FROM public.cda_homologacao_destinatarios
   WHERE campanha_id=p_campanha_id AND ativo
   AND lower(btrim(email)) ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
   ORDER BY lower(btrim(email)),id) d
  JOIN public.cda_homologacao_pessoas p ON p.id=d.pessoa_id
  WHERE NOT EXISTS(SELECT 1 FROM public.cda_email_supressoes s
   WHERE lower(btrim(s.email))=lower(btrim(d.email)));
 END IF;
 SELECT count(*) INTO v_quantidade FROM public.cda_envio_lote_itens WHERE lote_id=v_lote_id;
 RETURN jsonb_build_object('lote_id',v_lote_id,'criado',v_criado,
  'quantidade',v_quantidade,'envio_habilitado',false);
END $$;

CREATE OR REPLACE FUNCTION public.cda_preparar_complemento_homologacao(
 p_lote_origem_id bigint,p_usuario uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE v_orig public.cda_envio_lotes%ROWTYPE;v_item public.cda_envio_lote_itens%ROWTYPE;
 v_dest public.cda_homologacao_destinatarios%ROWTYPE;v_nome text;v_novo bigint;
BEGIN
 IF p_lote_origem_id IS NULL OR p_usuario IS NULL THEN RAISE EXCEPTION 'Parâmetros ausentes';END IF;
 SELECT * INTO v_orig FROM public.cda_envio_lotes
 WHERE id=p_lote_origem_id AND modo='homologacao' AND lote_origem_id IS NULL FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Lote original inválido'; END IF;
 -- Evita misturar complementos com execução ainda pendente ou indeterminada.
 IF EXISTS(SELECT 1 FROM public.cda_envio_lote_itens WHERE lote_id=v_orig.id
    AND situacao NOT IN('entregue','devolvido','falha','reclamacao'))
 THEN RAISE EXCEPTION 'Finalize/revise todos os destinatários do lote original';END IF;
 IF (SELECT count(*) FROM public.cda_envio_lote_itens WHERE lote_id=v_orig.id AND situacao='devolvido')<>1
 THEN RAISE EXCEPTION 'Complemento exige exatamente uma devolução para correção';END IF;
 SELECT * INTO v_item FROM public.cda_envio_lote_itens
 WHERE lote_id=v_orig.id AND situacao='devolvido' FOR UPDATE;
 IF v_item.tentativa_id IS NULL OR v_item.resend_email_id IS NULL OR v_item.ultimo_evento<>'email.bounced'
 THEN RAISE EXCEPTION 'Devolução sem prova do Resend';END IF;
 SELECT * INTO v_dest FROM public.cda_homologacao_destinatarios
 WHERE id=v_item.destinatario_origem_id AND pessoa_id=v_item.pessoa_id
  AND campanha_id=v_orig.campanha_id AND ativo FOR UPDATE;
 IF NOT FOUND OR lower(btrim(v_dest.email))=lower(btrim(v_item.email))
 THEN RAISE EXCEPTION 'Endereço corrigido e ativo não encontrado';END IF;
 IF lower(btrim(v_dest.email)) !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
 OR EXISTS(SELECT 1 FROM public.cda_email_supressoes WHERE lower(btrim(email))=lower(btrim(v_dest.email)))
 THEN RAISE EXCEPTION 'Novo endereço inválido ou suprimido';END IF;
 IF EXISTS(SELECT 1 FROM public.cda_envio_lote_itens i
   JOIN public.cda_envio_lotes l ON l.id=i.lote_id
   WHERE l.campanha_id=v_orig.campanha_id AND l.mensagem_id=v_orig.mensagem_id
    AND lower(btrim(i.email))=lower(btrim(v_dest.email)))
 THEN RAISE EXCEPTION 'Novo endereço já processado ou registrado em lote desta mensagem';END IF;
 IF EXISTS(SELECT 1 FROM public.cda_envio_lotes WHERE lote_origem_id=v_orig.id)
 THEN RAISE EXCEPTION 'Lote complementar já existente; utilize o lote anterior';END IF;
 SELECT nome INTO v_nome FROM public.cda_homologacao_pessoas WHERE id=v_item.pessoa_id;
 INSERT INTO public.cda_envio_lotes(campanha_id,mensagem_id,modo,criado_por,lote_origem_id)
 VALUES(v_orig.campanha_id,v_orig.mensagem_id,'homologacao',p_usuario,v_orig.id)
 RETURNING id INTO v_novo;
 INSERT INTO public.cda_envio_lote_itens(lote_id,destinatario_origem_id,pessoa_id,nome,email)
 VALUES(v_novo,v_dest.id,v_dest.pessoa_id,v_nome,lower(btrim(v_dest.email)));
 INSERT INTO public.cda_envio_lote_execucao_controle(lote_id,habilitado)
 VALUES(v_novo,false);
 RETURN jsonb_build_object('lote_id',v_novo,'lote_origem_id',v_orig.id,
   'quantidade',1,'email',lower(btrim(v_dest.email)),'envio_habilitado',false);
END $$;
REVOKE ALL ON FUNCTION public.cda_preparar_complemento_homologacao(bigint,uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.cda_preparar_complemento_homologacao(bigint,uuid) TO service_role;
