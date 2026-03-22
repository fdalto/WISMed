importScripts(
  "constants.js",
  "state_manager.js",
  "rules_engine.js",
  "upload_manager.js",
  "download_manager.js"
);

(function initServiceWorker(globalScope) {
  const root = globalScope.WISMED;
  const { MESSAGE_TYPES, STATUS_COLORS, BADGE_TEXT } = root.CONSTANTS;

  function getEffectiveStatus(state) {
    if (!state.autoModeEnabled) {
      return "standby";
    }
    return state.extensionStatus || "tracking";
  }

  async function updateBadge(status) {
    await chrome.action.setBadgeBackgroundColor({
      color: STATUS_COLORS[status] || STATUS_COLORS.standby
    });
    await chrome.action.setBadgeText({
      text: BADGE_TEXT[status] || ""
    });
  }

  async function syncVisualState() {
    const state = await root.stateManager.getState();
    await updateBadge(getEffectiveStatus(state));
  }

  async function handlePlatformUpload(payload) {
    const state = await root.stateManager.getState();
    if (!state.autoModeEnabled) {
      return;
    }

    await root.stateManager.setState({
      uploadUrl: payload.uploadUrl,
      uploadToken: payload.uploadToken || null,
      platformDetected: true,
      extensionStatus: "link_captured",
      lastError: null
    });
    await syncVisualState();
  }

  async function handlePlatformStatus(payload) {
    const state = await root.stateManager.getState();
    if (!state.autoModeEnabled) {
      return;
    }

    await root.stateManager.setState({
      platformDetected: payload.platformDetected,
      extensionStatus: payload.uploadUrl && payload.uploadToken ? "link_captured" : "tracking"
    });
    await syncVisualState();
  }

  async function handlePortalAnalysis(payload) {
    const state = await root.stateManager.getState();
    if (!state.autoModeEnabled) {
      return;
    }

    const partialState = {
      portalAnalysis: payload,
      currentTabInfo: {
        url: payload.pageUrl,
        hostname: payload.hostname,
        title: payload.title
      },
      currentExamRows: payload.examRows || [],
      currentDownloadLinks: payload.downloadLinks || [],
      rulesVersion: payload.rulesVersion || "unknown",
      lastError: payload.error || null,
      extensionStatus: payload.error
        ? "error"
        : payload.vendor
          ? "vendor_detected"
          : "tracking",
      activeVendor: payload.vendor
        ? {
            id: payload.vendor.id,
            name: payload.vendor.name,
            score: payload.vendor.score
          }
        : null
    };
    await root.stateManager.setState(partialState);
    await syncVisualState();
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab || null;
  }

  async function sendMessageToActiveTab(message) {
    const state = await root.stateManager.getState();
    if (!state.autoModeEnabled) {
      throw new Error("Extensão inativa. Ative para rastrear e executar ações.");
    }

    const tab = await getActiveTab();
    if (!tab?.id) {
      throw new Error("No active tab found.");
    }
    try {
      return await chrome.tabs.sendMessage(tab.id, message);
    } catch {
      throw new Error("No compatible content script is active in the current tab.");
    }
  }

  chrome.runtime.onInstalled.addListener(async () => {
    await root.stateManager.setState(root.CONSTANTS.DEFAULT_STATE);
    await syncVisualState();
    root.downloadManager.installListeners();
  });

  chrome.runtime.onStartup.addListener(async () => {
    await syncVisualState();
    root.downloadManager.installListeners();
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    (async () => {
      switch (message?.type) {
        case MESSAGE_TYPES.PLATFORM_UPLOAD_CREDENTIALS_FOUND:
        case MESSAGE_TYPES.PLATFORM_UPLOAD_URL_FOUND:
          await handlePlatformUpload(message.payload);
          sendResponse({ ok: true });
          return;
        case MESSAGE_TYPES.PLATFORM_STATUS:
          await handlePlatformStatus(message.payload);
          sendResponse({ ok: true });
          return;
        case MESSAGE_TYPES.PORTAL_ANALYSIS_RESULT:
          await handlePortalAnalysis(message.payload);
          sendResponse({ ok: true });
          return;
        case MESSAGE_TYPES.GET_STATE:
          sendResponse(await root.stateManager.getState());
          return;
        case MESSAGE_TYPES.RELOAD_RULES: {
          const rules = await root.rulesEngine.loadRemoteRules(true);
          await root.stateManager.setState({
            rulesVersion: rules.configVersion,
            lastError: null
          });
          sendResponse({ ok: true, rulesVersion: rules.configVersion });
          return;
        }
        case MESSAGE_TYPES.CLEAR_STATE:
          {
            const state = await root.stateManager.getState();
            await root.stateManager.clearState();
            await root.stateManager.setState({
              autoModeEnabled: state.autoModeEnabled,
              extensionStatus: state.autoModeEnabled ? "tracking" : "standby"
            });
          }
          await syncVisualState();
          sendResponse({ ok: true });
          return;
        case MESSAGE_TYPES.TOGGLE_AUTO_MODE: {
          const state = await root.stateManager.getState();
          const payloadValue = message.payload?.enabled;
          const nextValue = typeof payloadValue === "boolean" ? payloadValue : !state.autoModeEnabled;
          await root.stateManager.setState({
            autoModeEnabled: nextValue,
            extensionStatus: nextValue
              ? ((state.uploadUrl && state.uploadToken) ? "link_captured" : "tracking")
              : "standby"
          });
          sendResponse({ ok: true, autoModeEnabled: nextValue });
          await syncVisualState();
          return;
        }
        case MESSAGE_TYPES.ANALYZE_CURRENT_TAB:
          sendResponse(await sendMessageToActiveTab({ type: MESSAGE_TYPES.ANALYZE_CURRENT_TAB }));
          return;
        case MESSAGE_TYPES.EXECUTE_PORTAL_ACTION: {
          const state = await root.stateManager.getState();
          const action = message.payload?.action
            || state.portalAnalysis?.vendor?.actions?.[0]
            || null;
          if (!action) {
            throw new Error("No action is available for the current vendor.");
          }
          const result = await sendMessageToActiveTab({
            type: MESSAGE_TYPES.EXECUTE_PORTAL_ACTION,
            payload: { action }
          });
          if (!result.ok) {
            throw new Error(result.error || "Portal action failed.");
          }
          sendResponse(result);
          return;
        }
        default:
          sendResponse({ ok: false, error: "Unknown message type." });
      }
    })().catch(async (error) => {
      await root.stateManager.setState({
        extensionStatus: "error",
        lastError: error.message
      });
      await syncVisualState();
      sendResponse({ ok: false, error: error.message });
    });

    return true;
  });

  chrome.tabs.onActivated.addListener(async () => {
    const tab = await getActiveTab();
    if (!tab) {
      return;
    }
    let hostname = null;
    try {
      hostname = tab.url ? new URL(tab.url).hostname : null;
    } catch {
      hostname = null;
    }
    await root.stateManager.setState({
      currentTabInfo: {
        url: tab.url || null,
        hostname,
        title: tab.title || null
      }
    });
  });

  syncVisualState();
  root.downloadManager.installListeners();
})(typeof globalThis !== "undefined" ? globalThis : self);
