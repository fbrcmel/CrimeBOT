// Crime.Life Bot - Background Service Worker

const CRIME_LIFE_URLS = ["*://crime.life/*", "*://www.crime.life/*"];

function ensureBotAlarm() {
  chrome.storage.local.get(['botEnabled'], (data) => {
    if (!data.botEnabled) return;
    chrome.alarms.create('botTick', { periodInMinutes: 0.5 });
  });
}

function ensureContentAssets(tabId) {
  if (!tabId) return Promise.resolve();

  return chrome.scripting.executeScript({
    target: { tabId },
    files: ["content.js"]
  }).catch(() => {});
}

async function findRelevantCrimeLifeTab() {
  const activeTabs = await chrome.tabs.query({
    active: true,
    currentWindow: true,
    url: CRIME_LIFE_URLS,
  });

  if (activeTabs.length > 0) {
    return activeTabs[0];
  }

  const allTabs = await chrome.tabs.query({ url: CRIME_LIFE_URLS });
  return allTabs[0] || null;
}

function storeQaEvent(event, sendResponse) {
  if (!event || typeof event !== "object") {
    sendResponse({ success: false });
    return;
  }

  chrome.storage.local.get(["qaEvents"], (data) => {
    const qaEvents = Array.isArray(data.qaEvents) ? data.qaEvents : [];
    qaEvents.unshift(event);

    while (qaEvents.length > 80) {
      qaEvents.pop();
    }

    chrome.storage.local.set({ qaEvents }, () => {
      sendResponse({ success: true });
    });
  });
}

async function runQaAuditForRelevantTab(sendResponse) {
  try {
    const tab = await findRelevantCrimeLifeTab();

    if (!tab?.id) {
      sendResponse({
        success: false,
        error: "Abra uma aba do crime.life para executar a auditoria.",
      });
      return;
    }

    await ensureContentAssets(tab.id);

    const response = await chrome.tabs.sendMessage(tab.id, {
      type: "RUN_QA_AUDIT",
    });

    if (!response?.success || !response?.report) {
      sendResponse({
        success: false,
        error: response?.error || "A auditoria nao retornou um relatorio valido.",
      });
      return;
    }

    chrome.storage.local.set({ qaReport: response.report }, () => {
      sendResponse({
        success: true,
        report: response.report,
        tabId: tab.id,
      });
    });
  } catch (error) {
    sendResponse({
      success: false,
      error: error?.message || "Falha ao executar a auditoria na aba atual.",
    });
  }
}

