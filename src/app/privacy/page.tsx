import type { Metadata } from 'next'
import Link from 'next/link'
import DeleteAccount from './DeleteAccount'

// The privacy page. Written to be TRUE of the code as it actually is, not aspirational
// boilerplate: every cookie and storage key named here exists, and the delete button below
// runs a real delete. If the app ever gains analytics, an ad network, or server-side garden
// saves, this page is wrong the same day and has to change with it.

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What ather.games stores, what it does not, and how to delete your account.',
}

const UPDATED = '25 July 2026'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl text-[#d4a843] mb-3">{title}</h2>
      <div className="space-y-3 text-text-dim leading-relaxed">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#050508] px-6 py-16">
      <div className="max-w-2xl mx-auto">
        <Link href="/room" className="text-text-faint text-sm hover:text-text-dim transition-colors">
          &larr; back to ather.games
        </Link>

        <h1 className="font-display text-4xl text-text mt-6 mb-2">Privacy</h1>
        <p className="text-text-faint text-sm mb-12">Last updated {UPDATED}</p>

        <Section title="The short version">
          <p>
            ather.games is a small independent games site. There are no analytics, no advertising, no
            tracking pixels, and no third party cookies. Nothing about you is sold or shared. The only
            cookies here are the ones that keep you signed in, and you only get those if you choose to
            sign in.
          </p>
        </Section>

        <Section title="Playing without an account">
          <p>
            Every game runs without signing in. When you play anonymously, your progress is stored in
            your own browser and never reaches our server. That includes:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code className="text-text">ather:save:shimmer</code> — your Shimmer save, including your garden and everything you have built in it</li>
            <li><code className="text-text">ather:mp:name</code>, <code className="text-text">ather:mp:party</code>, <code className="text-text">ather:mp:id</code> — your display name, party code, and a random id used so other players in your world can be told apart</li>
            <li>per game settings and high scores, such as <code className="text-text">manana.best</code> and <code className="text-text">nolmir.forge.v1</code></li>
          </ul>
          <p>
            Clearing your browser&apos;s site data for ather.games deletes all of it. We cannot recover it,
            because we never had it.
          </p>
        </Section>

        <Section title="Cookies">
          <p>These are the only cookies this site sets, and every one of them is necessary for something you asked for:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><code className="text-text">ather_session</code> — set when you sign in, so you stay signed in. Expires after 30 days. Cannot be read by scripts.</li>
            <li><code className="text-text">ather_oauth_state</code> and <code className="text-text">ather_oauth_next</code> — set for about ten minutes during sign in. One protects the login against request forgery, the other remembers which page to return you to.</li>
            <li><code className="text-text">ather_owner</code> — used only by the site owner to reach the map and sprite editors.</li>
          </ul>
          <p>
            There is no consent banner because there is nothing here to consent to. Cookie banners exist
            for tracking, and this site does not track you.
          </p>
        </Section>

        <Section title="If you sign in with Google">
          <p>Signing in is optional. It exists so that a name can be yours, and so friends and shared gardens can work. If you do sign in, Google tells us three things:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>your Google account id, which is how we recognise you next time</li>
            <li>your email address</li>
            <li>your profile picture, if you have one</li>
          </ul>
          <p>
            We store those alongside the username you pick and the friends you add. We do not email you,
            we do not sell or share any of it, and we do not use it for advertising. Google&apos;s own handling
            of your sign in is covered by Google&apos;s privacy policy.
          </p>
          <p>
            Your garden save stays in your browser even when you are signed in. Signing in does not upload it.
          </p>
        </Section>

        <Section title="Arcade leaderboards">
          <p>
            If you post a score to a daily leaderboard, the board stores your display name, your score, and
            the time, and shows them publicly to anyone who opens that game. Pick a display name you are
            happy for strangers to see. Boards are kept per day and the older ones fall off.
          </p>
        </Section>

        <Section title="Server logs">
          <p>
            Like any web server, ours records ordinary request logs, which include IP addresses, so that
            things can be debugged and abuse can be spotted. These rotate and are discarded within about a
            week. They are not used to build a profile of you.
          </p>
        </Section>

        <Section title="Children">
          <p>
            This is a family friendly site with no advertising and no profiling, but accounts are not aimed
            at young children. If your child has signed in and you want the account removed, delete it below
            or ask and we will.
          </p>
        </Section>

        <Section title="Deleting your account">
          <p>
            You can delete your account whenever you want. It removes your account, your username, and your
            friend list from our server for good. It does not touch the save in your browser, which is yours
            and which clearing site data will remove.
          </p>
          <div className="mt-5 p-5 rounded-xl border border-white/10 bg-white/[0.02]">
            <DeleteAccount />
          </div>
        </Section>

        <Section title="Changes">
          <p>
            If what this site stores ever changes, this page changes with it and the date at the top moves.
          </p>
        </Section>

        <p className="text-text-faint text-sm mt-16">
          ather.games is part of the Athernyx project.
        </p>
      </div>
    </main>
  )
}
