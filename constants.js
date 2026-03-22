(function initConstants(globalScope) {
  const root = globalScope.WISMED = globalScope.WISMED || {};

  root.CONSTANTS = {
    COMPANY_HOST_PATTERNS: [
      "wismedreview.lovable.app"
    ],
    REMOTE_RULES_URL: "http://127.0.0.1:5500/cloud_rules.sample.json",
    RULES_CACHE_TTL_MS: 15 * 60 * 1000,
    PORTAL_SCAN_DEBOUNCE_MS: 800,
    URL_CHANGE_POLL_MS: 1200,
    EMBEDDED_FALLBACK_RULES: {
      configVersion: "embedded-2026-03-22",
      global: {
        capture: {
          companyHost: "wismedreview.lovable.app",
          urlSelector: "#data-upload-url",
          tokenSelector: "#data-upload-token"
        },
        keywords: ["dicom", "download", "baixar", "zip", "imagens", "exportar"],
        downloadPriority: {
          preferred: [
            "dicom",
            "zip",
            "exame completo",
            "estudo completo",
            "full study",
            "todas as séries",
            "todas as series"
          ],
          avoid: ["imagem atual", "série atual", "serie atual", "foto", "thumbnail"]
        },
        genericDropdown: {
          triggerSelectors: [
            ".downloadToolsItem",
            "[data-cy='dropDownToolsWrapper']",
            "[class*='DropDownToolsWrapper']"
          ],
          triggerTexts: ["baixar", "download", "export", "dicom", "zip"]
        },
        genericDownload: {
          candidateSelectors: [
            "a[href]",
            "button",
            "[role='button']",
            "input[type='button']",
            "input[type='submit']"
          ],
          actionTexts: ["download", "baixar", "export", "dicom", "zip"],
          minimumScore: 24
        }
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
      standby: "",
      tracking: "ON",
      link_captured: "OK",
      portal_detected: "P",
      vendor_detected: "V",
      download_in_progress: "DL",
      upload_in_progress: "UP",
      upload_success: "OK",
      error: "ERR"
    },
    STATUS_COLORS: {
      standby: "#7a7a7a",
      tracking: "#84cc16",
      link_captured: "#15803d",
      portal_detected: "#16a34a",
      vendor_detected: "#ca8a04",
      download_in_progress: "#ea580c",
      upload_in_progress: "#2563eb",
      upload_success: "#15803d",
      error: "#eab308"
    },
    STORAGE_KEYS: {
      uploadUrl: "uploadUrl",
      uploadToken: "uploadToken",
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
      pendingUploadContext: "pendingUploadContext",
      lastUploadResult: "lastUploadResult"
    },
    DEFAULT_STATE: {
      uploadUrl: null,
      uploadToken: null,
      platformDetected: false,
      rulesVersion: "unloaded",
      activeVendor: null,
      extensionStatus: "tracking",
      lastError: null,
      lastDownloadInfo: null,
      autoModeEnabled: true,
      debugMode: false,
      portalAnalysis: null,
      currentExamRows: [],
      currentDownloadLinks: [],
      currentTabInfo: null,
      pendingUploadContext: null,
      lastUploadResult: null
    },
    MESSAGE_TYPES: {
      PLATFORM_UPLOAD_CREDENTIALS_FOUND: "PLATFORM_UPLOAD_CREDENTIALS_FOUND",
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
