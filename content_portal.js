(function initPortalContentScript(globalScope) {
  const root = globalScope.WISMED;
  const {
    MESSAGE_TYPES,
    PORTAL_SCAN_DEBOUNCE_MS,
    URL_CHANGE_POLL_MS,
    STORAGE_KEYS
  } = root.CONSTANTS;
  const { collectVisibleText, findByText, highlightElement, applyPulsingHalo, debounce, safeQuery } = root.domUtils;

  let lastHref = location.href;
  let lastAnalysisFingerprint = "";
  let autoDownloadTriggeredHref = null;
  let autoDownloadTriggeredPageHref = null;
  let auroraDownloadMenuOpenedHref = null;
  let genericPriorityTriggeredPageHref = null;
  let genericDropdownOpenedPageHref = null;
  let extensionActive = true;
  let autoDownloadCooldownUntil = 0;

  const AUTO_DOWNLOAD_COOLDOWN_MS = 4000;

  function refreshActiveState() {
    chrome.storage.local.get([STORAGE_KEYS.autoModeEnabled], (stored) => {
      extensionActive = stored[STORAGE_KEYS.autoModeEnabled] !== false;
    });
  }

  function isAutoDownloadLocked() {
    return Date.now() < autoDownloadCooldownUntil;
  }

  function lockAutoDownload() {
    autoDownloadCooldownUntil = Date.now() + AUTO_DOWNLOAD_COOLDOWN_MS;
  }

  function isPixeonPatientPage() {
    return /(^|\.)pixeonkorus\.com$/i.test(location.hostname)
      && /^\/Paciente\.aspx$/i.test(location.pathname)
      && new URLSearchParams(location.search).has("ad");
  }

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
      const downloadName = (link.getAttribute("download") || "").trim().toLowerCase();
      return downloadName === "exam_dicom.zip"
        || text.includes("baixar todas as séries - zip dcm")
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

  function guidePixeonPatientImageButtons() {
    if (!isPixeonPatientPage()) {
      return false;
    }

    const imageButtons = Array.from(
      document.querySelectorAll("input[type='image'][title='Exame de Imagem']")
    );
    if (!imageButtons.length) {
      return false;
    }

    imageButtons.forEach((button) => applyPulsingHalo(button, 12000));
    return true;
  }

  function handleAuroraDownloadFlow() {
    if (isAutoDownloadLocked()) {
      return false;
    }

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
      lockAutoDownload();
      window.location.href = href;
      return true;
    }

    return false;
  }

  function handleDirectExamDicomDownload() {
    if (isAutoDownloadLocked()) {
      return false;
    }

    const explicitLink = document.querySelector("a[download='exam_dicom.zip']");
    if (!explicitLink || !explicitLink.href) {
      return false;
    }

    applyPulsingHalo(explicitLink, 10000);

    if (
      autoDownloadTriggeredHref !== explicitLink.href
      && autoDownloadTriggeredPageHref !== location.href
    ) {
      autoDownloadTriggeredHref = explicitLink.href;
      autoDownloadTriggeredPageHref = location.href;
      lockAutoDownload();
      window.location.href = explicitLink.href;
      return true;
    }

    return false;
  }

  function handleAuroraAutoOpenAndDownload() {
    if (isAutoDownloadLocked()) {
      return false;
    }

    const explicitLink = document.querySelector("a[download='exam_dicom.zip']");
    if (explicitLink?.href) {
      return handleDirectExamDicomDownload();
    }

    const trigger = findAuroraDownloadTrigger();
    if (!trigger) {
      return false;
    }

    applyPulsingHalo(trigger, 10000);

    if (auroraDownloadMenuOpenedHref !== location.href) {
      auroraDownloadMenuOpenedHref = location.href;
      lockAutoDownload();
      trigger.click();
      setTimeout(() => {
        handleDirectExamDicomDownload();
      }, 400);
      setTimeout(() => {
        handleDirectExamDicomDownload();
      }, 1000);
      setTimeout(() => {
        handleDirectExamDicomDownload();
      }, 2000);
      return true;
    }

    return false;
  }

  function normalizeText(value) {
    return String(value || "").toLowerCase();
  }

  function getGenericPriorityTerms(rules) {
    const preferred = rules?.global?.downloadPriority?.preferred;
    const avoid = rules?.global?.downloadPriority?.avoid;
    const actionTexts = rules?.global?.genericDownload?.actionTexts;
    const candidateSelectors = rules?.global?.genericDownload?.candidateSelectors;
    const minimumScore = Number(rules?.global?.genericDownload?.minimumScore);
    return {
      preferred: Array.isArray(preferred) && preferred.length
        ? preferred
        : [
            "dicom",
            "zip",
            "exame completo",
            "estudo completo",
            "full study",
            "todas as séries",
            "todas as series",
            "todos"
          ],
      avoid: Array.isArray(avoid) && avoid.length
        ? avoid
        : ["imagem atual", "série atual", "serie atual", "foto", "thumbnail"],
      actionTexts: Array.isArray(actionTexts) && actionTexts.length
        ? actionTexts
        : ["download", "baixar", "export", "dicom", "zip"],
      candidateSelectors: Array.isArray(candidateSelectors) && candidateSelectors.length
        ? candidateSelectors
        : ["a[href]", "button", "[role='button']", "input[type='button']", "input[type='submit']"],
      minimumScore: Number.isFinite(minimumScore) ? minimumScore : 24
    };
  }

  function scoreDownloadCandidate(element, preferredTerms, avoidTerms, actionTexts) {
    const text = normalizeText(element.innerText || element.textContent);
    const href = normalizeText(element.getAttribute("href") || "");
    const download = normalizeText(element.getAttribute("download") || "");
    const title = normalizeText(element.getAttribute("title") || "");
    const aria = normalizeText(element.getAttribute("aria-label") || "");
    const bundle = `${text} ${href} ${download} ${title} ${aria}`;

    let score = 0;
    for (const term of preferredTerms) {
      if (bundle.includes(normalizeText(term))) {
        score += 14;
      }
    }
    for (const term of avoidTerms) {
      if (bundle.includes(normalizeText(term))) {
        score -= 11;
      }
    }

    for (const term of actionTexts) {
      if (bundle.includes(normalizeText(term))) {
        score += 8;
      }
    }
    if (bundle.includes("dicom")) {
      score += 18;
    }
    if (bundle.includes("zip")) {
      score += 12;
    }
    if (bundle.includes("all") || bundle.includes("todas") || bundle.includes("todos")) {
      score += 7;
    }

    return { score, bundle };
  }

  function handleGenericPriorityDownload(rules) {
    if (isAutoDownloadLocked()) {
      return false;
    }

    const { preferred, avoid, actionTexts, candidateSelectors, minimumScore } = getGenericPriorityTerms(rules);
    const candidates = Array.from(
      document.querySelectorAll(candidateSelectors.join(","))
    )
      .map((element) => ({ element, ...scoreDownloadCandidate(element, preferred, avoid, actionTexts) }))
      .filter((entry) => entry.score >= minimumScore)
      .sort((a, b) => b.score - a.score);

    if (!candidates.length) {
      return false;
    }

    const best = candidates[0];
    if (genericPriorityTriggeredPageHref === location.href) {
      return false;
    }

    genericPriorityTriggeredPageHref = location.href;
    lockAutoDownload();
    applyPulsingHalo(best.element, 6000);

    if (typeof best.element.click === "function") {
      best.element.click();
      return true;
    }
    return false;
  }

  function getGenericDropdownConfig(rules) {
    const triggerSelectors = rules?.global?.genericDropdown?.triggerSelectors;
    const triggerTexts = rules?.global?.genericDropdown?.triggerTexts;
    return {
      triggerSelectors: Array.isArray(triggerSelectors) && triggerSelectors.length
        ? triggerSelectors
        : [".downloadToolsItem", "[data-cy='dropDownToolsWrapper']", "[class*='DropDownToolsWrapper']"],
      triggerTexts: Array.isArray(triggerTexts) && triggerTexts.length
        ? triggerTexts
        : ["baixar", "download", "export", "dicom", "zip"]
    };
  }

  function findGenericDropdownTrigger(rules) {
    const { triggerSelectors, triggerTexts } = getGenericDropdownConfig(rules);

    const candidates = Array.from(document.querySelectorAll(triggerSelectors.join(",")));
    return candidates.find((element) => {
      const target = element.closest(".downloadToolsItem") || element;
      const text = normalizeText(target.innerText || target.textContent);
      const hasDropdown = Boolean(
        target.querySelector("[data-cy='dropDownToolsWrapper'], [class*='DropDownToolsWrapper']")
      );
      return hasDropdown && triggerTexts.some((term) => text.includes(normalizeText(term)));
    }) || null;
  }

  function handleGenericDropdownOpen(rules) {
    if (isAutoDownloadLocked()) {
      return false;
    }

    if (genericDropdownOpenedPageHref === location.href) {
      return false;
    }

    const dropdownElement = findGenericDropdownTrigger(rules);
    if (!dropdownElement) {
      return false;
    }

    const target = dropdownElement.closest(".downloadToolsItem") || dropdownElement;
    applyPulsingHalo(target, 6000);
    genericDropdownOpenedPageHref = location.href;
    lockAutoDownload();
    target.click();
    return true;
  }

  async function analyzePage(reason = "automatic") {
    if (!extensionActive) {
      return;
    }

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

    guidePixeonPatientImageButtons();

    if (handleDirectExamDicomDownload()) {
      return;
    }

    if (result.vendor?.id === "aurora-pacs") {
      if (handleAuroraAutoOpenAndDownload()) {
        return;
      }
      handleAuroraDownloadFlow();
    }

    if (handleGenericDropdownOpen(rules)) {
      return;
    }

    if (handleGenericPriorityDownload(rules)) {
      return;
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
    if (!extensionActive) {
      throw new Error("Extensão inativa.");
    }

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
      if (!extensionActive) {
        sendResponse({ ok: false, error: "Extensão inativa." });
        return false;
      }
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
  refreshActiveState();
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !changes[STORAGE_KEYS.autoModeEnabled]) {
      return;
    }
    extensionActive = changes[STORAGE_KEYS.autoModeEnabled].newValue !== false;
  });
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
      autoDownloadTriggeredPageHref = null;
      autoDownloadTriggeredHref = null;
      auroraDownloadMenuOpenedHref = null;
      genericPriorityTriggeredPageHref = null;
      genericDropdownOpenedPageHref = null;
      debouncedAnalyze();
    }
  }, URL_CHANGE_POLL_MS);
})(typeof globalThis !== "undefined" ? globalThis : self);
