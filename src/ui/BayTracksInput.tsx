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

export interface BayTrackRecipe {
  label: string;
  description: string;
  tracks: TrackSize[];
}

export const DEFAULT_BAY_TRACK_RECIPES: BayTrackRecipe[] = [
  {
    label: '1fr 1fr',
    description: '2 vanos iguales (50% / 50%)',
    tracks: [
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ],
  },
  {
    label: '1fr 1fr 1fr',
    description: '3 vanos iguales',
    tracks: [
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ],
  },
  {
    label: '400mm 1fr',
    description: 'Vano izquierdo fijo de 400mm y resto libre',
    tracks: [
      { type: 'fixed', valueMm: 400 },
      { type: 'fractional', valueFr: 1 },
    ],
  },
  {
    label: '1fr 400mm',
    description: 'Vano libre y vano derecho fijo de 400mm',
    tracks: [
      { type: 'fractional', valueFr: 1 },
      { type: 'fixed', valueMm: 400 },
    ],
  },
  {
    label: '300mm 1fr 300mm',
    description: 'Laterales de 300mm con centro amplio libre',
    tracks: [
      { type: 'fixed', valueMm: 300 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fixed', valueMm: 300 },
    ],
  },
  {
    label: '1fr 2fr',
    description: 'Proporción asimétrica 1/3 y 2/3',
    tracks: [
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 2 },
    ],
  },
  {
    label: '1fr 1fr 1fr 1fr',
    description: '4 vanos proporcionales',
    tracks: [
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
      { type: 'fractional', valueFr: 1 },
    ],
  },
];

export interface BayTracksInputProps {
  tracks: TrackSize[];
  axis?: 'horizontal' | 'vertical';
  onChange?: (tracks: TrackSize[]) => void;
}

/**
 * Text input allowing freeform configuration of cabinet bay divisions (fixed mm, proportional fr, or mixed).
 * Synchronizes with local state to preserve intermediate typing without bouncing or loss of focus.
 */
export function BayTracksInput({ tracks, axis = 'horizontal', onChange }: BayTracksInputProps): ReactElement {
  const formatted = useMemo(() => formatTracksToGridString(tracks), [tracks]);
  const [localText, setLocalText] = useState<string>(formatted);
  const [isFocused, setIsFocused] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

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
      setLocalText(formatted);
      setHasError(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.currentTarget.blur();
    }
  };

  const placeholderText =
    axis === 'horizontal'
      ? 'ej. 400mm 1fr, 1fr 1fr 1fr, o 300mm 1fr 300mm'
      : 'ej. 350mm 1fr o 1fr 1fr (niveles)';

  return (
    <div className="bay-tracks-input-container">
      <input
        id="input-bay-grid-tracks"
        type="text"
        className="m3-input"
        style={{
          fontFamily: 'monospace',
          fontWeight: 600,
          fontSize: '0.92rem',
          margin: '0.25rem 0 0.4rem',
          borderColor: hasError ? 'var(--md-sys-color-error)' : undefined,
          outlineColor: hasError ? 'var(--md-sys-color-error)' : undefined,
          width: '100%',
        }}
        value={localText}
        placeholder={placeholderText}
        onFocus={() => setIsFocused(true)}
        onChange={handleChange}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label="Medidas y proporciones de vanos en mm o fr"
      />
      {hasError && (
        <span
          style={{
            fontSize: '0.75rem',
            color: 'var(--md-sys-color-error)',
            display: 'block',
            marginTop: '-0.2rem',
            marginBottom: '0.4rem',
          }}
        >
          Formato en edición... usá números con mm o fr (ej. 400mm 1fr o 1fr 1fr 1fr).
        </span>
      )}

      {/* Quick recipes */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.3rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--md-sys-color-on-surface-variant)', marginRight: '0.25rem' }}>
          Atajos rápidos:
        </span>
        {DEFAULT_BAY_TRACK_RECIPES.map((recipe, rIdx) => (
          <button
            key={rIdx}
            type="button"
            className="m3-chip"
            style={{ height: '30px', padding: '0 0.65rem', fontSize: '0.76rem', cursor: 'pointer' }}
            title={recipe.description}
            onClick={() => onChange?.(recipe.tracks)}
          >
            {recipe.label}
          </button>
        ))}
      </div>
    </div>
  );
}
