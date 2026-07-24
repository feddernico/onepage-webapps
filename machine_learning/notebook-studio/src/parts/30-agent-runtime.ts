function rememberMountedFile(name) {
    if (!runtimeState.mountedFiles.includes(name)) {
        runtimeState.mountedFiles.push(name);
    }
}

function getAgentProfile(settingsOrName = {}) {
    const key = typeof settingsOrName === 'string'
        ? settingsOrName
        : settingsOrName.agentProfile;
    return AGENT_PERFORMANCE_PROFILES[key] || AGENT_PERFORMANCE_PROFILES.fast;
}

function summarizeCellForContext(cell, index, selectedIndex, profile = AGENT_PERFORMANCE_PROFILES.fast) {
    const distance = Math.abs(index - selectedIndex);
    const isSelected = index === selectedIndex;
    const isNearby = distance <= 2;
    const outputs = normalizeOutputs(cell.outputs);
    const outputText = outputs.map(outputToText).filter(Boolean).join('\n');
    const errorText = errorOutputsToText(outputs);
    const sourceLimit = isSelected
        ? profile.selectedSourceLimit
        : isNearby ? profile.nearbySourceLimit : profile.distantSourceLimit;
    const outputLimit = isSelected
        ? profile.selectedOutputLimit
        : isNearby ? profile.nearbyOutputLimit : profile.distantOutputLimit;
    return {
        index,
        role: isSelected ? 'selected' : isNearby ? 'nearby' : 'summary',
        type: cell.cell_type,
        hasError: outputHasError(outputs),
        source: isNearby || isSelected ? truncateText(cell.source, sourceLimit) : truncateText(firstMeaningfulLine(cell.source), sourceLimit),
        outputs: truncateText(outputText, outputLimit),
        error: truncateText(errorText, outputLimit)
    };
}

function compactNotebookContext(doc, selectedId, options = {}) {
    const profile = getAgentProfile(options.agentProfile || options.profile || {});
    const foundIndex = doc.cells.findIndex(cell => cell.id === selectedId);
    const selectedIndex = foundIndex >= 0 ? foundIndex : 0;
    const maxCells = options.maxCells || profile.maxContextCells;
    const selectedCell = doc.cells[selectedIndex] || null;
    const includedIndexes = doc.cells
        .map((cell, index) => ({
            index,
            score: Math.abs(index - selectedIndex) <= 2 ? 0 : Math.abs(index - selectedIndex)
        }))
        .sort((a, b) => a.score - b.score || a.index - b.index)
        .slice(0, maxCells)
        .map(item => item.index)
        .sort((a, b) => a - b);
    const cells = includedIndexes.map(index => summarizeCellForContext(doc.cells[index], index, selectedIndex, profile));
    return {
        cellCount: doc.cells.length,
        selectedIndex,
        selectedCell,
        cells,
        omittedCellCount: Math.max(0, doc.cells.length - cells.length),
        compacted: doc.cells.length > cells.length
    };
}

function extractNotebookContext(doc, selectedId) {
    return compactNotebookContext(doc, selectedId, getSettings ? { agentProfile: getSettings().agentProfile } : {});
}

function buildAgentPrompt(userRequest, context, settings) {
    const profile = getAgentProfile(settings);
    const isRepair = /Fix the Python code cell|previous generated cell still failed|runtime returned this error/i.test(userRequest);
    return [
        'You are Notebook Studio, a careful data analyst working inside a Jupyter-compatible notebook.',
        `Agent speed profile: ${profile.label}.`,
        `Preferred local model target: ${modelLabelFromSettings(settings)}`,
        `Notebook has ${context.cellCount} cells. Selected cell index: ${context.selectedIndex}.`,
        context.compacted ? `Context was compacted. Omitted ${context.omittedCellCount} distant cells.` : 'Context includes all currently relevant cells.',
        isRepair
            ? 'Return only one concise fenced python code block. No extra narrative unless needed as code comments.'
            : 'Return exactly two parts: one concise explanation sentence, then one fenced python code block.',
        'The fenced block must be valid Python for a notebook code cell. Do not return plain text instead of code.',
        profile.concise ? 'Keep the code short and direct. Prefer the smallest cell that answers the request.' : 'Use enough code to handle the request thoroughly.',
        'If the request is vague, create a safe inspection cell using pandas objects already present in context.',
        'Pay special attention to the selected cell source, selected cell outputs, and any selected cell error.',
        '',
        'Compacted notebook context:',
        JSON.stringify(context.cells, null, 2),
        '',
        `User request: ${userRequest}`
    ].join('\n');
}

