// "Servidor" dentro do navegador: guarda o progresso no aparelho (localStorage) e responde às mesmas
// chamadas que as telas fazem (/api/catalogo, /api/estado, /api/rodadas...). Sem rede depois do primeiro
// carregamento. Veio do app de Geografia, com duas diferenças: há várias disciplinas (catalogo.json) e
// as mini-aulas do botão "não sei" (conteudo/materia/*.json).

import * as M from "./motor.js";

const CHAVE = "s7a3t_estado_v1";
const URL_CATALOGO = "conteudo/catalogo.json";
const LIMITE_DURACAO_S = 6 * 3600;

let catalogo = null;       // {disciplinas: [...]} com banco carregado em cada disciplina
let porId = null;          // id da questão -> questão (todas as disciplinas)
let disciplinaDaQuestao = null; // id da questão -> id da disciplina
let estado = null;         // progresso (ver estadoVazio)
let persistente = true;    // false quando o navegador bloqueia o armazenamento
const materias = new Map();// arquivo -> mini-aulas, carregadas sob demanda

const estadoVazio = () => ({ versao: 1, nome: "", proximo_id: 1, rodadas: [], respostas: [], trofeus: [], conquistas: {} });

class ErroApi extends Error {
  constructor(status, mensagem) { super(mensagem); this.status = status; }
}

// ---------------------------------------------------------------- armazenamento

function lerEstado() {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (bruto) return { ...estadoVazio(), ...JSON.parse(bruto) };
  } catch { persistente = false; }
  return estadoVazio();
}

function salvar() {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(estado));
    persistente = true;
  } catch { persistente = false; }
}

export const armazenamentoOk = () => persistente;

async function buscarJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new ErroApi(r.status, "Não consegui carregar o conteúdo. Confira a internet e tente de novo.");
  return r.json();
}

async function iniciar() {
  if (catalogo) return;
  const cat = await buscarJson(URL_CATALOGO);
  if (!cat || !Array.isArray(cat.disciplinas) || !cat.disciplinas.length) {
    throw new ErroApi(500, "O catálogo não tem nenhuma disciplina.");
  }
  porId = {};
  disciplinaDaQuestao = {};
  for (const d of cat.disciplinas) {
    const dados = await buscarJson(`conteudo/${d.banco}`);
    const problemas = M.validar(dados);
    if (problemas.length) throw new ErroApi(500, `Banco de ${d.nome} inválido: ` + problemas.join(" "));
    d.questoes = dados.questoes;
    d.materia = dados.materia || null;
    d.fonte = dados.fonte || null;
    for (const q of dados.questoes) {
      if (porId[q.id]) throw new ErroApi(500, `A questão ${q.id} aparece em mais de um banco.`);
      porId[q.id] = q;
      disciplinaDaQuestao[q.id] = d.id;
    }
  }
  catalogo = cat;
  estado = lerEstado();
}

// ---------------------------------------------------------------- consultas

const disciplinaPorId = (id) => {
  const d = catalogo.disciplinas.find((x) => x.id === id);
  if (!d) throw new ErroApi(404, "Disciplina não encontrada.");
  return d;
};

const trilhaPorId = (d, id) => {
  const t = d.trilhas.find((x) => x.id === id);
  if (!t) throw new ErroApi(404, "Trilha não encontrada.");
  return t;
};

const questoesDaTrilha = (d, t) => M.filtrar(d.questoes, t.filtro);

const rodadaPorId = (id) => {
  const r = estado.rodadas.find((x) => x.id === id);
  if (!r) throw new ErroApi(404, "Rodada não encontrada.");
  return r;
};

const questoesDaRodada = (r) => r.questoes.map((i) => porId[i]).filter(Boolean);

function feedback(q, resp, aviso = null) {
  return {
    questao_id: q.id, resposta: resp.resposta, correta: !!resp.correta, gabarito: M.gabaritoParaExibir(q),
    explicacao: q.explicacao, pagina: q.pagina ?? null, aviso,
  };
}

