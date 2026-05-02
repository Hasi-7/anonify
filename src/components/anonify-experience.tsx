"use client";

import {
  useEffect,
  useId,
  useState,
  type CSSProperties,
  type ReactNode
} from "react";
import {
  attendees,
  events as initialEvents,
  mockData,
  photos,
  type Attendee,
  type EventPhoto,
  type EventSummary,
  type Figure,
  type PhotoStatus
} from "@/lib/mock-data";

type ThemeMode = "dark" | "light";
type Density = "comfortable" | "compact";
type ViewMode = "split" | "organizer" | "attendee";
type PhotoLayout = "split" | "overlay";
type DashboardTab = "overview" | "optouts" | "photos" | "review" | "log";

type ViewState =
  | { screen: "events" }
  | { screen: "event"; eventId: string; tab: DashboardTab; photoId?: string };

type Tweaks = {
  accent: string;
  theme: ThemeMode;
  density: Density;
  blurThreshold: number;
  photoLayout: PhotoLayout;
  emptyState: boolean;
  view: ViewMode;
};

const tweakDefaults: Tweaks = {
  accent: "#38bdf8",
  theme: "dark",
  density: "comfortable",
  blurThreshold: 65,
  photoLayout: "split",
  emptyState: false,
  view: "split"
};

const iconPaths = {
  shield: <path d="M12 2 4 5v7c0 4.5 3.5 8.5 8 10 4.5-1.5 8-5.5 8-10V5z" />,
  eye: (
    <>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  "eye-off": (
    <>
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
      <line x1="2" y1="2" x2="22" y2="22" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  copy: (
    <>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  x: <path d="M18 6 6 18M6 6l12 12" />,
  "arrow-left": <path d="m15 18-6-6 6-6" />,
  "arrow-right": <path d="m9 18 6-6-6-6" />,
  upload: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </>
  ),
  image: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-5-5L5 21" />
    </>
  ),
  images: (
    <>
      <path d="M18 22H4a2 2 0 0 1-2-2V6" />
      <rect x="6" y="2" width="16" height="16" rx="2" />
      <circle cx="12" cy="9" r="2" />
      <path d="m22 14-3-3-7 7" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  "user-x": (
    <>
      <path d="M14.5 17h-9a4 4 0 0 0-3 3.87" />
      <circle cx="9.5" cy="7" r="4" />
      <path d="m17 8 5 5M22 8l-5 5" />
    </>
  ),
  home: <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6h-2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82A1.65 1.65 0 0 0 3 14H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9H21a2 2 0 0 1 0 4h-.09A1.65 1.65 0 0 0 19.4 15z" />
    </>
  ),
  qr: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
      <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
    </>
  ),
  link: (
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  alert: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  flag: (
    <>
      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
      <line x1="4" y1="22" x2="4" y2="15" />
    </>
  ),
  file: <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />,
  list: (
    <>
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>
  ),
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </>
  ),
  camera: (
    <>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  sparkles: <path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4" />,
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  refresh: (
    <>
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </>
  ),
  blur: (
    <>
      <path d="M2 12c0-5 4-10 10-10s10 5 10 10-4 10-10 10S2 17 2 12z" />
      <path d="M12 2v20M2 12h20" strokeOpacity="0.4" />
    </>
  )
};

type IconName = keyof typeof iconPaths;

type IconProps = {
  name: IconName;
  size?: number;
  className?: string;
};

export function AnonifyExperience() {
  const [tweaks, setTweaks] = useState<Tweaks>(tweakDefaults);
  const [view, setView] = useState<ViewState>({ screen: "events" });
  const [showCreate, setShowCreate] = useState(false);
  const [events, setEvents] = useState<EventSummary[]>(initialEvents);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = tweaks.theme;
    root.dataset.density = tweaks.density;
    root.style.setProperty("--accent", tweaks.accent);
    root.style.setProperty("--accent-soft", hexToRgba(tweaks.accent, 0.16));
  }, [tweaks.accent, tweaks.density, tweaks.theme]);

  function setTweak<K extends keyof Tweaks>(key: K, value: Tweaks[K]) {
    setTweaks((current) => ({ ...current, [key]: value }));
  }

  const currentEvent =
    view.screen === "event"
      ? events.find((event) => event.id === view.eventId) ?? events[0]
      : null;
  const visibleEvents = tweaks.emptyState ? [] : events;

  return (
    <>
      <FrameSwitcher view={tweaks.view} setView={(next) => setTweak("view", next)} />

      <main className={`prototype-stage stage-${tweaks.view}`}>
        {(tweaks.view === "split" || tweaks.view === "organizer") && (
          <section className="organizer-desktop" aria-label="Organizer dashboard preview">
            <BrowserChrome
              url={`anonify.app/${
                view.screen === "events" ? "events" : `events/${currentEvent?.id ?? ""}`
              }`}
            >
              <div className="app-shell">
                <Sidebar view={view} setView={setView} currentEvent={currentEvent} />
                <div className="workspace">
                  {view.screen === "events" && (
                    <EventsList
                      events={visibleEvents}
                      emptyState={tweaks.emptyState}
                      onCreate={() => setShowCreate(true)}
                      setView={setView}
                    />
                  )}
                  {view.screen === "event" && currentEvent && (
                    <EventDashboard
                      event={currentEvent}
                      view={view}
                      setView={setView}
                      photoLayout={tweaks.photoLayout}
                      blurThreshold={tweaks.blurThreshold / 100}
                    />
                  )}
                </div>
              </div>
            </BrowserChrome>
          </section>
        )}

        {(tweaks.view === "split" || tweaks.view === "attendee") && (
          <aside className="attendee-preview" aria-label="Attendee mobile flow preview">
            <IOSDevice>
              <AttendeeFlow initialKey={currentEvent?.key ?? "HUSK-K7M2"} />
            </IOSDevice>
          </aside>
        )}
      </main>

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={(key, name, date) => {
            const id = `e${events.length + 1}`;
            const newEvent: EventSummary = {
              id,
              name,
              date: date || "May 21, 2026",
              key,
              attendees: 0,
              optOuts: 0,
              photos: 0,
              processed: 0,
              needsReview: 0,
              active: true
            };
            setEvents([newEvent, ...events]);
            setShowCreate(false);
            setView({ screen: "event", tab: "overview", eventId: id });
          }}
        />
      )}

      <TweaksPanel
        tweaks={tweaks}
        setTweak={setTweak}
        setView={setView}
        openCreate={() => setShowCreate(true)}
      />
    </>
  );
}

