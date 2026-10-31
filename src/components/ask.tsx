import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';

type Options = {
  /** Big title. Without it, the message is the title. */
  title?: string;
  ok?: string;
  /** false: only the OK button (a notice). */
  cancel?: string | false;
  danger?: boolean;
  /** Shows a text box with this starting value. */
  value?: string;
  placeholder?: string;
};

/**
 * Opens the app's own modal (instead of the browser's prompt/confirm/alert)
 * and resolves with the text typed (or '' without a text box), or null if
 * cancelled.
 */
function open(message: string, options: Options): Promise<string | null> {
  return new Promise((resolve) => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const done = (result: string | null) => {
      // Unmount after the click that closed it has finished, then answer:
      // whatever comes next never sees this modal still on the page.
      setTimeout(() => {
        root.unmount();
        host.remove();
        resolve(result);
      });
    };
    root.render(<AskDialog message={message} options={options} onDone={done} />);
  });
}

/** Text from the user; null if cancelled. Like `prompt()`. */
export const askText = (message: string, value = '', options: Omit<Options, 'value'> = {}) =>
  open(message, { ok: 'Guardar', ...options, value });

/** Yes or no. Like `confirm()`. */
export const askConfirm = (message: string, options: Omit<Options, 'value'> = {}) =>
  open(message, { ok: 'Aceptar', ...options }).then((r) => r !== null);

/** A notice with only "Entendido". Like `alert()`. */
export const tell = (message: string, options: Omit<Options, 'value' | 'cancel'> = {}) =>
  open(message, { ok: 'Entendido', ...options, cancel: false }).then(() => undefined);

function AskDialog({
  message,
  options,
  onDone,
}: {
  message: string;
  options: Options;
  onDone: (result: string | null) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(options.value ?? '');
  const hasInput = options.value !== undefined;
  const result = useRef<string | null>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
    input.current?.select();
  }, []);

  const close = (r: string | null) => {
    result.current = r;
    const d = dialog.current;
    if (d && typeof d.close === 'function' && d.open) d.close();
    else onDone(r);
  };

  const title = options.title ?? message;
  const body = options.title ? message : null;

  return (
    <dialog
      ref={dialog}
      className="dialog ask"
      aria-label={title}
      onClose={() => onDone(result.current)}
      onCancel={(e) => {
        // Escape: counts as "Cancelar" (or "Entendido" on a notice).
        e.preventDefault();
        close(options.cancel === false ? '' : null);
      }}
      onClick={(e) => e.target === dialog.current && close(options.cancel === false ? '' : null)}
    >
      <form
        method="dialog"
        onSubmit={(e) => {
          e.preventDefault();
          close(hasInput ? text : '');
        }}
      >
        <h2 className="ask__title">{title}</h2>
        {body && <p className="ask__message">{body}</p>}
        {hasInput && (
          <input
            ref={input}
            className="ask__input"
            aria-label={title}
            value={text}
            placeholder={options.placeholder}
            onChange={(e) => setText(e.target.value)}
            autoComplete="off"
          />
        )}
        <div className="ask__actions">
          {options.cancel !== false && (
            <button type="button" className="btn" onClick={() => close(null)}>
              {options.cancel ?? 'Cancelar'}
            </button>
          )}
          <button type="submit" className={`btn ${options.danger ? 'btn--danger-fill' : 'btn--primary'}`}>
            {options.ok}
          </button>
        </div>
      </form>
    </dialog>
  );
}
