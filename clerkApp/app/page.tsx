import { auth } from "@clerk/nextjs/server";
import Link from "next/link";

const organizerFeatures = [
  "Sign in with Clerk to manage event access and photo review.",
  "Open the organizer workspace for uploads, review queues, and sharing links."
];

const attendeeFeatures = [
  "Search by event name or event key on the attendee page.",
  "Use a QR code link to jump straight into the correct event."
];

export default async function Home() {
  const { userId } = await auth();
  const organizerHref = userId ? "/organizer" : "/sign-in?redirect_url=%2Forganizer";

  return (
    <main className="audience-page">
      <section className="audience-hero">
        <div className="audience-copy">
          <div className="brand-lockup">
            <div className="brand-mark" aria-hidden="true">
              a
            </div>
            <div>
              <strong>Anonify</strong>
              <small>Privacy-first event photo review</small>
            </div>
          </div>

          <p className="section-label">Choose your path</p>
          <h1>Start as an organizer or attendee.</h1>
          <p className="audience-intro">
            Organizers sign in to manage event review. Attendees head straight to event
            lookup, where they can search for their event or arrive from a QR code.
          </p>
        </div>

        <div className="audience-grid" aria-label="Choose organizer or attendee">
          <article className="audience-option">
            <div className="audience-icon" aria-hidden="true">
              <OrganizerIcon />
            </div>
            <div>
              <p className="section-label">Organizer</p>
              <h2>Open the event workspace</h2>
              <p className="helper-text">
                Use Clerk sign-in, then continue into the organizer dashboard for event
                setup and photo review.
              </p>
            </div>
            <ul className="audience-list">
              {organizerFeatures.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="audience-actions">
              <Link className="primary-button full" href={organizerHref}>
                {userId ? "Continue to organizer" : "Organizer sign in"}
              </Link>
            </div>
          </article>

          <article className="audience-option attendee">
            <div className="audience-icon" aria-hidden="true">
              <AttendeeIcon />
            </div>
            <div>
              <p className="section-label">Attendee</p>
              <h2>Find your event and submit</h2>
              <p className="helper-text">
                Go to the attendee flow to search by event key, choose the right event,
                or use a QR entry link when one is shared with you.
              </p>
            </div>
            <ul className="audience-list">
              {attendeeFeatures.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="audience-actions">
              <Link className="secondary-button full" href="/attend">
                Go to attendee lookup
              </Link>
            </div>
          </article>
        </div>
      </section>
    </main>
  );
}

function OrganizerIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="28"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="28"
    >
      <path d="M12 3 4 7v6c0 5 3.4 7.8 8 9 4.6-1.2 8-4 8-9V7Z" />
      <path d="M9.5 12.5 11 14l3.5-4" />
    </svg>
  );
}

function AttendeeIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="28"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="28"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.35-4.35" />
      <path d="M8.5 11h5" />
      <path d="M11 8.5v5" />
    </svg>
  );
}
