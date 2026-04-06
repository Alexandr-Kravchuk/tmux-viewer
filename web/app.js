let ws = null;
let reconnectInterval = null;
const paneContentCache = new Map();
const DEBOUNCE_DELAY = 300;
let updateTimer = null;
let ansi_up = null;

let confirmModal = {
    callback: null,
    show: function(message, onConfirm) {
        const modal = document.getElementById('confirm-modal');
        const messageEl = document.getElementById('modal-message');
        messageEl.textContent = message;
        modal.style.display = 'flex';
        this.callback = onConfirm;
    },
    hide: function() {
        const modal = document.getElementById('confirm-modal');
        modal.style.display = 'none';
        this.callback = null;
    }
};

function updateGridLayout(count) {
    const container = document.getElementById('sessions-container');
    if (!container) return;

    let cols, rows;
    if (count <= 1) { cols = 1; rows = 1; }
    else if (count <= 3) { cols = 1; rows = count; }
    else if (count <= 4) { cols = 2; rows = 2; }
    else if (count <= 6) { cols = 2; rows = 3; }
    else if (count <= 9) { cols = 3; rows = 3; }
    else if (count <= 12) { cols = 3; rows = 4; }
    else if (count <= 16) { cols = 4; rows = 4; }
    else { cols = 4; rows = Math.ceil(count / 4); }

    container.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

    if (count <= 16) {
        container.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
        container.style.overflowY = 'hidden';
    } else {
        container.style.gridTemplateRows = '';
        container.style.overflowY = 'auto';
    }
}

function updateConnectionStatus(connected) {
    const statusDot = document.getElementById('connection-status');
    if (connected) {
        statusDot.classList.add('connected');
    } else {
        statusDot.classList.remove('connected');
    }
}

function updateSessionCount(count) {
    const countElement = document.getElementById('session-count');
    countElement.textContent = `${count} session${count !== 1 ? 's' : ''}`;
}

async function fetchPaneContent(paneId, lines = 40) {
    const cacheKey = paneId;
    
    try {
        const encodedPaneId = encodeURIComponent(paneId);
        const response = await fetch(`/api/pane/${encodedPaneId}/content?lines=${lines}`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        let htmlContent = data.content;
        
        if (ansi_up) {
            try {
                htmlContent = ansi_up.ansi_to_html(data.content);
            } catch (e) {
                console.warn('AnsiUp error, using plain text:', e);
            }
        }
        
        paneContentCache.set(cacheKey, htmlContent);
        return htmlContent;
    } catch (error) {
        console.error(`Error fetching pane ${paneId}:`, error);
        return `Error loading content: ${error.message}`;
    }
}

async function killSession(sessionId, sessionName) {
    confirmModal.show(
        `Are you sure you want to kill session "${sessionName}"? This cannot be undone.`,
        async () => {
            try {
                const response = await fetch(`/api/session/${sessionId}`, {
                    method: 'DELETE'
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const sessionCard = document.querySelector(`[data-session-id="${sessionId}"]`);
                if (sessionCard) {
                    sessionCard.remove();
                }
                
                const remaining = document.querySelectorAll('.session-card').length;
                updateSessionCount(remaining);
                
                console.log(`Session ${sessionName} killed successfully`);
            } catch (error) {
                console.error(`Error killing session:`, error);
                alert(`Failed to kill session: ${error.message}`);
            }
        }
    );
}

async function renameSession(sessionId, oldName) {
    const newName = prompt(`Rename session "${oldName}" to:`, oldName);
    
    if (!newName || newName === oldName) {
        return;
    }
    
    if (newName.trim() === '') {
        alert('Session name cannot be empty');
        return;
    }
    
    try {
        const response = await fetch(`/api/session/${sessionId}/rename`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ new_name: newName })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || `HTTP ${response.status}`);
        }
        
        const sessionCard = document.querySelector(`[data-session-id="${sessionId}"]`);
        if (sessionCard) {
            const nameEl = sessionCard.querySelector('.session-name');
            if (nameEl) {
                nameEl.textContent = newName;
            }
        }
        
        console.log(`Session renamed from ${oldName} to ${newName}`);
    } catch (error) {
        console.error(`Error renaming session:`, error);
        alert(`Failed to rename session: ${error.message}`);
    }
}

