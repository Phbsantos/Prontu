// Cadastro de Recorrência semanal — aba "Nova Recorrência" em cadastros.html.
//
// 2026-09-17: ativada de verdade contra o backend (era session-only desde
// 2026-09-01 — ver prontu-feature-state). Agora: /registrar/recorrencia
// grava a recorrência em si (paciente/terapeuta/horário/dias da semana/
// período), e em seguida CadastroApi.criarAtendimento é chamado uma vez
// por data calculada (a mesma lógica de calcularDatasGeracao de antes),
// passando o id da recorrência recém-criada — os atendimentos ficam
// linkados de verdade via recorrencia_id. A lista/grade é sempre recarregada
// do backend (/listar/recorrencias), não guarda mais estado em sessionStorage.
//
// Arrastar um card pra outro dia/horário foi REMOVIDO por enquanto: isso
// exigiria um endpoint de atualização de recorrência que ainda não existe
// (só criar/listar) — reativar quando esse endpoint existir.
//
// Índice 0-6 = Domingo-Sábado, batendo com Date.getDay() — precisa ficar
// completo mesmo sem Domingo aparecer na grade/chips (ver DIAS_SEMANA_VISIVEIS).
const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const DIAS_SEMANA_ABREV = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
// A clínica não atende aos domingos — removido tanto da grade quanto dos
// chips de seleção do formulário (ficariam inconsistentes um sem o outro).
const DIAS_SEMANA_VISIVEIS = DIAS_SEMANA.filter((d) => d !== 'Domingo');
const RECORRENCIA_GRADE_HORA_INICIO = 7;
const RECORRENCIA_GRADE_HORA_FIM = 20; // exclusivo — última linha exibida é 19h
const RECORRENCIA_MAX_ATENDIMENTOS_POR_VEZ = 60;
const RECORRENCIA_DURACAO_MINIMA_MINUTOS = 30;
const RECORRENCIA_DURACAO_PADRAO_MINUTOS = 30;
const CORES_TERAPEUTA = ['#2f8049', '#2563eb', '#d97706', '#db2777', '#7c3aed', '#0891b2', '#dc2626', '#65a30d'];

let recorrencias = [];
let diasSelecionados = new Set();
let terapeutaCorMap = new Map();
let pacienteAutocompleteRecorrencia = null;
let terapeutaAutocompleteRecorrencia = null;

function formatDateBr(isoDate) {
    if (!isoDate) return '';
    return new Date(`${isoDate}T00:00:00`).toLocaleDateString('pt-BR');
}

