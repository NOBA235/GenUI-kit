import React, { useMemo } from "react";
import { JSONUIProvider } from "@json-render/react";
import {
  InteractionSurface,
  SafeGenUIRenderer,
  createTelemetryTracker,
  parseInteractionEventParams,
  withInteractionKeys,
  wrapRegistryWithTelemetry,
} from "@genui-studio/core";
import { playableCatalog } from "../playable/catalog.js";
import { playableRegistry } from "../playable/components.js";
import type { PlayableSession, PlayableSessionView } from "../lib/playable-session.js";

export interface PlayableStageProps {
  readonly session: PlayableSession;
  readonly view: PlayableSessionView;
  /** Clicks/drags dispatch to the rule engine (Play mode). */
  readonly interactive: boolean;
  readonly selectedElementKey?: string | null;
  readonly onSelectElement?: (elementKey: string | null) => void;
}

const keyedRegistry = withInteractionKeys(playableRegistry);

/**
 * Live preview of a playable blueprint. The Spec renders through SafeGenUIRenderer over the
 * session's TimeTravelStateStore; clicks, drags and drops become InteractionEvents for the
 * rule engine. (Key presses and timer ticks are driven by the page so they keep running
 * while another tab is open.)
 */
export const PlayableStage: React.FC<PlayableStageProps> = ({
  session,
  view,
  interactive,
  selectedElementKey = null,
  onSelectElement,
}) => {
  const blueprint = session.getBlueprint();
  const telemetryTracker = useMemo(() => createTelemetryTracker(), []);
  const safeRegistry = useMemo(
    () =>
      wrapRegistryWithTelemetry(playableCatalog, keyedRegistry, {
        telemetryTracker,
        showHealedBadges: true,
      }),
    [telemetryTracker],
  );
  const handlers = useMemo(
    () => ({
      dispatchInteraction: (params: Record<string, unknown>) => {
        const event = parseInteractionEventParams(params);
        if (event) session.dispatch(event);
      },
    }),
    [session],
  );

  return (
    <InteractionSurface
      rules={blueprint.rules}
      dispatch={session.dispatch}
      interactive={interactive}
      onSelectElement={onSelectElement}
      selectedElementKey={selectedElementKey}
      data-testid="playable-stage"
      className="playable-stage"
    >
      <div data-outcome={view.outcome} data-scene={view.scene} data-testid="playable-stage-state">
        <JSONUIProvider key={view.engineId} registry={safeRegistry} store={session.getStore()} handlers={handlers}>
          <SafeGenUIRenderer
            spec={blueprint.spec}
            registry={safeRegistry}
            catalog={playableCatalog}
            telemetryTracker={telemetryTracker}
          />
        </JSONUIProvider>
      </div>
    </InteractionSurface>
  );
};