function clickUseAllEnergyInMainWorld(tabId, sendResponse) {
  if (!tabId) {
    sendResponse({ success: false });
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async () => {
      const normalize = (value) => String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

      const isVisible = (element) => {
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
      };

      const isDisabled = (element) => (
        !(element instanceof Element) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      );

      const getCenter = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          rect,
        };
      };

      const getReactProps = (element) => {
        if (!(element instanceof Element)) return null;

        for (const key of Object.keys(element)) {
          if (key.startsWith("__reactProps$")) {
            return element[key];
          }
        }

        for (const key of Object.keys(element)) {
          if (!key.startsWith("__reactFiber$")) continue;

          let fiber = element[key];
          while (fiber) {
            if (fiber.memoizedProps && typeof fiber.memoizedProps === "object") {
              return fiber.memoizedProps;
            }
            fiber = fiber.return;
          }
        }

        return null;
      };

      const buildReactEvent = (element) => ({
        target: element,
        currentTarget: element,
        nativeEvent: null,
        type: "click",
        button: 0,
        buttons: 1,
        isTrusted: true,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {},
        persist() {},
      });

      const invokeReactHandlers = (element) => {
        const chain = [
          element,
          element?.closest("button, [role='button']"),
          element?.parentElement,
          element?.closest("div, section, article"),
        ].filter(Boolean);

        for (const candidate of chain) {
          const props = getReactProps(candidate);
          if (!props) continue;

          const event = buildReactEvent(candidate);
          let invoked = false;

          for (const handlerName of ["onPointerDown", "onMouseDown", "onPointerUp", "onMouseUp", "onClick"]) {
            if (typeof props[handlerName] !== "function") continue;

            try {
              props[handlerName](event);
              invoked = true;
            } catch (_) {
              // Ignore handler invocation errors and keep trying the next strategy.
            }
          }

          if (invoked) return true;
        }

        return false;
      };

      const dispatchMainWorldClick = (element) => {
        if (!(element instanceof HTMLElement)) return false;
        if (!isVisible(element)) return false;
        if (isDisabled(element)) return false;

        element.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });

        const center = getCenter(element);
        let target = document.elementFromPoint(center.x, center.y);

        if (target instanceof Element) {
          const buttonLike = target.closest("button, [role='button']");
          if (buttonLike instanceof HTMLElement && (buttonLike === element || element.contains(buttonLike) || buttonLike.contains(element))) {
            element = buttonLike;
          }
        }

        try {
          element.focus({ preventScroll: true });
        } catch (_) {
          // Ignore focus failures.
        }

        const finalCenter = getCenter(element);
        const mouseOptions = {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          clientX: finalCenter.x,
          clientY: finalCenter.y,
          button: 0,
          buttons: 1,
        };
        const pointerOptions = {
          ...mouseOptions,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
        };

        if (typeof PointerEvent === "function") {
          for (const type of ["pointerenter", "pointerover", "pointerdown", "pointerup"]) {
            element.dispatchEvent(new PointerEvent(type, pointerOptions));
          }
        }

        for (const type of ["mouseenter", "mouseover", "mousedown", "mouseup", "click"]) {
          element.dispatchEvent(new MouseEvent(type, mouseOptions));
        }

        try {
          element.click();
        } catch (_) {
          // Ignore native click failures and let other strategies run.
        }

        return true;
      };

      const findCrimeActionButton = () => {
        const modals = Array.from(document.querySelectorAll("div, section, article"))
          .filter(isVisible)
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.width < 300 || rect.height < 220) return false;

            const text = normalize(element.innerText || element.textContent || "");
            return (
              text.includes("usar toda a energia") ||
              (text.includes("executar crime") && text.includes("cancelar"))
            );
          })
          .sort((a, b) => {
            const rectA = a.getBoundingClientRect();
            const rectB = b.getBoundingClientRect();
            return rectB.width * rectB.height - rectA.width * rectA.height;
          });

        const modal = modals[0] || document;
        const buttons = Array.from(modal.querySelectorAll("button[data-slot='button'], button"))
          .filter(isVisible)
          .filter((button) => !isDisabled(button))
          .map((button) => {
            const text = normalize(button.innerText || button.textContent || "");
            const isBatch = text.startsWith("usar toda a energia");
            const isSingle = text.startsWith("executar crime");
            if (!isBatch && !isSingle) return null;

            const match = isBatch
              ? text.match(/\((\d+)\s*x\)|\b(\d+)\s*x\b/)
              : null;
            const multiplier = Number(match?.[1] || match?.[2] || 1) || 1;
            const center = getCenter(button);
            const topmost = document.elementFromPoint(center.x, center.y);
            const isTopmost =
              topmost === button ||
              button.contains(topmost) ||
              topmost?.contains(button);

            return {
              button,
              score:
                (isBatch ? multiplier * 100 : 50) +
                center.rect.width +
                center.rect.height +
                (isTopmost ? 60 : 0),
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score);

        return buttons[0]?.button || null;
      };

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const target = findCrimeActionButton();
        if (!(target instanceof HTMLElement)) {
          await nextFrame();
          continue;
        }

        const reactTriggered = invokeReactHandlers(target);
        const domTriggered = dispatchMainWorldClick(target);

        if (reactTriggered || domTriggered) {
          return true;
        }

        await nextFrame();
      }

      return false;
    }
  }, (results) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    sendResponse({ success: Boolean(results?.[0]?.result) });
  });
}

