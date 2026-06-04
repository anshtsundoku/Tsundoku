import { GuideShell, Step, Url, GuideLink } from './guideKit.jsx';

export default function GmailGuide() {
  return (
    <GuideShell
      heading="how connecting gmail works"
      sub="google's official sign-in. ~30 seconds."
      note="we store only an encrypted token. your password never touches tsundoku. revoke access any time at myaccount.google.com/permissions."
    >
      <Step n={1}>
        click "connect gmail" — google will ask for your permission.
      </Step>
      <Step n={2}>
        google will say "tsundoku isn't verified" — that's expected for friends-only apps. click "advanced" → "go to tsundoku (unsafe)". it's safe; it's google's default warning for personal projects.
      </Step>
      <Step n={3}>
        allow tsundoku to read your gmail. we only read; we never send, modify, or delete.
      </Step>
      <Step n={4}>
        you'll come back here. add specific newsletter senders as gmail sources from the <GuideLink href="/sources">sources page</GuideLink>.
      </Step>
    </GuideShell>
  );
}