function historicoDasQuestoes() {
  const hist = {};
  for (const r of estado.respostas) {
    if (r.revisao) continue;
    const h = (hist[r.questao_id] ||= { vezes: 0 });
    h.vezes++;
    h.ultima_correta = !!r.correta;
    h.ultima_em = r.respondida_em;
  }
  return hist;
}

const totalDoBanco = () => Object.keys(porId).length;

function stats() {
  const concluidas = estado.rodadas.filter((r) => r.concluida_em);
  const notas = concluidas.map((r) => r.nota);
  return {
    rodadas: concluidas.length,
    trofeus: estado.trofeus.length,
    melhor_nota: notas.length ? Math.max(...notas) : null,
    rodada_perfeita: notas.some((n) => n >= 10),
    veloz: concluidas.some((r) => r.nota >= M.NOTA_TROFEU && r.duracao_s < 300),
    sequencia: M.sequenciaDeDias(concluidas.map((r) => r.concluida_em)),
    vistas: new Set(estado.respostas.filter((r) => !r.revisao).map((r) => r.questao_id)).size,
    total_banco: totalDoBanco(),
    xp: concluidas.reduce((soma, r) => soma + (r.xp || 0), 0),
  };
}

function conquistaPublica(chave, obtida_em = null) {
  const [nome, descricao] = M.CONQUISTAS[chave];
  return { chave, nome, descricao, obtida_em };
}

function conquistasNovas() {
  const novas = [...M.conquistasMerecidas(stats())].filter((c) => !estado.conquistas[c]).sort();
  for (const c of novas) estado.conquistas[c] = M.agora();
  return novas;
}

const rodadaAberta = () => [...estado.rodadas].reverse().find((r) => !r.concluida_em);

function resumoRodadaAberta(r) {
  if (!r) return null;
  const d = catalogo.disciplinas.find((x) => x.id === r.disciplina);
  const t = d && d.trilhas.find((x) => x.id === r.trilha);
  return {
    id: r.id, total: r.questoes.length,
    feitas: estado.respostas.filter((x) => x.rodada_id === r.id && !x.revisao).length,
    disciplina: r.disciplina, disciplina_nome: d ? d.nome : "", trilha: r.trilha, trilha_nome: t ? t.nome : "",
  };
}

// ---------------------------------------------------------------- "rotas"

function rotaEstado() {
  const s = stats();
  const ultima = estado.rodadas.filter((r) => r.concluida_em)
    .sort((a, b) => (a.concluida_em < b.concluida_em ? 1 : a.concluida_em > b.concluida_em ? -1 : b.id - a.id))[0];
  const nivel = M.nivelPorXp(s.xp);
  const base = M.xpParaNivel(nivel), topo = M.xpParaNivel(nivel + 1);
  return {
    titulo: catalogo.titulo || "Simulados", nome: estado.nome,
    xp: s.xp, nivel, xp_no_nivel: s.xp - base, xp_do_nivel: topo - base,
    estagio: M.estagioPorNivel(nivel), sequencia_dias: s.sequencia,
    rodadas: s.rodadas, trofeus: s.trofeus, melhor_nota: s.melhor_nota,
    banco: { total: s.total_banco, vistas: s.vistas },
    tamanho_rodada: M.TAMANHO_RODADA, nota_trofeu: M.NOTA_TROFEU,
    rodada_aberta: resumoRodadaAberta(rodadaAberta()),
    ultima_rodada: ultima ? { id: ultima.id, nota: ultima.nota, concluida_em: ultima.concluida_em } : null,
    conquistas: Object.keys(M.CONQUISTAS).map((k) => conquistaPublica(k, estado.conquistas[k] || null)),
    armazenamento_ok: persistente,
  };
}

