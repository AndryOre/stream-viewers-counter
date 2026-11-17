const EXTERNAL_REFERENCE_PATTERNS: readonly RegExp[] = [
  /\b(?:src|href|action|poster|data)\s*=\s*["']?\s*(?:https?:)?\/\//gi,
  /url\(\s*["']?\s*(?:https?:)?\/\//gi,
  /@import\b/gi,
  /<link\b[^>]*\brel\s*=\s*["']?(?:stylesheet|preload|modulepreload)/gi,
];

export function findExternalReferences(html: string): string[] {
  return EXTERNAL_REFERENCE_PATTERNS.flatMap((pattern) => html.match(pattern) ?? []);
}
