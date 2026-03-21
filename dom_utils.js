(function initDomUtils(globalScope) {
  const root = globalScope.WISMED = globalScope.WISMED || {};

  function safeQuery(selector, base = document) {
    try {
      return base.querySelector(selector);
    } catch {
      return null;
    }
  }

  function collectVisibleText() {
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT);
    const chunks = [];
    while (walker.nextNode()) {
      const value = walker.currentNode.nodeValue.trim();
      if (value) {
        chunks.push(value);
      }
    }
    return chunks.join(" ").slice(0, 25000);
  }

  function isValidHttpUrl(value) {
    try {
      const parsed = new URL(value);
      return ["http:", "https:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  }

  function findByText(targetTexts, selector = "button, a, [role='button'], [onclick]") {
    const wanted = (targetTexts || []).map((item) => String(item).toLowerCase());
    return Array.from(document.querySelectorAll(selector)).find((element) => {
      const text = (element.innerText || element.textContent || "").trim().toLowerCase();
      return wanted.some((needle) => text.includes(needle));
    }) || null;
  }

  function highlightElement(element) {
    if (!element) return false;
    const originalOutline = element.style.outline;
    const originalBackground = element.style.backgroundColor;
    element.style.outline = "3px solid #f59e0b";
    element.style.backgroundColor = "rgba(245, 158, 11, 0.18)";
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      element.style.outline = originalOutline;
      element.style.backgroundColor = originalBackground;
    }, 3000);
    return true;
  }

  function ensureHaloStyles() {
    if (document.getElementById("wismed-halo-styles")) {
      return;
    }
    const style = document.createElement("style");
    style.id = "wismed-halo-styles";
    style.textContent = `
      @keyframes wismedHaloPulse {
        0% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.95), 0 0 0 10px rgba(220, 38, 38, 0.35); transform: scale(1); }
        70% { box-shadow: 0 0 0 8px rgba(220, 38, 38, 0.35), 0 0 0 22px rgba(220, 38, 38, 0); transform: scale(1.03); }
        100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0), 0 0 0 0 rgba(220, 38, 38, 0); transform: scale(1); }
      }

      .wismed-halo-target {
        position: relative !important;
        border-radius: 12px !important;
        outline: 3px solid rgba(220, 38, 38, 0.95) !important;
        outline-offset: 3px !important;
        background-color: rgba(220, 38, 38, 0.08) !important;
        animation: wismedHaloPulse 1.2s ease-out infinite !important;
        z-index: 2147483646 !important;
        transition: transform 0.2s ease !important;
      }

      .wismed-halo-target img,
      .wismed-halo-target svg,
      .wismed-halo-target span {
        position: relative !important;
        z-index: 2147483647 !important;
      }
    `;
    document.head.appendChild(style);
  }

  function resolveHaloTarget(element) {
    if (!element) return null;
    const clickable = element.closest("a, button, input, [role='button']");
    if (clickable) return clickable;
    const toolWrapper = element.closest(".downloadToolsItem, .styles__ItemToolsWrapper-sc-1dctohr-0");
    if (toolWrapper) return toolWrapper;
    return element;
  }

  function applyPulsingHalo(element, durationMs = 8000) {
    const target = resolveHaloTarget(element);
    if (!target) return false;
    ensureHaloStyles();
    target.classList.add("wismed-halo-target");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    setTimeout(() => {
      target.classList.remove("wismed-halo-target");
    }, durationMs);
    return true;
  }

  function debounce(fn, wait) {
    let timeoutId = null;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), wait);
    };
  }

  root.domUtils = {
    safeQuery,
    collectVisibleText,
    isValidHttpUrl,
    findByText,
    highlightElement,
    applyPulsingHalo,
    debounce
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
