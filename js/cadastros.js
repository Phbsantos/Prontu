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

function switchCadastroTab(tab) {
    ['paciente', 'usuario', 'recorrencia'].forEach((t) => {
        document.getElementById(`tab-btn-${t}`).className = t === tab ? 'segmented-btn active' : 'segmented-btn';
        document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab);
    });

    // A grade semanal da aba Recorrência precisa de mais espaço horizontal
    // do que os formulários simples das outras duas abas.
    const main = document.querySelector('main');
    main.classList.toggle('max-w-3xl', tab !== 'recorrencia');
    main.classList.toggle('max-w-6xl', tab === 'recorrencia');
}

async function handlePacienteSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('paciente-submit-btn');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Cadastrando...';
    lucide.createIcons();

    const payload = CadastroApi.buildPacientePayload({
        nomeCompleto: document.getElementById('paciente-nome-completo').value.trim(),
        dataNascimento: document.getElementById('paciente-data-nascimento').value,
        responsavelNome: document.getElementById('paciente-responsavel-nome').value.trim(),
        telefoneWhatsapp: document.getElementById('paciente-telefone-whatsapp').value.trim(),
        status: document.getElementById('paciente-status').value,
        terapeutaResponsavelNome: document.getElementById('paciente-terapeuta-responsavel').value.trim(),
        planoSaude: document.getElementById('paciente-plano-saude').value.trim(),
    });

    try {
        await CadastroApi.registrarPaciente(payload);
        showToast(`Paciente ${payload.nome_completo} cadastrado com sucesso!`, 'success');
        document.getElementById('form-paciente').reset();
        document.getElementById('paciente-status').value = 'Em Acompanhamento';
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao cadastrar paciente.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        lucide.createIcons();
    }
}

async function handleUsuarioSubmit(event) {
    event.preventDefault();
    const submitBtn = document.getElementById('usuario-submit-btn');
    const originalHtml = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i data-lucide="loader-2" class="w-4 h-4 animate-spin"></i> Cadastrando...';
    lucide.createIcons();

    const payload = CadastroApi.buildUsuarioPayload({
        nome: document.getElementById('usuario-nome').value.trim(),
        email: document.getElementById('usuario-email').value.trim(),
        perfilRole: document.getElementById('usuario-perfil-role').value,
        especialidade: document.getElementById('usuario-especialidade').value.trim(),
        status: document.getElementById('usuario-status').value,
        numeroConselho: document.getElementById('usuario-numero-conselho').value.trim(),
        equipeNome: document.getElementById('usuario-equipe').value,
    });

    try {
        await CadastroApi.registrarUsuario(payload);
        showToast(`Usuário ${payload.nome} cadastrado com sucesso!`, 'success');
        document.getElementById('form-usuario').reset();
        document.getElementById('usuario-perfil-role').value = 'Terapeuta';
        document.getElementById('usuario-status').value = 'Ativo';
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao cadastrar usuário.', 'error');
    } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalHtml;
        lucide.createIcons();
    }
}

let terapeutaAutocomplete = null;

async function loadTerapeutasOptions() {
    const input = document.getElementById('paciente-terapeuta-responsavel');

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
    } catch (error) {
        console.error(error);
        input.placeholder = 'Erro ao carregar terapeutas';
        input.disabled = true;
        showToast(error.message || 'Erro ao carregar lista de terapeutas.', 'error');
    }
}

