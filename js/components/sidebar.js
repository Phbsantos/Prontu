// Sidebar de navegação compartilhada.
// Antes deste componente, cada página tinha seu próprio <nav> horizontal
// duplicado (5 cópias quase idênticas, com esquema de cor da aba ativa
// divergente entre páginas). Isso substitui todas elas por uma única
// implementação.
//
// Uso: em cada página autenticada, no lugar do <nav> antigo, deixe
//   <aside id="sidebar-root"></aside>
// e no fim do <body>, depois de carregar este script:
//   Sidebar.mount('sidebar-root');
//
// role-guard.js continua funcionando sem alterações: ele procura por
// `nav a[href$=".html"]` para esconder links que o perfil logado não pode
// acessar, e o <nav class="sidebar-nav"> gerado aqui atende esse seletor.
//
// Comportamento responsivo (ver css/theme.css):
// - Desktop (>900px): pode ser colapsado numa trilha só de ícones — o
//   estado fica salvo em localStorage e persiste entre páginas. Passando o
//   mouse num ícone colapsado mostra uma dica com o nome da aba.
// - Mobile (≤900px): vira um menu sobreposto (drawer) que fica escondido
//   fora da tela por padrão; o botão de hambúrguer na topbar (ver
//   components/topbar.js) chama Sidebar.toggleMobile() pra abrir/fechar.
const Sidebar = {
    NAV_ITEMS: [
        { href: 'index.html', label: 'Minha Agenda', icon: 'calendar-check' },
        { href: 'relatorios.html', label: 'Relatórios', icon: 'file-text' },
        { href: 'supervisor.html', label: 'Supervisor', icon: 'users' },
        { href: 'indicadores.html', label: 'Indicadores', icon: 'bar-chart-3' },
        { href: 'coordenacao.html', label: 'Coordenação', icon: 'layout-dashboard' },
        { href: 'cadastros.html', label: 'Cadastros', icon: 'user-plus' },
        { href: 'usuarios.html', label: 'Usuários', icon: 'users-round' },
    ],

    COLLAPSE_KEY: 'prontu_sidebar_collapsed',
    _containerId: null,
    _activeHref: null,
    _mediaQueryBound: false,

    currentPage() {
        return window.location.pathname.split('/').pop() || 'index.html';
    },

    // --- Estado: colapsado (desktop) ---

    isCollapsed() {
        try {
            return localStorage.getItem(this.COLLAPSE_KEY) === '1';
        } catch {
            return false;
        }
    },

    setCollapsed(value) {
        try {
            localStorage.setItem(this.COLLAPSE_KEY, value ? '1' : '0');
        } catch {
            // localStorage indisponível (modo privado etc.) — só não persiste.
        }
    },

    toggleCollapse() {
        this.setCollapsed(!this.isCollapsed());
        this._rerender();
    },

    // --- Estado: aberto como drawer (mobile) ---

    openMobile() {
        document.getElementById(this._containerId)?.classList.add('is-mobile-open');
        document.getElementById('sidebar-backdrop')?.classList.add('is-visible');
    },

    closeMobile() {
        document.getElementById(this._containerId)?.classList.remove('is-mobile-open');
        document.getElementById('sidebar-backdrop')?.classList.remove('is-visible');
    },

    toggleMobile() {
        const container = document.getElementById(this._containerId);
        if (!container) return;
        if (container.classList.contains('is-mobile-open')) this.closeMobile();
        else this.openMobile();
    },

    render(activeHref) {
        const active = activeHref || this.currentPage();
        const collapsed = this.isCollapsed();

        const navHtml = this.NAV_ITEMS.map((item) => {
            const isActive = item.href === active;
            return `
                <a href="${item.href}" class="sidebar-nav-item${isActive ? ' active' : ''}" data-label="${item.label}">
                    <i data-lucide="${item.icon}" class="w-[18px] h-[18px]"></i>
                    <span>${item.label}</span>
                </a>
            `;
        }).join('');

        return `
            <div class="sidebar-inner">
                <div class="sidebar-logo">
                    <div class="sidebar-logo-mark">
                        <i data-lucide="heart-pulse" class="w-5 h-5"></i>
                    </div>
                    <span class="sidebar-logo-word">Prontu</span>
                </div>

                <button
                    type="button"
                    class="sidebar-nav-item sidebar-collapse-toggle w-full text-left"
                    data-label="${collapsed ? 'Expandir menu' : 'Recolher menu'}"
                    onclick="Sidebar.toggleCollapse()"
                    style="border:none;background:none;cursor:pointer;"
                >
                    <i data-lucide="${collapsed ? 'panel-left-open' : 'panel-left-close'}" class="w-[18px] h-[18px]"></i>
                    <span>${collapsed ? 'Expandir menu' : 'Recolher menu'}</span>
                </button>

                <p class="sidebar-section-label">Menu</p>
                <nav class="sidebar-nav">
                    ${navHtml}
                </nav>

                <div class="sidebar-footer">
                    <p class="sidebar-section-label">Geral</p>
                    <button onclick="AuthApi.logout()" class="sidebar-nav-item w-full text-left" data-label="Sair" style="border:none;background:none;cursor:pointer;">
                        <i data-lucide="log-out" class="w-[18px] h-[18px]"></i>
                        <span>Sair</span>
                    </button>
                </div>
            </div>
        `;
    },

    mount(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        this._containerId = containerId;
        this._activeHref = options.active;

        container.className = `sidebar${this.isCollapsed() ? ' is-collapsed' : ''}`;
        container.innerHTML = this.render(options.active);

        this._ensureBackdrop();
        this._ensureResponsiveHandlers();

        if (window.lucide) lucide.createIcons();
    },

    // Reconstrói só o conteúdo (mantendo o mesmo container) — usado depois
    // de alternar o colapso, pra trocar o ícone/rótulo do próprio botão.
    _rerender() {
        const container = document.getElementById(this._containerId);
        if (!container) return;

        container.classList.toggle('is-collapsed', this.isCollapsed());
        container.innerHTML = this.render(this._activeHref);

        if (window.lucide) lucide.createIcons();
    },

    _ensureBackdrop() {
        if (document.getElementById('sidebar-backdrop')) return;

        const backdrop = document.createElement('div');
        backdrop.id = 'sidebar-backdrop';
        backdrop.className = 'sidebar-backdrop';
        backdrop.addEventListener('click', () => this.closeMobile());
        document.body.appendChild(backdrop);
    },

    // Se a tela crescer pra desktop enquanto o drawer mobile está aberto,
    // fecha ele — senão ficaria "aberto" escondido atrás do layout normal.
    _ensureResponsiveHandlers() {
        if (this._mediaQueryBound) return;
        this._mediaQueryBound = true;

        const mediaQuery = window.matchMedia('(max-width: 900px)');
        const handleChange = () => {
            if (!mediaQuery.matches) this.closeMobile();
        };
        if (mediaQuery.addEventListener) mediaQuery.addEventListener('change', handleChange);
        else mediaQuery.addListener(handleChange);
    },
};
