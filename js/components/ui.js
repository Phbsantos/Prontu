// Escape de HTML compartilhado — escapa & < > " ' (as aspas importam: sem elas
// um valor com " quebra atributos como value="..." e vira injeção de HTML).
// Use SEMPRE que um dado vindo da API/usuário entrar em innerHTML/template HTML.
// Texto puro (textContent/innerText/.value) não precisa de escape.
function escapeHtml(text) {
    return String(text ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Para texto livre dentro de um handler inline: onclick="fn('${escapeJsAttr(x)}')".
// Ordem importa: primeiro escapa pra string JS (barra invertida, aspa simples e
// quebras de linha), depois pra HTML — o navegador decodifica o atributo antes
// de executar o JS.
function escapeJsAttr(text) {
    const js = String(text ?? '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/\r?\n/g, '\\n');
    return escapeHtml(js);
}

// Pequenos construtores de HTML reaproveitados entre páginas — hoje só o
// cartão de estatística do estilo dashboard (usado em index.html; dá pra
// reusar em coordenacao.html quando os indicadores agregados existirem).
//
// Uso:
//   document.getElementById('stats-root').innerHTML = [
//       UI.statCard({ id: 'stat-total', label: 'Agendados Hoje', icon: 'users', accent: true }),
//       UI.statCard({ id: 'stat-completed', label: 'Realizados', icon: 'check-circle-2' }),
//   ].join('');
//   lucide.createIcons();
//
// Importante: `trend` só deve ser passado quando houver um número real por
// trás (ex: comparação com um período anterior calculado de verdade) — não
// inventamos "↑ aumentou desde o mês passado" só porque fica bonito.
const UI = {
    statCard({ id, label, icon, initialValue = '0', accent = false, trend = '' }) {
        const cardClass = `stat-card${accent ? ' stat-card--accent' : ''}`;

        return `
            <div class="${cardClass}">
                <div class="stat-card-top">
                    <p class="stat-card-label">${label}</p>
                    <div class="stat-card-icon-btn">
                        <i data-lucide="${icon}" class="w-4 h-4"></i>
                    </div>
                </div>
                <p id="${id}" class="stat-card-value">${initialValue}</p>
                ${trend ? `<p class="stat-card-trend"><i data-lucide="trending-up" class="w-3.5 h-3.5"></i> ${trend}</p>` : ''}
            </div>
        `;
    },

    badge(text, variant = 'neutral') {
        return `<span class="badge badge--${variant}">${text}</span>`;
    },
};
