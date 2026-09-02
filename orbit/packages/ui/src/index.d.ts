
export interface OrbitNavigationItem { label: string; href: string; current?: boolean }
export interface OrbitSession { authenticated: boolean; displayName?: string }
export declare function createOrbitHeader(options?: Record<string, unknown>): HTMLElement;
export declare function createOrbitFooter(options?: Record<string, unknown>): HTMLElement;
export declare function createOrbitAuthShell(options?: Record<string, unknown>): HTMLElement;
export declare function mountOrbitPage(options: Record<string, unknown>): {root: HTMLElement; unmount: () => void};
export declare const orbitUiVersion: string;