function clickCrimeInMainWorld(tabId, payload, sendResponse) {
  if (!tabId) {
    sendResponse({ success: false });
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [payload || {}],
    func: async (payload) => {
      const normalize = (value) => String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

      const isVisible = (element) => {
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
      };

      const isDisabled = (element) => (
        !(element instanceof Element) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      );

      const isClickableLike = (element) => {
        if (!(element instanceof Element)) return false;
        if (element.tagName === "BUTTON" || element.tagName === "A") return true;
        if (element.getAttribute("role") === "button") return true;
        if (element.hasAttribute("tabindex")) return true;
        return window.getComputedStyle(element).cursor === "pointer";
      };

      const resolveActionableTarget = (element) => {
        if (!(element instanceof Element)) return null;

        let current = element;
        while (current && current !== document.body) {
          if (isClickableLike(current) && isVisible(current)) {
            return current;
          }
          current = current.parentElement;
        }

        return element;
      };

      const getCenter = (element) => {
        const rect = element.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      };

      const getReactProps = (element) => {
        if (!(element instanceof Element)) return null;

        for (const key of Object.keys(element)) {
          if (key.startsWith("__reactProps$")) {
            return element[key];
          }
        }

        for (const key of Object.keys(element)) {
          if (!key.startsWith("__reactFiber$")) continue;

          let fiber = element[key];
          while (fiber) {
            if (fiber.memoizedProps && typeof fiber.memoizedProps === "object") {
              return fiber.memoizedProps;
            }
            fiber = fiber.return;
          }
        }

        return null;
      };

      const buildReactEvent = (element) => ({
        target: element,
        currentTarget: element,
        nativeEvent: null,
        type: "click",
        button: 0,
        buttons: 1,
        isTrusted: true,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {},
        persist() {},
      });

      const invokeReactHandlers = (element) => {
        const chain = [
          element,
          element?.closest("button, [role='button']"),
          element?.parentElement,
          element?.closest("div, section, article"),
        ].filter(Boolean);

        for (const candidate of chain) {
          const props = getReactProps(candidate);
          if (!props) continue;

          const event = buildReactEvent(candidate);
          let invoked = false;

          for (const handlerName of ["onPointerDown", "onMouseDown", "onPointerUp", "onMouseUp", "onClick"]) {
            if (typeof props[handlerName] !== "function") continue;

            try {
              props[handlerName](event);
              invoked = true;
            } catch (_) {
              // Ignore handler failures and keep trying.
            }
          }

          if (invoked) return true;
        }

        return false;
      };

      const dispatchMainWorldClick = (element) => {
        const target = resolveActionableTarget(element);
        if (!(target instanceof HTMLElement)) return false;
        if (!isVisible(target) || isDisabled(target)) return false;

        target.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });

        try {
          target.focus({ preventScroll: true });
        } catch (_) {
          // Ignore focus failures.
        }

        const center = getCenter(target);
        const mouseOptions = {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          clientX: center.x,
          clientY: center.y,
          button: 0,
          buttons: 1,
        };
        const pointerOptions = {
          ...mouseOptions,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
        };

        if (typeof PointerEvent === "function") {
          for (const type of ["pointerenter", "pointerover", "pointerdown", "pointerup"]) {
            target.dispatchEvent(new PointerEvent(type, pointerOptions));
          }
        }

        for (const type of ["mouseenter", "mouseover", "mousedown", "mouseup", "click"]) {
          target.dispatchEvent(new MouseEvent(type, mouseOptions));
        }

        try {
          target.click();
        } catch (_) {
          // Ignore native click failures.
        }

        return true;
      };

      const activate = (element) => {
        const target = resolveActionableTarget(element);
        if (!(target instanceof HTMLElement)) return false;
        if (!isVisible(target) || isDisabled(target)) return false;

        return invokeReactHandlers(target) || dispatchMainWorldClick(target);
      };

      const getCrimeModal = () => {
        const candidates = Array.from(document.querySelectorAll("div, section, article"))
          .filter(isVisible)
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            if (rect.width < 300 || rect.height < 220) return false;

            const text = normalize(element.innerText || element.textContent || "");
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
      };

      const getCrimeDockButton = () => {
        const byAria = Array.from(document.querySelectorAll("button[aria-label], [role='button'][aria-label]"))
          .filter(isVisible)
          .find((element) => normalize(element.getAttribute("aria-label")) === "crimes");

        if (byAria) return resolveActionableTarget(byAria);

        const byText = Array.from(document.querySelectorAll("div, span, p, strong, button, a"))
          .filter(isVisible)
          .find((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.top > window.innerHeight * 0.78 &&
              rect.bottom < window.innerHeight - 2 &&
              normalize(element.textContent || "") === "crimes"
            );
          });

        return byText ? resolveActionableTarget(byText) : null;
      };

      const getCrimePins = () => Array.from(document.querySelectorAll("[data-pin-type='crime']"))
        .filter(isVisible)
        .map((element) => {
          const text = normalize(element.innerText || element.textContent || "");
          const crimeId = normalize((element.getAttribute("data-crime-id") || element.getAttribute("aria-label") || "").replace(/-/g, " "));
          const percentMatches = [...text.matchAll(/(\d{1,3})\s*%/g)].map((match) => Number(match[1]));
          const successPercent = percentMatches.length ? Math.max(...percentMatches) : 0;
          const rect = element.getBoundingClientRect();

          return {
            element,
            text,
            crimeId,
            successPercent,
            score: successPercent * 100 - Math.abs(rect.left + rect.width / 2 - window.innerWidth / 2) / 10,
          };
        })
        .sort((a, b) => b.score - a.score);

      const waitForSelection = async () => {
        for (let attempt = 0; attempt < 18; attempt += 1) {
          if (getCrimeModal()) return true;
          if (getCrimePins().length > 0) return true;
          await nextFrame();
        }

        return false;
      };

      if (!getCrimeModal() && getCrimePins().length === 0) {
        const dockButton = getCrimeDockButton();
        if (dockButton) {
          activate(dockButton);
          await waitForSelection();
        }
      }

      if (payload?.mode === "open") {
        return getCrimeModal() || getCrimePins().length > 0;
      }

      const pins = getCrimePins();
      if (!pins.length) return false;

      let candidate = null;

      if (payload?.mode === "specific") {
        const aliases = Array.isArray(payload.aliases)
          ? payload.aliases.map((entry) => normalize(entry)).filter(Boolean)
          : [];

        candidate = pins.find((pin) => aliases.some((alias) => pin.text.includes(alias) || pin.crimeId.includes(alias))) || null;
      } else if (payload?.mode === "best100") {
        candidate = pins.find((pin) => pin.successPercent >= 100) || null;
      }

      if (!candidate) {
        candidate = pins[0] || null;
      }

      if (!candidate) return false;

      if (!activate(candidate.element)) {
        return false;
      }

      for (let attempt = 0; attempt < 18; attempt += 1) {
        if (getCrimeModal()) return true;
        await nextFrame();
      }

      return false;
    }
  }, (results) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    sendResponse({ success: Boolean(results?.[0]?.result) });
  });
}