function estimatePromptTokens(text) {
    return Math.ceil(String(text || '').length / 4);
}

function compactPromptToFit(prompt, settings) {
    const profile = getAgentProfile(settings);
    const maxTokens = normalizeMaxTokens(settings.gemmaMaxTokens);
    const usableContext = Math.max(256, profile.nCtx - maxTokens - 96);
    if (estimatePromptTokens(prompt) <= usableContext) return prompt;
    const text = String(prompt);
    const head = text.slice(0, Math.max(0, usableContext * 2));
    const tail = text.slice(Math.max(0, text.length - usableContext));
    return [
        head.trimEnd(),
        '',
        '[Notebook context compacted further to fit the browser model window.]',
        '',
        tail.trimStart()
    ].join('\n');
}

function buildFixErrorRequest(cell) {
    const source = sourceToString(cell && cell.source).trim();
    const errorText = errorOutputsToText(cell && cell.outputs).trim()
        || normalizeOutputs(cell && cell.outputs).map(outputToText).filter(Boolean).join('\n').trim()
        || 'No error text was captured.';
    return [
        'Fix the Python code cell below.',
        'The user tried to run this script:',
        '```python',
        source || '# Empty code cell',
        '```',
        'The runtime returned this error:',
        '```text',
        errorText,
        '```',
        'Return a corrected Python notebook cell. Prefer a direct fix over a broad rewrite.'
    ].join('\n');
}

function buildRetryAfterErrorRequest(originalRequest, attemptedCode, outputs) {
    const errorText = errorOutputsToText(outputs).trim()
        || normalizeOutputs(outputs).map(outputToText).filter(Boolean).join('\n').trim()
        || 'No error text was captured.';
    return [
        'The previous generated cell still failed. Repair it using the observed runtime output.',
        '',
        'Original user request:',
        originalRequest,
        '',
        'Generated code that failed:',
        '```python',
        sourceToString(attemptedCode).trim(),
        '```',
        '',
        'Runtime error/output:',
        '```text',
        errorText,
        '```',
        '',
        'Return one corrected Python notebook cell. Keep the fix focused.'
    ].join('\n');
}

function modelLabelFromSettings(settings = {}) {
    const repo = settings.gemmaRepo || DEFAULT_GEMMA_REPO;
    const file = settings.gemmaFile || DEFAULT_GEMMA_FILE;
    return `${repo}:${file}`;
}

function buildGemmaMessages(agentPrompt) {
    return [
        {
            role: 'system',
            content: [
                'You are Notebook Studio, a careful data-analysis assistant.',
                'Return exactly one short explanation sentence followed by exactly one fenced python code block.',
                'The code block must be insertable as the next notebook cell.',
                'Prefer pandas and matplotlib. Do not invent files; use filenames already present in context.',
                'When the user is vague, produce a safe inspection cell rather than asking a follow-up question.'
            ].join(' ')
        },
        {
            role: 'user',
            content: agentPrompt
        }
    ];
}

function getGemmaHfOptions(settings = {}) {
    const repo = String(settings.gemmaRepo || DEFAULT_GEMMA_REPO).trim();
    const file = String(settings.gemmaFile || DEFAULT_GEMMA_FILE).trim();
    if (!repo || !repo.includes('/')) {
        throw new Error('Gemma repo must look like owner/model-name.');
    }
    if (!file || !file.endsWith('.gguf')) {
        throw new Error('Gemma file must be a .gguf file.');
    }
    return { repo, file };
}

function createHfModelApiUrl(repo) {
    return `https://huggingface.co/api/models/${encodeURIComponent(repo).replace(/%2F/g, '/')}`;
}

function createHfResolveUrl(hfOptions) {
    const repo = encodeURIComponent(hfOptions.repo).replace(/%2F/g, '/');
    const file = hfOptions.file.split('/').map(part => encodeURIComponent(part)).join('/');
    return `https://huggingface.co/${repo}/resolve/main/${file}`;
}

function createHfDownloadUrl(hfOptions) {
    return `${createHfResolveUrl(hfOptions)}?download=true`;
}

