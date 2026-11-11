import test from "node:test";
import assert from "node:assert/strict";
import {criarStoreTransacional} from "../store-transacional.mjs";
const calls=[];
const mockFetch=async(url,options)=>{
 calls.push({url,options});
 if(url.endsWith("cda_resumo_preenvio_homologacao"))
   return {ok:true,json:async()=>({lote_id:1,modo:"homologacao",total:5,pendentes:5,
     autorizado:false,envio_habilitado:false,tem_operacoes:false})};
 return {ok:false,json:async()=>({})};
};
const store=criarStoreTransacional({
 supabaseUrl:"https://example.supabase.co",serviceRoleKey:"service_role_fake_for_tests_only",
 fetchFn:mockFetch});
test("autorização real ausente barra lote",async()=>{
 const r=await store.autorizar(1);
 assert.equal(r.autorizado,false);assert.equal(r.habilitado,false);
 assert.equal(r.total,5);assert.equal(calls.length,1);
});
test("requisições de escrita não fazem fallback",async()=>{
 await assert.rejects(store.reservar(1,1,"a".repeat(64)),/indisponível/);
 assert.equal(calls.length,2);
});
test("cada RPC usa service role no backend e argumentos específicos",async()=>{
 assert.equal(calls[1].url,
   "https://example.supabase.co/rest/v1/rpc/cda_reservar_tentativa_lote");
 const body=JSON.parse(calls[1].options.body);
 assert.deepEqual(body,{p_lote_id:1,p_item_id:1,p_payload_sha256:"a".repeat(64)});
});