function Icon({ name, size = 16, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths[name]}
    </svg>
  );
}

function hexToRgba(hex: string, alpha: number) {
  const safe = hex.replace("#", "");
  const r = Number.parseInt(safe.slice(0, 2), 16);
  const g = Number.parseInt(safe.slice(2, 4), 16);
  const b = Number.parseInt(safe.slice(4, 6), 16);

  if ([r, g, b].some(Number.isNaN)) {
    return `rgba(56, 189, 248, ${alpha})`;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function FrameSwitcher({
  view,
  setView
}: {
  view: ViewMode;
  setView: (view: ViewMode) => void;
}) {
  const items: Array<{ value: ViewMode; label: string; icon: IconName }> = [
    { value: "split", label: "Both", icon: "grid" },
    { value: "organizer", label: "Organizer", icon: "home" },
    { value: "attendee", label: "Attendee", icon: "user" }
  ];

  return (
    <div className="app-frame-switch" aria-label="Preview mode">
      {items.map((item) => (
        <button
          className={view === item.value ? "active" : ""}
          key={item.value}
          onClick={() => setView(item.value)}
          type="button"
        >
          <Icon name={item.icon} size={13} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function BrowserChrome({ url, children }: { url: string; children: ReactNode }) {
  return (
    <div className="browser-shell">
      <div className="browser-chrome">
        <div className="browser-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="browser-url">
          <Icon name="lock" size={13} />
          <span>{url}</span>
        </div>
        <div className="browser-action">
          <Icon name="sparkles" size={14} />
          Demo
        </div>
      </div>
      {children}
    </div>
  );
}

function Sidebar({
  view,
  setView,
  currentEvent
}: {
  view: ViewState;
  setView: (view: ViewState) => void;
  currentEvent: EventSummary | null;
}) {
  const currentTab = view.screen === "event" ? view.tab : "overview";

  const navItems: Array<{ tab: DashboardTab; label: string; icon: IconName }> = [
    { tab: "overview", label: "Overview", icon: "home" },
    { tab: "optouts", label: "Opt-outs", icon: "user-x" },
    { tab: "photos", label: "Photos", icon: "images" },
    { tab: "review", label: "Review queue", icon: "blur" },
    { tab: "log", label: "Processing log", icon: "list" }
  ];

  return (
    <aside className="sidebar">
      <button className="sidebar-brand" onClick={() => setView({ screen: "events" })} type="button">
        <span className="brand-mark">a</span>
        <span>
          anonify
          <small>privacy photo review</small>
        </span>
      </button>

      <div className="sidebar-section-title">Workspace</div>
      <button
        className={`sidebar-item ${view.screen === "events" ? "active" : ""}`}
        onClick={() => setView({ screen: "events" })}
        type="button"
      >
        <Icon name="grid" size={16} />
        Events
      </button>

      {currentEvent && (
        <>
          <div className="sidebar-section-title">{currentEvent.name}</div>
          {navItems.map((item) => (
            <button
              className={`sidebar-item ${
                view.screen === "event" && currentTab === item.tab ? "active" : ""
              }`}
              key={item.tab}
              onClick={() =>
                setView({
                  screen: "event",
                  eventId: currentEvent.id,
                  tab: item.tab
                })
              }
              type="button"
            >
              <Icon name={item.icon} size={16} />
              {item.label}
            </button>
          ))}
        </>
      )}

      <div className="sidebar-user">
        <Avatar initials="AO" hue={196} />
        <span>
          Alex Organizer
          <small>Demo admin</small>
        </span>
      </div>
    </aside>
  );
}

function EventsList({
  events,
  emptyState,
  onCreate,
  setView
}: {
  events: EventSummary[];
  emptyState: boolean;
  onCreate: () => void;
  setView: (view: ViewState) => void;
}) {
  return (
    <section className="page fade-in">
      <PageHeader
        eyebrow="Organizer console"
        title="Event workspaces"
        subtitle="Create an event key, collect opt-out preferences, and review photos with mocked redaction confidence."
        action={
          <button className="btn primary" onClick={onCreate} type="button">
            <Icon name="plus" size={15} />
            New event
          </button>
        }
      />

      {emptyState || events.length === 0 ? (
        <EmptyState
          icon="clock"
          title="No events yet"
          text="Create an event to generate a public attendee key and start the demo flow."
          action={onCreate}
        />
      ) : (
        <div className="event-grid">
          {events.map((event) => (
            <button
              className="event-card"
              key={event.id}
              onClick={() =>
                setView({ screen: "event", eventId: event.id, tab: "overview" })
              }
              type="button"
            >
              <div className="event-card-top">
                <span>
                  <strong className="event-name">{event.name}</strong>
                  <span className="event-date">{event.date}</span>
                </span>
                <span className={`badge ${event.active ? "ok" : "muted"}`}>
                  <span className="dot" />
                  {event.active ? "Live" : "Closed"}
                </span>
              </div>
              <div className="event-key-pill">{event.key}</div>
              <div className="event-card-stats">
                <MiniStat value={event.attendees} label="Attendees" />
                <MiniStat value={event.optOuts} label="Opt-outs" alert={event.optOuts > 0} />
                <MiniStat value={event.needsReview} label="Review" alert={event.needsReview > 0} />
              </div>
              <span className="event-progress">
                <span style={{ width: `${Math.round((event.processed / Math.max(event.photos, 1)) * 100)}%` }} />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function PageHeader({
  eyebrow,
  title,
  subtitle,
  action
}: {
  eyebrow?: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="page-title">{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {action}
    </header>
  );
}

function MiniStat({ value, label, alert = false }: { value: number; label: string; alert?: boolean }) {
  return (
    <span className={`mini-stat ${alert ? "alert" : ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </span>
  );
}

function EmptyState({
  icon,
  title,
  text,
  action
}: {
  icon: IconName;
  title: string;
  text: string;
  action: () => void;
}) {
  return (
    <div className="empty card">
      <div className="empty-icon">
        <Icon name={icon} size={24} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
      <button className="btn primary" onClick={action} type="button">
        <Icon name="plus" size={15} />
        Create event
      </button>
    </div>
  );
}

function CreateEventModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (key: string, name: string, date: string) => void;
}) {
  const [name, setName] = useState("HuskyHack Afterparty");
  const [date, setDate] = useState("May 21, 2026");
  const [generatedKey, setGeneratedKey] = useState("");

  function create() {
    const key = `EVT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    setGeneratedKey(key);
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal">
        <div className="modal-header">
          <div>
            <p className="eyebrow">New workspace</p>
            <h2>Create event</h2>
          </div>
          <button className="btn icon-only ghost" onClick={onClose} type="button" aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="modal-body">
          <label className="field">
            <span className="label">Event name</span>
            <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="field">
            <span className="label">Date</span>
            <input className="input" value={date} onChange={(event) => setDate(event.target.value)} />
          </label>
          <Notice icon="lock">
            <strong>Demo mode:</strong> the event key is public and scoped to this event. No real attendee images are stored here.
          </Notice>
          {generatedKey && (
            <div className="generated-key">
              <CopyField value={generatedKey} />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn ghost" onClick={onClose} type="button">
            Cancel
          </button>
          {!generatedKey ? (
            <button className="btn primary" onClick={create} type="button">
              Generate event key
            </button>
          ) : (
            <button
              className="btn primary"
              onClick={() => onCreated(generatedKey, name || "Untitled event", date)}
              type="button"
            >
              Open dashboard
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function EventDashboard({
  event,
  view,
  setView,
  photoLayout,
  blurThreshold
}: {
  event: EventSummary;
  view: Extract<ViewState, { screen: "event" }>;
  setView: (view: ViewState) => void;
  photoLayout: PhotoLayout;
  blurThreshold: number;
}) {
  const tab = view.tab ?? "overview";
  const tabs: Array<{ tab: DashboardTab; label: string; icon: IconName; count?: number }> = [
    { tab: "overview", label: "Overview", icon: "home" },
    { tab: "optouts", label: "Opt-outs", icon: "user-x", count: event.optOuts },
    { tab: "photos", label: "Photos", icon: "images", count: event.photos },
    { tab: "review", label: "Review", icon: "flag", count: event.needsReview },
    { tab: "log", label: "Log", icon: "list" }
  ];

  return (
    <section className="page fade-in">
      <div className="crumbs">
        <button onClick={() => setView({ screen: "events" })} type="button">
          Events
        </button>
        <span>/</span>
        <span>{event.name}</span>
      </div>
      <PageHeader
        title={event.name}
        subtitle={`${event.date} - event key ${event.key} - ${event.processed}/${event.photos} photos processed`}
        action={
          <button className="btn" type="button">
            <Icon name="download" size={15} />
            Export report
          </button>
        }
      />

      <div className="tabs">
        {tabs.map((item) => (
          <button
            className={`tab ${tab === item.tab ? "active" : ""}`}
            key={item.tab}
            onClick={() => setView({ screen: "event", eventId: event.id, tab: item.tab })}
            type="button"
          >
            <Icon name={item.icon} size={14} />
            {item.label}
            {typeof item.count === "number" && <span className="tab-count">{item.count}</span>}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab event={event} />}
      {tab === "optouts" && <OptOutsTab />}
      {tab === "photos" && <PhotosTab event={event} setView={setView} />}
      {tab === "review" && (
        <ReviewTab
          event={event}
          selectedPhotoId={view.photoId}
          setView={setView}
          photoLayout={photoLayout}
          blurThreshold={blurThreshold}
        />
      )}
      {tab === "log" && <LogTab />}
    </section>
  );
}

function OverviewTab({ event }: { event: EventSummary }) {
  return (
    <div className="overview-grid slide-up">
      <div className="stat-grid">
        <StatCard icon="users" label="Attendees" value={event.attendees} sub="Across all submissions" />
        <StatCard icon="user-x" label="Opt-outs" value={event.optOuts} sub="Need redaction protection" />
        <StatCard icon="images" label="Photos" value={event.photos} sub={`${event.processed} processed`} />
        <StatCard icon="flag" label="Manual review" value={event.needsReview} sub="Low confidence detections" tone="warn" />
      </div>

      <div className="overview-columns">
        <div className="card card-pad">
          <div className="card-heading">
            <h2>Attendee link</h2>
            <span className="badge accent">Public key</span>
          </div>
          <CopyField value={`anonify.app/attend?eventKey=${event.key}`} mono={false} />
          <div className="qr-wrap">
            <QRCode size={132} />
            <div>
              <h3>Scan to opt out</h3>
              <p>
                Attendees can enter their name, consent preference, and optional reference photo.
                The demo keeps this mocked and event scoped.
              </p>
            </div>
          </div>
        </div>

        <div className="card card-pad">
          <div className="card-heading">
            <h2>Processing pipeline</h2>
            <span className="badge ok">Mocked</span>
          </div>
          <PipelineStep icon="upload" title="Import photos" text="Drive and manual uploads land in the event photo queue." />
          <PipelineStep icon="eye-off" title="Match opt-outs" text="Mock detections compare event photos to opted-out references." />
          <PipelineStep icon="blur" title="Blur or flag" text="High confidence matches are redacted; uncertain faces go to review." />
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone
}: {
  icon: IconName;
  label: string;
  value: number;
  sub: string;
  tone?: "warn";
}) {
  return (
    <div className={`stat ${tone ?? ""}`}>
      <div className="stat-label">
        <Icon name={icon} size={15} />
        {label}
      </div>
      <div className="stat-value">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}

function PipelineStep({ icon, title, text }: { icon: IconName; title: string; text: string }) {
  return (
    <div className="pipeline-step">
      <span>
        <Icon name={icon} size={17} />
      </span>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}

function OptOutsTab() {
  return (
    <div className="card table-card slide-up">
      <table className="table">
        <thead>
          <tr>
            <th>Attendee</th>
            <th>Consent</th>
            <th>Reference quality</th>
            <th>Submitted</th>
          </tr>
        </thead>
        <tbody>
          {attendees.map((attendee) => (
            <tr key={attendee.id}>
              <td>
                <div className="person-cell">
                  <Avatar initials={initials(attendee.name)} hue={attendee.referenceHue} />
                  <span>
                    <strong>{attendee.name}</strong>
                    <small>{attendee.email}</small>
                  </span>
                </div>
              </td>
              <td>
                <span className="badge warn">
                  <Icon name="eye-off" size={11} />
                  Opted out
                </span>
              </td>
              <td>{attendee.confidenceNote}</td>
              <td>{attendee.submitted}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PhotosTab({
  event,
  setView
}: {
  event: EventSummary;
  setView: (view: ViewState) => void;
}) {
  const [filter, setFilter] = useState<"all" | PhotoStatus>("all");
  const [grid, setGrid] = useState(true);
  const filtered = photos.filter((photo) => filter === "all" || photo.status === filter);

  return (
    <div className="slide-up">
      <div className="toolbar">
        <div className="toggle-group">
          {(["all", "match", "manual_review", "no_match"] as Array<"all" | PhotoStatus>).map((item) => (
            <button
              className={filter === item ? "active" : ""}
              key={item}
              onClick={() => setFilter(item)}
              type="button"
            >
              {item === "manual_review" ? "Review" : item.replace("_", " ")}
            </button>
          ))}
        </div>
        <button className="btn" onClick={() => setGrid((value) => !value)} type="button">
          <Icon name={grid ? "list" : "grid"} size={15} />
          {grid ? "List" : "Grid"}
        </button>
      </div>

      <div className={grid ? "photo-grid" : "photo-list"}>
        {filtered.map((photo) => {
          const matches = photo.figures.filter((figure) => figure.match);
          const topConfidence = matches.reduce(
            (best, figure) => Math.max(best, figure.confidence),
            0
          );

          return (
            <button
              className="photo-card"
              key={photo.id}
              onClick={() =>
                setView({
                  screen: "event",
                  eventId: event.id,
                  tab: "review",
                  photoId: photo.id
                })
              }
              type="button"
            >
              <div className="photo-card-thumb">
                <PhotoSVG photo={photo} redacted={photo.status !== "no_match"} blurThreshold={0.65} />
                <span className="status-overlay">
                  <PhotoStatusBadge status={photo.status} />
                </span>
                {topConfidence > 0 && <span className="match-overlay">{Math.round(topConfidence * 100)}%</span>}
              </div>
              <div className="photo-card-meta">
                <strong>{photo.name}</strong>
                <span>{photo.source} - {photo.captured}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ReviewTab({
  event,
  selectedPhotoId,
  setView,
  photoLayout,
  blurThreshold
}: {
  event: EventSummary;
  selectedPhotoId?: string;
  setView: (view: ViewState) => void;
  photoLayout: PhotoLayout;
  blurThreshold: number;
}) {
  const photo = photos.find((item) => item.id === selectedPhotoId) ??
    photos.find((item) => item.status === "manual_review") ??
    photos[0];

  return (
    <PhotoReview
      allPhotos={photos}
      blurThreshold={blurThreshold}
      event={event}
      photo={photo}
      photoLayout={photoLayout}
      setView={setView}
    />
  );
}

function PhotoReview({
  photo,
  allPhotos,
  event,
  setView,
  photoLayout,
  blurThreshold
}: {
  photo: EventPhoto;
  allPhotos: EventPhoto[];
  event: EventSummary;
  setView: (view: ViewState) => void;
  photoLayout: PhotoLayout;
  blurThreshold: number;
}) {
  const [mode, setMode] = useState<"original" | "redacted">("redacted");
  const [selectedFigure, setSelectedFigure] = useState<string | undefined>();
  const [decisions, setDecisions] = useState<Record<string, "approved" | "rejected" | "manual">>({});
  const matches = photo.figures.filter((figure) => figure.match);
  const lowConfidence = matches.filter((figure) => figure.confidence < blurThreshold);

  function selectNeighbor(direction: -1 | 1) {
    const index = allPhotos.findIndex((item) => item.id === photo.id);
    const next = allPhotos[index + direction];
    if (next) {
      setSelectedFigure(undefined);
      setView({ screen: "event", eventId: event.id, tab: "review", photoId: next.id });
    }
  }

  return (
    <div className={`review-layout ${photoLayout === "overlay" ? "overlay" : ""} slide-up`}>
      <section className="review-stage">
        <div className="review-stage-toolbar">
          <div>
            <strong>{photo.name}</strong>
            <span>{photo.source} - {photo.captured}</span>
          </div>
          <div className="toggle-group">
            <button
              className={mode === "original" ? "active" : ""}
              onClick={() => setMode("original")}
              type="button"
            >
              <Icon name="eye" size={13} />
              Original
            </button>
            <button
              className={mode === "redacted" ? "active" : ""}
              onClick={() => setMode("redacted")}
              type="button"
            >
              <Icon name="eye-off" size={13} />
              Redacted
            </button>
          </div>
        </div>
        <div className="review-stage-canvas">
          <div className="review-image-wrap">
            <PhotoSVG
              photo={photo}
              redacted={mode === "redacted"}
              blurThreshold={blurThreshold}
              highlightId={selectedFigure}
            />
          </div>
        </div>
        <div className="review-footer">
          <button className="btn" onClick={() => selectNeighbor(-1)} type="button">
            <Icon name="arrow-left" size={15} />
            Previous
          </button>
          <span>
            {lowConfidence.length > 0
              ? `${lowConfidence.length} detections need a human call`
              : "All matches clear the confidence threshold"}
          </span>
          <button className="btn" onClick={() => selectNeighbor(1)} type="button">
            Next
            <Icon name="arrow-right" size={15} />
          </button>
        </div>
      </section>

      <aside className="review-side">
        <div className="review-side-header">
          <p className="eyebrow">Detections</p>
          <h2>{matches.length} possible opt-out matches</h2>
          <p>Threshold: {Math.round(blurThreshold * 100)}% confidence</p>
        </div>
        <div className="review-side-body">
          {matches.length === 0 ? (
            <Notice icon="check-circle">No opted-out attendees were detected in this photo.</Notice>
          ) : (
            matches
              .sort((a, b) => b.confidence - a.confidence)
              .map((figure) => (
                <DetectionCard
                  decision={decisions[figure.id]}
                  figure={figure}
                  key={figure.id}
                  selected={selectedFigure === figure.id}
                  threshold={blurThreshold}
                  onDecision={(decision) =>
                    setDecisions((current) => ({ ...current, [figure.id]: decision }))
                  }
                  onSelect={() => setSelectedFigure(figure.id)}
                />
              ))
          )}
        </div>
      </aside>
    </div>
  );
}

function DetectionCard({
  figure,
  selected,
  threshold,
  decision,
  onSelect,
  onDecision
}: {
  figure: Figure;
  selected: boolean;
  threshold: number;
  decision?: "approved" | "rejected" | "manual";
  onSelect: () => void;
  onDecision: (decision: "approved" | "rejected" | "manual") => void;
}) {
  const attendee = attendees.find((item) => item.id === figure.match);
  const flagged = figure.confidence < threshold;

  return (
    <div className={`detection-card ${selected ? "selected" : ""} ${flagged ? "flag" : ""}`}>
      <button className="detection-main" onClick={onSelect} type="button">
        <Avatar initials={initials(attendee?.name ?? "Unknown")} hue={attendee?.referenceHue ?? 220} />
        <span>
          <strong>{attendee?.name ?? "Unknown attendee"}</strong>
          <small>{flagged ? "Needs review" : "Auto blur candidate"}</small>
        </span>
      </button>
      <ConfidenceBar value={figure.confidence} threshold={threshold} />
      <div className="decision-row">
        <button
          className={`btn sm ${decision === "approved" ? "primary" : ""}`}
          onClick={() => onDecision("approved")}
          type="button"
        >
          Approve
        </button>
        <button
          className={`btn sm ${decision === "manual" ? "primary" : ""}`}
          onClick={() => onDecision("manual")}
          type="button"
        >
          Review
        </button>
        <button
          className={`btn sm ${decision === "rejected" ? "danger" : ""}`}
          onClick={() => onDecision("rejected")}
          type="button"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

function LogTab() {
  return (
    <div className="card card-pad slide-up">
      <div className="timeline">
        {mockData.log.map((entry) => (
          <div className={`timeline-entry ${entry.tone}`} key={entry.id}>
            <span className="timeline-dot" />
            <div>
              <strong>{entry.action}</strong>
              <p>{entry.actor} - {entry.time}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AttendeeFlow({ initialKey }: { initialKey: string }) {
  const [step, setStep] = useState<"key" | "name" | "consent" | "upload" | "done">("key");
  const [key, setKey] = useState(initialKey);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState<"yes" | "no" | null>(null);
  const [uploaded, setUploaded] = useState(false);
  const order = ["key", "name", "consent", "upload", "done"] as const;
  const stepIndex = order.indexOf(step);

  useEffect(() => {
    setKey(initialKey);
  }, [initialKey]);

  function next() {
    const nextStep = order[Math.min(stepIndex + 1, order.length - 1)];
    setStep(nextStep);
  }

  return (
    <div className="mobile-screen">
      <div className="mobile-hero">
        <div className="mobile-brand">
          <span className="brand-mark">a</span>
          anonify
        </div>
        <div className="mobile-steps" aria-label="Attendee flow progress">
          {order.slice(0, 4).map((item, index) => (
            <span className={index <= stepIndex ? "done" : ""} key={item} />
          ))}
        </div>
      </div>

      <div className="mobile-content">
        {step === "key" && (
          <MobileStep
            eyebrow="Step 1"
            title="Join the event privacy flow"
            subtitle="Enter the event key from the organizer poster or QR code."
          >
            <label className="mobile-field">
              <span>Event key</span>
              <input
                className="mobile-input mono"
                value={key}
                onChange={(event) => setKey(event.target.value.toUpperCase())}
              />
            </label>
            <Notice icon="lock">This key only connects your preference to this event.</Notice>
          </MobileStep>
        )}

        {step === "name" && (
          <MobileStep
            eyebrow="Step 2"
            title="Tell us who to protect"
            subtitle="Use the name you registered with so the organizer can resolve edge cases."
          >
            <label className="mobile-field">
              <span>Name</span>
              <input
                className="mobile-input"
                placeholder="Maya Chen"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          </MobileStep>
        )}

        {step === "consent" && (
          <MobileStep
            eyebrow="Step 3"
            title="Choose your photo preference"
            subtitle="The organizer sees your choice scoped only to this event."
          >
            <ConsentCard
              selected={consent === "yes"}
              title="I am okay appearing in photos"
              text="No redaction needed unless I change this later."
              onClick={() => setConsent("yes")}
            />
            <ConsentCard
              selected={consent === "no"}
              title="Please blur me in shared photos"
              text="I can upload a reference image to help review."
              onClick={() => setConsent("no")}
            />
          </MobileStep>
        )}

        {step === "upload" && (
          <MobileStep
            eyebrow="Step 4"
            title={consent === "no" ? "Add an optional reference" : "You are all set"}
            subtitle={
              consent === "no"
                ? "A clear selfie helps the organizer review uncertain detections."
                : "You can skip upload because you chose to appear in photos."
            }
          >
            <button
              className={`upload-tile ${uploaded ? "uploaded" : ""}`}
              onClick={() => setUploaded((value) => !value)}
              type="button"
            >
              <Icon name={uploaded ? "check-circle" : "upload"} size={26} />
              <strong>{uploaded ? "reference-selfie.jpg attached" : "Tap to mock upload"}</strong>
              <span>{uploaded ? "Stored in this demo event only" : "No file leaves your browser in this prototype"}</span>
            </button>
          </MobileStep>
        )}

        {step === "done" && (
          <MobileStep
            eyebrow="Complete"
            title="Your preference is saved"
            subtitle="The organizer dashboard can now include your opt-out in the mocked review queue."
          >
            <div className="success-orb">
              <Icon name="shield" size={42} />
            </div>
          </MobileStep>
        )}
      </div>

      <div className="mobile-bottom">
        {step !== "done" ? (
          <button
            className="mobile-btn"
            disabled={
              (step === "key" && key.length < 6) ||
              (step === "name" && name.trim().length < 2) ||
              (step === "consent" && consent === null)
            }
            onClick={next}
            type="button"
          >
            Continue
            <Icon name="arrow-right" size={17} />
          </button>
        ) : (
          <button className="mobile-btn secondary" onClick={() => setStep("key")} type="button">
            Start another demo
          </button>
        )}
      </div>
    </div>
  );
}

function MobileStep({
  eyebrow,
  title,
  subtitle,
  children
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="mobile-step">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      {children}
    </div>
  );
}

function ConsentCard({
  selected,
  title,
  text,
  onClick
}: {
  selected: boolean;
  title: string;
  text: string;
  onClick: () => void;
}) {
  return (
    <button className={`consent-card ${selected ? "selected" : ""}`} onClick={onClick} type="button">
      <span className="consent-radio" />
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
    </button>
  );
}

function IOSDevice({ children }: { children: ReactNode }) {
  return (
    <div className="ios-device">
      <div className="ios-frame">
        <div className="ios-sensor" />
        <div className="ios-status">
          <span>9:41</span>
          <span>5G</span>
        </div>
        {children}
        <div className="ios-home" />
      </div>
    </div>
  );
}

function TweaksPanel({
  tweaks,
  setTweak,
  setView,
  openCreate
}: {
  tweaks: Tweaks;
  setTweak: <K extends keyof Tweaks>(key: K, value: Tweaks[K]) => void;
  setView: (view: ViewState) => void;
  openCreate: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <aside className={`tweaks ${open ? "open" : ""}`}>
      <button className="tweaks-tab" onClick={() => setOpen((value) => !value)} type="button">
        <Icon name="settings" size={16} />
        Tweaks
      </button>
      <div className="tweaks-panel">
        <div className="tweaks-header">
          <div>
            <p className="eyebrow">Prototype controls</p>
            <h2>Demo tweaks</h2>
          </div>
          <button className="btn icon-only ghost" onClick={() => setOpen(false)} type="button">
            <Icon name="x" size={15} />
          </button>
        </div>

        <TweakSection label="Theme">
          <TweakRadio
            label="Mode"
            value={tweaks.theme}
            options={[
              { value: "dark", label: "Dark" },
              { value: "light", label: "Light" }
            ]}
            onChange={(value) => setTweak("theme", value)}
          />
          <TweakRadio
            label="Density"
            value={tweaks.density}
            options={[
              { value: "comfortable", label: "Comfort" },
              { value: "compact", label: "Compact" }
            ]}
            onChange={(value) => setTweak("density", value)}
          />
          <label className="tweak-row">
            <span>Accent</span>
            <input
              type="color"
              value={tweaks.accent}
              onChange={(event) => setTweak("accent", event.target.value)}
            />
          </label>
        </TweakSection>

        <TweakSection label="Review">
          <label className="tweak-row vertical">
            <span>Auto blur threshold: {tweaks.blurThreshold}%</span>
            <input
              type="range"
              min="40"
              max="95"
              value={tweaks.blurThreshold}
              onChange={(event) => setTweak("blurThreshold", Number(event.target.value))}
            />
          </label>
          <TweakRadio
            label="Photo layout"
            value={tweaks.photoLayout}
            options={[
              { value: "split", label: "Split" },
              { value: "overlay", label: "Wide" }
            ]}
            onChange={(value) => setTweak("photoLayout", value)}
          />
        </TweakSection>

        <TweakSection label="Demo path">
          <label className="tweak-row">
            <span>Empty state</span>
            <input
              checked={tweaks.emptyState}
              onChange={(event) => setTweak("emptyState", event.target.checked)}
              type="checkbox"
            />
          </label>
          <button className="tweak-button" onClick={() => setView({ screen: "events" })} type="button">
            Organizer dashboard
          </button>
          <button className="tweak-button" onClick={openCreate} type="button">
            Create event modal
          </button>
          <button
            className="tweak-button"
            onClick={() => setView({ screen: "event", tab: "review", eventId: "e1", photoId: "p2" })}
            type="button"
          >
            Manual review case
          </button>
        </TweakSection>
      </div>
    </aside>
  );
}

function TweakSection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="tweak-section">
      <h3>{label}</h3>
      {children}
    </section>
  );
}

function TweakRadio<T extends string>({
  label,
  value,
  options,
  onChange
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="tweak-row vertical">
      <span>{label}</span>
      <div className="segmented">
        {options.map((option) => (
          <button
            className={value === option.value ? "active" : ""}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CopyField({ value, mono = true }: { value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  function onCopy() {
    setCopied(true);
    navigator.clipboard?.writeText(value).catch(() => undefined);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="copy-field">
      <input readOnly value={value} className={mono ? "" : "plain"} />
      <button className={copied ? "copied" : ""} onClick={onCopy} type="button">
        <Icon name={copied ? "check" : "copy"} size={13} />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

function Avatar({
  initials: letters = "?",
  hue = 220,
  size = 36
}: {
  initials?: string;
  hue?: number;
  size?: number;
}) {
  const style: CSSProperties = {
    "--avatar-hue": hue,
    width: size,
    height: size,
    fontSize: Math.round(size * 0.38)
  } as CSSProperties;

  return (
    <span className="avatar" style={style}>
      {letters}
    </span>
  );
}

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ConfidenceBar({
  value,
  threshold
}: {
  value: number;
  threshold: number;
}) {
  const cls = value >= 0.8 ? "high" : value >= threshold ? "mid" : "low";

  return (
    <div className="confidence">
      <div className="confidence-bar">
        <span className={`confidence-fill ${cls}`} style={{ width: `${Math.round(value * 100)}%` }} />
        <span className="confidence-threshold" style={{ left: `${threshold * 100}%` }} />
      </div>
      <strong>{Math.round(value * 100)}%</strong>
    </div>
  );
}

function PhotoSVG({
  photo,
  redacted = false,
  blurThreshold = 0.65,
  highlightId
}: {
  photo: EventPhoto;
  redacted?: boolean;
  blurThreshold?: number;
  highlightId?: string;
}) {
  const rawId = useId().replace(/:/g, "");
  const gradientId = `photo-bg-${photo.id}-${rawId}`;
  const blurId = `photo-blur-${photo.id}-${rawId}`;
  const patternId = `photo-noise-${photo.id}-${rawId}`;
  const [bg1, bg2] = photo.bg;

  return (
    <svg viewBox="0 0 800 600" width="100%" height="100%" className="photo-svg" role="img">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg1} />
          <stop offset="100%" stopColor={bg2} />
        </linearGradient>
        <filter id={blurId} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="16" />
        </filter>
        <pattern id={patternId} width="8" height="8" patternUnits="userSpaceOnUse">
          <rect width="8" height="8" fill="rgba(255,255,255,0.025)" />
          <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.05)" />
        </pattern>
      </defs>
      <rect width="800" height="600" fill={`url(#${gradientId})`} />
      <rect width="800" height="600" fill={`url(#${patternId})`} />
      <path d="M0 94 C150 142 230 48 395 96 S620 132 800 82" stroke="rgba(255,255,255,0.25)" fill="none" />
      {[70, 180, 295, 415, 548, 670, 760].map((x, index) => (
        <circle key={x} cx={x} cy={index % 2 ? 112 : 88} r="5" fill="rgba(253, 224, 71, 0.7)" />
      ))}
      <rect y="378" width="800" height="222" fill="rgba(0,0,0,0.24)" />
      <rect y="456" width="800" height="144" fill="rgba(255,255,255,0.07)" />
      {photo.figures.map((figure) => (
        <FigureShape
          blurId={blurId}
          blurThreshold={blurThreshold}
          figure={figure}
          highlightId={highlightId}
          key={figure.id}
          redacted={redacted}
        />
      ))}
    </svg>
  );
}

function FigureShape({
  figure,
  redacted,
  blurThreshold,
  highlightId,
  blurId
}: {
  figure: Figure;
  redacted: boolean;
  blurThreshold: number;
  highlightId?: string;
  blurId: string;
}) {
  const px = (figure.x / 100) * 800;
  const py = (figure.y / 100) * 600;
  const pw = (figure.w / 100) * 800;
  const ph = (figure.h / 100) * 600;
  const headR = pw * 0.32;
  const headCx = px + pw / 2;
  const headCy = py + headR;
  const shouldBlur = redacted && !!figure.match && figure.confidence >= blurThreshold;
  const isMatch = !!figure.match;
  const isHighlighted = highlightId === figure.id;
  const opacity = highlightId && !isHighlighted ? 0.46 : 1;
  const label = figure.confidence >= blurThreshold ? "BLURRED" : "REVIEW";
  const labelColor = figure.confidence >= blurThreshold ? "#10b981" : "#f59e0b";

  return (
    <g opacity={opacity}>
      <g filter={shouldBlur ? `url(#${blurId})` : undefined}>
        <path
          d={`M ${px} ${py + headR * 1.6}
            Q ${px} ${py + ph * 0.42}, ${px + pw * 0.16} ${py + ph * 0.52}
            L ${px + pw * 0.16} ${py + ph}
            L ${px + pw * 0.84} ${py + ph}
            L ${px + pw * 0.84} ${py + ph * 0.52}
            Q ${px + pw} ${py + ph * 0.42}, ${px + pw} ${py + headR * 1.6}
            Z`}
          fill={figure.color}
          opacity="0.92"
        />
        <circle cx={headCx} cy={headCy} r={headR} fill="#e7c7a2" />
        <path
          d={`M ${headCx - headR * 0.9} ${headCy - headR * 0.3}
            Q ${headCx} ${headCy - headR * 1.25}, ${headCx + headR * 0.9} ${headCy - headR * 0.3}
            Q ${headCx + headR * 0.6} ${headCy - headR * 0.75}, ${headCx} ${headCy - headR * 0.62}
            Q ${headCx - headR * 0.6} ${headCy - headR * 0.75}, ${headCx - headR * 0.9} ${headCy - headR * 0.3} Z`}
          fill="rgba(33, 24, 18, 0.72)"
        />
      </g>
      {redacted && isMatch && (
        <g>
          <rect
            x={headCx - headR * 1.42}
            y={headCy - headR * 1.42}
            width={headR * 2.84}
            height={headR * 2.84}
            fill="none"
            stroke={labelColor}
            strokeWidth="3"
            strokeDasharray="7 5"
            rx="6"
          />
          <rect
            x={headCx - headR * 1.42}
            y={headCy - headR * 1.42 - 28}
            width="126"
            height="23"
            fill={labelColor}
            rx="5"
          />
          <text
            x={headCx - headR * 1.42 + 8}
            y={headCy - headR * 1.42 - 12}
            fontSize="12"
            fontFamily="IBM Plex Mono, ui-monospace, monospace"
            fontWeight="700"
            fill="#fff"
          >
            {label} {Math.round(figure.confidence * 100)}%
          </text>
        </g>
      )}
    </g>
  );
}

function QRCode({ size = 140 }: { size?: number }) {
  const rows = [
    "1110111010111",
    "1000001011001",
    "1011101011101",
    "1011101000101",
    "1011101010001",
    "1000001001101",
    "1111111010101",
    "0000000011000",
    "1101011101110",
    "0010110010100",
    "1101101110111",
    "0110010100100",
    "1011110111110"
  ];

  return (
    <div className="qr" style={{ width: size, height: size }}>
      {rows.flatMap((row, rowIndex) =>
        row.split("").map((cell, cellIndex) => (
          <span className={cell === "1" ? "" : "off"} key={`${rowIndex}-${cellIndex}`} />
        ))
      )}
    </div>
  );
}

function Notice({
  icon = "lock",
  tone = "default",
  children
}: {
  icon?: IconName;
  tone?: "default" | "warn";
  children: ReactNode;
}) {
  return (
    <div className={`notice ${tone === "warn" ? "warn" : ""}`}>
      <Icon name={icon} size={18} />
      <div>{children}</div>
    </div>
  );
}

function PhotoStatusBadge({ status }: { status: PhotoStatus }) {
  const cfg: Record<PhotoStatus, { tone: string; label: string; icon: IconName }> = {
    not_processed: { tone: "muted", label: "Not processed", icon: "clock" },
    processing: { tone: "info", label: "Processing", icon: "refresh" },
    match: { tone: "ok", label: "Match found", icon: "check-circle" },
    no_match: { tone: "muted", label: "No match", icon: "check" },
    manual_review: { tone: "warn", label: "Manual review", icon: "flag" },
    processed: { tone: "ok", label: "Processed", icon: "check" }
  };
  const item = cfg[status];

  return (
    <span className={`badge ${item.tone}`}>
      <Icon name={item.icon} size={11} />
      {item.label}
    </span>
  );
}
