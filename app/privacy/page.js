export const metadata = { title: 'Privacy Policy · mybirthday.life' };
export default function Privacy() {
  return (
    <div className="card">
      <h1>Privacy Policy</h1>
      <p className="err"><strong>DRAFT placeholder.</strong> Final wording must be reviewed by a lawyer (GDPR) before launch.</p>
      <h3>What we collect</h3>
      <ul>
        <li>Account: name, email, birth date, time zone, country.</li>
        <li>Guests who send wishes: name, email, birth date, city (used for reminders and anonymous geo-pings).</li>
        <li>Uploads: photos, voice notes and videos you send.</li>
      </ul>
      <h3>Your rights</h3>
      <p>You can delete your account and all your data at any time from your board page.</p>
    </div>
  );
}
