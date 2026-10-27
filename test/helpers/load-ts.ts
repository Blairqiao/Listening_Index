/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';

/** Evaluate the real module with controlled boundary dependencies. */
export function loadTs(file: string, stubs: Record<string, unknown> = {}): Record<string, (...args: any[]) => any> {
  const absolute=path.resolve(file);
  const source=ts.transpileModule(fs.readFileSync(absolute,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const module={exports:{}};
  const nativeRequire=createRequire(absolute);
  const require=(name:string)=>{
    if(Object.hasOwn(stubs,name)) return stubs[name];
    if(name.startsWith('@/'))return loadTs(`src/${name.slice(2)}.ts`,stubs);
    return nativeRequire(name);
  };
  new Function('require','module','exports','__dirname',source)(require,module,module.exports,path.dirname(absolute));
  return module.exports;
}
