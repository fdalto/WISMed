(function initDownloadManager(globalScope) {
  const root = globalScope.WISMED = globalScope.WISMED || {};
  let listenersInstalled = false;

  function normalizeDownloadItem(item) {
    return {
      id: item.id,
      filename: item.filename || null,
      finalUrl: item.finalUrl || item.url || null,
      mime: item.mime || null,
      state: item.state || "unknown",
      exists: typeof item.exists === "boolean" ? item.exists : null,
      fileSize: item.fileSize || null,
      startTime: item.startTime || null,
      endTime: item.endTime || null
    };
  }

  async function handleDownloadCreated(item) {
    const state = await root.stateManager.getState();
    if (!state.autoModeEnabled) {
      return;
    }

    const downloadInfo = normalizeDownloadItem(item);
    await root.stateManager.setState({
      extensionStatus: "download_in_progress",
      lastDownloadInfo: downloadInfo,
      lastError: null
    });
  }

  async function handleDownloadChanged(delta) {
    const state = await root.stateManager.getState();
    if (!state.autoModeEnabled) {
      return;
    }

    if (!delta.state || delta.state.current !== "complete") {
      if (delta.error?.current) {
        await root.stateManager.setState({
          extensionStatus: "error",
          lastError: `Download failed: ${delta.error.current}`
        });
      }
      return;
    }

    const [item] = await chrome.downloads.search({ id: delta.id });
    if (!item) {
      return;
    }

    const downloadInfo = normalizeDownloadItem(item);
    await root.stateManager.setState({
      extensionStatus: "tracking",
      lastDownloadInfo: downloadInfo
    });

    try {
      await root.uploadManager.tryUploadFromDownload(downloadInfo);
    } catch (error) {
      await root.stateManager.setState({
        extensionStatus: "error",
        lastError: error.message
      });
    }
  }

  function installListeners() {
    if (listenersInstalled) {
      return;
    }
    chrome.downloads.onCreated.addListener(handleDownloadCreated);
    chrome.downloads.onChanged.addListener(handleDownloadChanged);
    listenersInstalled = true;
  }

  root.downloadManager = {
    installListeners
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