// Lista de disciplinas para a tela inicial, com o quanto já foi visto em cada uma.
function rotaCatalogo() {
  const vistas = new Set(estado.respostas.filter((r) => !r.revisao).map((r) => r.questao_id));
  return {
    disciplinas: catalogo.disciplinas.map((d) => ({
      id: d.id, nome: d.nome, icone: d.icone, cor: d.cor, assunto: d.assunto, tema: d.tema,
      total: d.questoes.length,
      vistas: d.questoes.filter((q) => vistas.has(q.id)).length,
      trilhas: d.trilhas.length,
      rodadas: estado.rodadas.filter((r) => r.concluida_em && r.disciplina === d.id).length,
    })),
  };
}

function rotaDisciplina(id) {
  const d = disciplinaPorId(id);
  const vistas = new Set(estado.respostas.filter((r) => !r.revisao).map((r) => r.questao_id));
  const concluidas = estado.rodadas.filter((r) => r.concluida_em && r.disciplina === d.id);
  const notas = concluidas.map((r) => r.nota);
  return {
    id: d.id, nome: d.nome, icone: d.icone, cor: d.cor, assunto: d.assunto, tema: d.tema, fonte: d.fonte,
    total: d.questoes.length, vistas: d.questoes.filter((q) => vistas.has(q.id)).length,
    rodadas: concluidas.length, melhor_nota: notas.length ? Math.max(...notas) : null,
    tamanho_rodada: M.TAMANHO_RODADA, nota_trofeu: M.NOTA_TROFEU,
    rodada_aberta: resumoRodadaAberta(estado.rodadas.filter((r) => !r.concluida_em && r.disciplina === d.id).pop()),
    trilhas: d.trilhas.map((t) => {
      const qs = questoesDaTrilha(d, t);
      const feitas = estado.rodadas.filter((r) => r.concluida_em && r.disciplina === d.id && r.trilha === t.id);
      return {
        id: t.id, nome: t.nome, icone: t.icone, descricao: t.descricao, destaque: !!t.destaque,
        total: qs.length, vistas: qs.filter((q) => vistas.has(q.id)).length,
        rodadas: feitas.length, melhor_nota: feitas.length ? Math.max(...feitas.map((r) => r.nota)) : null,
      };
    }),
  };
}

function rotaNovaRodada(corpo) {
  const d = disciplinaPorId((corpo && corpo.disciplina) || "");
  const t = trilhaPorId(d, (corpo && corpo.trilha) || "");
  const aberta = rodadaAberta();
  if (aberta && !(corpo && corpo.descartar)) {
    if (aberta.disciplina === d.id && aberta.trilha === t.id) return { id: aberta.id, continuada: true };
    throw new ErroApi(409, "Você tem uma rodada começada. Termine-a ou escolha continuar antes de iniciar outra.");
  }
  const abertas = new Set(estado.rodadas.filter((r) => !r.concluida_em).map((r) => r.id));
  estado.rodadas = estado.rodadas.filter((r) => r.concluida_em);
  estado.respostas = estado.respostas.filter((r) => !abertas.has(r.rodada_id));
  const disponiveis = questoesDaTrilha(d, t);
  if (!disponiveis.length) throw new ErroApi(409, "Esta trilha ainda não tem questões.");
  const rnd = M.criarRng();
  const ids = M.sortearRodada(disponiveis, historicoDasQuestoes(), rnd);
  const ordem = M.sortearOrdem(ids.map((i) => porId[i]), rnd);
  const id = estado.proximo_id++;
  estado.rodadas.push({
    id, disciplina: d.id, trilha: t.id, iniciada_em: M.agora(), concluida_em: null, questoes: ids, ordem,
    duracao_s: 0, pontos: null, total: ids.length, nota: null, xp: null,
  });
  salvar();
  return { id, continuada: false };
}

