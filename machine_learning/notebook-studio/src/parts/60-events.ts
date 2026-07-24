document.getElementById('cellList').addEventListener('click', async event => {
    const actionTarget = event.target.closest('[data-action]');
    const plotAction = actionTarget && actionTarget.dataset.action;
    if (plotAction && plotAction.startsWith('plot-')) {
        const plot = actionTarget.closest('.plot-output');
        const image = plot && plot.querySelector('img');
        if (!image) return;
        const scale = Number(image.dataset.scale || 1);
        const offsetX = Number(image.dataset.offsetX || 0);
        if (plotAction === 'plot-home') updatePlotView(image, 1, 0);
        if (plotAction === 'plot-left') updatePlotView(image, scale, offsetX - 48);
        if (plotAction === 'plot-right') updatePlotView(image, scale, offsetX + 48);
        if (plotAction === 'plot-zoom-in') updatePlotView(image, scale + 0.2, offsetX);
        if (plotAction === 'plot-zoom-out') updatePlotView(image, scale - 0.2, offsetX);
        return;
    }
    const cellEl = event.target.closest('.cell');
    if (!cellEl) return;
    selectedCellId = cellEl.dataset.id;
    const action = actionTarget && actionTarget.dataset.action;
    if (action === 'delete') {
        notebook = { ...notebook, cells: notebook.cells.filter(cell => cell.id !== selectedCellId) };
        if (!notebook.cells.length) notebook.cells.push(createCell('markdown', '# Empty notebook'));
        selectedCellId = notebook.cells[0].id;
        render();
    } else if (action === 'run') {
        const cell = notebook.cells.find(item => item.id === selectedCellId);
        const nextCell = await runCell(cell);
        updateCell(selectedCellId, nextCell);
        render();
    } else if (action === 'toggle-height') {
        const cell = notebook.cells.find(item => item.id === selectedCellId);
        updateCell(selectedCellId, {
            metadata: {
                ...(cell.metadata || {}),
                notebookPilotCollapsed: !isCellCollapsed(cell)
            }
        });
        render();
    } else if (action === 'fix-error') {
        const cell = notebook.cells.find(item => item.id === selectedCellId);
        if (!cell) return;
        await askAgentForCell(buildFixErrorRequest(cell), {
            busyButton: actionTarget,
            busyText: 'Fixing...',
            doneText: 'Fix error',
            runGenerated: true,
            maxIterations: 2,
            userHtml: [
                '<p>Fix the error in this code cell.</p>',
                `<pre>${escapeHtml(sourceToString(cell.source))}</pre>`,
                `<pre>${escapeHtml(errorOutputsToText(cell.outputs) || 'No error text was captured.')}</pre>`
            ].join('')
        });
    }
});

document.getElementById('cellList').addEventListener('input', event => {
    const cellEl = event.target.closest('.cell');
    if (!cellEl) return;
    selectedCellId = cellEl.dataset.id;
    if (event.target.dataset.action === 'source') {
        const cell = notebook.cells.find(item => item.id === selectedCellId);
        updateCell(selectedCellId, {
            source: event.target.value,
            metadata: {
                ...(cell.metadata || {}),
                notebookPilotRendered: false
            }
        });
        syncCodeCellView(cellEl, event.target.value, isCellCollapsed(cell));
    }
});

document.getElementById('cellList').addEventListener('scroll', event => {
    const wrap = event.target.classList && event.target.classList.contains('code-wrap') ? event.target : null;
    if (!wrap) return;
    const highlight = wrap.querySelector('.code-highlight');
    const lineNumbers = wrap.querySelector('.line-numbers');
    const textarea = wrap.querySelector('textarea');
    if (highlight) {
        highlight.style.transform = `translate(${-wrap.scrollLeft}px, ${-wrap.scrollTop}px)`;
    }
    if (lineNumbers) {
        lineNumbers.style.transform = `translateY(${-wrap.scrollTop}px)`;
    }
    if (textarea) {
        textarea.style.transform = `translate(${-wrap.scrollLeft}px, ${-wrap.scrollTop}px)`;
    }
}, true);

document.getElementById('cellList').addEventListener('change', event => {
    const cellEl = event.target.closest('.cell');
    if (!cellEl) return;
    selectedCellId = cellEl.dataset.id;
    if (event.target.dataset.action === 'type') {
        updateCell(selectedCellId, {
            cell_type: event.target.value,
            outputs: event.target.value === 'markdown' ? [] : notebook.cells.find(cell => cell.id === selectedCellId).outputs,
            metadata: {}
        });
        render();
    }
});

document.getElementById('addMarkdownBtn').addEventListener('click', () => {
    notebook.cells.push(createCell('markdown', '## Notes\n'));
    selectedCellId = notebook.cells[notebook.cells.length - 1].id;
    render();
});

