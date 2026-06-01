import { useEffect, useState } from 'react';
import BookStack from './BookStack.jsx';
import { quoteForStep } from './quotes.js';

export default function Interstitial({ stepNum, onContinue }) {
  const [ready, setReady] = useState(false);
  const quote = quoteForStep(stepNum - 1);

  useEffect(() => {
    setReady(false);
    const t = setTimeout(() => setReady(true), 600);
    return () => clearTimeout(t);
  }, [stepNum]);

  return (
    <div
      className="min-h-screen bg-bg text-ink flex flex-col px-6 onboarding-fade-in"
      style={{
        paddingTop: 'max(2.5rem, env(safe-area-inset-top))',
        paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full text-center">
        <BookStack count={stepNum} />
        <blockquote
          className="mt-10 text-lg italic text-ink leading-snug max-w-[18rem]"
          style={{ fontFamily: 'Carlito, Calibri, sans-serif' }}
        >
          {quote.text}
        </blockquote>
        <p className="mt-3 text-xs text-muted">— {quote.who}</p>
        <p className="mt-8 text-[10px] text-muted tracking-wide">step {stepNum} of 6</p>
      </div>
      <button
        type="button"
        onClick={onContinue}
        disabled={!ready}
        className="w-full max-w-md mx-auto bg-wood text-bg font-bold tt-label tracking-eyebrow text-sm py-3 hover:bg-wood-2 disabled:opacity-40 transition-opacity"
      >
        continue
      </button>
    </div>
  );
}
