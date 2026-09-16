export function Footer() {
  return (
    <footer className="border-t border-border py-8 text-center text-sm text-muted">
      <p>CineBook — a local development demo. Payments are simulated; no real transactions occur.</p>
      <p className="mt-1">&copy; {new Date().getFullYear()} CineBook.</p>
    </footer>
  );
}
