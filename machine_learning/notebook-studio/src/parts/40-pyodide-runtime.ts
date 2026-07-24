async function ensurePyodideRuntime() {
    if (pyodidePromise) return pyodidePromise;
    runtimeState.status = 'loading Pyodide';
    renderRuntimeStatus();
    pyodidePromise = (async () => {
        if (!window.loadPyodide) {
            await loadScriptOnce(PYODIDE_SCRIPT_URL);
        }
        if (!window.loadPyodide) {
            throw new Error('Pyodide loader is unavailable after loading the script.');
        }
        const pyodide = await window.loadPyodide({
            indexURL: PYODIDE_BASE_URL,
            stdout: text => appendRuntimeLine(text, 'stdout'),
            stderr: text => appendRuntimeLine(text, 'stderr')
        });
        window.pyodide = pyodide;
        pyodideReady = true;
        await mountVirtualFiles(pyodide);
        runtimeState.status = 'ready';
        renderRuntimeStatus();
        return pyodide;
    })();
    try {
        return await pyodidePromise;
    } catch (error) {
        pyodidePromise = null;
        pyodideReady = false;
        runtimeState.status = 'failed';
        renderRuntimeStatus();
        throw error;
    }
}

function appendRuntimeLine(text, stream) {
    const status = document.getElementById('runtimeStatus');
    if (!status) return;
    const label = stream === 'stderr' ? 'stderr' : 'stdout';
    status.textContent = `${label}: ${String(text).slice(0, 48)}`;
}

async function loadRequestedPackages(packages) {
    const requested = parsePackageList(packages);
    const missing = requested.filter(name => !runtimeState.loadedPackages.has(name));
    if (!missing.length) return [];
    const pyodide = await ensurePyodideRuntime();
    runtimeState.status = `loading ${missing.join(', ')}`;
    renderRuntimeStatus();
    await pyodide.loadPackage(missing);
    missing.forEach(name => runtimeState.loadedPackages.add(name));
    runtimeState.status = 'ready';
    renderRuntimeStatus();
    return missing;
}

async function loadPackagesFromImports(code) {
    const pyodide = await ensurePyodideRuntime();
    if (typeof pyodide.loadPackagesFromImports === 'function') {
        runtimeState.status = 'checking imports';
        renderRuntimeStatus();
        await pyodide.loadPackagesFromImports(code);
    }
}

async function mountFile(file) {
    if (!file) return null;
    const pyodide = await ensurePyodideRuntime();
    const bytes = new Uint8Array(await file.arrayBuffer());
    pyodide.FS.writeFile(file.name, bytes);
    rememberMountedFile(file.name);
    runtimeState.status = `mounted ${file.name}`;
    renderRuntimeStatus();
    return file.name;
}

async function mountVirtualFiles(pyodide = window.pyodide) {
    if (!pyodide) return [];
    const mounted = [];
    virtualFiles.forEach((content, name) => {
        pyodide.FS.writeFile(name, content);
        rememberMountedFile(name);
        mounted.push(name);
    });
    renderRuntimeStatus();
    return mounted;
}

function loadSalesDemo() {
    virtualFiles.set('sales_demo.csv', createSalesDemoCsv());
    setNotebook(createSalesDemoNotebook());
    runtimeState.status = 'demo ready';
    if (pyodideReady && window.pyodide) {
        mountVirtualFiles(window.pyodide);
    } else {
        rememberMountedFile('sales_demo.csv');
        renderRuntimeStatus();
    }
    addMessage('assistant', '<p>Loaded the sales demo notebook and queued <code>sales_demo.csv</code>. Use Run All to execute the example once Pyodide finishes loading.</p>');
}

async function captureMatplotlibImages(pyodide) {
    const code = [
        'import base64, io, json',
        'try:',
        '    import matplotlib.pyplot as plt',
        '    _notebook_pilot_images = []',
        '    for _figure_number in plt.get_fignums():',
        '        _buffer = io.BytesIO()',
        '        plt.figure(_figure_number).savefig(_buffer, format="png", bbox_inches="tight")',
        '        _notebook_pilot_images.append(base64.b64encode(_buffer.getvalue()).decode("ascii"))',
        '    plt.close("all")',
        '    json.dumps(_notebook_pilot_images)',
        'except Exception as _error:',
        '    json.dumps([])'
    ].join('\n');
    const images = await pyodide.runPythonAsync(code);
    try {
        return JSON.parse(String(images || '[]'));
    } catch (error) {
        return [];
    }
}

async function runPythonCode(code, packages) {
    const pyodide = await ensurePyodideRuntime();
    await loadRequestedPackages(packages);
    await loadPackagesFromImports(code);
    try {
        runtimeState.status = 'running';
        renderRuntimeStatus();
        pyodide.globals.set('_notebook_pilot_source', code);
        const rawPayload = await pyodide.runPythonAsync(buildNotebookRunnerCode());
        const payload = JSON.parse(String(rawPayload || '{}'));
        runtimeState.status = 'ready';
        renderRuntimeStatus();
        if (payload.error) {
            const outputs = outputsFromPythonPayload(payload);
            outputs.push({
                output_type: 'error',
                ename: payload.error.name || 'PythonError',
                evalue: payload.error.message || '',
                traceback: payload.error.traceback || []
            });
            return outputs;
        }
        return outputsFromPythonPayload(payload);
    } catch (error) {
        runtimeState.status = 'ready';
        renderRuntimeStatus();
        return [createErrorOutput(error)];
    } finally {
        try {
            pyodide.runPython('globals().pop("_notebook_pilot_source", None)');
        } catch (error) {
            // Runtime cleanup is best-effort after execution failures.
        }
    }
}

async function runCell(cell) {
    if (!cell) return null;
    if (cell.cell_type === 'markdown') {
        return {
            ...cell,
            metadata: {
                ...(cell.metadata || {}),
                notebookPilotRendered: true
            }
        };
    }
    if (cell.cell_type !== 'code') return cell;
    const outputs = await runPythonCode(cell.source, document.getElementById('packageInput').value);
    return {
        ...cell,
        execution_count: (cell.execution_count || 0) + 1,
        outputs
    };
}

async function runAllCells() {
    const runAllButton = document.getElementById('runAllBtn');
    runAllButton.disabled = true;
    try {
        for (let index = 0; index < notebook.cells.length; index += 1) {
            const cell = notebook.cells[index];
            selectedCellId = cell.id;
            render();
            const nextCell = await runCell(cell);
            updateCell(cell.id, nextCell);
            render();
        }
        addMessage('assistant', '<p>Finished running all code cells.</p>');
    } catch (error) {
        addMessage('assistant', `<p>${escapeHtml(error.message || String(error))}</p>`);
    } finally {
        runAllButton.disabled = false;
        renderRuntimeStatus();
    }
}
