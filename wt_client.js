let tabCounter = 0;
const tabs = new Map();
let activeTabId = null;

const tabsContainer = document.getElementById('tabs-container');
const terminalsContainer = document.getElementById('terminals-container');
const addTabBtn = document.getElementById('add-tab');

function createTab() {
    const tabId = `tab-${++tabCounter}`;
    const tabNumber = tabCounter;

    // Built via DOM APIs rather than innerHTML + inline onclick attributes,
    // so tab content can never be interpreted as markup, and click handlers
    // don't rely on string-interpolated JS.
    const tabBtn = document.createElement('div');
    tabBtn.className = 'tab';
    tabBtn.id = `btn-${tabId}`;

    const label = document.createElement('span');
    label.textContent = `Tab ${tabNumber}`;
    tabBtn.appendChild(label);

    const closeBtn = document.createElement('span');
    closeBtn.className = 'close-tab';
    closeBtn.textContent = '\u00d7';
    closeBtn.addEventListener('click', (e) => {
        // Without this, the click bubbles up to tabBtn's own click handler
        // below, which then calls switchTab() on a tab that closeTab() just
        // removed from the DOM, throwing on the null lookup.
        e.stopPropagation();
        closeTab(tabId);
    });
    tabBtn.appendChild(closeBtn);

    tabBtn.addEventListener('click', () => switchTab(tabId));
    tabsContainer.appendChild(tabBtn);

    // Create terminal wrapper
    const termDiv = document.createElement('div');
    termDiv.className = 'terminal-wrapper';
    termDiv.id = `wrapper-${tabId}`;
    const termEl = document.createElement('div');
    termEl.id = `term-${tabId}`;
    // Without an explicit size, this div defaults to auto height (i.e. it
    // shrinks to fit xterm's default 80x24 content) instead of filling the
    // wrapper. FitAddon measures this element's box to decide how many
    // rows/cols fit, so if it isn't actually full-size, the terminal renders
    // undersized and the page scrollbar only spans that smaller area instead
    // of the real window.
    termEl.className = 'terminal-instance';
    termDiv.appendChild(termEl);
    terminalsContainer.appendChild(termDiv);

    // Initialize xterm.js
    const term = new Terminal({
        cursorBlink: false,
        fontSize: 16,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        theme: { background: '#1e1e1e', foreground: '#ffffff' }
    });

    const fitAddon = new FitAddon.FitAddon();
    term.loadAddon(fitAddon);
    term.open(termEl);
    fitAddon.fit();

    // Connect to backend PTY — use wss:// automatically if this page is
    // ever served over https so the socket scheme always matches the page.
    const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${wsProtocol}://${window.location.host}/pty`);

    const tabState = { term, ws, fitAddon, closed: false };
    tabs.set(tabId, tabState);

    ws.onopen = () => {
        term.writeln('\x1b[1;32mConnected to wwwxterm securely.\x1b[0m');
    };

    ws.onmessage = (event) => {
        // Guard against events arriving after closeTab() has already
        // disposed this terminal (writing to a disposed xterm instance
        // throws).
        if (!tabState.closed) term.write(event.data);
    };

    ws.onclose = () => {
        if (!tabState.closed) term.writeln('\r\n\x1b[1;31mConnection closed.\x1b[0m');
    };

    ws.onerror = () => {
        if (!tabState.closed) term.writeln('\r\n\x1b[1;31mConnection error.\x1b[0m');
    };

    term.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
        }
    });

    switchTab(tabId);
}

function switchTab(tabId) {
    if (activeTabId) {
        const prevWrapper = document.getElementById(`wrapper-${activeTabId}`);
        const prevBtn = document.getElementById(`btn-${activeTabId}`);
        if (prevWrapper) prevWrapper.classList.remove('active');
        if (prevBtn) prevBtn.classList.remove('active');
    }
    activeTabId = tabId;
    document.getElementById(`wrapper-${tabId}`).classList.add('active');
    document.getElementById(`btn-${tabId}`).classList.add('active');

    const tabData = tabs.get(tabId);
    if (tabData) {
        setTimeout(() => tabData.fitAddon.fit(), 10);
    }
}

function closeTab(tabId) {
    const tabData = tabs.get(tabId);
    if (tabData) {
        tabData.closed = true;
        tabData.ws.close();
        tabData.term.dispose();
        tabs.delete(tabId);
    }
    const btn = document.getElementById(`btn-${tabId}`);
    const wrapper = document.getElementById(`wrapper-${tabId}`);
    if (btn) btn.remove();
    if (wrapper) wrapper.remove();

    if (activeTabId === tabId) {
        activeTabId = null;
        const remaining = Array.from(tabs.keys());
        if (remaining.length > 0) {
            switchTab(remaining[remaining.length - 1]);
        }
    }
}

// A single shared resize listener, instead of registering a new one inside
// createTab() every time (as before): that leaked a listener — plus the
// closure holding its ws/term/fitAddon references — for every tab ever
// opened, none of which were ever removed even after closeTab().
window.addEventListener('resize', () => {
    if (!activeTabId) return;
    const tabData = tabs.get(activeTabId);
    if (!tabData) return;
    tabData.fitAddon.fit();
    if (tabData.ws.readyState === WebSocket.OPEN) {
        tabData.ws.send(JSON.stringify({
            type: 'resize',
            cols: tabData.term.cols,
            rows: tabData.term.rows
        }));
    }
});

addTabBtn.onclick = createTab;
createTab(); // Create initial tab
