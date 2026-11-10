// Estrutura do frontend: arquivos referenciados existem, ordem de scripts,
// sintaxe válida e ausência de arquivos órfãos.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const h = require('./helpers');

const PAGINAS = h.paginasHtml();
const PUBLICAS = ['login.html'];
const SESSAO = ['js/config.js', 'js/auth-api.js', 'js/auth-guard.js', 'js/role-guard.js'];

test('o conjunto de páginas esperado existe', () => {
    for (const p of ['login', 'index', 'relatorios', 'supervisor', 'indicadores', 'coordenacao', 'cadastros', 'usuarios']) {
        assert.ok(PAGINAS.includes(`${p}.html`), `falta ${p}.html`);
    }
});

for (const pagina of PAGINAS) {
    const html = h.read(pagina);
    const { locais, todos } = h.scriptsDaPagina(html);

    test(`${pagina}: todo <script src> local existe`, () => {
        assert.deepEqual(locais.filter((s) => !h.exists(s)), []);
    });

    test(`${pagina}: todo <link rel=stylesheet> local existe`, () => {
        const hrefs = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)]
            .map((m) => m[1]).filter((s) => !/^https?:/.test(s));
        assert.deepEqual(hrefs.filter((s) => !h.exists(s)), []);
    });

    test(`${pagina}: sem script local duplicado`, () => {
        assert.deepEqual(locais.filter((s, i) => locais.indexOf(s) !== i), []);
    });

    test(`${pagina}: tem lang pt-BR, charset e viewport`, () => {
        assert.match(html, /<html[^>]*lang="pt-BR"/);
        assert.match(html, /<meta\s+charset="UTF-8"/i);
        assert.match(html, /name="viewport"/);
    });

    test(`${pagina}: título no padrão "... · Prontu"`, () => {
        assert.match(html, /<title>[^<]+ · Prontu<\/title>/);
    });

    test(`${pagina}: theme.js vem depois do Tailwind CDN`, () => {
        const iTw = todos.findIndex((s) => s.includes('cdn.tailwindcss.com'));
        const iTheme = todos.indexOf('js/components/theme.js');
        assert.ok(iTw >= 0, 'sem Tailwind CDN');
        assert.ok(iTheme > iTw, 'theme.js precisa vir depois do Tailwind CDN');
    });

    if (!PUBLICAS.includes(pagina)) {
        test(`${pagina}: carrega config → auth-api → auth-guard → role-guard nessa ordem`, () => {
            const idx = SESSAO.map((s) => locais.indexOf(s));
            assert.ok(idx.every((i) => i >= 0), `faltam: ${SESSAO.filter((s, i) => idx[i] < 0)}`);
            assert.deepEqual([...idx].sort((a, b) => a - b), idx, 'ordem incorreta');
        });

        test(`${pagina}: usa sidebar e topbar compartilhadas`, () => {
            assert.ok(locais.includes('js/components/sidebar.js'));
            assert.ok(locais.includes('js/components/topbar.js'));
            assert.match(html, /id="sidebar-root"/);
            assert.match(html, /id="topbar-root"/);
            assert.match(html, /Sidebar\.mount\(/);
            assert.match(html, /Topbar\.mount\(/);
        });

        test(`${pagina}: scripts de API vêm antes do script da tela`, () => {
            const apis = locais.filter((s) => /-api\.js$|\/api\.js$/.test(s) && !SESSAO.includes(s));
            const tela = locais[locais.length - 1];
            for (const a of apis) {
                assert.ok(locais.indexOf(a) < locais.indexOf(tela), `${a} deveria vir antes de ${tela}`);
            }
        });
    } else {
        test(`${pagina}: NÃO carrega auth-guard/role-guard (evita loop de redirect)`, () => {
            assert.ok(!locais.includes('js/auth-guard.js'));
            assert.ok(!locais.includes('js/role-guard.js'));
        });
    }
}

test('todo arquivo JS tem sintaxe válida', () => {
    const erros = [];
    for (const arq of h.arquivosJs()) {
        try {
            new vm.Script(h.read(arq), { filename: arq });
        } catch (e) {
            erros.push(`${arq}: ${e.message}`);
        }
    }
    assert.deepEqual(erros, []);
});

test('nenhum arquivo JS fica órfão (não usado por nenhuma página)', () => {
    const usados = new Set(PAGINAS.flatMap((p) => h.scriptsDaPagina(h.read(p)).locais));
    assert.deepEqual(h.arquivosJs().filter((a) => !usados.has(a)), []);
});

test('nenhum JS usa módulos ES nem require (roda via <script> puro)', () => {
    const ruins = h.arquivosJs().filter((a) =>
        /^\s*(import\s.+from|export\s|module\.exports|require\()/m.test(h.read(a)));
    assert.deepEqual(ruins, []);
});

// Dívida técnica conhecida: novos desvios falham, estes ficam documentados.
const DIVIDA_VAR = ['js/autocomplete.js'];
test('nenhum JS novo usa "var" (convenção: const/let)', () => {
    const ruins = h.arquivosJs().filter((a) => !DIVIDA_VAR.includes(a) && /^\s*var\s/m.test(h.read(a)));
    assert.deepEqual(ruins, []);
});

test('JS não tem URL do backend hardcoded fora do config.js', () => {
    const ruins = h.arquivosJs()
        .filter((a) => a !== 'js/config.js')
        .filter((a) => /sslip\.io|localhost:5678|phbsantos|\/webhook\//.test(h.read(a)));
    assert.deepEqual(ruins, []);
});

// Dívida técnica conhecida: telas que ainda chamam fetch direto (migrar para a camada de API).
const DIVIDA_FETCH = ['js/cadastros.js', 'js/usuarios.js'];
test('fetch só é chamado na camada de API (*-api.js / api.js)', () => {
    const camadas = /(-api|^js\/api)\.js$/;
    const ruins = h.arquivosJs().filter((a) => !camadas.test(a) && !DIVIDA_FETCH.includes(a) && /\bfetch\(/.test(h.read(a)));
    assert.deepEqual(ruins, [], 'telas devem usar a camada de API (.claude/rules/02)');
});

test('arquivos de texto estão em UTF-8 sem caractere de substituição', () => {
    const ruins = [...PAGINAS, ...h.arquivosJs(), 'css/theme.css'].filter((a) => h.read(a).includes('�'));
    assert.deepEqual(ruins, []);
});
