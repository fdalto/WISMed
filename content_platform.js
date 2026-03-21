(function initPlatformContentScript(globalScope) {
  const root = globalScope.WISMED;
  const { COMPANY_HOST_PATTERNS, MESSAGE_TYPES } = root.CONSTANTS;
  const { isValidHttpUrl, debounce } = root.domUtils;

  function isCompanyHost() {
    return COMPANY_HOST_PATTERNS.some((pattern) => location.hostname.includes(pattern));
  }

  function extractUploadUrl() {
    const directNode = document.querySelector("#upload-config[data-upload-url]");
    if (directNode) {
      return directNode.getAttribute("data-upload-url");
    }

    const jsonNode = document.querySelector("#ext-config[type='application/json']");
    if (jsonNode) {
      try {
        const parsed = JSON.parse(jsonNode.textContent);
        if (parsed && parsed.uploadUrl) {
          return parsed.uploadUrl;
        }
      } catch {
        return null;
      }
    }

    const genericNode = document.querySelector("[data-upload-url], [data-uploadurl]");
    if (genericNode) {
      return genericNode.getAttribute("data-upload-url") || genericNode.getAttribute("data-uploadurl");
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
        return codeValue;
      }
    }

    const codeCandidates = Array.from(document.querySelectorAll("code"))
      .map((node) => node.textContent?.trim())
      .filter(Boolean);

    const matchingCode = codeCandidates.find((value) => /\/upload\/[a-z0-9-]+/i.test(value));
    if (matchingCode) {
      return matchingCode;
    }

    const textMatch = document.body && document.body.innerText.match(/https?:\/\/[^\s"'<>]+\/upload\/[^\s"'<>]+/i);
    return textMatch ? textMatch[0] : null;
  }

  const scan = debounce(() => {
    if (!isCompanyHost()) {
      return;
    }

    const uploadUrl = extractUploadUrl();
    if (!isValidHttpUrl(uploadUrl)) {
      chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.PLATFORM_STATUS,
        payload: {
          platformDetected: true,
          uploadUrl: null
        }
      }).catch(() => {});
      return;
    }

    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.PLATFORM_UPLOAD_URL_FOUND,
      payload: {
        uploadUrl,
        sourceUrl: location.href
      }
    }).catch(() => {});
  }, 500);

  if (isCompanyHost()) {
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true
    });
  }
})(typeof globalThis !== "undefined" ? globalThis : self);
