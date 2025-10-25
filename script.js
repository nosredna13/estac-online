// ===========================
// script.js - lógica e Firebase
// ===========================

/* ============================
   Configuração Firebase (seu projeto)
   ============================ */
const firebaseConfig = {
  apiKey: "AIzaSyALUYbhc6OeauTBNL2K7EkKW2So706HZdU",
  authDomain: "teste-estac.firebaseapp.com",
  projectId: "teste-estac",
  storageBucket: "teste-estac.firebasestorage.app",
  messagingSenderId: "266651221931",
  appId: "1:266651221931:web:e43dd1e4687a1da9361cee",
  measurementId: "G-07Y4BKG0TM"
};

// Inicializa Firebase (compat)
firebase.initializeApp(firebaseConfig);
try { firebase.analytics(); } catch (e) { /* analytics opcional */ }
const db = firebase.firestore();
const storage = firebase.storage();

/* ============================
   Helpers DOM e utilidades
   ============================ */
const $ = id => document.getElementById(id);
function formatLocal(iso){ try { return new Date(iso).toLocaleString(); } catch(e){ return iso; } }
function calcularTempo(entradaISO, saidaISO){
  const diffMs = new Date(saidaISO) - new Date(entradaISO);
  if(isNaN(diffMs) || diffMs < 0) return null;
  const totalMin = Math.floor(diffMs / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h ${m}m`;
}

/* ============================
   Abas
   ============================ */
function trocarAbas(evt){
  const btn = evt.currentTarget;
  const target = btn.dataset.target;
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c=>c.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById(target).classList.add('active');
  // limpar mensagens
  $('resEntrada').innerHTML=''; $('resSaida').innerHTML=''; $('resBusca').innerHTML='';
}

/* ============================
   Carregar últimos registros (painel)
   ============================ */
async function carregarUltimos(){
  const lista = $('listaRegistros');
  lista.innerHTML = 'Carregando...';
  try{
    const snap = await db.collection('registros').orderBy('horarioEntrada','desc').limit(8).get();
    if(snap.empty){ lista.innerHTML = '<i>Nenhum registro</i>'; return; }
    const rows = [];
    snap.forEach(d=>{
      const r = d.data();
      rows.push(`<div style="margin-bottom:8px;padding:8px;border-radius:6px;background:#f8fcff;color:#002">
        <div style="font-weight:700">${r.placa || '[sem placa]'}</div>
        <div style="font-size:0.85rem">${r.tipo} • ${formatLocal(r.horarioEntrada)}</div>
        <div style="font-size:0.82rem">${ r.tempo ? 'Tempo: '+r.tempo : (r.saida? 'Tempo: '+r.tempo : 'No pátio') }</div>
      </div>`);
    });
    lista.innerHTML = rows.join('');
  }catch(err){
    console.error(err);
    lista.innerHTML = '<i>Erro ao carregar</i>';
  }
}

/* ============================
   Registrar Entrada
   ============================ */
async function registrarEntrada(){
  const placaText = $('placaEntrada').value.trim().toUpperCase();
  const tipo = $('tipoEntrada').value || 'Avulso';
  const file = $('fotoEntrada').files[0];
  const horarioEntrada = new Date().toISOString();

  if(!placaText && !file){
    return alert('Informe a placa (texto) ou envie uma foto.');
  }
  $('resEntrada').textContent = 'Registrando…';

  try{
    const placaFinal = placaText || null;
    let fotoURL = null;
    if(file){
      const nome = `fotos/${ (placaFinal || 'semplaca') }_${Date.now()}`;
      const ref = storage.ref().child(nome);
      await ref.put(file);
      fotoURL = await ref.getDownloadURL();
    }

    const registro = {
      placa: placaFinal,
      tipo,
      horarioEntrada,
      fotoEntrada: fotoURL || null,
      saida: null,
      fotoSaida: null,
      tempo: null
    };

    await db.collection('registros').add(registro);

    $('resEntrada').innerHTML = '<span style="color:#dff7d8">Entrada registrada.</span>';
    $('placaEntrada').value = ''; $('fotoEntrada').value = '';
    await carregarUltimos();
  }catch(err){
    console.error(err);
    alert('Erro ao registrar entrada: ' + (err.message||err));
    $('resEntrada').textContent = '';
  }
}

/* ============================
   Registrar Saída
   ============================ */
async function registrarSaida(){
  const placaText = $('placaSaida').value.trim().toUpperCase();
  const file = $('fotoSaida').files[0];
  if(!placaText && !file) return alert('Informe a placa (texto) ou envie uma foto.');
  $('resSaida').textContent = 'Processando saída…';

  try{
    const placaFinal = placaText || null;
    if(!placaFinal){
      return alert('Por favor digite a placa para registrar saída (quando usar apenas foto, digite a placa manualmente).');
    }

    const q = await db.collection('registros')
      .where('placa','==',placaFinal)
      .where('saida','==',null)
      .orderBy('horarioEntrada','desc')
      .limit(1)
      .get();

    if(q.empty){
      return alert('Nenhuma entrada aberta encontrada para essa placa.');
    }

    const doc = q.docs[0];
    const data = doc.data();
    const horarioSaida = new Date().toISOString();
    const tempo = calcularTempo(data.horarioEntrada, horarioSaida);

    let fotoSaidaURL = null;
    if(file){
      const nome = `fotos/${placaFinal}_saida_${Date.now()}`;
      const ref = storage.ref().child(nome);
      await ref.put(file);
      fotoSaidaURL = await ref.getDownloadURL();
    }

    await db.collection('registros').doc(doc.id).update({
      saida: horarioSaida,
      fotoSaida: fotoSaidaURL || null,
      tempo
    });

    $('resSaida').innerHTML = `<span style="color:#dff7d8">Saída registrada. Tempo: ${tempo}</span>`;
    $('placaSaida').value = ''; $('fotoSaida').value = '';
    await carregarUltimos();
  }catch(err){
    console.error(err);
    alert('Erro ao registrar saída: ' + (err.message||err));
    $('resSaida').textContent = '';
  }
}

/* ============================
   Pesquisar Placa
   ============================ */
async function pesquisarPlaca(){
  const placa = $('placaBusca').value.trim().toUpperCase();
  const out = $('resBusca');
  out.innerHTML = '';
  if(!placa) return alert('Digite a placa para pesquisar.');

  out.textContent = 'Pesquisando…';
  try{
    const q = await db.collection('registros')
      .where('placa','==',placa)
      .orderBy('horarioEntrada','desc')
      .limit(1)
      .get();

    if(q.empty){
      out.innerHTML = `<p>Nenhum registro encontrado para <b>${placa}</b>.</p>`;
      return;
    }

    const r = q.docs[0].data();
    let html = `<p><b>Placa:</b> ${r.placa || '[sem placa]'}</p>
                <p><b>Tipo:</b> ${r.tipo}</p>
                <p><b>Entrada:</b> ${formatLocal(r.horarioEntrada)}</p>
                <p><b>Saída:</b> ${ r.saida ? formatLocal(r.saida) : '<i>Não saiu</i>' }</p>
                <p><b>Tempo:</b> ${ r.tempo ? r.tempo : (r.saida ? calcularTempo(r.horarioEntrada, r.saida) : '<i>Em andamento</i>') }</p>`;

    if(r.fotoEntrada) html += `<div class="foto"><b>Foto entrada:</b><br><img src="${r.fotoEntrada}" alt="entrada"></div>`;
    if(r.fotoSaida)  html += `<div class="foto"><b>Foto saída:</b><br><img src="${r.fotoSaida}" alt="saida"></div>`;

    out.innerHTML = html;
  }catch(err){
    console.error(err);
    out.innerHTML = `<p>Erro na pesquisa: ${err.message||err}</p>`;
  }
}

/* ============================
   Inicialização de eventos
   ============================ */
document.addEventListener('DOMContentLoaded', ()=>{
  // abas
  document.querySelectorAll('.tab').forEach(btn=>btn.addEventListener('click', trocarAbas));
  // botões
  $('btnEntrada').addEventListener('click', registrarEntrada);
  $('btnSaida').addEventListener('click', registrarSaida);
  $('btnBusca').addEventListener('click', pesquisarPlaca);
  $('btnRefresh').addEventListener('click', carregarUltimos);

  // carregar lista inicial
  carregarUltimos();
});