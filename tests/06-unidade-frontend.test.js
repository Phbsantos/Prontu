// Testes unitários da lógica pura do frontend (sem navegador).
const test = require('node:test');
const assert = require('node:assert/strict');
const h = require('./helpers');

const { ApiService } = h.carregarGlobais(['js/api.js'], ['ApiService']);
const { CadastroApi } = h.carregarGlobais(['js/config.js', 'js/cadastro-api.js'], ['CadastroApi']);
const { UI } = h.carregarGlobais(['js/components/ui.js'], ['UI']);

test('mapApiStatusToInternal: todos os status do enum', () => {
    const esperado = {
        Agendado: 'pending',
        'Pendente de Evolução': 'pending',
        Realizado: 'realizado',
        'Falta sem Aviso': 'falta',
        'Desmarcado com Aviso': 'desmarcado',
        'Cancelado pelo Terapeuta': 'cancelado',
    };
    for (const [api, interno] of Object.entries(esperado)) {
        assert.equal(ApiService.mapApiStatusToInternal(api), interno, api);
    }
});

test('mapApiStatusToInternal: valor desconhecido/vazio cai em pending', () => {
    assert.equal(ApiService.mapApiStatusToInternal(undefined), 'pending');
    assert.equal(ApiService.mapApiStatusToInternal('Qualquer coisa'), 'pending');
});

test('mapInternalStatusToApi é o inverso para os estados finais', () => {
    for (const interno of ['realizado', 'falta', 'desmarcado', 'cancelado']) {
        const api = ApiService.mapInternalStatusToApi(interno);
        assert.equal(ApiService.mapApiStatusToInternal(api), interno);
    }
});

test('mapInternalStatusToApi: falta/desmarcado/cancelado NÃO viram "Realizado" (bug histórico)', () => {
    assert.equal(ApiService.mapInternalStatusToApi('falta'), 'Falta sem Aviso');
    assert.equal(ApiService.mapInternalStatusToApi('desmarcado'), 'Desmarcado com Aviso');
    assert.equal(ApiService.mapInternalStatusToApi('cancelado'), 'Cancelado pelo Terapeuta');
});

test('formatTime/formatDate usam UTC (evita bug do "dia anterior")', () => {
    assert.equal(ApiService.formatTime('2026-09-17T14:30:00.000Z'), '14:30');
    assert.equal(ApiService.formatDate('2026-09-17T00:00:00.000Z'), '17/09/2026');
    assert.equal(ApiService.formatDate('2026-01-01T00:00:00.000Z'), '01/01/2026');
    assert.equal(ApiService.formatTime(''), '--:--');
    assert.equal(ApiService.formatDate(null), '');
});

test('transformAtendimento: converte snake_case da API em camelCase e aplica defaults', () => {
    const t = ApiService.transformAtendimento({
        id: 7, paciente_id: 3, paciente_nome: 'Ana', terapeuta_id: 2, terapeuta_nome: 'Bruno',
        data_hora: '2026-09-17T13:00:00.000Z', status_presenca: 'Pendente de Evolução',
    });
    assert.equal(t.id, 7);
    assert.equal(t.pacienteId, 3);
    assert.equal(t.therapistId, 2);
    assert.equal(t.name, 'Ana');
    assert.equal(t.time, '13:00');
    assert.equal(t.status, 'pending');
    assert.equal(t.apiStatus, 'Pendente de Evolução');
    assert.equal(t.engagement, 'adequado');
    assert.equal(t.notes, '');
});

test('transformAtendimento: sem nome do paciente usa "Paciente #id"', () => {
    assert.equal(ApiService.transformAtendimento({ id: 1, paciente_id: 9 }).name, 'Paciente #9');
});

test('engagementLabels cobre todos os valores do enum nivel_engajamento', () => {
    assert.deepEqual(Object.keys(ApiService.engagementLabels).sort(), ['adequado', 'excelente', 'parcial', 'resistente']);
});

test('CadastroApi.buildUsuarioPayload: snake_case e opcionais com default seguro', () => {
    const p = CadastroApi.buildUsuarioPayload({
        nome: 'X', email: 'x@y.com', perfilRole: 'Terapeuta', especialidade: 'Psicologia', status: 'Ativo',
    });
    assert.deepEqual(Object.keys(p).sort(),
        ['email', 'equipe_nome', 'especialidade', 'nome', 'numero_conselho', 'perfil_role', 'senha', 'status']);
    assert.equal(p.perfil_role, 'Terapeuta');
    assert.equal(p.equipe_nome, null);
});

test('UI.statCard e UI.badge geram HTML esperado; trend só aparece quando informado', () => {
    assert.match(UI.statCard({ id: 's', label: 'L', icon: 'users' }), /id="s"/);
    assert.doesNotMatch(UI.statCard({ id: 's', label: 'L', icon: 'users' }), /stat-card-trend/);
    assert.match(UI.statCard({ id: 's', label: 'L', icon: 'users', trend: '+3' }), /stat-card-trend/);
    assert.match(UI.badge('ok', 'ok'), /badge--ok/);
});

test('AuthApi: sessão sobrevive a localStorage corrompido/indisponível (getSession não lança)', () => {
    const quebrado = { getItem: () => '{json inválido', setItem() {}, removeItem() {} };
    const { AuthApi } = h.carregarGlobais(['js/config.js', 'js/auth-api.js'], ['AuthApi'], { localStorage: quebrado, window: { location: {} } });
    assert.equal(AuthApi.getSession(), null);
});

// 2026-11-11: n8n responde 200 com corpo vazio quando a listagem não tem linhas.
const { lerJsonLista } = h.carregarGlobais(['js/config.js'], ['lerJsonLista']);
const respostaFalsa = (corpo) => ({ text: async () => corpo });

test('lerJsonLista: corpo vazio (n8n sem linhas) vira []', async () => {
    assert.deepEqual(Array.from(await lerJsonLista(respostaFalsa(''))), []);
    assert.deepEqual(Array.from(await lerJsonLista(respostaFalsa('  \n'))), []);
});

test('lerJsonLista: corpo com JSON é interpretado normalmente', async () => {
    const lista = await lerJsonLista(respostaFalsa('[{"id":1},{"id":2}]'));
    assert.equal(lista.length, 2);
    assert.equal(lista[1].id, 2);
});

test('lerJsonLista: JSON inválido continua falhando (não esconde erro real)', async () => {
    await assert.rejects(() => lerJsonLista(respostaFalsa('<html>erro</html>')));
});

test('listagens GET não chamam response.json() direto (quebra com corpo vazio)', () => {
    const ruins = [];
    for (const arq of h.arquivosJs()) {
        const linhas = h.read(arq).split('\n');
        linhas.forEach((l, i) => {
            if (!/await response\.json\(\)/.test(l)) return;
            const contexto = linhas.slice(Math.max(0, i - 12), i).join('\n');
            if (/LISTAR_|fetchListar/.test(contexto) && !/method:\s*'(POST|DELETE)'/.test(contexto)) ruins.push(`${arq}:${i + 1}`);
        });
    }
    assert.deepEqual(ruins, []);
});
