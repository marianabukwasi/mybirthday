export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard', '/media/'] },
    sitemap: 'https://mybirthday.life/sitemap.xml',
  };
}
