/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

function resolveProjectFile(base: string): string | undefined {
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((candidate) => fs.existsSync(candidate));
}

/**
 * Evaluate the real module with controlled boundary dependencies.
 *
 * Project imports (`@/...` and relative paths to `.ts`/`.tsx` files) load through this
 * function too, so stubs apply at every depth. Each top-level call shares one module
 * cache, so a module imported from two places is one instance, as at runtime.
 */
export function loadTs(
  file: string,
  stubs: Record<string, unknown> = {},
  cache: Map<string, unknown> = new Map(),
): Record<string, (...args: any[]) => any> {
  const absolute = path.resolve(file);
  if (cache.has(absolute)) return cache.get(absolute) as Record<string, (...args: any[]) => any>;

  const source = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.React },
  }).outputText;
  const module = { exports: {} as Record<string, unknown> };
  cache.set(absolute, module.exports);

  const nativeRequire = createRequire(absolute);
  const require = (name: string) => {
    if (Object.hasOwn(stubs, name)) return stubs[name];
    let target: string | undefined;
    if (name.startsWith('@/')) {
      target = resolveProjectFile(path.resolve('src', name.slice(2)));
    } else if (name.startsWith('./') || name.startsWith('../')) {
      target = resolveProjectFile(path.resolve(path.dirname(absolute), name));
    }
    return target ? loadTs(target, stubs, cache) : nativeRequire(name);
  };
  new Function('require', 'module', 'exports', '__dirname', source)(require, module, module.exports, path.dirname(absolute));
  return module.exports as Record<string, (...args: any[]) => any>;
}
