import React, { useEffect, useId, useRef, useState } from "react";
import { playArcadeSfx } from "../arcade/sound.js";
import {
  OPERATOR_NAME_MAX_LENGTH,
  useNinety9OperatorName,
  useNinety9Store,
  validateOperatorName,
} from "../store.js";

export interface CobolBootLine {
  readonly seq: string;
  readonly code: string;
  readonly kind: "division" | "data" | "proc" | "ok" | "alert" | "ready";
}

export const COBOL_BOOT_LINES: readonly CobolBootLine[] = [
  { seq: "000100", code: "IDENTIFICATION DIVISION.", kind: "division" },
  { seq: "000200", code: "PROGRAM-ID.    NINETY9-GATEKEEPER.", kind: "data" },
  { seq: "000300", code: "AUTHOR.        DIGITAL-PRESERVATION-1999.", kind: "data" },
  { seq: "000400", code: "ENVIRONMENT DIVISION.", kind: "division" },
  { seq: "000500", code: "SOURCE-COMPUTER. VAX-COBOL-1994.", kind: "data" },
  { seq: "000600", code: "DATA DIVISION.", kind: "division" },
  { seq: "000700", code: "WORKING-STORAGE SECTION.", kind: "data" },
  {
    seq: "000800",
    code: '01  WS-SYS-NODE       PIC X(18) VALUE "NINETY9-ARCHIVE-99".',
    kind: "data",
  },
  {
    seq: "000900",
    code: "01  WS-OPERATOR-NAME  PIC X(32) VALUE SPACES.",
    kind: "data",
  },
  { seq: "001000", code: "PROCEDURE DIVISION.", kind: "division" },
  { seq: "001100", code: "000-MAIN-LOGIN-GATE.", kind: "proc" },
  {
    seq: "001200",
    code: '    DISPLAY "CRT PHOSPHOR BUS INITIALIZED ........ [OK]".',
    kind: "ok",
  },
  {
    seq: "001300",
    code: "    IF WS-OPERATOR-NAME = SPACES",
    kind: "alert",
  },
  {
    seq: "001400",
    code: '        DISPLAY "ALERT: ACCESS DENIED [EMPTY NAME]" UPON STDERR.',
    kind: "alert",
  },
  {
    seq: "001500",
    code: '    DISPLAY "MOUNTING ARCHIVE SECTORS 1990..1999 .. [STANDBY]".',
    kind: "ok",
  },
  {
    seq: "001600",
    code: "    ACCEPT WS-OPERATOR-NAME FROM LOGIN-CONSOLE.",
    kind: "ready",
  },
];

export interface CobolBootTerminalProps {
  readonly systemVersion?: string;
}

