# CLAUDE.md

## What this is

A static, serverless practice-exam app (HTML, CSS, vanilla JS ES modules, no build) for a 7th grader, meant to hold **every subject of the term in one app**, published on GitHub Pages from `main` (root). It merges the two sibling repos: the player comes from `simulado-geografia-regiao-sul-p1` (mascot Quero, clock, XP/levels, trophies, drawn rounds of 20) and the many-subjects idea plus the "read the content" button come from `simulados-4o-ano-3tri`. `README.md` is the user-facing guide, in Portuguese. All UI text and code identifiers are Brazilian Portuguese; keep it that way.

The repository is **public**: never add the child's name, textbook photos or the platform screenshots (they show her full name and are the publisher's content). The app asks for a name on first visit and stores it only on the device.

## Commands

```bash
python3 -m http.server 8000                 # run locally
# unit tests: http://localhost:8000/tests/           (tab title "OK 18/18")
# interaction test: http://localhost:8000/tests/harness.html   (plays a round by clicking; log in the <pre>)
```

There is no `node` or `playwright` on this machine. Headless Chrome is the way to run both pages:
`google-chrome --headless=new --disable-gpu --no-sandbox --virtual-time-budget=20000 --dump-dom http://localhost:PORT/tests/`
(and `--screenshot=... --window-size=390,844` for a phone-sized picture). `tests/harness.html` has `<base href="../">` so its relative fetches hit the project root; it clears `localStorage` and turns sound off before starting (an AudioContext call hangs headless).

## Architecture

- **`conteudo/catalogo.json`**: the subjects. Each one names its bank file and its **trilhas** (tracks) — the cuts of the bank a round can be drawn from, each with a `filtro` matched field by field against the question (`{"foco": true}`, `{"capitulo": 6}`, `{}` for everything). Adding a subject is: bank file + mini-lesson file + an entry here + `sw.js`.
- **`conteudo/<materia>.json`**: one bank per subject (`ciencias-caps-6-7.json`: 117 questions, types `mc`, `vf`, `lacuna`). Question **ids are strings and unique across every bank** (`"mex-01"`), because progress is keyed by id; never reuse an id for a different question. Each question carries `capitulo`, `foco`, `topico`, `pagina`, `explicacao` and `ajuda` (the mini-lesson topic).
- **`conteudo/materia/*.json`**: the mini-lessons behind the **"📖 Não sei — ler o conteúdo"** button on the question screen (and "📖 Ler o conteúdo" in the feedback of a wrong answer). `topicos.<key>` = `{titulo, icone, pagina, blocos}`; a bloco is `texto`, `lista`, `exemplos`, `tabela` or `dica`, rendered by `blocoEl()` in `quiz.js`. The button is absent when the subject has no `materia` or the question has no `ajuda`. **Write the mini-lesson so it teaches the content without reading as the answer sheet of the question in front of the child**; reading never changes the grade. `tests/index.html` checks that every `ajuda` has a topic and every topic is used.
- **`js/motor.js`**: pure grading/draw/XP logic, a port of `motor.js` of the Geography app (which mirrors `correcao.py`/`progresso.py` of the private `simulados-ana`). Differences here: string ids and `filtrar()` for the trilhas. Changing a grading or XP rule? The Ana apps have the same rules — keep them in sync.
- **`js/api.js`**: the "server inside the browser". Loads the catalog and every bank at start, keeps progress in `localStorage` (key `s7a3t_estado_v1`) and answers `catalogo`, `estado`, `disciplinas/<id>`, `rodadas` (POST takes `{disciplina, trilha, descartar}`), `rodadas/<id>[/respostas|/concluir]`, `trofeus` and `materia/<arquivo>/<topico>`. A round records which subject and track it came from; **only one round may be open at a time** — asking for another track while one is open returns 409, and the screens offer "continuar" instead.
- **`js/app.js`** (router: `#/`, `#/d/<disciplina>`, `#/rodada/<id>`, `#/revisao/<id>`, `#/resultado/<id>`, `#/trofeus`, `#/conquistas`, `#/ajustes`, `#/termos`), **`js/quiz.js`** (question player, feedback, mini-lesson modal), **`js/mascote.js`** (Quero and the trophy in SVG), **`js/util.js`** (`el()` DOM helper, sounds, confetti, dialogs).
- **`js/termos.js`**: versioned terms-of-use text (`VERSAO_TERMOS`) and the first-visit consent block. Consent lives apart from progress (key `s7a3t_termos_v1`), so restoring a backup never accepts for the user and resetting progress never revokes it. Changed the text? Bump `VERSAO_TERMOS`, `DATA_TERMOS` and `VERSAO` in `sw.js`. No analytics or third-party requests exist, and the text says so: keep it true.
- **`sw.js`**: stale-while-revalidate over a fixed list. **Bump `VERSAO` and keep `ARQUIVOS` in sync (including every `conteudo/*.json`) whenever files change or are added**, or devices keep serving the cached version.

## Content notes

The Ciências bank covers chapters 6 and 7 (Rotas/Edebê, pp. 94–125). The teacher's topic list for the 21/10/2026 exam also names chuva ácida, inversão térmica, camada de ozônio and aquecimento global: **those are not sections of chapters 6 and 7** (p. 120 only mentions air pollution, water and soil contamination, climate change and renewables). They were written from the standard 7th-grade curriculum and are flagged as such in the README. The source material the parent provided (`../ana-julia/*.md` and the platform screenshots) stays outside this repo.

## Constraints

All paths relative (the site lives under a subpath). Targets are an iPhone (Safari) and Android (Chrome): `viewport-fit=cover` with safe-area padding, `100dvh`, inputs at 16px or more, audio unlocked on the first touch (Web Audio only), `prefers-reduced-motion` respected, and `img/apple-touch-icon.png` must stay a PNG. Errors are orange with encouraging copy, never red. Neutral wording (no gendered forms), since the app does not know who is using it.
