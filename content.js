(() => {
  "use strict";

  const ALLOWED_HOSTS = new Set(["crime.life", "www.crime.life"]);
  const previousController = window.__crimeBotController;

  if (previousController?.destroy) {
    previousController.destroy();
  }

  if (!ALLOWED_HOSTS.has(window.location.hostname)) return;

  const CONFIG = {
    stateWaitTimeoutMs: 4000,
    actionCompletionTimeoutMs: 15000,
    carouselSearchLimit: 14,
    warningCooldownMs: 15000,
    successCooldownMs: 3000,
    autoEnergyTriggerThreshold: 14,
    qaEventLimit: 80,
    qaInputSampleLimit: 8,
    defaultConfig: {
      autoCrime: false,
      autoEnergy: false,
      autoShop: false,
      crimeMode: "safe",
      energyThreshold: 10,
      checkInterval: 30,
    },
    defaultStats: {
      crimesExecuted: 0,
      totalEarned: 0,
      trainsCompleted: 0,
      startTime: null,
    },
    crimeModes: {
      safe: {
        label: "Roubar Doces de uma Crianca",
        shortLabel: "Roubar Doces",
        aliases: [
          "roubar doces de uma crianca",
          "roubar doces",
          "steal candy from a child",
        ],
      },
      clothesline: {
        label: "Roubar Roupa do Estendal",
        shortLabel: "Roupa do Estendal",
        aliases: [
          "roubar roupa do estendal",
          "roubar roupa",
        ],
      },
      pickpocket: {
        label: "Carteirista",
        shortLabel: "Carteirista",
        aliases: [
          "carteirista",
          "pickpocket",
        ],
      },
      tourist: {
        label: "Assaltar um Turista",
        shortLabel: "Turista",
        aliases: [
          "assaltar um turista",
          "assaltar turista",
          "tourista",
        ],
      },
      basiccar: {
        label: "Invadir um Carro Basico",
        shortLabel: "Carro Basico",
        aliases: [
          "invadir um carro basico",
          "invadir carro basico",
          "carro basico",
          "basic car",
        ],
      },
      convenience: {
        label: "Furtar numa Loja de Conveniencia",
        shortLabel: "Loja de Conveniencia",
        aliases: [
          "furtar numa loja de conveniencia",
          "furtar loja de conveniencia",
          "loja de conveniencia",
          "convenience store",
        ],
      },
      mermaid: {
        label: "O Olho da Sereia",
        shortLabel: "Olho da Sereia",
        aliases: [
          "o olho da sereia",
          "olho da sereia",
          "sereia",
          "mermaid eye",
        ],
      },
      narcos: {
        label: "Laboratorio Narcos",
        shortLabel: "Narcos",
        aliases: [
          "laboratorio narcos",
          "narcos",
        ],
      },
    },
    detentionDefinitions: {
      prison: {
        label: "Prisao",
        configKey: "autoPrison",
        titleAliases: ["prisao da cidade", "prisao"],
        exitAliases: ["sair da prisao"],
        waitAliases: ["a cumprir pena", "cumprir pena"],
        contextAliases: [
          "recluso",
          "restante",
          "subornar um guarda",
          "fazer flexoes",
          "farmacia",
        ],
      },
      hospital: {
        label: "Hospital",
        configKey: "autoHospital",
        titleAliases: ["hospital"],
        exitAliases: ["sair do hospital"],
        waitAliases: [
          "aguardar alta",
          "receber alta",
          "em tratamento",
          "em recuperacao",
          "recuperando",
        ],
        contextAliases: [
          "restante",
          "alta",
          "tratamento",
          "medico",
          "paramedico",
        ],
      },
    },
    dockCrimeTexts: ["crime", "crimes", "roubar", "assaltar"],
    dockClubTexts: ["clubes", "clubes noturnos", "clube"],
    panelCrimeTexts: [
      "usar toda a energia",
      "gastar toda a energia",
      "executar crime",
      "hipotese de sucesso",
      "roubar doces",
      "roubar roupa do estendal",
      "carteirista",
      "assaltar um turista",
      "assaltar turista",
      "invadir um carro basico",
      "carro basico",
      "laboratorio narcos",
      "crime",
      "crimes",
    ],
    panelClubTexts: [
      "clubes noturnos",
      "a sarjeta",
      "ushuaia",
      "visitantes",
      "servicos",
      "drogas",
    ],
    sarjetaAliases: ["a sarjeta", "sarjeta"],
    jorgeAliases: ["jorge"],
    jorgeActionTexts: ["contratar (ok)", "contratar ok", "contratar"],
    actionTexts: [
      "usar toda a energia (10x)",
      "usar toda a energia",
      "gastar toda a energia",
      "usar energia",
      "10x",
      "treinar 10x",
    ],
    cycleDefinitions: [
      { key: "alta noite", name: "Alta noite", best: "crimes", generic: false },
      { key: "madrugada", name: "Madrugada", best: "neutro", generic: false },
      { key: "fim da tarde", name: "Fim da tarde", best: "crimes", generic: false },
      { key: "manha", name: "Manha", best: "treino", generic: true },
      { key: "noite", name: "Noite", best: "crimes", generic: true },
      { key: "dia", name: "Dia", best: "ruim", generic: true },
    ],
  };

  const state = {
    enabled: false,
    running: false,
    initialized: false,
    config: { ...CONFIG.defaultConfig },
    stats: { ...CONFIG.defaultStats },
    gameCycle: null,
    gameTime: null,
    logs: [],
    qaEvents: [],
    qaReport: null,
    qaEventSeq: 0,
    qaMonitoringReady: false,
    qaAuditRunning: false,
    qaErrorHandler: null,
    qaRejectionHandler: null,
    qaSecurityHandler: null,
    lastQaEventAt: new Map(),
    lastLogAt: new Map(),
    cycleTimerId: null,
    mutationObserver: null,
    stepScheduled: false,
    energyBlocked: false,
    lastKnownEnergy: null,
    lastCrimeEnergyCost: null,
  };

  const controller = {
    destroy() {
      if (state.cycleTimerId !== null) {
        window.clearInterval(state.cycleTimerId);
        state.cycleTimerId = null;
      }

      if (state.mutationObserver) {
        state.mutationObserver.disconnect();
        state.mutationObserver = null;
      }

      if (state.qaErrorHandler) {
        window.removeEventListener("error", state.qaErrorHandler, true);
        state.qaErrorHandler = null;
      }

      if (state.qaRejectionHandler) {
        window.removeEventListener("unhandledrejection", state.qaRejectionHandler, true);
        state.qaRejectionHandler = null;
      }

      if (state.qaSecurityHandler) {
        document.removeEventListener("securitypolicyviolation", state.qaSecurityHandler, true);
        state.qaSecurityHandler = null;
      }

      state.qaMonitoringReady = false;
      state.enabled = false;
      state.running = false;
    },
  };

  window.__crimeBotController = controller;

  function queryAll(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
  }

  function nextFrame() {
    return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  async function waitForCondition(getValue, timeoutMs = CONFIG.stateWaitTimeoutMs) {
    const startedAt = performance.now();

    while (performance.now() - startedAt < timeoutMs) {
      const result = getValue();
      if (result) {
        return result;
      }

      await nextFrame();
    }

    return null;
  }

  function normalizeText(value) {
    return String(value ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  function isElementVisible(element) {
    if (!(element instanceof Element)) return false;

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      style.opacity !== "0" &&
      rect.width > 8 &&
      rect.height > 8
    );
  }

  function isClickableLike(element) {
    if (!(element instanceof Element)) return false;

    if (element.tagName === "BUTTON" || element.tagName === "A") return true;
    if (element.getAttribute("role") === "button") return true;
    if (element.hasAttribute("tabindex")) return true;

    const style = window.getComputedStyle(element);
    return style.cursor === "pointer";
  }

  function isElementDisabled(element) {
    if (!(element instanceof Element)) return false;

    return (
      element.hasAttribute("disabled") ||
      element.getAttribute("aria-disabled") === "true"
    );
  }

  function getElementCenter(element) {
    if (!(element instanceof Element)) return null;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;

    return {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
      rect,
    };
  }

  function getTopmostElementAtCenter(element) {
    const center = getElementCenter(element);
    if (!center) return null;

    const candidate = document.elementFromPoint(center.x, center.y);
    return candidate instanceof Element ? candidate : null;
  }

  function isElementTopmost(element) {
    const topmost = getTopmostElementAtCenter(element);
    if (!topmost) return false;

    return (
      topmost === element ||
      element.contains(topmost) ||
      topmost.contains(element)
    );
  }

  function getElementActionText(element) {
    if (!(element instanceof Element)) return "";

    return normalizeText(
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.textContent
    );
  }

  function resolveActionableTarget(element) {
    if (!(element instanceof Element)) return null;

    let current = element;

    while (current && current !== document.body) {
      if (isClickableLike(current) && isElementVisible(current)) {
        return current;
      }
      current = current.parentElement;
    }

    return element;
  }

  function dispatchRealClick(element) {
    const baseTarget = resolveActionableTarget(element);
    const topmostTarget = baseTarget ? getTopmostElementAtCenter(baseTarget) : null;
    const target = resolveActionableTarget(
      topmostTarget &&
      (topmostTarget === baseTarget || baseTarget?.contains(topmostTarget) || topmostTarget.contains(baseTarget))
        ? topmostTarget
        : baseTarget
    );
    if (!target || !isElementVisible(target) || isElementDisabled(target)) return false;

    const center = getElementCenter(target);
    if (!center) return false;

    const clientX = center.x;
    const clientY = center.y;
    const mouseOptions = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX,
      clientY,
      button: 0,
      buttons: 1,
    };
    const pointerOptions = {
      ...mouseOptions,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    };

    target.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });

    if (typeof PointerEvent === "function") {
      for (const type of ["pointerenter", "pointerover", "pointerdown", "pointerup"]) {
        target.dispatchEvent(new PointerEvent(type, pointerOptions));
      }
    }

    for (const type of ["mouseenter", "mouseover", "mousedown", "mouseup", "click"]) {
      target.dispatchEvent(new MouseEvent(type, mouseOptions));
    }

    return true;
  }

  function activateElement(element) {
    const target = resolveActionableTarget(element);
    if (!target || !isElementVisible(target) || isElementDisabled(target)) return false;

    target.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });

    try {
      target.focus({ preventScroll: true });
    } catch (_) {
      // Ignore focus failures on non-focusable elements.
    }

    if (target instanceof HTMLElement && typeof target.click === "function") {
      target.click();
      return true;
    }

    return dispatchRealClick(target);
  }

  function requestMainWorldUseAllEnergyClick() {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { type: "MAIN_WORLD_CLICK_USE_ALL_ENERGY" },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve(false);
              return;
            }

            resolve(Boolean(response?.success));
          }
        );
      } catch (_) {
        resolve(false);
      }
    });
  }

  function requestMainWorldServiceActionClick(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "MAIN_WORLD_CLICK_SERVICE_ACTION",
            payload,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve(false);
              return;
            }

            resolve(Boolean(response?.success));
          }
        );
      } catch (_) {
        resolve(false);
      }
    });
  }

  function requestMainWorldCrimeClick(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "MAIN_WORLD_CLICK_CRIME",
            payload,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve(false);
              return;
            }

            resolve(Boolean(response?.success));
          }
        );
      } catch (_) {
        resolve(false);
      }
    });
  }

  function requestMainWorldDetentionExitClick(payload) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          {
            type: "MAIN_WORLD_CLICK_DETENTION_EXIT",
            payload,
          },
          (response) => {
            if (chrome.runtime.lastError) {
              resolve(false);
              return;
            }

            resolve(Boolean(response?.success));
          }
        );
      } catch (_) {
        resolve(false);
      }
    });
  }

  function dispatchKeyboardActivation(element) {
    const target = resolveActionableTarget(element);
    if (!target || !isElementVisible(target) || isElementDisabled(target)) return false;

    try {
      target.focus({ preventScroll: true });
    } catch (_) {
      // Ignore focus failures on non-focusable elements.
    }

    const events = [
      new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
      new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true, cancelable: true }),
      new KeyboardEvent("keydown", { key: " ", code: "Space", bubbles: true, cancelable: true }),
      new KeyboardEvent("keyup", { key: " ", code: "Space", bubbles: true, cancelable: true }),
    ];

    for (const event of events) {
      target.dispatchEvent(event);
    }

    return true;
  }

  function sendRuntimeMessage(message, callback) {
    try {
      chrome.runtime.sendMessage(message, (...args) => {
        if (chrome.runtime.lastError) return;
        if (typeof callback === "function") callback(...args);
      });
    } catch (_) {
      // Ignore runtime failures during extension reloads.
    }
  }

  function getUnknownCycle() {
    return { name: "Sincronizando", best: "neutro" };
  }

  function matchCycleFromText(text) {
    const normalized = normalizeText(text);
    if (!normalized) return null;

    let bestMatch = null;

    for (const definition of CONFIG.cycleDefinitions) {
      let score = 0;
      const prefixed = `hora ${definition.key}`;

      if (normalized === definition.key) {
        score = 250;
      } else if (normalized === prefixed || normalized.startsWith(`${prefixed} `) || normalized.includes(prefixed)) {
        score = 220;
      } else if (!definition.generic && normalized.includes(definition.key) && normalized.length <= definition.key.length + 22) {
        score = 170;
      }

      if (score > 0 && (!bestMatch || score > bestMatch.score)) {
        bestMatch = {
          name: definition.name,
          best: definition.best,
          score,
        };
      }
    }

    return bestMatch;
  }

  function deriveCycleFromGameTimeValue(value) {
    const match = String(value ?? "").match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return null;

    const hour = Number(match[1]);
    if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;

    let key = null;

    if (hour < 4) {
      key = "alta noite";
    } else if (hour < 8) {
      key = "madrugada";
    } else if (hour < 12) {
      key = "manha";
    } else if (hour < 18) {
      key = "dia";
    } else if (hour < 20) {
      key = "fim da tarde";
    } else {
      key = "noite";
    }

    const definition = CONFIG.cycleDefinitions.find((entry) => entry.key === key);
    if (!definition) return null;

    return {
      name: definition.name,
      best: definition.best,
      source: "game-time",
      updatedAt: Date.now(),
    };
  }

  function detectGameCycleFromDom() {
    const candidates = queryAll("div, span, p, strong, button, a")
      .filter(isElementVisible)
      .map((element) => ({
        text: getElementActionText(element),
        rect: element.getBoundingClientRect(),
      }));

    let bestMatch = null;

    for (const candidate of candidates) {
      const cycle = matchCycleFromText(candidate.text);
      if (!cycle) continue;

      const positionBonus = candidate.rect.top < window.innerHeight * 0.5 ? 8 : 0;
      const score = cycle.score + positionBonus - Math.min(candidate.text.length, 140) / 20;

      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          name: cycle.name,
          best: cycle.best,
          score,
        };
      }
    }

    if (!bestMatch) {
      const detectedGameTime = detectGameTimeFromDom() || state.gameTime || null;
      return deriveCycleFromGameTimeValue(detectedGameTime?.value);
    }

    return {
      name: bestMatch.name,
      best: bestMatch.best,
      source: "dom",
      updatedAt: Date.now(),
    };
  }

  function sameCycle(a, b) {
    return Boolean(a && b && a.name === b.name && a.best === b.best);
  }

  function sameGameTime(a, b) {
    return Boolean(a && b && a.value === b.value);
  }

  function normalizeCrimeMode(mode) {
    if (mode === "risky") return "tourist";
    if (Object.prototype.hasOwnProperty.call(CONFIG.crimeModes, mode)) {
      return mode;
    }

    return "safe";
  }

  function getPreferredCrimeDefinition(mode = state.config.crimeMode) {
    const normalizedMode = normalizeCrimeMode(mode);
    return CONFIG.crimeModes[normalizedMode] || CONFIG.crimeModes.safe;
  }

  function matchesCrimeDefinition(text, definition) {
    if (!definition) return false;

    const normalized = normalizeText(text);
    if (!normalized) return false;

    return definition.aliases.some((alias) => normalized.includes(normalizeText(alias)));
  }

  function detectGameTimeFromDom() {
    const exactTimeRegex = /^\d{2}:\d{2}:\d{2}$/;
    const candidates = queryAll("div, span, p, strong")
      .filter(isElementVisible)
      .map((element) => {
        const text = String(element.textContent ?? "").trim();
        if (!exactTimeRegex.test(text)) return null;

        const rect = element.getBoundingClientRect();
        let score = 0;

        if (rect.top < 120) score += 140;
        if (rect.left < window.innerWidth * 0.3) score += 90;
        if (rect.left < 220) score += 45;
        if (rect.top < 70) score += 20;
        if (rect.left > window.innerWidth * 0.75) score -= 120;
        if (rect.top > window.innerHeight * 0.45) score -= 90;

        return {
          value: text,
          score,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (!candidates.length || candidates[0].score < 80) return null;

    return {
      value: candidates[0].value,
      source: "dom",
      updatedAt: Date.now(),
    };
  }

  function getGameCycle() {
    return state.gameCycle || getUnknownCycle();
  }

  function syncGameCycle(force = false) {
    const detectedCycle = detectGameCycleFromDom();
    if (!detectedCycle) return null;

    if (!force && sameCycle(state.gameCycle, detectedCycle)) {
      return state.gameCycle;
    }

    state.gameCycle = detectedCycle;
    sendRuntimeMessage({
      type: "UPDATE_GAME_CYCLE",
      gameCycle: detectedCycle,
    });

    return detectedCycle;
  }

  function getUnknownGameTime() {
    return { value: "--:--:--" };
  }

  function getGameTime() {
    return state.gameTime || getUnknownGameTime();
  }

  function syncGameTime(force = false) {
    const detectedGameTime = detectGameTimeFromDom();
    if (!detectedGameTime) return null;

    if (!force && sameGameTime(state.gameTime, detectedGameTime)) {
      return state.gameTime;
    }

    state.gameTime = detectedGameTime;
    sendRuntimeMessage({
      type: "UPDATE_GAME_TIME",
      gameTime: detectedGameTime,
    });

    return detectedGameTime;
  }

  function startCycleSync() {
    if (state.cycleTimerId !== null) return;

    syncGameCycle(true);
    syncGameTime(true);
    state.cycleTimerId = window.setInterval(() => {
      syncGameCycle();
      syncGameTime();
    }, 1000);
  }

  function logMessage(text, type = "info", key = text, cooldownMs = 0) {
    const now = Date.now();
    const lastAt = state.lastLogAt.get(key) || 0;

    if (cooldownMs > 0 && now - lastAt < cooldownMs) return;

    state.lastLogAt.set(key, now);

    sendRuntimeMessage({
      type: "ADD_LOG",
      text,
      logType: type,
    });
  }

  function getVisibleActionables(root = document, options = {}) {
    const { includeDisabled = false } = options;
    const unique = [];
    const seen = new Set();

    for (const element of queryAll("button, a, [role='button'], [tabindex], div, span", root)) {
      if (!isElementVisible(element)) continue;

      const target = resolveActionableTarget(element);
      if (!(target instanceof Element)) continue;
      if (!isClickableLike(target)) continue;
      if (!isElementVisible(target)) continue;
      if (!includeDisabled && isElementDisabled(target)) continue;

      const rect = target.getBoundingClientRect();
      const key = [
        target.tagName,
        Math.round(rect.left),
        Math.round(rect.top),
        Math.round(rect.width),
        Math.round(rect.height),
      ].join(":");

      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(target);
    }

    return unique;
  }

  function findActionableInRootByTexts(root, texts, options = {}) {
    if (!(root instanceof Element) && root !== document) return null;

    const directMatch = findBestTextMatch(getVisibleActionables(root, options), texts);
    if (directMatch) return resolveActionableTarget(directMatch);

    return null;
  }

  function getDetentionModal(definition) {
    if (!definition) return null;

    const candidates = queryAll("div, section, article")
      .filter(isElementVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        if (
          rect.width < 280 ||
          rect.height < 180 ||
          rect.left > window.innerWidth * 0.82 ||
          rect.right < window.innerWidth * 0.18 ||
          rect.top > window.innerHeight * 0.82 ||
          rect.bottom < window.innerHeight * 0.12
        ) {
          return null;
        }

        const text = normalizeText(element.innerText || element.textContent || "");
        if (!text) return null;

        let score = 0;
        score += scoreMatch(text, definition.titleAliases) * 2;
        score += scoreMatch(text, definition.exitAliases) * 2;
        score += scoreMatch(text, definition.waitAliases);
        score += scoreMatch(text, definition.contextAliases);

        if (text.includes("restante")) score += 60;
        if (rect.left > window.innerWidth * 0.22 && rect.right < window.innerWidth * 0.78) score += 18;
        if (rect.top > 80 && rect.bottom < window.innerHeight * 0.94) score += 18;

        if (score < 150) return null;

        return {
          element,
          score: score + Math.min((rect.width * rect.height) / 20000, 60),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.element || null;
  }

  function extractDetentionRemainingText(rawText) {
    const normalized = normalizeText(rawText);
    if (!normalized) return null;

    const timerMatch = normalized.match(/restante[: ]+(\d+\s*[smhd])/i);
    return timerMatch ? timerMatch[1].replace(/\s+/g, "") : null;
  }

  function getDetentionState(definition) {
    const modal = getDetentionModal(definition);
    if (!modal) return null;

    const rawText = normalizeText(modal.innerText || modal.textContent || "");
    if (!rawText) return null;

    return {
      definition,
      modal,
      rawText,
      remainingText: extractDetentionRemainingText(rawText),
      exitButton: findActionableInRootByTexts(modal, definition.exitAliases),
      waitButton: findActionableInRootByTexts(modal, definition.waitAliases, { includeDisabled: true }),
    };
  }

  function getActiveDetentionState() {
    const states = Object.values(CONFIG.detentionDefinitions)
      .map((definition) => getDetentionState(definition))
      .filter(Boolean)
      .sort((a, b) => {
        const aHasExit = Boolean(a.exitButton);
        const bHasExit = Boolean(b.exitButton);
        if (aHasExit !== bHasExit) return Number(bHasExit) - Number(aHasExit);

        const aHasRemaining = Boolean(a.remainingText);
        const bHasRemaining = Boolean(b.remainingText);
        if (aHasRemaining !== bHasRemaining) return Number(bHasRemaining) - Number(aHasRemaining);

        return b.rawText.length - a.rawText.length;
      });

    return states[0] || null;
  }

  function shouldBypassEnergyGate() {
    return Boolean(state.config.autoEnergy);
  }

  async function handleDetentionState() {
    return { handled: false, actionDone: false };
  }

  function isEnergyFull(energy) {
    if (!energy) return false;
    if (!Number.isFinite(energy.current) || !Number.isFinite(energy.max)) return false;
    if (energy.max <= 0) return false;

    return energy.current >= energy.max;
  }

  function getAutoEnergyTriggerThreshold(energy) {
    const normalizedThreshold = Math.max(0, Math.floor(Number(CONFIG.autoEnergyTriggerThreshold) || 0));

    if (!energy || !Number.isFinite(energy.max) || energy.max <= 0) {
      return normalizedThreshold;
    }

    return Math.min(normalizedThreshold, energy.max);
  }

  function getMinimumCrimeEnergy(energy) {
    if (!energy || !Number.isFinite(energy.max) || energy.max <= 0) {
      return getAutoEnergyTriggerThreshold(energy) + 1;
    }

    return Math.min(getAutoEnergyTriggerThreshold(energy) + 1, energy.max);
  }

  function getKnownCrimeEnergyRequirement(energy) {
    const knownCost = Number(state.lastCrimeEnergyCost);
    if (!Number.isFinite(knownCost) || knownCost <= 0) {
      return getMinimumCrimeEnergy(energy);
    }

    if (!energy || !Number.isFinite(energy.max) || energy.max <= 0) {
      return Math.max(1, Math.floor(knownCost));
    }

    return Math.min(Math.max(1, Math.floor(knownCost)), energy.max);
  }

  function hasMinimumCrimeEnergy(energy, requiredCrimeEnergy = getKnownCrimeEnergyRequirement(energy)) {
    if (!energy) return false;
    if (!Number.isFinite(energy.current) || !Number.isFinite(energy.max)) return false;
    if (energy.max <= 0) return false;

    const requiredEnergy = Number.isFinite(requiredCrimeEnergy) && requiredCrimeEnergy > 0
      ? Math.min(Math.floor(requiredCrimeEnergy), energy.max)
      : getKnownCrimeEnergyRequirement(energy);

    return energy.current >= requiredEnergy;
  }

  function shouldRecoverEnergy(energy, requiredCrimeEnergy = getKnownCrimeEnergyRequirement(energy)) {
    if (!energy) return false;
    if (!Number.isFinite(energy.current) || !Number.isFinite(energy.max)) return false;
    if (energy.max <= 0) return false;
    if (isEnergyFull(energy)) return false;
    if (hasMinimumCrimeEnergy(energy, requiredCrimeEnergy)) return false;

    return energy.current <= getAutoEnergyTriggerThreshold(energy);
  }

  function refreshEnergyGate(energy = getEnergy()) {
    if (!energy || !Number.isFinite(energy.current)) {
      return false;
    }

    state.lastKnownEnergy = energy.current;

    if (!state.config.autoCrime || hasMinimumCrimeEnergy(energy) || shouldRecoverEnergy(energy)) {
      state.energyBlocked = false;
      return true;
    }

    state.energyBlocked = true;
    return false;
  }

  function scheduleBotStep(trigger = "scheduled") {
    if (!state.enabled || state.running || state.stepScheduled) return;
    if (state.energyBlocked && !refreshEnergyGate() && !shouldBypassEnergyGate()) return;

    state.stepScheduled = true;
    queueMicrotask(() => {
      state.stepScheduled = false;

      if (!state.enabled || state.running) return;
      if (state.energyBlocked && !refreshEnergyGate() && !shouldBypassEnergyGate()) return;
      void botStep(trigger);
    });
  }

  function startActionObserver() {
    if (state.mutationObserver || !document.body) return;

    state.mutationObserver = new MutationObserver(() => {
      scheduleBotStep("mutation");
    });

    state.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        scheduleBotStep("visibility");
      }
    });
  }

  function updateStats(partial) {
    state.stats = { ...state.stats, ...partial };
    sendRuntimeMessage({ type: "UPDATE_STATS", stats: partial });
  }

  function syncState(data = {}) {
    state.enabled = Boolean(data.botEnabled);
    state.config = { ...CONFIG.defaultConfig, ...(data.config || {}) };
    state.stats = { ...CONFIG.defaultStats, ...(data.stats || {}) };
    state.gameCycle = data.gameCycle || null;
    state.gameTime = data.gameTime || null;
    state.logs = Array.isArray(data.logs) ? data.logs : [];
    state.qaEvents = Array.isArray(data.qaEvents) ? data.qaEvents : [];
    state.qaReport = data.qaReport || null;
  }

  function truncateText(value, maxLength = 180) {
    const text = String(value ?? "").trim();
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
  }

  function serializeQaReason(reason) {
    if (reason instanceof Error) {
      return truncateText(reason.message || reason.name || "Erro inesperado");
    }

    if (typeof reason === "string") {
      return truncateText(reason);
    }

    if (reason && typeof reason === "object") {
      try {
        return truncateText(JSON.stringify(reason));
      } catch (_) {
        return truncateText(String(reason));
      }
    }

    return truncateText(String(reason || "Erro inesperado"));
  }

  function getQaDomPath(element) {
    if (!(element instanceof Element)) return "";

    const parts = [];
    let current = element;

    while (current && current instanceof Element && parts.length < 4) {
      const tag = current.tagName.toLowerCase();
      const id = current.id ? `#${current.id}` : "";
      const classes = Array.from(current.classList || []).slice(0, 2).map((entry) => `.${entry}`).join("");
      parts.unshift(`${tag}${id}${classes}`);

      if (current.id) break;
      current = current.parentElement;
    }

    return truncateText(parts.join(" > "), 150);
  }

  function getQaFieldLabel(element) {
    if (!(element instanceof Element)) return "campo sem identificacao";

    const labelText = truncateText(
      element.labels?.[0]?.textContent ||
      element.getAttribute("aria-label") ||
      element.getAttribute("placeholder") ||
      element.getAttribute("name") ||
      element.getAttribute("id") ||
      element.getAttribute("type") ||
      element.tagName.toLowerCase(),
      80
    );

    return labelText || "campo sem identificacao";
  }

  function buildQaFieldSnapshot(element) {
    if (!(element instanceof Element)) {
      return {
        valid: true,
        validationMessage: "",
        valueLength: 0,
      };
    }

    const currentValue = "value" in element ? String(element.value ?? "") : String(element.textContent ?? "");
    const valid = typeof element.checkValidity === "function" ? element.checkValidity() : true;
    const validationMessage = typeof element.validationMessage === "string"
      ? truncateText(element.validationMessage, 120)
      : "";

    return {
      valid,
      validationMessage,
      valueLength: currentValue.length,
    };
  }

  function setFormFieldValue(element, value) {
    if (element instanceof HTMLTextAreaElement) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value");
      if (descriptor?.set) {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }
      return;
    }

    if (element instanceof HTMLInputElement) {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      if (descriptor?.set) {
        descriptor.set.call(element, value);
      } else {
        element.value = value;
      }
      return;
    }

    element.textContent = value;
  }

  async function applyQaFieldValue(element, value) {
    if (!(element instanceof Element)) return;

    if (element instanceof HTMLElement) {
      try {
        element.focus({ preventScroll: true });
      } catch (_) {
        // Ignore focus failures.
      }
    }

    setFormFieldValue(element, value);

    const inputEvent = typeof InputEvent === "function"
      ? new InputEvent("input", {
        bubbles: true,
        composed: true,
        data: String(value ?? ""),
        inputType: "insertText",
      })
      : new Event("input", { bubbles: true, composed: true });

    element.dispatchEvent(inputEvent);
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));

    await nextFrame();
    await nextFrame();
  }

  function recordQaEvent(partial, options = {}) {
    const now = Date.now();
    const event = {
      id: `qa-${now}-${state.qaEventSeq + 1}`,
      sequence: ++state.qaEventSeq,
      createdAt: now,
      time: new Date(now).toLocaleTimeString("pt-BR"),
      page: `${window.location.pathname}${window.location.search}`,
      severity: partial?.severity || "warning",
      kind: partial?.kind || "runtime",
      message: truncateText(partial?.message || "Evento QA"),
      source: truncateText(partial?.source || "", 160),
      context: truncateText(partial?.context || "", 180),
    };

    const dedupeKey = `${event.severity}:${event.kind}:${event.message}:${event.source}:${event.context}`;
    const lastAt = state.lastQaEventAt.get(dedupeKey) || 0;
    const cooldownMs = Number(options.cooldownMs ?? 4000);

    if (cooldownMs > 0 && now - lastAt < cooldownMs) {
      return null;
    }

    state.lastQaEventAt.set(dedupeKey, now);
    state.qaEvents = [event, ...state.qaEvents].slice(0, CONFIG.qaEventLimit);

    if (options.persist !== false) {
      sendRuntimeMessage({ type: "QA_EVENT", event });
    }

    return event;
  }

  function getQaEventSummary(events = state.qaEvents) {
    return (events || []).reduce((summary, event) => {
      if (event.severity === "error") {
        summary.errors += 1;
      } else if (event.severity === "warning") {
        summary.warnings += 1;
      } else {
        summary.info += 1;
      }

      if (event.kind === "unhandled-rejection") {
        summary.promiseRejections += 1;
      }

      if (event.kind === "resource-error") {
        summary.resourceErrors += 1;
      }

      return summary;
    }, {
      errors: 0,
      warnings: 0,
      info: 0,
      promiseRejections: 0,
      resourceErrors: 0,
    });
  }

  function installQaMonitoring() {
    if (state.qaMonitoringReady) return;

    state.qaErrorHandler = (event) => {
      if (event.target && event.target !== window) {
        const target = event.target;
        const source = target.currentSrc || target.src || target.href || getQaDomPath(target);

        recordQaEvent({
          severity: "warning",
          kind: "resource-error",
          message: `Falha ao carregar recurso ${target.tagName.toLowerCase()}.`,
          source,
        });
        return;
      }

      recordQaEvent({
        severity: "error",
        kind: "runtime-error",
        message: event.message || event.error?.message || "Erro de script na pagina.",
        source: [event.filename, event.lineno, event.colno].filter(Boolean).join(":"),
      });
    };

    state.qaRejectionHandler = (event) => {
      recordQaEvent({
        severity: "error",
        kind: "unhandled-rejection",
        message: serializeQaReason(event.reason),
      });
    };

    state.qaSecurityHandler = (event) => {
      recordQaEvent({
        severity: "warning",
        kind: "csp-violation",
        message: `CSP bloqueou ${event.violatedDirective || "um recurso"}.`,
        source: event.blockedURI || "",
      });
    };

    window.addEventListener("error", state.qaErrorHandler, true);
    window.addEventListener("unhandledrejection", state.qaRejectionHandler, true);
    document.addEventListener("securitypolicyviolation", state.qaSecurityHandler, true);
    state.qaMonitoringReady = true;
  }

  function collectQaInputs() {
    const selector = [
      "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='file']):not([type='submit']):not([type='button']):not([disabled]):not([readonly])",
      "textarea:not([disabled]):not([readonly])",
    ].join(", ");

    return queryAll(selector)
      .filter(isElementVisible)
      .filter((element) => !element.closest("[hidden], [aria-hidden='true']"))
      .slice(0, CONFIG.qaInputSampleLimit);
  }

  function getQaPayloadsForField(element) {
    const fieldType = normalizeText(element.getAttribute("type") || element.tagName.toLowerCase());

    if (fieldType === "email") {
      return [
        { label: "email-valido", value: "qa+crime.life@example.com" },
        { label: "email-invalido", value: "sem-arroba" },
        { label: "email-longo", value: `qa.${"a".repeat(40)}@crime.life` },
      ];
    }

    if (fieldType === "number") {
      return [
        { label: "zero", value: "0" },
        { label: "negativo", value: "-1" },
        { label: "grande", value: "999999999" },
      ];
    }

    if (fieldType === "url") {
      return [
        { label: "url-valida", value: "https://crime.life/teste" },
        { label: "url-invalida", value: "sem-protocolo" },
        { label: "url-longa", value: `https://crime.life/${"a".repeat(60)}` },
      ];
    }

    if (fieldType === "tel") {
      return [
        { label: "telefone-curto", value: "11999999999" },
        { label: "telefone-formatado", value: "+55 11 99999-9999" },
        { label: "telefone-texto", value: "abc123" },
      ];
    }

    return [
      { label: "vazio", value: "" },
      { label: "curto", value: "teste" },
      { label: "espacos", value: "   " },
      { label: "especiais", value: "'\"<>/&" },
      { label: "longo", value: "A".repeat(140) },
    ];
  }

  function dedupeQaIssues(issues) {
    const seen = new Set();
    const unique = [];

    for (const issue of issues || []) {
      const key = [
        issue.severity || "info",
        issue.type || "issue",
        issue.message || "",
        issue.context || "",
      ].join("|");

      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(issue);
    }

    return unique;
  }

  async function runQaAudit() {
    if (state.qaAuditRunning) {
      return {
        success: false,
        error: "Ja existe uma auditoria em execucao nesta pagina.",
      };
    }

    state.qaAuditRunning = true;
    installQaMonitoring();

    try {
      const startedAt = Date.now();
      const auditStartSeq = state.qaEventSeq;
      const formsFound = queryAll("form").length;
      const inputs = collectQaInputs();
      const inputReports = [];
      const issues = [];

      for (const field of inputs) {
        const payloads = getQaPayloadsForField(field);
        const originalValue = "value" in field ? String(field.value ?? "") : String(field.textContent ?? "");
        const fieldLabel = getQaFieldLabel(field);
        const fieldPath = getQaDomPath(field);
        const fieldType = normalizeText(field.getAttribute("type") || field.tagName.toLowerCase()) || "text";
        const fieldReport = {
          label: fieldLabel,
          path: fieldPath,
          type: fieldType,
          required: Boolean(field.required),
          payloads: [],
        };

        for (const payload of payloads) {
          const beforeSeq = state.qaEventSeq;
          let thrownError = null;

          try {
            await applyQaFieldValue(field, payload.value);
          } catch (error) {
            thrownError = error;
            recordQaEvent({
              severity: "error",
              kind: "audit-exception",
              message: `Falha ao testar ${fieldLabel}.`,
              context: `${payload.label}: ${serializeQaReason(error)}`,
            }, { cooldownMs: 0 });
          }

          const snapshot = buildQaFieldSnapshot(field);
          const newEvents = state.qaEvents
            .filter((event) => event.sequence > beforeSeq)
            .sort((a, b) => a.sequence - b.sequence);

          fieldReport.payloads.push({
            label: payload.label,
            valid: snapshot.valid,
            validationMessage: snapshot.validationMessage,
            valueLength: snapshot.valueLength,
            newErrors: newEvents.filter((event) => event.severity === "error").length,
            newWarnings: newEvents.filter((event) => event.severity === "warning").length,
          });

          if (thrownError) {
            issues.push({
              severity: "error",
              type: "audit-exception",
              message: `Falha ao aplicar o payload ${payload.label} em ${fieldLabel}.`,
              context: serializeQaReason(thrownError),
            });
          }

          for (const event of newEvents) {
            issues.push({
              severity: event.severity,
              type: event.kind,
              message: event.message,
              context: `${fieldLabel} · ${payload.label}${event.context ? ` · ${event.context}` : ""}`,
            });
          }
        }

        try {
          await applyQaFieldValue(field, originalValue);
        } catch (_) {
          // Ignore restore failures to keep the audit progressing.
        }

        inputReports.push(fieldReport);
      }

      const summary = getQaEventSummary(state.qaEvents);
      const auditEvents = state.qaEvents.filter((event) => event.sequence > auditStartSeq);
      const dedupedIssues = dedupeQaIssues(issues).slice(0, 12);
      const payloadsRun = inputReports.reduce((total, field) => total + field.payloads.length, 0);
      const report = {
        generatedAt: new Date(startedAt).toISOString(),
        title: document.title,
        path: `${window.location.pathname}${window.location.search}`,
        summary: {
          formsFound,
          inputsFound: inputs.length,
          inputsTested: inputReports.length,
          payloadsRun,
          jsErrors: summary.errors,
          warnings: summary.warnings,
          promiseRejections: summary.promiseRejections,
          resourceErrors: summary.resourceErrors,
          newAuditEvents: auditEvents.length,
          issuesFound: dedupedIssues.length,
        },
        issues: dedupedIssues,
        inputs: inputReports,
        recentEvents: state.qaEvents.slice(0, 8),
      };

      state.qaReport = report;

      return {
        success: true,
        report,
      };
    } catch (error) {
      recordQaEvent({
        severity: "error",
        kind: "audit-failure",
        message: "A auditoria QA falhou antes de terminar.",
        context: serializeQaReason(error),
      }, { cooldownMs: 0 });

      return {
        success: false,
        error: serializeQaReason(error),
      };
    } finally {
      state.qaAuditRunning = false;
    }
  }

  function getEnergy() {
    const candidates = queryAll("div, span, p, strong")
      .filter(isElementVisible)
      .map((element) => {
        const text = normalizeText(element.textContent);
        const match = text.match(/^(\d+)\s*\/\s*(\d+)$/);
        if (!match) return null;

        const current = Number(match[1]);
        const max = Number(match[2]);
        if (
          !Number.isFinite(current) ||
          !Number.isFinite(max) ||
          current < 0 ||
          max <= 0 ||
          current > max
        ) {
          return null;
        }

        const rect = element.getBoundingClientRect();
        const contextText = normalizeText(
          [
            element.textContent,
            element.parentElement?.textContent,
            element.closest("section, article, div")?.textContent,
          ]
            .filter(Boolean)
            .join(" ")
        );

        let score = 0;

        if (contextText.includes("energia")) score += 220;
        if (contextText.includes("energy")) score += 180;
        if (contextText.includes("xp")) score -= 260;
        if (contextText.includes("favor")) score -= 220;
        if (contextText.includes("favore")) score -= 220;
        if (contextText.includes("dependencia")) score -= 260;
        if (contextText.includes("respeito")) score -= 220;
        if (rect.left < window.innerWidth * 0.3) score += 35;
        if (rect.top > window.innerHeight * 0.35 && rect.top < window.innerHeight * 0.85) score += 55;
        if (rect.top < 130) score -= 30;
        if (current <= 10 && max <= 10) score += 20;

        return { current, max, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (!candidates.length) return null;

    return {
      current: candidates[0].current,
      max: candidates[0].max,
    };
  }

  function parseCompactInteger(value) {
    const raw = String(value ?? "").trim().toLowerCase();
    const match = raw.match(/([\d.,]+)\s*([kmb])?/i);
    if (!match) return null;

    const numericPart = match[1];
    const suffix = (match[2] || "").toLowerCase();

    if (suffix) {
      let normalized = numericPart.replace(/,/g, ".");
      const parts = normalized.split(".");
      if (parts.length > 2) {
        normalized = `${parts.slice(0, -1).join("")}.${parts[parts.length - 1]}`;
      }
      const base = Number(normalized);
      if (!Number.isFinite(base)) return null;

      const multiplierMap = {
        k: 1000,
        m: 1000000,
        b: 1000000000,
      };

      return Math.round(base * multiplierMap[suffix]);
    }

    const digits = numericPart.replace(/\D+/g, "");
    return digits ? Number(digits) : null;
  }

  function extractSingleMoneyAmount(text) {
    const raw = String(text ?? "");

    if (
      /\$\s*[\d.,]+\s*[-–]\s*\$\s*[\d.,]+/.test(raw) ||
      /ganhos totais/i.test(raw)
    ) {
      return null;
    }

    const matches = raw.match(/\$\s*[\d.,]+/g);
    if (!matches || matches.length !== 1) return null;

    return parseCompactInteger(matches[0]);
  }

  function extractSingleMoneyAmount(text) {
    const raw = String(text ?? "");

    if (
      /\$\s*[\d.,]+(?:\s*[kmb])?\s*[-–]\s*\$\s*[\d.,]+(?:\s*[kmb])?/i.test(raw) ||
      /ganhos totais/i.test(raw)
    ) {
      return null;
    }

    const matches = raw.match(/\$\s*[\d.,]+(?:\s*[kmb])?/gi);
    if (!matches || matches.length !== 1) return null;

    return parseCompactInteger(matches[0]);
  }

  function getCurrentMoney() {
    const candidates = queryAll("div, span, p, strong")
      .filter(isElementVisible)
      .map((element) => {
        const amount = extractSingleMoneyAmount(element.textContent);
        if (!Number.isFinite(amount)) return null;

        const rect = element.getBoundingClientRect();
        const contextText = normalizeText(
          [
            element.textContent,
            element.parentElement?.textContent,
            element.closest("section, article, div")?.textContent,
          ]
            .filter(Boolean)
            .join(" ")
        );

        let score = 0;

        if (contextText.includes("dinheiro")) score += 140;
        if (rect.left < window.innerWidth * 0.3) score += 30;
        if (rect.top < window.innerHeight * 0.85) score += 10;
        if (rect.left > window.innerWidth * 0.35 && rect.left < window.innerWidth * 0.7) score -= 40;
        if (rect.width < 220) score += 8;

        return { amount, score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.amount ?? null;
  }

  function getActionEnergyCost() {
    const matches = getCenterPanelElements()
      .map((element) => {
        const text = getElementActionText(element);
        const match = text.match(/^(\d+)\s*energia$/);
        if (!match) return null;

        const rect = element.getBoundingClientRect();
        const score = 100 - Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2) / 10;
        return { cost: Number(match[1]), score };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return matches[0]?.cost ?? null;
  }

  function findUseAllEnergyButton() {
    const modal = getCrimeModal();
    if (!modal) return null;

    const candidates = queryAll("button[data-slot='button'], button", modal)
      .filter(isElementVisible)
      .filter((element) => !isElementDisabled(element))
      .map((element) => {
        const text = getElementActionText(element);
        if (!text || !text.startsWith("usar toda a energia")) return null;

        const multiplierMatch = text.match(/\((\d+)\s*x\)|\b(\d+)\s*x\b/);
        const multiplier = Number(multiplierMatch?.[1] || multiplierMatch?.[2] || 1) || 1;
        const rect = element.getBoundingClientRect();
        const modalRect = modal.getBoundingClientRect();

        let score = multiplier * 100;
        if (element.getAttribute("data-slot") === "button") score += 25;
        if (rect.width > modalRect.width * 0.45) score += 15;
        if (rect.bottom > modalRect.top + modalRect.height * 0.7) score += 20;
        if (text === "usar toda a energia (10x)") score += 40;
        if (rect.left < modalRect.left + 24) score += 8;
        if (rect.right > modalRect.right - 24) score += 8;
        if (isElementTopmost(element)) score += 60;
        else score -= 120;

        return {
          source: element,
          target: resolveActionableTarget(element),
          multiplier,
          text,
          score,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return candidates[0] || null;
  }

  function findExecuteCrimeButton() {
    const modal = getCrimeModal();
    if (!modal) return null;

    const candidates = queryAll("button[data-slot='button'], button", modal)
      .filter(isElementVisible)
      .filter((element) => !isElementDisabled(element))
      .map((element) => {
        const text = getElementActionText(element);
        if (!text || !text.startsWith("executar crime")) return null;

        const rect = element.getBoundingClientRect();
        const modalRect = modal.getBoundingClientRect();

        let score = 100;
        if (element.getAttribute("data-slot") === "button") score += 20;
        if (rect.width > modalRect.width * 0.3) score += 12;
        if (rect.bottom > modalRect.top + modalRect.height * 0.62) score += 18;
        if (rect.left > modalRect.left + modalRect.width * 0.45) score += 10;
        if (isElementTopmost(element)) score += 60;
        else score -= 120;

        return {
          source: element,
          target: resolveActionableTarget(element),
          multiplier: 1,
          text,
          score,
          kind: "single",
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return candidates[0] || null;
  }

  function getUseAllEnergyAction() {
    const exactButton = findUseAllEnergyButton();
    if (exactButton) {
      return {
        ...exactButton,
        kind: "batch",
      };
    }

    const modal = getCrimeModal();
    const root = modal || document;

    const candidates = queryAll("button, a, [role='button'], div, span", root)
      .filter(isElementVisible)
      .map((element) => {
        const text = getElementActionText(element);
        if (!text || !text.includes("usar toda a energia")) return null;

        const target = resolveActionableTarget(element);
        if (!target) return null;

        const multiplierMatch = text.match(/\((\d+)\s*x\)|\b(\d+)\s*x\b/);
        const multiplier = Number(multiplierMatch?.[1] || multiplierMatch?.[2] || 1) || 1;
        const rect = target.getBoundingClientRect();
        const score = multiplier * 100 + (rect.width > 160 ? 10 : 0);

        return {
          target,
          multiplier,
          text,
          score,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (candidates[0]) {
      return {
        ...candidates[0],
        kind: "batch",
      };
    }

    return findExecuteCrimeButton();
  }

  async function waitForUseAllEnergyAction() {
    return waitForCondition(() => getUseAllEnergyAction());
  }

  function calculateCompletedAttempts(result) {
    if (!result.confirmed) return 0;

    return 1;
  }

  async function waitForActionCompletion(beforeState) {
    const timeoutMs = Math.max(
      CONFIG.actionCompletionTimeoutMs,
      (Number(beforeState?.actionMeta?.multiplier || 1) * 1200) + 4000
    );
    const startedAt = performance.now();
    const baseMoney = Number.isFinite(beforeState.money) ? beforeState.money : null;
    let bestMoney = baseMoney;
    let lastSnapshot = "";
    let stableFrames = 0;

    while (performance.now() - startedAt < timeoutMs) {
      const currentEnergy = getEnergy();
      const currentMoney = getCurrentMoney();

      if (Number.isFinite(currentMoney)) {
        bestMoney = Number.isFinite(bestMoney)
          ? Math.max(bestMoney, currentMoney)
          : currentMoney;
      }

      const energySpent = beforeState.energy && currentEnergy
        ? Math.max(0, beforeState.energy.current - currentEnergy.current)
        : 0;

      const energyStateChanged = Boolean(
        beforeState.energy &&
        currentEnergy &&
        (
          currentEnergy.current < beforeState.energy.current ||
          (
            currentEnergy.max <= beforeState.energy.max &&
            currentEnergy.current < currentEnergy.max
          )
        )
      );

      const moneyDelta = Number.isFinite(baseMoney) && Number.isFinite(bestMoney)
        ? Math.max(0, bestMoney - baseMoney)
        : 0;

      if (energyStateChanged || moneyDelta > 0) {
        const snapshot = [
          currentEnergy?.current ?? "x",
          currentEnergy?.max ?? "x",
          energySpent,
          moneyDelta,
        ].join(":");

        if (snapshot === lastSnapshot) {
          stableFrames += 1;
        } else {
          lastSnapshot = snapshot;
          stableFrames = 1;
        }

        if (stableFrames >= 2) {
          return {
            confirmed: true,
            energySpent,
            moneyDelta,
          };
        }
      } else {
        lastSnapshot = "";
        stableFrames = 0;
      }

      await nextFrame();
    }

    return {
      confirmed: false,
      energySpent: 0,
      moneyDelta: 0,
    };
  }

  function scoreMatch(text, targets) {
    let best = 0;

    for (const rawTarget of targets) {
      const target = normalizeText(rawTarget);
      if (!target) continue;

      if (text === target) best = Math.max(best, 120);
      else if (text.startsWith(target) || text.endsWith(target)) best = Math.max(best, 90);
      else if (text.includes(target)) best = Math.max(best, 70);
    }

    return best;
  }

  function getBottomDockItems() {
    const candidates = queryAll("button, a, [role='button'], div, span")
      .filter(isElementVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.top > window.innerHeight * 0.72 &&
          rect.bottom < window.innerHeight - 2 &&
          rect.left > window.innerWidth * 0.08 &&
          rect.right < window.innerWidth * 0.92 &&
          rect.width >= 24 &&
          rect.height >= 18
        );
      });

    const unique = [];
    const seen = new Set();

    for (const element of candidates) {
      const resolved = resolveActionableTarget(element);
      if (!resolved) continue;

      const rect = resolved.getBoundingClientRect();
      const key = [
        Math.round(rect.left),
        Math.round(rect.top),
        Math.round(rect.width),
        Math.round(rect.height),
      ].join(":");

      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(resolved);
    }

    return unique.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  }

  function getCenterPanelElements() {
    return queryAll("button, a, [role='button'], div, span")
      .filter(isElementVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.left > window.innerWidth * 0.14 &&
          rect.right < window.innerWidth * 0.86 &&
          rect.top > 56 &&
          rect.bottom < window.innerHeight * 0.82
        );
      });
  }

  function getCrimeModal() {
    const candidates = queryAll("div, section, article")
      .filter(isElementVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (
          rect.width < 300 ||
          rect.height < 220 ||
          rect.left > window.innerWidth * 0.82 ||
          rect.right < window.innerWidth * 0.18 ||
          rect.top > window.innerHeight * 0.76 ||
          rect.bottom < window.innerHeight * 0.2
        ) {
          return false;
        }

        const text = normalizeText(element.textContent);
        return (
          text.includes("hipotese de sucesso") ||
          text.includes("usar toda a energia") ||
          (text.includes("executar crime") && text.includes("cancelar"))
        );
      })
      .sort((a, b) => {
        const rectA = a.getBoundingClientRect();
        const rectB = b.getBoundingClientRect();
        return rectB.width * rectB.height - rectA.width * rectA.height;
      });

    return candidates[0] || null;
  }

  function getCrimePinButtons() {
    return queryAll("[data-pin-type='crime']")
      .filter(isElementVisible)
      .map((element) => resolveActionableTarget(element))
      .filter(Boolean);
  }

  function getCrimePinState(element) {
    if (!(element instanceof Element)) return null;

    const rawText = normalizeText(element.innerText || element.textContent || "");
    if (!rawText) return null;

    const percentMatches = [...rawText.matchAll(/(\d{1,3})\s*%/g)].map((match) => Number(match[1]));
    const successPercent = percentMatches.length ? Math.max(...percentMatches) : null;
    const crimeId = element.getAttribute("data-crime-id") || "";
    const rect = element.getBoundingClientRect();

    return {
      element,
      key: `${crimeId}:${rawText.slice(0, 180)}`,
      crimeId,
      rawText,
      successPercent,
      score: (successPercent || 0) * 100 - Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2) / 10,
    };
  }

  function extractMoneyRange(text) {
    const raw = String(text ?? "");
    const rangeMatch = raw.match(/\$\s*[\d.,]+(?:\s*[kmb])?\s*[-–]\s*\$\s*[\d.,]+(?:\s*[kmb])?/i);

    if (rangeMatch) {
      const values = rangeMatch[0]
        .split(/[-–]/)
        .map((entry) => parseCompactInteger(entry))
        .filter((value) => Number.isFinite(value));

      if (values.length >= 2) {
        return {
          min: Math.min(...values),
          max: Math.max(...values),
        };
      }
    }

    const values = (raw.match(/\$\s*[\d.,]+(?:\s*[kmb])?/gi) || [])
      .map((entry) => parseCompactInteger(entry))
      .filter((value) => Number.isFinite(value));

    if (!values.length) return null;

    return {
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }

  function pinMatchesCrimeDefinition(pinState, definition) {
    if (!pinState || !definition) return false;

    const combinedText = [
      pinState.rawText,
      pinState.crimeId ? pinState.crimeId.replace(/-/g, " ") : "",
    ]
      .filter(Boolean)
      .join(" ");

    return matchesCrimeDefinition(combinedText, definition);
  }

  function getPreferredCrimePin(definition) {
    const candidates = getCrimePinButtons()
      .map((element) => getCrimePinState(element))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (!definition) {
      return candidates[0] || null;
    }

    return candidates.find((entry) => pinMatchesCrimeDefinition(entry, definition)) || candidates[0] || null;
  }

  function getRankedCrimePins(definition = null) {
    const candidates = getCrimePinButtons()
      .map((element) => getCrimePinState(element))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    if (!definition) {
      return candidates;
    }

    return [
      ...candidates.filter((entry) => pinMatchesCrimeDefinition(entry, definition)),
      ...candidates.filter((entry) => !pinMatchesCrimeDefinition(entry, definition)),
    ];
  }

  async function openCrimeModalFromPins(pinCandidates) {
    for (const pin of pinCandidates) {
      if (!pin?.element) continue;

      const clicked =
        dispatchRealClick(pin.element) ||
        activateElement(pin.element) ||
        dispatchKeyboardActivation(pin.element);

      if (!clicked) {
        continue;
      }

      const modalState = await waitForCondition(() => getCrimeModalState());
      if (modalState) {
        return modalState;
      }
    }

    return null;
  }

  function isCrimeSelectionOpen() {
    return getCrimePinButtons().length > 0;
  }

  function getCrimeModalState(modal = getCrimeModal()) {
    if (!modal) return null;

    const sourceText = String(modal.innerText || modal.textContent || "");
    const rawText = normalizeText(modal.innerText || modal.textContent || "");
    if (!rawText) return null;

    const rawTextSuccessMatches = [
      ...rawText.matchAll(/(\d{1,3})\s*%\s*sucesso/g),
      ...rawText.matchAll(/hipotese de sucesso[^0-9]{0,30}(\d{1,3})\s*%/g),
    ]
      .map((match) => Number(match[1]))
      .filter((value) => Number.isFinite(value));

    const successCandidates = queryAll("div, span, p, strong", modal)
      .filter(isElementVisible)
      .map((element) => {
        const text = normalizeText(element.textContent);
        if (!text || text.includes("modificador")) return null;

        const match = text.match(/(\d{1,3})\s*%\s*(?:sucesso|hipotese de sucesso)/);
        if (!match) return null;

        const rect = element.getBoundingClientRect();
        const modalRect = modal.getBoundingClientRect();
        let score = 0;

        if (rect.top > modalRect.top + modalRect.height * 0.35) score += 20;
        if (rect.left > modalRect.left + modalRect.width * 0.45) score += 25;
        if (rect.width < 220) score += 8;

        return {
          value: Number(match[1]),
          score,
        };
      })
      .filter(Boolean);

    if (rawTextSuccessMatches.length > 0) {
      successCandidates.push({
        value: Math.max(...rawTextSuccessMatches),
        score: 16,
      });
    }

    successCandidates.sort((a, b) => b.score - a.score);

    return {
      modal,
      successPercent: successCandidates[0]?.value ?? null,
      rewardRange: extractMoneyRange(sourceText),
      key: rawText.slice(0, 260),
      rawText,
    };
  }

  function getCrimeCarouselButtons(modal = getCrimeModal()) {
    if (!modal) return { previous: null, next: null };

    const modalRect = modal.getBoundingClientRect();
    const buttons = queryAll("button, [role='button']")
      .filter(isElementVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        const withinMiddleBand =
          centerY > modalRect.top + modalRect.height * 0.3 &&
          centerY < modalRect.top + modalRect.height * 0.78;

        return (
          rect.width >= 28 &&
          rect.width <= 96 &&
          rect.height >= 28 &&
          rect.height <= 96 &&
          withinMiddleBand &&
          (
            rect.right < modalRect.left + 30 ||
            rect.left > modalRect.right - 30 ||
            rect.left < modalRect.left + 40 ||
            rect.right > modalRect.right - 40
          )
        );
      })
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

    return {
      previous: buttons[0] ? resolveActionableTarget(buttons[0]) : null,
      next: buttons.length > 1 ? resolveActionableTarget(buttons[buttons.length - 1]) : null,
    };
  }

  async function waitForCrimeModalChange(previousKey) {
    return (
      await waitForCondition(() => {
        const stateNow = getCrimeModalState();
        return stateNow && stateNow.key !== previousKey ? stateNow : null;
      })
    ) || getCrimeModalState();
  }

  async function waitForCrimeSelectionOrModal() {
    return waitForCondition(() => {
      if (getCrimeModal()) return "modal";
      if (isCrimeSelectionOpen()) return "selection";
      return null;
    });
  }

  function modalMatchesCrimeDefinition(modalState, definition) {
    return matchesCrimeDefinition(modalState?.rawText || "", definition);
  }

  function findBestTextMatch(elements, texts) {
    const ranked = [];

    for (const element of elements) {
      const text = getElementActionText(element);
      if (!text) continue;

      const matchScore = scoreMatch(text, texts);
      if (matchScore <= 0) continue;

      const rect = element.getBoundingClientRect();
      const area = rect.width * rect.height;
      const clickBonus = isClickableLike(element) ? 30 : 0;
      const compactBonus = area < 70000 ? 12 : -18;
      const score = matchScore + clickBonus + compactBonus - Math.min(text.length, 180) / 12;

      ranked.push({ element, score });
    }

    ranked.sort((a, b) => b.score - a.score);
    return ranked[0]?.element || null;
  }

  function findBottomDockItemByTexts(texts) {
    const bottomElements = queryAll("*")
      .filter(isElementVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.top > window.innerHeight * 0.72 &&
          rect.bottom < window.innerHeight - 2 &&
          rect.left > window.innerWidth * 0.08 &&
          rect.right < window.innerWidth * 0.92
        );
      });

    const directMatch = findBestTextMatch(bottomElements, texts);
    if (directMatch) return resolveActionableTarget(directMatch);

    const items = getBottomDockItems();
    return findBestTextMatch(items, texts);
  }

  function findBottomDockItemByExactLabel(label) {
    const normalizedLabel = normalizeText(label);

    const exactMatch = queryAll("div, span, p, strong, button, a")
      .filter(isElementVisible)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.top > window.innerHeight * 0.78 &&
          rect.bottom < window.innerHeight - 2 &&
          rect.left > window.innerWidth * 0.18 &&
          rect.right < window.innerWidth * 0.82 &&
          getElementActionText(element) === normalizedLabel
        );
      })
      .map((element) => resolveActionableTarget(element))
      .filter(Boolean)
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

    return exactMatch[0] || null;
  }

  function findCrimeDockButton() {
    const candidates = queryAll("button[aria-label], [role='button'][aria-label]")
      .filter(isElementVisible)
      .filter((element) => normalizeText(element.getAttribute("aria-label")) === "crimes")
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.top > window.innerHeight * 0.72 &&
          rect.bottom < window.innerHeight - 2 &&
          rect.left > window.innerWidth * 0.08 &&
          rect.right < window.innerWidth * 0.92
        );
      })
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

    return candidates[0] ? resolveActionableTarget(candidates[0]) : null;
  }

  function findClubDockButton() {
    const candidates = queryAll("button[aria-label], [role='button'][aria-label]")
      .filter(isElementVisible)
      .filter((element) => normalizeText(element.getAttribute("aria-label")) === "clubes")
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.top > window.innerHeight * 0.72 &&
          rect.bottom < window.innerHeight - 2 &&
          rect.left > window.innerWidth * 0.08 &&
          rect.right < window.innerWidth * 0.92
        );
      })
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

    return candidates[0] ? resolveActionableTarget(candidates[0]) : null;
  }

  function findCenterElementByTexts(texts) {
    const matched = findBestTextMatch(getCenterPanelElements(), texts);
    return matched ? resolveActionableTarget(matched) : null;
  }

  function isCrimePanelOpen() {
    return Boolean(getCrimeModal());
  }

  async function openCrimePanel() {
    if (getCrimeModal() || isCrimeSelectionOpen()) return true;

    const ariaMatch = findCrimeDockButton();
    const exactMatch = findBottomDockItemByExactLabel("Crimes");
    const directMatch = ariaMatch || exactMatch || findBottomDockItemByTexts(CONFIG.dockCrimeTexts);
    const dockItems = getBottomDockItems();
    const fallback = dockItems[0] || null;
    const target = directMatch || fallback;

    if (!target) return false;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const classSnapshot = target.className;
      const pressedSnapshot = target.getAttribute("aria-pressed");
      const clicked =
        dispatchRealClick(target) ||
        activateElement(target) ||
        dispatchKeyboardActivation(target);

      if (!clicked) return false;

      const opened = await waitForCondition(() => {
        if (getCrimeModal()) return "modal";
        if (isCrimeSelectionOpen()) return "selection";
        if (
          target.className !== classSnapshot ||
          target.getAttribute("aria-pressed") !== pressedSnapshot
        ) {
          return "dock-state";
        }
        return null;
      });

      if (opened) {
        if (opened === "dock-state") {
          const selectionState = await waitForCrimeSelectionOrModal();
          return Boolean(selectionState);
        }

        return true;
      }

      await nextFrame();
    }

    return false;
  }

  function getSarjetaModal() {
    const candidates = queryAll("div, section, article")
      .filter(isElementVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        if (
          rect.width < 520 ||
          rect.height < 360 ||
          rect.left > window.innerWidth * 0.78 ||
          rect.right < window.innerWidth * 0.22 ||
          rect.top > window.innerHeight * 0.72 ||
          rect.bottom < window.innerHeight * 0.22
        ) {
          return null;
        }

        const text = normalizeText(element.innerText || element.textContent || "");
        if (!text) return null;

        let score = 0;
        score += scoreMatch(text, CONFIG.sarjetaAliases) * 2;
        score += scoreMatch(text, CONFIG.jorgeAliases);
        score += scoreMatch(text, CONFIG.jorgeActionTexts);
        if (text.includes("servicos")) score += 60;
        if (text.includes("drogas")) score += 35;
        if (text.includes("visitantes")) score += 35;
        if (text.includes("energia")) score += 18;
        if (rect.left > window.innerWidth * 0.12 && rect.right < window.innerWidth * 0.88) score += 16;
        if (score < 260) return null;

        return {
          element,
          score: score + Math.min((rect.width * rect.height) / 25000, 60),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return candidates[0]?.element || null;
  }

  function isClubPanelOpen() {
    return Boolean(getSarjetaModal() || getNightclubPins().length > 0 || findCenterElementByTexts(CONFIG.panelClubTexts));
  }

  function getNightclubPins() {
    return queryAll("[data-pin-type='nightclub']")
      .filter(isElementVisible)
      .map((element) => resolveActionableTarget(element))
      .filter(Boolean);
  }

  function getNightclubPinState(element) {
    if (!(element instanceof Element)) return null;

    const rawText = normalizeText(element.innerText || element.textContent || "");
    const classes = normalizeText(element.className || "");
    const rect = element.getBoundingClientRect();

    let score = 0;
    score += scoreMatch(rawText, CONFIG.sarjetaAliases) * 2;
    if (element.getAttribute("data-pin-type") === "nightclub") score += 90;
    if (classes.includes("ring-yellow-400")) score += 120;
    if (classes.includes("shadow-[0_0_0_4px")) score += 80;
    if (isElementTopmost(element)) score += 40;
    score -= Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2) / 12;

    return {
      element,
      rawText,
      score,
    };
  }

  async function openClubPanel() {
    if (isClubPanelOpen()) return true;

    const target =
      findClubDockButton() ||
      findBottomDockItemByExactLabel("Clubes") ||
      findBottomDockItemByTexts(CONFIG.dockClubTexts);

    if (!target) return false;

    const classSnapshot = target.className;
    const pressedSnapshot = target.getAttribute("aria-pressed");
    const clicked =
      dispatchRealClick(target) ||
      activateElement(target) ||
      dispatchKeyboardActivation(target);

    if (!clicked) return false;

    const opened = await waitForCondition(() => {
      if (getNightclubPins().length > 0) return "nightclubs";
      if (isClubPanelOpen()) return "panel";
      if (
        target.className !== classSnapshot ||
        target.getAttribute("aria-pressed") !== pressedSnapshot
      ) {
        return null;
      }
      return null;
    });

    return Boolean(opened);
  }

  function findSarjetaPin() {
    const elements = getNightclubPins()
      .map((element) => getNightclubPinState(element))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return elements[0]?.element || null;
  }

  async function openSarjetaModal() {
    if (getSarjetaModal()) return true;

    const target = findSarjetaPin();
    if (!target) return false;

    const clicked =
      dispatchRealClick(target) ||
      activateElement(target) ||
      dispatchKeyboardActivation(target);

    if (!clicked) return false;

    const opened = await waitForCondition(() => getSarjetaModal());
    return Boolean(opened);
  }

  function findJorgeContractButton(modal = getSarjetaModal()) {
    if (!modal) return null;

    const directTextMatch = queryAll("div, span, p, strong, h1, h2, h3, h4", modal)
      .filter(isElementVisible)
      .map((element) => {
        const text = normalizeText(element.textContent || "");
        if (!text) return null;

        const aliasScore = scoreMatch(text, CONFIG.jorgeAliases);
        if (aliasScore <= 0) return null;

        return {
          element,
          score: aliasScore - Math.min(text.length, 120) / 12,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score)[0]?.element || null;

    if (directTextMatch) {
      const ancestry = [];
      let current = directTextMatch;

      while (current && current !== modal) {
        ancestry.push(current);
        current = current.parentElement;
      }

      if (modal) ancestry.push(modal);

      for (const container of ancestry) {
        const action = findActionableInRootByTexts(container, CONFIG.jorgeActionTexts);
        if (action) {
          return action;
        }
      }
    }

    const buttons = queryAll("button[data-slot='button'], button", modal)
      .filter(isElementVisible)
      .filter((element) => !isElementDisabled(element))
      .map((button) => {
        const buttonText = getElementActionText(button);
        if (!buttonText.startsWith("contratar")) return null;

        let bestContextScore = 0;
        let current = button.parentElement;

        while (current && current !== modal) {
          const text = normalizeText(current.innerText || current.textContent || "");
          if (text) {
            let contextScore = 0;
            contextScore += scoreMatch(text, CONFIG.jorgeAliases) * 3;
            contextScore += scoreMatch(text, CONFIG.jorgeActionTexts);
            if (text.includes("servicos")) contextScore += 18;
            if (text.includes("10 energia")) contextScore += 16;
            if (text.includes("hazel")) contextScore -= 140;
            if (text.includes("pearl")) contextScore -= 140;

            bestContextScore = Math.max(bestContextScore, contextScore);
          }

          current = current.parentElement;
        }

        if (bestContextScore <= 0) return null;

        let score = bestContextScore;
        if (buttonText === "contratar (ok)") score += 60;
        if (button.getAttribute("data-slot") === "button") score += 25;
        if (isElementTopmost(button)) score += 40;

        return {
          button,
          score,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.score - a.score);

    return buttons[0]?.button || null;
  }

  async function waitForEnergyRecovery(beforeEnergy) {
    const timeoutMs = 8000;
    const startedAt = performance.now();
    let lastSnapshot = "";
    let stableFrames = 0;

    while (performance.now() - startedAt < timeoutMs) {
      const currentEnergy = getEnergy();
      const energyGain =
        beforeEnergy && currentEnergy
          ? Math.max(0, currentEnergy.current - beforeEnergy.current)
          : 0;

      if (energyGain > 0) {
        const snapshot = `${currentEnergy.current}:${currentEnergy.max}:${energyGain}`;

        if (snapshot === lastSnapshot) {
          stableFrames += 1;
        } else {
          lastSnapshot = snapshot;
          stableFrames = 1;
        }

        if (stableFrames >= 2) {
          return {
            confirmed: true,
            energyGain,
          };
        }
      } else {
        lastSnapshot = "";
        stableFrames = 0;
      }

      await nextFrame();
    }

    return {
      confirmed: false,
      energyGain: 0,
    };
  }

  async function selectConfiguredCrime(preferredCrime = getPreferredCrimeDefinition()) {
    if (!preferredCrime) {
      return false;
    }

    let modalState = getCrimeModalState();
    if (!modalState) {
      const preferredPin = getPreferredCrimePin(preferredCrime);
      let clicked =
        preferredPin &&
        (
          dispatchRealClick(preferredPin.element) ||
          activateElement(preferredPin.element) ||
          dispatchKeyboardActivation(preferredPin.element)
        );

      if (!clicked) {
        clicked = await requestMainWorldCrimeClick({
          mode: "specific",
          aliases: preferredCrime.aliases,
        });
      }

      if (!clicked) return false;

      modalState = await waitForCondition(() => getCrimeModalState());

      if (!modalState) {
        return false;
      }
    }

    if (modalMatchesCrimeDefinition(modalState, preferredCrime)) {
      return true;
    }

    const seen = new Set([modalState.key]);

    for (let step = 0; step < CONFIG.carouselSearchLimit; step += 1) {
      const carousel = getCrimeCarouselButtons(modalState.modal || getCrimeModal());
      const advanceButton = carousel.next || carousel.previous;
      if (!advanceButton) {
        return false;
      }

      if (
        !dispatchRealClick(advanceButton) &&
        !activateElement(advanceButton) &&
        !dispatchKeyboardActivation(advanceButton)
      ) {
        return false;
      }

      modalState = await waitForCrimeModalChange(modalState.key);
      if (!modalState) {
        return false;
      }

      if (modalMatchesCrimeDefinition(modalState, preferredCrime)) {
        return true;
      }

      if (seen.has(modalState.key)) {
        break;
      }

      seen.add(modalState.key);
    }

    return false;
  }

  async function clickUseAllEnergy(actionMeta) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const latestAction = getUseAllEnergyAction();
      const resolvedAction = latestAction || actionMeta || null;

      if (await requestMainWorldUseAllEnergyClick()) {
        return resolvedAction || {
          target: null,
          text: "usar toda a energia",
          multiplier: Number(latestAction?.multiplier || actionMeta?.multiplier || 1) || 1,
          kind: latestAction?.kind || actionMeta?.kind || "batch",
        };
      }

      const clickTargets = [
        resolvedAction?.source,
        resolvedAction?.target,
      ]
        .filter(Boolean)
        .map((element) => resolveActionableTarget(element))
        .filter(Boolean)
        .filter((element, index, list) => list.indexOf(element) === index);

      if (clickTargets.length === 0) {
        await nextFrame();
        continue;
      }

      for (const target of clickTargets) {
        if (
          dispatchRealClick(target) ||
          activateElement(target) ||
          dispatchKeyboardActivation(target)
        ) {
          return {
            ...resolvedAction,
            target,
          };
        }
      }
    }

    return null;
  }

  async function runEnergyRoutine(energy) {
    if (!shouldRecoverEnergy(energy)) {
      return false;
    }

    if (!(await openClubPanel())) {
      logMessage(
        "Nao encontrei a aba Clubes na tela.",
        "warning",
        "energy-clubs-missing",
        CONFIG.warningCooldownMs
      );
      return false;
    }

    if (!(await openSarjetaModal())) {
      logMessage(
        "Nao consegui abrir A Sarjeta.",
        "warning",
        "energy-sarjeta-missing",
        CONFIG.warningCooldownMs
      );
      return false;
    }

    const contractButton = findJorgeContractButton();
    if (!contractButton) {
      logMessage(
        "Nao encontrei o contrato do Jorge.",
        "warning",
        "energy-jorge-missing",
        CONFIG.warningCooldownMs
      );
      return false;
    }

    const beforeEnergy = getEnergy() || energy;
    const clicked =
      await requestMainWorldServiceActionClick({
        modalText: "a sarjeta",
        sectionText: "servicos",
        cardText: "jorge",
        buttonText: "contratar (ok)",
      }) ||
      dispatchRealClick(contractButton) ||
      activateElement(contractButton) ||
      dispatchKeyboardActivation(contractButton);

    if (!clicked) {
      logMessage(
        "Nao consegui clicar em Contratar (OK) do Jorge.",
        "warning",
        "energy-jorge-click-failed",
        CONFIG.warningCooldownMs
      );
      return false;
    }

    const completion = await waitForEnergyRecovery(beforeEnergy);
    if (!completion.confirmed) {
      logMessage(
        "O clique do Auto Energy aconteceu, mas a energia nao subiu.",
        "warning",
        "energy-jorge-not-confirmed",
        CONFIG.warningCooldownMs
      );
      return false;
    }

    logMessage(
      `Auto Energy executado com Jorge (+${completion.energyGain} energia).`,
      "success",
      "energy-jorge-success",
      CONFIG.successCooldownMs
    );
    return true;
  }

  async function runCrimeRoutine(energy) {
    if (!(await openCrimePanel())) {
      logMessage(
        "Nao encontrei o painel de crimes na tela.",
        "warning",
        "crime-panel-missing",
        CONFIG.warningCooldownMs
      );
      return { actionDone: false, reason: "panel-missing", energyCost: null, preferredCrime: null };
    }

    const preferredCrime = getPreferredCrimeDefinition();
    const configuredCrimeFound = await selectConfiguredCrime(preferredCrime);
    if (!configuredCrimeFound) {
      logMessage(
        `Nao encontrei o crime configurado: ${preferredCrime.label}.`,
        "warning",
        "crime-mode-missing",
        CONFIG.warningCooldownMs
      );
      return { actionDone: false, reason: "crime-missing", energyCost: null, preferredCrime };
    }

    let currentEnergySnapshot = getEnergy() || energy || null;
    let currentCrimeEnergyCost = getActionEnergyCost();

    if (!Number.isFinite(currentCrimeEnergyCost) && Number.isFinite(state.lastCrimeEnergyCost)) {
      currentCrimeEnergyCost = state.lastCrimeEnergyCost;
    }

    if (Number.isFinite(currentCrimeEnergyCost) && currentCrimeEnergyCost > 0) {
      state.lastCrimeEnergyCost = currentCrimeEnergyCost;
    }

    if (
      Number.isFinite(currentCrimeEnergyCost) &&
      currentCrimeEnergyCost > 0 &&
      currentEnergySnapshot &&
      !hasMinimumCrimeEnergy(currentEnergySnapshot, currentCrimeEnergyCost)
    ) {
      return {
        actionDone: false,
        reason: "insufficient-energy",
        energyCost: currentCrimeEnergyCost,
        preferredCrime,
      };
    }

    let totalCompletedAttempts = 0;
    let totalMoneyDelta = 0;
    let executedRuns = 0;

    while (true) {
      const useAllEnergyAction = getUseAllEnergyAction() || await waitForUseAllEnergyAction();
      const actionMeta = {
        energyCost: currentCrimeEnergyCost,
        ...(useAllEnergyAction || {}),
      };
      const moneyBefore = getCurrentMoney();

      if (!(await clickUseAllEnergy(actionMeta))) {
        if (executedRuns === 0) {
          logMessage(
            "Nao achei o botao de usar toda a energia ou executar crime.",
            "warning",
            "crime-energy-button-missing",
            CONFIG.warningCooldownMs
          );
          return {
            actionDone: false,
            reason: "action-missing",
            energyCost: currentCrimeEnergyCost,
            preferredCrime,
          };
        }

        break;
      }

      const completion = await waitForActionCompletion({
        energy: currentEnergySnapshot || energy,
        money: moneyBefore,
        actionMeta,
      });

      if (!completion.confirmed) {
        if (executedRuns === 0) {
          logMessage(
            "O clique aconteceu, mas o crime nao foi confirmado como finalizado.",
            "warning",
            "crime-not-confirmed",
            CONFIG.warningCooldownMs
          );
          return {
            actionDone: false,
            reason: "not-confirmed",
            energyCost: currentCrimeEnergyCost,
            preferredCrime,
          };
        }

        break;
      }

      executedRuns += 1;
      totalCompletedAttempts += Math.max(1, calculateCompletedAttempts(completion));
      totalMoneyDelta += Math.max(0, completion.moneyDelta);
      currentEnergySnapshot = getEnergy() || currentEnergySnapshot || energy || null;

      const latestCrimeEnergyCost = getActionEnergyCost();
      if (Number.isFinite(latestCrimeEnergyCost) && latestCrimeEnergyCost > 0) {
        currentCrimeEnergyCost = latestCrimeEnergyCost;
        state.lastCrimeEnergyCost = latestCrimeEnergyCost;
      }

      if (
        Number.isFinite(currentCrimeEnergyCost) &&
        currentCrimeEnergyCost > 0 &&
        (!currentEnergySnapshot || !hasMinimumCrimeEnergy(currentEnergySnapshot, currentCrimeEnergyCost))
      ) {
        break;
      }

      let nextAction = getUseAllEnergyAction();
      if (!nextAction && currentEnergySnapshot && hasMinimumCrimeEnergy(currentEnergySnapshot, currentCrimeEnergyCost)) {
        const reopenedPanel = await openCrimePanel();
        if (reopenedPanel) {
          const reselectedCrime = await selectConfiguredCrime(preferredCrime);
          if (reselectedCrime) {
            const refreshedCrimeEnergyCost = getActionEnergyCost();
            if (Number.isFinite(refreshedCrimeEnergyCost) && refreshedCrimeEnergyCost > 0) {
              currentCrimeEnergyCost = refreshedCrimeEnergyCost;
              state.lastCrimeEnergyCost = refreshedCrimeEnergyCost;
            }

            nextAction = getUseAllEnergyAction();
          }
        }
      }

      if (!nextAction) {
        break;
      }
    }

    if (totalCompletedAttempts > 0 || totalMoneyDelta > 0) {
      const nextStats = {};

      if (totalCompletedAttempts > 0) {
        nextStats.crimesExecuted = (state.stats.crimesExecuted || 0) + totalCompletedAttempts;
      }

      if (totalMoneyDelta > 0) {
        nextStats.totalEarned = (state.stats.totalEarned || 0) + totalMoneyDelta;
      }

      if (Object.keys(nextStats).length > 0) {
        updateStats(nextStats);
      }
    }

    const attemptsText = totalCompletedAttempts > 1 ? ` (${totalCompletedAttempts}x)` : "";
    const gainText = totalMoneyDelta > 0 ? ` e ganhou $${totalMoneyDelta.toLocaleString("pt-BR")}` : "";
    logMessage(
      `Lote de crime finalizado${attemptsText}${gainText}.`,
      "success",
      "crime-success",
      CONFIG.successCooldownMs
    );
    return {
      actionDone: executedRuns > 0,
      reason: executedRuns > 0 ? "completed" : "idle",
      energyCost: currentCrimeEnergyCost,
      preferredCrime,
    };
  }

  async function botStep(trigger = "alarm") {
    if (!state.enabled || state.running) return false;

    state.running = true;

    try {
      if (!state.config.autoCrime && !state.config.autoEnergy) {
        return false;
      }

      const energy = getEnergy();
      if (!energy) {
        logMessage(
          "Nao consegui localizar o contador de energia.",
          "warning",
          "energy-missing",
          CONFIG.warningCooldownMs
        );
        return false;
      }

      state.lastKnownEnergy = energy.current;
      let crimeResult = {
        actionDone: false,
        reason: "crime-disabled",
        energyCost: getKnownCrimeEnergyRequirement(energy),
        preferredCrime: getPreferredCrimeDefinition(),
      };

      if (state.config.autoCrime) {
        crimeResult = await runCrimeRoutine(energy);
        if (crimeResult.actionDone) {
          state.energyBlocked = false;
          return true;
        }
      }

      const refreshedEnergy = getEnergy() || energy;
      state.lastKnownEnergy = refreshedEnergy.current;
      const requiredCrimeEnergy = Number.isFinite(crimeResult.energyCost) && crimeResult.energyCost > 0
        ? crimeResult.energyCost
        : getKnownCrimeEnergyRequirement(refreshedEnergy);
      const shouldUseAutoEnergy = shouldRecoverEnergy(refreshedEnergy, requiredCrimeEnergy);

      if (state.config.autoEnergy && shouldUseAutoEnergy) {
        state.energyBlocked = false;
        return await runEnergyRoutine(refreshedEnergy);
      }

      if (
        state.config.autoCrime &&
        (crimeResult.reason === "insufficient-energy" || !hasMinimumCrimeEnergy(refreshedEnergy, requiredCrimeEnergy))
      ) {
        state.energyBlocked = !state.config.autoEnergy;
        const crimeLabel =
          crimeResult.preferredCrime?.shortLabel ||
          crimeResult.preferredCrime?.label ||
          getPreferredCrimeDefinition().shortLabel ||
          "o crime configurado";
        logMessage(
          `Aguardando energia suficiente para ${crimeLabel} (${refreshedEnergy.current}/${refreshedEnergy.max}, precisa ${requiredCrimeEnergy}).`,
          "info",
          "energy-low",
          CONFIG.warningCooldownMs
        );
        return false;
      }

      state.energyBlocked = false;

      syncGameCycle() || getGameCycle();
      const actionDone = Boolean(crimeResult.actionDone);

      if (!actionDone && trigger === "manual") {
        logMessage(
          "Nenhuma acao automatica foi encontrada na tela atual.",
          "warning",
          "manual-no-action",
          CONFIG.warningCooldownMs
        );
      }

      return actionDone;
    } catch (error) {
      console.error("[CrimeBot] Erro no ciclo:", error);
      logMessage("O bot encontrou um erro durante a execucao.", "error", "runtime-error", 5000);
      return false;
    } finally {
      state.running = false;
    }
  }

  function bindRuntimeEvents() {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === "BOT_STATE_CHANGED") {
        state.enabled = Boolean(message.enabled);

        if (!state.enabled) {
          state.energyBlocked = false;
        }

        if (state.enabled && document.visibilityState === "visible") {
          scheduleBotStep("toggle");
        }

        sendResponse({ success: true });
        return;
      }

      if (message.type === "BOT_TICK") {
        void botStep("alarm").then((actionDone) => {
          sendResponse({ success: true, actionDone });
        });
        return true;
      }

      if (message.type === "RUN_QA_AUDIT") {
        void runQaAudit().then((result) => {
          sendResponse(result);
        });
        return true;
      }
    });

    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local") return;

      if (changes.botEnabled) {
        state.enabled = Boolean(changes.botEnabled.newValue);

        if (!state.enabled) {
          state.energyBlocked = false;
        }

        if (state.enabled) {
          scheduleBotStep("storage");
        }
      }

      if (changes.config) {
        const previousCrimeMode = state.config.crimeMode;
        state.config = { ...CONFIG.defaultConfig, ...(changes.config.newValue || {}) };
        if (state.config.crimeMode !== previousCrimeMode) {
          state.lastCrimeEnergyCost = null;
        }

        if (state.enabled && (state.config.autoCrime || state.config.autoEnergy)) {
          scheduleBotStep("config");
        }
      }

      if (changes.stats) {
        state.stats = { ...CONFIG.defaultStats, ...(changes.stats.newValue || {}) };
      }

      if (changes.gameCycle) {
        state.gameCycle = changes.gameCycle.newValue || null;
      }

      if (changes.gameTime) {
        state.gameTime = changes.gameTime.newValue || null;
      }

      if (changes.logs) {
        state.logs = Array.isArray(changes.logs.newValue) ? changes.logs.newValue : [];
      }

      if (changes.qaEvents) {
        state.qaEvents = Array.isArray(changes.qaEvents.newValue) ? changes.qaEvents.newValue : [];
      }

      if (changes.qaReport) {
        state.qaReport = changes.qaReport.newValue || null;
      }
    });
  }

  function init() {
    if (state.initialized) return;

    chrome.storage.local.get(null, (data) => {
      syncState(data);
      installQaMonitoring();
      bindRuntimeEvents();
      startCycleSync();
      startActionObserver();
      state.initialized = true;
      logMessage("Automacao sincronizada com a pagina.", "action", "automation-ready", 1000);

      if (state.enabled) {
        scheduleBotStep("init");
      }
    });
  }

  init();
})();
