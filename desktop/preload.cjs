const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('reposcopeDesktop', {
  chooseRepository: () => ipcRenderer.invoke('choose-repository'),
  // Synchronous, so the saved theme is known before the page first paints.
  settings: ipcRenderer.sendSync('read-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),
});

// A menu accelerator would take ⌘←/⌘→ from text fields too, where they move the caret.
const HISTORY_MODIFIER = process.platform === 'darwin' ? 'metaKey' : 'altKey';
const OTHER_MODIFIERS = ['metaKey', 'ctrlKey', 'altKey', 'shiftKey'].filter((key) => key !== HISTORY_MODIFIER);
const HISTORY_STEPS = { ArrowLeft: -1, ArrowRight: 1 };
const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit']);

window.addEventListener('keydown', (event) => {
  const step = historyStep(event);
  if (!step || event.defaultPrevented || editsText(event.target)) return;
  event.preventDefault();
  history.go(step);
});

function historyStep(event) {
  if (!event[HISTORY_MODIFIER] || event.repeat || OTHER_MODIFIERS.some((key) => event[key])) return 0;
  return HISTORY_STEPS[event.key] ?? 0;
}

function editsText(target) {
  if (target.isContentEditable || target.tagName === 'TEXTAREA') return true;
  return target.tagName === 'INPUT' && !NON_TEXT_INPUTS.has(target.type);
}