function isSplitGgufFile(file) {
    return /-\d{5}-of-\d{5}\.gguf$/i.test(String(file || ''));
}

function findHfFileMetadata(modelInfo, file) {
    const siblings = modelInfo && Array.isArray(modelInfo.siblings) ? modelInfo.siblings : [];
    return siblings.find(item => item && item.rfilename === file) || null;
}

function browserGgufSizeMessage(fileInfo, file) {
    if (!fileInfo || !fileInfo.size) return '';
    if (fileInfo.size <= BROWSER_SINGLE_GGUF_LIMIT_BYTES) return '';
    if (isSplitGgufFile(file)) return '';
    return `${file} is ${formatBytes(fileInfo.size)}. Browser GGUF loading needs split shards for files over ${formatBytes(BROWSER_SINGLE_GGUF_LIMIT_BYTES)}.`;
}

function knownLargeGgufMessage(hfOptions) {
    if (isSplitGgufFile(hfOptions.file)) return '';
    if (hfOptions.repo === ADVANCED_GEMMA4_REPO && /^google_gemma-4-E2B-it-.*\.gguf$/i.test(hfOptions.file)) {
        return `${hfOptions.file} is the smallest practical English Gemma 4 E2B GGUF I found, but it is still over 2 GB and may fail in some browsers.`;
    }
    return '';
}

function normalizeGpuLayers(value) {
    const number = Number.parseInt(value, 10);
    return Number.isFinite(number) && number > 0 ? number : 0;
}

function normalizeMaxTokens(value) {
    const number = Number.parseInt(value, 10);
    if (!Number.isFinite(number)) return AGENT_PERFORMANCE_PROFILES.fast.maxTokens;
    return Math.min(900, Math.max(64, number));
}

function buildWllamaLoadParams(settings = {}, progressCallback) {
    const profile = getAgentProfile(settings);
    const params = {
        progressCallback,
        n_gpu_layers: normalizeGpuLayers(settings.gemmaGpuLayers),
        n_ctx: profile.nCtx,
        n_batch: profile.nBatch,
        n_threads: Math.max(2, Math.min(6, Math.floor((navigator.hardwareConcurrency || 4) / 2)))
    };
    return {
        hfOptions: getGemmaHfOptions(settings),
        loadParams: params
    };
}

function formatBytes(bytes) {
    const value = Number(bytes);
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = value;
    let index = 0;
    while (size >= 1024 && index < units.length - 1) {
        size /= 1024;
        index += 1;
    }
    return `${size >= 10 || index === 0 ? size.toFixed(0) : size.toFixed(1)} ${units[index]}`;
}

function formatModelProgress(progress) {
    if (!progress || !progress.total) return 'Preparing download';
    const loaded = Number(progress.loaded || 0);
    const total = Number(progress.total || 0);
    const percent = total ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
    return `${percent}% (${formatBytes(loaded)} / ${formatBytes(total)})`;
}

async function fetchHfModelInfo(repo) {
    const response = await fetch(createHfModelApiUrl(repo));
    if (!response.ok) {
        throw new Error(`Could not read Hugging Face metadata for ${repo}: ${response.status}`);
    }
    return response.json();
}

async function preflightBrowserGguf(hfOptions) {
    const modelInfo = await fetchHfModelInfo(hfOptions.repo);
    const fileInfo = findHfFileMetadata(modelInfo, hfOptions.file);
    if (!fileInfo) {
        throw new Error(`${hfOptions.file} was not found in ${hfOptions.repo}.`);
    }
    return {
        fileInfo,
        warning: knownLargeGgufMessage(hfOptions) || browserGgufSizeMessage(fileInfo, hfOptions.file)
    };
}