async function openInTerminal(sessionName) {
    try {
        const response = await fetch(`/api/session/${encodeURIComponent(sessionName)}/open-terminal`, {
            method: 'POST'
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        console.log(`Opened session ${sessionName} in Terminal`);
    } catch (error) {
        console.error(`Error opening Terminal:`, error);
        alert(`Failed to open Terminal: ${error.message}`);
    }
}

async function createNewSession() {
    const name = prompt('Session name (leave empty for default):');
    if (name === null) return;

    try {
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name || '' })
        });
        if (!response.ok) {
            const text = await response.text();
            throw new Error(text || `HTTP ${response.status}`);
        }
        const session = await response.json();
        openInTerminal(session.name);
    } catch (error) {
        console.error('Error creating session:', error);
        alert(`Failed to create session: ${error.message}`);
    }
}

function toggleFullscreen(sessionId) {
    const card = document.querySelector(`[data-session-id="${sessionId}"]`);
    if (!card) return;

    card.classList.toggle('fullscreen');
    document.body.classList.toggle('has-fullscreen', card.classList.contains('fullscreen'));

    const btn = card.querySelector('.fullscreen-btn');
    if (btn) {
        btn.innerHTML = card.classList.contains('fullscreen') ? '⊖' : '⊕';
        btn.title = card.classList.contains('fullscreen') ? 'Exit fullscreen' : 'Fullscreen';
    }

    if (card.classList.contains('fullscreen')) {
        const panesContainer = card.querySelector('.panes-container');
        if (panesContainer) {
            panesContainer.style.maxHeight = 'none';
        }
    } else {
        const panesContainer = card.querySelector('.panes-container');
        if (panesContainer) {
            panesContainer.style.maxHeight = '';
        }
    }
}

function createPaneElement(pane) {
    const paneCard = document.createElement('div');
    paneCard.className = `pane-card ${pane.active ? 'active' : ''}`;
    paneCard.dataset.paneId = pane.id;
    
    const header = document.createElement('div');
    header.className = 'pane-header';
    
    const paneId = document.createElement('span');
    paneId.className = 'pane-id';
    paneId.textContent = pane.id;
    
    const badge = document.createElement('span');
    badge.className = `pane-badge ${pane.active ? 'active' : ''}`;
    badge.textContent = pane.active ? 'active' : `${pane.width}x${pane.height}`;
    
    header.appendChild(paneId);
    header.appendChild(badge);
    
    const content = document.createElement('pre');
    content.className = 'pane-content loading';
    content.textContent = 'Loading...';
    
    paneCard.appendChild(header);
    paneCard.appendChild(content);
    
    fetchPaneContent(pane.id).then(text => {
        content.classList.remove('loading');
        content.innerHTML = text;
        content.scrollTop = content.scrollHeight;
    });
    
    return paneCard;
}

