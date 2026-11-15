import React, { useEffect, useMemo, useRef, useState } from "react";
import { getCmosAudio } from "../lib/cmos/audio.js";
import { deriveCloudTopology, type CmosConfig, type DefaultsPreset } from "../lib/cmos/engine.js";
import {
  BIOS_MENUS,
  displayValue,
  getMenu,
  optionIndex,
  type BiosContext,
  type BiosRow,
  type BiosSelectRow,
} from "./bios-menus.js";
import { ModemPanel } from "./AcousticModemOscilloscope.js";
import { IaCPanel } from "./IaCCodeCompilerOutput.js";
import { getCmosStore, getCmosUiStore, setCmosUi, useCmos, useCmosUi } from "./cmos-store.js";

export interface AwardBiosMenuGridProps {
  readonly title: string;
  readonly copyrightLine: string;
}

type MainAction = { readonly id: string; readonly label: string; readonly key: string };

const MAIN_ACTIONS: readonly MainAction[] = [
  { id: "load-bios", label: "LOAD BIOS DEFAULTS (SAFE)", key: "F5" },
  { id: "load-setup", label: "LOAD SETUP DEFAULTS", key: "F6" },
  { id: "load-overclock", label: "LOAD HIGH-TRAFFIC OVERCLOCK", key: "F7" },
  { id: "save", label: "SAVE & COMPILE TO CLOUD", key: "F10" },
  { id: "exit", label: "EXIT WITHOUT SAVING", key: "ESC" },
];

const MAIN_COUNT = BIOS_MENUS.length + MAIN_ACTIONS.length;

function store() {
  return getCmosStore().getState();
}

function loadPreset(preset: DefaultsPreset) {
  store().dispatch({ type: "LOAD_DEFAULTS", preset });
}

function applyRowValue(row: BiosSelectRow, config: CmosConfig, value: string | number): void {
  const { path, value: next } = row.set(config, value);
  store().dispatch({ type: "SET_REGISTER", path, value: next });
}

/**
 * Award Modular BIOS v4.51PG style setup utility. Fully operable by keyboard (Arrows, Enter, Esc,
 * +/-, PgUp/PgDn, F1, F5, F6, F7, F10, Y/N) and by mouse. Register writes go through the Zod
 * validated CMOS store; rejected writes are shown on the status line.
 */
