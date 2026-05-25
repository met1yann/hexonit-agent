// Hexonit Dashboard Client App Engine

document.addEventListener('DOMContentLoaded', () => {
  // Navigation & Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const activeTabTitle = document.getElementById('active-tab-title');
  const activeTabDesc = document.getElementById('active-tab-desc');

  const tabMeta = {
    gateway: { title: 'Gateways Command', desc: 'Monitor and coordinate background messaging channels' },
    chat: { title: 'Chat & Telemetry Studio', desc: 'Converse with Hexonit and monitor real-time reasoning logs' },
    memory: { title: 'Memory Vault', desc: 'Search, manage, and optimize learned long-term contexts' },
    skills: { title: 'Skill Lab & Testbed', desc: 'View, test, and package new autonomous abilities' },
    settings: { title: 'Control Center', desc: 'Configure global AI providers, model preferences, and keys' }
  };

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabName = item.getAttribute('data-tab');
      
      // Update sidebar active state
      navItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      // Update panel view
      tabPanels.forEach(p => p.classList.remove('active'));
      document.getElementById(`tab-${tabName}`).classList.add('active');

      // Update headers
      if (tabMeta[tabName]) {
        activeTabTitle.innerText = tabMeta[tabName].title;
        activeTabDesc.innerText = tabMeta[tabName].desc;
      }
    });
  });

  // Global States
  let ws = null;
  let isThinking = false;
  let currentStreamingBubble = null;

  // Sync / Refresh Server States
  const btnSync = document.getElementById('btn-sync');
  btnSync.addEventListener('click', () => {
    fetchConfig();
    fetchTelemetry();
    fetchGatewayStatus();
    fetchMemory();
    fetchTools();
    btnSync.classList.add('rotating');
    setTimeout(() => btnSync.classList.remove('rotating'), 800);
  });

  // --- Real-time WebSocket Logic ---
  function connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('WS Connection established.');
    };

    ws.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        handleSocketEvent(payload);
      } catch (err) {
        console.error('WS Error:', err);
      }
    };

    ws.onclose = () => {
      console.log('WS Disconnected. Reconnecting in 3s...');
      setTimeout(connectWebSocket, 3000);
    };
  }

  function handleSocketEvent(event) {
    const consoleEl = document.getElementById('tel-console');

    // Telemetry System Logs piped from Logger.addListener
    if (event.type === 'telemetry') {
      const log = event.data;
      
      // Append logs to visual console
      if (log.type === 'info') {
        appendConsole(`| [INFO] ${log.message}`, 'info');
      } else if (log.type === 'success') {
        appendConsole(`| [SUCCESS] OK - ${log.message}`, 'success');
      } else if (log.type === 'warning') {
        appendConsole(`| [WARNING] ! - ${log.message}`, 'warning');
      } else if (log.type === 'error') {
        appendConsole(`| [ERROR] ${log.message}`, 'error');
        if (log.error) appendConsole(`|   -> ${JSON.stringify(log.error)}`, 'error-detail');
      } else if (log.type === 'system') {
        appendConsole(`| [SYSTEM] * ${log.message}`, 'system');
      } else if (log.type === 'tool') {
        appendConsole(`| [TOOL] [${log.name}] ${log.action}`, 'tool');
      } else if (log.type === 'divider') {
        appendConsole(`+-------------------------------------------------------+`, 'divider');
      } else if (log.type === 'usage') {
        appendConsole(`| [TOKENS] ${log.promptTokens} up ${log.completionTokens} down`, 'tokens');
      } else if (log.type === 'rawStream') {
        // Real-time word token streaming into the chat bubble
        if (currentStreamingBubble) {
          const contentEl = currentStreamingBubble.querySelector('.bubble-content');
          contentEl.innerText += log.chunk;
          // Auto-scroll chat window
          const flow = document.getElementById('chat-flow');
          flow.scrollTop = flow.scrollHeight;
        }
      }
    }

    if (event.type === 'agent-thinking') {
      isThinking = true;
      document.getElementById('btn-send').disabled = true;
      document.getElementById('btn-abort').disabled = false;
      document.getElementById('btn-send').innerText = 'Thinking...';
      
      // Clear console
      consoleEl.innerHTML = '';
      appendConsole(`[STARTING AGENT EXECUTION LOOP]`, 'system');

      // Create a fresh agent chat bubble bubble to receive tokens
      createAgentBubble('');
    }

    if (event.type === 'agent-done') {
      isThinking = false;
      document.getElementById('btn-send').disabled = false;
      document.getElementById('btn-abort').disabled = true;
      document.getElementById('btn-send').innerText = 'Execute Loop';
      currentStreamingBubble = null;
      appendConsole(`[EXECUTION COMPLETED SUCCESSFULY]`, 'success');
      fetchMemory(); // Sync any newly learned memories
    }

    if (event.type === 'agent-aborted') {
      isThinking = false;
      document.getElementById('btn-send').disabled = false;
      document.getElementById('btn-abort').disabled = true;
      document.getElementById('btn-send').innerText = 'Execute Loop';
      currentStreamingBubble = null;
      appendConsole(`[AGENT REASONING INTERRUPTED BY USER]`, 'warning');
    }

    if (event.type === 'error') {
      appendConsole(`[API SYSTEM CRASH] ${event.text}`, 'error');
      isThinking = false;
      document.getElementById('btn-send').disabled = false;
      document.getElementById('btn-send').innerText = 'Execute Loop';
    }
  }

  function appendConsole(text, styleClass) {
    const el = document.getElementById('tel-console');
    const span = document.createElement('span');
    span.className = `console-line ${styleClass}`;
    span.innerText = text + '\n';
    el.appendChild(span);
    el.scrollTop = el.scrollHeight;
  }

  function createAgentBubble(text) {
    const flow = document.getElementById('chat-flow');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble agent';
    bubble.innerHTML = `
      <div class="bubble-logo">H</div>
      <div class="bubble-content">${text}</div>
    `;
    flow.appendChild(bubble);
    currentStreamingBubble = bubble;
    flow.scrollTop = flow.scrollHeight;
  }

  function createUserBubble(text) {
    const flow = document.getElementById('chat-flow');
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble user';
    bubble.innerHTML = `
      <div class="bubble-logo">U</div>
      <div class="bubble-content">${text}</div>
    `;
    flow.appendChild(bubble);
    flow.scrollTop = flow.scrollHeight;
  }

  // --- Interaction Handles ---
  const btnSend = document.getElementById('btn-send');
  const chatInput = document.getElementById('chat-input');
  
  btnSend.addEventListener('click', () => {
    const text = chatInput.value.trim();
    if (!text || isThinking) return;

    createUserBubble(text);
    chatInput.value = '';

    // Send payload to ws server
    ws.send(JSON.stringify({
      action: 'chat',
      text,
      provider: document.getElementById('cfg-provider').value,
      model: document.getElementById('cfg-model').value
    }));
  });

  const btnAbort = document.getElementById('btn-abort');
  btnAbort.addEventListener('click', () => {
    if (ws && isThinking) {
      ws.send(JSON.stringify({ action: 'abort' }));
    }
  });

  // --- Telemetry Polling ---
  function fetchTelemetry() {
    fetch('/api/telemetry')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          const { ram, uptime } = res.telemetry;
          document.getElementById('tel-uptime').innerText = uptime;
          document.getElementById('tel-ram').innerText = ram.split(' Free / ')[0] + ' Free';
          
          // Set RAM bar percentage
          const percentMatch = ram.match(/\((\d+\.?\d*)% used\)/);
          if (percentMatch) {
            document.getElementById('tel-ram-bar').style.width = percentMatch[1] + '%';
          }
        }
      });
  }

  // --- OpenClaw-style Gateways Manager ---
  function fetchGatewayStatus() {
    fetch('/api/gateway')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          const { online, pid, channels } = res;
          
          // Telegram Card
          const tgLbl = document.getElementById('tg-status-lbl');
          const tgToggle = document.getElementById('toggle-telegram');
          const tgLog = document.getElementById('tg-log');

          if (online) {
            tgLbl.className = 'status-lbl online';
            tgLbl.innerText = `Online (PID: ${pid})`;
            tgToggle.checked = true;
            tgLog.innerText = `[DAEMON] Running continuously. Listening to Telegram bot triggers.\n[DAEMON] Process executing on PID: ${pid}`;
          } else {
            tgLbl.className = 'status-lbl offline';
            tgLbl.innerText = 'Offline';
            tgToggle.checked = false;
            tgLog.innerText = `[DAEMON] Offline. Toggle switch above to spin up the background gate.`;
          }
        }
      });
  }

  // Wire Gateway Toggle Switches
  const toggleTelegram = document.getElementById('toggle-telegram');
  toggleTelegram.addEventListener('change', (e) => {
    const start = e.target.checked;
    fetch('/api/gateway/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ start })
    })
    .then(res => res.json())
    .then(res => {
      fetchGatewayStatus();
    });
  });

  // --- Memory Vault Explorer ---
  function fetchMemory() {
    fetch('/api/memory')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          renderMemoryCards(res.memories);
        }
      });
  }

  function renderMemoryCards(memories) {
    const grid = document.getElementById('memory-cards-grid');
    grid.innerHTML = '';

    if (memories.length === 0) {
      grid.innerHTML = '<div class="qr-box mt-4"><span>Memory Vault is empty. Ask the agent tasks to consolidate facts.</span></div>';
      return;
    }

    memories.forEach(m => {
      const card = document.createElement('div');
      card.className = 'memory-card';
      const date = new Date(m.timestamp).toLocaleDateString();
      const tagsStr = m.tags && m.tags.length ? m.tags.join(', ') : 'none';
      
      card.innerHTML = `
        <div class="mem-header">
          <span class="mem-type-badge ${m.type}">${m.type}</span>
          <button class="btn-delete-mem" data-id="${m.id}">✗</button>
        </div>
        <div class="mem-content" contenteditable="true" data-id="${m.id}">${m.content}</div>
        <div class="mem-meta">
          <span>Tags: ${tagsStr}</span>
          <span>${date}</span>
        </div>
      `;
      grid.appendChild(card);
    });

    // Wire Delete Actions
    document.querySelectorAll('.btn-delete-mem').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const memoryId = btn.getAttribute('data-id');
        if (confirm('Delete this memory node permanently?')) {
          fetch('/api/memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'delete', memoryId })
          })
          .then(res => res.json())
          .then(res => {
            fetchMemory();
          });
        }
      });
    });

    // Wire Edit Action on blur
    document.querySelectorAll('.mem-content').forEach(el => {
      el.addEventListener('blur', (e) => {
        const memoryId = el.getAttribute('data-id');
        const content = el.innerText.trim();
        fetch('/api/memory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'edit', memoryId, content })
        });
      });
    });
  }

  // Memory Filters
  const memSearch = document.getElementById('mem-search');
  const memType = document.getElementById('mem-filter-type');
  
  function filterMemories() {
    const query = memSearch.value.toLowerCase();
    const type = memType.value;

    fetch('/api/memory')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          const filtered = res.memories.filter(m => {
            const matchesQuery = m.content.toLowerCase().includes(query) || m.tags.some(t => t.toLowerCase().includes(query));
            const matchesType = type === 'all' || m.type === type;
            return matchesQuery && matchesType;
          });
          renderMemoryCards(filtered);
        }
      });
  }

  memSearch.addEventListener('input', filterMemories);
  memType.addEventListener('change', filterMemories);

  const wipeMemoryBtn = document.getElementById('btn-wipe-memory');
  wipeMemoryBtn.addEventListener('click', () => {
    if (confirm('Are you absolutely sure you want to WIPE the entire long-term memory vault? This cannot be undone.')) {
      fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' })
      })
      .then(res => res.json())
      .then(res => {
        fetchMemory();
      });
    }
  });

  // --- Skill Lab Tools Manager ---
  function fetchTools() {
    fetch('/api/tools')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          const list = document.getElementById('active-tools-list');
          list.innerHTML = '';
          const select = document.getElementById('test-tool-select');
          select.innerHTML = '';

          res.tools.forEach(t => {
            // Sidebar item
            const div = document.createElement('div');
            div.className = 'tool-list-item';
            div.innerHTML = `
              <h4>${t.name}</h4>
              <p>${t.description}</p>
            `;
            list.appendChild(div);

            // Test selector
            const opt = document.createElement('option');
            opt.value = t.name;
            opt.innerText = t.name;
            select.appendChild(opt);
          });
        }
      });
  }

  // Compile Recorded Workflow into Custom Skill
  const btnCompileSkill = document.getElementById('btn-compile-skill');
  btnCompileSkill.addEventListener('click', () => {
    const skillName = document.getElementById('rec-skill-name').value.trim();
    const description = document.getElementById('rec-skill-desc').value.trim();
    const cmdStr = document.getElementById('rec-skill-cmds').value.trim();

    if (!skillName || !description || !cmdStr) {
      alert('Please fill out all fields to compile a skill.');
      return;
    }

    const commands = cmdStr.split('\n').map(c => c.trim()).filter(Boolean);

    fetch('/api/tools/compile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ skillName, description, commands })
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        alert(`Skill compiled successfully!\nSaved to: ${res.path}`);
        document.getElementById('rec-skill-name').value = '';
        document.getElementById('rec-skill-desc').value = '';
        document.getElementById('rec-skill-cmds').value = '';
        fetchTools();
      }
    });
  });

  // --- Settings Control Center ---
  function fetchConfig() {
    fetch('/api/config')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          const cfg = res.config;
          
          // Set Provider
          document.getElementById('cfg-provider').value = cfg.defaultProvider;
          document.getElementById('cfg-model').value = cfg.defaultModel;
          document.getElementById('cfg-theme').value = cfg.uiTheme;

          // Set Key Fields
          document.getElementById('key-openrouter').value = cfg.keys.openrouter || '';
          document.getElementById('key-openai').value = cfg.keys.openai || '';
          document.getElementById('key-anthropic').value = cfg.keys.anthropic || '';
          document.getElementById('key-groq').value = cfg.keys.groq || '';

          // Set Checkboxes
          document.getElementById('cfg-think').checked = cfg.selfThink ?? false;
          document.getElementById('cfg-memory').checked = cfg.memoryEnabled ?? true;
          document.getElementById('cfg-sandbox').checked = cfg.safeMode ?? false;

          // Update Status pill
          document.getElementById('status-model').innerText = `${cfg.defaultProvider} / ${cfg.defaultModel}`;
          
          // Handle Theme
          document.body.className = `theme-${cfg.uiTheme}`;
        }
      });
  }

  const btnSaveSettings = document.getElementById('btn-save-settings');
  btnSaveSettings.addEventListener('click', () => {
    const configUpdates = {
      defaultProvider: document.getElementById('cfg-provider').value,
      defaultModel: document.getElementById('cfg-model').value,
      uiTheme: document.getElementById('cfg-theme').value,
      selfThink: document.getElementById('cfg-think').checked,
      memoryEnabled: document.getElementById('cfg-memory').checked,
      safeMode: document.getElementById('cfg-sandbox').checked,
      keys: {
        openrouter: document.getElementById('key-openrouter').value.trim() || undefined,
        openai: document.getElementById('key-openai').value.trim() || undefined,
        anthropic: document.getElementById('key-anthropic').value.trim() || undefined,
        groq: document.getElementById('key-groq').value.trim() || undefined
      }
    };

    fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(configUpdates)
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        alert('Configurations saved successfully!');
        fetchConfig(); // Sync UI
      }
    });
  });

  // Initial Boot Boots
  connectWebSocket();
  fetchConfig();
  fetchTelemetry();
  fetchGatewayStatus();
  fetchMemory();
  fetchTools();

  // Telemetry Poll interval
  setInterval(fetchTelemetry, 5000);
});
