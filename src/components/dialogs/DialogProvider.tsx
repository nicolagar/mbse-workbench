import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface ConfirmOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
}

export interface PromptOptions {
  title?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
}

export interface AlertOptions {
  title?: string;
  okLabel?: string;
  tone?: "default" | "danger";
}

interface DialogsApi {
  /** Replaces `window.confirm`. Resolves true/false instead of blocking the thread. */
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  /** Replaces `window.prompt`. Resolves the entered text, or null if cancelled. */
  promptText: (message: string, defaultValue?: string, options?: PromptOptions) => Promise<string | null>;
  /** Replaces `window.alert`. Resolves once the user dismisses the message. */
  alertUser: (message: string, options?: AlertOptions) => Promise<void>;
}

type PendingDialog =
  | { kind: "confirm"; message: string; options?: ConfirmOptions; resolve: (value: boolean) => void }
  | { kind: "prompt"; message: string; options?: PromptOptions; resolve: (value: string | null) => void }
  | { kind: "alert"; message: string; options?: AlertOptions; resolve: () => void };

const DialogsContext = createContext<DialogsApi | null>(null);

export function useDialogs(): DialogsApi {
  const context = useContext(DialogsContext);
  if (!context) throw new Error("useDialogs must be used within a DialogProvider");
  return context;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const [inputValue, setInputValue] = useState("");
  const previousFocus = useRef<HTMLElement | null>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback((message: string, options?: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setPending({ kind: "confirm", message, options, resolve }));
  }, []);

  const promptText = useCallback((message: string, defaultValue = "", options?: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setInputValue(defaultValue);
      setPending({ kind: "prompt", message, options, resolve });
    });
  }, []);

  const alertUser = useCallback((message: string, options?: AlertOptions) => {
    return new Promise<void>((resolve) => setPending({ kind: "alert", message, options, resolve }));
  }, []);

  useEffect(() => {
    if (!pending) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.requestAnimationFrame(() => (pending.kind === "prompt" ? inputRef.current : primaryButtonRef.current)?.focus());
    return () => {
      window.cancelAnimationFrame(focusTimer);
      previousFocus.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.kind]);

  const settle = (result: boolean | string | null | void) => {
    if (!pending) return;
    if (pending.kind === "confirm") pending.resolve(Boolean(result));
    if (pending.kind === "prompt") pending.resolve(typeof result === "string" ? result : null);
    if (pending.kind === "alert") pending.resolve();
    setPending(null);
  };

  useEffect(() => {
    if (!pending) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        settle(pending.kind === "confirm" ? false : pending.kind === "prompt" ? null : undefined);
      }
      if (event.key === "Enter" && pending.kind === "prompt" && document.activeElement === inputRef.current) {
        event.preventDefault();
        settle(inputValue);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending, inputValue]);

  const isDanger = pending?.kind !== "prompt" && pending?.options?.tone === "danger";
  const primaryLabel =
    pending?.kind === "confirm" ? pending.options?.confirmLabel ?? "OK"
    : pending?.kind === "prompt" ? pending.options?.confirmLabel ?? "OK"
    : pending?.options?.okLabel ?? "OK";

  return (
    <DialogsContext.Provider value={{ confirm, promptText, alertUser }}>
      {children}
      {pending && createPortal(
        <div
          className="fixed inset-0 z-[110] grid place-items-center bg-slate-950/40 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target !== event.currentTarget) return;
            settle(pending.kind === "confirm" ? false : pending.kind === "prompt" ? null : undefined);
          }}
        >
          <section
            className="card w-full max-w-sm p-5 shadow-2xl"
            role={pending.kind === "alert" ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby="app-dialog-title"
            aria-describedby="app-dialog-message"
          >
            <h2 id="app-dialog-title" className="text-base font-bold text-slate-950">
              {pending.options?.title ?? (pending.kind === "confirm" ? "Confirm" : pending.kind === "prompt" ? "Enter a value" : "Notice")}
            </h2>
            <p id="app-dialog-message" className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{pending.message}</p>
            {pending.kind === "prompt" && (
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={pending.options?.placeholder}
                className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              />
            )}
            <div className="mt-4 flex justify-end gap-2">
              {pending.kind !== "alert" && (
                <button type="button" className="btn" onClick={() => settle(pending.kind === "confirm" ? false : null)}>
                  {pending.options?.cancelLabel ?? "Cancel"}
                </button>
              )}
              <button
                ref={primaryButtonRef}
                type="button"
                className={`btn btn-primary ${isDanger ? "!border-red-600 !bg-red-600 hover:!bg-red-700" : ""}`}
                onClick={() => settle(pending.kind === "prompt" ? inputValue : true)}
              >
                {primaryLabel}
              </button>
            </div>
          </section>
        </div>,
        document.body
      )}
    </DialogsContext.Provider>
  );
}
