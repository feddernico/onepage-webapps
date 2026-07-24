function parsePackageList(value) {
    return String(value || '')
        .split(',')
        .map(item => item.trim().toLowerCase())
        .filter(Boolean)
        .filter((item, index, items) => items.indexOf(item) === index);
}

function createStreamOutput(text, name = 'stdout') {
    return {
        output_type: 'stream',
        name,
        text: String(text || '')
    };
}

function createResultOutput(result) {
    return {
        output_type: 'execute_result',
        execution_count: null,
        data: { 'text/plain': result === undefined || result === null ? '' : String(result) },
        metadata: {}
    };
}

function createRichResultOutput(text, html) {
    const data = { 'text/plain': text || '' };
    if (html) data['text/html'] = html;
    return {
        output_type: 'execute_result',
        execution_count: null,
        data,
        metadata: {}
    };
}

function createErrorOutput(error) {
    return {
        output_type: 'error',
        ename: error.name || 'PythonError',
        evalue: error.message || String(error),
        traceback: []
    };
}

function filterStreamText(text) {
    return String(text || '')
        .split('\n')
        .filter(line => !line.includes('FigureCanvasAgg is non-interactive'))
        .join('\n')
        .trim();
}

function combineRunOutputs(stdout, stderr, resultOutput, images) {
    const outputs = [];
    const cleanStdout = filterStreamText(stdout);
    const cleanStderr = filterStreamText(stderr);
    if (cleanStdout) outputs.push(createStreamOutput(cleanStdout, 'stdout'));
    if (cleanStderr) outputs.push(createStreamOutput(cleanStderr, 'stderr'));
    if (resultOutput && outputToText(resultOutput) && !/^Figure\(/.test(outputToText(resultOutput))) {
        outputs.push(resultOutput);
    }
    images.forEach((image, index) => {
        outputs.push({
            output_type: 'display_data',
            data: {
                'text/plain': `<Figure ${index + 1}>`,
                'image/png': image
            },
            metadata: {}
        });
    });
    return outputs.length ? outputs : [createStreamOutput('Done.')];
}

function outputsFromPythonPayload(payload) {
    const outputs = [];
    const cleanStdout = filterStreamText(payload && payload.stdout);
    const cleanStderr = filterStreamText(payload && payload.stderr);
    if (cleanStdout) outputs.push(createStreamOutput(cleanStdout, 'stdout'));
    if (cleanStderr) outputs.push(createStreamOutput(cleanStderr, 'stderr'));
    if (payload && payload.result && payload.result.text && !/^Figure\(/.test(payload.result.text)) {
        outputs.push(createRichResultOutput(payload.result.text, payload.result.html || ''));
    }
    (payload && payload.images || []).forEach((image, index) => {
        outputs.push({
            output_type: 'display_data',
            data: {
                'text/plain': `<Figure ${index + 1}>`,
                'image/png': image
            },
            metadata: {}
        });
    });
    return outputs.length ? outputs : [createStreamOutput('Done.')];
}

function sanitizeOutputHtml(html) {
    return String(html || '')
        .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, '')
        .replace(/<\s*(script|style|iframe|object|embed|link|meta)[^>]*\/?\s*>/gi, '')
        .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\s+style\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
        .replace(/\s+srcdoc\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
}

function pyProxyToArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value.toJs === 'function') {
        const converted = value.toJs();
        if (typeof value.destroy === 'function') value.destroy();
        return Array.isArray(converted) ? converted : [];
    }
    return [];
}

function pyProxyToResultOutput(pyodide, value) {
    if (value === undefined || value === null) return null;
    if (typeof value.toJs !== 'function') {
        const text = String(value);
        return text ? createRichResultOutput(text, '') : null;
    }
    try {
        pyodide.globals.set('_notebook_pilot_last_result', value);
        const rich = pyodide.runPython([
            'try:',
            '    _obj = _notebook_pilot_last_result',
            '    _html = _obj._repr_html_() if hasattr(_obj, "_repr_html_") else ""',
            '    _text = repr(_obj)',
            '    (_text, _html or "")',
            'except Exception as _error:',
            '    (str(_notebook_pilot_last_result), "")'
        ].join('\n'));
        const parts = pyProxyToArray(rich);
        const text = parts[0] || String(value);
        const html = parts[1] || '';
        return createRichResultOutput(text, html);
    } finally {
        try {
            pyodide.runPython('globals().pop("_notebook_pilot_last_result", None)');
        } catch (error) {
            // Nothing to clean up if the runtime is already unwinding.
        }
        if (typeof value.destroy === 'function') value.destroy();
    }
}

function buildNotebookRunnerCode() {
    return [
        'import ast, base64, contextlib, io, json, traceback, warnings',
        '',
        'def _notebook_pilot_run_cell(_source):',
        '    _stdout = io.StringIO()',
        '    _stderr = io.StringIO()',
        '    _result = None',
        '    _images = []',
        '    try:',
        '        try:',
        '            import matplotlib',
        '            matplotlib.use("Agg", force=True)',
        '            import matplotlib.pyplot as plt',
        '            plt.show = lambda *args, **kwargs: None',
        '        except Exception:',
        '            plt = None',
        '        _tree = ast.parse(_source, mode="exec")',
        '        _body = list(_tree.body)',
        '        _last_expr = _body[-1] if _body and isinstance(_body[-1], ast.Expr) else None',
        '        _exec_body = _body[:-1] if _last_expr else _body',
        '        with contextlib.redirect_stdout(_stdout), contextlib.redirect_stderr(_stderr):',
        '            with warnings.catch_warnings():',
        '                warnings.filterwarnings("ignore", message="FigureCanvasAgg is non-interactive.*")',
        '                if _exec_body:',
        '                    _exec_tree = ast.Module(body=_exec_body, type_ignores=[])',
        '                    ast.fix_missing_locations(_exec_tree)',
        '                    exec(compile(_exec_tree, "<cell>", "exec"), globals())',
        '                if _last_expr:',
        '                    _expr = ast.Expression(_last_expr.value)',
        '                    ast.fix_missing_locations(_expr)',
        '                    _value = eval(compile(_expr, "<cell>", "eval"), globals())',
        '                    if _value is not None:',
        '                        _html = _value._repr_html_() if hasattr(_value, "_repr_html_") else ""',
        '                        _result = {"text": repr(_value), "html": _html or ""}',
        '        try:',
        '            import matplotlib.pyplot as plt',
        '            for _figure_number in plt.get_fignums():',
        '                _buffer = io.BytesIO()',
        '                plt.figure(_figure_number).savefig(_buffer, format="png", bbox_inches="tight")',
        '                _images.append(base64.b64encode(_buffer.getvalue()).decode("ascii"))',
        '            plt.close("all")',
        '        except Exception:',
        '            pass',
        '        return json.dumps({"stdout": _stdout.getvalue(), "stderr": _stderr.getvalue(), "result": _result, "images": _images})',
        '    except Exception as _error:',
        '        return json.dumps({"stdout": _stdout.getvalue(), "stderr": _stderr.getvalue(), "error": {"name": type(_error).__name__, "message": str(_error), "traceback": traceback.format_exc().splitlines()}})',
        '',
        '_notebook_pilot_run_cell(_notebook_pilot_source)'
    ].join('\n');
}