export const AwardBiosMenuGrid: React.FC<AwardBiosMenuGridProps> = ({ title, copyrightLine }) => {
  const phase = useCmos((s) => s.phase);
  const draft = useCmos((s) => s.draft);
  const telemetry = useCmos((s) => s.telemetry);
  const issues = useCmos((s) => s.issues);
  const dirty = useCmos((s) => s.dirty);
  const mode = useCmosUi((s) => s.mode);
  const activeMenuId = useCmosUi((s) => s.activeMenu);
  const mainIndex = useCmosUi((s) => s.mainIndex);
  const rowIndex = useCmosUi((s) => s.rowIndex);
  const showHelp = useCmosUi((s) => s.showHelp);
  const recoveryNotice = useCmosUi((s) => s.recoveryNotice);
  const [picker, setPicker] = useState<{ rowId: string; index: number } | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const topology = useMemo(() => deriveCloudTopology(draft), [draft]);
  const ctx: BiosContext = { config: draft, topology, telemetry };
  const menu = getMenu(activeMenuId);
  const rows: readonly BiosRow[] = menu?.rows ?? [];
  const row = rows[rowIndex];
  const pickerRow = picker ? rows.find((r): r is BiosSelectRow => r.kind === "select" && r.id === picker.rowId) : undefined;
  const dialog = phase === "confirm-save" || phase === "confirm-exit" ? phase : null;

  // Keep the 3D camera on whatever is focused.
  useEffect(() => {
    const part = menu ? (row?.part ?? menu.part) : (BIOS_MENUS[mainIndex]?.part ?? "overview");
    if (getCmosUiStore().getState().focusPart !== part) setCmosUi({ focusPart: part });
  }, [menu, row, mainIndex]);

  // Focus the utility when SETUP opens so keyboard control works immediately.
  useEffect(() => {
    if (phase === "setup" && mode === "setup") rootRef.current?.focus({ preventScroll: true });
  }, [phase, mode]);

  if (phase === "post" || phase === "rebooting") {
    if (mode === "setup") return null;
  }

  const tick = () => getCmosAudio().playKeyTick();

  const openMain = (index: number) => {
    const target = BIOS_MENUS[index];
    if (target) {
      setCmosUi({ activeMenu: target.id, mainIndex: index, rowIndex: 0 });
      return;
    }
    const action = MAIN_ACTIONS[index - BIOS_MENUS.length];
    if (!action) return;
    if (action.id === "load-bios") loadPreset("bios");
    if (action.id === "load-setup") loadPreset("setup");
    if (action.id === "load-overclock") loadPreset("overclock");
    if (action.id === "save") store().dispatch({ type: "REQUEST_SAVE" });
    if (action.id === "exit") store().dispatch({ type: "REQUEST_EXIT" });
  };

  const stepValue = (target: BiosRow | undefined, delta: number) => {
    if (!target || target.kind !== "select") return;
    const next = optionIndex(target, draft) + delta;
    const option = target.options[Math.max(0, Math.min(target.options.length - 1, next))];
    if (option) applyRowValue(target, draft, option.value);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const key = e.key;
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    getCmosAudio().unlock();

    if (dialog) {
      if (key === "y" || key === "Y" || key === "Enter") {
        handled();
        store().dispatch({ type: "CONFIRM" });
        if (dialog === "confirm-save") getCmosAudio().playPostBeep();
      } else if (key === "n" || key === "N" || key === "Escape") {
        handled();
        store().dispatch({ type: "CANCEL" });
      }
      return;
    }

    if (key === "F1") {
      handled();
      setCmosUi({ showHelp: !showHelp });
      return;
    }
    if (key === "F5" || key === "F6" || key === "F7") {
      handled();
      loadPreset(key === "F5" ? "bios" : key === "F6" ? "setup" : "overclock");
      return;
    }
    if (key === "F10") {
      handled();
      store().dispatch({ type: "REQUEST_SAVE" });
      return;
    }

    if (pickerRow && picker) {
      if (key === "ArrowUp" || key === "ArrowDown") {
        handled();
        tick();
        const delta = key === "ArrowUp" ? -1 : 1;
        setPicker({ ...picker, index: Math.max(0, Math.min(pickerRow.options.length - 1, picker.index + delta)) });
      } else if (key === "Enter") {
        handled();
        const option = pickerRow.options[picker.index];
        if (option) applyRowValue(pickerRow, draft, option.value);
        setPicker(null);
      } else if (key === "Escape") {
        handled();
        setPicker(null);
      }
      return;
    }

    if (!menu) {
      const columns = 2;
      const half = Math.ceil(MAIN_COUNT / columns);
      if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") {
        handled();
        tick();
        let next = mainIndex;
        if (key === "ArrowUp") next -= 1;
        if (key === "ArrowDown") next += 1;
        if (key === "ArrowLeft") next -= half;
        if (key === "ArrowRight") next += half;
        setCmosUi({ mainIndex: (next + MAIN_COUNT) % MAIN_COUNT });
      } else if (key === "Enter") {
        handled();
        openMain(mainIndex);
      } else if (key === "Escape") {
        handled();
        store().dispatch({ type: "REQUEST_EXIT" });
      }
      return;
    }

    if (key === "ArrowUp" || key === "ArrowDown") {
      handled();
      tick();
      if (rows.length > 0) {
        const delta = key === "ArrowUp" ? -1 : 1;
        setCmosUi({ rowIndex: (rowIndex + delta + rows.length) % rows.length });
      }
    } else if (key === "+" || key === "PageDown" || key === "ArrowRight" || key === "=") {
      handled();
      stepValue(row, 1);
    } else if (key === "-" || key === "PageUp" || key === "ArrowLeft" || key === "_") {
      handled();
      stepValue(row, -1);
    } else if (key === "Enter") {
      handled();
      if (row?.kind === "select") setPicker({ rowId: row.id, index: optionIndex(row, draft) });
    } else if (key === "Escape") {
      handled();
      setCmosUi({ activeMenu: null, rowIndex: 0 });
    }
  };

  const compact = mode === "landing";

  return (
    <div
      ref={rootRef}
      data-cmos-area={compact ? "widget" : "bios"}
      data-testid="cmos-bios-utility"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={() => getCmosAudio().unlock()}
      aria-label={`${title}. Use arrow keys to move, Enter to select, Escape to go back, F10 to save.`}
      className="cmos-frame cmos-text flex flex-col min-w-0 outline-none"
      style={{ minHeight: compact ? "30rem" : undefined }}
    >
      {/* Header */}
      <header className="text-center border-b-4 border-double border-[#FFFFFF] py-1">
        <p className="text-[#FFFFFF]">{title}</p>
        <p className="cmos-small cmos-help">{copyrightLine}</p>
      </header>

      {/* Body */}
      <div className="flex-1 min-h-0 overflow-auto cmos-scroll p-2">
        {!menu ? (
          <div role="menu" aria-label="CMOS Setup main menu" className="grid gap-x-6 sm:grid-cols-2">
            {[...BIOS_MENUS.map((m) => ({ id: m.id, label: `► ${m.title}`, hint: m.summary })),
              ...MAIN_ACTIONS.map((a) => ({ id: a.id, label: a.label, hint: a.key }))].map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="menuitem"
                data-selected={i === mainIndex}
                data-testid={`cmos-main-${item.id}`}
                className="cmos-item"
                onMouseEnter={() => setCmosUi({ mainIndex: i })}
                onFocus={() => setCmosUi({ mainIndex: i })}
                onClick={() => {
                  getCmosAudio().unlock();
                  openMain(i);
                }}
              >
                <span className="truncate">{item.label}</span>
              </button>
            ))}
          </div>
        ) : menu.id === "compiler" ? (
          <div className="space-y-4">
            <p className="cmos-value">{menu.title}</p>
            <IaCPanel />
            <ModemPanel />
          </div>
        ) : (
          <div role="listbox" aria-label={menu.title} className="space-y-0">
            <p className="cmos-value pb-1">{menu.title}</p>
            {rows.map((r, i) => {
              const selected = i === rowIndex;
              const value = r.kind === "select" ? displayValue(r, draft) : r.read(ctx);
              return (
                <button
                  key={r.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  aria-label={`${r.label}: ${value}`}
                  data-testid={`cmos-row-${r.id}`}
                  className="cmos-item"
                  onMouseEnter={() => setCmosUi({ rowIndex: i, hoverPart: r.part })}
                  onMouseLeave={() => setCmosUi({ hoverPart: null })}
                  onClick={() => {
                    getCmosAudio().unlock();
                    setCmosUi({ rowIndex: i });
                    if (r.kind === "select") setPicker({ rowId: r.id, index: optionIndex(r, draft) });
                  }}
                >
                  <span className={r.kind === "info" ? "cmos-help" : undefined}>{r.label}</span>
                  <span className={selected ? undefined : "cmos-value"}>{r.kind === "select" ? `[${value}]` : value}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Option picker (listbox popup) */}
      {pickerRow && picker && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="cmos-dialog p-2 pt-4 relative max-h-[80%] overflow-auto cmos-scroll min-w-[18rem]">
            <span className="cmos-frame-title !bg-[#AA0000]">{pickerRow.label}</span>
            <div role="listbox" aria-label={pickerRow.label}>
              {pickerRow.options.map((o, i) => (
                <button
                  key={String(o.value)}
                  type="button"
                  role="option"
                  aria-selected={i === picker.index}
                  className="cmos-item"
                  style={i === picker.index ? { background: "#0000AA", color: "#FFFF55" } : undefined}
                  onMouseEnter={() => setPicker({ ...picker, index: i })}
                  onClick={() => {
                    applyRowValue(pickerRow, draft, o.value);
                    setPicker(null);
                    rootRef.current?.focus({ preventScroll: true });
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Y/N confirm dialogs */}
      {dialog && (
        <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
          <div role="alertdialog" aria-modal="true" aria-label="Confirm" className="cmos-dialog px-6 py-4 text-center space-y-3">
            <p className="text-[#FFFF55]">
              {dialog === "confirm-save" ? "SAVE to CMOS and COMPILE (Y/N)? Y" : "Quit Without Saving (Y/N)? N"}
            </p>
            <div className="flex justify-center gap-3">
              <button
                type="button"
                className="cmos-button"
                data-testid="cmos-dialog-yes"
                onClick={() => {
                  store().dispatch({ type: "CONFIRM" });
                  if (dialog === "confirm-save") getCmosAudio().playPostBeep();
                }}
              >
                Y
              </button>
              <button type="button" className="cmos-button" onClick={() => store().dispatch({ type: "CANCEL" })}>
                N
              </button>
            </div>
          </div>
        </div>
      )}

      {/* F1 help */}
      {showHelp && !dialog && (
        <div role="note" className="absolute right-3 top-14 z-10 max-w-sm cmos-dialog p-3 cmos-small space-y-1">
          <p className="text-[#FFFF55]">GENERAL HELP</p>
          <p>↑↓→← Move · Enter Select · Esc Back</p>
          <p>+/- PgUp/PgDn Change value</p>
          <p>F5 Safe defaults · F6 Setup defaults · F7 Overclock</p>
          <p>F10 Save & compile · F1 Close help</p>
        </div>
      )}

      {/* Status + footer */}
      <footer className="border-t-4 border-double border-[#FFFFFF] px-2 py-1 cmos-small space-y-0.5">
        <p aria-live="polite" data-testid="cmos-status-line" className={issues.length > 0 || recoveryNotice ? "text-[#FFFF55]" : "cmos-help"}>
          {issues.length > 0
            ? `REGISTER REJECTED: ${issues.map((i) => `${i.path} ${i.message}`).join("; ")}`
            : recoveryNotice
              ? recoveryNotice
              : menu
                ? (row?.help ?? menu.summary)
                : (BIOS_MENUS[mainIndex]?.summary ?? MAIN_ACTIONS[mainIndex - BIOS_MENUS.length]?.label ?? "")}
        </p>
        <p className="flex flex-wrap justify-between gap-x-4">
          <span>Esc:Quit ↑↓→←:Select +/-:Value F10:Save</span>
          <span className={dirty ? "text-[#FFFF55]" : "cmos-help"}>{dirty ? "UNSAVED CHANGES" : "CMOS SAVED"}</span>
        </p>
      </footer>
    </div>
  );
};
