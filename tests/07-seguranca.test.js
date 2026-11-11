// Segurança. Dois grupos:
//  1) Controles que JÁ existem (regressão — têm que continuar passando).
//  2) Vulnerabilidades confirmadas, marcadas com { todo }: rodam e mostram a falha
//     no relatório, mas não quebram a suíte. Ao corrigir, o teste passa e o
//     `todo` deve ser removido para virar regressão.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const WFS = h.workflows();
const JS = h.arquivosJs();
const ESCRITA = WFS.filter((w) => w.metodo !== 'GET' && w.caminho !== 'usuario/login');
const sqlDe = (w) => w.wf.nodes.filter((n) => n.type.endsWith('postgres')).map((n) => n.parameters.query).join('\n');

// ---------------------------------------------------------------------------
// 1) Controles existentes
// ---------------------------------------------------------------------------

test('backend em HTTPS e sem endereços de dev no config', () => {
    assert.match(h.carregarConfig().API_BASE, /^https:\/\//);
});

test('.gitignore protege credenciais, .env e arquivos locais do Claude', () => {
    const gi = h.read('.gitignore');
    for (const padrao of ['credential_postgres.json', 'credential_*.local.json', '*.env', '.env.local', 'CLAUDE.md']) {
        assert.ok(gi.includes(padrao), `.gitignore sem ${padrao}`);
    }
});

test('nenhum arquivo versionado contém credencial real de banco/n8n', () => {
    const exemplo = JSON.parse(h.read('db/n8n-workflows/_reference/credential_postgres.example.json'));
    assert.match(exemplo[0].data.password, /REPLACE_WITH_REAL_PASSWORD/);
    assert.ok(!h.exists('db/n8n-workflows/_reference/credential_postgres.json'), 'credential real no working tree');
});

test('workflows exportados não carregam pinData, tokens nem senhas', () => {
    for (const w of WFS) {
        const bruto = JSON.stringify(w.wf);
        assert.ok(!('pinData' in w.wf), `${w.arquivo}: pinData`);
        assert.doesNotMatch(bruto, /"(password|token|apiKey|secret)"\s*:\s*"[^"]+"/i, w.arquivo);
    }
});

test('nenhuma resposta de workflow devolve senha_hash', () => {
    for (const w of WFS) {
        const corpos = w.wf.nodes.filter((n) => n.type.endsWith('respondToWebhook')).map((n) => n.parameters.responseBody).join('\n');
        assert.doesNotMatch(corpos, /senha_hash|\bsenha\s*:/i, w.arquivo);
    }
    // Listagens/edições não selecionam senha_hash; só login (comparação via crypt) e escritas (gravação).
    for (const w of WFS.filter((x) => x.metodo === 'GET')) {
        assert.doesNotMatch(sqlDe(w), /senha_hash/, `${w.arquivo} seleciona senha_hash`);
    }
});

test('senhas sempre passam por crypt()/gen_salt (bcrypt) ao gravar', () => {
    for (const num of [7, 20]) {
        const w = WFS.find((x) => x.numero === num);
        assert.match(sqlDe(w), /crypt\(\$\d, gen_salt\('bf'\)\)/, w.arquivo);
    }
    const login = sqlDe(WFS.find((x) => x.numero === 1));
    assert.match(login, /senha_hash = crypt\(\$2, u\.senha_hash\)/);
});

test('login não enumera usuário e bloqueia usuário inativo', () => {
    const respostas = WFS.find((x) => x.numero === 1).wf.nodes.filter((n) => n.type.endsWith('respondToWebhook'));
    const codigos = respostas.map((n) => n.parameters.options.responseCode).sort();
    assert.deepEqual(codigos, [200, 401, 403]);
});

test('JS não usa eval nem new Function', () => {
    for (const a of JS) {
        const src = h.read(a);
        assert.doesNotMatch(src, /\beval\(|new Function\(/, a);
    }
});

test('JS não guarda senha em storage nem a registra no console', () => {
    for (const a of JS) {
        const src = h.read(a);
        assert.doesNotMatch(src, /(localStorage|sessionStorage)\.setItem\([^)]*senha/i, a);
        assert.doesNotMatch(src, /console\.(log|error|warn)\([^)]*senha/i, a);
    }
});

test('a sessão salva em localStorage não inclui a senha', () => {
    const { AuthApi } = h.carregarGlobais(['js/config.js', 'js/auth-api.js'], ['AuthApi']);
    assert.ok(AuthApi.SESSION_KEY);
    assert.doesNotMatch(h.read('js/auth-api.js'), /senha:\s*usuario\.senha|senha_hash/);
});

test('export XML escapa o conteúdo (escapeXmlText) e nome de arquivo é saneado', () => {
    const src = h.read('js/coordenacao.js');
    assert.match(src, /function escapeXmlText/);
    assert.match(src, /replace\(\/\[\^a-zA-Z0-9\]\+\/g, '_'\)/);
});

// ---------------------------------------------------------------------------
// 2) Vulnerabilidades confirmadas (todo = falha conhecida, ainda não corrigida)
// ---------------------------------------------------------------------------

test('[CRÍTICO] endpoints de escrita validam quem chama (perfil/identidade) no backend',
    { todo: 'Webhooks sem autenticação: qualquer um com a URL pública chama /resetar/senha-usuario, /editar/usuario (ex.: virar Admin), /registrar/usuario etc.' },
    () => {
        const semAuth = ESCRITA.filter((w) => {
            const dados = JSON.stringify(w.wf.nodes.map((n) => n.parameters));
            // Critério mínimo: algum node valida token/header ou o SQL confere o perfil do solicitante.
            return !/headerAuth|authentication|Authorization|solicitante|perfil_role\s*IN/i.test(dados) &&
                !w.webhook.parameters.authentication;
        }).map((w) => w.arquivo);
        assert.deepEqual(semAuth, []);
    });

test('[CRÍTICO] webhooks exigem autenticação do n8n (header/token)',
    { todo: 'Nenhum webhook usa parameters.authentication; o role-guard roda só no navegador e é contornável.' },
    () => {
        const abertos = WFS.filter((w) => !w.webhook.parameters.authentication).map((w) => w.arquivo);
        assert.deepEqual(abertos, []);
    });

test('[CRÍTICO] listagens com dados pessoais (pacientes, relatórios) não são públicas',
    { todo: 'GET /listar/pacientes devolve nome, nascimento, telefone e responsável sem exigir login (LGPD: dado de saúde).' },
    () => {
        const wf = WFS.find((w) => w.caminho === 'listar/pacientes');
        assert.ok(wf.webhook.parameters.authentication, 'sem autenticação no webhook');
    });

// Campos que carregam texto livre vindo da API/usuário. Dentro de um template
// que vira HTML, precisam estar envoltos em escapeHtml(...).
const CAMPOS_LIVRES = /\b(name|nome\w*|notes|justification|conteudo|nextSteps|therapistName|tipoAtendimento|message|email|observacoes|label|sublabel|responsavelNome|planoSaude|especialidade\w*|autorNome|pacienteNome|terapeutaNome|editadoPor\w*|engagement)\b/;
// Linhas em que a interpolação NÃO vira HTML (texto puro, toast já escapado, URL, XML escapado...).
const SINK_SEGURO = /showToast\(|innerText|textContent|\.value\b|escapeXmlText|escapeHtml\(|escapeJsAttr\(|encodeURIComponent|console\.|\.includes\(|\.replace\(|new Error\(|throw /;

// Revisadas à mão: o heurístico não vê que NÃO são sinks de HTML.
const REVISADOS_SEGUROS = {
    'js/api.js': ["formData.justification || ''"], // monta texto puro do payload JSON, não HTML
    'js/app.js': ['meta.label', 'item.editadoPorEmail', 'item.editadoPorNome'], // constante; innerText; showToast multilinha
    'js/coordenacao.js': ['jaSelecionado.pacienteNome', 'nomeArquivo'], // showToast multilinha; nome de arquivo já saneado
    'js/recorrencia.js': ['corParaTerapeuta(nome)'], // devolve cor hex de uma paleta fixa
    'js/supervisor.js': ['p.responsavelNome'], // vira sublabel do autocomplete, que aplica escapeHtml
};

function interpolacoesSemEscape(arquivo) {
    const achados = [];
    const liberados = REVISADOS_SEGUROS[arquivo] || [];
    h.read(arquivo).split('\n').forEach((linha, i) => {
        if (/^\s*(\/\/|\*)/.test(linha) || SINK_SEGURO.test(linha)) return;
        for (const m of linha.matchAll(/\$\{([^}]+)\}/g)) {
            if (liberados.includes(m[1].trim())) continue;
            if (CAMPOS_LIVRES.test(m[1]) && !/^\s*(escapeHtml|Number)\(/.test(m[1])) {
                achados.push(`${arquivo}:${i + 1}  \${${m[1].trim()}}`);
            }
        }
    });
    return achados;
}

test('[ALTO] XSS: nenhum dado livre da API entra em template HTML sem escapeHtml (todas as telas)', () => {
    const ruins = h.arquivosJs()
        .filter((a) => !a.startsWith('js/components/')) // topbar/sidebar recebem HTML estático dos chamadores
        .flatMap(interpolacoesSemEscape);
    assert.deepEqual(ruins, [], 'envolver em escapeHtml(...) — ver js/components/ui.js');
});

test('[ALTO] showToast escapa a mensagem em todas as telas que a injetam via innerHTML', () => {
    for (const a of h.arquivosJs()) {
        const src = h.read(a);
        if (!/function showToast/.test(src)) continue;
        const bloco = src.slice(src.indexOf('function showToast'), src.indexOf('function showToast') + 1400);
        if (/innerHTML/.test(bloco) && /\$\{message\}|\$\{msg\}/.test(bloco)) {
            assert.match(bloco, /escapeHtml\(message\)/, `${a}: toast injeta mensagem sem escape`);
        }
    }
});

test('[ALTO] mensagem de erro em relatorios.js é escapada antes do innerHTML', () => {
    assert.match(h.read('js/relatorios.js'), /escapeHtml\(error\.message/);
});

test('[ALTO] handlers inline com texto livre usam escapeJsAttr (JS + HTML escape)', () => {
    for (const a of h.arquivosJs()) {
        const src = h.read(a);
        // onclick="fn('${algo}')" só é aceitável com escapeJsAttr ou com ids/constantes.
        for (const m of src.matchAll(/onclick="[^"]*'\$\{([^}]+)\}'/g)) {
            assert.match(m[1], /escapeJsAttr\(|^[a-zA-Z.]*\b(id|Id|dia|horaLabel|detailId)\b$/, `${a}: ${m[0].slice(0, 80)}`);
        }
        assert.doesNotMatch(src, /escapeJsString\(/, `${a}: usar escapeJsAttr`);
    }
});

test('[MÉDIO] escapeHtml é único e compartilhado (components/ui.js); sem cópias locais', () => {
    assert.match(h.read('js/components/ui.js'), /function escapeHtml\(/);
    const copias = h.arquivosJs().filter((a) => a !== 'js/components/ui.js' && /function escapeHtml\(/.test(h.read(a)));
    assert.deepEqual(copias, []);
});

test('[MÉDIO] toda página cujo JS usa escapeHtml carrega ui.js antes do script da tela', () => {
    for (const p of h.paginasHtml()) {
        const { locais } = h.scriptsDaPagina(h.read(p));
        const usa = locais.filter((s) => s !== 'js/components/ui.js' && /escapeHtml\(|escapeJsAttr\(/.test(h.read(s)));
        if (!usa.length) continue;
        const iUi = locais.indexOf('js/components/ui.js');
        assert.ok(iUi >= 0, `${p}: usa escapeHtml (${usa}) mas não carrega ui.js`);
        for (const s of usa) assert.ok(iUi < locais.indexOf(s), `${p}: ui.js deve vir antes de ${s}`);
    }
});

test('[MÉDIO] escapeHtml escapa & < > " \' e neutraliza payloads de XSS', () => {
    const { escapeHtml, escapeJsAttr } = h.carregarGlobais(['js/components/ui.js'], ['escapeHtml', 'escapeJsAttr']);
    assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    assert.equal(escapeHtml("O'Brien & Cia"), 'O&#39;Brien &amp; Cia');
    assert.equal(escapeHtml(null), '');
    assert.equal(escapeHtml(undefined), '');
    assert.equal(escapeHtml(0), '0');
    // Valor que quebraria um atributo value="..." sem escape de aspas:
    assert.doesNotMatch(escapeHtml('" autofocus onfocus="alert(1)'), /"/);
    // Dentro de onclick="fn('...')": aspa simples e barra não podem fechar a string JS; aspa dupla não pode fechar o atributo.
    const attr = escapeJsAttr("x'); alert(1); //\"\nfim\\");
    assert.doesNotMatch(attr, /["<>]|\n/);
    assert.match(attr, /\\\\&#39;|&#39;/);
});

test('[MÉDIO] CDNs com versão fixa e SRI (integrity + crossorigin)', () => {
    for (const p of h.paginasHtml()) {
        const html = h.read(p);
        assert.doesNotMatch(html, /@latest/, `${p}: @latest`);
        // O cdn.tailwindcss.com não envia Access-Control-Allow-Origin: com integrity+crossorigin
        // o navegador bloqueia o script e a página fica sem estilo. Tailwind só tem versão fixa, sem SRI.
        for (const [, tag] of html.matchAll(/(<script[^>]*src="https:\/\/cdn\.tailwindcss\.com[^"]*"[^>]*>)/g)) {
            assert.doesNotMatch(tag, /integrity=|crossorigin/, `${p}: SRI/crossorigin no Tailwind quebra o carregamento`);
            assert.match(tag, /tailwindcss\.com\/\d+\.\d+\.\d+"/, `${p}: sem versão exata → ${tag.slice(0, 90)}`);
        }
        for (const [, tag] of html.matchAll(/(<script[^>]*src="https:\/\/unpkg\.com[^"]*"[^>]*>)/g)) {
            assert.match(tag, /integrity="sha384-[A-Za-z0-9+/=]+"/, `${p}: sem SRI → ${tag.slice(0, 90)}`);
            assert.match(tag, /crossorigin="anonymous"/, `${p}: sem crossorigin`);
            assert.match(tag, /@\d+\.\d+\.\d+/, `${p}: sem versão exata → ${tag.slice(0, 90)}`);
        }
    }
});

// 2026-11-11: CSP por meta tag (o Vercel não tem vercel.json; quando tiver, mover para header e acrescentar frame-ancestors).
function cspDaPagina(html) {
    const m = html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/);
    if (!m) return null;
    const dir = {};
    for (const parte of m[1].split(';').map((x) => x.trim()).filter(Boolean)) {
        const [nome, ...fontes] = parte.split(/\s+/);
        dir[nome] = fontes;
    }
    return { bruto: m[1], dir };
}

test('[MÉDIO] toda página define a mesma Content-Security-Policy, antes de qualquer script', () => {
    const brutos = new Set();
    for (const p of h.paginasHtml()) {
        const html = h.read(p);
        const csp = cspDaPagina(html);
        assert.ok(csp, `${p}: sem meta Content-Security-Policy`);
        brutos.add(csp.bruto);
        assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<script'), `${p}: CSP precisa vir antes do primeiro <script>`);
    }
    assert.equal(brutos.size, 1, 'as páginas devem ter exatamente a mesma política');
});

test('[MÉDIO] CSP é restritiva: default-src self, sem curinga, object-src none, base-uri/form-action self', () => {
    const { dir } = cspDaPagina(h.read('login.html'));
    assert.deepEqual(Array.from(dir['default-src']), ["'self'"]);
    assert.deepEqual(Array.from(dir['object-src']), ["'none'"]);
    assert.deepEqual(Array.from(dir['base-uri']), ["'self'"]);
    assert.deepEqual(Array.from(dir['form-action']), ["'self'"]);
    for (const [nome, fontes] of Object.entries(dir)) {
        assert.ok(!fontes.includes('*') && !fontes.includes('http:') && !fontes.includes('https:'), `${nome}: curinga/esquema aberto`);
        assert.ok(!fontes.includes("'unsafe-eval'"), `${nome}: unsafe-eval`);
    }
    // Dívida conhecida: onclick inline e <script> inline exigem 'unsafe-inline' no script-src.
    assert.ok(dir['script-src'].includes("'unsafe-inline'"));
});

test('[MÉDIO] connect-src libera só a API do config.js (CSP e API_BASE andam juntos)', () => {
    const { dir } = cspDaPagina(h.read('login.html'));
    const origemApi = new URL(h.carregarConfig().API_BASE).origin;
    assert.deepEqual(Array.from(dir['connect-src']), ["'self'", origemApi]);
});

test('[MÉDIO] todo host externo carregado por página está liberado na CSP e nada sobra', () => {
    const { dir } = cspDaPagina(h.read('login.html'));
    const liberados = new Set(Object.values(dir).flat().filter((f) => /^https:\/\//.test(f)));
    const usados = new Set();
    for (const p of h.paginasHtml()) {
        for (const m of h.read(p).matchAll(/(?:src|href)="(https:\/\/[^"/]+)/g)) usados.add(m[1]);
    }
    // O Phosphor (relatorios.html) injeta CSS e fontes do próprio unpkg.com, que já é usado como script.
    const origemApi = new URL(h.carregarConfig().API_BASE).origin;
    for (const u of usados) assert.ok(liberados.has(u), `${u} é carregado mas não está na CSP`);
    for (const l of liberados) assert.ok(usados.has(l) || l === origemApi, `${l} está na CSP mas nenhuma página usa`);
});

test('[MÉDIO] documentação não expõe senha de usuário (inclusive Admin) do backend da VPS',
    { todo: 'docs/CHECKLIST_TESTES.md lista e-mails + senha "trocar123" (inclui Admin) contra a VPS; se o seed 001 rodou em produção, são credenciais conhecidas.' },
    () => {
        assert.doesNotMatch(h.read('docs/CHECKLIST_TESTES.md'), /trocar123/);
    });

test('[MÉDIO] seeds não criam usuários privilegiados com senha previsível',
    { todo: 'db/seed/001 grava crypt(\'trocar123\') para Admin/Coordenador. Trocar por senha gerada/variável de ambiente.' },
    () => {
        assert.doesNotMatch(h.read('db/seed/001_seed_dados_exemplo.sql'), /crypt\('trocar123'/);
    });

test('[MÉDIO] reset/cadastro de senha impõe política mínima (tamanho) no backend',
    { todo: 'Workflows 07 e 20 aceitam qualquer senha (inclusive vazia/1 caractere).' },
    () => {
        for (const num of [7, 20]) {
            const dados = JSON.stringify(WFS.find((x) => x.numero === num).wf.nodes);
            assert.match(dados, /length\s*>=?\s*\d|char_length\(|CHECK/i, `workflow ${num} sem validação de senha`);
        }
    });

test('[MÉDIO] login tem proteção contra força bruta (rate limit/bloqueio)',
    { todo: '/usuario/login não limita tentativas; o Caddy/n8n também não (verificar na VPS).' },
    () => {
        const dados = JSON.stringify(WFS.find((x) => x.numero === 1).wf);
        assert.match(dados, /tentativas|rate|bloque/i);
    });

test('[BAIXO] fetch de leitura/escrita checa response.ok em cadastros.js e usuarios.js (telas fora da camada de API)',
    { todo: 'Dívida: duas telas chamam fetch direto (ver tests/01).' },
    () => {
        for (const a of ['js/cadastros.js', 'js/usuarios.js']) assert.doesNotMatch(h.read(a), /\bfetch\(/, a);
    });
