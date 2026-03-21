(function initStateManager(globalScope) {
  const root = globalScope.WISMED = globalScope.WISMED || {};
  const { STORAGE_KEYS, DEFAULT_STATE } = root.CONSTANTS;

  function read(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, resolve);
    });
  }

  function write(values) {
    return new Promise((resolve) => {
      chrome.storage.local.set(values, resolve);
    });
  }

  function remove(keys) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(keys, resolve);
    });
  }

  async function getState() {
    const stored = await read(Object.values(STORAGE_KEYS));
    return { ...DEFAULT_STATE, ...stored };
  }

  async function setState(partialState) {
    await write(partialState);
    const nextState = await getState();
    chrome.runtime.sendMessage({
      type: root.CONSTANTS.MESSAGE_TYPES.STATE_UPDATED,
      payload: nextState
    }).catch(() => {});
    return nextState;
  }

  async function clearState() {
    await remove(Object.values(STORAGE_KEYS));
    return setState(DEFAULT_STATE);
  }

  root.stateManager = {
    getState,
    setState,
    clearState
  };
})(typeof globalThis !== "undefined" ? globalThis : self);
