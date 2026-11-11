const UsuariosApi = {
    // 2026-09-08: /listar/usuarios (backend novo) já devolve equipe_nome
    // pronto via JOIN — sem lookup Airtable pra resolver.
    transformUsuario(record) {
        return {
            id: record.id,
            nome: record.nome || '',
            email: record.email || '',
            perfilRole: record.perfil_role || '',
            especialidadeId: record.especialidade_id ?? null,
            especialidade: record.especialidade || '',
            numeroConselho: record.numero_conselho || '',
            equipeId: record.equipe_id ?? null,
            equipeNome: record.equipe_nome || '',
            status: record.status || 'Ativo',
        };
    },

    async fetchUsuarios() {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_USUARIOS}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar usuários (${response.status})`);
        }

        const data = await lerJsonLista(response);
        const records = Array.isArray(data) ? data : [];
        return records.map((record) => this.transformUsuario(record));
    },

    // Edição de um usuário existente (2026-09-17, tela usuarios.html) --
    // especialidadeId/equipeId vão direto (null limpa o campo de
    // propósito, ver 27_editar_usuario.json).
    async editarUsuario({ id, nome, perfilRole, especialidadeId, equipeId, status }) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.USUARIO_EDITAR}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id,
                nome,
                perfil_role: perfilRole,
                especialidade_id: especialidadeId,
                equipe_id: equipeId,
                status,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao editar usuário (${response.status})`);
        }

        return response.json();
    },

    // /listar/terapeutas não existe — só /listar/usuarios (todos os
    // perfis). Buscamos tudo e filtramos aqui. Supervisor entra na lista
    // porque, no modelo, supervisor também é terapeuta (só tem permissão
    // extra) — ver decisão registrada no esquema da base.
    async fetchTerapeutas() {
        const usuarios = await this.fetchUsuarios();
        return usuarios
            .filter((u) => u.nome && u.status !== 'Inativo' && ['Terapeuta', 'Supervisor'].includes(u.perfilRole))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },
};
