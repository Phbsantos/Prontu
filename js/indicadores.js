function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    let bgClass = 'bg-slate-900 text-white';
    let icon = 'info';

    if (type === 'error') {
        bgClass = 'bg-rose-600 text-white';
        icon = 'alert-circle';
    } else if (type === 'success') {
        bgClass = 'bg-emerald-600 text-white';
        icon = 'check-circle-2';
    }

    toast.className = `flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-xs font-semibold ${bgClass} transition-all duration-300 pointer-events-auto transform translate-y-2 opacity-0`;
    toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 shrink-0"></i><span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    lucide.createIcons();

    setTimeout(() => toast.classList.remove('translate-y-2', 'opacity-0'), 10);
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function formatDate(isoDate) {
    if (!isoDate) return '--';
    return new Date(isoDate).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

function formatTime(isoDate) {
    if (!isoDate) return '--:--';
    return new Date(isoDate).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
    });
}

// -----------------------------------------------------------------------
// Indicadores — 100% client-side, montado sobre /listar/atendimentos +
// /listar/relatorios já cruzados por CoordenacaoApi.fetchAtendimentosComContexto
// (mesma função usada em coordenacao.js). Não depende do endpoint
// /coordenacao/metricas (nunca teve URL confirmada).
//
// 2026-09-17: virou página própria (era uma aba dentro de coordenacao.html)
// e é a tela principal do Coordenador agora — ver js/role-guard.js e
// js/login.js.
//
// 2026-09-08: o bug do n8n/Airtable que gravava Falta/Desmarcado/Cancelado
// sempre como "Realizado" foi corrigido no backend novo (n8n local +
// Postgres, ver db/n8n-workflows/09_registrar_relatorio.json) — os
// indicadores abaixo não sofrem mais dessa subestimação.
// -----------------------------------------------------------------------
let todosAtendimentos = []; // todos os status, não só Realizado
let pacienteAutocompleteFiltroIndicador = null;

function isFalta(status) {
    return status === 'Falta sem Aviso';
}
function isDesmarcado(status) {
    return typeof status === 'string' && status.includes('Desmarcado');
}
function isCancelado(status) {
    return typeof status === 'string' && status.includes('Cancelado');
}

