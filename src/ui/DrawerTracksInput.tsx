import {
  useState,
  useEffect,
  useMemo,
  type ReactElement,
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
} from 'react';
import { type TrackSize, formatTracksToGridString, parseGridStringToTracks } from '../resolver';

export interface DrawerTracksInputProps {
  tracks: TrackSize[];
  onChange?: (tracks: TrackSize[]) => void;
}

/**
 * Text input allowing freeform editing of drawer heights and proportions (mm, fr, or mixed).
 * Keeps local text state while typing so intermediate keystrokes are never blocked or reverted.
 */
export function DrawerTracksInput({ tracks, onChange }: DrawerTracksInputProps): ReactElement {
  const formatted = useMemo(() => formatTracksToGridString(tracks), [tracks]);
  const [localText, setLocalText] = useState<string>(formatted);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  // Synchronize localText with formatted tracks when tracks change externally (recipe chip, stepper) and input is not focused
  useEffect(() => {
    if (!isFocused) {
      setLocalText(formatted);
      setHasError(false);
    }
  }, [formatted, isFocused]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalText(val);

    const parsed = parseGridStringToTracks(val);
    if (parsed && parsed.length > 0) {
      setHasError(false);
      onChange?.(parsed);
    } else {
      setHasError(true);
    }
  };

  const handleBlur = (_e: FocusEvent<HTMLInputElement>) => {
    setIsFocused(false);
    const parsed = parseGridStringToTracks(localText);
    if (parsed && parsed.length > 0) {
      setHasError(false);
      onChange?.(parsed);
      setLocalText(formatTracksToGridString(parsed));
    } else {
      // Revert to current valid tracks if invalid on blur
      setLocalText(formatted);
      setHasError(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  return (
    <div>
      <input
        id="input-grid-tracks"
        type="text"
        className="m3-input"
        style={{
          fontFamily: 'monospace',
          fontWeight: 600,
          fontSize: '0.95rem',
          margin: '0.25rem 0 0.5rem',
          borderColor: hasError ? 'var(--md-sys-color-error)' : undefined,
          outlineColor: hasError ? 'var(--md-sys-color-error)' : undefined,
        }}
        value={localText}
        placeholder="ej. 140mm 1fr 1fr o 1fr 2fr 1fr"
        onFocus={() => setIsFocused(true)}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      />
      {hasError && (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--md-sys-color-error)',
            display: 'block',
            marginTop: '-0.3rem',
            marginBottom: '0.4rem',
          }}
        >
          Formato en edición... usá números con mm o fr (ej. 140mm 1fr 1fr).
        </span>
      )}
    </div>
  );
}
