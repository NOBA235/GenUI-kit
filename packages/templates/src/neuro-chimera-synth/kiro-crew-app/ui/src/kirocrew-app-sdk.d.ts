/**
 * Minimal local type subset for the Kiro Crew App SDK, covering only what App.tsx uses.
 *
 * The Crew dashboard serves the full declarations at /vendor/kirocrew-app-sdk.d.ts. To use
 * them, replace this file with:
 *   curl --fail -o ui/src/kirocrew-app-sdk.d.ts http://localhost:5476/vendor/kirocrew-app-sdk.d.ts
 * The SDK itself is never installed or bundled: the host provides it through its import map.
 */

declare module "@kirocrew/app-sdk" {
  export interface AppApi {
    get<T = unknown>(path: string, init?: RequestInit): Promise<T>;
  }
  export function useAppApi(): AppApi;
  export function useAppEvents(event: string, callback: (event: unknown) => void): void;
  export interface OpenChatOptions {
    readonly message: string;
    readonly autoSend?: boolean;
    readonly agent?: string;
  }
  export function useChatLauncher(): { openChat(options: OpenChatOptions): unknown };
}

declare module "@kirocrew/app-sdk/ui" {
  import type { ReactNode } from "react";
  export function PageHeader(props: { title: string; subtitle?: string }): ReactNode;
  export function Card(props: { children?: ReactNode }): ReactNode;
  export function CardTitle(props: { children?: ReactNode }): ReactNode;
  export function StatCard(props: { label: string; value: ReactNode; accent?: boolean }): ReactNode;
}
