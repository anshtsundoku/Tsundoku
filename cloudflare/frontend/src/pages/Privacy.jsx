import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center gap-4 px-6">
      <h1 className="text-2xl font-bold tt-title tracking-tight">Privacy</h1>
      <p className="text-muted">coming soon</p>
      <Link to="/" className="eyebrow text-wood hover:underline">← home</Link>
    </main>
  );
}
