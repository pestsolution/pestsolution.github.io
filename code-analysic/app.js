let projectFiles = new Map();

let patternConfig = null;

let globalResources = {
    db: new Map(),
    recurly: new Map(),
    vetspire: new Map(),
    ez: new Map(),
    internal: new Map()
};

/* =========================================
   APP START
========================================= */

window.addEventListener('DOMContentLoaded', () => loadPatternConfig());

/* =========================================
   LOAD CONFIG
========================================= */

function loadPatternConfig() {

    const cache = localStorage.getItem("cqrs-pattern-config");

    patternConfig = cache
        ? JSON.parse(cache)
        : DEFAULT_PATTERN_CONFIG;

    console.log(
        cache
            ? "Loaded config from cache"
            : "Loaded default config"
    );

    const textarea = document.getElementById('patternJson');

    if (textarea) {
        textarea.value = JSON.stringify(patternConfig, null, 4);
    }
}

/* =========================================
   SAVE CONFIG
========================================= */

function savePatternConfig() {

    try {

        const raw = document.getElementById('patternJson').value;

        patternConfig = JSON.parse(raw);

        localStorage.setItem(
            "cqrs-pattern-config",
            JSON.stringify(patternConfig)
        );

        alert("Config saved");

        document.getElementById('configPanel').style.display = "none";

    } catch (err) {

        console.error(err);

        alert("Invalid JSON");
    }
}

/* =========================================
   TOGGLE CONFIG PANEL
========================================= */

function toggleConfigPanel() {

    const panel = document.getElementById('configPanel');

    panel.style.display =
        panel.style.display === 'none'
            ? 'block'
            : 'none';
}

/* =========================================
   RESET CONFIG
========================================= */

function resetPatternConfig() {

    localStorage.removeItem("cqrs-pattern-config");

    patternConfig = DEFAULT_PATTERN_CONFIG;

    document.getElementById('patternJson').value =
        JSON.stringify(patternConfig, null, 4);

    alert("Config reset successfully");
}

/* =========================================
   LOAD PROJECT
========================================= */

async function loadProject() {

    try {

        const dirHandle = await window.showDirectoryPicker();

        projectFiles.clear();

        await scanFiles(dirHandle);

        ['btnTrace', 'btnDetail'].forEach(id => {

            const btn = document.getElementById(id);

            btn.disabled = false;
            btn.style.opacity = "1";
        });

        console.log(`Loaded ${projectFiles.size} .cs files`);

    } catch (e) {

        console.error(e);
    }
}

/* =========================================
   SCAN FILES
========================================= */

async function scanFiles(dirHandle) {

    for await (const entry of dirHandle.values()) {

        if (entry.kind === 'directory') {

            if (!['bin', 'obj', '.git', 'Migrations'].includes(entry.name)) {
                await scanFiles(entry);
            }

            continue;
        }

        if (!entry.name.endsWith('.cs')) continue;

        const file = await entry.getFile();

        let content = await file.text();

        let formatted = content
            .replace(/[\u00a0\ufeff]/g, " ")
            .split(/\r?\n/)
            .map(l => l.trim())
            .filter(Boolean)
            .join(" ")
            .replace(/\s*\.\s*/g, ".");

        projectFiles.set(
            entry.name.replace('.cs', ''),
            formatted
        );
    }
}

/* =========================================
   TRACE DEPENDENCY
========================================= */

