const dns = require('dns').promises;

const DEFAULT_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

/**
 * Windows / some routers refuse SRV queries from Node's default DNS resolver
 * (querySrv ECONNREFUSED). Resolve mongodb+srv manually via public DNS, then
 * connect with a standard mongodb:// URI the driver can use without SRV lookup.
 */
async function resolveMongoUri(uri) {
  const trimmed = uri?.trim();
  if (!trimmed || !trimmed.startsWith('mongodb+srv://')) {
    return trimmed;
  }

  const customDns = process.env.MONGODB_DNS_SERVERS?.split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const resolver = new dns.Resolver();
  resolver.setServers(customDns?.length ? customDns : DEFAULT_DNS_SERVERS);

  const withoutScheme = trimmed.slice('mongodb+srv://'.length);
  const atIndex = withoutScheme.lastIndexOf('@');
  if (atIndex === -1) {
    throw new Error('Invalid MONGODB_URI: missing @ in mongodb+srv URL');
  }

  const credentials = withoutScheme.slice(0, atIndex);
  const hostAndRest = withoutScheme.slice(atIndex + 1);
  const slashIndex = hostAndRest.indexOf('/');
  const hostname = slashIndex === -1 ? hostAndRest : hostAndRest.slice(0, slashIndex);
  const pathAndQuery = slashIndex === -1 ? '' : hostAndRest.slice(slashIndex);

  const srvName = `_mongodb._tcp.${hostname}`;
  const [srvRecords, txtRecords] = await Promise.all([
    resolver.resolveSrv(srvName),
    resolver.resolveTxt(hostname).catch(() => []),
  ]);

  if (!srvRecords.length) {
    throw new Error(`No MongoDB SRV records found for ${hostname}`);
  }

  const hosts = srvRecords.map((r) => `${r.name}:${r.port}`).join(',');
  const txtOptions = txtRecords
    .flat()
    .join('&')
    .split('&')
    .filter(Boolean);

  const optionMap = new Map();
  for (const part of txtOptions) {
    const [key, ...rest] = part.split('=');
    if (key) optionMap.set(key, rest.join('='));
  }

  optionMap.set('ssl', optionMap.get('ssl') ?? 'true');
  optionMap.set('authSource', optionMap.get('authSource') ?? 'admin');

  const queryFromUri = pathAndQuery.includes('?') ? pathAndQuery.split('?')[1] : '';
  if (queryFromUri) {
    for (const part of queryFromUri.split('&')) {
      const [key, ...rest] = part.split('=');
      if (key) optionMap.set(key, rest.join('='));
    }
  }

  const dbPath = pathAndQuery.split('?')[0] || '';
  const query = [...optionMap.entries()].map(([k, v]) => `${k}=${v}`).join('&');

  return `mongodb://${credentials}@${hosts}${dbPath}?${query}`;
}

module.exports = { resolveMongoUri };
