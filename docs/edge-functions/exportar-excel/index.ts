// Edge Function: exportar-excel (v6 — exige login de membro da equipe)
// Exporta o Plano de Ações (acoes + tarefas) em .xlsx.
// v6 (22/10/2026): exige Authorization com o token de sessão de um usuário
// cadastrado na tabela `equipe` (antes bastava a chave pública).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

// ── Guarda de acesso (out/2026): só membros da equipe logados ─────────────
// Valida o token de sessão do usuário (Authorization: Bearer <access_token>)
// no Supabase Auth e confere se o e-mail está na tabela `equipe`.
// A chave pública (anon/publishable) NÃO é aceita como login.
async function exigirMembroEquipe(req: Request, cors: Record<string, string>): Promise<Response | null> {
  const negar = (status: number, msg: string) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { ...cors, "Content-Type": "application/json" } });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY") || service;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return negar(401, "Faça login no sistema para usar esta função.");
    const u = await fetch(`${url}/auth/v1/user`, { headers: { apikey: anon, Authorization: `Bearer ${token}` } });
    if (!u.ok) return negar(401, "Sessão inválida ou expirada. Entre novamente no sistema.");
    const user = await u.json();
    const email = String(user?.email || "").trim().toLowerCase();
    if (!email) return negar(401, "Sessão sem e-mail. Entre novamente no sistema.");
    const r = await fetch(`${url}/rest/v1/equipe?select=id&email=ilike.${encodeURIComponent(email)}`, {
      headers: { apikey: service, Authorization: `Bearer ${service}` },
    });
    const rows = r.ok ? await r.json() : [];
    if (!Array.isArray(rows) || !rows.length) return negar(403, "Usuário sem acesso ao sistema.");
    return null;
  } catch (e) {
    return negar(500, "Falha ao validar acesso: " + String(e));
  }
}

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS });
  }
  const negado = await exigirMembroEquipe(req, CORS);
  if (negado) return negado;
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const [acoesRes, tarefasRes] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/acoes?order=id`, {headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}}),
      fetch(`${SUPABASE_URL}/rest/v1/tarefas?order=id`, {headers:{'apikey':SUPABASE_KEY,'Authorization':`Bearer ${SUPABASE_KEY}`}})
    ]);
    const acoes = await acoesRes.json();
    const tarefas = await tarefasRes.json();
    const fmt = (d: string) => { if(!d)return'—'; const p=d.split('-'); return `${p[2]}/${p[1]}/${p[0]}`; };
    const rows: any[] = [['FASE','NOME FASE','TAREFA Nº','NOME TAREFA','DATA INÍCIO','DATA FIM','DATA REALIZADA','RESPONSÁVEL 1','RESPONSÁVEL 2','OBSERVAÇÃO','STATUS']];
    for(const a of acoes){
      const ts=tarefas.filter((t:any)=>t.acao_id===a.id);
      if(!ts.length){rows.push([a.fase,a.title,'','','','','','','','','']);}
      else{ts.forEach((t:any,i:number)=>{rows.push([a.fase,a.title,i+1,t.titulo,fmt(t.data_inicio),fmt(t.data_fim),t.data_realizada?fmt(t.data_realizada):'',t.responsavel1||'',t.responsavel2||'',t.observacao||'',t.status==='done'?'Concluída':t.status==='active'?'Em andamento':'Pendente']);});}
    }
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!cols']=[{wch:8},{wch:45},{wch:10},{wch:45},{wch:13},{wch:13},{wch:15},{wch:20},{wch:20},{wch:40},{wch:14}];
    XLSX.utils.book_append_sheet(wb,ws,'Plano de Ações');
    const buf = XLSX.write(wb,{bookType:'xlsx',type:'buffer'});
    return new Response(buf, {
      headers: {
        'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':'attachment; filename="ciclo_da_arte_tarefas.xlsx"',
        'Access-Control-Allow-Origin':'*',
      }
    });
  } catch(e:any) {
    return new Response(JSON.stringify({error:e.message}),{status:500,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'}});
  }
});
