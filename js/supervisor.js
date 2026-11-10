let appointmentsData = [];

function getStatusBadgeHTML(status) {
    switch (status) {
        case 'Realizado':
            return `<span class="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        <span>Realizado</span>
                    </span>`;
        case 'Agendado':
            return `<span class="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                        <span>Agendado</span>
                    </span>`;
        case 'Falta sem Aviso':
            return `<span class="inline-flex items-center space-x-1 bg-rose-100 text-rose-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                        <span>Falta sem Aviso</span>
                    </span>`;
        case 'Desmarcado':
            return `<span class="inline-flex items-center space-x-1 bg-slate-100 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span>Desmarcado</span>
                    </span>`;
        default:
            return `<span class="inline-flex items-center space-x-1 bg-blue-100 text-blue-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                        <span>${escapeHtml(status)}</span>
                    </span>`;
    }
}

function renderEquipeLoading() {
    const container = document.getElementById('appointments-container');
    const emptyState = document.getElementById('empty-state');
    emptyState.classList.add('hidden');
    container.classList.remove('hidden');
    container.innerHTML = `
        <div class="col-span-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
            <div class="flex flex-col items-center gap-3 text-slate-500">
                <i class="fa-solid fa-spinner fa-spin text-2xl text-blue-600"></i>
                <p class="text-sm font-medium text-slate-700">Carregando agenda da equipe...</p>
            </div>
        </div>
    `;
}

