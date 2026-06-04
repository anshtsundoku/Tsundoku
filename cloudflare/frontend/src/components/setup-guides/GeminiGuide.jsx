import { GuideShell, Step, Url, GuideLink } from './guideKit.jsx';

export default function GeminiGuide() {
  return (
    <GuideShell
      heading="how to get a gemini api key"
      sub="free, ~1 minute. powers the tldr summaries."
      note="gemini's free tier covers way more than tsundoku will ever use. you won't see a bill."
    >
      <Step n={1}>
        open google ai studio at <GuideLink href="https://aistudio.google.com"><Url>aistudio.google.com</Url></GuideLink> — sign in with your google account.
      </Step>
      <Step n={2}>
        in the left sidebar, click "get api key".
      </Step>
      <Step n={3}>
        click "create api key" → "create api key in new project". google generates one instantly.
      </Step>
      <Step n={4}>
        copy the key.
      </Step>
      <Step n={5}>
        paste it in the input below and hit save.
      </Step>
    </GuideShell>
  );
}
