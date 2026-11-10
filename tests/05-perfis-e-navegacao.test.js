// Perfis, navegação e guardas de acesso: role-guard ↔ sidebar ↔ login ↔ páginas.
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

// Extrai ROLE_PAGES do role-guard.js (está dentro de um IIFE, então avalia só o literal).
function roleGuardPages() {
    const fonte = h.read('js/role-guard.js');
    const m = fonte.match(/const ROLE_PAGES = (\{[\s\S]*?\n    \});/);
    assert.ok(m, 'ROLE_PAGES não encontrado');
    return new Function(`return (${m[1]});`)();
}

const ROLE_PAGES = roleGuardPages();
const { Sidebar } = h.carregarGlobais(['js/components/sidebar.js'], ['Sidebar'], { window: {}, document: {}, localStorage: {} });
const PAGINAS = h.paginasHtml().filter((p) => p !== 'login.html');

test('os 4 perfis do banco têm regra no role-guard', () => {
    assert.deepEqual(Array.from(Object.keys(ROLE_PAGES)).sort(), ['Admin', 'Coordenador', 'Supervisor', 'Terapeuta']);
});

test('toda página citada no role-guard existe', () => {
    for (const [perfil, pags] of Object.entries(ROLE_PAGES)) {
        for (const p of pags) assert.ok(h.exists(p), `${perfil}: ${p} não existe`);
    }
});

test('sem páginas duplicadas na lista de um perfil', () => {
    for (const [perfil, pags] of Object.entries(ROLE_PAGES)) {
        assert.deepEqual(pags.filter((p, i) => pags.indexOf(p) !== i), [], perfil);
    }
});

test('toda página autenticada é acessível por pelo menos um perfil', () => {
    const acessiveis = new Set(Object.values(ROLE_PAGES).flat());
    assert.deepEqual(PAGINAS.filter((p) => !acessiveis.has(p)), []);
});

test('NAV_ITEMS da sidebar == páginas autenticadas (nada faltando nem sobrando)', () => {
    const nav = Array.from(Sidebar.NAV_ITEMS, (i) => i.href).sort();
    assert.deepEqual(nav, [...PAGINAS].sort());
});

test('NAV_ITEMS: href único, com label e ícone', () => {
    const hrefs = Array.from(Sidebar.NAV_ITEMS, (i) => i.href);
    assert.deepEqual(hrefs.filter((x, i) => hrefs.indexOf(x) !== i), []);
    for (const i of Sidebar.NAV_ITEMS) assert.ok(i.label && i.icon, i.href);
});

test('Terapeuta só acessa a própria agenda; Coordenador não tem agenda nem Relatórios/Supervisor', () => {
    assert.deepEqual(ROLE_PAGES.Terapeuta, ['index.html']);
    for (const bloqueada of ['index.html', 'relatorios.html', 'supervisor.html']) {
        assert.ok(!ROLE_PAGES.Coordenador.includes(bloqueada), `Coordenador não deveria acessar ${bloqueada}`);
    }
    assert.ok(!ROLE_PAGES.Admin.includes('index.html'));
});

test('páginas administrativas (cadastros, usuarios) não são acessíveis a Terapeuta/Supervisor', () => {
    for (const perfil of ['Terapeuta', 'Supervisor']) {
        for (const p of ['cadastros.html', 'usuarios.html', 'coordenacao.html', 'indicadores.html']) {
            assert.ok(!ROLE_PAGES[perfil].includes(p), `${perfil} acessando ${p}`);
        }
    }
});

test('landing pós-login de cada perfil está na lista de páginas permitidas dele', () => {
    const { landingPageFor } = h.carregarGlobais(['js/login.js'], ['landingPageFor'], { window: { addEventListener() {} }, document: {} });
    for (const perfil of Object.keys(ROLE_PAGES)) {
        assert.ok(ROLE_PAGES[perfil].includes(landingPageFor(perfil)), `${perfil} cai em página sem acesso`);
    }
});

test('landing == primeira página do role-guard (evita bounce de redirecionamento)', () => {
    const { landingPageFor } = h.carregarGlobais(['js/login.js'], ['landingPageFor'], { window: { addEventListener() {} }, document: {} });
    for (const perfil of Object.keys(ROLE_PAGES)) {
        if (perfil === 'Terapeuta' || perfil === 'Supervisor') continue; // index.html é a primeira
        assert.equal(landingPageFor(perfil), ROLE_PAGES[perfil][0], perfil);
    }
});

test('documentação de perfis (.claude/rules/04) bate com o role-guard', { skip: !h.exists('.claude/rules/04-perfis-sessao.md') }, () => {
    const md = h.read('.claude/rules/04-perfis-sessao.md');
    for (const [perfil, pags] of Object.entries(ROLE_PAGES)) {
        const linha = md.split('\n').find((l) => l.startsWith(`| ${perfil} |`));
        assert.ok(linha, `${perfil} sem linha na tabela`);
        for (const p of pags) assert.ok(linha.includes(p.replace('.html', '')), `${perfil}: ${p} ausente na doc`);
    }
});

test('login: erro de credencial usa mensagem única (não enumera usuários)', () => {
    const wf = h.workflows().find((w) => w.caminho === 'usuario/login').wf;
    const resp = wf.nodes.filter((n) => n.type.endsWith('respondToWebhook'));
    const invalidas = resp.filter((n) => n.parameters.options.responseCode === 401);
    assert.equal(invalidas.length, 1, 'deve haver uma única resposta 401 para e-mail/senha inválidos');
    assert.match(invalidas[0].parameters.responseBody, /E-mail ou senha inválidos/);
});
