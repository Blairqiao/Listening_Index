import crypto from 'node:crypto';
import { getCronKey } from '@/lib/db/queries';
import { isDbConfigured } from '@/lib/db';

function safeCompare(a: string, b: string): boolean {
  return crypto.timingSafeEqual(
    crypto.createHash('sha256').update(a).digest(),
    crypto.createHash('sha256').update(b).digest()
  );
}

export async function isAuthorizedCronRequest(
  request: Request,
  options: { allowLegacySecret?: boolean } = {}
): Promise<boolean> {
  const authorization = request.headers.get('authorization');
  const url = new URL(request.url);
  const dbConfigured = isDbConfigured();

  const token =
    (authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '') ||
    url.searchParams.get('key')?.trim() ||
    (!dbConfigured && options.allowLegacySecret ? url.searchParams.get('secret')?.trim() : '');

  if (!token) return false;

  if (dbConfigured) {
    const key = await getCronKey({ allowLegacyFallback: false });
    return Boolean(key && safeCompare(token, key));
  }

  if (options.allowLegacySecret && process.env.CRON_SECRET) {
    return safeCompare(token, process.env.CRON_SECRET);
  }

  return false;
}