function isLikelyPythonLine(line) {
    const text = String(line || '').trim();
    if (!text) return true;
    return /^(import|from|for|while|if|elif|else:|try:|except|with|def|class|return|print\(|#)/.test(text)
        || /^[A-Za-z_][\w.]*\s*=/.test(text)
        || /^(df|pd|np|plt|sns|ax|fig|display)\b/.test(text)
        || /^[A-Za-z_][\w.]*\(.*\)$/.test(text)
        || /^\s{2,}\S/.test(line);
}

function extractUnfencedPythonCode(response) {
    const lines = String(response || '').split('\n');
    let best = [];
    let current = [];
    let signal = 0;
    let bestSignal = 0;
    const flush = () => {
        const trimmed = current.join('\n').trim();
        if (trimmed && signal > bestSignal && signal >= 2) {
            best = current.slice();
            bestSignal = signal;
        }
        current = [];
        signal = 0;
    };
    lines.forEach(line => {
        if (isLikelyPythonLine(line)) {
            current.push(line);
            if (String(line).trim()) signal += 1;
        } else {
            flush();
        }
    });
    flush();
    return best.join('\n').trim();
}

function normalizeMarkdownFences(text) {
    return String(text || '')
        .replace(/^``\s*$/gm, '```');
}

function dedupeConsecutiveLines(source) {
    const lines = sourceToString(source).split('\n');
    const midpoint = lines.length / 2;
    if (lines.length > 1 && Number.isInteger(midpoint)) {
        const first = lines.slice(0, midpoint).join('\n').trim();
        const second = lines.slice(midpoint).join('\n').trim();
        if (first && first === second) return first;
    }
    const deduped = [];
    lines.forEach(line => {
        if (line.trim() || deduped[deduped.length - 1] !== '') {
            deduped.push(line);
        }
    });
    return deduped.join('\n').trim();
}

function removeAlreadyRunInspectionCode(code, context) {
    const selected = context && context.selectedCell;
    const selectedSource = sourceToString(selected && selected.source);
    const selectedOutput = normalizeOutputs(selected && selected.outputs).map(outputToText).join('\n');
    const selectedAlreadyInspected = selectedSource.includes('df.info()')
        || selectedSource.includes('df.describe(include="all").transpose()')
        || selectedOutput.includes('<class')
        || selectedOutput.includes('Data columns');
    if (!selectedAlreadyInspected) return code;
    const lines = sourceToString(code).split('\n');
    const filtered = [];
    let skippedAny = false;
    lines.forEach(line => {
        const trimmed = line.trim();
        const isRepeatedInspection = trimmed === 'import pandas as pd'
            || trimmed === '# First pass: inspect the working dataframe.'
            || trimmed === 'df.info()'
            || trimmed === 'df.describe(include="all").transpose()';
        if (isRepeatedInspection) {
            skippedAny = true;
            return;
        }
        filtered.push(line);
    });
    const cleaned = filtered.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    return cleaned || (skippedAny ? '# The selected cell already ran the dataframe inspection.' : code);
}

function sanitizeGeneratedCode(code, context) {
    return removeAlreadyRunInspectionCode(dedupeConsecutiveLines(code), context).trim();
}

function parseAgentResponse(text) {
    const response = normalizeMarkdownFences(text).trim();
    const match = response.match(/```(?:python|py)?\s*([\s\S]*?)```/i);
    const rawCode = match ? match[1].trim() : extractUnfencedPythonCode(response);
    const code = sanitizeGeneratedCode(rawCode);
    const explanation = match ? response.replace(match[0], '').trim() : response;
    return {
        explanation: explanation || 'I prepared the next notebook step.',
        code
    };
}

function extractFirstFencedBlock(text, language = '') {
    const pattern = language
        ? `\`\`\`${language}\\s*([\\s\\S]*?)\`\`\``
        : '\`\`\`(?:\\w+)?\\s*([\\s\\S]*?)\`\`\`';
    const match = String(text || '').match(new RegExp(pattern, 'i'));
    return match ? match[1].trim() : '';
}

function createLocalFixCode(userRequest) {
    const source = extractFirstFencedBlock(userRequest, 'python');
    const errorText = extractFirstFencedBlock(userRequest, 'text') || userRequest;
    if (!source) return '';
    const missingName = errorText.match(/NameError:\s+name ['"]([^'"]+)['"] is not defined/i);
    if (missingName) {
        const name = missingName[1];
        const imports = {
            pd: 'import pandas as pd',
            np: 'import numpy as np',
            plt: 'import matplotlib.pyplot as plt'
        };
        if (imports[name] && !source.includes(imports[name])) {
            return `${imports[name]}\n\n${source}`;
        }
        if (name === 'df') {
            return [
                'from pathlib import Path',
                'import pandas as pd',
                '',
                'csv_files = sorted(Path(".").glob("*.csv"))',
                'print("Available CSV files:", [str(path) for path in csv_files])',
                'if csv_files:',
                '    df = pd.read_csv(csv_files[0])',
                '    display(df.head())',
                'else:',
                '    print("Upload or mount a CSV file, then rerun the analysis cell.")'
            ].join('\n');
        }
    }
    const attrMatch = errorText.match(/AttributeError:.*object has no attribute ['"]([^'"]+)['"]/i);
    if (attrMatch) {
        const attr = attrMatch[1];
        const attributePattern = new RegExp(`\\.${attr}\\b`, 'g');
        if (attributePattern.test(source)) {
            return source.replace(attributePattern, `["${attr}"]`);
        }
    }
    return [
        '# Draft diagnostic for the failing cell.',
        '# Switch to Browser Gemma or WebMCP for a model-generated repair.',
        'try:',
        ...source.split('\n').map(line => `    ${line || ' '}`),
        'except Exception as error:',
        '    print(type(error).__name__, error)',
        '    print("Available names:", sorted(name for name in globals() if not name.startswith("_"))[:40])'
    ].join('\n');
}

function createDraftResponse(userRequest, context) {
    const selected = context.selectedCell;
    const wantsFix = /fix.*error|runtime returned this error|traceback|exception/i.test(userRequest);
    const wantsChart = /chart|plot|visual|graph/i.test(userRequest);
    const wantsData = /csv|data|load|file/i.test(userRequest);
    const wantsClean = /clean|missing|null|dedupe|duplicate/i.test(userRequest);
    let code;
    if (wantsFix) {
        code = createLocalFixCode(userRequest) || [
            '# Draft diagnostic for the failing cell.',
            '# Switch to Browser Gemma or WebMCP for a model-generated repair.',
            'print("No executable source was captured for local repair.")'
        ].join('\n');
    } else if (wantsData) {
        code = [
            'from pathlib import Path',
            'import pandas as pd',
            '',
            '# Replace the filename after uploading or mounting your data.',
            'data_path = Path("data.csv")',
            'df = pd.read_csv(data_path)',
            'df.head()'
        ].join('\n');
    } else if (wantsChart) {
        code = [
            'import matplotlib.pyplot as plt',
            '',
            'numeric = df.select_dtypes(include="number")',
            'numeric.hist(figsize=(10, 6), bins=24)',
            'plt.tight_layout()',
            'plt.show()'
        ].join('\n');
    } else if (wantsClean) {
        code = [
            'summary = pd.DataFrame({',
            '    "dtype": df.dtypes.astype(str),',
            '    "missing": df.isna().sum(),',
            '    "missing_pct": df.isna().mean().round(3),',
            '    "unique": df.nunique(dropna=True)',
            '})',
            'summary.sort_values("missing", ascending=False)'
        ].join('\n');
    } else if (selected && selected.cell_type === 'code' && selected.outputs.length) {
        code = [
            '# Follow-up check based on the selected output',
            'df.describe(include="all").transpose()'
        ].join('\n');
    } else {
        code = [
            'import pandas as pd',
            '',
            '# First pass: inspect the working dataframe.',
            'df.info()',
            'df.describe(include="all").transpose()'
        ].join('\n');
    }
    return [
        'Here is a focused next cell for the notebook.',
        '',
        '```python',
        code,
        '```'
    ].join('\n');
}

async function requestAgentRaw(prompt, settings, fallbackRequest, context) {
    if (settings.mode === 'webmcp') {
        return requestWebMcpAgent(prompt, settings);
    }
    if (settings.mode === 'gemma') {
        return requestGemmaAgent(prompt, settings);
    }
    return createDraftResponse(fallbackRequest || prompt, context);
}

async function generateAgentCell(userRequest, settings, selectedId) {
    const context = compactNotebookContext(notebook, selectedId, settings);
    const agentPrompt = buildAgentPrompt(userRequest, context, settings);
    const raw = await requestAgentRaw(agentPrompt, settings, userRequest, context);
    const parsed = parseAgentResponse(raw);
    parsed.code = sanitizeGeneratedCode(parsed.code, context);
    if (!parsed.code && settings.mode === 'gemma') {
        const fallback = parseAgentResponse(createDraftResponse(userRequest, context));
        parsed.explanation = 'I prepared a safe starter cell for this request.';
        parsed.code = sanitizeGeneratedCode(fallback.code, context);
    }
    return { context, parsed };
}

async function runAgentLoop(userRequest, options = {}) {
    const settings = options.settings || getSettings();
    const maxIterations = Math.max(1, Math.min(3, options.maxIterations || 1));
    let currentRequest = userRequest;
    let lastParsed = null;
    for (let attempt = 1; attempt <= maxIterations; attempt += 1) {
        const selectedBeforeInsert = selectedCellId;
        const { context, parsed } = await generateAgentCell(currentRequest, settings, selectedBeforeInsert);
        lastParsed = parsed;
        if (!parsed.code) return { parsed, attempts: attempt, ran: false, fixed: false };

        notebook = insertGeneratedCell(notebook, selectedBeforeInsert, parsed.code, parsed.explanation);
        const insertedIndex = Math.min(notebook.cells.length - 1, context.selectedIndex + (parsed.explanation ? 2 : 1));
        const generatedCell = notebook.cells[insertedIndex];
        selectedCellId = generatedCell.id;
        render();

        if (!options.runGenerated || generatedCell.cell_type !== 'code') {
            return { parsed, attempts: attempt, ran: false, fixed: false, cell: generatedCell };
        }

        addMessage('assistant', `<p>Running generated fix attempt ${attempt}...</p>`);
        const nextCell = await runCell(generatedCell);
        updateCell(generatedCell.id, nextCell);
        selectedCellId = generatedCell.id;
        render();

        if (!outputHasError(nextCell.outputs)) {
            return { parsed, attempts: attempt, ran: true, fixed: true, cell: nextCell };
        }

        if (attempt < maxIterations) {
            currentRequest = buildRetryAfterErrorRequest(userRequest, generatedCell.source, nextCell.outputs);
        } else {
            return { parsed, attempts: attempt, ran: true, fixed: false, cell: nextCell };
        }
    }
    return { parsed: lastParsed, attempts: maxIterations, ran: Boolean(options.runGenerated), fixed: false };
}

function insertGeneratedCell(doc, selectedId, code, explanation) {
    const index = doc.cells.findIndex(cell => cell.id === selectedId);
    const insertAt = index >= 0 ? index + 1 : doc.cells.length;
    const cells = doc.cells.slice();
    if (explanation) {
        cells.splice(insertAt, 0, createCell('markdown', explanation));
        cells.splice(insertAt + 1, 0, createCell('code', code));
    } else {
        cells.splice(insertAt, 0, createCell('code', code));
    }
    return { ...doc, cells };
}

function loadScriptOnce(src) {
    const existing = document.querySelector && document.querySelector(`script[src="${src}"]`);
    if (existing) {
        return existing.dataset.loaded === 'true'
            ? Promise.resolve()
            : new Promise((resolve, reject) => {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', reject, { once: true });
            });
    }
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', () => reject(new Error(`Could not load ${src}`)), { once: true });
        document.head.appendChild(script);
    });
}

