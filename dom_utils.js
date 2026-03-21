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
    debounce
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
