const QWEN_CODER_REPO = 'Qwen/Qwen2.5-Coder-1.5B-Instruct-GGUF';
const QWEN_CODER_FILE = 'qwen2.5-coder-1.5b-instruct-q5_k_m.gguf';
const QWEN_CODER_FAST_REPO = 'Qwen/Qwen2.5-Coder-0.5B-Instruct-GGUF';
const QWEN_CODER_FAST_FILE = 'qwen2.5-coder-0.5b-instruct-q8_0.gguf';
const DEFAULT_GEMMA_REPO = QWEN_CODER_FAST_REPO;
const DEFAULT_GEMMA_FILE = QWEN_CODER_FAST_FILE;
const DEFAULT_MODEL_URL = `${DEFAULT_GEMMA_REPO}:${DEFAULT_GEMMA_FILE}`;
const FAST_GEMMA_REPO = 'second-state/gemma-3-1b-it-GGUF';
const FAST_GEMMA_FILE = 'gemma-3-1b-it-Q3_K_S.gguf';
const ADVANCED_GEMMA4_REPO = 'bartowski/google_gemma-4-E2B-it-GGUF';
const ADVANCED_GEMMA4_FILE = 'google_gemma-4-E2B-it-IQ2_M.gguf';
const SMOKE_MODEL_REPO = 'ggml-org/models';
const SMOKE_MODEL_FILE = 'tinyllamas/stories260K.gguf';
const BROWSER_SINGLE_GGUF_LIMIT_BYTES = 2 * 1024 * 1024 * 1024;
const WLLAMA_VERSION = '3.5.1';
const WLLAMA_MODULE_URL = `https://cdn.jsdelivr.net/npm/@wllama/wllama@${WLLAMA_VERSION}/esm/index.js`;
const WLLAMA_WASM_URL = `https://cdn.jsdelivr.net/npm/@wllama/wllama@${WLLAMA_VERSION}/esm/wasm/wllama.wasm`;
const PYODIDE_VERSION = '314.0.2';
const PYODIDE_BASE_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
const PYODIDE_SCRIPT_URL = `${PYODIDE_BASE_URL}pyodide.js`;
const NOTEBOOK_VERSION = 4;
const AGENT_PERFORMANCE_PROFILES = {
    fast: {
        label: 'Fast',
        maxTokens: 128,
        maxContextCells: 6,
        selectedSourceLimit: 2200,
        nearbySourceLimit: 900,
        distantSourceLimit: 120,
        selectedOutputLimit: 1200,
        nearbyOutputLimit: 420,
        distantOutputLimit: 120,
        nCtx: 1536,
        nBatch: 96,
        concise: true
    },
    balanced: {
        label: 'Balanced',
        maxTokens: 192,
        maxContextCells: 12,
        selectedSourceLimit: 4000,
        nearbySourceLimit: 1800,
        distantSourceLimit: 240,
        selectedOutputLimit: 2400,
        nearbyOutputLimit: 1000,
        distantOutputLimit: 320,
        nCtx: 2048,
        nBatch: 128,
        concise: true
    },
    deep: {
        label: 'Deep',
        maxTokens: 384,
        maxContextCells: 18,
        selectedSourceLimit: 7000,
        nearbySourceLimit: 2800,
        distantSourceLimit: 480,
        selectedOutputLimit: 3600,
        nearbyOutputLimit: 1400,
        distantOutputLimit: 420,
        nCtx: 3072,
        nBatch: 160,
        concise: false
    }
};
let notebook = createBlankNotebook();
let selectedCellId = notebook.cells[0].id;
let pyodidePromise = null;
let pyodideReady = false;
const virtualFiles = new Map();
const runtimeState = {
    status: 'idle',
    loadedPackages: new Set(),
    mountedFiles: []
};
const gemmaState = {
    status: 'idle',
    loaded: false,
    modelKey: '',
    progress: null,
    error: '',
    warning: ''
};
const viewState = {
    showLineNumbers: false
};
let wllamaModulePromise = null;
let wllamaInstance = null;
