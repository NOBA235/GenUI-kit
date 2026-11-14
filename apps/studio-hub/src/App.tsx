import React, { useCallback, useEffect, useState } from "react";
import { MarketplacePage } from "./pages/MarketplacePage.js";
import { PreviewPage } from "./pages/PreviewPage.js";

export interface AppRouteState {
  readonly path: string;
  readonly fullscreen: boolean;
}

function readWindowRoute(): AppRouteState {
  if (typeof window === "undefined") {
    return { path: "/", fullscreen: false };
  }
  const params = new URLSearchParams(window.location.search);
  return {
    path: window.location.pathname || "/",
    fullscreen: params.get("fullscreen") === "true",
  };
}

export interface StudioHubAppProps {
  readonly initialPath?: string;
  readonly initialFullscreen?: boolean;
  readonly instantStreamForTest?: boolean;
}

export const App: React.FC<StudioHubAppProps> = ({
  initialPath,
  initialFullscreen,
  instantStreamForTest = false,
}) => {
  const [route, setRoute] = useState<AppRouteState>(() => {
    if (initialPath !== undefined) {
      return {
        path: initialPath,
        fullscreen: Boolean(initialFullscreen),
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

  const navigate = useCallback((nextPath: string, fullscreen = false) => {
    const url = fullscreen ? `${nextPath}?fullscreen=true` : nextPath;
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", url);
    }
    setRoute({ path: nextPath, fullscreen });
  }, []);

  const previewMatch = /^\/preview\/([^/?#]+)\/?$/.exec(route.path);
  if (previewMatch && previewMatch[1]) {
    const slug = decodeURIComponent(previewMatch[1]);
    return (
      <PreviewPage
        slug={slug}
        isFullscreen={route.fullscreen}
        onToggleFullscreen={() => navigate(`/preview/${slug}`, !route.fullscreen)}
        onNavigateHome={() => navigate("/", false)}
        instantStreamForTest={instantStreamForTest}
      />
    );
  }

  return (
    <MarketplacePage
      onOpenPreview={(slug) => navigate(`/preview/${encodeURIComponent(slug)}`, false)}
    />
  );
};