function rotaVerRodada(id) {
  const r = rodadaPorId(id);
  const questoes = questoesDaRodada(r);
  const d = catalogo.disciplinas.find((x) => x.id === r.disciplina);
  const t = d && d.trilhas.find((x) => x.id === r.trilha);
  const respondidas = { normal: {}, revisao: {} };
  for (const resp of estado.respostas.filter((x) => x.rodada_id === id)) {
    const q = porId[resp.questao_id];
    if (q) respondidas[resp.revisao ? "revisao" : "normal"][q.id] = feedback(q, resp);
  }
  return {
    id: r.id, questoes: questoes.map((q) => M.questaoParaAluna(q, r.ordem)), respondidas,
    disciplina: r.disciplina, disciplina_nome: d ? d.nome : "", trilha: r.trilha, trilha_nome: t ? t.nome : "",
    materia: d ? d.materia : null,
    concluida: !!r.concluida_em, duracao_s: r.duracao_s, nota: r.nota, pontos: r.pontos, total: r.total, xp: r.xp,
    trofeu: estado.trofeus.some((x) => x.rodada_id === id),
  };
}

function rotaResponder(id, corpo) {
  const r = rodadaPorId(id);
  const q = questoesDaRodada(r).find((x) => x.id === corpo.questao_id);
  if (!q) throw new ErroApi(404, "Esta questão não faz parte da rodada.");
  const revisao = !!corpo.revisao;
  if (revisao && !r.concluida_em) throw new ErroApi(409, "O treino das erradas só existe depois de terminar a rodada.");
  if (!revisao && r.concluida_em) throw new ErroApi(409, "Esta rodada já foi concluída.");
  const existente = estado.respostas.find((x) => x.rodada_id === id && x.questao_id === q.id && x.revisao === revisao);
  if (existente) return feedback(q, existente);   // toque duplo: devolve a mesma correção
  const res = M.corrigir(q, corpo.resposta);
  const resp = {
    rodada_id: id, questao_id: q.id, revisao, resposta: String(corpo.resposta), correta: res.correta,
    respondida_em: M.agora(),
  };
  estado.respostas.push(resp);
  if (corpo.duracao_s != null && !revisao) {
    r.duracao_s = Math.max(r.duracao_s, Math.min(Math.max(corpo.duracao_s, 0), LIMITE_DURACAO_S));
  }
  salvar();
  return feedback(q, resp, res.aviso);
}

function rotaConcluir(id, corpo) {
  const r = rodadaPorId(id);
  let novas = [];
  if (!r.concluida_em) {
    const respondidas = estado.respostas.filter((x) => x.rodada_id === id && !x.revisao);
    const total = r.questoes.length;
    if (respondidas.length < total) throw new ErroApi(409, `Ainda faltam ${total - respondidas.length} questões.`);
    const acertos = respondidas.filter((x) => x.correta).length;
    const nota = Math.round((acertos / total) * 100) / 10;
    if (corpo && corpo.duracao_s != null) {
      r.duracao_s = Math.max(r.duracao_s, Math.min(Math.max(corpo.duracao_s, 0), LIMITE_DURACAO_S));
    }
    Object.assign(r, { concluida_em: M.agora(), pontos: acertos, total, nota, xp: M.xpDaRodada(acertos, nota) });
    if (nota >= M.NOTA_TROFEU) {
      estado.trofeus.push({
        id: estado.trofeus.length + 1, rodada_id: id, nota, obtido_em: M.agora(),
        disciplina: r.disciplina, trilha: r.trilha,
      });
    }
    novas = conquistasNovas();
    salvar();
  }
  return { ...rotaVerRodada(id), conquistas_novas: novas.map((k) => conquistaPublica(k)) };
}

function rotaTrofeus() {
  return [...estado.trofeus].reverse().map((t) => {
    const d = catalogo.disciplinas.find((x) => x.id === t.disciplina);
    return {
      id: t.id, nota: t.nota, obtido_em: t.obtido_em, disciplina_nome: d ? d.nome : "",
      icone: d ? d.icone : "🏆",
      duracao_s: estado.rodadas.find((r) => r.id === t.rodada_id)?.duracao_s ?? null,
    };
  });
}

// Mini-aula do botão "não sei": um arquivo por disciplina, um tópico por assunto.
async function materia(arquivo) {
  if (!materias.has(arquivo)) {
    if (!/^[\w-]+$/.test(arquivo)) throw new ErroApi(404, "Conteúdo não encontrado.");
    materias.set(arquivo, await buscarJson(`conteudo/materia/${arquivo}.json`));
  }
  return materias.get(arquivo);
}

