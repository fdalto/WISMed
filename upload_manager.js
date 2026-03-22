(function initUploadManager(globalScope) {
  const root = globalScope.WISMED = globalScope.WISMED || {};

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function revealResultToUser() {
    try {
      if (chrome.action && typeof chrome.action.openPopup === "function") {
        await chrome.action.openPopup();
        return;
      }
    } catch {
      // Ignora e usa fallback para aba dedicada.
    }

    try {
      await chrome.tabs.create({
        url: chrome.runtime.getURL("popup.html"),
        active: true
      });
    } catch {
      // Se nao for possivel abrir, mantem apenas estado visual no badge/popup manual.
    }
  }

  async function tryUploadFromDownload(downloadInfo) {
    const state = await root.stateManager.getState();
    if (!state.uploadUrl || !state.uploadToken) {
      const message = "Link/token de upload não capturados no portal da empresa.";
      await root.stateManager.setState({
        extensionStatus: "error",
        lastError: message,
        lastUploadResult: {
          status: "error",
          message,
          finishedAt: new Date().toISOString()
        }
      });
      throw new Error(message);
    }

    const durationMs = 3000;
    await root.stateManager.setState({
      extensionStatus: "upload_in_progress",
      pendingUploadContext: {
        uploadUrl: state.uploadUrl,
        uploadToken: state.uploadToken,
        downloadId: downloadInfo.id,
        startedAt: Date.now(),
        durationMs
      },
      lastUploadResult: null,
      lastError: null
    });

    await sleep(durationMs);

    await root.stateManager.setState({
      extensionStatus: "upload_success",
      pendingUploadContext: null,
      lastError: null,
      lastUploadResult: {
        status: "success",
        message: "Processo finalizado. Exame enviado",
        finishedAt: new Date().toISOString()
      }
    });

    await revealResultToUser();
  }

  root.uploadManager = {
    tryUploadFromDownload
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
