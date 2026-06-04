import { Link } from 'react-router-dom';
import Markdown from '../components/Markdown.jsx';
import { TERMS_MD } from '../lib/legalContent.js';

export default function Terms() {
  return (
    <main className="max-w-2xl mx-auto px-6 py-10">
      <Link to="/" className="eyebrow text-muted hover:text-ink transition-colors">← home</Link>
      <div className="mt-6">
        <Markdown source={TERMS_MD} />
      </div>
    </main>
  );
}