export const CobolBootTerminal: React.FC<CobolBootTerminalProps> = ({
  systemVersion = "SYS_ARCH_VER: 1990.99",
}) => {
  const operatorName = useNinety9OperatorName();
  const authenticateOperator = useNinety9Store((s) => s.authenticateOperator);
  const arcadeMuted = useNinety9Store((s) => s.arcadeMuted);

  const [draftName, setDraftName] = useState("");
  const [hasBlurred, setHasBlurred] = useState(false);
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [visibleLines, setVisibleLines] = useState<number>(
    COBOL_BOOT_LINES.length
  );
  const [bootComplete, setBootComplete] = useState<boolean>(true);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const titleId = useId();
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();
  const liveId = useId();

  useEffect(() => {
    if (operatorName !== null) return;
    setDraftName("");
    setHasBlurred(false);
    setHasSubmitted(false);

    if (typeof window === "undefined") return;
    const prefersReducedMotion =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (prefersReducedMotion) {
      setVisibleLines(COBOL_BOOT_LINES.length);
      setBootComplete(true);
      inputRef.current?.focus();
      return;
    }

    setVisibleLines(6);
    setBootComplete(false);

    const timer = window.setInterval(() => {
      setVisibleLines((prev) => {
        if (prev >= COBOL_BOOT_LINES.length) {
          window.clearInterval(timer);
          setBootComplete(true);
          return COBOL_BOOT_LINES.length;
        }
        const next = prev + 1;
        if (next >= COBOL_BOOT_LINES.length) {
          window.clearInterval(timer);
          setBootComplete(true);
        }
        return next;
      });
    }, 55);

    return () => window.clearInterval(timer);
  }, [operatorName]);

  useEffect(() => {
    if (operatorName === null && bootComplete) {
      inputRef.current?.focus();
    }
  }, [operatorName, bootComplete]);

  if (operatorName !== null) {
    return null;
  }

  const validation = validateOperatorName(draftName);
  const showValidationError = (hasBlurred || hasSubmitted) && !validation.ok;
  const shownLines = COBOL_BOOT_LINES.slice(0, visibleLines);
  const progressPct = Math.round(
    (shownLines.length / COBOL_BOOT_LINES.length) * 100
  );

  const handleSkipBoot = () => {
    setVisibleLines(COBOL_BOOT_LINES.length);
    setBootComplete(true);
    inputRef.current?.focus();
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setHasSubmitted(true);
    const result = authenticateOperator(draftName);
    if (!result.ok) {
      playArcadeSfx("gameover", arcadeMuted);
      inputRef.current?.focus();
      return;
    }
    playArcadeSfx("boot", arcadeMuted);
  };

  return (
    <section
      data-testid="ninety9-cobol-boot-terminal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="n99-cobol-screen flex flex-col items-center justify-center p-2.5 sm:p-6"
    >
      <div className="n99-cobol-chassis w-full max-w-[780px] border-2 border-[#22FF66] bg-[#020A04] text-[#22FF66]">
        {/* Terminal Top Hardware Bezel */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#22FF66] bg-[#041809] px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-wider">
          <div className="flex min-w-0 items-center gap-2">
            <span className="border-2 border-[#22FF66] bg-[#22FF66] px-1.5 py-0.5 text-[#020A04]">
              99
            </span>
            <h1 id={titleId} className="truncate text-xs font-bold uppercase text-[#22FF66]">
              VAX-COBOL-85 // NINETY9 LOGIN TERMINAL
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 border border-[#FF4D4D] bg-[#290707] px-2 py-0.5 text-[10px] font-bold text-[#FF4D4D]">
              <span
                aria-hidden="true"
                className="n99-cobol-red-led inline-block h-2 w-2 bg-[#FF4D4D]"
              />
              SEC-LOCKED // AUTH REQUIRED
            </span>
            {!bootComplete && (
              <button
                type="button"
                onClick={handleSkipBoot}
                data-testid="ninety9-cobol-skip-btn"
                className="min-h-[28px] border border-[#22FF66] bg-[#020A04] px-2 py-0.5 text-[10px] font-bold uppercase text-[#22FF66] hover:bg-[#22FF66] hover:text-[#020A04] cursor-pointer"
              >
                [SKIP BOOT]
              </button>
            )}
          </div>
        </div>

        {/* Boot Compilation Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#14993D] bg-[#020A04] px-3 py-1.5 font-mono text-[11px] font-bold uppercase">
          <span className="text-[#14993D]">{systemVersion} // GATEWAY: CLOSED</span>
          <span data-testid="ninety9-cobol-progress" className="text-[#22FF66]">
            COBOL PASS: {String(shownLines.length).padStart(2, "0")}/
            {COBOL_BOOT_LINES.length} [{progressPct}%]
          </span>
        </div>

        {/* Terminal Screen Interior */}
        <div className="p-3 sm:p-5 space-y-4">
          {/* COBOL Language Compilation / Execution Log */}
          <div
            aria-label="COBOL system boot sequence output"
            className="border border-[#14993D] bg-[#020A04] p-2.5 sm:p-3 font-mono text-xs leading-relaxed"
          >
            {shownLines.map((line) => (
              <div
                key={line.seq}
                className={`flex gap-2 sm:gap-3 ${
                  line.kind === "division"
                    ? "bg-[#051F0D] text-[#22FF66] font-bold px-1 mt-1 first:mt-0"
                    : line.kind === "alert"
                      ? "text-[#FF4D4D] font-bold"
                      : line.kind === "ready"
                        ? "text-[#22FF66] font-bold"
                        : "text-[#14993D]"
                }`}
              >
                <span className="shrink-0 select-none opacity-75">
                  {line.seq}
                </span>
                <span className="min-w-0 break-words whitespace-pre-wrap">
                  {line.code}
                </span>
              </div>
            ))}
            <div className="mt-2 flex items-center gap-1.5 font-mono text-[11px] font-bold">
              <span className={bootComplete ? "text-[#FF4D4D]" : "text-[#22FF66]"}>
                {bootComplete
                  ? "STDERR> SITE ACCESS LOCKED PENDING NON-EMPTY OPERATOR LOGIN"
                  : "COMPILING ANS-COBOL-85 BOOT IMAGE..."}
              </span>
              <span
                aria-hidden="true"
                className="n99-cobol-cursor inline-block h-3.5 w-2 bg-[#22FF66]"
              />
            </div>
          </div>

          {/* Authentic Terminal Login Box */}
          <form
            noValidate
            onSubmit={handleSubmit}
            data-testid="ninety9-cobol-login-form"
            className="border-2 border-[#22FF66] bg-[#041809] p-3 sm:p-4 space-y-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#14993D] pb-2 font-mono text-[11px] font-bold uppercase">
              <span className="text-[#22FF66]">
                +---[ TERMINAL LOGIN // ENTER OPERATOR NAME ]---+
              </span>
              <span className="text-[#FF4D4D]">REQUIRED INPUT</span>
            </div>

            <p
              id={hintId}
              className="font-mono text-xs leading-relaxed text-[#D9D9D9]"
            >
              ENTER ANY NAME OR CALLSIGN BELOW TO AUTHENTICATE AND UNLOCK THE NINETY9
              WEBSITE (EMPTY OR SPACES ONLY WILL BE DENIED).
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor={inputId}
                className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-[#22FF66]"
              >
                <span>LOGIN / OPERATOR_ID &gt;</span>
                <span
                  aria-hidden="true"
                  className="n99-cobol-cursor inline-block h-3.5 w-2 bg-[#22FF66]"
                />
              </label>

              <div className="n99-boot-form-row">
                <input
                  ref={inputRef}
                  id={inputId}
                  name="operatorName"
                  type="text"
                  required
                  aria-required="true"
                  maxLength={OPERATOR_NAME_MAX_LENGTH}
                  autoComplete="nickname"
                  autoCapitalize="words"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  value={draftName}
                  onChange={(e) => setDraftName(e.target.value)}
                  onBlur={() => setHasBlurred(true)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                  }}
                  aria-invalid={showValidationError ? "true" : "false"}
                  aria-describedby={
                    showValidationError ? `${hintId} ${errorId}` : hintId
                  }
                  placeholder="TYPE YOUR NAME TO LOGIN..."
                  data-testid="ninety9-cobol-operator-input"
                  className={`n99-touch-input w-full border-2 bg-[#020A04] px-3 py-2.5 font-mono font-bold text-[#22FF66] caret-[#22FF66] placeholder:text-[#14993D] focus:outline-none ${
                    showValidationError
                      ? "border-[#FF4D4D] user-invalid-fallback"
                      : "border-[#22FF66]"
                  }`}
                />

                <button
                  type="submit"
                  data-testid="ninety9-cobol-submit-btn"
                  className="n99-touch-btn shrink-0 border-2 border-[#22FF66] bg-[#22FF66] px-5 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-[#020A04] hover:bg-[#020A04] hover:text-[#22FF66] transition-colors cursor-pointer"
                >
                  EXEC BOOT // ENTER ARCHIVE →
                </button>
              </div>
            </div>

            {showValidationError && (
              <div
                id={errorId}
                role="alert"
                data-testid="ninety9-cobol-error"
                className="border-2 border-[#FF4D4D] bg-[#290707] px-3 py-2 font-mono text-xs font-bold uppercase text-[#FF4D4D]"
              >
                {validation.error}
              </div>
            )}

            <div id={liveId} className="sr-only" aria-live="polite">
              {showValidationError ? validation.error : ""}
            </div>
          </form>
        </div>
      </div>
    </section>
  );
};
