import { auth } from "@clerk/nextjs/server";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";

export default async function Home() {
  const { userId } = await auth();
  const organizerHref = userId ? "/organizer" : "/sign-in?redirect_url=%2Forganizer";

  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="scan-stage" aria-hidden="true">
          <div className="scan-card">
            <span className="face-frame">
              <span className="smiley-eye left" />
              <span className="smiley-eye right" />
              <span className="smiley-cheek left" />
              <span className="smiley-cheek right" />
              <span className="smiley-mouth" />
            </span>
            <span className="scan-line" />
            <span className="privacy-chip">Opt-out detected</span>
          </div>
        </div>

        <div className="landing-copy">
          <BrandLogo subtitle="privacy-first event photos" />

          <p className="section-label">Face detection with consent built in</p>
          <h1>
            Share the moment.
            <span> Protect the people.</span>
          </h1>
          <p className="audience-intro">
            Anonify helps organizers detect opted-out attendees, anonymize faces,
            and export demo-ready event photos without making privacy feel heavy.
          </p>

          <div className="landing-actions" aria-label="Choose your Anonify experience">
            <Link className="primary-button landing-cta" href={organizerHref}>
              I&apos;m an Organizer
            </Link>
            <Link className="secondary-button landing-cta" href="/attend">
              I&apos;m an Attendee
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
