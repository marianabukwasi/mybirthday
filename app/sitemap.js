export default function sitemap() {
  const base = 'https://mybirthday.life';
  return ['', '/boards', '/deals', '/signup', '/login', '/terms', '/privacy'].map(p => ({
    url: `${base}${p}`,
    lastModified: new Date(),
  }));
}
