const SupervisorApi = {
    formatTimeBrasilia(isoDate) {
        if (!isoDate) return '--:--';
        return new Date(isoDate).toLocaleTimeString('pt-BR', {
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Sao_Paulo',
        });
    },

    formatTimeRange(isoDate, durationMinutes = 45) {
        if (!isoDate) return '--:--';
        const start = new Date(isoDate);
        const end = new Date(start.getTime() + durationMinutes * 60000);
        const format = (date) =>
            date.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo',
            });
        return `${format(start)} - ${format(end)}`;
    },

    getClinicalNotes(fields, status) {
        if (status === 'Realizado') {
            return fields.evolucao_prontuario || 'Sem evolução registrada.';
        }

        if (status === 'Falta sem Aviso' || status?.includes('Desmarcado')) {
            return fields.justificativa_falta || 'Sem justificativa registrada.';
        }

        return fields.evolucao_prontuario || fields.justificativa_falta || 'Sem anotações registradas até o momento.';
    },

    normalizeDisplayStatus(status) {
        if (!status) return 'Agendado';
        if (status.includes('Desmarcado')) return 'Desmarcado';
        return status;
    },

    // 2026-09-08: /listar/atendimentos (backend novo) já devolve tudo
    // achatado e resolvido via JOIN — paciente_nome, terapeuta_id,
    // terapeuta_nome, supervisor_nome já vêm prontos, sem precisar
    // adivinhar se um campo "parece" um record ID do Airtable.
    transformEquipeRecord(record) {
        const status = this.normalizeDisplayStatus(record.status_presenca);

        return {
            id: record.id,
            paciente: record.paciente_nome || 'Paciente não informado',
            terapeuta: record.terapeuta_nome || 'Terapeuta não informado',
            terapeutaId: record.terapeuta_id,
            supervisor: record.supervisor_nome || 'Supervisor não informado',
            especialidade: record.especialidade || 'Multiprofissional',
            horario: this.formatTimeRange(record.data_hora),
            hora: this.formatTimeBrasilia(record.data_hora),
            status,
            prontuario: this.getClinicalNotes(record, record.status_presenca),
            dataHora: record.data_hora,
            sala: record.sala || '',
        };
    },

    // Agenda filtrada por equipe do supervisor: sem endpoint dedicado —
    // reconstruído no cliente a partir de /listar/equipes +
    // /listar/atendimentos, filtrando por ID de terapeuta, não por nome.
    // /listar/equipes já devolve "membros" como array de {id, nome} pronto
    // (json_agg no Postgres, ver db/n8n-workflows/06_listar_equipes.json).
    async fetchEquipeMembroIds(supervisorId) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_EQUIPES}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar equipes (${response.status})`);
        }

        const data = await lerJsonLista(response);
        const equipes = Array.isArray(data) ? data : [];

        const equipe = equipes.find((e) => e.supervisor_id === supervisorId);
        if (!equipe) return [supervisorId];

        const membros = Array.isArray(equipe.membros) ? equipe.membros : [];
        const membroIds = membros.map((m) => m.id);
        return membroIds.length ? membroIds : [supervisorId];
    },

    // Coordenador/Admin não são supervisor de equipe nenhuma (só Juliana e
    // Camila são, hoje) — sem esse caso especial, o filtro de equipe
    // sempre daria 0 pra eles. Decisão: Coordenador/Admin pulam o filtro
    // de equipe e veem tudo aqui também, igual já viam na aba Atendimentos
    // da tela Coordenação.
    VE_TUDO_SEM_FILTRO_DE_EQUIPE: ['Coordenador', 'Admin'],

    async fetchEquipeDia(date) {
        const session = AuthApi.getSession();
        const supervisorId = session && session.id;
        const vePapelSemEquipe = session && this.VE_TUDO_SEM_FILTRO_DE_EQUIPE.includes(session.perfilRole);

        const membroIds = !vePapelSemEquipe && supervisorId ? await this.fetchEquipeMembroIds(supervisorId) : [];

        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.LISTAR_ATENDIMENTOS}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Erro ao carregar agenda da equipe (${response.status})`);
        }

        const data = await lerJsonLista(response);
        const records = Array.isArray(data) ? data : [];

        return records
            .map((record) => this.transformEquipeRecord(record))
            .filter((item) => {
                const matchesEquipe = vePapelSemEquipe || membroIds.includes(item.terapeutaId);
                const matchesData = !date || (item.dataHora || '').slice(0, 10) === date;
                return matchesEquipe && matchesData;
            })
            .sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora));
    },

    async agendarSessaoAvulsa(payload) {
        const url = `${CONFIG.API_BASE}${CONFIG.ENDPOINTS.ATENDIMENTO_CRIAR}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || `Erro ao agendar sessão (${response.status})`);
        }

        const rawText = await response.text().catch(() => '');
        if (!rawText) {
            return { success: true };
        }

        try {
            return JSON.parse(rawText);
        } catch (e) {
            return { success: true };
        }
    },

    buildAgendamentoPayload(formData) {
        const session = AuthApi.getSession();
        return {
            paciente_nome: formData.paciente,
            terapeuta_nome: formData.terapeuta,
            data_hora: `${formData.data}T${formData.hora}:00-03:00`,
            supervisor_nome: (session && session.nome) || '',
            tipo_atendimento: formData.tipo || 'Sessão Extra/Reforço',
        };
    },
};
