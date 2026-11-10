// 2026-08-26: /listar/relatorios passou a devolver a tabela Relatorios de
// verdade (Tipo: Evolução/Avulso), não mais uma cópia de Atendimentos
// (Status_Presenca: Realizado/Falta/Desmarcado). O badge agora reflete o
// Tipo do relatório, não mais o status de presença da sessão.
const tipoConfig = {
    'Evolução': {
        classes: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        icon: 'ph-notebook',
    },
    Avulso: {
        classes: 'bg-sky-50 text-sky-700 border-sky-200',
        icon: 'ph-note-pencil',
    },
};

const container = document.getElementById('recordsContainer');
const emptyState = document.getElementById('emptyState');
const countBadge = document.getElementById('resultsCount');
const filterForm = document.getElementById('filterForm');
const clearBtn = document.getElementById('clearBtn');
const nameInput = document.getElementById('patientName');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const submitBtn = filterForm.querySelector('button[type="submit"]');

function getTipoConfig(tipo) {
    return tipoConfig[tipo] || tipoConfig['Evolução'];
}

function createRecordCard(record) {
    const config = getTipoConfig(record.tipo);

    return `
        <article class="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
            <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
                <div>
                    <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                        ${escapeHtml(record.patientName)}
                    </h3>
                    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-slate-600">
                        <span class="flex items-center gap-1">
                            <i class="ph ph-user-md text-slate-400"></i>
                            ${escapeHtml(record.authorName)}
                        </span>
                        <span class="flex items-center gap-1">
                            <i class="ph ph-calendar-blank text-slate-400"></i>
                            ${escapeHtml(record.date)}
                        </span>
                    </div>
                </div>

                <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium ${config.classes} self-start">
                    <i class="ph ${config.icon} text-lg"></i>
                    ${escapeHtml(record.tipo)}
                </div>
            </div>

            <hr class="border-slate-100 my-3">

            <div class="text-slate-700 text-sm leading-relaxed whitespace-pre-line">
                <strong class="text-slate-800 font-semibold mb-1 block text-xs uppercase tracking-wider">Conteúdo:</strong>
                ${escapeHtml(record.conteudo)}
                ${record.editadoPor ? `<p class="text-xs text-slate-400 mt-2">Editado por ${escapeHtml(record.editadoPor)}</p>` : ''}
            </div>
        </article>
    `;
}

function renderLoadingState() {
    container.innerHTML = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
            <div class="flex flex-col items-center justify-center gap-3 text-slate-500">
                <i class="ph ph-spinner text-3xl animate-spin text-blue-600"></i>
                <p class="text-sm font-medium text-slate-700">Carregando prontuários...</p>
            </div>
        </div>
    `;
    container.classList.remove('hidden');
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');
    countBadge.textContent = '...';
}

function renderRecords(dataToRender) {
    container.innerHTML = '';

    if (dataToRender.length === 0) {
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
        emptyState.classList.add('flex');
    } else {
        emptyState.classList.add('hidden');
        emptyState.classList.remove('flex');
        container.classList.remove('hidden');
        container.innerHTML = dataToRender.map(createRecordCard).join('');
    }

    countBadge.textContent = dataToRender.length;
}

function setSubmitLoading(isLoading) {
    if (isLoading) {
        submitBtn.dataset.originalHtml = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="ph ph-spinner animate-spin text-lg"></i> Buscando...';
        submitBtn.disabled = true;
        return;
    }

    submitBtn.innerHTML = submitBtn.dataset.originalHtml || '<i class="ph ph-magnifying-glass text-lg"></i> Buscar';
    submitBtn.disabled = false;
}

function getFiltersFromForm() {
    return {
        paciente_nome: nameInput.value,
        data_inicio: startDateInput.value,
        data_fim: endDateInput.value,
    };
}

async function loadRelatorios(filters = {}) {
    renderLoadingState();
    setSubmitLoading(true);

    try {
        const records = await RelatoriosApi.fetchRelatorios(filters);
        renderRecords(records);
    } catch (error) {
        console.error(error);
        renderRecords([]);
        container.classList.remove('hidden');
        container.innerHTML = `
            <div class="bg-white rounded-xl shadow-sm border border-red-200 p-6 text-center">
                <p class="text-red-700 text-sm font-medium">${escapeHtml(error.message || 'Não foi possível carregar os prontuários.')}</p>
            </div>
        `;
        countBadge.textContent = '0';
    } finally {
        setSubmitLoading(false);
    }
}

filterForm.addEventListener('submit', (e) => {
    e.preventDefault();
    loadRelatorios(getFiltersFromForm());
});

clearBtn.addEventListener('click', () => {
    filterForm.reset();
    loadRelatorios();
});

// Sugestão em dropdown por cima do campo de busca — convive com o filtro
// normal do formulário (que só roda ao clicar "Buscar"); escolher uma
// sugestão já dispara a busca na hora.
let patientNameAutocomplete = null;

async function loadPacienteSuggestions() {
    try {
        const pacientes = await PacientesApi.fetchPacientes();
        patientNameAutocomplete.setOptions(
            pacientes.map((p) => ({ id: p.id, label: p.nome, sublabel: p.planoSaude || '' }))
        );
    } catch (error) {
        console.error(error);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    patientNameAutocomplete = attachAutocomplete(nameInput, {
        options: [],
        onSelect: () => loadRelatorios(getFiltersFromForm()),
    });
    loadPacienteSuggestions();

    loadRelatorios();
});
