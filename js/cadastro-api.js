const CadastroApi = {
    async postJson(url, payload) {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro na requisição (${response.status})`);
        }

        const contentType = response.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            return response.json();
        }

        return { success: true };
    },

    // formData.senha / numeroConselho / equipeNome ainda não têm campo no
    // formulário de cadastros.html (só nome, email, perfil, especialidade,
    // status hoje) — aceitos aqui como opcionais pra quando a UI adicionar.
    //
    // 2026-09-08: equipe_nome agora resolve de verdade pro equipe_id do
    // usuário criado — corrigido no workflow novo (n8n local + Postgres,
    // ver db/n8n-workflows/07_registrar_usuario.json), que resolve por
    // subquery SQL em vez de depender do Airtable resolver o link sozinho.
    buildUsuarioPayload(formData) {
        return {
            nome: formData.nome,
            email: formData.email,
            senha: formData.senha || '',
            perfil_role: formData.perfilRole,
            especialidade: formData.especialidade,
            numero_conselho: formData.numeroConselho || '',
            equipe_nome: formData.equipeNome || null,
            status: formData.status,
        };
    },

    async registrarUsuario(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.USUARIO_REGISTRAR}`;
        return this.postJson(url, payload);
    },

    // formData.planoSaude ainda não tem campo em cadastros.html — aceito
    // aqui como opcional pra quando a UI adicionar.
    //
    // 2026-09-08: terapeuta_responsavel_nome idem — resolve de verdade
    // agora (mesma correção do workflow novo, ver
    // db/n8n-workflows/08_registrar_paciente.json).
    buildPacientePayload(formData) {
        return {
            nome_completo: formData.nomeCompleto,
            data_nascimento: formData.dataNascimento,
            responsavel_nome: formData.responsavelNome,
            telefone_whatsapp: formData.telefoneWhatsapp,
            plano_saude: formData.planoSaude || null,
            status: formData.status,
            terapeuta_responsavel_nome: formData.terapeutaResponsavelNome,
        };
    },

    async registrarPaciente(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.PACIENTE_REGISTRAR}`;
        return this.postJson(url, payload);
    },

    // /registrar/relatorio resolve paciente_nome/autor_nome/editado_por_nome
    // pra FK de verdade. Sem UI ainda em relatorios.html — só a função de
    // API por enquanto. Campos de fechamento de atendimento (status_presenca,
    // justificativa_falta, nivel_engajamento, recomendacao_pos_sessao) não
    // entram aqui — ver ApiService.buildRegisterPayload (js/api.js) pro
    // fluxo real de fechamento usado em index.html/supervisor.html.
    buildRelatorioPayload(formData) {
        return {
            tipo: formData.tipo,
            paciente_nome: formData.pacienteNome,
            atendimento_id: formData.atendimentoId || null,
            autor_nome: formData.autorNome,
            data: formData.data,
            conteudo: formData.conteudo,
            editado_por_nome: formData.editadoPorNome || null,
        };
    },

    async registrarRelatorio(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.RELATORIO_REGISTRAR}`;
        return this.postJson(url, payload);
    },

    // /criar/atendimento — testado e funcionando (ver
    // SupervisorApi.agendarSessaoAvulsa). Centralizado aqui pra ser
    // reaproveitado por qualquer tela que precise criar um atendimento real
    // (ex: geração de atendimentos a partir de uma Recorrência, ver
    // js/recorrencia.js). recorrenciaId é opcional — quando vem de uma
    // recorrência, linka o atendimento gerado a ela de verdade
    // (recorrencia_id, ver db/n8n-workflows/10_criar_atendimento.json).
    buildAtendimentoPayload(formData) {
        return {
            paciente_nome: formData.pacienteNome,
            terapeuta_nome: formData.terapeutaNome,
            data_hora: formData.dataHora,
            supervisor_nome: formData.supervisorNome || '',
            tipo_atendimento: formData.tipoAtendimento || 'Sessão Regular',
            recorrencia_id: formData.recorrenciaId || null,
        };
    },

    async criarAtendimento(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ATENDIMENTO_CRIAR}`;
        return this.postJson(url, payload);
    },

    // Recorrência (2026-09-17): virou tabela de verdade com endpoint
    // próprio (antes era session-only, ver db/n8n-workflows/
    // 11_listar_recorrencias.json e 12_registrar_recorrencia.json). O
    // endpoint só grava a recorrência em si (paciente/terapeuta/horário/
    // dias da semana/período) — gerar os atendimentos de fato ainda é
    // responsabilidade do chamador, um a um via criarAtendimento acima,
    // passando o id devolvido aqui como recorrenciaId (ver
    // js/recorrencia.js).
    buildRecorrenciaPayload(formData) {
        return {
            paciente_nome: formData.pacienteNome,
            terapeuta_nome: formData.terapeutaNome,
            horario: formData.horario,
            duracao_minutos: formData.duracaoMinutos || null,
            data_inicio: formData.dataInicio,
            data_fim: formData.dataFim || null,
            status: formData.status || 'Ativa',
            dias_semana: formData.diasSemana,
        };
    },

    async registrarRecorrencia(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.RECORRENCIA_REGISTRAR}`;
        return this.postJson(url, payload);
    },

    transformRecorrencia(record) {
        return {
            id: record.id,
            pacienteId: record.paciente_id,
            pacienteNome: record.paciente_nome,
            terapeutaId: record.terapeuta_id,
            terapeutaNome: record.terapeuta_nome,
            // Postgres devolve TIME como "HH:MM:SS" — a UI trabalha com
            // "HH:MM" (mesmo formato do <input type="time">).
            horario: (record.horario || '').slice(0, 5),
            duracaoMinutos: record.duracao_minutos,
            dataInicio: record.data_inicio,
            dataFim: record.data_fim,
            status: record.status,
            diasSemana: record.dias_semana || [],
        };
    },

    async fetchRecorrencias() {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_RECORRENCIAS}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar recorrências (${response.status})`);
        }

        const data = await lerJsonLista(response);
        const records = Array.isArray(data) ? data : [];
        return records.map((record) => this.transformRecorrencia(record));
    },

    async fetchEspecialidades() {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_ESPECIALIDADES}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar especialidades (${response.status})`);
        }

        const data = await lerJsonLista(response);
        return Array.isArray(data) ? data : [];
    },

    // Sugestão de atendimento por paciente (2026-09-17): card do paciente em
    // cadastros.html, visível só pra Coordenador/Admin (ver js/cadastros.js).
    // paciente_id/especialidade_id vêm direto da UI (autocomplete/select já
    // resolvidos em ID), diferente de outros cadastros que ainda resolvem
    // por nome — aqui a tela sempre tem o ID à mão.
    transformSugestao(record) {
        return {
            id: record.id,
            pacienteId: record.paciente_id,
            pacienteNome: record.paciente_nome,
            especialidadeId: record.especialidade_id,
            especialidadeNome: record.especialidade_nome,
            quantidade: record.quantidade,
            periodicidade: record.periodicidade,
            observacoes: record.observacoes || '',
        };
    },

    async fetchSugestoesPaciente(pacienteId) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_SUGESTOES_ATENDIMENTO}?paciente_id=${encodeURIComponent(pacienteId)}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar sugestões (${response.status})`);
        }

        const data = await lerJsonLista(response);
        const records = Array.isArray(data) ? data : [];
        return records.map((record) => this.transformSugestao(record));
    },

    buildSugestaoPayload(formData) {
        return {
            paciente_id: formData.pacienteId,
            especialidade_id: formData.especialidadeId,
            quantidade: formData.quantidade,
            periodicidade: formData.periodicidade,
            observacoes: formData.observacoes || '',
        };
    },

    async registrarSugestao(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.SUGESTAO_ATENDIMENTO_REGISTRAR}`;
        return this.postJson(url, payload);
    },

    async removerSugestao(id) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.SUGESTAO_ATENDIMENTO_REMOVER}?id=${encodeURIComponent(id)}`;
        const response = await fetch(url, { method: 'DELETE' });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao remover sugestão (${response.status})`);
        }

        return response.json().catch(() => ({ sucesso: true }));
    },

    // Resetar senha (2026-09-17): card em cadastros.html (Usuário), só
    // Coordenador/Admin (ver js/cadastros.js). A senha nova é gerada ou
    // digitada na UI e enviada em texto puro só nesta chamada — o backend
    // já grava como hash (pgcrypto), nunca fica salva em claro em lugar
    // nenhum, igual o cadastro normal de usuário.
    buildResetarSenhaPayload(formData) {
        return {
            usuario_id: formData.usuarioId,
            nova_senha: formData.novaSenha,
        };
    },

    async resetarSenhaUsuario(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.USUARIO_RESETAR_SENHA}`;
        return this.postJson(url, payload);
    },
};