function clickServiceActionInMainWorld(tabId, payload, sendResponse) {
  if (!tabId) {
    sendResponse({ success: false });
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [payload || {}],
    func: async (payload) => {
      const normalize = (value) => String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

      const isVisible = (element) => {
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
      };

      const isDisabled = (element) => (
        !(element instanceof Element) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      );

      const isClickableLike = (element) => {
        if (!(element instanceof Element)) return false;
        if (element.tagName === "BUTTON" || element.tagName === "A") return true;
        if (element.getAttribute("role") === "button") return true;
        if (element.hasAttribute("tabindex")) return true;
        return window.getComputedStyle(element).cursor === "pointer";
      };

      const resolveActionableTarget = (element) => {
        if (!(element instanceof Element)) return null;

        let current = element;
        while (current && current !== document.body) {
          if (isClickableLike(current) && isVisible(current)) {
            return current;
          }
          current = current.parentElement;
        }

        return element;
      };

      const getReactProps = (element) => {
        if (!(element instanceof Element)) return null;

        for (const key of Object.keys(element)) {
          if (key.startsWith("__reactProps$")) return element[key];
        }

        for (const key of Object.keys(element)) {
          if (!key.startsWith("__reactFiber$")) continue;

          let fiber = element[key];
          while (fiber) {
            if (fiber.memoizedProps && typeof fiber.memoizedProps === "object") {
              return fiber.memoizedProps;
            }
            fiber = fiber.return;
          }
        }

        return null;
      };

      const buildReactEvent = (element) => ({
        target: element,
        currentTarget: element,
        nativeEvent: null,
        type: "click",
        button: 0,
        buttons: 1,
        isTrusted: true,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {},
        persist() {},
      });

      const invokeReactHandlers = (element) => {
        const chain = [
          element,
          element?.closest("button, [role='button']"),
          element?.parentElement,
          element?.closest("div, section, article"),
        ].filter(Boolean);

        for (const candidate of chain) {
          const props = getReactProps(candidate);
          if (!props) continue;

          const event = buildReactEvent(candidate);
          let invoked = false;

          for (const handlerName of ["onPointerDown", "onMouseDown", "onPointerUp", "onMouseUp", "onClick"]) {
            if (typeof props[handlerName] !== "function") continue;

            try {
              props[handlerName](event);
              invoked = true;
            } catch (_) {
              // Ignore handler failures and keep trying.
            }
          }

          if (invoked) return true;
        }

        return false;
      };

      const dispatchMainWorldClick = (element) => {
        let target = resolveActionableTarget(element);
        if (!(target instanceof HTMLElement)) return false;
        if (!isVisible(target) || isDisabled(target)) return false;

        target.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });

        const rect = target.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const topmost = document.elementFromPoint(x, y);
        const topmostTarget = resolveActionableTarget(topmost);

        if (
          topmostTarget instanceof HTMLElement &&
          (topmostTarget === target || target.contains(topmostTarget) || topmostTarget.contains(target)) &&
          isVisible(topmostTarget) &&
          !isDisabled(topmostTarget)
        ) {
          target = topmostTarget;
        }

        try {
          target.focus({ preventScroll: true });
        } catch (_) {
          // Ignore focus failures.
        }

        const mouseOptions = {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          clientX: x,
          clientY: y,
          button: 0,
          buttons: 1,
        };
        const pointerOptions = {
          ...mouseOptions,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
        };

        if (typeof PointerEvent === "function") {
          for (const type of ["pointerenter", "pointerover", "pointerdown", "pointerup"]) {
            target.dispatchEvent(new PointerEvent(type, pointerOptions));
          }
        }

        for (const type of ["mouseenter", "mouseover", "mousedown", "mouseup", "click"]) {
          target.dispatchEvent(new MouseEvent(type, mouseOptions));
        }

        try {
          target.click();
        } catch (_) {
          // Ignore native click failures.
        }

        return true;
      };

      const modalText = normalize(payload?.modalText || "");
      const sectionText = normalize(payload?.sectionText || "");
      const cardText = normalize(payload?.cardText || "");
      const buttonText = normalize(payload?.buttonText || "");

      const getSarjetaModal = () => {
        const candidates = Array.from(document.querySelectorAll("div, section, article"))
          .filter(isVisible)
          .map((element) => {
            const rect = element.getBoundingClientRect();
            if (
              rect.width < 520 ||
              rect.height < 320 ||
              rect.left > window.innerWidth * 0.78 ||
              rect.right < window.innerWidth * 0.22 ||
              rect.top > window.innerHeight * 0.72 ||
              rect.bottom < window.innerHeight * 0.22
            ) {
              return null;
            }

            const text = normalize(element.innerText || element.textContent || "");
            if (!text) return null;

            let score = 0;
            if (modalText && text.includes(modalText)) score += 260;
            if (sectionText && text.includes(sectionText)) score += 50;
            if (text.includes(cardText)) score += 30;
            if (text.includes("visitantes")) score += 24;
            if (text.includes("drogas")) score += 24;
            if (text.includes(buttonText)) score += 20;
            if (score < 220) return null;

            return {
              element,
              score: score + Math.min((rect.width * rect.height) / 25000, 60),
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score);

        return candidates[0]?.element || null;
      };

      const getJorgeCard = (root) => {
        if (!(root instanceof Element)) return null;

        const candidates = Array.from(root.querySelectorAll("div"))
          .filter(isVisible)
          .map((element) => {
            const text = normalize(element.innerText || element.textContent || "");
            if (!text) return null;
            if (!text.includes(cardText)) return null;
            if (!text.includes(buttonText)) return null;

            const classText = String(element.className || "");
            let score = 0;

            if (text.includes("10 energia")) score += 60;
            if (text.includes("1 favor")) score += 45;
            if (text.includes("4% risco")) score += 18;
            if (text.includes(sectionText)) score += 24;
            if (text.includes("hazel")) score -= 220;
            if (text.includes("pearl")) score -= 220;
            if (classText.includes("rounded-md")) score += 12;
            if (classText.includes("border")) score += 10;
            if (classText.includes("overflow-hidden")) score += 12;
            if (classText.includes("bg-background/40")) score += 20;

            if (score <= 0) return null;

            return { element, score };
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score);

        return candidates[0]?.element || null;
      };

      const getContractButton = (card) => {
        if (!(card instanceof Element)) return null;

        const buttons = Array.from(card.querySelectorAll("button[data-slot='button'], button"))
          .filter(isVisible)
          .filter((button) => !isDisabled(button))
          .map((button) => {
            const text = normalize(button.innerText || button.textContent || "");
            if (text !== buttonText && !text.includes(buttonText)) return null;

            let score = 0;
            if (text === buttonText) score += 100;
            if (button.getAttribute("data-slot") === "button") score += 25;

            return { button, score };
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score);

        return buttons[0]?.button || null;
      };

      for (let attempt = 0; attempt < 8; attempt += 1) {
        const modal = getSarjetaModal();
        const card = getJorgeCard(modal);
        const target = getContractButton(card);

        if (target instanceof Element) {
          const reactTriggered = invokeReactHandlers(target) || invokeReactHandlers(card);
          const domTriggered = dispatchMainWorldClick(target) || dispatchMainWorldClick(card);

          if (reactTriggered || domTriggered) {
            return true;
          }
        }

        await nextFrame();
      }

      return false;
    }
  }, (results) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    sendResponse({ success: Boolean(results?.[0]?.result) });
  });
}

