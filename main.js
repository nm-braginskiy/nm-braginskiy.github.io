const app = document.getElementById('app');

const HOME_HTML = `
    <div class="home-card">
        <img src="assets/icons/bin.svg" class="home-icon" alt="Logo">
        <h1>Logic Solver</h1>
        <p>инструмент для дискретной математики</p>
        <a class="btn-start" onclick="navigate('/logic_solver')">Запустить решатель</a>
    </div>
`;

// Кэш
let solverCache = null;
let solverScriptsLoaded = false;

const SOLVER_SCRIPTS = [
    'logic_solver/tokenizer.js',
    'logic_solver/parser.js',
    'logic_solver/simplifier.js',
    'logic_solver/ui.js',
    'logic_solver/test.js'
];

// Предзагрузка HTML решателя (стартует сразу, не блокирует)
const solverPreload = fetch('logic_solver/index.html')
    .then(r => r.text())
    .then(text => {
        const doc = new DOMParser().parseFromString(text, 'text/html');
        const container = doc.querySelector('.container');
        solverCache = container ? container.outerHTML : '';
    })
    .catch(() => {});

function loadScripts(srcs) {
    return srcs.reduce((chain, src) => {
        return chain.then(() => new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = src;
            s.onload = resolve;
            s.onerror = reject;
            document.body.appendChild(s);
        }));
    }, Promise.resolve());
}

// Навигация с анимацией
function navigate(path) {
    if (window.location.pathname === path) return;
    app.classList.remove('fade-in');
    app.classList.add('fade-out');

    setTimeout(() => {
        window.history.pushState({}, '', path);
        renderRoute();
    }, 300);
}

// Рендер текущего маршрута
async function renderRoute() {
    const path = window.location.pathname;

    app.classList.remove('fade-out', 'fade-in', 'solver-active');

    if (path === '/logic_solver') {
        // Ждём предзагрузку, если ещё не готова
        await solverPreload;

        app.innerHTML = solverCache;
        app.classList.add('solver-active');

        if (!solverScriptsLoaded) {
            await loadScripts(SOLVER_SCRIPTS);
            solverScriptsLoaded = true;
        } else {
            if (typeof initUI === 'function') initUI();
        }
    } else {
        app.innerHTML = HOME_HTML;
    }

    void app.offsetWidth;
    app.classList.add('fade-in');
}

window.onpopstate = () => {
    app.classList.remove('fade-in');
    app.classList.add('fade-out');
    setTimeout(renderRoute, 300);
};

renderRoute();