function renderAppointments(data) {
    const container = document.getElementById('appointments-container');
    const emptyState = document.getElementById('empty-state');
    const showingCount = document.getElementById('showing-count');

    container.innerHTML = '';
    showingCount.innerText = `${data.length} sessões`;

    if (data.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    data.forEach((item) => {
        const card = document.createElement('div');
        card.className =
            'bg-white rounded-2xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-3';

        card.innerHTML = `
            <div>
                <div class="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                    <span class="text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-lg">
                        <i class="fa-regular fa-clock mr-1 text-slate-400"></i> ${escapeHtml(item.horario)}
                    </span>
                    ${getStatusBadgeHTML(item.status)}
                </div>

                <h3 class="font-bold text-slate-800 text-base leading-tight">${escapeHtml(item.paciente)}</h3>

                <div class="mt-2 flex items-center space-x-2">
                    <div class="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                        <i class="fa-solid fa-user-doctor"></i>
                    </div>
                    <div>
                        <p class="text-xs font-semibold text-slate-700 leading-tight">${escapeHtml(item.terapeuta)}</p>
                        <p class="text-[10px] text-slate-400">${escapeHtml(item.especialidade || 'Multiprofissional')}</p>
                    </div>
                </div>
            </div>

            <div class="pt-2 border-t border-slate-100 flex items-center justify-end">
                <button onclick="openProntuario('${escapeJsAttr(item.paciente)}', '${escapeJsAttr(item.terapeuta)}', '${escapeJsAttr(item.status)}', '${escapeJsAttr(item.prontuario)}')" class="w-full sm:w-auto inline-flex items-center justify-center space-x-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 transition-colors">
                    <i class="fa-solid fa-notes-medical text-xs text-blue-600"></i>
                    <span>Ver Prontuário</span>
                </button>
            </div>
        `;
        container.appendChild(card);
    });

    updateKPIs();
}

function updateKPIs() {
    const total = appointmentsData.length;
    const realizados = appointmentsData.filter((a) => a.status === 'Realizado').length;
    const pendentes = appointmentsData.filter((a) => a.status === 'Agendado').length;
    const faltas = appointmentsData.filter(
        (a) => a.status === 'Falta sem Aviso' || a.status === 'Desmarcado'
    ).length;

    document.getElementById('kpi-total').innerText = total;
    document.getElementById('kpi-realizados').innerText = realizados;
    document.getElementById('kpi-pendentes').innerText = pendentes;
    document.getElementById('kpi-faltas').innerText = faltas;

    const pct = total > 0 ? Math.round((realizados / total) * 100) : 0;
    document.getElementById('kpi-realizados-pct').innerText = `${pct}%`;

    const faltasSemAviso = appointmentsData.filter((a) => a.status === 'Falta sem Aviso').length;
    document.getElementById('kpi-faltas-detail').innerHTML =
        faltasSemAviso > 0
            ? `<span class="text-rose-600 font-medium mr-1">${faltasSemAviso} falta${faltasSemAviso > 1 ? 's' : ''}</span><span>sem aviso prévio</span>`
            : '<span>Nenhuma falta registrada</span>';
}

function filterAppointments() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase();
    const statusFilter = document.getElementById('filter-status').value;

    const filtered = appointmentsData.filter((item) => {
        const matchesSearch =
            item.terapeuta.toLowerCase().includes(searchTerm) ||
            item.paciente.toLowerCase().includes(searchTerm);
        const matchesStatus = statusFilter === 'todos' || item.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    renderAppointments(filtered);
}

async function loadEquipeDia() {
    const date = document.getElementById('filter-date').value;
    renderEquipeLoading();

    try {
        appointmentsData = await SupervisorApi.fetchEquipeDia(date);
        filterAppointments();
        updateSearchSuggestions();
    } catch (error) {
        console.error(error);
        appointmentsData = [];
        renderAppointments([]);
        showToast(error.message || 'Erro ao carregar agenda da equipe.', 'error');
    }
}

let equipeSearchAutocomplete = null;

// Sugestões vêm de quem já está na agenda carregada da equipe — paciente
// e terapeuta juntos, já que a busca aqui filtra os dois campos.
function updateSearchSuggestions() {
    if (!equipeSearchAutocomplete) return;

    const vistos = new Set();
    const opcoes = [];

    appointmentsData.forEach((item) => {
        if (item.paciente && !vistos.has(`p:${item.paciente}`)) {
            vistos.add(`p:${item.paciente}`);
            opcoes.push({ id: item.paciente, label: item.paciente, sublabel: 'Paciente' });
        }
        if (item.terapeuta && !vistos.has(`t:${item.terapeuta}`)) {
            vistos.add(`t:${item.terapeuta}`);
            opcoes.push({ id: item.terapeuta, label: item.terapeuta, sublabel: 'Terapeuta' });
        }
    });

    equipeSearchAutocomplete.setOptions(opcoes);
}

let terapeutasCarregados = false;
let pacientesCarregados = false;
let terapeutaAutocomplete = null;
let pacienteAutocomplete = null;

function initTerapeutaAutocomplete() {
    const input = document.getElementById('modal-terapeuta');
    terapeutaAutocomplete = attachAutocomplete(input, { options: [] });
}

function initPacienteAutocomplete() {
    const input = document.getElementById('modal-paciente');
    pacienteAutocomplete = attachAutocomplete(input, { options: [] });
}

async function loadPacientesOptions() {
    const input = document.getElementById('modal-paciente');

    try {
        const pacientes = await PacientesApi.fetchPacientes();

        if (pacientes.length === 0) {
            input.placeholder = 'Nenhum paciente cadastrado';
            input.disabled = true;
            return;
        }

        pacienteAutocomplete.setOptions(
            pacientes.map((p) => ({
                id: p.id,
                label: p.nome,
                sublabel: p.responsavelNome ? `Responsável: ${p.responsavelNome}` : '',
            }))
        );
        input.disabled = false;
        input.placeholder = 'Digite o nome do paciente...';

        pacientesCarregados = true;
    } catch (error) {
        console.error(error);
        input.placeholder = 'Erro ao carregar pacientes';
        input.disabled = true;
        showToast(error.message || 'Erro ao carregar lista de pacientes.', 'error');
    }
}

async function loadTerapeutasOptions() {
    const input = document.getElementById('modal-terapeuta');

    try {
        const terapeutas = await UsuariosApi.fetchTerapeutas();

        if (terapeutas.length === 0) {
            input.placeholder = 'Nenhum terapeuta cadastrado';
            input.disabled = true;
            return;
        }

        terapeutaAutocomplete.setOptions(
            terapeutas.map((t) => ({ id: t.id, label: t.nome, sublabel: t.especialidade || '' }))
        );
        input.disabled = false;
        input.placeholder = 'Digite o nome do terapeuta...';

        terapeutasCarregados = true;
    } catch (error) {
        console.error(error);
        input.placeholder = 'Erro ao carregar terapeutas';
        input.disabled = true;
        showToast(error.message || 'Erro ao carregar lista de terapeutas.', 'error');
    }
}

function openAgendarModal() {
    document.getElementById('modal-agendar').classList.remove('hidden');
    if (!terapeutasCarregados) {
        loadTerapeutasOptions();
    }
    if (!pacientesCarregados) {
        loadPacientesOptions();
    }
}

function closeAgendarModal() {
    document.getElementById('modal-agendar').classList.add('hidden');
}

async function handleAgendamentoSubmit(event) {
    event.preventDefault();

    const submitBtn = document.getElementById('modal-submit-btn');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i><span>Agendando...</span>';

    const payload = SupervisorApi.buildAgendamentoPayload({
        paciente: document.getElementById('modal-paciente').value.trim(),
        terapeuta: document.getElementById('modal-terapeuta').value,
        data: document.getElementById('modal-data').value,
        hora: document.getElementById('modal-hora').value,
        tipo: document.getElementById('modal-tipo').value,
    });

    try {
        await SupervisorApi.agendarSessaoAvulsa(payload);

        closeAgendarModal();
        document.getElementById('form-agendamento').reset();
        document.getElementById('modal-data').value = document.getElementById('filter-date').value;
        showToast(`Agendamento criado para ${payload.paciente_nome}!`);
        await loadEquipeDia();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao confirmar agendamento.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
    }
}

function openProntuario(paciente, terapeuta, status, texto) {
    document.getElementById('prontuario-paciente-nome').innerText = paciente;
    document.getElementById('prontuario-terapeuta').innerText = terapeuta;
    document.getElementById('prontuario-status').innerText = status;
    document.getElementById('prontuario-texto').innerText = texto || 'Sem anotações registradas até o momento.';

    const statusEl = document.getElementById('prontuario-status');
    statusEl.className = 'inline-block px-2 py-0.5 rounded-md font-semibold mt-0.5 ';

    if (status === 'Realizado') {
        statusEl.className += 'bg-emerald-100 text-emerald-800';
    } else if (status === 'Falta sem Aviso') {
        statusEl.className += 'bg-rose-100 text-rose-800';
    } else if (status === 'Agendado') {
        statusEl.className += 'bg-amber-100 text-amber-800';
    } else {
        statusEl.className += 'bg-slate-100 text-slate-700';
    }

    document.getElementById('modal-prontuario').classList.remove('hidden');
}

function closeProntuarioModal() {
    document.getElementById('modal-prontuario').classList.add('hidden');
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');

    toastMessage.innerText = message;

    if (type === 'error') {
        toastIcon.className =
            'w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs';
        toastIcon.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    } else {
        toastIcon.className =
            'w-7 h-7 rounded-full bg-emerald-500 text-slate-900 flex items-center justify-center font-bold text-xs';
        toastIcon.innerHTML = '<i class="fa-solid fa-check"></i>';
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    toast.classList.add('translate-y-0', 'opacity-100');

    setTimeout(() => {
        toast.classList.remove('translate-y-0', 'opacity-100');
        toast.classList.add('translate-y-20', 'opacity-0');
    }, 3500);
}

window.addEventListener('DOMContentLoaded', () => {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('filter-date').value = today;
    document.getElementById('modal-data').value = today;

    document.getElementById('filter-date').addEventListener('change', loadEquipeDia);

    // Convive com o onkeyup="filterAppointments()" já no HTML — a busca ao
    // vivo continua igual, isso só soma a sugestão em dropdown.
    equipeSearchAutocomplete = attachAutocomplete(document.getElementById('search-input'), {
        options: [],
        onSelect: () => filterAppointments(),
    });

    loadEquipeDia();
    initTerapeutaAutocomplete();
    initPacienteAutocomplete();
    loadTerapeutasOptions();
    loadPacientesOptions();
});
