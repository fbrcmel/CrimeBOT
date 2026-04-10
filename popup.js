const MODE_LABELS = {
  safe: "Roubar Doces de uma Crianca",
  clothesline: "Roubar Roupa do Estendal",
  pickpocket: "Carteirista",
  tourist: "Assaltar um Turista",
  basiccar: "Invadir um Carro Basico",
  convenience: "Furtar numa Loja de Conveniencia",
  mermaid: "O Olho da Sereia",
  narcos: "Laboratorio Narcos",
  risky: "Assaltar um Turista",
};

function normalizeCrimeMode(mode) {
  if (mode === "risky") return "tourist";
  return MODE_LABELS[mode] ? mode : "safe";
}

function getGameCycle(data) {
  if (data?.gameCycle?.name) {
    return data.gameCycle;
  }

  return { name: "Sincronizando", best: "neutro" };
}

function getGameTime(data) {
  if (data?.gameTime?.value) {
    return data.gameTime.value;
  }

  return "--:--:--";
}

function getQaEvents(data) {
  return Array.isArray(data?.qaEvents) ? data.qaEvents : [];
}

function getQaReport(data) {
  return data?.qaReport && typeof data.qaReport === "object" ? data.qaReport : null;
}

function formatMoney(value) {
  return `$${Number(value || 0).toLocaleString("pt-BR")}`;
}

function getToggleHelper(enabled, config, cycle) {
  if (!enabled) return "Pronto para iniciar a automacao";
  if (config.autoCrime && cycle.best === "crimes") return "Janela boa para crimes automaticos";
  return "Bot em execucao e monitorando a rotina";
}

function summarizeQaEvents(events) {
  return events.reduce((summary, event) => {
    if (event.severity === "error") {
      summary.errors += 1;
    } else if (event.severity === "warning") {
      summary.warnings += 1;
    } else {
      summary.info += 1;
    }

    return summary;
  }, {
    errors: 0,
    warnings: 0,
    info: 0,
  });
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) {
    element.textContent = value;
  }
}

function formatAuditTime(isoDate) {
  if (!isoDate) return "";

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("pt-BR");
}

function buildQaItems(report, events) {
  if (Array.isArray(report?.issues) && report.issues.length > 0) {
    return report.issues.slice(0, 5).map((issue) => ({
      severity: issue.severity || "info",
      title: issue.message || "Achado QA",
      detail: issue.context || issue.type || "",
    }));
  }

  return events.slice(0, 5).map((event) => ({
    severity: event.severity || "info",
    title: event.message || "Evento monitorado",
    detail: event.context || event.source || event.page || "",
  }));
}

function renderQaItems(items) {
  const container = document.getElementById("qa-issues");
  if (!container) return;

  container.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("li");
    empty.className = "qa-item";

    const title = document.createElement("div");
    title.className = "qa-item-title";
    title.textContent = "Nenhum achado salvo ainda.";

    const detail = document.createElement("div");
    detail.className = "qa-item-detail";
    detail.textContent = "Quando voce rodar a auditoria, os achados principais vao aparecer aqui.";

    empty.appendChild(title);
    empty.appendChild(detail);
    container.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const li = document.createElement("li");
    li.className = "qa-item";

    const top = document.createElement("div");
    top.className = "qa-item-top";

    const title = document.createElement("div");
    title.className = "qa-item-title";
    title.textContent = item.title;

    const badge = document.createElement("span");
    const severity = ["error", "warning", "info"].includes(item.severity) ? item.severity : "info";
    badge.className = `qa-badge ${severity}`;
    badge.textContent = severity;

    top.appendChild(title);
    top.appendChild(badge);

    li.appendChild(top);

    if (item.detail) {
      const detail = document.createElement("div");
      detail.className = "qa-item-detail";
      detail.textContent = item.detail;
      li.appendChild(detail);
    }

    container.appendChild(li);
  });
}

function updateQaUI(data) {
  const qaEvents = getQaEvents(data);
  const qaReport = getQaReport(data);
  const qaSummary = summarizeQaEvents(qaEvents);

  setText("qa-errors", qaSummary.errors);
  setText("qa-warnings", qaSummary.warnings);
  setText("qa-inputs", qaReport?.summary?.inputsTested || 0);
  setText("qa-issues-total", qaReport?.summary?.issuesFound ?? (qaSummary.errors + qaSummary.warnings));

  if (qaReport) {
    const auditTime = formatAuditTime(qaReport.generatedAt);
    setText(
      "qa-status",
      auditTime
        ? `Ultima auditoria rodada as ${auditTime} em ${qaReport.path || "/"}.`
        : `Ultima auditoria salva em ${qaReport.path || "/"}.`
    );

    setText(
      "qa-last-page",
      qaReport.path ? `${qaReport.title || "crime.life"} - ${qaReport.path}` : (qaReport.title || "crime.life")
    );

    setText(
      "qa-last-summary",
      `Forms: ${qaReport.summary?.formsFound || 0} | Inputs testados: ${qaReport.summary?.inputsTested || 0} | Payloads: ${qaReport.summary?.payloadsRun || 0} | Novos eventos: ${qaReport.summary?.newAuditEvents || 0}`
    );
  } else if (qaEvents.length > 0) {
    setText("qa-status", `Monitoramento ativo: ${qaEvents.length} eventos recentes capturados no front.`);
    setText("qa-last-page", "Sem auditoria completa");
    setText("qa-last-summary", "O monitor de erros ja esta coletando falhas e avisos da pagina.");
  } else {
    setText("qa-status", "Abra o crime.life e rode a auditoria segura na tela que voce quer validar.");
    setText("qa-last-page", "Nenhuma auditoria executada");
    setText("qa-last-summary", "A extensao monitora erros do front e testa inputs sem enviar formularios.");
  }

  renderQaItems(buildQaItems(qaReport, qaEvents));
}

