import { useRef, useState, useEffect, type ReactElement } from 'react';
import { useFocusTrapModal } from './hooks/useFocusTrapModal';

export interface M3ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Accessible Material Design 3 confirmation dialog (replaces blocking window.confirm).
 */
export function M3ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onCancel,
}: M3ConfirmDialogProps): ReactElement | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  useFocusTrapModal({ isOpen, containerRef: dialogRef, onClose: onCancel });

  if (!isOpen) return null;

  return (
    <div
      className="m3-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(15, 20, 17, 0.56)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="m3-confirm-dialog-title"
        aria-describedby="m3-confirm-dialog-desc"
        style={{
          width: 'min(420px, 100%)',
          borderRadius: '16px',
          backgroundColor: 'var(--md-sys-color-surface-container-high, var(--surface))',
          color: 'var(--md-sys-color-on-surface, var(--text))',
          border: '1px solid var(--md-sys-color-outline-variant, var(--border))',
          boxShadow: 'var(--md-sys-elevation-3, 0 12px 32px rgba(0,0,0,0.28))',
          padding: '1.25rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <h3
          id="m3-confirm-dialog-title"
          style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}
        >
          {title}
        </h3>
        <p
          id="m3-confirm-dialog-desc"
          style={{ margin: 0, fontSize: '0.92rem', lineHeight: 1.45, color: 'var(--md-sys-color-on-surface-variant)' }}
        >
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.35rem' }}>
          <button
            type="button"
            className="m3-btn m3-btn--outlined"
            style={{ minHeight: '48px', padding: '0 1.1rem' }}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={tone === 'danger' ? 'm3-btn m3-btn--danger' : 'm3-btn m3-btn--filled'}
            style={{ minHeight: '48px', padding: '0 1.2rem' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export interface M3PromptDialogProps {
  isOpen: boolean;
  title: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

/**
 * Accessible Material Design 3 text prompt dialog (replaces blocking window.prompt).
 */
export function M3PromptDialog({
  isOpen,
  title,
  label,
  defaultValue = '',
  placeholder = '',
  confirmLabel = 'Guardar',
  cancelLabel = 'Cancelar',
  onConfirm,
  onCancel,
}: M3PromptDialogProps): ReactElement | null {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
    }
  }, [isOpen, defaultValue]);

  useFocusTrapModal({
    isOpen,
    containerRef: dialogRef,
    onClose: onCancel,
    initialFocusSelector: 'input',
  });

  if (!isOpen) return null;

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onConfirm(trimmed);
    }
  };

  return (
    <div
      className="m3-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(15, 20, 17, 0.56)',
        backdropFilter: 'blur(3px)',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="m3-prompt-dialog-title"
        style={{
          width: 'min(420px, 100%)',
          borderRadius: '16px',
          backgroundColor: 'var(--md-sys-color-surface-container-high, var(--surface))',
          color: 'var(--md-sys-color-on-surface, var(--text))',
          border: '1px solid var(--md-sys-color-outline-variant, var(--border))',
          boxShadow: 'var(--md-sys-elevation-3, 0 12px 32px rgba(0,0,0,0.28))',
          padding: '1.25rem 1.35rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
        }}
      >
        <h3
          id="m3-prompt-dialog-title"
          style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--md-sys-color-on-surface)' }}
        >
          {title}
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <label
            htmlFor="m3-prompt-dialog-input"
            style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--md-sys-color-on-surface-variant)' }}
          >
            {label}
          </label>
          <input
            id="m3-prompt-dialog-input"
            type="text"
            className="m3-input"
            style={{ minHeight: '48px', width: '100%' }}
            value={value}
            placeholder={placeholder}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', marginTop: '0.35rem' }}>
          <button
            type="button"
            className="m3-btn m3-btn--outlined"
            style={{ minHeight: '48px', padding: '0 1.1rem' }}
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="m3-btn m3-btn--filled"
            style={{ minHeight: '48px', padding: '0 1.2rem' }}
            disabled={!value.trim()}
            onClick={handleSubmit}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