function traceDependency() {

    const rootName = document
        .getElementById('rootFileName')
        .value
        .trim()
        .replace('.cs', '');

    if (!projectFiles.has(rootName)) {
        alert("Root file not found");
        return;
    }

    let treeStr = "";
    let visited = new Set();

    function build(name, level) {

        const indent = "\t".repeat(level);

        treeStr += indent + name + "\n";

        if (visited.has(name)) return;

        visited.add(name);

        const content = projectFiles.get(name);

        const regex =
            /([\w]+)\.(Command|Query|GetSendEndpoint)\s*\(/g;

        let match;

        while ((match = regex.exec(content)) !== null) {

            const next = match[1];

            if (
                projectFiles.has(next) &&
                next !== name
            ) {
                build(next, level + 1);
            } else {
                build(`${next} NEEDTOCHECK`, level + 1);
            }
        }
    }

    build(rootName, 0);

    document.getElementById('treeResult').value = treeStr;

    document.getElementById('tabTree').innerHTML =
        `<pre>${treeStr}</pre>`;
}

/* =========================================
   ANALYZE DETAIL
========================================= */

function analyzeDetail() {
	const treeInput = document.getElementById('treeResult').value;
	if (!treeInput) return;

	globalResources = { db: new Map(), recurly: new Map(), vetspire: new Map(), ez: new Map(), internal: new Map() };
	const lines = treeInput.split('\n').filter(l => l.trim() !== "");
	
	let richTreeHtml = "";
	let combinedCode = ""; 
	let processedFiles = new Set(); 

	lines.forEach(line => {
		const match = line.match(/^(\t*)(.*)$/);
		const indentStr = match[1];
		const fileName = match[2].trim().replace(" NEEDTOCHECK", ""); 
		
		const content = projectFiles.get(fileName);

		richTreeHtml += `<div style="margin-top: 8px; white-space: pre;">${indentStr}<span class="node-file">${fileName}</span>`;

		if (content) {
			const actions = extractActions(fileName, content);
			const actionIndent = indentStr + "\t"; 
			if (actions.db.size > 0) richTreeHtml += `<div class="action-line act-db" style="white-space: pre;">${actionIndent}DB: ${Array.from(actions.db).join(", ")}</div>`;
			if (actions.recurly.size > 0) richTreeHtml += `<div class="action-line act-rec" style="white-space: pre;">${actionIndent}Recurly: ${Array.from(actions.recurly).join(", ")}</div>`;
			if (actions.vetspire.size > 0) richTreeHtml += `<div class="action-line act-vet" style="white-space: pre;">${actionIndent}Vetspire: ${Array.from(actions.vetspire).join(", ")}</div>`;
			if (actions.ez.size > 0) richTreeHtml += `<div class="action-line act-vet" style="white-space: pre;">${actionIndent}EZ: ${Array.from(actions.ez).join(", ")}</div>`;
			if (actions.internal.size > 0) richTreeHtml += `<div class="action-line act-int" style="white-space: pre;">${actionIndent}Internal: ${Array.from(actions.internal).join(", ")}</div>`;

			if (!processedFiles.has(fileName)) {
				combinedCode += `// ==========================================\n`;
				combinedCode += `// FILE: ${fileName}.cs\n`;
				combinedCode += `// ==========================================\n\n`;
				combinedCode += content + "\n\n";
				processedFiles.add(fileName);
			}
		} else {
			richTreeHtml += ` <span class="warning">[NOT FOUND]</span>`;
		}
		richTreeHtml += `</div>`;
	});

	document.getElementById('tabTree').innerHTML = richTreeHtml;
	
	// Render Tab All Code
	renderAllCodeTab(combinedCode);
	
	renderImpactTables();
	
	renderReviewTab(processedFiles);
}
/* =========================================
   EXTRACT ACTIONS
========================================= */

function extractActions(fileName, content) {

    let res = {
        db: new Set(),
        recurly: new Set(),
        vetspire: new Set(),
        ez: new Set(),
        internal: new Set()
    };

    Object.entries(patternConfig.patterns)
        .forEach(([type, config]) => {

            const regex = new RegExp(
                config.regex,
                config.flags
            );

            let match;

            while ((match = regex.exec(content)) !== null) {

                const methodName = match[1];
                const fullMatch = match[0];

                if (config.ignoreMethods?.some(x =>
                    methodName.includes(x)
                )) {
                    continue;
                }

                addRes(type, fullMatch, fileName);

                if (res[type]) {
                    res[type].add(fullMatch);
                }
            }
        });

    function addRes(type, method, file) {

        if (!globalResources[type]) {
            globalResources[type] = new Map();
        }

        if (!globalResources[type].has(method)) {
            globalResources[type].set(method, new Set());
        }

        globalResources[type]
            .get(method)
            .add(file);
    }

    return res;
}

/* =========================================
   RENDER IMPACT TABLES
========================================= */

function renderImpactTables() {

    const render = (map, id, label) => {

        if (map.size === 0) {

            document.getElementById(id).innerHTML = `
                <p style="padding:20px;color:#888;">
                    No ${label} impact detected.
                </p>
            `;

            return;
        }

        let html = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;">
                <h3 style="margin:0;color:var(--primary);">${label} Inventory</h3>

                <button onclick="copyToClipboard('${id}')" style="background:#34495e;padding:6px 12px;font-size:11px;">
                    📋 Copy Resource List
                </button>
            </div>

            <table>
                <thead>
                    <tr>
                        <th style="width:50px;">#</th>
                        <th>Resource Name</th>
                        <th>Dependencies</th>
                    </tr>
                </thead>

                <tbody>
        `;

        let i = 1;

        const sortedResources = new Map(
            [...map.entries()].sort()
        );

        sortedResources.forEach((files, resource) => {

            const tags = Array.from(files)
                .map(f => `<span class="tag">${f}</span>`)
                .join("");

            html += `
                <tr>
                    <td>${i++}</td>

                    <td class="resource-name" style="color:#e6db74;font-weight:bold;">
                        ${resource}
                    </td>

                    <td>${tags}</td>
                </tr>
            `;
        });

        document.getElementById(id).innerHTML =
            html + "</tbody></table>";
    };

    render(globalResources.db, 'tabDB', 'Database');
    render(globalResources.recurly, 'tabRecurly', 'Recurly API');
    render(globalResources.vetspire, 'tabVetspire', 'Vetspire Service');
    render(globalResources.ez, 'tabEZ', 'EZ Service');
    render(globalResources.internal, 'tabInternal', 'Internal Logic');
}

/* =========================================
   REVIEW TAB
========================================= */

function renderReviewTab(fileSet) {

    const container =
        document.getElementById('tabReview');

    let reviewHtml = `<h3>Code Quality Review</h3>`;

    let issuesFound = 0;

    fileSet.forEach(fileName => {

        if (
            !fileName.endsWith("Command") &&
            !fileName.endsWith("Query")
        ) {
            return;
        }

        const content = projectFiles.get(fileName);

        let fileIssues = [];

        const logPattern =
            /\$"{request\.EventId}\s*-\s*{request\.FromEvent}\s*-\s*{nameof\(/;

        if (!logPattern.test(content)) {
            fileIssues.push(`<span class="warning">❌ Missing trace log format</span>`);
        }

        content.split(';').forEach(line => {

            const matches = line.match(/[&|!=]{2}/g);

            if (matches && matches.length > 3) {
                fileIssues.push(`<span class="warning">⚠️ Complex logic</span>`);
            }
        });

        if (fileIssues.length === 0) return;

        issuesFound++;

        reviewHtml += `
            <div style="border:1px solid #444;padding:10px;margin-bottom:10px;border-radius:6px;">
                <strong style="color:var(--secondary);">
                    ${fileName}.cs
                </strong>

                <ul>
                    ${fileIssues.map(x => `<li>${x}</li>`).join('')}
                </ul>
            </div>
        `;
    });

    if (issuesFound === 0) {
        reviewHtml += `<p style="color:var(--primary);">✅ All rules passed</p>`;
    }

    container.innerHTML = reviewHtml;
}

/* =========================================
   ALL CODE TAB
========================================= */

function renderAllCodeTab(code) {

    const container =
        document.getElementById('tabAllCode');

    if (!code) {

        container.innerHTML = `<p>No code available</p>`;

        return;
    }

    const formattedCode = formatCode(code);

    container.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:15px;">
            <h3>Combined Source Code</h3>

            <button id="btnCopyAll">
                📋 Copy All
            </button>
        </div>

        <pre id="combinedCodeArea">
${escapeHtml(formattedCode)}
        </pre>
    `;

    document.getElementById('btnCopyAll').onclick = function () {

        navigator.clipboard
            .writeText(formattedCode)
            .then(() => {

                const btn = this;

                btn.innerText = "✅ Copied";

                setTimeout(() => {
                    btn.innerText = "📋 Copy All";
                }, 2000);
            });
    };
}

/* =========================================
   FORMAT CODE
========================================= */

function formatCode(code) {

    if (!code) return "";

    return code
        .replace(/\s*;\s*/g, ";\n")
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .join('\n');
}

/* =========================================
   ESCAPE HTML
========================================= */

function escapeHtml(text) {

    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/* =========================================
   COPY TO CLIPBOARD
========================================= */

function copyToClipboard(containerId) {

    const container =
        document.getElementById(containerId);

    const names = Array.from(
        container.querySelectorAll('.resource-name')
    ).map(el => el.innerText);

    if (names.length === 0) return;

    navigator.clipboard.writeText(names.join('\n'));
}

/* =========================================
   SWITCH TAB
========================================= */

function switchTab(evt, tabId) {

    document
        .querySelectorAll('.tab-content')
        .forEach(c => c.classList.remove('active'));

    document
        .querySelectorAll('.tab-btn')
        .forEach(b => b.classList.remove('active'));

    document
        .getElementById(tabId)
        .classList.add('active');

    evt.currentTarget.classList.add('active');
}