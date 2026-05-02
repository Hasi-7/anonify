"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  attendees,
  auditLog,
  events,
  photos,
  type EventPhoto,
  type EventSummary,
  type PhotoStatus
} from "@/lib/mock-data";

type DashboardTab = "overview" | "photos" | "review" | "attendees";
type AttendeeStep = "key" | "name" | "privacy" | "done";

const tabs: Array<{ id: DashboardTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "photos", label: "Photos" },
  { id: "review", label: "Review" },
  { id: "attendees", label: "Attendees" }
];

const statusCopy: Record<PhotoStatus, string> = {
  not_processed: "Queued",
  processing: "Processing",
  match: "Redacted",
  no_match: "Clear",
  manual_review: "Review",
  processed: "Processed"
};

export function AnonifyExperience() {
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const [activeTab, setActiveTab] = useState<DashboardTab>("overview");
  const [selectedPhotoId, setSelectedPhotoId] = useState(photos[1]?.id ?? photos[0]?.id ?? "");
  const [threshold, setThreshold] = useState(65);
  const [attendeeStep, setAttendeeStep] = useState<AttendeeStep>("key");
  const [attendeeName, setAttendeeName] = useState("");
  const [optOut, setOptOut] = useState(true);

  const event = useMemo(
    () => events.find((item) => item.id === selectedEventId) ?? events[0],
    [selectedEventId]
  );

  const selectedPhoto =
    photos.find((photo) => photo.id === selectedPhotoId) ??
    photos.find((photo) => photo.status === "manual_review") ??
    photos[0];

  const progress = Math.round((event.processed / Math.max(event.photos, 1)) * 100);

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid min-h-screen max-w-[1500px] gap-5 px-4 py-5 lg:grid-cols-[260px_minmax(0,1fr)_360px]">
        <aside className="rounded-lg border border-zinc-800 bg-zinc-900/80 p-4">
          <button
            className="mb-6 flex w-full items-center gap-3 text-left"
            onClick={() => setActiveTab("overview")}
            type="button"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-cyan-300 font-black text-zinc-950">
              a
            </span>
            <span>
              <span className="block font-semibold">Anonify</span>
              <span className="block text-xs text-zinc-400">event photo privacy</span>
            </span>
          </button>

          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-zinc-500">
            Events
          </p>
          <div className="space-y-2">
            {events.map((item) => (
              <button
                className={`w-full rounded-lg border p-3 text-left transition ${
                  item.id === event.id
                    ? "border-cyan-300 bg-cyan-300/10"
                    : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-700"
                }`}
                key={item.id}
                onClick={() => {
                  setSelectedEventId(item.id);
                  setActiveTab("overview");
                }}
                type="button"
              >
                <span className="block text-sm font-semibold">{item.name}</span>
                <span className="mt-1 flex items-center justify-between text-xs text-zinc-400">
                  <span>{item.date}</span>
                  <span>{item.key}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Auto blur threshold</span>
              <span className="font-mono text-cyan-200">{threshold}%</span>
            </div>
            <input
              aria-label="Auto blur threshold"
              className="mt-3 w-full accent-cyan-300"
              max={95}
              min={40}
              onChange={(event) => setThreshold(Number(event.target.value))}
              type="range"
              value={threshold}
            />
          </div>
        </aside>

        <section className="min-w-0 rounded-lg border border-zinc-800 bg-zinc-900">
          <header className="border-b border-zinc-800 p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">
                  Organizer workspace
                </p>
                <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">
                  {event.name}
                </h1>
                <p className="mt-2 max-w-2xl text-sm text-zinc-400">
                  Collect opt-out preferences, import event photos, and review uncertain
                  detections before anything is shared.
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:min-w-[360px]">
                <Metric label="Attendees" value={event.attendees} />
                <Metric label="Opt-outs" value={event.optOuts} tone="amber" />
                <Metric label="Review" value={event.needsReview} tone="cyan" />
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                    activeTab === tab.id
                      ? "bg-cyan-300 text-zinc-950"
                      : "bg-zinc-950 text-zinc-300 hover:bg-zinc-800"
                  }`}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </header>

          <div className="p-5">
            {activeTab === "overview" && (
              <Overview event={event} progress={progress} threshold={threshold} />
            )}
            {activeTab === "photos" && (
              <PhotoGrid
                onSelect={(photo) => {
                  setSelectedPhotoId(photo.id);
                  setActiveTab("review");
                }}
              />
            )}
            {activeTab === "review" && (
              <ReviewPhoto
                photo={selectedPhoto}
                setSelectedPhotoId={setSelectedPhotoId}
                threshold={threshold / 100}
              />
            )}
            {activeTab === "attendees" && <AttendeeTable />}
          </div>
        </section>

        <aside className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <AttendeePreview
            eventKey={event.key}
            name={attendeeName}
            optOut={optOut}
            setName={setAttendeeName}
            setOptOut={setOptOut}
            setStep={setAttendeeStep}
            step={attendeeStep}
          />
        </aside>
      </div>
    </main>
  );
}

function Overview({
  event,
  progress,
  threshold
}: {
  event: EventSummary;
  progress: number;
  threshold: number;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Processing status</h2>
            <p className="mt-1 text-sm text-zinc-400">
              {event.processed} of {event.photos} photos processed with a {threshold}%
              auto-blur threshold.
            </p>
          </div>
          <span className="rounded-lg bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
            {event.active ? "Live" : "Closed"}
          </span>
        </div>
        <div className="mt-5 h-3 overflow-hidden rounded bg-zinc-800">
          <div
            className="h-full rounded bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <StatusBlock label="Public key" value={event.key} />
          <StatusBlock label="Photos" value={`${event.processed}/${event.photos}`} />
          <StatusBlock label="Manual queue" value={`${event.needsReview} items`} />
        </div>
      </section>

      <section className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <div className="mt-4 space-y-3">
          {auditLog.map((entry) => (
            <div className="flex gap-3" key={entry.id}>
              <span
                className={`mt-1 size-2 rounded-full ${
                  entry.tone === "warn"
                    ? "bg-amber-300"
                    : entry.tone === "ok"
                      ? "bg-emerald-300"
                      : "bg-cyan-300"
                }`}
              />
              <div>
                <p className="text-sm font-medium">{entry.action}</p>
                <p className="text-xs text-zinc-500">
                  {entry.actor} at {entry.time}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PhotoGrid({ onSelect }: { onSelect: (photo: EventPhoto) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {photos.map((photo) => (
        <button
          className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/50 text-left transition hover:border-cyan-300"
          key={photo.id}
          onClick={() => onSelect(photo)}
          type="button"
        >
          <PhotoMock photo={photo} redacted={photo.status !== "no_match"} />
          <div className="p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{photo.name}</p>
                <p className="mt-1 text-xs text-zinc-500">
                  {photo.source} at {photo.captured}
                </p>
              </div>
              <StatusBadge status={photo.status} />
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

function ReviewPhoto({
  photo,
  setSelectedPhotoId,
  threshold
}: {
  photo: EventPhoto;
  setSelectedPhotoId: (id: string) => void;
  threshold: number;
}) {
  const matches = photo.figures.filter((figure) => figure.match);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/50">
        <div className="flex flex-col gap-3 border-b border-zinc-800 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold">{photo.name}</h2>
            <p className="text-xs text-zinc-500">
              {photo.source} at {photo.captured}
            </p>
          </div>
          <select
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            onChange={(event) => setSelectedPhotoId(event.target.value)}
            value={photo.id}
          >
            {photos.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-[linear-gradient(#27272a_1px,transparent_1px),linear-gradient(90deg,#27272a_1px,transparent_1px)] bg-[size:24px_24px] p-4">
          <PhotoMock photo={photo} redacted className="mx-auto max-w-3xl rounded-lg shadow-2xl" />
        </div>
      </section>

      <aside className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Detections
        </p>
        <h2 className="mt-2 text-lg font-semibold">{matches.length} possible opt-out matches</h2>
        <div className="mt-4 space-y-3">
          {matches.length === 0 ? (
            <p className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-3 text-sm text-emerald-200">
              No opted-out attendees were detected in this photo.
            </p>
          ) : (
            matches.map((figure) => {
              const attendee = attendees.find((item) => item.id === figure.match);
              const needsReview = figure.confidence < threshold;
              return (
                <div
                  className={`rounded-lg border p-3 ${
                    needsReview
                      ? "border-amber-300/40 bg-amber-300/10"
                      : "border-zinc-800 bg-zinc-900"
                  }`}
                  key={figure.id}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{attendee?.name ?? "Unknown"}</p>
                      <p className="text-xs text-zinc-500">
                        {needsReview ? "Needs manual review" : "Auto blur candidate"}
                      </p>
                    </div>
                    <span className="font-mono text-sm text-cyan-200">
                      {Math.round(figure.confidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded bg-zinc-800">
                    <div
                      className={needsReview ? "h-full bg-amber-300" : "h-full bg-emerald-300"}
                      style={{ width: `${Math.round(figure.confidence * 100)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </aside>
    </div>
  );
}

function AttendeeTable() {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-800">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="bg-zinc-950 text-xs uppercase tracking-widest text-zinc-500">
          <tr>
            <th className="p-3 font-semibold">Attendee</th>
            <th className="p-3 font-semibold">Preference</th>
            <th className="p-3 font-semibold">Reference</th>
            <th className="p-3 font-semibold">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {attendees.map((attendee) => (
            <tr className="bg-zinc-950/40" key={attendee.id}>
              <td className="p-3">
                <p className="font-medium">{attendee.name}</p>
                <p className="text-xs text-zinc-500">{attendee.email}</p>
              </td>
              <td className="p-3">
                <span className="rounded-lg bg-amber-300/10 px-2 py-1 text-xs font-semibold text-amber-200">
                  Opted out
                </span>
              </td>
              <td className="p-3 text-zinc-400">{attendee.confidenceNote}</td>
              <td className="p-3 text-zinc-400">{attendee.submitted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AttendeePreview({
  eventKey,
  name,
  optOut,
  setName,
  setOptOut,
  setStep,
  step
}: {
  eventKey: string;
  name: string;
  optOut: boolean;
  setName: (name: string) => void;
  setOptOut: (value: boolean) => void;
  setStep: (step: AttendeeStep) => void;
  step: AttendeeStep;
}) {
  const order: AttendeeStep[] = ["key", "name", "privacy", "done"];
  const currentIndex = order.indexOf(step);
  const canContinue = step !== "name" || name.trim().length > 1;
  const nextStep = order[Math.min(currentIndex + 1, order.length - 1)];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">
            Attendee flow
          </p>
          <h2 className="mt-1 text-lg font-semibold">Mobile preview</h2>
        </div>
        <button
          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300"
          onClick={() => setStep("key")}
          type="button"
        >
          Reset
        </button>
      </div>

      <div className="rounded-[32px] border border-zinc-700 bg-zinc-950 p-3">
        <div className="min-h-[650px] rounded-[24px] border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-8 flex gap-2">
            {order.map((item, index) => (
              <span
                className={`h-1.5 flex-1 rounded ${index <= currentIndex ? "bg-cyan-300" : "bg-zinc-800"}`}
                key={item}
              />
            ))}
          </div>

          {step === "key" && (
            <MobilePanel
              eyebrow="Step 1"
              title="Join this event"
              text="Enter the organizer key to save your privacy preference."
            >
              <label className="block text-sm font-medium text-zinc-300">
                Event key
                <input
                  className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 font-mono text-cyan-100"
                  readOnly
                  value={eventKey}
                />
              </label>
            </MobilePanel>
          )}

          {step === "name" && (
            <MobilePanel
              eyebrow="Step 2"
              title="Who should we protect?"
              text="Use the name you registered with so organizers can resolve edge cases."
            >
              <label className="block text-sm font-medium text-zinc-300">
                Name
                <input
                  className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-3 text-zinc-100 outline-none focus:border-cyan-300"
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Maya Chen"
                  value={name}
                />
              </label>
            </MobilePanel>
          )}

          {step === "privacy" && (
            <MobilePanel
              eyebrow="Step 3"
              title="Choose your preference"
              text="This choice applies only to the current event workspace."
            >
              <Choice selected={!optOut} title="I am okay appearing" onClick={() => setOptOut(false)} />
              <Choice selected={optOut} title="Please blur me" onClick={() => setOptOut(true)} />
            </MobilePanel>
          )}

          {step === "done" && (
            <MobilePanel
              eyebrow="Complete"
              title="Preference saved"
              text={
                optOut
                  ? "The organizer review queue will protect matching photos."
                  : "You can update this preference before sharing begins."
              }
            >
              <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/10 p-4 text-sm text-emerald-200">
                Saved for {name || "attendee"}.
              </div>
            </MobilePanel>
          )}

          <button
            className="mt-8 w-full rounded-lg bg-cyan-300 px-4 py-3 font-semibold text-zinc-950 disabled:cursor-not-allowed disabled:opacity-40"
            disabled={step === "done" || !canContinue}
            onClick={() => setStep(nextStep)}
            type="button"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

function PhotoMock({
  photo,
  redacted,
  className = ""
}: {
  photo: EventPhoto;
  redacted: boolean;
  className?: string;
}) {
  return (
    <svg
      className={`aspect-[4/3] w-full bg-zinc-800 ${className}`}
      role="img"
      viewBox="0 0 400 300"
    >
      <defs>
        <linearGradient id={`bg-${photo.id}`} x1="0" x2="1" y1="0" y2="1">
          <stop stopColor={photo.bg[0]} />
          <stop offset="1" stopColor={photo.bg[1]} />
        </linearGradient>
        <filter id={`blur-${photo.id}`}>
          <feGaussianBlur stdDeviation="8" />
        </filter>
      </defs>
      <rect fill={`url(#bg-${photo.id})`} height="300" width="400" />
      <rect fill="rgba(255,255,255,0.08)" height="56" rx="6" width="190" x="185" y="42" />
      <rect fill="rgba(0,0,0,0.22)" height="34" rx="6" width="250" x="75" y="220" />
      {photo.figures.map((figure) => {
        const shouldBlur = redacted && figure.match;
        const x = (figure.x / 100) * 400;
        const y = (figure.y / 100) * 300;
        const width = (figure.w / 100) * 400;
        const height = (figure.h / 100) * 300;
        return (
          <g filter={shouldBlur ? `url(#blur-${photo.id})` : undefined} key={figure.id}>
            <circle cx={x + width / 2} cy={y} fill="#f8d5b8" r={width * 0.32} />
            <rect fill={figure.color} height={height} rx="18" width={width} x={x} y={y + 18} />
            {shouldBlur && (
              <rect
                fill="rgba(6,182,212,0.32)"
                height={height + 36}
                rx="8"
                stroke="#67e8f9"
                strokeDasharray="5 5"
                width={width + 18}
                x={x - 9}
                y={y - 16}
              />
            )}
          </g>
        );
      })}
    </svg>
  );
}

function Metric({
  label,
  value,
  tone = "zinc"
}: {
  label: string;
  value: number;
  tone?: "zinc" | "amber" | "cyan";
}) {
  const toneClass =
    tone === "amber" ? "text-amber-200" : tone === "cyan" ? "text-cyan-200" : "text-white";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
      <p className={`text-2xl font-semibold ${toneClass}`}>{value}</p>
      <p className="text-xs text-zinc-500">{label}</p>
    </div>
  );
}

function StatusBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-mono text-sm text-zinc-100">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: PhotoStatus }) {
  const className =
    status === "manual_review"
      ? "bg-amber-300/10 text-amber-200"
      : status === "no_match"
        ? "bg-emerald-300/10 text-emerald-200"
        : "bg-cyan-300/10 text-cyan-200";

  return (
    <span className={`rounded-lg px-2 py-1 text-xs font-semibold ${className}`}>
      {statusCopy[status]}
    </span>
  );
}

function MobilePanel({
  children,
  eyebrow,
  text,
  title
}: {
  children: ReactNode;
  eyebrow: string;
  text: string;
  title: string;
}) {
  return (
    <section>
      <p className="text-xs font-semibold uppercase tracking-widest text-cyan-200">{eyebrow}</p>
      <h3 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">{title}</h3>
      <p className="mt-3 text-sm text-zinc-400">{text}</p>
      <div className="mt-7 space-y-3">{children}</div>
    </section>
  );
}

function Choice({
  onClick,
  selected,
  title
}: {
  onClick: () => void;
  selected: boolean;
  title: string;
}) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left ${
        selected ? "border-cyan-300 bg-cyan-300/10" : "border-zinc-800 bg-zinc-900"
      }`}
      onClick={onClick}
      type="button"
    >
      <span className={`size-4 rounded-full border ${selected ? "border-cyan-300 bg-cyan-300" : "border-zinc-600"}`} />
      <span className="font-medium">{title}</span>
    </button>
  );
}
