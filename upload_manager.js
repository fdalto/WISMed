(function initUploadManager(globalScope) {
  const root = globalScope.WISMED = globalScope.WISMED || {};

  async function buildUploadBody(downloadInfo) {
    if (!downloadInfo?.finalUrl || !/^https?:/i.test(downloadInfo.finalUrl)) {
      throw new Error("Chrome completed the download, but no reusable HTTP(S) source URL is available for automatic upload.");
    }

    const response = await fetch(downloadInfo.finalUrl, {
      credentials: "include"
    });
    if (!response.ok) {
      throw new Error(`Failed to refetch downloaded file: ${response.status}.`);
    }

    const blob = await response.blob();
    const fileName = downloadInfo.filename?.split(/[\\/]/).pop() || "exam-download.zip";
    const formData = new FormData();
    formData.append("file", blob, fileName);
    return formData;
  }

  async function tryUploadFromDownload(downloadInfo) {
    const state = await root.stateManager.getState();
    if (!state.uploadUrl) {
      return;
    }

    await root.stateManager.setState({
      extensionStatus: "upload_in_progress",
      pendingUploadContext: {
        uploadUrl: state.uploadUrl,
        downloadId: downloadInfo.id,
        startedAt: new Date().toISOString()
      }
    });

    try {
      const body = await buildUploadBody(downloadInfo);
      const response = await fetch(state.uploadUrl, {
        method: "POST",
        body
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}.`);
      }

      await root.stateManager.setState({
        extensionStatus: "ready",
        pendingUploadContext: null,
        lastError: null
      });
    } catch (error) {
      await root.stateManager.setState({
        extensionStatus: "error",
        lastError: `${error.message} Manual retry may be required depending on PACS authentication and download behavior.`
      });
      throw error;
    }
  }

  root.uploadManager = {
    tryUploadFromDownload
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
