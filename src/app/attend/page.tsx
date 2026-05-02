"use client";

import {
  ChangeEvent,
  FormEvent,
  ReactElement,
  SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";

type EventRecord = {
  key: string;
  name: string;
  date: string;
  location: string;
  attendees: number;
  optOuts: number;
};

type EntrySource = "searched" | "qr-link";

type SubmissionRecord = {
  id: string;
  eventKey: string;
  eventName: string;
  name: string;
  photoDataUrl: string;
  photoName: string;
  source: EntrySource;
  submittedAt: string;
};

type Step = "lookup" | "details" | "submitted";

const STORAGE_KEY = "anonify-attendee-submissions";

const EVENTS: EventRecord[] = [
  {
    key: "HUSK-K7M2",
    name: "HuskyHack Demo Day",
    date: "May 2, 2026",
    location: "Main Atrium",
    attendees: 142,
    optOuts: 18
  },
  {
    key: "DEMO-2026",
    name: "Founder Showcase",
    date: "May 3, 2026",
    location: "Room 204",
    attendees: 86,
    optOuts: 9
  },
  {
    key: "SNAP-914",
    name: "Design Critique Night",
    date: "May 4, 2026",
    location: "Studio B",
    attendees: 64,
    optOuts: 7
  }
];

const normalizeKey = (value: string) =>
  value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const formatKey = (value: string) => {
  const normalized = normalizeKey(value);

  if (normalized.length <= 4) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
};

const findEvent = (value: string) => {
  const normalized = normalizeKey(value);

  return EVENTS.find((event) => normalizeKey(event.key) === normalized) ?? null;
};

const getUrlEventKey = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  const hashValue = url.hash.replace(/^#\/?/, "");

  return (
    url.searchParams.get("event") ??
    url.searchParams.get("key") ??
    url.searchParams.get("eventKey") ??
    hashValue
  );
};

export default function HomePage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<Step>("lookup");
  const [eventKey, setEventKey] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [entrySource, setEntrySource] = useState<EntrySource>("searched");
  const [lookupMessage, setLookupMessage] = useState("Search with an event key.");
  const [fullName, setFullName] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraStatus, setCameraStatus] = useState("Camera not started.");
  const [submission, setSubmission] = useState<SubmissionRecord | null>(null);

  const eventMatches = useMemo(() => {
    const normalized = normalizeKey(eventKey);

    if (!normalized) {
      return EVENTS;
    }

    return EVENTS.filter(
      (event) =>
        normalizeKey(event.key).includes(normalized) ||
        event.name.toUpperCase().includes(eventKey.toUpperCase())
    );
  }, [eventKey]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setCameraOpen(false);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    const qrEventKey = getUrlEventKey();

    if (!qrEventKey) {
      return;
    }

    const event = findEvent(qrEventKey);
    setEventKey(formatKey(qrEventKey));
    setSelectedEvent(event);
    setEntrySource("qr-link");

    if (event) {
      setStep("details");
      setLookupMessage(`${event.name} matched from the QR link.`);
      return;
    }

    setLookupMessage("That QR link did not match a known event.");
  }, []);

  useEffect(() => {
    if (!videoRef.current || !stream) {
      return;
    }

    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => {
      setCameraStatus("Tap play in the camera preview, then capture.");
    });
  }, [stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  const handleLookup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const match = findEvent(eventKey);
    setSelectedEvent(match);
    setEntrySource("searched");

    if (!match) {
      setStep("lookup");
      setLookupMessage("No event found for that key.");
      return;
    }

    setEventKey(match.key);
    setStep("details");
    setLookupMessage(`${match.name} is ready for your submission.`);
  };

  const chooseEvent = (event: EventRecord, source: EntrySource = "searched") => {
    setSelectedEvent(event);
    setEventKey(event.key);
    setEntrySource(source);
    setStep("details");
    setLookupMessage(`${event.name} is ready for your submission.`);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("Live camera is unavailable in this browser.");
      fileInputRef.current?.click();
      return;
    }

    try {
      stopCamera();
      setCameraStatus("Opening camera...");

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "user" },
          width: { ideal: 1280 },
          height: { ideal: 960 }
        }
      });

      setStream(mediaStream);
      setCameraOpen(true);
      setCameraStatus("Camera ready.");
    } catch {
      setCameraOpen(false);
      setCameraStatus("Camera access needs permission or HTTPS.");
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      setCameraStatus("Camera is still warming up.");
      return;
    }

    const width = video.videoWidth || 960;
    const height = video.videoHeight || 720;
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraStatus("Camera capture failed.");
      return;
    }

    canvas.width = width;
    canvas.height = height;
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);

    setPhotoDataUrl(canvas.toDataURL("image/jpeg", 0.88));
    setPhotoName("camera-selfie.jpg");
    setCameraStatus("Reference photo captured.");
    stopCamera();
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      setCameraStatus("Choose an image file.");
      event.currentTarget.value = "";
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        setCameraStatus("Could not read that image.");
        return;
      }

      setPhotoDataUrl(reader.result);
      setPhotoName(file.name || "reference-photo.jpg");
      setCameraStatus("Reference photo selected.");
      stopCamera();
    };

    reader.onerror = () => {
      setCameraStatus("Could not read that image.");
    };

    reader.readAsDataURL(file);
    event.currentTarget.value = "";
  };

  const submitToEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedEvent || !fullName.trim() || !photoDataUrl) {
      return;
    }

    const record: SubmissionRecord = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
      eventKey: selectedEvent.key,
      eventName: selectedEvent.name,
      name: fullName.trim(),
      photoDataUrl,
      photoName,
      source: entrySource,
      submittedAt: new Date().toISOString()
    };

    try {
      const existing = JSON.parse(
        localStorage.getItem(STORAGE_KEY) ?? "[]"
      ) as SubmissionRecord[];

      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify([record, ...existing].slice(0, 20))
      );
    } catch {
      // Local storage is optional for the demo flow.
    }

    setSubmission(record);
    setStep("submitted");
  };

  const resetFlow = () => {
    stopCamera();
    setStep("lookup");
    setSelectedEvent(null);
    setEntrySource("searched");
    setEventKey("");
    setFullName("");
    setPhotoDataUrl("");
    setPhotoName("");
    setSubmission(null);
    setLookupMessage("Search with an event key.");
    setCameraStatus("Camera not started.");
  };

  const canSubmit = Boolean(selectedEvent && fullName.trim() && photoDataUrl);

  return (
    <main className="attendee-page">
      <section className="attendee-shell" aria-label="Attendee submission">
        <div className="attendee-workspace">
          <header className="topbar">
            <div className="brand-lockup">
              <div className="brand-mark" aria-hidden="true">
                a
              </div>
              <div>
                <p className="eyebrow">anonify attendee</p>
                <h1>Submit your event reference photo</h1>
              </div>
            </div>
            <span className="privacy-pill">
              <Icon name="lock" size={14} />
              Private event upload
            </span>
          </header>

          <div className="progress-row" aria-label="Submission progress">
            <ProgressItem active={step === "lookup"} done={step !== "lookup"}>
              Event
            </ProgressItem>
            <ProgressItem active={step === "details"} done={step === "submitted"}>
              Name and photo
            </ProgressItem>
            <ProgressItem active={step === "submitted"} done={step === "submitted"}>
              Submitted
            </ProgressItem>
          </div>

          <div className="workspace-grid">
            <section className="panel lookup-panel" aria-labelledby="event-title">
              <div className="panel-heading">
                <div>
                  <p className="section-label">Event</p>
                  <h2 id="event-title">Find your event</h2>
                </div>
                <span className={`source-badge ${entrySource === "qr-link" ? "qr" : ""}`}>
                  <Icon name={entrySource === "qr-link" ? "qr" : "search"} size={14} />
                  {entrySource === "qr-link" ? "QR link" : "Search"}
                </span>
              </div>

              <form className="event-search" onSubmit={handleLookup}>
                <label htmlFor="event-key">Event key</label>
                <div className="input-row">
                  <input
                    id="event-key"
                    value={eventKey}
                    onChange={(event) => {
                      setEventKey(formatKey(event.target.value));
                      setEntrySource("searched");
                    }}
                    placeholder="HUSK-K7M2"
                    autoCapitalize="characters"
                    autoComplete="off"
                  />
                  <button className="icon-button" type="submit" aria-label="Search event">
                    <Icon name="search" />
                  </button>
                </div>
                <p className="helper-text">{lookupMessage}</p>
              </form>

              <div className="event-list" aria-label="Known demo events">
                {eventMatches.map((event) => (
                  <button
                    className={`event-option ${
                      selectedEvent?.key === event.key ? "selected" : ""
                    }`}
                    key={event.key}
                    onClick={() => chooseEvent(event)}
                    type="button"
                  >
                    <span>
                      <strong>{event.name}</strong>
                      <small>
                        {event.date} / {event.location}
                      </small>
                    </span>
                    <code>{event.key}</code>
                  </button>
                ))}
              </div>
            </section>

            <form className="panel capture-panel" onSubmit={submitToEvent}>
              <div className="panel-heading">
                <div>
                  <p className="section-label">Attendee</p>
                  <h2>Name and reference photo</h2>
                </div>
                <span className="source-badge">
                  <Icon name="shield" size={14} />
                  Event scoped
                </span>
              </div>

              <label className="field-label" htmlFor="full-name">
                Your name
              </label>
              <input
                id="full-name"
                className="text-input"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="First and last name"
                autoComplete="name"
              />

              <div className="camera-header">
                <div>
                  <label className="field-label">Reference photo</label>
                  <p className="helper-text compact">{cameraStatus}</p>
                </div>
                {photoDataUrl ? (
                  <button
                    className="text-button"
                    onClick={() => {
                      setPhotoDataUrl("");
                      setPhotoName("");
                      setCameraStatus("Camera not started.");
                    }}
                    type="button"
                  >
                    Replace
                  </button>
                ) : null}
              </div>

              <div className="camera-preview">
                {photoDataUrl ? (
                  <img src={photoDataUrl} alt="Captured reference" />
                ) : cameraOpen ? (
                  <video ref={videoRef} autoPlay muted playsInline />
                ) : (
                  <div className="camera-empty">
                    <Icon name="camera" size={38} />
                    <span>Ready for a selfie</span>
                  </div>
                )}
              </div>

              <div className="camera-actions">
                {!cameraOpen ? (
                  <button className="secondary-button" onClick={startCamera} type="button">
                    <Icon name="camera" size={16} />
                    Use camera
                  </button>
                ) : (
                  <>
                    <button className="primary-button" onClick={capturePhoto} type="button">
                      <Icon name="check" size={16} />
                      Capture
                    </button>
                    <button className="secondary-button" onClick={stopCamera} type="button">
                      Stop
                    </button>
                  </>
                )}
                <button
                  className="secondary-button"
                  onClick={() => fileInputRef.current?.click()}
                  type="button"
                >
                  <Icon name="upload" size={16} />
                  Take or upload
                </button>
              </div>

              <input
                ref={fileInputRef}
                className="hidden-file"
                type="file"
                accept="image/*"
                capture="user"
                onChange={handleFileSelection}
              />
              <canvas ref={canvasRef} hidden />

              <button className="submit-button" disabled={!canSubmit} type="submit">
                <Icon name="send" size={16} />
                Submit to event
              </button>
            </form>
          </div>
        </div>

        <aside className="receipt-panel" aria-label="Event submission receipt">
          <div className="phone-frame">
            <div className="phone-speaker" aria-hidden="true" />
            <div className="phone-screen">
              {step === "submitted" && submission ? (
                <Receipt submission={submission} onReset={resetFlow} />
              ) : (
                <EventCard event={selectedEvent} photoDataUrl={photoDataUrl} />
              )}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function ProgressItem({
  active,
  done,
  children
}: {
  active: boolean;
  done: boolean;
  children: string;
}) {
  return (
    <div className={`progress-item ${active ? "active" : ""} ${done ? "done" : ""}`}>
      <span>{done ? <Icon name="check" size={13} /> : null}</span>
      {children}
    </div>
  );
}

function EventCard({
  event,
  photoDataUrl
}: {
  event: EventRecord | null;
  photoDataUrl: string;
}) {
  return (
    <div className="mobile-card">
      <div className="mobile-brand">
        <div className="brand-mark small" aria-hidden="true">
          a
        </div>
        <span>anonify</span>
      </div>

      <div className="mobile-photo">
        {photoDataUrl ? (
          <img src={photoDataUrl} alt="Selected reference" />
        ) : (
          <Icon name="camera" size={42} />
        )}
      </div>

      <p className="section-label">Current event</p>
      <h3>{event?.name ?? "No event selected"}</h3>
      <dl>
        <div>
          <dt>Key</dt>
          <dd>{event?.key ?? "-"}</dd>
        </div>
        <div>
          <dt>Date</dt>
          <dd>{event?.date ?? "-"}</dd>
        </div>
        <div>
          <dt>Opt-outs</dt>
          <dd>{event ? `${event.optOuts} on file` : "-"}</dd>
        </div>
      </dl>
    </div>
  );
}

function Receipt({
  submission,
  onReset
}: {
  submission: SubmissionRecord;
  onReset: () => void;
}) {
  const submittedAt = new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(submission.submittedAt));

  return (
    <div className="mobile-card receipt">
      <div className="success-mark">
        <Icon name="check" size={28} />
      </div>
      <h3>Submitted</h3>
      <p>
        {submission.name} has a reference photo attached to {submission.eventName}.
      </p>
      <img className="receipt-photo" src={submission.photoDataUrl} alt="" />
      <dl>
        <div>
          <dt>Event</dt>
          <dd>{submission.eventKey}</dd>
        </div>
        <div>
          <dt>Source</dt>
          <dd>{submission.source === "qr-link" ? "QR link" : "Search"}</dd>
        </div>
        <div>
          <dt>Time</dt>
          <dd>{submittedAt}</dd>
        </div>
      </dl>
      <button className="secondary-button full" onClick={onReset} type="button">
        New submission
      </button>
    </div>
  );
}

type IconName =
  | "camera"
  | "check"
  | "lock"
  | "qr"
  | "search"
  | "send"
  | "shield"
  | "upload";

function Icon({
  name,
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactElement> = {
    camera: (
      <>
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    check: <path d="M20 6 9 17l-5-5" />,
    lock: (
      <>
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
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
    search: (
      <>
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.3-4.3" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    shield: <path d="M12 2 4 5v7c0 4.5 3.5 8.5 8 10 4.5-1.5 8-5.5 8-10V5z" />,
    upload: (
      <>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <path d="M17 8 12 3 7 8" />
        <path d="M12 3v12" />
      </>
    )
  };

  return (
    <svg
      aria-hidden="true"
      fill="none"
      height={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width={size}
      {...props}
    >
      {paths[name]}
    </svg>
  );
}