function updateUI(data) {
  const enabled = Boolean(data.botEnabled);
  const stats = data.stats || {};
  const config = data.config || {};
  const cycle = getGameCycle(data);
  const normalizedCrimeMode = normalizeCrimeMode(config.crimeMode);

  document.body.dataset.active = enabled ? "true" : "false";

  const toggle = document.getElementById("main-toggle");
  const led = document.getElementById("main-led");
  const toggleLabel = document.getElementById("toggle-label");
  const toggleHelper = document.getElementById("toggle-helper");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const cycleInfo = document.getElementById("cycle-info");

  if (toggle) toggle.className = enabled ? "on" : "off";
  if (led) led.className = `led ${enabled ? "on" : ""}`;
  if (toggleLabel) toggleLabel.textContent = enabled ? "DESLIGAR BOT" : "LIGAR BOT";
  if (toggleHelper) toggleHelper.textContent = getToggleHelper(enabled, config, cycle);

  if (statusDot) statusDot.className = `status-dot ${enabled ? "on" : ""}`;
  if (statusText) statusText.textContent = enabled ? "ATIVO" : "INATIVO";
  if (cycleInfo) cycleInfo.textContent = cycle.name;

  setText("p-crimes", stats.crimesExecuted || 0);
  setText("p-money", formatMoney(stats.totalEarned));
  setText("p-uptime", getGameTime(data));

  document.getElementById("p-autocrime").checked = Boolean(config.autoCrime);
  document.getElementById("p-autoenergy").checked = Boolean(config.autoEnergy);
  document.getElementById("p-crimemode").value = normalizedCrimeMode;

  updateQaUI(data);
}

function refreshUI() {
  chrome.storage.local.get(null, updateUI);
}

function saveConfig() {
  const config = {
    autoCrime: document.getElementById("p-autocrime").checked,
    autoEnergy: document.getElementById("p-autoenergy").checked,
    crimeMode: document.getElementById("p-crimemode").value,
  };

  chrome.runtime.sendMessage({ type: "UPDATE_CONFIG", config }, refreshUI);
}

function setQaButtonState(isRunning) {
  const button = document.getElementById("run-qa-audit");
  if (!button) return;

  button.disabled = isRunning;
  button.textContent = isRunning ? "Auditando pagina..." : "Rodar auditoria na pagina";
}

function runQaAudit() {
  setQaButtonState(true);
  setText("qa-status", "Executando auditoria segura na aba atual...");

  chrome.runtime.sendMessage({ type: "RUN_QA_AUDIT" }, (response) => {
    setQaButtonState(false);

    if (chrome.runtime.lastError) {
      setText("qa-status", "Nao consegui falar com a extensao para rodar a auditoria.");
      return;
    }

    if (!response?.success) {
      setText("qa-status", response?.error || "A auditoria nao conseguiu concluir o scan.");
      return;
    }

    refreshUI();
  });
}

chrome.storage.local.get(null, updateUI);

setInterval(() => {
  chrome.storage.local.get(["stats", "botEnabled", "config", "gameCycle", "gameTime", "qaEvents", "qaReport"], (data) => {
    const cycle = getGameCycle(data);
    const uptime = document.getElementById("p-uptime");
    const cycleInfo = document.getElementById("cycle-info");
    const toggleHelper = document.getElementById("toggle-helper");

    if (uptime) {
      uptime.textContent = getGameTime(data);
    }

    if (cycleInfo) cycleInfo.textContent = cycle.name;

    if (toggleHelper) {
      toggleHelper.textContent = getToggleHelper(Boolean(data.botEnabled), data.config || {}, cycle);
    }

    updateQaUI(data);
  });
}, 1000);

document.getElementById("main-toggle").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "TOGGLE_BOT" }, refreshUI);
});

document.getElementById("p-autocrime").addEventListener("change", saveConfig);
document.getElementById("p-autoenergy").addEventListener("change", saveConfig);
document.getElementById("p-crimemode").addEventListener("change", saveConfig);
document.getElementById("run-qa-audit").addEventListener("click", runQaAudit);

chrome.storage.onChanged.addListener(refreshUI);
