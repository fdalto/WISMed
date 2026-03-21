(function initPortalContentScript(globalScope) {
  const root = globalScope.WISMED;
  const { MESSAGE_TYPES, PORTAL_SCAN_DEBOUNCE_MS, URL_CHANGE_POLL_MS } = root.CONSTANTS;
  const { collectVisibleText, findByText, highlightElement, applyPulsingHalo, debounce, safeQuery } = root.domUtils;

  let lastHref = location.href;
  let lastAnalysisFingerprint = "";
  let autoDownloadTriggeredHref = null;

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

  function extractExamRows() {
    const table = document.querySelector("#ctl00_ContentPlaceHolderConteudo_GV_Pacientes");
    if (!table) {
      return [];
    }

    const rows = Array.from(table.querySelectorAll("tr")).slice(1);
    return rows.map((row, index) => {
      const cells = row.querySelectorAll("td");
      const imageButton = row.querySelector("input[title='Exame de Imagem']");
      const dateText = cells[1]?.textContent?.trim() || null;
      const descriptionText = cells[2]?.textContent?.trim() || null;
      return {
        rowIndex: index,
        date: dateText,
        description: descriptionText,
        imageButtonName: imageButton?.getAttribute("name") || null,
        imageButtonTitle: imageButton?.getAttribute("title") || null
      };
    }).filter((entry) => entry.date || entry.description);
  }

  function extractDownloadLinks() {
    return Array.from(document.querySelectorAll("a[href]"))
      .map((link) => {
        const text = (link.textContent || "").trim();
        const href = link.getAttribute("href") || "";
        return {
          text,
          href,
          download: link.getAttribute("download") || null
        };
      })
      .filter((entry) => entry.href.includes("/package/") || /baixar/i.test(entry.text));
  }

  function findAuroraDownloadTrigger() {
    return document.querySelector(".downloadToolsItem") || null;
  }

  function findAuroraExplicitDicomLink() {
    return Array.from(document.querySelectorAll("a[href]")).find((link) => {
      const text = (link.textContent || "").trim().toLowerCase();
      const href = link.getAttribute("href") || "";
      return text.includes("baixar todas as séries - zip dcm")
        || text.includes("baixar todas as series - zip dcm")
        || (href.includes("/package/") && href.includes("type=DICOM"));
    }) || null;
  }

  function guideUserToImageButton() {
    const imageButtons = Array.from(document.querySelectorAll("input[title='Exame de Imagem']"));
    if (!imageButtons.length) {
      return false;
    }
    imageButtons.forEach((button) => applyPulsingHalo(button));
    return true;
  }

  function handleAuroraDownloadFlow() {
    const explicitLink = findAuroraExplicitDicomLink();
    if (!explicitLink) {
      const trigger = findAuroraDownloadTrigger();
      if (trigger) {
        applyPulsingHalo(trigger, 10000);
      }
      return false;
    }

    applyPulsingHalo(explicitLink, 10000);

    const href = explicitLink.href;
    if (href && autoDownloadTriggeredHref !== href) {
      autoDownloadTriggeredHref = href;
      window.location.href = href;
      return true;
    }

    return false;
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
      examRows: extractExamRows(),
      downloadLinks: extractDownloadLinks(),
      error,
      timestamp: new Date().toISOString()
    };

    if (result.vendor?.id === "pixeonkorus") {
      guideUserToImageButton();
    }

    if (result.vendor?.id === "aurora-pacs") {
      handleAuroraDownloadFlow();
    }

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

    if (action.type === "pulse_halo_selector") {
      const elements = Array.from(document.querySelectorAll(action.selector));
      if (!elements.length) throw new Error(`Selector not found: ${action.selector}`);
      elements.forEach((element) => applyPulsingHalo(element, action.durationMs || 8000));
      return { ok: true, detail: `Applied pulsing halo to ${elements.length} element(s).` };
    }

    if (action.type === "click_selector_all") {
      const elements = Array.from(document.querySelectorAll(action.selector));
      if (!elements.length) throw new Error(`Selector not found: ${action.selector}`);
      elements.forEach((element) => element.click());
      return { ok: true, detail: `Clicked ${elements.length} element(s).` };
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
