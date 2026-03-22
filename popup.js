(function initPopup(globalScope) {
  const root = globalScope.WISMED = globalScope.WISMED || {};
  const { MESSAGE_TYPES } = root.CONSTANTS;

  const nodes = {
    linkCard: document.getElementById("link-card"),
    linkIcon: document.getElementById("link-icon"),
    linkTitle: document.getElementById("link-title"),
    linkDetail: document.getElementById("link-detail"),
    linkMeta: document.getElementById("link-meta"),
    uploadCard: document.getElementById("upload-card"),
    uploadIcon: document.getElementById("upload-icon"),
    uploadTitle: document.getElementById("upload-title"),
    uploadDetail: document.getElementById("upload-detail"),
    uploadError: document.getElementById("upload-error"),
    progressFill: document.getElementById("upload-progress-fill"),
    autoMode: document.getElementById("auto-mode"),
    activeLabel: document.getElementById("active-label"),
    retryButton: document.getElementById("retry-button")
  };

  let lastState = null;
  let progressTimer = null;
  const FLOW_RUNNING_STATUSES = new Set([
    "download_in_progress",
    "upload_in_progress",
    "upload_success",
    "error"
  ]);

  function callBackground(type, payload) {
    return chrome.runtime.sendMessage({ type, payload });
  }

  function setCardState(card, state) {
    card.classList.remove("status-card--standby", "status-card--tracking", "status-card--success", "status-card--error");
    card.classList.add(`status-card--${state}`);
  }

  function maskLong(value) {
    if (!value) return "-";
    if (value.length <= 30) return value;
    return `${value.slice(0, 16)}...${value.slice(-10)}`;
  }

  function formatMb(value) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  function resetIconSize(icon) {
    icon.style.height = "";
    icon.style.width = "";
    icon.style.maxHeight = "";
    icon.style.maxWidth = "";
  }

  function applyFinalizedIconSizes() {
    const targets = [
      { card: nodes.linkCard, icon: nodes.linkIcon },
      { card: nodes.uploadCard, icon: nodes.uploadIcon }
    ];

    for (const target of targets) {
      const cardHeight = Math.floor(target.card.getBoundingClientRect().height);
      const iconHeight = Math.max(40, Math.floor(cardHeight * 0.5));
      target.icon.style.height = `${iconHeight}px`;
      target.icon.style.width = "auto";
      target.icon.style.maxHeight = "90%";
      target.icon.style.maxWidth = "100%";
    }
  }

  function getDownloadProgressText(state) {
    const info = state.lastDownloadInfo;
    if (!info) {
      return "Download detectado. Aguardando finalizar.";
    }
    if (typeof info.bytesReceived === "number" && typeof info.totalBytes === "number" && info.totalBytes > 0) {
      const pct = Math.max(0, Math.min(100, Math.round((info.bytesReceived / info.totalBytes) * 100)));
      return `Baixando ${pct}% (${formatMb(info.bytesReceived)} de ${formatMb(info.totalBytes)}).`;
    }
    if (typeof info.bytesReceived === "number" && info.bytesReceived > 0) {
      return `Baixando... ${formatMb(info.bytesReceived)} recebidos.`;
    }
    return "Download detectado. Aguardando finalizar.";
  }

  function updateProgress(state) {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }

    if (state.extensionStatus !== "upload_in_progress" || !state.pendingUploadContext) {
      nodes.progressFill.style.width = "0%";
      return;
    }

    const startedAt = Number(state.pendingUploadContext.startedAt) || Date.now();
    const durationMs = Number(state.pendingUploadContext.durationMs) || 3000;

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const progress = Math.max(0, Math.min(100, Math.round((elapsed / durationMs) * 100)));
      nodes.progressFill.style.width = `${progress}%`;
    };

    tick();
    progressTimer = setInterval(tick, 120);
  }

  function renderLinkCard(state) {
    const flowRunning = FLOW_RUNNING_STATUSES.has(state.extensionStatus);
    if (!state.autoModeEnabled && !flowRunning) {
      setCardState(nodes.linkCard, "standby");
      nodes.linkIcon.src = "correct-icon.svg";
      nodes.linkTitle.textContent = "Standby";
      nodes.linkDetail.textContent = "Extensão inativa.";
      nodes.linkMeta.textContent = "";
      return;
    }

    if (state.uploadUrl && state.uploadToken) {
      setCardState(nodes.linkCard, "success");
      nodes.linkIcon.src = "correct-icon.svg";
      nodes.linkTitle.textContent = "Link capturado";
      nodes.linkDetail.textContent = "Link e token capturados com sucesso.";
      nodes.linkMeta.textContent = `url: ${maskLong(state.uploadUrl)} | token: ${maskLong(state.uploadToken)}`;
      return;
    }

    setCardState(nodes.linkCard, "tracking");
    nodes.linkIcon.src = "correct-icon.svg";
    nodes.linkTitle.textContent = "Rastreando";
    nodes.linkDetail.textContent = "Procurando link e token no portal da empresa.";
    nodes.linkMeta.textContent = "";
  }

  function renderUploadCard(state) {
    nodes.uploadError.textContent = "";
    nodes.uploadIcon.src = "correct-icon.svg";

    const flowRunning = FLOW_RUNNING_STATUSES.has(state.extensionStatus);
    if (!state.autoModeEnabled && !flowRunning) {
      setCardState(nodes.uploadCard, "standby");
      nodes.uploadTitle.textContent = "Standby";
      nodes.uploadDetail.textContent = "Extensão inativa.";
      return;
    }

    if (state.extensionStatus === "error") {
      setCardState(nodes.uploadCard, "error");
      nodes.uploadIcon.src = "alert-icon.svg";
      nodes.uploadTitle.textContent = "Falha do envio";
      nodes.uploadDetail.textContent = "Verifique a mensagem abaixo.";
      nodes.uploadError.textContent = state.lastError || "Erro não identificado.";
      return;
    }

    if (state.extensionStatus === "upload_in_progress") {
      setCardState(nodes.uploadCard, "tracking");
      nodes.uploadTitle.textContent = "Enviando";
      nodes.uploadDetail.textContent = "Simulação de upload em andamento.";
      return;
    }

    if (state.extensionStatus === "upload_success" || state.lastUploadResult?.status === "success") {
      setCardState(nodes.uploadCard, "success");
      nodes.uploadTitle.textContent = "Processo finalizado";
      nodes.uploadDetail.textContent = "Processo finalizado. Exame enviado";
      return;
    }

    if (state.extensionStatus === "download_in_progress") {
      setCardState(nodes.uploadCard, "tracking");
      nodes.uploadTitle.textContent = "Baixando";
      nodes.uploadDetail.textContent = getDownloadProgressText(state);
      return;
    }

    setCardState(nodes.uploadCard, "tracking");
    nodes.uploadTitle.textContent = "Rastreando";
    nodes.uploadDetail.textContent = "Aguardando download DICOM.";
  }

  function renderState(state) {
    lastState = state;
    nodes.autoMode.checked = Boolean(state.autoModeEnabled);
    const flowRunning = FLOW_RUNNING_STATUSES.has(state.extensionStatus);
    nodes.activeLabel.textContent = state.autoModeEnabled
      ? "Extensão ativa"
      : (flowRunning ? "Rastreio pausado" : "Extensão inativa");
    if (state.extensionStatus === "error") {
      nodes.retryButton.hidden = false;
      nodes.retryButton.textContent = "Tentar novamente";
    } else if (state.extensionStatus === "upload_success") {
      nodes.retryButton.hidden = false;
      nodes.retryButton.textContent = "Reset rastreio";
    } else {
      nodes.retryButton.hidden = true;
    }
    renderLinkCard(state);
    renderUploadCard(state);
    if (state.extensionStatus === "upload_success") {
      applyFinalizedIconSizes();
    } else {
      resetIconSize(nodes.linkIcon);
      resetIconSize(nodes.uploadIcon);
    }
    updateProgress(state);
  }

  async function refresh() {
    const state = await callBackground(MESSAGE_TYPES.GET_STATE);
    renderState(state);
  }

  nodes.autoMode.addEventListener("change", async () => {
    await callBackground(MESSAGE_TYPES.TOGGLE_AUTO_MODE, {
      enabled: nodes.autoMode.checked
    });
    await refresh();
  });

  nodes.retryButton.addEventListener("click", async () => {
    if (lastState?.extensionStatus === "error") {
      await callBackground(MESSAGE_TYPES.CLEAR_STATE);
    } else if (lastState?.extensionStatus === "upload_success") {
      await callBackground(MESSAGE_TYPES.TOGGLE_AUTO_MODE, { enabled: false });
    }
    await refresh();
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === MESSAGE_TYPES.STATE_UPDATED) {
      renderState(message.payload);
    }
  });

  window.addEventListener("beforeunload", () => {
    if (progressTimer) {
      clearInterval(progressTimer);
    }
  });

  window.addEventListener("resize", () => {
    if (lastState?.extensionStatus === "upload_success") {
      applyFinalizedIconSizes();
    }
  });

  refresh().catch(() => {
    if (lastState) {
      renderState(lastState);
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
