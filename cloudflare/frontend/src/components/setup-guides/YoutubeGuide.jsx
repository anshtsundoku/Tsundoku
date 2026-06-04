import { GuideShell, Step, Url, GuideLink } from './guideKit.jsx';

export default function YoutubeGuide() {
  return (
    <GuideShell
      heading="how to get a youtube api key"
      sub="free, ~3 minutes."
      note="your key never leaves tsundoku unencrypted. you can disconnect it any time."
    >
      <Step n={1}>
        open google cloud console at <GuideLink href="https://console.cloud.google.com"><Url>console.cloud.google.com</Url></GuideLink> — sign in with your google account.
      </Step>
      <Step n={2}>
        at the top of the page, pick or create a project. naming it "tsundoku" is fine.
      </Step>
      <Step n={3}>
        in the search bar at the top, type "youtube data api v3" and click the first result. click the blue "enable" button.
      </Step>
      <Step n={4}>
        in the left sidebar, find "apis &amp; services" → "credentials". click "create credentials" → "api key".
      </Step>
      <Step n={5}>
        google generates a long string. that's your key. copy it.
      </Step>
      <Step n={6}>
        (recommended) next to your new key, click edit. under "api restrictions", select "restrict key" → pick "youtube data api v3". save. this limits damage if the key ever leaks.
      </Step>
      <Step n={7}>
        come back here, paste the key in the input below, and hit save.
      </Step>
    </GuideShell>
  );
}
