function getSettings() {
    return {
        mode: document.getElementById('agentMode').value,
        agentProfile: document.getElementById('agentProfile').value,
        gemmaRepo: document.getElementById('gemmaRepo').value.trim(),
        gemmaFile: document.getElementById('gemmaFile').value.trim(),
        gemmaGpuLayers: document.getElementById('gemmaGpuLayers').value,
        gemmaMaxTokens: document.getElementById('gemmaMaxTokens').value,
        webmcpUrl: document.getElementById('webmcpUrl').value.trim()
    };
}

function setNotebook(nextNotebook) {
    notebook = normalizeNotebook(nextNotebook);
    if (!notebook.cells.length) {
        notebook.cells.push(createCell('markdown', '# Empty notebook'));
    }
    selectedCellId = notebook.cells.some(cell => cell.id === selectedCellId) ? selectedCellId : notebook.cells[0].id;
    render();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}

function renderIcon(name) {
    return `<svg class="icon" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function renderIconLabel(iconName, label) {
    return `${renderIcon(iconName)}<span>${escapeHtml(label)}</span>`;
}

function renderIconOnlyButton(iconName, action, label) {
    return `<button class="icon-button" data-action="${action}" title="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${renderIcon(iconName)}<span class="sr-only">${escapeHtml(label)}</span></button>`;
}

