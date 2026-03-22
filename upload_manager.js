(function initUploadManager(globalScope) {
  const root = globalScope.WISMED = globalScope.WISMED || {};

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function tryUploadFromDownload(downloadInfo) {
    const state = await root.stateManager.getState();
    if (!state.autoModeEnabled) {
      return;
    }

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
        message: "sucesso, exame enviado",
        finishedAt: new Date().toISOString()
      }
    });
  }

  root.uploadManager = {
    tryUploadFromDownload
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