function createSessionCard(session) {
    const card = document.createElement('div');
    card.className = 'session-card';
    card.dataset.sessionId = session.id;
    
    const header = document.createElement('div');
    header.className = 'session-header';
    
    const name = document.createElement('div');
    name.className = 'session-name';
    name.textContent = session.name;
    
    const info = document.createElement('div');
    info.className = 'session-info';
    info.textContent = `${session.windows} window${session.windows !== 1 ? 's' : ''}, ${session.panes?.length || 0} pane${session.panes?.length !== 1 ? 's' : ''}`;
    
    const actions = document.createElement('div');
    actions.className = 'session-actions';
    
    const fullscreenBtn = document.createElement('button');
    fullscreenBtn.className = 'action-btn fullscreen-btn';
    fullscreenBtn.innerHTML = '⊕';
    fullscreenBtn.title = 'Fullscreen';
    fullscreenBtn.onclick = (e) => {
        e.stopPropagation();
        toggleFullscreen(session.id);
    };

    const openBtn = document.createElement('button');
    openBtn.className = 'action-btn';
    openBtn.innerHTML = '⌘';
    openBtn.title = 'Open';
    openBtn.onclick = (e) => {
        e.stopPropagation();
        openInTerminal(session.name);
    };

    const renameBtn = document.createElement('button');
    renameBtn.className = 'action-btn';
    renameBtn.innerHTML = '✎';
    renameBtn.title = 'Rename session';
    renameBtn.onclick = (e) => {
        e.stopPropagation();
        renameSession(session.id, session.name);
    };

    const killBtn = document.createElement('button');
    killBtn.className = 'action-btn kill-btn';
    killBtn.innerHTML = '🗑';
    killBtn.title = 'Kill session';
    killBtn.onclick = (e) => {
        e.stopPropagation();
        killSession(session.id, session.name);
    };

    actions.appendChild(fullscreenBtn);
    actions.appendChild(openBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(killBtn);
    
    header.appendChild(name);
    header.appendChild(info);
    header.appendChild(actions);
    
    const panesContainer = document.createElement('div');
    panesContainer.className = 'panes-container';
    
    if (session.panes && session.panes.length > 0) {
        session.panes.forEach(pane => {
            panesContainer.appendChild(createPaneElement(pane));
        });
    } else {
        const noPane = document.createElement('div');
        noPane.className = 'loading';
        noPane.textContent = 'No panes';
        panesContainer.appendChild(noPane);
    }
    
    card.appendChild(header);
    card.appendChild(panesContainer);
    
    return card;
}

function updatePaneContent(paneId) {
    const paneCard = document.querySelector(`[data-pane-id="${paneId}"]`);
    if (!paneCard) return;
    
    const content = paneCard.querySelector('.pane-content');
    if (!content) return;
    
    fetchPaneContent(paneId).then(html => {
        const wasAtBottom = content.scrollHeight - content.scrollTop - content.clientHeight < 50;
        content.innerHTML = html;
        
        if (wasAtBottom) {
            content.scrollTop = content.scrollHeight;
        }
    });
}

function renderSessions(sessions) {
    if (updateTimer) {
        clearTimeout(updateTimer);
    }
    
    updateTimer = setTimeout(() => {
        const container = document.getElementById('sessions-container');
        
        if (!sessions || sessions.length === 0) {
            container.innerHTML = '<div class="loading">No tmux sessions found</div>';
            updateSessionCount(0);
            return;
        }
        
        updateSessionCount(sessions.length);
        updateGridLayout(sessions.length);

        const existingSessionIds = new Set(
            Array.from(container.querySelectorAll('.session-card'))
                .map(card => card.dataset.sessionId)
        );
        
        const newSessionIds = new Set(sessions.map(s => s.id));
        
        existingSessionIds.forEach(id => {
            if (!newSessionIds.has(id)) {
                const card = container.querySelector(`[data-session-id="${id}"]`);
                if (card) card.remove();
            }
        });
        
        sessions.forEach(session => {
            const existingCard = container.querySelector(`[data-session-id="${session.id}"]`);
            
            if (existingCard) {
                if (session.panes) {
                    session.panes.forEach(pane => {
                        updatePaneContent(pane.id);
                    });
                }
            } else {
                container.appendChild(createSessionCard(session));
            }
        });
        
        if (container.querySelector('.loading')) {
            container.querySelector('.loading')?.remove();
        }
    }, DEBOUNCE_DELAY);
}

function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
        console.log('WebSocket connected');
        updateConnectionStatus(true);
        
        if (reconnectInterval) {
            clearInterval(reconnectInterval);
            reconnectInterval = null;
        }
    };
    
    ws.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            
            if (data.type === 'update' && data.sessions) {
                renderSessions(data.sessions);
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    };
    
    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        updateConnectionStatus(false);
    };
    
    ws.onclose = () => {
        console.log('WebSocket closed');
        updateConnectionStatus(false);
        
        if (!reconnectInterval) {
            reconnectInterval = setInterval(() => {
                console.log('Attempting to reconnect...');
                connectWebSocket();
            }, 5000);
        }
    };
}

async function loadInitialData() {
    try {
        const response = await fetch('/api/sessions');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const sessions = await response.json();
        renderSessions(sessions);
    } catch (error) {
        console.error('Error loading sessions:', error);
        const container = document.getElementById('sessions-container');
        container.innerHTML = `<div class="error">Error loading sessions: ${error.message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        if (typeof AnsiUp !== 'undefined') {
            ansi_up = new AnsiUp();
            console.log('AnsiUp initialized');
        } else {
            console.warn('AnsiUp not available, using plain text');
        }
    }, 100);
    
    loadInitialData();
    connectWebSocket();
    
    document.getElementById('modal-cancel').onclick = () => {
        confirmModal.hide();
    };
    
    document.getElementById('modal-confirm').onclick = () => {
        if (confirmModal.callback) {
            confirmModal.callback();
        }
        confirmModal.hide();
    };
    
    document.getElementById('confirm-modal').onclick = (e) => {
        if (e.target.id === 'confirm-modal') {
            confirmModal.hide();
        }
    };
});