document.getElementById('addCodeBtn').addEventListener('click', () => {
    notebook.cells.push(createCell('code', '# New analysis step\n'));
    selectedCellId = notebook.cells[notebook.cells.length - 1].id;
    render();
});

document.getElementById('runSelectedBtn').addEventListener('click', async () => {
    const cell = notebook.cells.find(item => item.id === selectedCellId);
    const nextCell = await runCell(cell);
    updateCell(selectedCellId, nextCell);
    render();
});

document.getElementById('runAllBtn').addEventListener('click', runAllCells);

document.getElementById('toggleLineNumbersBtn').addEventListener('click', () => {
    viewState.showLineNumbers = !viewState.showLineNumbers;
    render();
});

document.getElementById('askBtn').addEventListener('click', askPilot);
document.getElementById('promptInput').addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') askPilot();
});

document.getElementById('loadBtn').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    setNotebook(await file.text());
});

document.getElementById('initRuntimeBtn').addEventListener('click', async () => {
    try {
        await ensurePyodideRuntime();
        addMessage('assistant', '<p>Pyodide is ready. Run a code cell or load packages for pandas, numpy, and plotting.</p>');
    } catch (error) {
        addMessage('assistant', `<p>${escapeHtml(error.message || String(error))}</p>`);
    }
});

document.getElementById('loadPackagesBtn').addEventListener('click', async () => {
    try {
        const loaded = await loadRequestedPackages(document.getElementById('packageInput').value);
        addMessage('assistant', `<p>${loaded.length ? `Loaded ${escapeHtml(loaded.join(', '))}.` : 'Requested packages are already loaded.'}</p>`);
    } catch (error) {
        addMessage('assistant', `<p>${escapeHtml(error.message || String(error))}</p>`);
    }
});

document.getElementById('dataFileInput').addEventListener('change', async event => {
    try {
        const name = await mountFile(event.target.files[0]);
        if (name) addMessage('assistant', `<p>Mounted <code>${escapeHtml(name)}</code> in the Pyodide working directory.</p>`);
    } catch (error) {
        addMessage('assistant', `<p>${escapeHtml(error.message || String(error))}</p>`);
    }
});

document.getElementById('exportBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(notebookToIpynb(notebook), null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'notebook-studio.ipynb';
    link.click();
    URL.revokeObjectURL(link.href);
});

document.getElementById('sampleBtn').addEventListener('click', () => {
    loadSalesDemo();
});

const NOTEBOOK_STUDIO_EXAMPLES = {
    'missing-data': {
        url: '/downloads/missing_data_uci_adult.ipynb',
        files: [
            {
                name: 'uci_adult.csv',
                url: '/downloads/uci_adult.csv'
            }
        ],
        message: '<p>Loaded the missing-data machine learning notebook and queued <code>uci_adult.csv</code>. Use Run All after Pyodide finishes loading, or inspect and edit the cells first.</p>'
    }
};

async function queueVirtualFiles(files = []) {
    const mounted = [];
    for (const file of files) {
        const resolvedUrl = new URL(file.url, window.location.href);
        const response = await fetch(resolvedUrl.href);
        if (!response.ok) {
            throw new Error(`Could not load file from ${resolvedUrl.pathname}: ${response.status} ${response.statusText}`);
        }
        virtualFiles.set(file.name, new Uint8Array(await response.arrayBuffer()));
        rememberMountedFile(file.name);
        mounted.push(file.name);
    }
    if (pyodideReady && window.pyodide) {
        await mountVirtualFiles(window.pyodide);
    } else if (mounted.length) {
        renderRuntimeStatus();
    }
    return mounted;
}

async function loadNotebookFromUrl(url, message) {
    const resolvedUrl = new URL(url, window.location.href);
    const response = await fetch(resolvedUrl.href);
    if (!response.ok) {
        throw new Error(`Could not load notebook from ${resolvedUrl.pathname}: ${response.status} ${response.statusText}`);
    }
    setNotebook(await response.text());
    addMessage('assistant', message || `<p>Loaded notebook from <code>${escapeHtml(resolvedUrl.pathname)}</code>.</p>`);
}

async function loadNotebookFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const notebookUrl = params.get('notebook');
    const exampleKey = params.get('example');
    const example = exampleKey ? NOTEBOOK_STUDIO_EXAMPLES[exampleKey] : null;

    if (!notebookUrl && !example) return;

    try {
        if (notebookUrl) {
            await loadNotebookFromUrl(notebookUrl);
        } else {
            await queueVirtualFiles(example.files);
            await loadNotebookFromUrl(example.url, example.message);
        }
    } catch (error) {
        addMessage('assistant', `<p>${escapeHtml(error.message || String(error))}</p>`);
    }
}

document.getElementById('agentMode').addEventListener('change', event => {
    const status = document.getElementById('agentStatus');
    status.textContent = event.target.value === 'webmcp'
        ? 'webmcp mode'
        : event.target.value === 'gemma'
            ? (gemmaState.loaded ? 'gemma ready' : 'browser gemma')
            : 'draft mode';
    status.classList.toggle('ready', event.target.value !== 'draft' && (event.target.value !== 'gemma' || gemmaState.loaded));
});

