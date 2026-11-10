// Qualidade estrutural dos workflows n8n (db/n8n-workflows).
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const WFS = h.workflows();
const nodesDe = (wf, sufixo) => wf.nodes.filter((n) => n.type.endsWith(sufixo));

test('há workflows e a numeração é contínua, sem buracos nem repetição', () => {
    assert.ok(WFS.length >= 27);
    WFS.forEach((w, i) => assert.equal(w.numero, i + 1, `esperado ${i + 1} em ${w.arquivo}`));
});

test('ids de workflow são únicos', () => {
    const ids = WFS.map((w) => w.wf.id);
    assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), []);
});

test('webhookId e (método, path) são únicos entre workflows', () => {
    const whIds = WFS.map((w) => w.webhook.webhookId);
    assert.deepEqual(whIds.filter((x, i) => whIds.indexOf(x) !== i), [], 'webhookId repetido');
    const chaves = WFS.map((w) => `${w.metodo} ${w.caminho}`);
    assert.deepEqual(chaves.filter((x, i) => chaves.indexOf(x) !== i), [], 'rota repetida');
});

for (const w of WFS) {
    const { wf, arquivo, numero } = w;
    const nn = String(numero).padStart(2, '0');

    test(`${arquivo}: id segue prt${nn}… e nome segue "Prontu - MÉTODO /path"`, () => {
        assert.match(wf.id, new RegExp(`^prt${nn}[A-Z][A-Za-z]+$`));
        assert.equal(wf.name, `Prontu - ${w.metodo} /${w.caminho}`);
    });

    test(`${arquivo}: está ativo e tem exatamente 1 webhook`, () => {
        assert.equal(wf.active, true);
        assert.equal(nodesDe(wf, 'webhook').length, 1);
    });

    test(`${arquivo}: webhook responde via node (responseNode) e versão esperada`, () => {
        assert.equal(w.webhook.typeVersion, 2.1);
        assert.equal(w.webhook.parameters.responseMode, 'responseNode');
        assert.ok(['GET', 'POST', 'DELETE'].includes(w.metodo));
    });

    test(`${arquivo}: path segue convenção verbo/recurso`, () => {
        assert.match(w.caminho, /^(listar|registrar|criar|editar|remover|atualizar|resetar|relatorio|usuario)\/[a-z-]+$/);
        if (w.caminho.startsWith('listar/')) assert.equal(w.metodo, 'GET');
        if (w.caminho.startsWith('remover/')) assert.equal(w.metodo, 'DELETE');
    });

    test(`${arquivo}: toda conexão aponta para node existente`, () => {
        const nomes = new Set(wf.nodes.map((n) => n.name));
        for (const [origem, saidas] of Object.entries(wf.connections)) {
            assert.ok(nomes.has(origem), `origem inexistente: ${origem}`);
            for (const grupo of saidas.main) for (const dest of grupo || []) {
                assert.ok(nomes.has(dest.node), `destino inexistente: ${dest.node}`);
            }
        }
    });

    test(`${arquivo}: nenhum node órfão (todo node é alcançável a partir do webhook)`, () => {
        const alcancados = new Set([w.webhook.name]);
        const fila = [w.webhook.name];
        while (fila.length) {
            const atual = fila.shift();
            for (const grupo of (wf.connections[atual] || { main: [] }).main) for (const d of grupo || []) {
                if (!alcancados.has(d.node)) { alcancados.add(d.node); fila.push(d.node); }
            }
        }
        const soltos = wf.nodes.map((n) => n.name).filter((n) => !alcancados.has(n));
        assert.deepEqual(soltos, []);
    });

    test(`${arquivo}: nomes e ids de nodes são únicos`, () => {
        const nomes = wf.nodes.map((n) => n.name);
        const ids = wf.nodes.map((n) => n.id);
        assert.deepEqual(nomes.filter((x, i) => nomes.indexOf(x) !== i), []);
        assert.deepEqual(ids.filter((x, i) => ids.indexOf(x) !== i), []);
    });

    test(`${arquivo}: todo caminho termina em um Respond to Webhook (sem resposta pendurada)`, () => {
        const respostas = nodesDe(wf, 'respondToWebhook');
        assert.ok(respostas.length >= 1);
        const comSaida = wf.nodes.filter((n) => (wf.connections[n.name] || {}).main &&
            wf.connections[n.name].main.some((g) => g && g.length));
        const folhas = wf.nodes.filter((n) => !comSaida.includes(n));
        for (const f of folhas) assert.ok(f.type.endsWith('respondToWebhook'), `folha que não responde: ${f.name}`);
    });

    test(`${arquivo}: respostas são JSON com status HTTP válido e {sucesso, mensagem} nas escritas`, () => {
        const escrita = w.metodo !== 'GET';
        for (const r of nodesDe(wf, 'respondToWebhook')) {
            assert.equal(r.parameters.respondWith, 'json');
            const codigo = r.parameters.options && r.parameters.options.responseCode;
            if (codigo !== undefined) assert.ok([200, 201, 400, 401, 403, 404, 409].includes(codigo), `código ${codigo}`);
            if (escrita) {
                assert.match(r.parameters.responseBody, /sucesso/);
                assert.match(r.parameters.responseBody, /mensagem/);
            }
        }
    });

    test(`${arquivo}: nodes Postgres usam a credencial padrão e versão 2.7`, () => {
        for (const p of nodesDe(wf, 'postgres')) {
            assert.equal(p.typeVersion, 2.7);
            assert.equal(p.parameters.operation, 'executeQuery');
            assert.equal(p.credentials.postgres.id, 'prtPgCredential01');
            assert.equal(p.credentials.postgres.name, 'Prontu Postgres');
        }
    });

    test(`${arquivo}: SQL parametrizado — sem {{ }} / $json interpolado na query`, () => {
        for (const p of nodesDe(wf, 'postgres')) {
            const sql = p.parameters.query;
            assert.doesNotMatch(sql, /\{\{|\$json|\$node|\$\(/, 'interpolação direta de dado na query (injeção SQL)');
            const placeholders = [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
            const qr = p.parameters.options && p.parameters.options.queryReplacement;
            if (placeholders.length) {
                assert.ok(qr, 'query usa $N mas não declara queryReplacement');
                // Aceita array literal ou IIFE que retorna array (ex.: workflow 09).
                assert.match(qr, /^=\{\{\s*(\[|\(\(\) => \{[\s\S]*return \[)/, 'queryReplacement deve produzir um array');
            }
        }
    });

    test(`${arquivo}: exige DELETE/GET lendo de query e POST lendo de body`, () => {
        const fonte = JSON.stringify(wf.nodes.map((n) => n.parameters));
        if (w.metodo === 'POST') assert.doesNotMatch(fonte, /\$json\.query\./);
        if (w.metodo !== 'POST') assert.doesNotMatch(fonte, /\$json\.body\./);
    });
}
