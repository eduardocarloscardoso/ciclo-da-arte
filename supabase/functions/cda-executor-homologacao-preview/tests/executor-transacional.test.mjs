// node --test (apenas mocks, nenhum envio externo)
import test from "node:test";
import assert from "node:assert/strict";
import {executarItemHomologacaoBloqueado,sha256Json} from "../executor-transacional.mjs";
const loteId=1,itemId=1,chave="ad46021f-1a57-421a-937c-22e6b9e33c71";
const payload={from:"Ciclo <noreply@send.ciclodaarte.com.br>",
 to:["teste@example.com"],subject:"[TESTE] Teste",html:"<p>Teste</p>",text:"Teste"};
async function setup(allowed){
 const sha256=await sha256Json(payload);
 const calls=[];
 const store={
  autorizar:async id=>{calls.push("autorizar");return{
    habilitado:allowed,autorizado:allowed,modo:"homologacao",lote_id:id};},
  reservar:async (l,i,h)=>{calls.push("reservar");return{
    item_id:i,payload_sha256:h,chave_idempotencia:chave,tentativa_id:7};},
  marcarSolicitacao:async()=>{calls.push("marcar");return{
    solicitada:true,chave_idempotencia:chave};},
  concluir:async()=>{calls.push("concluir");}
 };
 const transmitir=async()=>{calls.push("resend");return{
  estado:"aceita",resend_email_id:"01a1c5d7-0cc5-76db-868f-9a23ab29d095"}};
 return {sha256,calls,store,transmitir};
}
test("bloqueado no banco não reserva e não envia",async()=>{
 const x=await setup(false);
 const r=await executarItemHomologacaoBloqueado({loteId,itemId,payload,
  chave,sha256:x.sha256,apiKey:"TESTE_SEM_CREDENCIAL",
  store:x.store,transmitir:x.transmitir});
 assert.equal(r.estado,"bloqueado");assert.deepEqual(x.calls,["autorizar"]);
});
test("hash divergente impede qualquer chamada",async()=>{
 const x=await setup(true);
 await assert.rejects(executarItemHomologacaoBloqueado({loteId,itemId,payload,
  chave,sha256:"a".repeat(64),apiKey:"TESTE",
  store:x.store,transmitir:x.transmitir}),/Payload modificado/);
 assert.deepEqual(x.calls,[]);
});
test("marcação falhou, transmissão não é chamada",async()=>{
 const x=await setup(true);
 x.store.marcarSolicitacao=async()=>{throw Error("LOCK");};
 await assert.rejects(executarItemHomologacaoBloqueado({loteId,itemId,payload,
  chave,sha256:x.sha256,apiKey:"TESTE",store:x.store,transmitir:x.transmitir}),/LOCK/);
 assert.deepEqual(x.calls,["autorizar","reservar"]);
});
test("resultado confirmado usa uma única transmissão",async()=>{
 const x=await setup(true);
 const r=await executarItemHomologacaoBloqueado({loteId,itemId,payload,
  chave,sha256:x.sha256,apiKey:"TESTE",store:x.store,transmitir:x.transmitir});
 assert.equal(r.estado,"aceita");
 assert.deepEqual(x.calls,["autorizar","reservar","marcar","resend","concluir"]);
});
test("timeout é indeterminado e não repete",async()=>{
 const x=await setup(true);
 x.transmitir=async()=>{x.calls.push("resend");throw Error("timeout");};
 const r=await executarItemHomologacaoBloqueado({loteId,itemId,payload,
  chave,sha256:x.sha256,apiKey:"TESTE",store:x.store,transmitir:x.transmitir});
 assert.equal(r.estado,"indeterminada");
 assert.equal(x.calls.filter(s=>s==="resend").length,1);
});
test("falha de gravação após chamada exige revisão manual",async()=>{
 const x=await setup(true);x.store.concluir=async()=>{throw Error("DB");};
 const r=await executarItemHomologacaoBloqueado({loteId,itemId,payload,
  chave,sha256:x.sha256,apiKey:"TESTE",store:x.store,transmitir:x.transmitir});
 assert.equal(r.estado,"revisao_manual");
 assert.equal(x.calls.filter(s=>s==="resend").length,1);
});