async function rotaMateria(arquivo, topico) {
  const dados = await materia(arquivo);
  const t = dados.topicos && dados.topicos[topico];
  if (!t) throw new ErroApi(404, "Conteúdo não encontrado.");
  return { ...t, materia: dados.titulo, fonte: dados.fonte || null };
}

// ---------------------------------------------------------------- entrada: mesma assinatura do fetch antigo

export async function api(caminho, opcoes = {}) {
  await iniciar();
  const metodo = opcoes.method || (opcoes.json !== undefined ? "POST" : "GET");
  const corpo = opcoes.json;
  let m;
  if (metodo === "GET" && caminho === "/api/estado") return rotaEstado();
  if (metodo === "GET" && caminho === "/api/catalogo") return rotaCatalogo();
  if (metodo === "GET" && caminho === "/api/trofeus") return rotaTrofeus();
  if (metodo === "GET" && (m = /^\/api\/disciplinas\/([\w-]+)$/.exec(caminho))) return rotaDisciplina(m[1]);
  if (metodo === "GET" && (m = /^\/api\/materia\/([\w-]+)\/([\w-]+)$/.exec(caminho))) return rotaMateria(m[1], m[2]);
  if (metodo === "POST" && caminho === "/api/rodadas") return rotaNovaRodada(corpo);
  if (metodo === "GET" && (m = caminho.match(/^\/api\/rodadas\/(\d+)$/))) return rotaVerRodada(Number(m[1]));
  if (metodo === "POST" && (m = caminho.match(/^\/api\/rodadas\/(\d+)\/respostas$/))) return rotaResponder(Number(m[1]), corpo);
  if (metodo === "POST" && (m = caminho.match(/^\/api\/rodadas\/(\d+)\/concluir$/))) return rotaConcluir(Number(m[1]), corpo);
  throw new ErroApi(404, "Rota não encontrada: " + caminho);
}

// ---------------------------------------------------------------- aceite dos termos de uso
// Guardado à parte do progresso: restaurar um backup não aceita por você e apagar o progresso não desfaz o aceite.

const CHAVE_TERMOS = "s7a3t_termos_v1";
let termosMemoria = null;

export function termosAceitos() {
  try { const bruto = localStorage.getItem(CHAVE_TERMOS); if (bruto) return JSON.parse(bruto); } catch { /* sem storage */ }
  return termosMemoria;
}

export function aceitarTermos(versao) {
  termosMemoria = { versao, aceito_em: new Date().toISOString() };
  try { localStorage.setItem(CHAVE_TERMOS, JSON.stringify(termosMemoria)); } catch { /* vale só nesta visita */ }
}

// ---------------------------------------------------------------- ajustes (nome, backup, recomeçar)

const APP = "simulados-7o-ano-3tri";

export async function nomeSalvo() { await iniciar(); return estado.nome; }
export async function salvarNome(nome) { await iniciar(); estado.nome = String(nome || "").trim().slice(0, 30); salvar(); }

export async function exportarProgresso() {
  await iniciar();
  return JSON.stringify({ app: APP, exportado_em: M.agora(), estado }, null, 1);
}

export async function importarProgresso(texto) {
  await iniciar();
  let dados;
  try { dados = JSON.parse(texto); } catch { throw new ErroApi(400, "Esse arquivo não é um backup válido."); }
  const e = dados && dados.estado;
  if (!dados || dados.app !== APP || !e || !Array.isArray(e.rodadas) || !Array.isArray(e.respostas)) {
    throw new ErroApi(400, "Esse arquivo não é um backup deste app.");
  }
  estado = { ...estadoVazio(), ...e };
  salvar();
}

export async function recomecar() {
  await iniciar();
  const nome = estado.nome;
  estado = { ...estadoVazio(), nome };
  salvar();
}
