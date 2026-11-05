import fs from 'node:fs';
import path from 'node:path';

/**
 * Source-text tests read a component together with the modules it was split into, so
 * moving code into a companion hook does not break checks on what the component does.
 */
const COMPANIONS: Record<string, string> = {
  'src/components/ListeningView.tsx': 'src/components/listening-view',
  'src/context/PlayerContext.tsx': 'src/context/player-context',
};

export function readModuleSource(file: string): string {
  const absolute = path.resolve(file);
  const relative = path.relative(process.cwd(), absolute).split(path.sep).join('/');
  const source = fs.readFileSync(absolute, 'utf8');
  const companionDir = COMPANIONS[relative];
  if (!companionDir) return source;
  const parts = fs
    .readdirSync(companionDir)
    .filter((name) => /\.tsx?$/.test(name))
    .sort()
    .map((name) => fs.readFileSync(path.join(companionDir, name), 'utf8'));
  return [source, ...parts].join('\n');
}
