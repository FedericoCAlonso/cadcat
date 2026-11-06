import { useState, useRef, useEffect, type ReactElement } from 'react';
import type { ProjectModuleItem, Project } from '../model';

/**
 * Props for the compact ModuleBar component.
 */
export interface ModuleBarProps {
  /** Current project metadata. */
  project?: Project | null;
  /** List of all module items in the project. */
  projectModules?: ProjectModuleItem[];
  /** Currently active module ID. */
  activeModuleId?: string;
  /** Callback fired when the user selects a module chip. */
  onSetActiveModule?: (moduleId: string) => void;
  /** Callback fired when the user clicks the '+' button to add a module. */
  onAddProjectModule?: (name?: string, templateId?: string) => void;
  /** Callback fired to duplicate the active module. */
  onDuplicateProjectModule?: (moduleId: string) => void;
  /** Callback fired to remove the active module. */
  onRemoveProjectModule?: (moduleId: string) => void;
  /** Callback fired when the quantity of the active module changes. */
  onUpdateProjectModuleQuantity?: (moduleId: string, quantity: number) => void;
  /** Callback fired when the name of the active module is updated. */
  onUpdateProjectModuleName?: (moduleId: string, name: string) => void;
  /** Callback fired to save the active module. */
  onSaveModule?: () => void;
  /** Callback fired to save the entire project. */
  onSaveProject?: () => Promise<void> | void;
  /** Callback to open the complex subdivided distribution modal ("Especial"). */
  onOpenDistributionModal?: () => void;
  /** Whether the active bay in the module is complex subdivided. */
  isSubdividedBay?: boolean;
}

/**
 * Compact bar replacing the separate "Proyecto" and "Módulo" cards.
 * Provides module carousel chips with double-click/long-press inline renaming,
 * new module addition, quantity stepper, "Especial" distribution access, and an overflow menu.
 */
