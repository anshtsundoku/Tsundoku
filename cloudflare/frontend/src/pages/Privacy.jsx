import { Link } from 'react-router-dom';
import Markdown from '../components/Markdown.jsx';
import { PRIVACY_MD } from '../lib/legalContent.js';

export default function Privacy() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <Link to="/" className="eyebrow text-muted hover:text-ink transition-colors">← home</Link>
      <div className="mt-6">
        <Markdown source={PRIVACY_MD} />
      </div>
    </main>
  );
}
