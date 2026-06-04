import { GuideShell, Step, Url, GuideLink } from './guideKit.jsx';

export default function XGuide() {
  return (
    <GuideShell
      heading="how to connect x"
      sub="x has no public api. we read posts with your browser cookies. ~2 minutes."
      note="these cookies stay valid as long as you stay signed in to x in chrome. if you sign out, redo these steps to get fresh ones. you'll know they expired when posts stop arriving — your settings card will mark the connection as broken."
    >
      <Step n={1}>
        open chrome and sign in to <GuideLink href="https://x.com"><Url>x.com</Url></GuideLink> normally.
      </Step>
      <Step n={2}>
        right-click anywhere on x.com → click "inspect". a panel opens at the side or bottom. that's devtools.
      </Step>
      <Step n={3}>
        at the top of devtools, find the "application" tab. if it's hidden behind a &raquo; menu, click &raquo; and pick application.
      </Step>
      <Step n={4}>
        in devtools' left sidebar, expand "cookies" → click <Url>https://x.com</Url>.
      </Step>
      <Step n={5}>
        find the row named "auth_token". click it. copy the value column (it's a long string).
      </Step>
      <Step n={6}>
        find the row named "ct0". copy its value the same way.
      </Step>
      <Step n={7}>
        paste auth_token in the first field below, ct0 in the second. hit save.
      </Step>
    </GuideShell>
  );
}
