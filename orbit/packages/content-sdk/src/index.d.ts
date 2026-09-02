
export declare class ContentRequestError extends Error { status: number; correlationId: string }
export declare function createContentClient(options?: {baseUrl?: string; fetchImpl?: typeof fetch; timeoutMs?: number}): Readonly<Record<string, Function>>;
export declare function getShellBundle(client: Record<string, Function>, brand: string, application: string): Promise<Readonly<Record<string, unknown>>>;
export declare const orbitContentVersion: string;
