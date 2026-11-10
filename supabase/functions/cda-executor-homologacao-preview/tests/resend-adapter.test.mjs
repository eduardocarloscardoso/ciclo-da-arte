// Testes com fetch simulado. NENHUMA requisição de rede.
import {strict as assert} from "node:assert";
import {classificarRespostaResend,solicitarResendUmaVez} from "../resend-adapter.mjs";
const chave="ad46021f-1a57-421a-937c-22e6b9e33c71";
const payload={from:"Equipe <noreply@send.ciclodaarte.com.br>",
  to:["teste@example.com"],subject:"[TESTE] Convite",html:"<p>Teste</p>",text:"Teste"};
const chamadas=[];
const ok=await solicitarResendUmaVez({apiKey:"re_mock_nao_real",
  payload,chave,
  fetchFn:async (url,opts)=>{
    chamadas.push({url,opts});
    return{status:200,json:async()=>({id:"01a1c5d7-0cc5-76db-868f-9a23ab29d095"})};
  }});
assert.equal(chamadas.length,1);
assert.equal(chamadas[0].opts.headers["Idempotency-Key"],"ciclo-homologacao/"+chave);
assert.equal(ok.estado,"aceita");
assert.equal(classificarRespostaResend(409,{}).estado,"indeterminada");
assert.equal(classificarRespostaResend(500,{}).estado,"indeterminada");
assert.equal(classificarRespostaResend(422,{}).estado,"falha");
assert.equal(classificarRespostaResend(200,{}).estado,"indeterminada");
const timeout=await solicitarResendUmaVez({apiKey:"re_mock_nao_real",payload,chave,
  fetchFn:async()=>{throw new Error("network failed")}});
assert.equal(timeout.estado,"indeterminada");
assert.equal(chamadas.length,1);
console.log("6 cenários verificados sem rede. Nenhum envio realizado.");
