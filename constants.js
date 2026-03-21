(function initConstants(globalScope) {
  const root = globalScope.WISMED = globalScope.WISMED || {};

  root.CONSTANTS = {
    COMPANY_HOST_PATTERNS: [
      "wismedreview.lovable.app",
      "localhost"
    ],
    REMOTE_RULES_URL: "https://fdalto.github.io/WISMed/cloud_rules.sample.json",
    RULES_CACHE_TTL_MS: 15 * 60 * 1000,
    PORTAL_SCAN_DEBOUNCE_MS: 800,
    URL_CHANGE_POLL_MS: 1200,
    EMBEDDED_FALLBACK_RULES: {
      configVersion: "embedded-2026-03-20",
      global: {
        keywords: ["dicom", "download", "baixar", "zip", "imagens", "export"]
      },
      vendors: [
        {
          id: "generic-download",
          name: "Generic Download Portal",
          priority: 10,
          detect: {
            hostnameContains: [],
            pathContains: [],
            textContainsAny: ["dicom", "download", "baixar", "export"],
            selectorExists: ["a[href*='zip']", "button", "[download]"],
            scriptSrcContains: []
          },
          actions: [
            {
              type: "click_text",
              texts: ["download", "baixar", "export", "dicom"]
            }
          ],
          manualHint: "Portal generico com botao de download potencial."
        }
      ]
    },
    BADGE_TEXT: {
      idle: "",
      ready: "OK",
      portal_detected: "P",
      vendor_detected: "V",
      download_in_progress: "DL",
      upload_in_progress: "UP",
      error: "ERR"
    },
    STATUS_COLORS: {
      idle: "#7a7a7a",
      ready: "#2563eb",
      portal_detected: "#2563eb",
      vendor_detected: "#ca8a04",
      download_in_progress: "#ea580c",
      upload_in_progress: "#7c3aed",
      error: "#dc2626"
    },
    STORAGE_KEYS: {
      uploadUrl: "uploadUrl",
      platformDetected: "platformDetected",
      rulesVersion: "rulesVersion",
      activeVendor: "activeVendor",
      extensionStatus: "extensionStatus",
      lastError: "lastError",
      lastDownloadInfo: "lastDownloadInfo",
      autoModeEnabled: "autoModeEnabled",
      debugMode: "debugMode",
      rulesCache: "rulesCache",
      lastRulesSyncAt: "lastRulesSyncAt",
      portalAnalysis: "portalAnalysis",
      currentExamRows: "currentExamRows",
      currentDownloadLinks: "currentDownloadLinks",
      currentTabInfo: "currentTabInfo",
      pendingUploadContext: "pendingUploadContext"
    },
    DEFAULT_STATE: {
      uploadUrl: null,
      platformDetected: false,
      rulesVersion: "unloaded",
      activeVendor: null,
      extensionStatus: "idle",
      lastError: null,
      lastDownloadInfo: null,
      autoModeEnabled: false,
      debugMode: false,
      portalAnalysis: null,
      currentExamRows: [],
      currentDownloadLinks: [],
      currentTabInfo: null,
      pendingUploadContext: null
    },
    MESSAGE_TYPES: {
      PLATFORM_UPLOAD_URL_FOUND: "PLATFORM_UPLOAD_URL_FOUND",
      PLATFORM_STATUS: "PLATFORM_STATUS",
      PORTAL_ANALYSIS_RESULT: "PORTAL_ANALYSIS_RESULT",
      EXECUTE_PORTAL_ACTION: "EXECUTE_PORTAL_ACTION",
      EXECUTE_PORTAL_ACTION_RESULT: "EXECUTE_PORTAL_ACTION_RESULT",
      GET_STATE: "GET_STATE",
      STATE_UPDATED: "STATE_UPDATED",
      RELOAD_RULES: "RELOAD_RULES",
      CLEAR_STATE: "CLEAR_STATE",
      TOGGLE_AUTO_MODE: "TOGGLE_AUTO_MODE",
      ANALYZE_CURRENT_TAB: "ANALYZE_CURRENT_TAB",
      TAB_CONTEXT_UPDATED: "TAB_CONTEXT_UPDATED"
    }
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
