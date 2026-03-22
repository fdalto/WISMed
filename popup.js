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
    activeLabel: document.getElementById("active-label")
  };

  let lastState = null;
  let progressTimer = null;

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
    if (!state.autoModeEnabled) {
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

    if (!state.autoModeEnabled) {
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
      nodes.uploadTitle.textContent = "Sucesso";
      nodes.uploadDetail.textContent = "sucesso, exame enviado";
      return;
    }

    if (state.extensionStatus === "download_in_progress") {
      setCardState(nodes.uploadCard, "tracking");
      nodes.uploadTitle.textContent = "Baixando";
      nodes.uploadDetail.textContent = "Download detectado. Aguardando finalizar.";
      return;
    }

    setCardState(nodes.uploadCard, "tracking");
    nodes.uploadTitle.textContent = "Rastreando";
    nodes.uploadDetail.textContent = "Aguardando download DICOM.";
  }

  function renderState(state) {
    lastState = state;
    nodes.autoMode.checked = Boolean(state.autoModeEnabled);
    nodes.activeLabel.textContent = state.autoModeEnabled ? "Extensão ativa" : "Extensão inativa";
    renderLinkCard(state);
    renderUploadCard(state);
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

  refresh().catch(() => {
    if (lastState) {
      renderState(lastState);
    }
  });
})(typeof globalThis !== "undefined" ? globalThis : self);
