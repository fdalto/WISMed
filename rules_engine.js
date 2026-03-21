(function initRulesEngine(globalScope) {
  const root = globalScope.WISMED = globalScope.WISMED || {};
  const {
    STORAGE_KEYS,
    RULES_CACHE_TTL_MS,
    REMOTE_RULES_URL,
    EMBEDDED_FALLBACK_RULES
  } = root.CONSTANTS;

  function normalizeText(value) {
    return String(value || "").toLowerCase();
  }

  function includesAny(haystack, needles) {
    return (needles || []).some((needle) => haystack.includes(normalizeText(needle)));
  }

  function validateRulesPayload(payload) {
    if (!payload || typeof payload !== "object") {
      throw new Error("Remote rules payload is invalid.");
    }
    if (!Array.isArray(payload.vendors)) {
      throw new Error("Remote rules payload must contain a vendors array.");
    }
    return {
      configVersion: payload.configVersion || "unknown",
      global: payload.global || { keywords: [] },
      vendors: payload.vendors
        .filter((vendor) => vendor && vendor.id && vendor.detect && Array.isArray(vendor.actions))
        .sort((a, b) => (b.priority || 0) - (a.priority || 0))
    };
  }

  async function getCachedRules() {
    const stored = await chrome.storage.local.get([
      STORAGE_KEYS.rulesCache,
      STORAGE_KEYS.lastRulesSyncAt
    ]);
    if (!stored[STORAGE_KEYS.rulesCache] || !stored[STORAGE_KEYS.lastRulesSyncAt]) {
      return null;
    }
    const age = Date.now() - stored[STORAGE_KEYS.lastRulesSyncAt];
    if (age > RULES_CACHE_TTL_MS) {
      return null;
    }
    return stored[STORAGE_KEYS.rulesCache];
  }

  async function loadRemoteRules(forceReload) {
    if (!forceReload) {
      const cached = await getCachedRules();
      if (cached) {
        return cached;
      }
    }

    try {
      const response = await fetch(REMOTE_RULES_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Rules request failed with status ${response.status}.`);
      }

      const payload = validateRulesPayload(await response.json());
      await chrome.storage.local.set({
        [STORAGE_KEYS.rulesCache]: payload,
        [STORAGE_KEYS.lastRulesSyncAt]: Date.now(),
        [STORAGE_KEYS.rulesVersion]: payload.configVersion
      });
      return payload;
    } catch (error) {
      if (REMOTE_RULES_URL.includes("example.com")) {
        return EMBEDDED_FALLBACK_RULES;
      }
      throw error;
    }
  }

  function scoreVendor(vendor, context) {
    let score = 0;
    const hostname = normalizeText(context.hostname);
    const path = normalizeText(context.pathname);
    const pageText = normalizeText(context.pageText);
    const scriptSources = (context.scriptSources || []).map(normalizeText);

    if (includesAny(hostname, vendor.detect.hostnameContains)) score += 40;
    if (includesAny(path, vendor.detect.pathContains)) score += 20;
    if (includesAny(pageText, vendor.detect.textContainsAny)) score += 15;

    for (const src of scriptSources) {
      if (includesAny(src, vendor.detect.scriptSrcContains)) {
        score += 15;
        break;
      }
    }

    const selectorMatches = (vendor.detect.selectorExists || []).filter((selector) => {
      try {
        return context.document.querySelector(selector);
      } catch {
        return false;
      }
    });
    score += selectorMatches.length * 10;

    return score;
  }

  function detectVendor(rules, context) {
    if (!rules || !rules.vendors || !context || !context.document) {
      return null;
    }

    const candidates = rules.vendors
      .map((vendor) => ({ vendor, score: scoreVendor(vendor, context) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score);

    return candidates.length ? candidates[0] : null;
  }

  root.rulesEngine = {
    loadRemoteRules,
    detectVendor
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