// "14:00" + 50 -> "14:50"; passa da meia-noite dando a volta em 24h (não
// deve acontecer na prática, mas evita string inválida tipo "25:10").
function addMinutosHorario(horario, minutos) {
    const [h, m] = horario.split(':').map(Number);
    const total = (h * 60 + m + minutos + 24 * 60) % (24 * 60);
    const hh = Math.floor(total / 60);
    const mm = total % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// -----------------------------------------------------------------------
// Chips de dia da semana
// -----------------------------------------------------------------------
function renderDiasSemanaChips() {
    const container = document.getElementById('recorrencia-dias-semana');
    if (!container) return;

    container.innerHTML = DIAS_SEMANA_VISIVEIS.map(
        (dia) => `
            <button type="button"
                class="dia-semana-chip${diasSelecionados.has(dia) ? ' active' : ''}"
                onclick="toggleDiaSemana('${dia}')"
                title="${dia}">
                ${DIAS_SEMANA_ABREV[DIAS_SEMANA.indexOf(dia)]}
            </button>
        `
    ).join('');
}

function toggleDiaSemana(dia) {
    if (diasSelecionados.has(dia)) diasSelecionados.delete(dia);
    else diasSelecionados.add(dia);
    renderDiasSemanaChips();
}

// -----------------------------------------------------------------------
// Grade semanal — mostra as recorrências ativas como blocos; clicar num
// horário livre pré-preenche o formulário (dia + horário). Sem drag-and-drop
// (ver nota no topo do arquivo — precisaria de endpoint de atualização).
// -----------------------------------------------------------------------
function corParaTerapeuta(nome) {
    if (!terapeutaCorMap.has(nome)) {
        terapeutaCorMap.set(nome, CORES_TERAPEUTA[terapeutaCorMap.size % CORES_TERAPEUTA.length]);
    }
    return terapeutaCorMap.get(nome);
}

function onGradeSlotClick(dia, hora) {
    diasSelecionados.add(dia);
    renderDiasSemanaChips();

    const horarioInput = document.getElementById('recorrencia-horario');
    horarioInput.value = hora;

    showToast(`${dia}, ${hora} preenchido no formulário.`, 'info');
}

function renderGradeLegenda(filtroTerapeuta, ativas) {
    const el = document.getElementById('recorrencia-grade-legenda');
    if (!el) return;

    if (filtroTerapeuta || ativas.length === 0) {
        el.innerHTML = '';
        return;
    }

    const nomes = [...new Set(ativas.map((r) => r.terapeutaNome))];
    el.innerHTML = nomes
        .map(
            (nome) => `
        <span class="inline-flex items-center gap-1.5">
            <span class="inline-block w-2.5 h-2.5 rounded-full" style="background:${corParaTerapeuta(nome)}"></span>
            ${escapeHtml(nome)}
        </span>
    `
        )
        .join('');
}

function renderRecorrenciaGrid() {
    const container = document.getElementById('recorrencia-grade-container');
    const filtroSelect = document.getElementById('recorrencia-grade-terapeuta');
    if (!container || !filtroSelect) return;

    const filtroTerapeuta = filtroSelect.value;
    const ativas = recorrencias.filter((r) => r.status === 'Ativa' && (!filtroTerapeuta || r.terapeutaNome === filtroTerapeuta));

    // Faixa de horário dinâmica (corrigido 2026-09-17): antes era fixa em
    // RECORRENCIA_GRADE_HORA_INICIO..FIM, e qualquer recorrência com
    // horário fora dessa janela (ex: cadastrada por engano fora do
    // expediente) simplesmente não aparecia em lugar nenhum, sem aviso —
    // "a recorrência nova não aparece na grade". Agora a janela sempre se
    // expande pra cobrir toda recorrência ativa, além do padrão comercial.
    const horasExistentes = ativas
        .map((r) => parseInt((r.horario || '').split(':')[0], 10))
        .filter((h) => !Number.isNaN(h));
    const horaInicio = Math.min(RECORRENCIA_GRADE_HORA_INICIO, ...horasExistentes);
    const horaFim = Math.max(RECORRENCIA_GRADE_HORA_FIM, ...horasExistentes.map((h) => h + 1));

    const totalHoras = horaFim - horaInicio;
    let html = `<div class="recorrencia-grade" style="grid-template-rows: 2.25rem repeat(${totalHoras}, 3rem);">`;

    // Cabeçalho
    html += `<div class="recorrencia-grade-cell recorrencia-grade-corner" style="grid-row:1; grid-column:1;"></div>`;
    DIAS_SEMANA_VISIVEIS.forEach((dia, i) => {
        html += `<div class="recorrencia-grade-cell recorrencia-grade-header" style="grid-row:1; grid-column:${i + 2};">${DIAS_SEMANA_ABREV[DIAS_SEMANA.indexOf(dia)]}</div>`;
    });

    // Linhas de horário + células clicáveis
    for (let h = horaInicio; h < horaFim; h++) {
        const linha = h - horaInicio + 2;
        const horaLabel = `${String(h).padStart(2, '0')}:00`;
        html += `<div class="recorrencia-grade-cell recorrencia-grade-hora" style="grid-row:${linha}; grid-column:1;">${horaLabel}</div>`;

        DIAS_SEMANA_VISIVEIS.forEach((dia, i) => {
            html += `<div class="recorrencia-grade-cell recorrencia-grade-slot"
                style="grid-row:${linha}; grid-column:${i + 2};"
                onclick="onGradeSlotClick('${dia}', '${horaLabel}')"
            ></div>`;
        });
    }

    // Blocos das recorrências ativas — altura proporcional à duração (uma
    // hora cheia = 3rem, ver grid-template-rows acima).
    const ALTURA_HORA_REM = 3;
    ativas.forEach((r) => {
        const cor = filtroTerapeuta ? 'var(--brand-600)' : corParaTerapeuta(r.terapeutaNome);
        const [h] = r.horario.split(':').map(Number);
        const linha = h - horaInicio + 2;
        const duracao = r.duracaoMinutos || RECORRENCIA_DURACAO_PADRAO_MINUTOS;
        const alturaRem = (duracao / 60) * ALTURA_HORA_REM;
        const horarioFim = addMinutosHorario(r.horario, duracao);

        r.diasSemana.forEach((dia) => {
            const diaIndex = DIAS_SEMANA_VISIVEIS.indexOf(dia);
            if (diaIndex === -1) return;

            html += `
                <div class="recorrencia-grade-bloco"
                    style="grid-row:${linha}; grid-column:${diaIndex + 2}; background:${cor}; height:${alturaRem}rem;"
                    title="${escapeHtml(r.pacienteNome)} · ${escapeHtml(r.terapeutaNome)} · ${escapeHtml(r.horario)}–${horarioFim}"
                >
                    <span class="block truncate font-semibold">${escapeHtml(r.pacienteNome)}</span>
                    <span class="block truncate opacity-90">${escapeHtml(r.horario)}–${horarioFim}${filtroTerapeuta ? '' : ' · ' + escapeHtml(r.terapeutaNome)}</span>
                </div>
            `;
        });
    });

    html += `</div>`;
    container.innerHTML = html;

    renderGradeLegenda(filtroTerapeuta, ativas);
}

// -----------------------------------------------------------------------
// Cálculo das datas a gerar, a partir de dias da semana + período
// -----------------------------------------------------------------------
function calcularDatasGeracao({ diasSemana, dataInicio, dataFim, semanas }) {
    const inicio = new Date(`${dataInicio}T00:00:00`);

    const limitePorSemanas = new Date(inicio);
    limitePorSemanas.setDate(limitePorSemanas.getDate() + semanas * 7);

    let fim = limitePorSemanas;
    if (dataFim) {
        const dataFimDate = new Date(`${dataFim}T00:00:00`);
        if (dataFimDate < fim) fim = dataFimDate;
    }

    const datas = [];
    const cursor = new Date(inicio);
    while (cursor <= fim) {
        const nomeDia = DIAS_SEMANA[cursor.getDay()];
        if (diasSemana.includes(nomeDia)) {
            datas.push(cursor.toISOString().slice(0, 10));
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return datas;
}

// -----------------------------------------------------------------------
// Lista de recorrências cadastradas (vem do backend agora, não mais de
// sessionStorage) — sem o badge de "previsto(s)", que era só uma prévia de
// criação e não é um dado persistido.
// -----------------------------------------------------------------------
function renderRecorrenciasLista() {
    const container = document.getElementById('recorrencias-lista');
    const empty = document.getElementById('recorrencias-empty');
    const badge = document.getElementById('recorrencias-count-badge');
    if (!container || !empty || !badge) return;

    badge.innerText = `${recorrencias.length} recorrência(s)`;

    if (recorrencias.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    container.innerHTML = recorrencias
        .map((r) => {
            const duracao = r.duracaoMinutos || RECORRENCIA_DURACAO_PADRAO_MINUTOS;
            const horarioFim = addMinutosHorario(r.horario, duracao);
            return `
        <div class="p-4 flex items-center justify-between gap-3 flex-wrap border-t" style="border-color:var(--border)">
            <div>
                <p class="text-sm font-semibold" style="color:var(--ink)">
                    ${escapeHtml(r.pacienteNome)} <span style="color:var(--ink-faint); font-weight:500;">com</span> ${escapeHtml(r.terapeutaNome)}
                </p>
                <p class="text-xs mt-0.5" style="color:var(--ink-soft)">
                    ${r.diasSemana.map((d) => DIAS_SEMANA_ABREV[DIAS_SEMANA.indexOf(d)]).join(', ')} · ${escapeHtml(r.horario)}–${horarioFim} (${duracao} min) ·
                    a partir de ${formatDateBr(r.dataInicio)}${r.dataFim ? ` até ${formatDateBr(r.dataFim)}` : ''}
                </p>
            </div>
            <span class="badge ${r.status === 'Ativa' ? 'badge--ok' : 'badge--neutral'} shrink-0">${escapeHtml(r.status)}</span>
        </div>
    `;
        })
        .join('');
}

async function recarregarRecorrencias() {
    recorrencias = await CadastroApi.fetchRecorrencias();
    renderRecorrenciasLista();
    renderRecorrenciaGrid();
}

// -----------------------------------------------------------------------
// Envio do formulário — grava a recorrência de verdade (/registrar/
// recorrencia) e, com o id devolvido, gera cada atendimento previsto de
// verdade também (um POST /criar/atendimento por data, linkado via
// recorrencia_id). Se algum atendimento individual falhar, os demais
// seguem — o resumo final informa quantos deram certo.
// -----------------------------------------------------------------------
async function handleRecorrenciaSubmit(event) {
    event.preventDefault();

    const pacienteNome = document.getElementById('recorrencia-paciente').value.trim();
    const terapeutaNome = document.getElementById('recorrencia-terapeuta').value.trim();
    const horario = document.getElementById('recorrencia-horario').value;
    const duracaoMinutos = Number(document.getElementById('recorrencia-duracao').value);
    const dataInicio = document.getElementById('recorrencia-data-inicio').value;
    const dataFimInput = document.getElementById('recorrencia-data-fim').value;
    const semanas = Math.max(1, Math.min(26, Number(document.getElementById('recorrencia-semanas').value) || 8));

    if (!pacienteNome || !terapeutaNome) {
        showToast('Selecione um paciente e um terapeuta da lista antes de salvar.', 'error');
        return;
    }
    if (diasSelecionados.size === 0) {
        showToast('Selecione ao menos um dia da semana.', 'error');
        return;
    }
    if (!horario || !dataInicio) {
        showToast('Preencha o horário e a data de início.', 'error');
        return;
    }
    if (!duracaoMinutos || duracaoMinutos < RECORRENCIA_DURACAO_MINIMA_MINUTOS) {
        showToast(`A duração mínima permitida por sessão é de ${RECORRENCIA_DURACAO_MINIMA_MINUTOS} minutos.`, 'error');
        return;
    }

    const diasSemanaArray = [...diasSelecionados];
    const datas = calcularDatasGeracao({
        diasSemana: diasSemanaArray,
        dataInicio,
        dataFim: dataFimInput || null,
        semanas,
    });

    if (datas.length === 0) {
        showToast('Nenhuma data caiu no período informado — confira os dias da semana e o intervalo.', 'error');
        return;
    }
    if (datas.length > RECORRENCIA_MAX_ATENDIMENTOS_POR_VEZ) {
        showToast(
            `Isso previria ${datas.length} atendimentos de uma vez — reduza as semanas ou os dias da semana (limite de ${RECORRENCIA_MAX_ATENDIMENTOS_POR_VEZ} por vez).`,
            'error'
        );
        return;
    }

    const submitButton = document.querySelector('#form-recorrencia button[type="submit"]');
    if (submitButton) submitButton.disabled = true;

    try {
        showToast(`Salvando recorrência e gerando ${datas.length} atendimento(s)...`, 'info');

        const respostaRecorrencia = await CadastroApi.registrarRecorrencia(
            CadastroApi.buildRecorrenciaPayload({
                pacienteNome,
                terapeutaNome,
                horario,
                duracaoMinutos,
                dataInicio,
                dataFim: dataFimInput || null,
                status: 'Ativa',
                diasSemana: diasSemanaArray,
            })
        );

        const recorrenciaId = respostaRecorrencia && respostaRecorrencia.recorrencia && respostaRecorrencia.recorrencia.id;

        let sucessos = 0;
        for (const data of datas) {
            try {
                await CadastroApi.criarAtendimento(
                    CadastroApi.buildAtendimentoPayload({
                        pacienteNome,
                        terapeutaNome,
                        dataHora: `${data}T${horario}:00-03:00`,
                        recorrenciaId,
                    })
                );
                sucessos++;
            } catch (erroAtendimento) {
                console.error(`Falha ao gerar atendimento de ${data}:`, erroAtendimento);
            }
        }

        if (sucessos === datas.length) {
            showToast(`Recorrência salva — ${sucessos} atendimento(s) gerado(s) na agenda.`, 'success');
        } else {
            showToast(
                `Recorrência salva, mas só ${sucessos} de ${datas.length} atendimento(s) foram gerados — confira o console para detalhes.`,
                'error'
            );
        }

        document.getElementById('form-recorrencia').reset();
        document.getElementById('recorrencia-duracao').value = String(RECORRENCIA_DURACAO_PADRAO_MINUTOS);
        diasSelecionados.clear();
        renderDiasSemanaChips();
        await recarregarRecorrencias();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao salvar a recorrência.', 'error');
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

// -----------------------------------------------------------------------
// Inicialização
// -----------------------------------------------------------------------
async function initRecorrenciaTab() {
    diasSelecionados = new Set();
    renderDiasSemanaChips();

    document.getElementById('recorrencia-data-inicio').value = new Date().toISOString().slice(0, 10);

    pacienteAutocompleteRecorrencia = attachAutocomplete(document.getElementById('recorrencia-paciente'), { options: [] });
    terapeutaAutocompleteRecorrencia = attachAutocomplete(document.getElementById('recorrencia-terapeuta'), { options: [] });

    document.getElementById('recorrencia-grade-terapeuta').addEventListener('change', renderRecorrenciaGrid);

    try {
        const [pacientes, terapeutas] = await Promise.all([PacientesApi.fetchPacientes(), UsuariosApi.fetchTerapeutas()]);
        await recarregarRecorrencias();

        const pacienteInput = document.getElementById('recorrencia-paciente');
        if (pacientes.length === 0) {
            pacienteInput.placeholder = 'Nenhum paciente cadastrado';
        } else {
            pacienteAutocompleteRecorrencia.setOptions(pacientes.map((p) => ({ id: p.id, label: p.nome, sublabel: p.planoSaude || '' })));
            pacienteInput.disabled = false;
            pacienteInput.placeholder = 'Digite o nome do paciente...';
        }

        const terapeutaInput = document.getElementById('recorrencia-terapeuta');
        const gradeSelect = document.getElementById('recorrencia-grade-terapeuta');
        if (terapeutas.length === 0) {
            terapeutaInput.placeholder = 'Nenhum terapeuta cadastrado';
        } else {
            terapeutaAutocompleteRecorrencia.setOptions(terapeutas.map((t) => ({ id: t.id, label: t.nome, sublabel: t.especialidade || '' })));
            terapeutaInput.disabled = false;
            terapeutaInput.placeholder = 'Digite o nome do terapeuta...';

            gradeSelect.innerHTML =
                '<option value="">Todos os terapeutas</option>' +
                terapeutas.map((t) => `<option value="${escapeHtml(t.nome)}">${escapeHtml(t.nome)}</option>`).join('');
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao carregar pacientes/terapeutas/recorrências.', 'error');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    initRecorrenciaTab();
});
