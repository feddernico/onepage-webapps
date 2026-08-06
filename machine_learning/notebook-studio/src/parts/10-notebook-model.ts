function uid(prefix = 'cell') {
    return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function createCell(cellType, source = '', outputs = []) {
    return {
        id: uid(),
        cell_type: cellType,
        source,
        outputs,
        execution_count: null,
        metadata: {}
    };
}

function createBlankNotebook() {
    return {
        nbformat: NOTEBOOK_VERSION,
        nbformat_minor: 5,
        metadata: {
            kernelspec: {
                display_name: 'Python 3',
                language: 'python',
                name: 'python3'
            },
            notebookPilot: {
                modelUrl: DEFAULT_MODEL_URL,
                gemmaRepo: DEFAULT_GEMMA_REPO,
                gemmaFile: DEFAULT_GEMMA_FILE,
                runtime: 'pyodide',
                pyodideVersion: PYODIDE_VERSION
            }
        },
        cells: [
            createCell('markdown', '# Analysis notebook\n\nAsk the pilot to add the first Python step.'),
            createCell('code', 'import pandas as pd\nimport numpy as np\n\n# Upload data or ask the pilot for a starter analysis.')
        ]
    };
}

function createSalesDemoCsv() {
    return [
        'date,region,channel,product,units,unit_price',
        '2026-01-05,North,Online,Starter Kit,24,49',
        '2026-01-08,South,Retail,Notebook Pack,18,35',
        '2026-01-15,West,Partner,Starter Kit,31,47',
        '2026-02-04,North,Retail,Dashboard Pro,11,129',
        '2026-02-18,East,Online,Notebook Pack,42,34',
        '2026-03-02,South,Partner,Dashboard Pro,9,135',
        '2026-03-21,West,Online,Starter Kit,36,48',
        '2026-04-03,East,Retail,Starter Kit,21,50',
        '2026-04-16,North,Partner,Notebook Pack,29,36',
        '2026-05-09,South,Online,Dashboard Pro,14,132',
        '2026-05-29,West,Retail,Notebook Pack,25,35',
        '2026-06-07,East,Partner,Starter Kit,33,46',
        '2026-06-19,North,Online,Dashboard Pro,17,128',
        '2026-07-02,South,Retail,Starter Kit,22,49',
        '2026-07-14,West,Partner,Dashboard Pro,12,134',
        '2026-08-04,East,Online,Notebook Pack,39,33',
        '2026-08-18,North,Retail,Starter Kit,26,48',
        '2026-09-01,South,Partner,Notebook Pack,28,37',
        '2026-09-20,West,Online,Dashboard Pro,18,130',
        '2026-10-05,East,Retail,Notebook Pack,23,36',
        '2026-10-22,North,Partner,Starter Kit,34,47',
        '2026-11-06,South,Online,Starter Kit,41,49',
        '2026-11-26,West,Retail,Dashboard Pro,13,131',
        '2026-12-09,East,Partner,Notebook Pack,30,35'
    ].join('\n');
}

function createSalesDemoNotebook() {
    return {
        ...createBlankNotebook(),
        metadata: {
            ...createBlankNotebook().metadata,
            notebookPilot: {
                modelUrl: DEFAULT_MODEL_URL,
                gemmaRepo: DEFAULT_GEMMA_REPO,
                gemmaFile: DEFAULT_GEMMA_FILE,
                runtime: 'pyodide',
                pyodideVersion: PYODIDE_VERSION,
                demoFiles: ['sales_demo.csv']
            }
        },
        cells: [
            createCell('markdown', '# Sales demo\n\nThis demo mounts `sales_demo.csv`, loads it with pandas, summarizes revenue, and draws a matplotlib chart.'),
            createCell('code', [
                'import pandas as pd',
                '',
                'df = pd.read_csv("sales_demo.csv", parse_dates=["date"])',
                'df["revenue"] = df["units"] * df["unit_price"]',
                'print(f"Loaded {len(df)} rows from sales_demo.csv")',
                'df.head()'
            ].join('\n')),
            createCell('code', [
                'channel_summary = (',
                '    df.groupby("channel")',
                '      .agg(orders=("date", "count"), units=("units", "sum"), revenue=("revenue", "sum"))',
                '      .sort_values("revenue", ascending=False)',
                ')',
                'channel_summary'
            ].join('\n')),
            createCell('code', [
                'import matplotlib.pyplot as plt',
                '',
                'monthly = df.set_index("date").resample("ME")["revenue"].sum()',
                'fig, ax = plt.subplots(figsize=(9, 4))',
                'monthly.plot(ax=ax, marker="o", color="#0d9488")',
                'ax.set_title("Monthly revenue")',
                'ax.set_xlabel("Month")',
                'ax.set_ylabel("Revenue")',
                'ax.grid(True, alpha=0.25)',
                'plt.tight_layout()',
                'plt.show()'
            ].join('\n')),
            createCell('markdown', 'Ask the pilot: `What follow-up analysis should I run next?`')
        ]
    };
}

function createLearningToRankNotebook() {
    return {
        ...createBlankNotebook(),
        metadata: {
            ...createBlankNotebook().metadata,
            notebookPilot: {
                modelUrl: DEFAULT_MODEL_URL,
                gemmaRepo: DEFAULT_GEMMA_REPO,
                gemmaFile: DEFAULT_GEMMA_FILE,
                runtime: 'pyodide',
                pyodideVersion: PYODIDE_VERSION,
                demo: 'learning-to-rank'
            }
        },
        cells: [
            createCell('markdown', '# Learning to Rank playground\n\nThis small browser-safe example trains a linear RankNet-style scorer on synthetic query groups. It compares the ranking before and after pairwise training, then measures NDCG@3.'),
            createCell('code', [
                'import numpy as np',
                'import matplotlib.pyplot as plt',
                '',
                '# Each query group contains document features and graded relevance labels.',
                'query_groups = [',
                '    {',
                '        "query": "best laptop for data science",',
                '        "features": np.array([[0.95, 0.90], [0.70, 0.55], [0.35, 0.80], [0.20, 0.25]]),',
                '        "relevance": np.array([3, 2, 1, 0])',
                '    },',
                '    {',
                '        "query": "python ranking tutorial",',
                '        "features": np.array([[0.88, 0.35], [0.60, 0.92], [0.42, 0.68], [0.10, 0.20]]),',
                '        "relevance": np.array([3, 2, 1, 0])',
                '    }',
                ']',
                '',
                'def ndcg_at_k(relevance, scores, k=3):',
                '    order = np.argsort(-scores)[:k]',
                '    gains = (2 ** relevance[order] - 1) / np.log2(np.arange(2, k + 2))',
                '    ideal = np.sort(relevance)[::-1][:k]',
                '    ideal_gains = (2 ** ideal - 1) / np.log2(np.arange(2, k + 2))',
                '    return float(gains.sum() / ideal_gains.sum()) if ideal_gains.sum() else 0.0',
                '',
                'def print_rankings(weights, label):',
                '    print(label)',
                '    for group in query_groups:',
                '        scores = group["features"] @ weights',
                '        order = np.argsort(-scores)',
                '        print(group["query"], "→", order.tolist(), "NDCG@3:", round(ndcg_at_k(group["relevance"], scores), 3))',
                '',
                'weights = np.array([-0.45, 0.35])',
                'print_rankings(weights, "Before training")'
            ].join('\n')),
            createCell('code', [
                'def train_ranknet(groups, weights, epochs=160, learning_rate=0.08):',
                '    losses = []',
                '    ndcg_history = []',
                '    for _ in range(epochs):',
                '        total_loss = 0.0',
                '        gradient = np.zeros_like(weights)',
                '        pair_count = 0',
                '        for group in groups:',
                '            features = group["features"]',
                '            relevance = group["relevance"]',
                '            scores = features @ weights',
                '            for i in range(len(relevance)):',
                '                for j in range(len(relevance)):',
                '                    if relevance[i] <= relevance[j]:',
                '                        continue',
                '                    logit = scores[i] - scores[j]',
                '                    probability = 1 / (1 + np.exp(-logit))',
                '                    total_loss += np.logaddexp(0, -logit)',
                '                    gradient += (probability - 1) * (features[i] - features[j])',
                '                    pair_count += 1',
                '        weights -= learning_rate * gradient / pair_count',
                '        losses.append(total_loss / pair_count)',
                '        ndcg_history.append(np.mean([ndcg_at_k(g["relevance"], g["features"] @ weights) for g in groups]))',
                '    return weights, losses, ndcg_history',
                '',
                'trained_weights, losses, ndcg_history = train_ranknet(query_groups, weights.copy())',
                'print_rankings(trained_weights, "After pairwise training")'
            ].join('\n')),
            createCell('code', [
                'fig, axes = plt.subplots(1, 2, figsize=(10, 4))',
                'axes[0].plot(losses, color="#c35b3d")',
                'axes[0].set_title("Pairwise logistic loss")',
                'axes[0].set_xlabel("Training epoch")',
                'axes[0].set_ylabel("Loss")',
                'axes[1].plot(ndcg_history, color="#2d7771")',
                'axes[1].set_title("Mean NDCG@3")',
                'axes[1].set_xlabel("Training epoch")',
                'axes[1].set_ylim(0, 1.05)',
                'plt.tight_layout()',
                'plt.show()'
            ].join('\n')),
            createCell('markdown', '## What to notice\n\nRankNet does not need the exact relevance score to be perfect. It learns which document should beat another document from the same query. LambdaRank extends this idea by weighting pairwise updates according to their impact on a metric such as NDCG. Try changing the feature values, relevance labels, learning rate, or number of epochs and run the cells again.')
        ]
    };
}

function sourceToString(source) {
    return Array.isArray(source) ? source.join('') : String(source || '');
}

function sourceToLines(source) {
    const text = sourceToString(source);
    if (!text) return [];
    return text.match(/.*(?:\n|$)/g).filter(line => line.length > 0);
}

function normalizeOutputs(outputs) {
    if (!Array.isArray(outputs)) return [];
    return outputs.map(output => {
        if (typeof output === 'string') {
            return { output_type: 'stream', name: 'stdout', text: output };
        }
        return output || {};
    });
}

function normalizeNotebook(input) {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;
    const cells = Array.isArray(parsed.cells) ? parsed.cells : [];
    const metadata = {
        ...(parsed.metadata || {}),
        notebookPilot: {
            modelUrl: DEFAULT_MODEL_URL,
            gemmaRepo: DEFAULT_GEMMA_REPO,
            gemmaFile: DEFAULT_GEMMA_FILE,
            runtime: 'pyodide',
            pyodideVersion: PYODIDE_VERSION,
            ...((parsed.metadata || {}).notebookPilot || {})
        }
    };
    return {
        nbformat: parsed.nbformat || NOTEBOOK_VERSION,
        nbformat_minor: parsed.nbformat_minor || 5,
        metadata,
        cells: cells.map(cell => ({
            id: cell.id || uid(),
            cell_type: cell.cell_type === 'markdown' ? 'markdown' : 'code',
            source: sourceToString(cell.source),
            outputs: normalizeOutputs(cell.outputs),
            execution_count: cell.execution_count || null,
            metadata: cell.metadata || {}
        }))
    };
}

function notebookToIpynb(doc) {
    return {
        nbformat: doc.nbformat || NOTEBOOK_VERSION,
        nbformat_minor: doc.nbformat_minor || 5,
        metadata: doc.metadata || {},
        cells: doc.cells.map(cell => {
            const base = {
                cell_type: cell.cell_type,
                id: cell.id,
                metadata: cell.metadata || {},
                source: sourceToLines(cell.source)
            };
            if (cell.cell_type === 'code') {
                return {
                    ...base,
                    execution_count: cell.execution_count || null,
                    outputs: normalizeOutputs(cell.outputs)
                };
            }
            return base;
        })
    };
}

function outputToText(output) {
    if (!output) return '';
    if (output.text) return sourceToString(output.text);
    if (output.evalue) {
        const traceback = Array.isArray(output.traceback)
            ? output.traceback.join('\n')
            : sourceToString(output.traceback);
        return [`${output.ename || 'Error'}: ${output.evalue}`, traceback].filter(Boolean).join('\n');
    }
    if (output.data) {
        return sourceToString(output.data['text/plain'] || '');
    }
    return '';
}

function outputHasError(outputs) {
    return normalizeOutputs(outputs).some(output => output.output_type === 'error');
}

function errorOutputsToText(outputs) {
    return normalizeOutputs(outputs)
        .filter(output => output.output_type === 'error')
        .map(outputToText)
        .filter(Boolean)
        .join('\n\n');
}

function truncateText(value, maxLength = 1200) {
    const text = sourceToString(value).trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 28)).trimEnd()}\n... [truncated]`;
}

function firstMeaningfulLine(source) {
    return sourceToString(source)
        .split('\n')
        .map(line => line.trim())
        .find(Boolean) || '';
}

function shouldRenderMarkdown(cell) {
    return Boolean(cell && cell.cell_type === 'markdown' && cell.metadata && cell.metadata.notebookPilotRendered);
}

function isCellCollapsed(cell) {
    return Boolean(cell && cell.metadata && cell.metadata.notebookPilotCollapsed);
}

function hasLineNumbers() {
    return viewState.showLineNumbers;
}