export function ModuleBar({
  project,
  projectModules = [],
  activeModuleId,
  onSetActiveModule,
  onAddProjectModule,
  onDuplicateProjectModule,
  onRemoveProjectModule,
  onUpdateProjectModuleQuantity,
  onUpdateProjectModuleName,
  onSaveModule,
  onSaveProject,
  onOpenDistributionModal,
  isSubdividedBay = false,
}: ModuleBarProps): ReactElement {
  const [editingModuleId, setEditingModuleId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeModule = projectModules.find((m) => m.id === activeModuleId) ?? projectModules[0];
  const activeId = activeModule?.id;
  const activeQuantity = activeModule?.quantity ?? 1;

  // Close overflow menu when clicking outside
  useEffect(() => {
    if (!isMenuOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isMenuOpen]);

  const handleStartRename = (mod: ProjectModuleItem) => {
    setEditingModuleId(mod.id);
    setEditingNameValue(mod.name);
    setIsMenuOpen(false);
  };

  const handleFinishRename = (modId: string) => {
    const trimmed = editingNameValue.trim();
    if (trimmed && trimmed !== activeModule?.name) {
      onUpdateProjectModuleName?.(modId, trimmed);
    }
    setEditingModuleId(null);
  };

  const handleTouchStart = (mod: ProjectModuleItem) => {
    touchTimerRef.current = setTimeout(() => {
      handleStartRename(mod);
    }, 500); // 500ms long press to rename on touch screens
  };

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  };

  return (
    <div className="module-bar" role="region" aria-label="Gestor compacto de módulos y proyecto">
      <div className="module-bar__chips-container">
        {projectModules.map((mod) => {
          const isActive = mod.id === activeId;
          const isEditing = editingModuleId === mod.id;

          if (isEditing) {
            return (
              <div key={mod.id} className="module-bar__chip module-bar__chip--editing">
                <input
                  type="text"
                  autoFocus
                  className="module-bar__name-input"
                  value={editingNameValue}
                  onChange={(e) => setEditingNameValue(e.target.value)}
                  onBlur={() => handleFinishRename(mod.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleFinishRename(mod.id);
                    if (e.key === 'Escape') setEditingModuleId(null);
                  }}
                  aria-label={`Renombrar módulo ${mod.name}`}
                />
              </div>
            );
          }

          return (
            <button
              key={mod.id}
              type="button"
              className={`module-bar__chip ${isActive ? 'module-bar__chip--active' : ''}`}
              onClick={() => onSetActiveModule?.(mod.id)}
              onDoubleClick={() => handleStartRename(mod)}
              onTouchStart={() => handleTouchStart(mod)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchEnd}
              title={`${mod.name} (Doble clic o pulsación larga para renombrar)`}
              aria-pressed={isActive}
            >
              <span className="module-bar__chip-icon" aria-hidden="true">{isActive ? '📌' : '📦'}</span>
              <span className="module-bar__chip-name">{mod.name}</span>
              <span className="module-bar__chip-qty">×{mod.quantity}</span>
            </button>
          );
        })}

        {onAddProjectModule && (
          <button
            type="button"
            className="module-bar__add-btn"
            onClick={() => onAddProjectModule()}
            title="Agregar nuevo módulo al proyecto"
            aria-label="Nuevo Módulo"
          >
            <span aria-hidden="true">➕</span>
          </button>
        )}
      </div>

      <div className="module-bar__controls">
        {/* Quantity control stepper */}
        {activeId && onUpdateProjectModuleQuantity && (
          <div className="module-bar__stepper" title="Cantidad de unidades del módulo activo">
            <button
              type="button"
              className="module-bar__stepper-btn"
              disabled={activeQuantity <= 1}
              onClick={() => onUpdateProjectModuleQuantity(activeId, Math.max(1, activeQuantity - 1))}
              aria-label="Disminuir cantidad del módulo"
            >
              −
            </button>
            <span className="module-bar__stepper-qty" aria-label={`Cantidad: ${activeQuantity}`}>
              {activeQuantity}
            </span>
            <button
              type="button"
              className="module-bar__stepper-btn"
              onClick={() => onUpdateProjectModuleQuantity(activeId, activeQuantity + 1)}
              aria-label="Aumentar cantidad del módulo"
            >
              +
            </button>
          </div>
        )}

        {/* Especial button (Decision 2) */}
        {onOpenDistributionModal && (
          <button
            type="button"
            onClick={onOpenDistributionModal}
            className={`module-bar__special-btn ${isSubdividedBay ? 'module-bar__special-btn--active' : ''}`}
            title="Edición Especial de vanos (Matriz de celdas estilo Word)"
            aria-label="Especial"
          >
            <span aria-hidden="true">🍱</span>
            <span className="special-label">Especial</span>
          </button>
        )}

        {/* Overflow Menu ("⋯") */}
        <div className="module-bar__overflow-wrapper" ref={menuRef}>
          <button
            type="button"
            className="module-bar__overflow-btn"
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Opciones del módulo y proyecto"
            aria-expanded={isMenuOpen}
            title="Más opciones de módulo y proyecto"
          >
            <span>⋯</span>
          </button>

          {isMenuOpen && (
            <div className="module-bar__menu-dropdown" role="menu">
              {activeModule && (
                <button
                  type="button"
                  className="module-bar__menu-item"
                  role="menuitem"
                  onClick={() => handleStartRename(activeModule)}
                >
                  <span aria-hidden="true">✏️</span>
                  <span>Renombrar módulo</span>
                </button>
              )}

              {activeId && onDuplicateProjectModule && (
                <button
                  type="button"
                  className="module-bar__menu-item"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onDuplicateProjectModule(activeId);
                  }}
                >
                  <span aria-hidden="true">📑</span>
                  <span>Duplicar módulo</span>
                </button>
              )}

              {activeId && onRemoveProjectModule && projectModules.length > 1 && (
                <button
                  type="button"
                  className="module-bar__menu-item module-bar__menu-item--danger"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    if (window.confirm(`¿Eliminar el módulo "${activeModule?.name}" del proyecto?`)) {
                      onRemoveProjectModule(activeId);
                    }
                  }}
                >
                  <span aria-hidden="true">🗑️</span>
                  <span>Eliminar módulo</span>
                </button>
              )}

              {onSaveModule && (
                <button
                  type="button"
                  className="module-bar__menu-item"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onSaveModule();
                  }}
                >
                  <span aria-hidden="true">💾</span>
                  <span>Guardar Módulo</span>
                </button>
              )}

              {onSaveProject && (
                <button
                  type="button"
                  className="module-bar__menu-item"
                  role="menuitem"
                  onClick={() => {
                    setIsMenuOpen(false);
                    void onSaveProject();
                  }}
                >
                  <span aria-hidden="true">📦</span>
                  <span>Guardar Proyecto ({project?.name ?? 'CadCat'})</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