async function loadEquipesOptions() {
    const select = document.getElementById('usuario-equipe');

    try {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_EQUIPES}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Erro ao carregar equipes (${response.status})`);

        const data = await response.json();
        // 2026-09-08: /listar/equipes (backend novo) devolve nome_equipe
        // achatado, sem "fields" pra desembrulhar.
        const equipes = Array.isArray(data) ? data : [];
        const nomes = equipes.map((e) => e.nome_equipe).filter(Boolean);

        nomes.forEach((nome) => {
            const option = document.createElement('option');
            option.value = nome;
            option.textContent = nome;
            select.appendChild(option);
        });
    } catch (error) {
        console.error(error);
        // Falha silenciosa proposital: Equipe é opcional no cadastro, não
        // vale travar a tela inteira por causa disso.
    }
}

// Critério de acesso compartilhado pelos cards administrativos desta
// página (Sugestões de Atendimento, Resetar Senha) — Coordenador ou Admin,
// igual decidido com a Roseane pro card de sugestões (2026-09-17).
function usuarioTemAcessoAdministrativo() {
    const session = AuthApi.getSession();
    return Boolean(session && ['Coordenador', 'Admin'].includes(session.perfilRole));
}

// -----------------------------------------------------------------------
// Card "Sugestões de Atendimento" por paciente — visível só pra
// Coordenador/Admin (2026-09-17). paciente_sugestoes_atendimento é
// individual por paciente, não um modelo por Plano — ver decisão
// registrada no esquema do banco.
// -----------------------------------------------------------------------
let sugestaoBuscaPacienteAutocomplete = null;
let sugestaoPacienteSelecionado = null; // { id, label }

async function renderSugestoesLista() {
    const container = document.getElementById('sugestao-lista');
    const empty = document.getElementById('sugestao-empty');
    if (!container || !empty || !sugestaoPacienteSelecionado) return;

    const sugestoes = await CadastroApi.fetchSugestoesPaciente(sugestaoPacienteSelecionado.id);

    if (sugestoes.length === 0) {
        container.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    container.innerHTML = sugestoes
        .map(
            (s) => `
        <div class="flex items-center justify-between gap-3 px-3 py-2 rounded-lg" style="background:var(--surface-alt)">
            <div class="text-sm">
                <span class="font-semibold" style="color:var(--ink)">${escapeHtml(s.especialidadeNome)}</span>
                <span style="color:var(--ink-soft)"> — ${s.quantidade}x / ${s.periodicidade === 'mensal' ? 'mês' : 'semana'}</span>
                ${s.observacoes ? `<p class="text-xs mt-0.5" style="color:var(--ink-faint)">${escapeHtml(s.observacoes)}</p>` : ''}
            </div>
            <button type="button" onclick="handleRemoverSugestao(${s.id})" class="text-rose-500 hover:text-rose-700 shrink-0" title="Remover">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
        </div>
    `
        )
        .join('');
    lucide.createIcons();
}

async function handleSugestaoSubmit(event) {
    event.preventDefault();
    if (!sugestaoPacienteSelecionado) return;

    const submitBtn = document.getElementById('sugestao-submit-btn');
    submitBtn.disabled = true;

    const payload = CadastroApi.buildSugestaoPayload({
        pacienteId: sugestaoPacienteSelecionado.id,
        especialidadeId: Number(document.getElementById('sugestao-especialidade').value),
        quantidade: Number(document.getElementById('sugestao-quantidade').value),
        periodicidade: document.getElementById('sugestao-periodicidade').value,
        observacoes: document.getElementById('sugestao-observacoes').value.trim(),
    });

    try {
        await CadastroApi.registrarSugestao(payload);
        showToast('Sugestão salva com sucesso.', 'success');
        document.getElementById('sugestao-quantidade').value = '1';
        document.getElementById('sugestao-observacoes').value = '';
        await renderSugestoesLista();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao salvar sugestão.', 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

async function handleRemoverSugestao(id) {
    try {
        await CadastroApi.removerSugestao(id);
        showToast('Sugestão removida.', 'success');
        await renderSugestoesLista();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao remover sugestão.', 'error');
    }
}

async function initCardSugestoesPaciente() {
    const card = document.getElementById('card-sugestoes-paciente');
    if (!card) return;

    if (!CONFIG.FEATURES.sugestoesAtendimento) {
        card.classList.add('hidden');
        return;
    }

    if (!usuarioTemAcessoAdministrativo()) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');

    try {
        const [pacientes, especialidades] = await Promise.all([PacientesApi.fetchPacientes(), CadastroApi.fetchEspecialidades()]);

        const select = document.getElementById('sugestao-especialidade');
        select.innerHTML = especialidades.map((e) => `<option value="${e.id}">${escapeHtml(e.nome)}</option>`).join('');

        sugestaoBuscaPacienteAutocomplete = attachAutocomplete(document.getElementById('sugestao-busca-paciente'), {
            options: pacientes.map((p) => ({ id: p.id, label: p.nome, sublabel: p.planoSaude || '' })),
            onSelect: (opt) => {
                sugestaoPacienteSelecionado = opt;
                document.getElementById('sugestao-paciente-nome').textContent = opt.label;
                document.getElementById('sugestao-card-conteudo').classList.remove('hidden');
                renderSugestoesLista();
            },
        });
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao carregar sugestões de atendimento.', 'error');
    }
}

// -----------------------------------------------------------------------
// Card "Resetar Senha de Usuário" — visível só pra Coordenador/Admin
// (2026-09-17). Não existe fluxo de e-mail nenhum no app: a senha nova é
// gerada ou digitada aqui mesmo, e quem está resetando precisa informar o
// usuário diretamente por fora.
// -----------------------------------------------------------------------
let resetBuscaUsuarioAutocomplete = null;
let resetUsuarioSelecionado = null; // { id, label }

// Exclui caracteres ambíguos (I, l, 1, 0, O) — essa senha costuma ser lida
// em voz alta ou digitada por outra pessoa.
function gerarSenhaAleatoria(tamanho = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint32Array(tamanho);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function handleGerarSenha() {
    document.getElementById('reset-nova-senha').value = gerarSenhaAleatoria();
}

async function handleResetarSenhaSubmit(event) {
    event.preventDefault();
    if (!resetUsuarioSelecionado) return;

    const novaSenha = document.getElementById('reset-nova-senha').value;
    const submitBtn = document.getElementById('reset-submit-btn');
    submitBtn.disabled = true;

    try {
        await CadastroApi.resetarSenhaUsuario(
            CadastroApi.buildResetarSenhaPayload({
                usuarioId: resetUsuarioSelecionado.id,
                novaSenha,
            })
        );
        showToast(`Senha de ${resetUsuarioSelecionado.label} redefinida — informe a nova senha a ela(e).`, 'success');
        document.getElementById('form-resetar-senha').classList.add('hidden');
        document.getElementById('reset-busca-usuario').value = '';
        resetBuscaUsuarioAutocomplete.clear();
        resetUsuarioSelecionado = null;
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao resetar senha.', 'error');
    } finally {
        submitBtn.disabled = false;
    }
}

async function initCardResetarSenha() {
    const card = document.getElementById('card-resetar-senha');
    if (!card) return;

    if (!usuarioTemAcessoAdministrativo()) {
        card.classList.add('hidden');
        return;
    }
    card.classList.remove('hidden');

    try {
        const usuarios = await UsuariosApi.fetchUsuarios();

        resetBuscaUsuarioAutocomplete = attachAutocomplete(document.getElementById('reset-busca-usuario'), {
            options: usuarios.map((u) => ({ id: u.id, label: u.nome, sublabel: u.perfilRole || '' })),
            onSelect: (opt) => {
                resetUsuarioSelecionado = opt;
                document.getElementById('reset-usuario-nome').textContent = opt.label;
                document.getElementById('reset-nova-senha').value = '';
                document.getElementById('form-resetar-senha').classList.remove('hidden');
            },
        });
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao carregar lista de usuários.', 'error');
    }
}

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    terapeutaAutocomplete = attachAutocomplete(document.getElementById('paciente-terapeuta-responsavel'), { options: [] });
    loadTerapeutasOptions();
    loadEquipesOptions();
    initCardSugestoesPaciente();
    initCardResetarSenha();

    // Permite linkar direto pra uma aba, ex: cadastros.html?tab=recorrencia
    // (usado pelo FAB de ações rápidas do Coordenador em coordenacao.html)
    const tabParam = new URLSearchParams(window.location.search).get('tab');
    if (['paciente', 'usuario', 'recorrencia'].includes(tabParam)) {
        switchCadastroTab(tabParam);
    }
});
