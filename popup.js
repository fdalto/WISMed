(function initPopup(globalScope) {
  const root = globalScope.WISMED = globalScope.WISMED || {};
  const { MESSAGE_TYPES } = root.CONSTANTS;

  const nodes = {
    status: document.getElementById("status-pill"),
    uploadUrl: document.getElementById("upload-url"),
    currentDomain: document.getElementById("current-domain"),
    vendorName: document.getElementById("vendor-name"),
    rulesVersion: document.getElementById("rules-version"),
    lastDownload: document.getElementById("last-download"),
    lastError: document.getElementById("last-error"),
    autoMode: document.getElementById("auto-mode"),
    reloadRules: document.getElementById("reload-rules"),
    analyzeTab: document.getElementById("analyze-tab"),
    runAction: document.getElementById("run-action"),
    clearState: document.getElementById("clear-state")
  };

  function maskUrl(url) {
    if (!url) return "not set";
    try {
      const parsed = new URL(url);
      return `${parsed.origin}${parsed.pathname.slice(0, 18)}...`;
    } catch {
      return "invalid";
    }
  }

  function renderState(state) {
    nodes.status.textContent = state.extensionStatus || "idle";
    nodes.uploadUrl.textContent = maskUrl(state.uploadUrl);
    nodes.currentDomain.textContent = state.currentTabInfo?.hostname || "unknown";
    nodes.vendorName.textContent = state.activeVendor?.name || "none";
    nodes.rulesVersion.textContent = state.rulesVersion || "unloaded";
    nodes.lastDownload.textContent = state.lastDownloadInfo?.filename || "none";
    nodes.lastError.textContent = state.lastError || "none";
    nodes.autoMode.checked = Boolean(state.autoModeEnabled);
  }

  async function callBackground(type, payload) {
    return chrome.runtime.sendMessage({ type, payload });
  }

  async function refresh() {
    const state = await callBackground(MESSAGE_TYPES.GET_STATE);
    renderState(state);
  }

  nodes.reloadRules.addEventListener("click", async () => {
    await callBackground(MESSAGE_TYPES.RELOAD_RULES);
    await refresh();
  });

  nodes.analyzeTab.addEventListener("click", async () => {
    await callBackground(MESSAGE_TYPES.ANALYZE_CURRENT_TAB);
    await refresh();
  });

  nodes.runAction.addEventListener("click", async () => {
    await callBackground(MESSAGE_TYPES.EXECUTE_PORTAL_ACTION);
    await refresh();
  });

  nodes.clearState.addEventListener("click", async () => {
    await callBackground(MESSAGE_TYPES.CLEAR_STATE);
    await refresh();
  });

  nodes.autoMode.addEventListener("change", async () => {
    await callBackground(MESSAGE_TYPES.TOGGLE_AUTO_MODE);
    await refresh();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === MESSAGE_TYPES.STATE_UPDATED) {
      renderState(message.payload);
    }
  });

  refresh();
})(typeof globalThis !== "undefined" ? globalThis : self);
