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

// Tela de gerenciar usuários (2026-09-17) -- Coordenador/Admin (ver
// js/role-guard.js). Lista todo mundo com filtro/busca, edita perfil/
// especialidade/equipe/status de um usuário existente e reseta senha,
// tudo no mesmo lugar. Cadastro de usuário novo continua em
// cadastros.html > Usuário (link "Novo Usuário" acima da tabela).
let todosUsuarios = [];
let especialidadesDisponiveis = [];
let equipesDisponiveis = [];
let editandoUsuarioId = null;
let resetandoUsuario = null; // { id, nome }

async function fetchEquipesRaw() {
    const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_EQUIPES}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Erro ao carregar equipes (${response.status})`);
    const data = await response.json();
    return Array.isArray(data) ? data : [];
}

function badgePerfilClass(perfilRole) {
    if (perfilRole === 'Admin' || perfilRole === 'Coordenador') return 'badge--ok';
    if (perfilRole === 'Supervisor') return 'badge--brand';
    return 'badge--neutral';
}

function getUsuarioFilters() {
    return {
        busca: document.getElementById('filter-usuario-busca').value.trim().toLowerCase(),
        perfil: document.getElementById('filter-usuario-perfil').value,
        status: document.getElementById('filter-usuario-status').value,
    };
}

function applyUsuarioFilters(usuarios, filters) {
    return usuarios.filter((u) => {
        if (filters.busca && !`${u.nome} ${u.email}`.toLowerCase().includes(filters.busca)) return false;
        if (filters.perfil && u.perfilRole !== filters.perfil) return false;
        if (filters.status && u.status !== filters.status) return false;
        return true;
    });
}

function clearUsuarioFilters() {
    document.getElementById('filterFormUsuarios').reset();
    renderUsuariosTabela();
}

function renderUsuariosTabela() {
    const filters = getUsuarioFilters();
    const filtered = applyUsuarioFilters(todosUsuarios, filters).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

    const tbody = document.getElementById('usuarios-tbody');
    const empty = document.getElementById('usuarios-empty');
    const countBadge = document.getElementById('usuarios-count-badge');

    countBadge.innerText = `${filtered.length} usuário(s)`;

    if (filtered.length === 0) {
        tbody.innerHTML = '';
        empty.classList.remove('hidden');
        return;
    }

    empty.classList.add('hidden');
    tbody.innerHTML = filtered
        .map(
            (u) => `
        <tr class="border-t" style="border-color:var(--border)">
            <td class="px-4 py-3 font-semibold" style="color:var(--ink)">${escapeHtml(u.nome)}</td>
            <td class="px-4 py-3" style="color:var(--ink-soft)">${escapeHtml(u.email)}</td>
            <td class="px-4 py-3"><span class="badge ${badgePerfilClass(u.perfilRole)}">${escapeHtml(u.perfilRole)}</span></td>
            <td class="px-4 py-3" style="color:var(--ink-soft)">${escapeHtml(u.especialidade) || '—'}</td>
            <td class="px-4 py-3" style="color:var(--ink-soft)">${escapeHtml(u.equipeNome) || '—'}</td>
            <td class="px-4 py-3"><span class="badge ${u.status === 'Ativo' ? 'badge--ok' : 'badge--danger'}">${escapeHtml(u.status)}</span></td>
            <td class="px-4 py-3 text-right">
                <div class="flex items-center justify-end gap-1">
                    <button type="button" onclick="openEditarUsuarioModal(${u.id})" class="btn-icon" style="width:1.75rem;height:1.75rem;" title="Editar usuário">
                        <i data-lucide="pencil" class="w-3.5 h-3.5"></i>
                    </button>
                    <button type="button" onclick="openResetarSenhaUsuarioModal(${u.id})" class="btn-icon" style="width:1.75rem;height:1.75rem;" title="Resetar senha">
                        <i data-lucide="key-round" class="w-3.5 h-3.5"></i>
                    </button>
                </div>
            </td>
        </tr>
    `
        )
        .join('');
    lucide.createIcons();
}

function preencherSelectsCadastro() {
    const especialidadeSelect = document.getElementById('editar-usuario-especialidade');
    especialidadeSelect.innerHTML =
        '<option value="">Nenhuma</option>' +
        especialidadesDisponiveis.map((e) => `<option value="${e.id}">${escapeHtml(e.nome)}</option>`).join('');

    const equipeSelect = document.getElementById('editar-usuario-equipe');
    equipeSelect.innerHTML =
        '<option value="">Sem equipe</option>' +
        equipesDisponiveis.map((e) => `<option value="${e.id}">${escapeHtml(e.nome_equipe)}</option>`).join('');
}

function findUsuarioById(id) {
    return todosUsuarios.find((u) => u.id === id);
}

function openEditarUsuarioModal(id) {
    const usuario = findUsuarioById(id);
    if (!usuario) return;

    editandoUsuarioId = id;

    document.getElementById('modal-editar-usuario-email').innerText = usuario.email;
    document.getElementById('editar-usuario-nome').value = usuario.nome;
    document.getElementById('editar-usuario-perfil').value = usuario.perfilRole;
    document.getElementById('editar-usuario-status').value = usuario.status;
    document.getElementById('editar-usuario-especialidade').value = usuario.especialidadeId || '';
    document.getElementById('editar-usuario-equipe').value = usuario.equipeId || '';

    document.getElementById('modal-editar-usuario').classList.remove('hidden');
    lucide.createIcons();
}

function closeEditarUsuarioModal() {
    document.getElementById('modal-editar-usuario').classList.add('hidden');
    editandoUsuarioId = null;
}

async function handleEditarUsuarioSubmit(event) {
    event.preventDefault();
    if (!editandoUsuarioId) return;

    const especialidadeValue = document.getElementById('editar-usuario-especialidade').value;
    const equipeValue = document.getElementById('editar-usuario-equipe').value;

    try {
        await UsuariosApi.editarUsuario({
            id: editandoUsuarioId,
            nome: document.getElementById('editar-usuario-nome').value.trim(),
            perfilRole: document.getElementById('editar-usuario-perfil').value,
            especialidadeId: especialidadeValue ? Number(especialidadeValue) : null,
            equipeId: equipeValue ? Number(equipeValue) : null,
            status: document.getElementById('editar-usuario-status').value,
        });

        closeEditarUsuarioModal();
        showToast('Usuário atualizado com sucesso.', 'success');
        await loadUsuariosDados();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao editar usuário.', 'error');
    }
}

// Exclui caracteres ambíguos (I, l, 1, 0, O) — essa senha costuma ser lida
// em voz alta ou digitada por outra pessoa (mesmo gerador de
// cadastros.js/gerarSenhaAleatoria).
function gerarSenhaAleatoriaUsuario(tamanho = 10) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint32Array(tamanho);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}

function handleGerarSenhaUsuario() {
    document.getElementById('resetar-senha-usuario-valor').value = gerarSenhaAleatoriaUsuario();
}

function openResetarSenhaUsuarioModal(id) {
    const usuario = findUsuarioById(id);
    if (!usuario) return;

    resetandoUsuario = { id: usuario.id, nome: usuario.nome };
    document.getElementById('modal-resetar-senha-nome').innerText = usuario.nome;
    document.getElementById('resetar-senha-usuario-valor').value = '';

    document.getElementById('modal-resetar-senha-usuario').classList.remove('hidden');
    lucide.createIcons();
}

function closeResetarSenhaUsuarioModal() {
    document.getElementById('modal-resetar-senha-usuario').classList.add('hidden');
    resetandoUsuario = null;
}

async function handleResetarSenhaUsuarioSubmit(event) {
    event.preventDefault();
    if (!resetandoUsuario) return;

    const novaSenha = document.getElementById('resetar-senha-usuario-valor').value;

    try {
        await CadastroApi.resetarSenhaUsuario(
            CadastroApi.buildResetarSenhaPayload({ usuarioId: resetandoUsuario.id, novaSenha })
        );
        showToast(`Senha de ${resetandoUsuario.nome} redefinida — informe a nova senha a ela(e).`, 'success');
        closeResetarSenhaUsuarioModal();
    } catch (error) {
        console.error(error);
        showToast(error.message || 'Erro ao resetar senha.', 'error');
    }
}

async function loadUsuariosDados() {
    const loading = document.getElementById('usuarios-loading');
    const content = document.getElementById('usuarios-content');
    const errorState = document.getElementById('usuarios-error');

    loading.classList.remove('hidden');
    content.classList.add('hidden');
    errorState.classList.add('hidden');

    try {
        const [usuarios, especialidades, equipes] = await Promise.all([
            UsuariosApi.fetchUsuarios(),
            CadastroApi.fetchEspecialidades(),
            fetchEquipesRaw(),
        ]);

        todosUsuarios = usuarios;
        especialidadesDisponiveis = especialidades;
        equipesDisponiveis = equipes;

        preencherSelectsCadastro();
        renderUsuariosTabela();

        loading.classList.add('hidden');
        content.classList.remove('hidden');
    } catch (error) {
        console.error(error);
        loading.classList.add('hidden');
        errorState.classList.remove('hidden');
        document.getElementById('usuarios-error-message').innerText =
            error.message || 'Não foi possível carregar os usuários.';
        showToast(error.message || 'Erro ao carregar dados.', 'error');
    } finally {
        lucide.createIcons();
    }
}

window.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    document.getElementById('refresh-btn')?.addEventListener('click', loadUsuariosDados);
    document.getElementById('filterFormUsuarios')?.addEventListener('submit', (e) => {
        e.preventDefault();
        renderUsuariosTabela();
    });
    document.getElementById('filter-usuario-perfil')?.addEventListener('change', renderUsuariosTabela);
    document.getElementById('filter-usuario-status')?.addEventListener('change', renderUsuariosTabela);
    document.getElementById('filter-usuario-busca')?.addEventListener('input', renderUsuariosTabela);

    loadUsuariosDados();
});