async function requestWebMcpAgent(prompt, settings) {
    if (!settings.webmcpUrl) {
        throw new Error('Add a WebMCP endpoint before using WebMCP mode.');
    }
    const response = await fetch(settings.webmcpUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            type: 'notebook-studio.generate-cell',
            modelUrl: modelLabelFromSettings(settings),
            prompt
        })
    });
    if (!response.ok) {
        throw new Error(`WebMCP request failed: ${response.status}`);
    }
    const payload = await response.json();
    return payload.text || payload.message || payload.content || '';
}

function renderGemmaStatus() {
    const status = document.getElementById('gemmaStatus');
    if (!status) return;
    if (gemmaState.status === 'loading') {
        const warning = gemmaState.warning ? `${gemmaState.warning} ` : '';
        status.textContent = `${warning}Loading ${gemmaState.modelKey}: ${formatModelProgress(gemmaState.progress)}`;
    } else if (gemmaState.status === 'ready') {
        status.textContent = `Ready: ${gemmaState.modelKey}`;
    } else if (gemmaState.status === 'failed') {
        status.textContent = gemmaState.error || 'Gemma failed to load.';
    } else {
        status.textContent = 'Default is Qwen2.5 Coder 0.5B Q8_0 with the Fast profile for quicker browser notebook-cell generation.';
    }
    const agentMode = document.getElementById('agentMode');
    const agentStatus = document.getElementById('agentStatus');
    if (agentMode && agentStatus && agentMode.value === 'gemma') {
        agentStatus.textContent = gemmaState.loaded ? 'gemma ready' : 'browser gemma';
        agentStatus.classList.toggle('ready', gemmaState.loaded);
    }
}

