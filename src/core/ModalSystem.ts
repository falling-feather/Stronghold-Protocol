// v3.19.0：应用内 modal / toast 系统 — 替换 window.alert / confirm 系统弹窗
// 提供两种交互：showToast（自动消失的轻提示）/ showAlert / showConfirm（带按钮的对话框）

type ToastLevel = 'info' | 'success' | 'warn' | 'error';

const TOAST_STACK_ID = 'sp-toast-stack';
const MODAL_HOST_ID = 'sp-modal-host';

function ensureToastStack(): HTMLElement {
  let host = document.getElementById(TOAST_STACK_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = TOAST_STACK_ID;
    document.body.appendChild(host);
  }
  return host;
}

function ensureModalHost(): HTMLElement {
  let host = document.getElementById(MODAL_HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = MODAL_HOST_ID;
    document.body.appendChild(host);
  }
  return host;
}

export function showToast(message: string, opts: { level?: ToastLevel; duration?: number } = {}): void {
  const { level = 'info', duration = 2400 } = opts;
  const stack = ensureToastStack();
  const el = document.createElement('div');
  el.className = `sp-toast sp-toast-${level}`;
  // 支持 \n
  el.innerHTML = message.split('\n').map(l => `<div>${escapeHtml(l)}</div>`).join('');
  stack.appendChild(el);
  // 进入动画
  requestAnimationFrame(() => el.classList.add('sp-toast-in'));
  // 退出
  setTimeout(() => {
    el.classList.remove('sp-toast-in');
    el.classList.add('sp-toast-out');
    setTimeout(() => el.remove(), 260);
  }, duration);
}

interface DialogButton {
  label: string;
  value: any;
  variant?: 'primary' | 'danger' | 'ghost';
}

interface DialogOpts {
  title: string;
  body: string; // 支持 \n
  buttons: DialogButton[];
}

function showDialog<T>(opts: DialogOpts): Promise<T> {
  const host = ensureModalHost();
  return new Promise<T>(resolve => {
    const mask = document.createElement('div');
    mask.className = 'sp-modal-mask';
    const panel = document.createElement('div');
    panel.className = 'sp-modal-panel';
    const header = document.createElement('div');
    header.className = 'sp-modal-title';
    header.textContent = opts.title;
    const body = document.createElement('div');
    body.className = 'sp-modal-body';
    body.innerHTML = opts.body.split('\n').map(l => `<div>${escapeHtml(l)}</div>`).join('');
    const actions = document.createElement('div');
    actions.className = 'sp-modal-actions';
    opts.buttons.forEach(btn => {
      const b = document.createElement('button');
      b.className = `sp-modal-btn sp-modal-btn-${btn.variant ?? 'primary'}`;
      b.textContent = btn.label;
      b.addEventListener('click', () => {
        cleanup();
        resolve(btn.value as T);
      });
      actions.appendChild(b);
    });
    panel.appendChild(header);
    panel.appendChild(body);
    panel.appendChild(actions);
    mask.appendChild(panel);
    host.appendChild(mask);
    requestAnimationFrame(() => mask.classList.add('sp-modal-in'));
    function cleanup() {
      mask.classList.remove('sp-modal-in');
      mask.classList.add('sp-modal-out');
      setTimeout(() => mask.remove(), 200);
    }
  });
}

export function showAlert(title: string, body: string, btnLabel = '知道了'): Promise<void> {
  return showDialog<void>({
    title, body,
    buttons: [{ label: btnLabel, value: undefined, variant: 'primary' }],
  });
}

export function showConfirm(
  title: string,
  body: string,
  opts: { okLabel?: string; cancelLabel?: string; danger?: boolean } = {},
): Promise<boolean> {
  const { okLabel = '确认', cancelLabel = '取消', danger = false } = opts;
  return showDialog<boolean>({
    title, body,
    buttons: [
      { label: cancelLabel, value: false, variant: 'ghost' },
      { label: okLabel, value: true, variant: danger ? 'danger' : 'primary' },
    ],
  });
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
