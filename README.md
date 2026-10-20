# Simulados 7º ano — 3º trimestre

App de treino para as provas do 3º trimestre do 7º ano: **todas as matérias num lugar só**, sem servidor, sem conta e sem anúncios. Funciona no celular, no tablet e no computador, e continua funcionando sem internet depois da primeira abertura.

## Como funciona

1. Na primeira visita o app pergunta o nome e pede o aceite dos termos de uso.
2. A tela inicial mostra os **quadrados das matérias**. Dentro de cada matéria há **trilhas** — recortes do conteúdo (por exemplo "Foco da prova" e "Cap. 6").
3. Cada rodada sorteia **20 questões** da trilha escolhida, com as alternativas embaralhadas. O sorteio dá preferência ao que você nunca viu e ao que errou da última vez.
4. Respondeu? A correção aparece na hora, com a explicação e a página do livro.
5. Travou numa questão? O botão **📖 Não sei — ler o conteúdo** abre a mini-aula do assunto, antes de responder. Ler não tira ponto nenhum.
6. Nota **9,0 ou mais** vale um troféu. Cada rodada dá XP, e o Quero (o mascote) evolui de ovo a mestre.
7. No fim, dá para **treinar só as que errou**.

Progresso, nome, XP e troféus ficam **apenas no aparelho** (armazenamento do navegador). Em **Ajustes** dá para salvar um backup em arquivo e carregá-lo em outro aparelho.

## Conteúdo de hoje

| Matéria | Trilhas | Questões |
|---|---|---|
| 🔬 Ciências — caps. 6 e 7 (págs. 94–125) | Foco da prova · Cap. 6 · Cap. 7 · Tudo misturado | 117 |

A trilha **Foco da prova** cobre o que a professora listou: funcionamento do motor a combustão externa (maria-fumaça) e interna (ciclo de Otto), chuva ácida, inversão térmica, efeito estufa, aquecimento global, mudanças climáticas e camada de ozônio.

> As questões foram escritas a partir do conteúdo estudado, com outras palavras. Os temas de poluição atmosférica (chuva ácida, inversão térmica, camada de ozônio e aquecimento global) **não aparecem como seção nos capítulos 6 e 7 do livro** — entraram pelo conteúdo padrão de 7º ano, porque estão na lista da prova.

## Rodar na sua máquina

```bash
python3 -m http.server 8000     # depois abra http://localhost:8000
```

Testes do motor: <http://localhost:8000/tests/> (o título da aba mostra "OK n/n").
Teste de interação (joga uma rodada clicando na tela): <http://localhost:8000/tests/harness.html>.

## Para adicionar uma matéria nova

1. Escreva o banco em `conteudo/<materia>.json` (mesmo formato de `ciencias-caps-6-7.json`), com ids de questão únicos.
2. Escreva as mini-aulas em `conteudo/materia/<arquivo>.json` e aponte o campo `materia` do banco para ele.
3. Acrescente a matéria e suas trilhas em `conteudo/catalogo.json`.
4. Some os arquivos novos à lista `ARQUIVOS` do `sw.js` e aumente a `VERSAO`.
5. Rode os testes.

## Avisos

Projeto familiar, gratuito e informal. Pode ter erros; vale sempre o material da escola. Veja os **Termos de uso** dentro do app (Ajustes → Ler os termos de uso).