function shouldSuppressWllamaLog(args) {
    const text = Array.from(args || []).map(item => String(item)).join(' ');
    return [
        /control-looking token/i,
        /llama_context: n_ctx_seq .* < n_ctx_train/i,
        /common_speculative_init: no implementations specified/i,
        /bad special token/i
    ].some(pattern => pattern.test(text));
}

function createWllamaLogger(baseLogger = console) {
    const fallback = () => {};
    return {
        debug: fallback,
        log: (...args) => {
            if (!shouldSuppressWllamaLog(args)) (baseLogger.log || fallback).apply(baseLogger, args);
        },
        warn: (...args) => {
            if (!shouldSuppressWllamaLog(args)) (baseLogger.warn || fallback).apply(baseLogger, args);
        },
        error: (...args) => (baseLogger.error || fallback).apply(baseLogger, args)
    };
}

async function loadWllamaModule() {
    if (!wllamaModulePromise) {
        wllamaModulePromise = import(WLLAMA_MODULE_URL).then(module => ({
            Wllama: module.Wllama,
            configPaths: {
                default: WLLAMA_WASM_URL
            }
        }));
    }
    return wllamaModulePromise;
}

async function loadModelFromHf(wllama, hfOptions, loadParams) {
    if (wllama.loadModelFromUrl) {
        return wllama.loadModelFromUrl(createHfDownloadUrl(hfOptions), {
            ...loadParams,
            useCache: false
        });
    }
    try {
        if (wllama.loadModelFromHF.length >= 3) {
            return await wllama.loadModelFromHF(hfOptions.repo, hfOptions.file, loadParams);
        }
        return await wllama.loadModelFromHF(hfOptions, loadParams);
    } catch (error) {
        const message = error && error.message ? error.message : String(error);
        if (!/Model file not found/i.test(message) || !wllama.loadModelFromUrl) {
            throw error;
        }
        gemmaState.warning = `${gemmaState.warning ? `${gemmaState.warning} ` : ''}Retrying without browser cache.`;
        renderGemmaStatus();
        throw error;
    }
}