function populateIndicadorFilterOptions() {
    const terapeutaSelect = document.getElementById('filter-indicador-terapeuta');
    const terapeutas = [...new Set(todosAtendimentos.map((a) => a.terapeutaNome).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
    );

    const valorAtual = terapeutaSelect.value;
    terapeutaSelect.innerHTML =
        '<option value="">Todos os terapeutas</option>' +
        terapeutas.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    if (terapeutas.includes(valorAtual)) terapeutaSelect.value = valorAtual;
}

function getIndicadorFilters() {
    return {
        paciente: document.getElementById('filter-indicador-paciente').value.trim().toLowerCase(),
        terapeuta: document.getElementById('filter-indicador-terapeuta').value,
        dataInicio: document.getElementById('filter-indicador-data-inicio').value,
        dataFim: document.getElementById('filter-indicador-data-fim').value,
    };
}

function applyIndicadorFilters(atendimentos, filters) {
    return atendimentos.filter((a) => {
        if (filters.paciente && !a.pacienteNome.toLowerCase().includes(filters.paciente)) return false;
        if (filters.terapeuta && a.terapeutaNome !== filters.terapeuta) return false;
        if (a.dataHora) {
            const data = new Date(a.dataHora);
            if (filters.dataInicio && data < new Date(filters.dataInicio)) return false;
            if (filters.dataFim && data > new Date(`${filters.dataFim}T23:59:59`)) return false;
        }
        return true;
    });
}

function clearIndicadorFilters() {
    document.getElementById('filterFormIndicadores').reset();
    if (pacienteAutocompleteFiltroIndicador) pacienteAutocompleteFiltroIndicador.clear();
    renderIndicadores();
}

function computeIndicadoresResumo(atendimentos) {
    const realizados = atendimentos.filter((a) => a.status === 'Realizado');
    const comEvolucao = realizados.filter((a) => a.relatorio);
    const semEvolucao = realizados.filter((a) => !a.relatorio);
    const faltas = atendimentos.filter((a) => isFalta(a.status));
    const desmarcados = atendimentos.filter((a) => isDesmarcado(a.status));
    const cancelados = atendimentos.filter((a) => isCancelado(a.status));

    const baseAssiduidade = realizados.length + faltas.length + desmarcados.length + cancelados.length;
    const taxaAssiduidade = baseAssiduidade > 0 ? Math.round((realizados.length / baseAssiduidade) * 100) : 0;

    return {
        total: atendimentos.length,
        realizados,
        comEvolucao,
        semEvolucao,
        faltas,
        desmarcados,
        cancelados,
        taxaAssiduidade,
    };
}

function renderIndicadoresKpis(resumo) {
    const root = document.getElementById('indicadores-kpis-root');
    root.innerHTML = [
        UI.statCard({ id: 'ind-kpi-total', label: 'Total no filtro', icon: 'calendar-days', initialValue: resumo.total, accent: true }),
        UI.statCard({ id: 'ind-kpi-realizados', label: 'Realizados', icon: 'check-circle-2', initialValue: resumo.realizados.length }),
        UI.statCard({ id: 'ind-kpi-com-evolucao', label: 'Com evolução', icon: 'file-check-2', initialValue: resumo.comEvolucao.length }),
        UI.statCard({ id: 'ind-kpi-sem-evolucao', label: 'Sem evolução', icon: 'file-warning', initialValue: resumo.semEvolucao.length }),
        UI.statCard({ id: 'ind-kpi-faltas', label: 'Faltas s/ aviso', icon: 'user-x', initialValue: resumo.faltas.length }),
        UI.statCard({ id: 'ind-kpi-desmarcados', label: 'Desmarcados', icon: 'calendar-x', initialValue: resumo.desmarcados.length }),
        UI.statCard({ id: 'ind-kpi-cancelados', label: 'Cancelados', icon: 'ban', initialValue: resumo.cancelados.length }),
        UI.statCard({ id: 'ind-kpi-assiduidade', label: 'Taxa de assiduidade', icon: 'trending-up', initialValue: `${resumo.taxaAssiduidade}%` }),
    ].join('');
    lucide.createIcons();
}

function renderIndicadoresSemEvolucao(semEvolucaoList) {
    const container = document.getElementById('indicadores-sem-evolucao-container');
    const empty = document.getElementById('indicadores-sem-evolucao-empty');
    const badge = document.getElementById('indicadores-sem-evolucao-badge');

    badge.innerText = `${semEvolucaoList.length} caso(s)`;

    if (semEvolucaoList.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    container.innerHTML = semEvolucaoList
        .map(
            (a) => `
        <div class="p-4 flex items-center justify-between gap-3 flex-wrap">
            <div>
                <p class="text-sm font-semibold" style="color:var(--ink)">${escapeHtml(a.pacienteNome)}</p>
                <p class="text-xs mt-0.5" style="color:var(--ink-soft)">
                    ${formatDate(a.dataHora)} às ${formatTime(a.dataHora)} · ${escapeHtml(a.terapeutaNome)}
                </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
                <span class="badge badge--warn">Sem evolução</span>
                <button type="button" onclick="handleReabrirAtendimento(${a.id})" class="btn-secondary text-xs" title="Marca como Pendente de Evolução -- some do 'Realizado', aparece pro terapeuta igual um atendimento pendente">
                    <i data-lucide="rotate-ccw" class="w-3.5 h-3.5"></i>
                    Marcar como Pendente
                </button>
            </div>
        </div>
    `
        )
        .join('');
}

// Reabre um atendimento "Realizado sem evolução" -- pedido direto do
// Coordenador: quando o terapeuta marca a sessão como feita mas nunca
// escreve a evolução, o coordenador precisa poder devolver isso pra
// agenda do terapeuta em vez de ficar sem evolução pra sempre. Não volta
// pra "Agendado" (que significaria "a sessão ainda não aconteceu") --
// vira "Pendente de Evolução" (ver db/migrations/005_status_pendente_evolucao.sql),
// um status próprio que segue a MESMA regra de "Agendado" do ponto de
// vista do terapeuta (mesmo badge "Pendente", mesmo aviso de atendimentos
// atrasados — ver ApiService.mapApiStatusToInternal/
// fetchAtendimentosPendentesAnteriores em js/api.js).
async function handleReabrirAtendimento(id) {
    try {
        await CoordenacaoApi.atualizarStatusAtendimento(id, 'Pendente de Evolução');
        showToast('Atendimento marcado como pendente de evolução.', 'success');
        await loadIndicadoresDados();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao reabrir o atendimento.', 'error');
    }
}

function renderIndicadoresPorTerapeuta(atendimentos) {
    const tbody = document.getElementById('indicadores-terapeuta-tbody');
    const empty = document.getElementById('indicadores-terapeuta-empty');

    const porTerapeuta = new Map();
    atendimentos
        .filter((a) => a.status === 'Realizado')
        .forEach((a) => {
            if (!porTerapeuta.has(a.terapeutaNome)) {
                porTerapeuta.set(a.terapeutaNome, { terapeuta: a.terapeutaNome, realizados: 0, comEvolucao: 0, semEvolucao: 0 });
            }
            const linha = porTerapeuta.get(a.terapeutaNome);
            linha.realizados += 1;
            if (a.relatorio) linha.comEvolucao += 1;
            else linha.semEvolucao += 1;
        });

    const linhas = [...porTerapeuta.values()].sort(
        (a, b) => b.semEvolucao - a.semEvolucao || a.terapeuta.localeCompare(b.terapeuta, 'pt-BR')
    );

    if (linhas.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    tbody.innerHTML = linhas
        .map(
            (l) => `
        <tr class="border-t" style="border-color:var(--border)">
            <td class="px-4 py-3 font-semibold" style="color:var(--ink)">${escapeHtml(l.terapeuta)}</td>
            <td class="px-4 py-3 text-center">${l.realizados}</td>
            <td class="px-4 py-3 text-center"><span class="badge badge--ok">${l.comEvolucao}</span></td>
            <td class="px-4 py-3 text-center">${
                l.semEvolucao > 0 ? `<span class="badge badge--warn">${l.semEvolucao}</span>` : '0'
            }</td>
        </tr>
    `
        )
        .join('');
}

// Conta faltas/desmarcações/cancelamentos consecutivos mais recentes de um
// paciente, olhando o HISTÓRICO COMPLETO (não o filtro atual aplicado na
// tela) — um alerta de risco não deveria sumir só porque o filtro de data
// mudou.
function computeFaltasConsecutivas(pacienteNome) {
    const historico = todosAtendimentos
        .filter((a) => a.pacienteNome === pacienteNome && a.status !== 'Agendado')
        .sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));

    let consecutivas = 0;
    for (const a of historico) {
        if (a.status === 'Realizado') break;
        consecutivas += 1;
    }
    return consecutivas;
}

function renderIndicadoresPorPaciente(atendimentos) {
    const tbody = document.getElementById('indicadores-paciente-tbody');
    const empty = document.getElementById('indicadores-paciente-empty');

    const porPaciente = new Map();
    atendimentos.forEach((a) => {
        if (!porPaciente.has(a.pacienteNome)) {
            porPaciente.set(a.pacienteNome, { paciente: a.pacienteNome, realizados: 0, faltas: 0, desmarcados: 0, cancelados: 0 });
        }
        const linha = porPaciente.get(a.pacienteNome);
        if (a.status === 'Realizado') linha.realizados += 1;
        else if (isFalta(a.status)) linha.faltas += 1;
        else if (isDesmarcado(a.status)) linha.desmarcados += 1;
        else if (isCancelado(a.status)) linha.cancelados += 1;
    });

    const linhas = [...porPaciente.values()]
        .map((l) => ({ ...l, faltasConsecutivas: computeFaltasConsecutivas(l.paciente) }))
        .sort(
            (a, b) =>
                b.faltas + b.desmarcados + b.cancelados - (a.faltas + a.desmarcados + a.cancelados) ||
                a.paciente.localeCompare(b.paciente, 'pt-BR')
        );

    if (linhas.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    tbody.innerHTML = linhas
        .map(
            (l) => `
        <tr class="border-t" style="border-color:var(--border)">
            <td class="px-4 py-3 font-semibold" style="color:var(--ink)">${escapeHtml(l.paciente)}</td>
            <td class="px-4 py-3 text-center">${l.realizados}</td>
            <td class="px-4 py-3 text-center">${l.faltas > 0 ? `<span class="badge badge--danger">${l.faltas}</span>` : '0'}</td>
            <td class="px-4 py-3 text-center">${
                l.desmarcados > 0 ? `<span class="badge badge--warn">${l.desmarcados}</span>` : '0'
            }</td>
            <td class="px-4 py-3 text-center">${l.cancelados}</td>
            <td class="px-4 py-3">${
                l.faltasConsecutivas >= 2
                    ? `<span class="badge badge--danger">${l.faltasConsecutivas} faltas seguidas</span>`
                    : '<span style="color:var(--ink-faint)">—</span>'
            }</td>
        </tr>
    `
        )
        .join('');
}

function renderIndicadores() {
    const filters = getIndicadorFilters();
    const filtered = applyIndicadorFilters(todosAtendimentos, filters);
    const resumo = computeIndicadoresResumo(filtered);

    renderIndicadoresKpis(resumo);
    renderIndicadoresSemEvolucao(resumo.semEvolucao);
    renderIndicadoresPorTerapeuta(filtered);
    renderIndicadoresPorPaciente(filtered);
    lucide.createIcons();
}

// -----------------------------------------------------------------------
// Carregamento
// -----------------------------------------------------------------------
async function loadIndicadoresDados() {
    const loading = document.getElementById('indicadores-loading');
    const content = document.getElementById('indicadores-content');
    const errorState = document.getElementById('indicadores-error');

    loading.classList.remove('hidden');
    content.classList.add('hidden');
    errorState.classList.add('hidden');

    try {
        const { todosAtendimentos: dados } = await CoordenacaoApi.fetchAtendimentosComContexto();
        todosAtendimentos = dados;

        populateIndicadorFilterOptions();
        if (pacienteAutocompleteFiltroIndicador) {
            pacienteAutocompleteFiltroIndicador.setOptions(
                [...new Map(todosAtendimentos.map((a) => [a.pacienteNome, a])).values()].map((a) => ({
                    id: a.pacienteNome,
                    label: a.pacienteNome,
                    sublabel: a.planoSaude || '',
                }))
            );
        }

        renderIndicadores();

        loading.classList.add('hidden');
        content.classList.remove('hidden');
    } catch (error) {
        console.error(error);
        loading.classList.add('hidden');
        errorState.classList.remove('hidden');
        document.getElementById('indicadores-error-message').innerText =
            error.message || 'Não foi possível carregar os indicadores.';
        showToast(error.message || 'Erro ao carregar dados.', 'error');
    } finally {
        lucide.createIcons();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    document.getElementById('refresh-btn')?.addEventListener('click', loadIndicadoresDados);
    document.getElementById('filterFormIndicadores')?.addEventListener('submit', (e) => {
        e.preventDefault();
        renderIndicadores();
    });

    pacienteAutocompleteFiltroIndicador = attachAutocomplete(document.getElementById('filter-indicador-paciente'), {
        options: [],
        onSelect: () => renderIndicadores(),
    });

    loadIndicadoresDados();
});