function applyAgentProfile(profileKey, announce = true) {
    const profile = getAgentProfile(profileKey);
    document.getElementById('agentProfile').value = Object.keys(AGENT_PERFORMANCE_PROFILES)
        .find(key => AGENT_PERFORMANCE_PROFILES[key] === profile) || 'fast';
    document.getElementById('gemmaMaxTokens').value = String(profile.maxTokens);
    const hint = document.getElementById('agentProfileHint');
    if (hint) {
        hint.textContent = `${profile.label}: ${profile.maxContextCells} context cells, ${profile.maxTokens} response tokens, ${profile.nCtx} model context.`;
    }
    if (announce) {
        addMessage('assistant', `<p>${escapeHtml(profile.label)} agent profile is active. Context and response budgets were adjusted for this speed setting.</p>`);
    }
}

document.getElementById('agentProfile').addEventListener('change', event => {
    applyAgentProfile(event.target.value);
});

document.getElementById('loadGemmaBtn').addEventListener('click', async () => {
    try {
        document.getElementById('agentMode').value = 'gemma';
        const settings = getSettings();
        await ensureBrowserGemma(settings);
        document.getElementById('agentStatus').textContent = 'gemma ready';
        document.getElementById('agentStatus').classList.add('ready');
        addMessage('assistant', `<p>Model is loaded from <code>${escapeHtml(modelLabelFromSettings(settings))}</code>.</p>`);
    } catch (error) {
        addMessage('assistant', `<p>${escapeHtml(error.message || String(error))}</p>`);
    }
});

document.getElementById('useGemma4Btn').addEventListener('click', () => {
    document.getElementById('agentMode').value = 'gemma';
    document.getElementById('gemmaRepo').value = ADVANCED_GEMMA4_REPO;
    document.getElementById('gemmaFile').value = ADVANCED_GEMMA4_FILE;
    applyAgentProfile('deep', false);
    renderGemmaStatus();
    addMessage('assistant', '<p>Gemma 4 E2B is selected. It is a much larger browser download; use Load Gemma when you are ready to try it.</p>');
});

document.getElementById('useQwenFastBtn').addEventListener('click', () => {
    document.getElementById('agentMode').value = 'gemma';
    document.getElementById('gemmaRepo').value = QWEN_CODER_FAST_REPO;
    document.getElementById('gemmaFile').value = QWEN_CODER_FAST_FILE;
    applyAgentProfile('fast', false);
    renderGemmaStatus();
    addMessage('assistant', '<p>Qwen2.5 Coder 0.5B Q8_0 is selected for fast browser responses.</p>');
});

document.getElementById('useQwenCoderBtn').addEventListener('click', () => {
    document.getElementById('agentMode').value = 'gemma';
    document.getElementById('gemmaRepo').value = QWEN_CODER_REPO;
    document.getElementById('gemmaFile').value = QWEN_CODER_FILE;
    applyAgentProfile('balanced', false);
    renderGemmaStatus();
    addMessage('assistant', '<p>Qwen2.5 Coder 1.5B is selected. It is the default code-focused model for notebook edits.</p>');
});

document.getElementById('useFastGemmaBtn').addEventListener('click', () => {
    document.getElementById('agentMode').value = 'gemma';
    document.getElementById('gemmaRepo').value = FAST_GEMMA_REPO;
    document.getElementById('gemmaFile').value = FAST_GEMMA_FILE;
    applyAgentProfile('fast', false);
    renderGemmaStatus();
    addMessage('assistant', '<p>Fast Gemma is selected. It uses a smaller Gemma 3 1B quant and a shorter response budget for quicker notebook edits.</p>');
});

document.getElementById('loadSmokeModelBtn').addEventListener('click', async () => {
    document.getElementById('agentMode').value = 'gemma';
    document.getElementById('gemmaRepo').value = SMOKE_MODEL_REPO;
    document.getElementById('gemmaFile').value = SMOKE_MODEL_FILE;
    applyAgentProfile('fast', false);
    try {
        const settings = getSettings();
        await ensureBrowserGemma(settings);
        document.getElementById('agentStatus').textContent = 'gguf ready';
        document.getElementById('agentStatus').classList.add('ready');
        addMessage('assistant', `<p>The tiny GGUF smoke model is loaded through the same browser wllama path. Switch back to Gemma once you have a split shard file.</p>`);
    } catch (error) {
        addMessage('assistant', `<p>${escapeHtml(error.message || String(error))}</p>`);
    }
});

addMessage('assistant', '<p>Load a notebook or ask for the first analysis step. Draft mode generates local starter cells; WebMCP mode can hand the same context to your own agent.</p>');
applyAgentProfile('fast', false);
loadNotebookFromQuery();
render();
