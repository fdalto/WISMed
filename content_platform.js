(function initPlatformContentScript(globalScope) {
  const root = globalScope.WISMED;
  const { COMPANY_HOST_PATTERNS, MESSAGE_TYPES, STORAGE_KEYS } = root.CONSTANTS;
  const { isValidHttpUrl, debounce } = root.domUtils;
  let extensionActive = true;

  function isCompanyHost() {
    return COMPANY_HOST_PATTERNS.some((pattern) => location.hostname.includes(pattern));
  }

  function refreshActiveState() {
    chrome.storage.local.get([STORAGE_KEYS.autoModeEnabled], (stored) => {
      extensionActive = stored[STORAGE_KEYS.autoModeEnabled] !== false;
    });
  }

  function extractCredentials() {
    const directUrlNode = document.getElementById("data-upload-url");
    const directTokenNode = document.getElementById("data-upload-token");
    const directUrl = directUrlNode?.textContent?.trim() || null;
    const directToken = directTokenNode?.textContent?.trim() || null;
    if (directUrl || directToken) {
      return {
        uploadUrl: directUrl,
        uploadToken: directToken
      };
    }

    const directNode = document.querySelector("#upload-config[data-upload-url]");
    if (directNode) {
      return {
        uploadUrl: directNode.getAttribute("data-upload-url"),
        uploadToken: null
      };
    }

    const jsonNode = document.querySelector("#ext-config[type='application/json']");
    if (jsonNode) {
      try {
        const parsed = JSON.parse(jsonNode.textContent);
        if (parsed && parsed.uploadUrl) {
          return {
            uploadUrl: parsed.uploadUrl,
            uploadToken: parsed.uploadToken || null
          };
        }
      } catch {
        return { uploadUrl: null, uploadToken: null };
      }
    }

    const genericNode = document.querySelector("[data-upload-url], [data-uploadurl]");
    if (genericNode) {
      return {
        uploadUrl: genericNode.getAttribute("data-upload-url") || genericNode.getAttribute("data-uploadurl"),
        uploadToken: null
      };
    }

    const labeledCards = Array.from(document.querySelectorAll("p, span, div")).filter((node) => {
      const text = (node.textContent || "").trim().toLowerCase();
      return text === "seu link de upload";
    });

    for (const label of labeledCards) {
      const card = label.closest("div");
      const codeNode = card?.querySelector("code");
      const codeValue = codeNode?.textContent?.trim();
      if (codeValue) {
        return {
          uploadUrl: codeValue,
          uploadToken: null
        };
      }
    }

    const codeCandidates = Array.from(document.querySelectorAll("code"))
      .map((node) => node.textContent?.trim())
      .filter(Boolean);

    const matchingCode = codeCandidates.find((value) => /\/upload\/[a-z0-9-]+/i.test(value));
    if (matchingCode) {
      return {
        uploadUrl: matchingCode,
        uploadToken: null
      };
    }

    const textMatch = document.body && document.body.innerText.match(/https?:\/\/[^\s"'<>]+\/upload\/[^\s"'<>]+/i);
    return {
      uploadUrl: textMatch ? textMatch[0] : null,
      uploadToken: null
    };
  }

  const scan = debounce(() => {
    if (!isCompanyHost() || !extensionActive) {
      return;
    }

    const { uploadUrl, uploadToken } = extractCredentials();
    const hasValidUrl = isValidHttpUrl(uploadUrl);
    const hasToken = Boolean(uploadToken);
    if (!hasValidUrl || !hasToken) {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.PLATFORM_STATUS,
        payload: {
          platformDetected: true,
          uploadUrl: hasValidUrl ? uploadUrl : null,
          uploadToken: hasToken ? uploadToken : null
        }
      }).catch(() => {});
      return;
    }

    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.PLATFORM_UPLOAD_CREDENTIALS_FOUND,
      payload: {
        uploadUrl,
        uploadToken,
        sourceUrl: location.href
      }
    }).catch(() => {});
  }, 500);

  if (isCompanyHost()) {
    refreshActiveState();
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== "local" || !changes[STORAGE_KEYS.autoModeEnabled]) {
        return;
      }
      extensionActive = changes[STORAGE_KEYS.autoModeEnabled].newValue !== false;
    });
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