function clickDetentionExitInMainWorld(tabId, payload, sendResponse) {
  if (!tabId) {
    sendResponse({ success: false });
    return;
  }

  chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [payload || {}],
    func: async (payload) => {
      const normalize = (value) => String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

      const nextFrame = () => new Promise((resolve) => window.requestAnimationFrame(() => resolve()));

      const scoreMatch = (text, targets) => {
        const normalizedText = normalize(text);
        if (!normalizedText) return 0;

        return (targets || []).reduce((best, target) => {
          const normalizedTarget = normalize(target);
          if (!normalizedTarget) return best;
          if (normalizedText === normalizedTarget) return Math.max(best, 120);
          if (normalizedText.includes(normalizedTarget)) return Math.max(best, 90);
          return best;
        }, 0);
      };

      const isVisible = (element) => {
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
      };

      const isDisabled = (element) => (
        !(element instanceof Element) ||
        element.hasAttribute("disabled") ||
        element.getAttribute("aria-disabled") === "true"
      );

      const isClickableLike = (element) => {
        if (!(element instanceof Element)) return false;
        if (element.tagName === "BUTTON" || element.tagName === "A") return true;
        if (element.getAttribute("role") === "button") return true;
        if (element.hasAttribute("tabindex")) return true;
        return window.getComputedStyle(element).cursor === "pointer";
      };

      const resolveActionableTarget = (element) => {
        if (!(element instanceof Element)) return null;

        let current = element;
        while (current && current !== document.body) {
          if (isClickableLike(current) && isVisible(current)) {
            return current;
          }
          current = current.parentElement;
        }

        return element;
      };

      const getReactProps = (element) => {
        if (!(element instanceof Element)) return null;

        for (const key of Object.keys(element)) {
          if (key.startsWith("__reactProps$")) return element[key];
        }

        for (const key of Object.keys(element)) {
          if (!key.startsWith("__reactFiber$")) continue;

          let fiber = element[key];
          while (fiber) {
            if (fiber.memoizedProps && typeof fiber.memoizedProps === "object") {
              return fiber.memoizedProps;
            }
            fiber = fiber.return;
          }
        }

        return null;
      };

      const buildReactEvent = (element) => ({
        target: element,
        currentTarget: element,
        nativeEvent: null,
        type: "click",
        button: 0,
        buttons: 1,
        isTrusted: true,
        defaultPrevented: false,
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {},
        persist() {},
      });

      const invokeReactHandlers = (element) => {
        const chain = [
          element,
          element?.closest("button, [role='button']"),
          element?.parentElement,
          element?.closest("div, section, article"),
        ].filter(Boolean);

        for (const candidate of chain) {
          const props = getReactProps(candidate);
          if (!props) continue;

          const event = buildReactEvent(candidate);
          let invoked = false;

          for (const handlerName of ["onPointerDown", "onMouseDown", "onPointerUp", "onMouseUp", "onClick"]) {
            if (typeof props[handlerName] !== "function") continue;

            try {
              props[handlerName](event);
              invoked = true;
            } catch (_) {
              // Ignore handler failures and keep trying.
            }
          }

          if (invoked) return true;
        }

        return false;
      };

      const dispatchMainWorldClick = (element) => {
        let target = resolveActionableTarget(element);
        if (!(target instanceof HTMLElement)) return false;
        if (!isVisible(target) || isDisabled(target)) return false;

        target.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });

        const rect = target.getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const topmost = document.elementFromPoint(x, y);
        const topmostTarget = resolveActionableTarget(topmost);

        if (
          topmostTarget instanceof HTMLElement &&
          (topmostTarget === target || target.contains(topmostTarget) || topmostTarget.contains(target)) &&
          isVisible(topmostTarget) &&
          !isDisabled(topmostTarget)
        ) {
          target = topmostTarget;
        }

        try {
          target.focus({ preventScroll: true });
        } catch (_) {
          // Ignore focus failures.
        }

        const mouseOptions = {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          clientX: x,
          clientY: y,
          button: 0,
          buttons: 1,
        };
        const pointerOptions = {
          ...mouseOptions,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
        };

        if (typeof PointerEvent === "function") {
          for (const type of ["pointerenter", "pointerover", "pointerdown", "pointerup"]) {
            target.dispatchEvent(new PointerEvent(type, pointerOptions));
          }
        }

        for (const type of ["mouseenter", "mouseover", "mousedown", "mouseup", "click"]) {
          target.dispatchEvent(new MouseEvent(type, mouseOptions));
        }

        try {
          target.click();
        } catch (_) {
          // Ignore native click failures.
        }

        return true;
      };

      const titleAliases = Array.isArray(payload?.titleAliases)
        ? payload.titleAliases.map((entry) => normalize(entry)).filter(Boolean)
        : [];
      const exitAliases = Array.isArray(payload?.exitAliases)
        ? payload.exitAliases.map((entry) => normalize(entry)).filter(Boolean)
        : [];

      const getDetentionModal = () => {
        const candidates = Array.from(document.querySelectorAll("div, section, article"))
          .filter(isVisible)
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

            const text = normalize(element.innerText || element.textContent || "");
            if (!text) return null;

            let score = 0;
            score += scoreMatch(text, titleAliases) * 2;
            score += scoreMatch(text, exitAliases) * 2;
            if (text.includes("restante")) score += 60;
            if (text.includes("tratamento")) score += 30;
            if (text.includes("cumprir pena")) score += 30;
            if (score < 150) return null;

            return {
              element,
              score: score + Math.min((rect.width * rect.height) / 20000, 60),
            };
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score);

        return candidates[0]?.element || null;
      };

      const getExitButton = (root) => {
        if (!(root instanceof Element)) return null;

        const buttons = Array.from(root.querySelectorAll("button, [role='button'], a"))
          .filter(isVisible)
          .filter((button) => !isDisabled(button))
          .map((button) => {
            const text = normalize(button.innerText || button.textContent || "");
            if (!text) return null;
            if (!exitAliases.some((alias) => text.includes(alias))) return null;

            const rect = button.getBoundingClientRect();
            let score = 100;
            if (rect.bottom > window.innerHeight * 0.6) score += 16;
            if (rect.width > 120) score += 10;

            return { button, score };
          })
          .filter(Boolean)
          .sort((a, b) => b.score - a.score);

        return buttons[0]?.button || null;
      };

      for (let attempt = 0; attempt < 6; attempt += 1) {
        const modal = getDetentionModal();
        const button = getExitButton(modal);

        if (!(button instanceof HTMLElement)) {
          await nextFrame();
          continue;
        }

        const reactTriggered = invokeReactHandlers(button);
        const domTriggered = dispatchMainWorldClick(button);

        if (reactTriggered || domTriggered) {
          return true;
        }

        await nextFrame();
      }

      return false;
    }
  }, (results) => {
    if (chrome.runtime.lastError) {
      sendResponse({ success: false, error: chrome.runtime.lastError.message });
      return;
    }

    sendResponse({ success: Boolean(results?.[0]?.result) });
  });
}

