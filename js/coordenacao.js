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

// relatorio.data é uma coluna DATE pura (sem horário) -- "2026-09-20", sem
// "T"/timezone nenhum. new Date("2026-09-20") interpreta isso como meia-
// noite UTC, e converter esse instante pra America/Sao_Paulo (UTC-3) cai
// no dia anterior às 21h -- exibia (e exportava em PDF/Word) um dia a
// menos do que o realmente salvo. Formata direto a string, sem passar por
// Date/timezone nenhum -- não existe "hora" aqui pra converter.
function formatDateOnly(value) {
    if (!value) return '--';
    const [year, month, day] = String(value).slice(0, 10).split('-');
    if (!year || !month || !day) return '--';
    return `${day}/${month}/${year}`;
}

function formatTime(isoDate) {
    if (!isoDate) return '--:--';
    return new Date(isoDate).toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'America/Sao_Paulo',
    });
}

// Vira YYYY-MM-DD (o que <input type="date"> espera), aceitando tanto uma
// data ISO completa quanto só a data.
function toDateInputValue(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
}

// -----------------------------------------------------------------------
// Estado carregado uma vez — trocar de aba ou filtrar depois é só
// re-render, sem round-trip novo à API.
// -----------------------------------------------------------------------
let allAtendimentos = [];
let allRelatorios = [];
let selectedRelatorioIds = new Set();
let editingRelatorioId = null;

// Comparação por String() dos dois lados (corrigido 2026-09-17): o id
// chega aqui como string sempre que vem de um onclick="...('${x.id}')" no
// HTML, mas os relatórios em si têm id numérico (Postgres) desde a
// migração — "6" === 6 é sempre false, então a seleção pra exportar e o
// botão de editar relatório silenciosamente não faziam nada.
function findRelatorioById(id) {
    const direto = allRelatorios.find((r) => String(r.id) === String(id));
    if (direto) return direto;

    for (const atendimento of allAtendimentos) {
        if (atendimento.relatorio && String(atendimento.relatorio.id) === String(id)) return atendimento.relatorio;
    }
    return null;
}

// -----------------------------------------------------------------------
// Abas
// -----------------------------------------------------------------------
function switchCoordenacaoTab(tab) {
    ['atendimentos', 'relatorios'].forEach((t) => {
        document.getElementById(`tab-btn-${t}`).className = t === tab ? 'segmented-btn active' : 'segmented-btn';
        document.getElementById(`tab-panel-${t}`).classList.toggle('hidden', t !== tab);
    });
}

// -----------------------------------------------------------------------
// Aba Atendimentos — cards com o relatório vinculado (se houver) já
// visível no próprio card.
// -----------------------------------------------------------------------
function renderAtendimentoCard(atendimento) {
    const relatorio = atendimento.relatorio;

    return `
        <div class="card p-5 flex flex-col gap-3">
            <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                    <h3 class="text-base font-bold truncate" style="color:var(--ink)">${escapeHtml(atendimento.pacienteNome)}</h3>
                    <p class="text-xs mt-1 flex items-center gap-1.5" style="color:var(--ink-soft)">
                        <i data-lucide="calendar" class="w-3.5 h-3.5"></i>
                        ${formatDate(atendimento.dataHora)} às ${formatTime(atendimento.dataHora)}
                    </p>
                    <p class="text-xs mt-0.5 flex items-center gap-1.5" style="color:var(--ink-soft)">
                        <i data-lucide="user-round" class="w-3.5 h-3.5"></i>
                        ${escapeHtml(atendimento.terapeutaNome)}
                    </p>
                </div>
                ${atendimento.planoSaude ? `<span class="badge badge--brand shrink-0">${escapeHtml(atendimento.planoSaude)}</span>` : ''}
            </div>

            <div class="pt-3" style="border-top:1px solid var(--border)">
                ${
                    relatorio
                        ? `
                    <div class="flex items-center justify-between gap-2 mb-1.5">
                        <p class="text-[11px] font-bold uppercase tracking-wider" style="color:var(--ink-faint)">
                            Evolução
                        </p>
                        <button onclick="openEditRelatorioModal('${relatorio.id}')" class="btn-icon" style="width:1.75rem;height:1.75rem;" title="Editar relatório">
                            <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                        </button>
                    </div>
                    <p class="text-sm leading-relaxed line-clamp-4" style="color:var(--ink)">${escapeHtml(relatorio.conteudo) || '<span class="italic">Sem conteúdo registrado.</span>'}</p>
                    ${CONFIG.FEATURES.cienciaRelatorio && relatorio.contestadoAtivo ? `<p class="text-[11px] font-semibold mt-1.5" style="color:var(--danger-600, #b91c1c)">O terapeuta não concorda com a última alteração deste relatório.</p>` : ''}
                    ${CONFIG.FEATURES.cienciaRelatorio && relatorio.precisaCiencia ? `<p class="text-[11px] font-semibold mt-1.5" style="color:var(--brand-600)">Aguardando ciência do terapeuta sobre esta alteração.</p>` : ''}
                `
                        : `<p class="text-xs italic" style="color:var(--ink-faint)">Sem relatório vinculado a este atendimento.</p>`
                }
            </div>
        </div>
    `;
}