function renderInlineMarkdown(value) {
    return escapeHtml(value)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

function renderMarkdown(source) {
    const lines = sourceToString(source).split('\n');
    const html = [];
    let listType = null;
    let paragraph = [];
    let inFence = false;
    let fenceLines = [];

    function flushParagraph() {
        if (paragraph.length) {
            html.push(`<p>${renderInlineMarkdown(paragraph.join(' '))}</p>`);
            paragraph = [];
        }
    }

    function closeList() {
        if (listType) {
            html.push(`</${listType}>`);
            listType = null;
        }
    }

    lines.forEach(line => {
        if (line.trim().startsWith('```')) {
            if (inFence) {
                html.push(`<pre><code>${escapeHtml(fenceLines.join('\n'))}</code></pre>`);
                fenceLines = [];
                inFence = false;
            } else {
                flushParagraph();
                closeList();
                inFence = true;
            }
            return;
        }
        if (inFence) {
            fenceLines.push(line);
            return;
        }
        if (!line.trim()) {
            flushParagraph();
            closeList();
            return;
        }
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if (heading) {
            flushParagraph();
            closeList();
            html.push(`<h${heading[1].length}>${renderInlineMarkdown(heading[2])}</h${heading[1].length}>`);
            return;
        }
        const bullet = line.match(/^[-*]\s+(.+)$/);
        if (bullet) {
            flushParagraph();
            if (listType !== 'ul') {
                closeList();
                listType = 'ul';
                html.push('<ul>');
            }
            html.push(`<li>${renderInlineMarkdown(bullet[1])}</li>`);
            return;
        }
        paragraph.push(line.trim());
    });
    if (inFence) html.push(`<pre><code>${escapeHtml(fenceLines.join('\n'))}</code></pre>`);
    flushParagraph();
    closeList();
    return html.join('');
}

function highlightPython(source) {
    const tokenPattern = /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#.*|\b(?:False|None|True|and|as|assert|async|await|break|class|continue|def|del|elif|else|except|finally|for|from|global|if|import|in|is|lambda|nonlocal|not|or|pass|raise|return|try|while|with|yield)\b|\b(?:print|len|range|str|int|float|list|dict|set|tuple|sum|min|max|sorted|enumerate|zip)\b|@\w+|\b\d+(?:\.\d+)?\b)/g;
    let html = '';
    let lastIndex = 0;
    const text = sourceToString(source);
    text.replace(tokenPattern, (token, ...args) => {
        const offset = args[args.length - 2];
        html += escapeHtml(text.slice(lastIndex, offset));
        const safeToken = escapeHtml(token);
        if (token.startsWith('#')) html += `<span class="py-comment">${safeToken}</span>`;
        else if (token.startsWith('"') || token.startsWith("'")) html += `<span class="py-string">${safeToken}</span>`;
        else if (token.startsWith('@')) html += `<span class="py-decorator">${safeToken}</span>`;
        else if (/^\d/.test(token)) html += `<span class="py-number">${safeToken}</span>`;
        else if (/^(print|len|range|str|int|float|list|dict|set|tuple|sum|min|max|sorted|enumerate|zip)$/.test(token)) {
            html += `<span class="py-builtin">${safeToken}</span>`;
        } else {
            html += `<span class="py-keyword">${safeToken}</span>`;
        }
        lastIndex = offset + token.length;
        return token;
    });
    html += escapeHtml(text.slice(lastIndex));
    return html;
}

function codeEditorHeight(source, collapsed) {
    if (collapsed) return 190;
    const lineCount = Math.max(5, sourceToString(source).split('\n').length);
    return Math.min(720, Math.round((lineCount * 20.15) + 26));
}

function renderLineNumbers(source) {
    const lineCount = Math.max(1, sourceToString(source).split('\n').length);
    return Array.from({ length: lineCount }, (_, index) => index + 1).join('\n');
}

function renderSourceEditor(cell) {
    const height = codeEditorHeight(cell.source, isCellCollapsed(cell));
    if (cell.cell_type === 'markdown') {
        return `<textarea data-action="source" spellcheck="false" style="height: ${height}px">${escapeHtml(cell.source)}</textarea>`;
    }
    const collapsed = isCellCollapsed(cell);
    const lineNumbers = hasLineNumbers();
    return `
        <div class="code-wrap ${collapsed ? 'collapsed' : ''} ${lineNumbers ? 'with-lines' : ''}" style="height: ${height}px">
            ${lineNumbers ? `<pre class="line-numbers" aria-hidden="true">${renderLineNumbers(cell.source)}</pre>` : ''}
            <pre class="code-highlight" aria-hidden="true">${highlightPython(cell.source)}\n</pre>
            <textarea data-action="source" spellcheck="false" style="height: ${height}px">${escapeHtml(cell.source)}</textarea>
        </div>
    `;
}

function syncCodeCellView(cellEl, source, collapsed) {
    const wrap = cellEl.querySelector('.code-wrap');
    if (!wrap) return;
    const height = codeEditorHeight(source, collapsed);
    const highlight = wrap.querySelector('.code-highlight');
    const lineNumbers = wrap.querySelector('.line-numbers');
    const textarea = wrap.querySelector('textarea');
    wrap.style.height = `${height}px`;
    if (textarea) textarea.style.height = `${height}px`;
    if (highlight) highlight.innerHTML = `${highlightPython(source)}\n`;
    if (lineNumbers) lineNumbers.textContent = renderLineNumbers(source);
    wrap.scrollTop = 0;
    wrap.scrollLeft = 0;
    if (highlight) highlight.style.transform = '';
    if (lineNumbers) lineNumbers.style.transform = '';
    if (textarea) textarea.style.transform = '';
}

function renderPlotOutput(image, index) {
    const safeImage = escapeHtml(image);
    return `
        <div class="plot-output" data-plot-index="${index}">
            <div class="plot-toolbar" aria-label="Plot controls">
                <button data-action="plot-home" title="Reset plot view">Home</button>
                <button data-action="plot-left" title="Pan plot left">&lt;</button>
                <button data-action="plot-right" title="Pan plot right">&gt;</button>
                <button data-action="plot-zoom-out" title="Zoom plot out">Zoom -</button>
                <button data-action="plot-zoom-in" title="Zoom plot in">Zoom +</button>
            </div>
            <div class="plot-stage">
                <img alt="Python plot output" data-scale="1" data-offset-x="0" src="data:image/png;base64,${safeImage}">
            </div>
        </div>
    `;
}

function renderOutput(outputs) {
    const text = normalizeOutputs(outputs)
        .filter(output => !(output.data && output.data['text/html']))
        .map(outputToText)
        .filter(Boolean)
        .join('\n');
    const tables = normalizeOutputs(outputs)
        .map(output => output.data && output.data['text/html'])
        .filter(Boolean)
        .map(html => `<div class="table-output">${sanitizeOutputHtml(html)}</div>`)
        .join('');
    const images = normalizeOutputs(outputs)
        .map(output => output.data && output.data['image/png'])
        .filter(Boolean)
        .map(renderPlotOutput)
        .join('');
    if (!text && !tables && !images) return '';
    const textOutput = text ? `<div class="output">${escapeHtml(text)}</div>` : '';
    const imageOutput = images ? `<div class="output">${images}</div>` : '';
    return `<div class="output-wrap ${outputHasError(outputs) ? 'error' : ''}">${tables}${textOutput}${imageOutput}</div>`;
}

function renderErrorFixAction(cell) {
    if (!cell || cell.cell_type !== 'code' || !outputHasError(cell.outputs)) return '';
    return `
        <div class="error-action">
            <span>The last run failed.</span>
            <button data-action="fix-error" title="Send this cell source and error to the agent">Fix error</button>
        </div>
    `;
}

function renderMarkdownCell(cell) {
    return shouldRenderMarkdown(cell)
        ? `<div class="markdown-preview">${renderMarkdown(cell.source)}</div>`
        : '';
}

function renderRuntimeStatus() {
    const packageText = runtimeState.loadedPackages.size
        ? `packages: ${Array.from(runtimeState.loadedPackages).join(', ')}`
        : 'no packages loaded';
    const fileText = runtimeState.mountedFiles.length
        ? `files: ${runtimeState.mountedFiles.join(', ')}`
        : 'no files mounted';
    const status = pyodideReady ? `Pyodide ${runtimeState.status}` : `Pyodide ${runtimeState.status}`;
    const runtimeEl = document.getElementById('runtimeStatus');
    if (runtimeEl) runtimeEl.textContent = `${status} | ${packageText} | ${fileText}`;
    const lineNumberButton = document.getElementById('toggleLineNumbersBtn');
    if (lineNumberButton) {
        lineNumberButton.innerHTML = renderIconLabel('list-numbers', viewState.showLineNumbers ? 'Hide Lines' : 'Show Lines');
        lineNumberButton.title = viewState.showLineNumbers ? 'Hide line numbers for all code cells' : 'Show line numbers for all code cells';
    }
}

function updatePlotView(image, scale, offsetX) {
    const nextScale = Math.min(4, Math.max(0.5, scale));
    const nextOffset = Math.min(240, Math.max(-240, offsetX));
    image.dataset.scale = String(nextScale);
    image.dataset.offsetX = String(nextOffset);
    image.style.transform = `translateX(${nextOffset}px) scale(${nextScale})`;
}

function render() {
    const list = document.getElementById('cellList');
    list.innerHTML = notebook.cells.map((cell, index) => `
        <article class="cell ${cell.id === selectedCellId ? 'selected' : ''}" data-id="${cell.id}" data-type="${cell.cell_type}">
            <div class="cell-head">
                <div class="cell-kind">
                    <span class="pill">${index + 1}</span>
                    <select data-action="type">
                        <option value="markdown" ${cell.cell_type === 'markdown' ? 'selected' : ''}>Markdown</option>
                        <option value="code" ${cell.cell_type === 'code' ? 'selected' : ''}>Code</option>
                    </select>
                </div>
                <div class="cell-actions">
                    ${cell.cell_type === 'code' ? `<button class="icon-label compact" data-action="toggle-height" title="${isCellCollapsed(cell) ? 'Expand code cell to fit content' : 'Use fixed code height with scrolling'}">${renderIconLabel('rows', isCellCollapsed(cell) ? 'Auto height' : 'Fixed height')}</button>` : ''}
                    ${renderIconOnlyButton('play', 'run', 'Run cell')}
                    ${renderIconOnlyButton('trash', 'delete', 'Delete cell')}
                </div>
            </div>
            ${renderSourceEditor(cell)}
            ${renderMarkdownCell(cell)}
            ${renderOutput(cell.outputs)}
            ${renderErrorFixAction(cell)}
        </article>
    `).join('');
    document.getElementById('cellCount').textContent = `${notebook.cells.length} cell${notebook.cells.length === 1 ? '' : 's'}`;
    renderRuntimeStatus();
}

function addMessage(role, html) {
    const log = document.getElementById('chatLog');
    const message = document.createElement('div');
    message.className = `message ${role}`;
    message.innerHTML = `<strong>${role === 'user' ? 'You' : 'Pilot'}</strong>${html}`;
    log.appendChild(message);
    log.scrollTop = log.scrollHeight;
}

async function askPilot() {
    const input = document.getElementById('promptInput');
    const button = document.getElementById('askBtn');
    const userRequest = input.value.trim();
    if (!userRequest) return;
    input.value = '';
    await askAgentForCell(userRequest, {
        userHtml: `<p>${escapeHtml(userRequest)}</p>`,
        busyButton: button,
        busyText: 'Thinking...',
        doneText: 'Ask Pilot',
        buttonIcon: 'bot'
    });
}

async function askAgentForCell(userRequest, options = {}) {
    const button = options.busyButton || null;
    if (button) {
        button.disabled = true;
        button.innerHTML = options.buttonIcon
            ? renderIconLabel(options.buttonIcon, options.busyText || 'Thinking...')
            : escapeHtml(options.busyText || 'Thinking...');
    }
    addMessage('user', options.userHtml || `<p>${escapeHtml(userRequest)}</p>`);
    try {
        const result = await runAgentLoop(userRequest, {
            runGenerated: Boolean(options.runGenerated),
            maxIterations: options.maxIterations || 1
        });
        const parsed = result.parsed || { explanation: 'I could not prepare a notebook cell.', code: '' };
        addMessage('assistant', `<p>${escapeHtml(parsed.explanation)}</p>${parsed.code ? `<pre>${escapeHtml(parsed.code)}</pre>` : ''}`);
        if (result.ran) {
            addMessage('assistant', result.fixed
                ? `<p>The generated cell ran without errors after ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}.</p>`
                : `<p>The generated cell still has an error after ${result.attempts} attempt${result.attempts === 1 ? '' : 's'}.</p>`);
        }
    } catch (error) {
        addMessage('assistant', `<p>${escapeHtml(error.message || String(error))}</p>`);
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = options.buttonIcon
                ? renderIconLabel(options.buttonIcon, options.doneText || 'Ask Pilot')
                : escapeHtml(options.doneText || 'Ask Pilot');
        }
    }
}

function updateCell(id, patch) {
    notebook = {
        ...notebook,
        cells: notebook.cells.map(cell => cell.id === id ? { ...cell, ...patch } : cell)
    };
}
