export const DEFAULT_ALLOWED_ORIGINS: string[];
export function resolveAllowedOrigins(): Set<string>;
export function applyCorsHeaders(req: any, res: any): boolean;

