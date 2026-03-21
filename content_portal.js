(function initPortalContentScript(globalScope) {
  const root = globalScope.WISMED;
  const { MESSAGE_TYPES, PORTAL_SCAN_DEBOUNCE_MS, URL_CHANGE_POLL_MS } = root.CONSTANTS;
  const { collectVisibleText, findByText, highlightElement, debounce, safeQuery } = root.domUtils;

  let lastHref = location.href;
  let lastAnalysisFingerprint = "";

  function gatherContext() {
    const scriptSources = Array.from(document.scripts || []).map((script) => script.src).filter(Boolean);
    return {
      hostname: location.hostname,
      pathname: location.pathname,
      pageText: collectVisibleText(),
      scriptSources,
      title: document.title,
      document
    };
  }

  async function analyzePage(reason = "automatic") {
    let rules = null;
    let vendorMatch = null;
    let error = null;

    try {
      rules = await root.rulesEngine.loadRemoteRules(false);
      vendorMatch = root.rulesEngine.detectVendor(rules, gatherContext());
    } catch (scanError) {
      error = scanError.message;
    }

    const result = {
      reason,
      pageUrl: location.href,
      hostname: location.hostname,
      title: document.title,
      rulesVersion: rules ? rules.configVersion : "unavailable",
      vendor: vendorMatch ? {
        id: vendorMatch.vendor.id,
        name: vendorMatch.vendor.name,
        score: vendorMatch.score,
        manualHint: vendorMatch.vendor.manualHint || null,
        actions: vendorMatch.vendor.actions
      } : null,
      error,
      timestamp: new Date().toISOString()
    };

    const fingerprint = JSON.stringify({
      pageUrl: result.pageUrl,
      vendor: result.vendor ? result.vendor.id : null,
      error: result.error
    });
    if (reason === "automatic" && fingerprint === lastAnalysisFingerprint) {
      return;
    }
    lastAnalysisFingerprint = fingerprint;

    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.PORTAL_ANALYSIS_RESULT,
      payload: result
    }).catch(() => {});
  }

  async function executeAction(action) {
    if (!action || typeof action !== "object" || !action.type) {
      throw new Error("Invalid portal action.");
    }

    if (action.type === "click_selector") {
      const element = safeQuery(action.selector);
      if (!element) throw new Error(`Selector not found: ${action.selector}`);
      highlightElement(element);
      element.click();
      return { ok: true, detail: `Clicked selector ${action.selector}.` };
    }

    if (action.type === "click_text") {
      const element = findByText(action.texts, action.selector);
      if (!element) throw new Error("Element matching text was not found.");
      highlightElement(element);
      element.click();
      return { ok: true, detail: "Clicked matching element by text." };
    }

    if (action.type === "wait_for_selector") {
      const timeoutMs = action.timeoutMs || 10000;
      const startedAt = Date.now();
      while (Date.now() - startedAt < timeoutMs) {
        const found = safeQuery(action.selector);
        if (found) {
          highlightElement(found);
          return { ok: true, detail: `Selector appeared: ${action.selector}.` };
        }
        await new Promise((resolve) => setTimeout(resolve, 250));
      }
      throw new Error(`Timed out waiting for selector ${action.selector}.`);
    }

    if (action.type === "open_menu_then_click") {
      const menuElement = safeQuery(action.menuSelector);
      if (!menuElement) throw new Error("Menu selector not found.");
      highlightElement(menuElement);
      menuElement.click();
      await new Promise((resolve) => setTimeout(resolve, action.waitMs || 800));
      return executeAction({
        type: "click_selector",
        selector: action.targetSelector
      });
    }

    if (action.type === "highlight_selector") {
      const element = safeQuery(action.selector);
      if (!element) throw new Error(`Selector not found: ${action.selector}`);
      highlightElement(element);
      return { ok: true, detail: `Highlighted ${action.selector}.` };
    }

    if (action.type === "manual_only") {
      return { ok: true, detail: action.message || "Manual action required." };
    }

    if (action.type === "read_attribute") {
      const element = safeQuery(action.selector);
      if (!element) throw new Error(`Selector not found: ${action.selector}`);
      const value = element.getAttribute(action.attribute);
      if (!value) throw new Error(`Attribute ${action.attribute} was empty.`);
      return {
        ok: true,
        detail: `Read attribute ${action.attribute}.`,
        extractedValue: value
      };
    }

    if (action.type === "scan_iframes") {
      const frames = Array.from(document.querySelectorAll("iframe"));
      for (const frame of frames) {
        try {
          const bodyText = frame.contentDocument?.body?.innerText || "";
          if ((action.texts || []).some((needle) => bodyText.toLowerCase().includes(String(needle).toLowerCase()))) {
            highlightElement(frame);
            return { ok: true, detail: "Matching iframe found." };
          }
        } catch {
          continue;
        }
      }
      throw new Error("No matching iframe content was accessible.");
    }

    if (action.type === "multi_step_sequence") {
      let lastResult = null;
      for (const step of action.steps || []) {
        lastResult = await executeAction(step);
        if (step.waitMs) {
          await new Promise((resolve) => setTimeout(resolve, step.waitMs));
        }
      }
      return lastResult || { ok: true, detail: "Sequence completed." };
    }

    throw new Error(`Unsupported action type: ${action.type}`);
  }

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === MESSAGE_TYPES.ANALYZE_CURRENT_TAB) {
      analyzePage("manual").then(() => sendResponse({ ok: true }));
      return true;
    }

    if (message?.type === MESSAGE_TYPES.EXECUTE_PORTAL_ACTION) {
      executeAction(message.payload?.action)
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    return false;
  });

  const debouncedAnalyze = debounce(() => analyzePage("automatic"), PORTAL_SCAN_DEBOUNCE_MS);
  debouncedAnalyze();

  const observer = new MutationObserver(() => debouncedAnalyze());
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true
  });

  setInterval(() => {
    if (location.href !== lastHref) {
      lastHref = location.href;
      debouncedAnalyze();
    }
  }, URL_CHANGE_POLL_MS);
})(typeof globalThis !== "undefined" ? globalThis : self);