function sendBotTickToRelevantTab() {
  chrome.tabs.query({ url: CRIME_LIFE_URLS, active: true }, (tabs) => {
    if (tabs.length === 0) {
      chrome.tabs.query({ url: CRIME_LIFE_URLS }, (allTabs) => {
        if (allTabs.length > 0) {
          ensureContentAssets(allTabs[0].id);
          chrome.tabs.sendMessage(allTabs[0].id, { type: 'BOT_TICK' }).catch(() => {});
        }
      });
      return;
    }

    ensureContentAssets(tabs[0].id);
    chrome.tabs.sendMessage(tabs[0].id, { type: 'BOT_TICK' }).catch(() => {});
  });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    botEnabled: false,
    config: {
      autoCrime: false,
      autoEnergy: false,
      autoShop: false,
      crimeMode: 'safe',
      energyThreshold: 10,
      checkInterval: 30, // segundos entre ações
    },
    stats: {
      crimesExecuted: 0,
      totalEarned: 0,
      trainsCompleted: 0,
      startTime: null,
    },
    logs: [],
    gameCycle: null,
    gameTime: null,
    qaEvents: [],
    qaReport: null,
  });
});

chrome.runtime.onStartup.addListener(() => {
  ensureBotAlarm();
});

ensureBotAlarm();