function populateAtendimentoFilterOptions() {
    const planos = [...new Set(allAtendimentos.map((a) => a.planoSaude).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
    );
    const terapeutas = [...new Set(allAtendimentos.map((a) => a.terapeutaNome).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
    );

    const planoSelect = document.getElementById('filter-atendimento-plano');
    const terapeutaSelect = document.getElementById('filter-atendimento-terapeuta');

    planoSelect.innerHTML =
        '<option value="">Todos os planos</option>' +
        planos.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');

    terapeutaSelect.innerHTML =
        '<option value="">Todos os terapeutas</option>' +
        terapeutas.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
}

function getAtendimentoFilters() {
    return {
        paciente: document.getElementById('filter-atendimento-paciente').value.trim().toLowerCase(),
        terapeuta: document.getElementById('filter-atendimento-terapeuta').value,
        plano: document.getElementById('filter-atendimento-plano').value,
        evolucao: document.getElementById('filter-atendimento-evolucao').value, // '' | 'com' | 'sem'
        dataInicio: document.getElementById('filter-atendimento-data-inicio').value,
        dataFim: document.getElementById('filter-atendimento-data-fim').value,
    };
}

// Todos os filtros combinam com E (não é "ou um ou outro") — dá pra usar
// terapeuta + período, ou terapeuta + plano, ao mesmo tempo.
function applyAtendimentoFilters(atendimentos, filters) {
    return atendimentos.filter((a) => {
        if (filters.paciente && !a.pacienteNome.toLowerCase().includes(filters.paciente)) return false;
        if (filters.terapeuta && a.terapeutaNome !== filters.terapeuta) return false;
        if (filters.plano && a.planoSaude !== filters.plano) return false;
        if (filters.evolucao === 'com' && !a.relatorio) return false;
        if (filters.evolucao === 'sem' && a.relatorio) return false;

        if (a.dataHora) {
            const data = new Date(a.dataHora);
            if (filters.dataInicio && data < new Date(filters.dataInicio)) return false;
            if (filters.dataFim && data > new Date(`${filters.dataFim}T23:59:59`)) return false;
        }

        return true;
    });
}

function clearAtendimentoFilters() {
    document.getElementById('filterFormAtendimentos').reset();
    renderAtendimentosTab();
}

function renderAtendimentosTab() {
    const filters = getAtendimentoFilters();
    const filtered = applyAtendimentoFilters(allAtendimentos, filters);

    const container = document.getElementById('atendimentos-container');
    const empty = document.getElementById('atendimentos-empty');
    const countBadge = document.getElementById('atendimentos-count-badge');

    countBadge.innerText = `${filtered.length} atendimento(s)`;

    if (filtered.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    container.innerHTML = filtered.map(renderAtendimentoCard).join('');
    lucide.createIcons();
}

// -----------------------------------------------------------------------
// Aba Relatórios — filtros por data, paciente, plano e terapeuta.
// -----------------------------------------------------------------------
function populateRelatorioFilterOptions() {
    const planos = [...new Set(allRelatorios.map((r) => r.planoSaude).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
    );
    const terapeutas = [...new Set(allRelatorios.map((r) => r.autorNome).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
    );

    const planoSelect = document.getElementById('filter-relatorio-plano');
    const terapeutaSelect = document.getElementById('filter-relatorio-terapeuta');

    planoSelect.innerHTML =
        '<option value="">Todos os planos</option>' +
        planos.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');

    terapeutaSelect.innerHTML =
        '<option value="">Todos os terapeutas</option>' +
        terapeutas.map((t) => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
}

function getRelatorioFilters() {
    return {
        paciente: document.getElementById('filter-relatorio-paciente').value.trim().toLowerCase(),
        plano: document.getElementById('filter-relatorio-plano').value,
        terapeuta: document.getElementById('filter-relatorio-terapeuta').value,
        dataInicio: document.getElementById('filter-relatorio-data-inicio').value,
        dataFim: document.getElementById('filter-relatorio-data-fim').value,
    };
}

function applyRelatorioFilters(relatorios, filters) {
    return relatorios.filter((r) => {
        if (filters.paciente && !r.pacienteNome.toLowerCase().includes(filters.paciente)) return false;
        if (filters.plano && r.planoSaude !== filters.plano) return false;
        if (filters.terapeuta && r.autorNome !== filters.terapeuta) return false;

        if (r.data) {
            const data = new Date(r.data);
            if (filters.dataInicio && data < new Date(filters.dataInicio)) return false;
            if (filters.dataFim && data > new Date(`${filters.dataFim}T23:59:59`)) return false;
        }

        return true;
    });
}

function renderRelatorioCard(relatorio) {
    const tipoBadgeClass = relatorio.tipo === 'Evolução' ? 'badge--ok' : 'badge--brand';
    // selectedRelatorioIds guarda ids como string (vêm de onclick="..."),
    // relatorio.id é numérico — precisa normalizar pro mesmo tipo aqui.
    const selecionado = selectedRelatorioIds.has(String(relatorio.id));

    return `
        <div class="card p-5 flex flex-col gap-3" style="${selecionado ? 'outline:2px solid var(--brand-500, #2f8f5b); outline-offset:-2px;' : ''}">
            <div class="flex items-start justify-between gap-3 flex-wrap">
                <div class="flex items-start gap-3">
                    <input type="checkbox" class="mt-1 w-4 h-4 shrink-0" ${selecionado ? 'checked' : ''}
                        onchange="toggleRelatorioSelection('${relatorio.id}', this.checked)" title="Selecionar para exportar" />
                    <div>
                        <h3 class="text-base font-bold" style="color:var(--ink)">${escapeHtml(relatorio.pacienteNome)}</h3>
                        <p class="text-xs mt-0.5" style="color:var(--ink-soft)">
                            ${formatDateOnly(relatorio.data)} · ${escapeHtml(relatorio.autorNome)}${relatorio.planoSaude ? ` · ${escapeHtml(relatorio.planoSaude)}` : ''}
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                    <span class="badge ${tipoBadgeClass}">${escapeHtml(relatorio.tipo)}</span>
                    <button onclick="openEditRelatorioModal('${relatorio.id}')" class="btn-icon" style="width:1.75rem;height:1.75rem;" title="Editar relatório">
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </div>

            <p class="text-sm leading-relaxed" style="color:var(--ink)">${escapeHtml(relatorio.conteudo) || '<span class="italic">Sem conteúdo registrado.</span>'}</p>

            ${CONFIG.FEATURES.cienciaRelatorio && relatorio.contestadoAtivo ? `<p class="text-[11px] font-semibold" style="color:var(--danger-600, #b91c1c)">O terapeuta não concorda com a última alteração deste relatório.</p>` : ''}
            ${CONFIG.FEATURES.cienciaRelatorio && relatorio.precisaCiencia ? `<p class="text-[11px] font-semibold" style="color:var(--brand-600)">Aguardando ciência do terapeuta sobre esta alteração.</p>` : ''}
        </div>
    `;
}

function renderRelatoriosTab() {
    const filters = getRelatorioFilters();
    const filtered = applyRelatorioFilters(allRelatorios, filters);

    const container = document.getElementById('relatorios-container');
    const empty = document.getElementById('relatorios-empty');
    const countBadge = document.getElementById('relatorios-count-badge');

    countBadge.innerText = `${filtered.length} relatório(s)`;

    if (filtered.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    container.innerHTML = filtered.map(renderRelatorioCard).join('');
    lucide.createIcons();
    updateRelatorioSelectionToolbar();
}

function clearRelatorioFilters() {
    document.getElementById('filterFormRelatorios').reset();
    renderRelatoriosTab();
}

// -----------------------------------------------------------------------
// Seleção de relatórios para exportação — só permite selecionar relatórios
// do mesmo paciente por vez (decisão explícita do usuário).
// -----------------------------------------------------------------------
function toggleRelatorioSelection(id, checked) {
    const relatorio = findRelatorioById(id);
    if (!relatorio) return;

    if (checked) {
        const jaSelecionado = getSelectedRelatoriosSorted()[0];
        if (jaSelecionado && jaSelecionado.pacienteNome !== relatorio.pacienteNome) {
            showToast(
                `Só é possível exportar relatórios de um paciente por vez. Desmarque os relatórios de "${jaSelecionado.pacienteNome}" antes de selecionar outro paciente.`,
                'error'
            );
            renderRelatoriosTab();
            return;
        }
        selectedRelatorioIds.add(id);
    } else {
        selectedRelatorioIds.delete(id);
    }

    updateRelatorioSelectionToolbar();
}

function clearRelatorioSelection() {
    selectedRelatorioIds.clear();
    renderRelatoriosTab();
}

function getSelectedRelatoriosSorted() {
    return [...selectedRelatorioIds]
        .map((id) => findRelatorioById(id))
        .filter(Boolean)
        .sort((a, b) => new Date(a.data || 0) - new Date(b.data || 0));
}

function updateRelatorioSelectionToolbar() {
    const toolbar = document.getElementById('relatorio-selection-toolbar');
    const countEl = document.getElementById('relatorio-selection-count');
    if (!toolbar || !countEl) return;

    const total = selectedRelatorioIds.size;
    toolbar.classList.toggle('hidden', total === 0);
    countEl.innerText = `${total} selecionado(s)`;
}

// -----------------------------------------------------------------------
// Exportação de relatórios selecionados como documento de evolução.
// Título "Evolução de Paciente" + dados do paciente/terapeuta, seguido
// dos relatórios selecionados encadeados em ordem cronológica.
// -----------------------------------------------------------------------
function buildEvolucaoDocumentHtml(relatorios) {
    const pacienteNome = relatorios[0].pacienteNome;
    const autoresUnicos = [...new Set(relatorios.map((r) => r.autorNome).filter(Boolean))];
    const terapeutaNome = autoresUnicos.length ? autoresUnicos.join(' / ') : '—';

    const entradas = relatorios
        .map(
            (r) => `
                <div style="margin-bottom:18px;">
                    <p style="margin:0 0 4px 0; font-weight:bold;">${escapeHtml(formatDateOnly(r.data))}</p>
                    <p style="margin:0; white-space:pre-wrap;">${escapeHtml(r.conteudo) || 'Sem conteúdo registrado.'}</p>
                </div>
            `
        )
        .join('');

    return `
        <div style="font-family:Calibri,Arial,sans-serif; font-size:14px; color:#111; padding:24px;">
            <h1 style="text-align:center; font-size:20px; margin:0 0 24px 0;">Evolução de Paciente</h1>
            <div style="text-align:left; margin-bottom:20px;">
                <p style="margin:0 0 4px 0;"><strong>Nome do paciente:</strong> ${escapeHtml(pacienteNome)}</p>
                <p style="margin:0;"><strong>Nome do terapeuta:</strong> ${escapeHtml(terapeutaNome)}</p>
            </div>
            <hr style="border:none; border-top:1px solid #ccc; margin:0 0 20px 0;" />
            ${entradas}
        </div>
    `;
}

function exportSelectedRelatorios(formato) {
    const relatorios = getSelectedRelatoriosSorted();
    if (relatorios.length === 0) {
        showToast('Selecione ao menos um relatório para exportar.', 'error');
        return;
    }

    const pacienteNome = relatorios[0].pacienteNome;
    const conteudoHtml = buildEvolucaoDocumentHtml(relatorios);
    const nomeArquivo = `Evolucao_${pacienteNome.replace(/[^a-zA-Z0-9]+/g, '_')}`;

    if (formato === 'pdf') {
        exportComoPdf(conteudoHtml);
    } else if (formato === 'xml') {
        exportComoXml(relatorios, nomeArquivo);
    } else {
        exportComoWord(conteudoHtml, nomeArquivo);
    }
}

function escapeXmlText(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// Exporta os dados brutos dos relatórios selecionados como XML — pensado
// para integração/uso em outro sistema, não para leitura em editor de texto.
function buildEvolucaoXml(relatorios) {
    const pacienteNome = relatorios[0].pacienteNome;
    const autoresUnicos = [...new Set(relatorios.map((r) => r.autorNome).filter(Boolean))];
    const terapeutaNome = autoresUnicos.length ? autoresUnicos.join(' / ') : '';

    const itens = relatorios
        .map(
            (r) => `
        <Relatorio>
            <Id>${escapeXmlText(r.id)}</Id>
            <Tipo>${escapeXmlText(r.tipo)}</Tipo>
            <Autor>${escapeXmlText(r.autorNome)}</Autor>
            <Data>${escapeXmlText(toDateInputValue(r.data))}</Data>
            <PlanoSaude>${escapeXmlText(r.planoSaude)}</PlanoSaude>
            <Conteudo>${escapeXmlText(r.conteudo)}</Conteudo>
        </Relatorio>`
        )
        .join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<EvolucaoPaciente>
    <Paciente>${escapeXmlText(pacienteNome)}</Paciente>
    <Terapeuta>${escapeXmlText(terapeutaNome)}</Terapeuta>
    <Relatorios>${itens}
    </Relatorios>
</EvolucaoPaciente>
`;
}

function exportComoXml(relatorios, nomeArquivo) {
    const xml = buildEvolucaoXml(relatorios);
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nomeArquivo}.xml`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// Imprime via um iframe invisível — evita bloqueio de pop-up e deixa o
// usuário escolher "Salvar como PDF" na própria caixa de impressão.
//
// Importante: print() é chamado NA HORA, logo depois do doc.close(), sem
// esperar o evento "load" do iframe. Esperar por ele (como a versão
// anterior fazia) não é confiável — document.write() nem sempre redispara
// o load — e mesmo quando dispara, chamar print() de dentro de um callback
// assíncrono pode perder a permissão de "gesto do usuário" que o navegador
// exige pra abrir a caixa de impressão, bloqueando ela silenciosamente.
// Como doc.write()/doc.close() são síncronos, o conteúdo já está pronto
// nesse ponto — não precisa esperar nada.
function exportComoPdf(conteudoHtml) {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.top = '0';
    iframe.style.left = '-10000px';
    iframe.style.width = '800px';
    iframe.style.height = '600px';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Evolução de Paciente</title></head><body>${conteudoHtml}</body></html>`);
    doc.close();

    const limpar = () => {
        if (iframe.parentNode) document.body.removeChild(iframe);
    };

    iframe.contentWindow.focus();
    iframe.contentWindow.print();

    iframe.contentWindow.addEventListener('afterprint', limpar, { once: true });
    setTimeout(limpar, 5000); // rede de segurança, caso "afterprint" não dispare
}

// Gera um .doc compatível com o Word usando o formato HTML-com-namespace do
// próprio Word — não é um .docx (OOXML) real, mas abre e edita normalmente
// no Word/LibreOffice sem depender de nenhuma biblioteca externa.
function exportComoWord(conteudoHtml, nomeArquivo) {
    const documentoCompleto = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">
        <head><meta charset="utf-8"><title>Evolução de Paciente</title></head>
        <body>${conteudoHtml}</body>
        </html>
    `;

    const blob = new Blob(['﻿', documentoCompleto], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${nomeArquivo}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

// -----------------------------------------------------------------------
// Modal de edição — data e conteúdo, compartilhado pelas duas abas.
// -----------------------------------------------------------------------
function openEditRelatorioModal(id) {
    const relatorio = findRelatorioById(id);
    if (!relatorio) return;

    editingRelatorioId = id;

    document.getElementById('modal-editar-paciente').innerText = relatorio.pacienteNome;
    document.getElementById('modal-editar-contexto').innerText = `${relatorio.tipo} · ${relatorio.autorNome}`;
    document.getElementById('modal-editar-data').value = toDateInputValue(relatorio.data);
    document.getElementById('modal-editar-conteudo').value = relatorio.conteudo;

    // Status de presença do atendimento só existe pra relatório de
    // Evolução (tem atendimento_id vinculado) -- Avulso não tem o que
    // corrigir aqui, então o campo some (ver handleEditRelatorioSubmit).
    const statusContainer = document.getElementById('modal-editar-status-container');
    const statusSelect = document.getElementById('modal-editar-status');
    if (relatorio.atendimentoId && relatorio.statusAtendimento) {
        statusSelect.value = relatorio.statusAtendimento;
        statusContainer.classList.remove('hidden');
    } else {
        statusContainer.classList.add('hidden');
    }

    document.getElementById('modal-editar-relatorio').classList.remove('hidden');
    lucide.createIcons();
}

function closeEditRelatorioModal() {
    document.getElementById('modal-editar-relatorio').classList.add('hidden');
    editingRelatorioId = null;
}

async function handleEditRelatorioSubmit(event) {
    event.preventDefault();
    if (!editingRelatorioId) return;

    const data = document.getElementById('modal-editar-data').value;
    const conteudo = document.getElementById('modal-editar-conteudo').value.trim();
    const session = AuthApi.getSession();

    // Só manda status_presenca se o campo estiver visível (relatório de
    // Evolução com atendimento vinculado) -- escondido significa Avulso,
    // sem atendimento pra corrigir (ver openEditRelatorioModal).
    const statusContainer = document.getElementById('modal-editar-status-container');
    const statusPresenca = statusContainer.classList.contains('hidden')
        ? null
        : document.getElementById('modal-editar-status').value;

    try {
        await CoordenacaoApi.editarRelatorio({
            id: editingRelatorioId,
            data,
            conteudo,
            editadoPorNome: (session && session.nome) || '',
            statusPresenca,
        });

        closeEditRelatorioModal();
        // Recarrega tudo em vez de só atualizar localmente -- o autor
        // original precisa ver essa alteração e dar ciência (ver
        // js/app.js), então o dado tem que vir de volta de verdade do
        // servidor, não de um patch otimista no cliente.
        await loadCoordenacaoDados();
        showToast('Relatório atualizado com sucesso.', 'success');
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao salvar a edição. Tente novamente.', 'error');
    }
}

// -----------------------------------------------------------------------
// Carregamento
// -----------------------------------------------------------------------
async function loadCoordenacaoDados() {
    const loading = document.getElementById('coordenacao-loading');
    const content = document.getElementById('coordenacao-content');
    const errorState = document.getElementById('coordenacao-error');

    loading.classList.remove('hidden');
    content.classList.add('hidden');
    errorState.classList.add('hidden');

    try {
        const { atendimentosRealizados, relatorios } = await CoordenacaoApi.fetchAtendimentosComContexto();

        allAtendimentos = atendimentosRealizados;
        allRelatorios = relatorios;
        selectedRelatorioIds.clear();

        populateAtendimentoFilterOptions();
        populateRelatorioFilterOptions();
        if (pacienteAutocompleteFiltroAtendimento) {
            pacienteAutocompleteFiltroAtendimento.setOptions(
                [...new Map(allAtendimentos.map((a) => [a.pacienteNome, a])).values()].map((a) => ({
                    id: a.pacienteNome,
                    label: a.pacienteNome,
                    sublabel: a.planoSaude || '',
                }))
            );
        }
        renderAtendimentosTab();
        renderRelatoriosTab();

        loading.classList.add('hidden');
        content.classList.remove('hidden');
    } catch (error) {
        console.error(error);
        loading.classList.add('hidden');
        errorState.classList.remove('hidden');
        document.getElementById('coordenacao-error-message').innerText =
            error.message || 'Não foi possível carregar os dados da coordenação.';
        showToast(error.message || 'Erro ao carregar dados.', 'error');
    } finally {
        lucide.createIcons();
    }
}

// -----------------------------------------------------------------------
// Novo relatório avulso — sem atendimento vinculado. Reaproveita
// CadastroApi.buildRelatorioPayload/registrarRelatorio (já testados contra
// /registrar/relatorio) e a mesma lista de pacientes usada em Cadastros.
// -----------------------------------------------------------------------
let pacienteAutocompleteRelatorio = null;
let pacienteAutocompleteFiltro = null;

// Busca a lista de pacientes uma vez e alimenta os dois autocompletes desta
// página (o do modal "Novo Relatório" e o do filtro da aba Relatórios).
async function loadPacientesParaNovoRelatorio() {
    const input = document.getElementById('novo-relatorio-paciente');

    try {
        const pacientes = await PacientesApi.fetchPacientes();
        const opcoes = pacientes.map((p) => ({ id: p.id, label: p.nome, sublabel: p.planoSaude || '' }));

        if (pacientes.length === 0) {
            input.placeholder = 'Nenhum paciente cadastrado';
            return;
        }

        pacienteAutocompleteRelatorio.setOptions(opcoes);
        input.disabled = false;
        input.placeholder = 'Digite o nome do paciente...';

        if (pacienteAutocompleteFiltro) pacienteAutocompleteFiltro.setOptions(opcoes);
    } catch (error) {
        console.error(error);
        input.placeholder = 'Erro ao carregar pacientes';
        showToast(error.message || 'Erro ao carregar lista de pacientes.', 'error');
    }
}

function openNovoRelatorioModal() {
    const session = AuthApi.getSession();

    document.getElementById('novo-relatorio-autor').innerText = (session && session.nome) || '—';
    document.getElementById('novo-relatorio-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('novo-relatorio-conteudo').value = '';
    document.getElementById('novo-relatorio-paciente').value = '';
    if (pacienteAutocompleteRelatorio) pacienteAutocompleteRelatorio.clear();

    document.getElementById('modal-novo-relatorio').classList.remove('hidden');
    lucide.createIcons();
}

function closeNovoRelatorioModal() {
    document.getElementById('modal-novo-relatorio').classList.add('hidden');
}

async function handleNovoRelatorioSubmit(event) {
    event.preventDefault();

    const session = AuthApi.getSession();
    const pacienteNome = document.getElementById('novo-relatorio-paciente').value.trim();
    const data = document.getElementById('novo-relatorio-data').value;
    const conteudo = document.getElementById('novo-relatorio-conteudo').value.trim();

    if (!pacienteNome) {
        showToast('Selecione um paciente da lista antes de salvar.', 'error');
        return;
    }

    const submitBtn = document.getElementById('novo-relatorio-submit-btn');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Criando...';
    lucide.createIcons();

    try {
        const payload = CadastroApi.buildRelatorioPayload({
            tipo: 'Avulso',
            pacienteNome,
            atendimentoId: null,
            autorNome: (session && session.nome) || '',
            data,
            conteudo,
        });
        await CadastroApi.registrarRelatorio(payload);

        closeNovoRelatorioModal();
        showToast('Relatório avulso criado com sucesso.', 'success');

        // Recarrega tudo da base pra já mostrar o relatório novo (mais
        // simples e mais confiável do que tentar inserir só na memória).
        await loadCoordenacaoDados();
        switchCoordenacaoTab('relatorios');
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao criar relatório.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        lucide.createIcons();
    }
}

// -----------------------------------------------------------------------
// FAB de ações rápidas (só Coordenador) — atalhos pros Cadastros e
// agendamento de um Atendimento Avulso sem sair da tela.
// -----------------------------------------------------------------------
function initCoordenadorFab() {
    const session = AuthApi.getSession();
    const fab = document.getElementById('coordenador-fab');
    if (!fab) return;
    fab.classList.toggle('hidden', !(session && session.perfilRole === 'Coordenador'));
}

function openCoordenadorFabMenu() {
    document.getElementById('coordenador-fab-menu').classList.remove('hidden');
    document.getElementById('coordenador-fab-icon').setAttribute('data-lucide', 'x');
    lucide.createIcons();
}

function closeCoordenadorFabMenu() {
    document.getElementById('coordenador-fab-menu').classList.add('hidden');
    document.getElementById('coordenador-fab-icon').setAttribute('data-lucide', 'plus');
    lucide.createIcons();
}

function toggleCoordenadorFabMenu() {
    const menu = document.getElementById('coordenador-fab-menu');
    if (menu.classList.contains('hidden')) openCoordenadorFabMenu();
    else closeCoordenadorFabMenu();
}

// -----------------------------------------------------------------------
// Modal de Atendimento Avulso — cria um atendimento pontual de verdade via
// /criar/atendimento (já testado e funcionando, ver CadastroApi.criarAtendimento).
// -----------------------------------------------------------------------
let pacienteAutocompleteAtendimentoAvulso = null;
let terapeutaAutocompleteAtendimentoAvulso = null;
let opcoesAtendimentoAvulsoCarregadas = false;

async function loadOpcoesAtendimentoAvulso() {
    if (opcoesAtendimentoAvulsoCarregadas) return;
    opcoesAtendimentoAvulsoCarregadas = true;

    try {
        const [pacientes, terapeutas] = await Promise.all([PacientesApi.fetchPacientes(), UsuariosApi.fetchTerapeutas()]);

        const pacienteInput = document.getElementById('atendimento-avulso-paciente');
        pacienteAutocompleteAtendimentoAvulso.setOptions(pacientes.map((p) => ({ id: p.id, label: p.nome, sublabel: p.planoSaude || '' })));
        pacienteInput.disabled = false;
        pacienteInput.placeholder = 'Digite o nome do paciente...';

        const terapeutaInput = document.getElementById('atendimento-avulso-terapeuta');
        terapeutaAutocompleteAtendimentoAvulso.setOptions(terapeutas.map((t) => ({ id: t.id, label: t.nome, sublabel: t.especialidade || '' })));
        terapeutaInput.disabled = false;
        terapeutaInput.placeholder = 'Digite o nome do terapeuta...';
    } catch (error) {
        console.error(error);
        opcoesAtendimentoAvulsoCarregadas = false; // deixa tentar de novo na próxima abertura
        showToast(error.message || 'Erro ao carregar pacientes/terapeutas.', 'error');
    }
}

function openAtendimentoAvulsoModal() {
    closeCoordenadorFabMenu();

    document.getElementById('atendimento-avulso-data').value = new Date().toISOString().slice(0, 10);
    document.getElementById('modal-atendimento-avulso').classList.remove('hidden');
    loadOpcoesAtendimentoAvulso();
    lucide.createIcons();
}

function closeAtendimentoAvulsoModal() {
    document.getElementById('modal-atendimento-avulso').classList.add('hidden');
}

async function handleAtendimentoAvulsoSubmit(event) {
    event.preventDefault();

    const pacienteNome = document.getElementById('atendimento-avulso-paciente').value.trim();
    const terapeutaNome = document.getElementById('atendimento-avulso-terapeuta').value.trim();
    const data = document.getElementById('atendimento-avulso-data').value;
    const hora = document.getElementById('atendimento-avulso-hora').value;
    const tipo = document.getElementById('atendimento-avulso-tipo').value;

    if (!pacienteNome || !terapeutaNome || !data || !hora) {
        showToast('Preencha paciente, terapeuta, data e horário antes de agendar.', 'error');
        return;
    }

    const submitBtn = document.getElementById('atendimento-avulso-submit-btn');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Agendando...';
    lucide.createIcons();

    const session = AuthApi.getSession();
    const payload = CadastroApi.buildAtendimentoPayload({
        pacienteNome,
        terapeutaNome,
        dataHora: `${data}T${hora}:00-03:00`,
        supervisorNome: (session && session.nome) || '',
        tipoAtendimento: tipo,
    });

    try {
        await CadastroApi.criarAtendimento(payload);
        showToast(`Atendimento avulso agendado para ${pacienteNome}!`, 'success');
        closeAtendimentoAvulsoModal();
        document.getElementById('form-atendimento-avulso').reset();
        // Recarrega tudo da base pra já refletir o novo atendimento na
        // aba Atendimentos, igual já fazemos após criar um relatório avulso.
        await loadCoordenacaoDados();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao agendar atendimento.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        lucide.createIcons();
    }
}

let pacienteAutocompleteFiltroAtendimento = null;

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    document.getElementById('refresh-btn')?.addEventListener('click', loadCoordenacaoDados);
    document.getElementById('filterFormRelatorios')?.addEventListener('submit', (e) => {
        e.preventDefault();
        renderRelatoriosTab();
    });
    document.getElementById('filterFormAtendimentos')?.addEventListener('submit', (e) => {
        e.preventDefault();
        renderAtendimentosTab();
    });

    pacienteAutocompleteRelatorio = attachAutocomplete(document.getElementById('novo-relatorio-paciente'), { options: [] });
    pacienteAutocompleteFiltro = attachAutocomplete(document.getElementById('filter-relatorio-paciente'), {
        options: [],
        onSelect: () => renderRelatoriosTab(),
    });
    pacienteAutocompleteFiltroAtendimento = attachAutocomplete(document.getElementById('filter-atendimento-paciente'), {
        options: [],
        onSelect: () => renderAtendimentosTab(),
    });
    loadPacientesParaNovoRelatorio();

    pacienteAutocompleteAtendimentoAvulso = attachAutocomplete(document.getElementById('atendimento-avulso-paciente'), { options: [] });
    terapeutaAutocompleteAtendimentoAvulso = attachAutocomplete(document.getElementById('atendimento-avulso-terapeuta'), { options: [] });
    initCoordenadorFab();

    // Permite linkar direto pra uma aba, ex: coordenacao.html?tab=relatorios
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (['atendimentos', 'relatorios'].includes(tabParam)) {
        switchCoordenacaoTab(tabParam);
    }

    loadCoordenacaoDados();
});
