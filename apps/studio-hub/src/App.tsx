import React, { useCallback, useEffect, useState } from "react";
import { getTemplateBySlug } from "@genui-studio/templates";
import { MarketplacePage } from "./pages/MarketplacePage.js";
import { PlayableWorkbenchPage } from "./pages/PlayableWorkbenchPage.js";
import { PreviewPage } from "./pages/PreviewPage.js";
import type { WireframeInitialScene } from "./components/WireframeArchitectCanvas.js";
import {
  SAMPLE_WIREFRAME_FALLBACK_SLUG,
  SAMPLE_WIREFRAME_SLUG,
} from "./lib/workbench-entry.js";

/** `null` = Wireframe Architect closed on entry; otherwise the scene it opens with. */
export type WireframeRouteMode = WireframeInitialScene | null;

export interface AppRouteState {
  readonly path: string;
  readonly fullscreen: boolean;
  readonly wireframe: WireframeRouteMode;
}

function parseWireframeParam(raw: string | null): WireframeRouteMode {
  if (raw === "sample") return "sample";
  if (raw === "true" || raw === "template") return "template";
  return null;
}

function readWindowRoute(): AppRouteState {
  if (typeof window === "undefined") {
    return { path: "/", fullscreen: false, wireframe: null };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    path: window.location.pathname || "/",
    fullscreen: params.get("fullscreen") === "true",
    wireframe: parseWireframeParam(params.get("wireframe")),
  };
}

function buildRouteUrl(path: string, fullscreen: boolean, wireframe: WireframeRouteMode): string {
  const params = new URLSearchParams();
  if (fullscreen) params.set("fullscreen", "true");
  if (wireframe === "sample") params.set("wireframe", "sample");
  else if (wireframe === "template") params.set("wireframe", "true");
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

/** Slug the "Open Sample Wireframe" call-to-action opens. */
export function resolveSampleWireframeSlug(): string {
  return getTemplateBySlug(SAMPLE_WIREFRAME_SLUG)
    ? SAMPLE_WIREFRAME_SLUG
    : SAMPLE_WIREFRAME_FALLBACK_SLUG;
}

export interface StudioHubAppProps {
  readonly initialPath?: string;
  readonly initialFullscreen?: boolean;
  /** Test/SSR override for the `?wireframe=` query (`"sample"`, `"template"`). */
  readonly initialWireframe?: WireframeRouteMode;
  readonly instantStreamForTest?: boolean;
}

export const App: React.FC<StudioHubAppProps> = ({
  initialPath,
  initialFullscreen,
  initialWireframe = null,
  instantStreamForTest = false,
}) => {
  const [route, setRoute] = useState<AppRouteState>(() => {
    if (initialPath !== undefined) {
      return {
        path: initialPath,
        fullscreen: Boolean(initialFullscreen),
        wireframe: initialWireframe,
      };
    }
    return readWindowRoute();
  });

  useEffect(() => {
    if (typeof window === "undefined" || initialPath !== undefined) return;
    const onPopState = () => setRoute(readWindowRoute());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [initialPath]);

  const isPlayableRoute = /^\/play\/?$/.test(route.path);
  const previewMatch = /^\/preview\/([^/?#]+)(?:\/(.*))?$/.exec(route.path);
  const matchedSlug = previewMatch?.[1] ? decodeURIComponent(previewMatch[1]) : null;

  // Keep document.title synchronized on SPA transitions (WCAG 2.4.2 Page Titled)
  useEffect(() => {
    if (typeof document === "undefined" || isPlayableRoute) return;
    if (matchedSlug) {
      const tpl = getTemplateBySlug(matchedSlug);
      const label = tpl?.manifest.title ?? matchedSlug;
      document.title = route.wireframe
        ? `${label} · Wireframe Architect | WizFrame`
        : `${label} · Preview | WizFrame`;
    } else {
      document.title = "WizFrame — Interactive UI Workbench";
    }
  }, [matchedSlug, route.wireframe, isPlayableRoute]);

  const navigate = useCallback(
    (nextPath: string, fullscreen = false, wireframe: WireframeRouteMode = null) => {
      if (typeof window !== "undefined") {
        window.history.pushState({}, "", buildRouteUrl(nextPath, fullscreen, wireframe));
      }
      setRoute({ path: nextPath, fullscreen, wireframe });
    },
    [],
  );

  if (isPlayableRoute) {
    return <PlayableWorkbenchPage onNavigateHome={() => navigate("/", false)} />;
  }

  if (matchedSlug) {
    const subPath = previewMatch?.[2]
      ? decodeURIComponent(previewMatch[2]).replace(/\/+$/, "")
      : undefined;
    return (
      <PreviewPage
        slug={matchedSlug}
        initialSubPath={subPath}
        isFullscreen={route.fullscreen}
        onToggleFullscreen={() =>
          navigate(
            subPath ? `/preview/${matchedSlug}/${subPath}` : `/preview/${matchedSlug}`,
            !route.fullscreen,
            route.wireframe,
          )
        }
        onNavigateHome={() => navigate("/", false)}
        instantStreamForTest={instantStreamForTest}
        initialWireframeMode={route.wireframe !== null}
        initialWireframeScene={route.wireframe ?? "template"}
      />
    );
  }

  return (
    <MarketplacePage
      onOpenPreview={(slug) => navigate(`/preview/${encodeURIComponent(slug)}`, false)}
      onOpenSampleWireframe={() =>
        navigate(`/preview/${encodeURIComponent(resolveSampleWireframeSlug())}`, false, "sample")
      }
      onOpenPlayableStarter={() => navigate("/play", false)}
    />
  );
};