// Listener para mensagens do content script e popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'GET_STATE') {
    chrome.storage.local.get(null, (data) => {
      sendResponse(data);
    });
    return true;
  }

  if (message.type === 'TOGGLE_BOT') {
    chrome.storage.local.get(['botEnabled', 'stats'], (data) => {
      const newEnabled = !data.botEnabled;
      const stats = data.stats || {};

      if (newEnabled) {
        stats.startTime = Date.now();
        chrome.alarms.create('botTick', { periodInMinutes: 0.5 });
      } else {
        stats.startTime = null;
        chrome.alarms.clearAll();
      }

      chrome.storage.local.set({ botEnabled: newEnabled, stats }, () => {
        // Notificar todas as tabs do crime.life
        chrome.tabs.query({ url: CRIME_LIFE_URLS }, (tabs) => {
          tabs.forEach(tab => {
            ensureContentAssets(tab.id);
            chrome.tabs.sendMessage(tab.id, {
              type: 'BOT_STATE_CHANGED',
              enabled: newEnabled
            }).catch(() => {});
          });

          if (newEnabled) {
            sendBotTickToRelevantTab();
          }
        });
        sendResponse({ enabled: newEnabled });
      });
    });
    return true;
  }

  if (message.type === 'UPDATE_CONFIG') {
    chrome.storage.local.get(['botEnabled', 'config'], (data) => {
      const config = { ...(data.config || {}), ...(message.config || {}) };
      delete config.autoExit;

      chrome.storage.local.set({ config }, () => {
        if (data.botEnabled && (config.autoCrime || config.autoEnergy)) {
          sendBotTickToRelevantTab();
        }

        sendResponse({ success: true });
      });
    });
    return true;
  }

  if (message.type === "QA_EVENT") {
    storeQaEvent(message.event, sendResponse);
    return true;
  }

  if (message.type === 'ADD_LOG') {
    chrome.storage.local.get(['logs'], (data) => {
      const logs = data.logs || [];
      logs.unshift({
        time: new Date().toLocaleTimeString('pt-BR'),
        text: message.text,
        type: message.logType || 'info'
      });
      // Manter apenas os últimos 50 logs
      if (logs.length > 50) logs.pop();
      chrome.storage.local.set({ logs });
    });
    return true;
  }

  if (message.type === 'UPDATE_STATS') {
    chrome.storage.local.get(['stats'], (data) => {
      const stats = { ...data.stats, ...message.stats };
      chrome.storage.local.set({ stats });
    });
    return true;
  }

  if (message.type === 'UPDATE_GAME_CYCLE') {
    chrome.storage.local.set({ gameCycle: message.gameCycle }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'UPDATE_GAME_TIME') {
    chrome.storage.local.set({ gameTime: message.gameTime }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'RESET_STATS') {
    chrome.storage.local.set({
      stats: { crimesExecuted: 0, totalEarned: 0, trainsCompleted: 0, startTime: null },
      logs: []
    }, () => sendResponse({ success: true }));
    return true;
  }

  if (message.type === "RUN_QA_AUDIT") {
    void runQaAuditForRelevantTab(sendResponse);
    return true;
  }

  if (message.type === 'MAIN_WORLD_CLICK_USE_ALL_ENERGY') {
    clickUseAllEnergyInMainWorld(sender.tab?.id, sendResponse);
    return true;
  }

  if (message.type === 'MAIN_WORLD_CLICK_CRIME') {
    clickCrimeInMainWorld(sender.tab?.id, message.payload, sendResponse);
    return true;
  }

  if (message.type === 'MAIN_WORLD_CLICK_SERVICE_ACTION') {
    clickServiceActionInMainWorld(sender.tab?.id, message.payload, sendResponse);
    return true;
  }

  if (message.type === 'MAIN_WORLD_CLICK_DETENTION_EXIT') {
    clickDetentionExitInMainWorld(sender.tab?.id, message.payload, sendResponse);
    return true;
  }
});

// Alarm tick - verificar e executar ações
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'botTick') {
    chrome.storage.local.get(['botEnabled'], (data) => {
      if (!data.botEnabled) return;

      sendBotTickToRelevantTab();
    });
  }
});