async function ensureBrowserGemma(settings = getSettings()) {
    const { hfOptions, loadParams } = buildWllamaLoadParams(settings, progress => {
        gemmaState.progress = progress;
        renderGemmaStatus();
    });
    const modelKey = `${hfOptions.repo}:${hfOptions.file}`;
    if (wllamaInstance && gemmaState.loaded && gemmaState.modelKey === modelKey) {
        return wllamaInstance;
    }
    gemmaState.status = 'loading';
    gemmaState.loaded = false;
    gemmaState.modelKey = modelKey;
    gemmaState.progress = null;
    gemmaState.error = '';
    gemmaState.warning = '';
    renderGemmaStatus();
    try {
        const preflight = await preflightBrowserGguf(hfOptions);
        gemmaState.warning = preflight.warning;
        renderGemmaStatus();
        const { Wllama, configPaths } = await loadWllamaModule();
        wllamaInstance = new Wllama(configPaths, {
            logger: createWllamaLogger(console)
        });
        await loadModelFromHf(wllamaInstance, hfOptions, loadParams);
        gemmaState.status = 'ready';
        gemmaState.loaded = true;
        renderGemmaStatus();
        return wllamaInstance;
    } catch (error) {
        gemmaState.status = 'failed';
        gemmaState.loaded = false;
        gemmaState.error = error.message || String(error);
        renderGemmaStatus();
        throw new Error(gemmaState.error);
    }
}

async function requestGemmaAgent(prompt, settings) {
    const wllama = await ensureBrowserGemma(settings);
    const messages = buildGemmaMessages(compactPromptToFit(prompt, settings));
    const options = {
        temperature: getAgentProfile(settings).concise ? 0.25 : 0.4,
        max_tokens: normalizeMaxTokens(settings.gemmaMaxTokens),
        top_k: 32,
        top_p: 0.9
    };
    const response = wllama.createChatCompletion.length >= 2
        ? await wllama.createChatCompletion(messages, options)
        : await wllama.createChatCompletion({ messages, ...options });
    if (typeof response === 'string') return response;
    return response && response.choices && response.choices[0] && response.choices[0].message
        ? response.choices[0].message.content || ''
        : '';
}
