"use client";

import {
  FormEvent,
  ReactElement,
  SVGProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { events } from "@/lib/mock-data";

type ConsentChoice = "opt-in" | "opt-out";
type EntrySource = "search" | "qr-link" | "qr-camera";
type Step = "lookup" | "consent" | "reference" | "submitted";

type SubmissionRecord = {
  id: string;
  consent: ConsentChoice;
  eventKey: string;
  eventName: string;
  name: string;
  photoDataUrl?: string;
  source: EntrySource;
  submittedAt: string;
};

const STORAGE_KEY = "anonify-attendee-submissions";

const normalizeKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const formatKey = (value: string) => {
  const normalized = normalizeKey(value);
  return normalized.length <= 4 ? normalized : `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}`;
};

const findEvent = (value: string) => {
  const normalized = normalizeKey(value);
  return events.find((event) => normalizeKey(event.key) === normalized) ?? null;
};

const getUrlEventKey = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  return (
    url.searchParams.get("event") ??
    url.searchParams.get("key") ??
    url.searchParams.get("eventKey") ??
    url.hash.replace(/^#\/?/, "")
  );
};

export default function AttendPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const qrTimerRef = useRef<number | null>(null);

  const [step, setStep] = useState<Step>("lookup");
  const [eventKey, setEventKey] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(events[0] ?? null);
  const [source, setSource] = useState<EntrySource>("search");
  const [lookupMessage, setLookupMessage] = useState("Scan a QR code or search for your event.");
  const [fullName, setFullName] = useState("");
  const [consent, setConsent] = useState<ConsentChoice>("opt-out");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraMode, setCameraMode] = useState<"reference" | "qr" | null>(null);
  const [cameraStatus, setCameraStatus] = useState("Camera is idle.");
  const [countdown, setCountdown] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [submission, setSubmission] = useState<SubmissionRecord | null>(null);

  const matches = useMemo(() => {
    const normalized = normalizeKey(eventKey);
    if (!normalized) {
      return events;
    }

    return events.filter(
      (event) =>
        normalizeKey(event.key).includes(normalized) ||
        event.name.toUpperCase().includes(eventKey.toUpperCase())
    );
  }, [eventKey]);

  const stopCamera = useCallback(() => {
    stream?.getTracks().forEach((track) => track.stop());
    setStream(null);
    setCameraMode(null);
    setCountdown(0);
    setIsCountingDown(false);

    if (qrTimerRef.current) {
      window.clearInterval(qrTimerRef.current);
      qrTimerRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [stream]);

  useEffect(() => {
    const urlKey = getUrlEventKey();
    if (!urlKey) {
      return;
    }

    const event = findEvent(urlKey);
    setEventKey(formatKey(urlKey));
    setSource("qr-link");

    if (event) {
      setSelectedEvent(event);
      setStep("consent");
      setLookupMessage(`${event.name} matched from the QR link.`);
    } else {
      setLookupMessage("That QR link did not match a known event.");
    }
  }, []);

  useEffect(() => {
    if (!videoRef.current || !stream) {
      return;
    }

    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => setCameraStatus("Tap the preview to start the camera."));
  }, [stream]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const chooseEvent = (event: (typeof events)[number], entrySource: EntrySource = "search") => {
    stopCamera();
    setSelectedEvent(event);
    setEventKey(event.key);
    setSource(entrySource);
    setLookupMessage(`${event.name} selected.`);
    setStep("consent");
  };

  const searchEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const match = findEvent(eventKey);

    if (!match) {
      setLookupMessage("No event found for that key.");
      setStep("lookup");
      return;
    }

    chooseEvent(match, "search");
  };

  const openCamera = async (mode: "reference" | "qr") => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("Camera is unavailable in this browser.");
      return;
    }

    try {
      stopCamera();
      setCameraStatus(mode === "qr" ? "Opening QR scanner..." : "Opening camera...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: mode === "qr" ? { ideal: "environment" } : { ideal: "user" },
          height: { ideal: 960 },
          width: { ideal: 1280 }
        }
      });

      setStream(mediaStream);
      setCameraMode(mode);
      setCameraStatus(mode === "qr" ? "Point the camera at the event QR code." : "Camera ready.");
    } catch {
      setCameraStatus("Camera access needs permission or HTTPS.");
    }
  };

  useEffect(() => {
    if (cameraMode !== "qr" || !stream) {
      return;
    }

    qrTimerRef.current = window.setInterval(async () => {
      const video = videoRef.current;
      const canvas = qrCanvasRef.current;

      if (!video || !canvas || video.readyState < 2) {
        return;
      }

      const detectorConstructor = (window as unknown as {
        BarcodeDetector?: new (options: { formats: string[] }) => {
          detect: (source: HTMLCanvasElement) => Promise<Array<{ rawValue: string }>>;
        };
      }).BarcodeDetector;

      if (!detectorConstructor) {
        setCameraStatus("Live QR scanning is unavailable here. Use the event key search.");
        return;
      }

      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);

      try {
        const detector = new detectorConstructor({ formats: ["qr_code"] });
        const codes = await detector.detect(canvas);
        const rawValue = codes[0]?.rawValue;

        if (!rawValue) {
          return;
        }

        const parsed = rawValue.includes("?") ? new URL(rawValue).searchParams.get("event") ?? rawValue : rawValue;
        const event = findEvent(parsed);

        if (event) {
          chooseEvent(event, "qr-camera");
        } else {
          setCameraStatus("QR scanned, but the event key was not recognized.");
        }
      } catch {
        setCameraStatus("QR scanning paused. You can still search by event key.");
      }
    }, 900);

    return () => {
      if (qrTimerRef.current) {
        window.clearInterval(qrTimerRef.current);
        qrTimerRef.current = null;
      }
    };
  }, [cameraMode, chooseEvent, stream]);

  const captureReference = useCallback(() => {
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
    setCameraStatus("Reference photo captured.");
    stopCamera();
  }, [stopCamera]);

  const startSteadyCountdown = () => {
    if (cameraMode !== "reference" || !stream || isCountingDown) {
      return;
    }

    setIsCountingDown(true);
    setCountdown(3);
    setCameraStatus("Hold steady in the grid.");

    let nextCount = 3;
    const timer = window.setInterval(() => {
      nextCount -= 1;

      if (nextCount > 0) {
        setCountdown(nextCount);
        return;
      }

      window.clearInterval(timer);
      setCountdown(0);
      setIsCountingDown(false);
      captureReference();
    }, 1000);
  };

  const submitConsent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedEvent || !fullName.trim()) {
      return;
    }

    if (consent === "opt-out" && !photoDataUrl) {
      setStep("reference");
      return;
    }

    const record: SubmissionRecord = {
      id:
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}`,
      consent,
      eventKey: selectedEvent.key,
      eventName: selectedEvent.name,
      name: fullName.trim(),
      photoDataUrl: consent === "opt-out" ? photoDataUrl : undefined,
      source,
      submittedAt: new Date().toISOString()
    };

    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SubmissionRecord[];
      localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...existing].slice(0, 40)));
    } catch {
      // Local storage is optional for the demo flow.
    }

    setSubmission(record);
    setStep("submitted");
  };

  const canSubmit = Boolean(selectedEvent && fullName.trim() && (consent === "opt-in" || photoDataUrl));

  return (
    <main className="attendee-page">
      <section className="attendee-shell" aria-label="Attendee consent flow">
        <header className="attendee-header">
          <div className="brand-lockup">
            <span className="brand-mark" aria-hidden="true">a</span>
            <div>
              <strong>Anonify</strong>
              <small>attendee privacy</small>
            </div>
          </div>
          <a className="link-button" href="/sign-in">Organizer sign in</a>
        </header>

        <div className="attendee-layout">
          <section className="attendee-card">
            <StepBar step={step} />

            {step === "lookup" ? (
              <>
                <p className="section-label">Find event</p>
                <h1>Choose where your privacy preference applies.</h1>
                <p className="helper-text">{lookupMessage}</p>

                <div className="qr-panel">
                  <div className="qr-mark" aria-hidden="true">
                    <Icon name="qr" size={52} />
                  </div>
                  <div>
                    <strong>Scan event QR</strong>
                    <p>Use your camera when supported, or enter the event key below.</p>
                  </div>
                  <button className="secondary-button" onClick={() => openCamera("qr")} type="button">
                    <Icon name="camera" size={16} />
                    Scan
                  </button>
                </div>

                {cameraMode === "qr" ? (
                  <div className="camera-preview qr">
                    <video ref={videoRef} autoPlay muted playsInline />
                  </div>
                ) : null}

                <form className="lookup-form" onSubmit={searchEvent}>
                  <label htmlFor="event-key">Event key or name</label>
                  <div className="input-row">
                    <input
                      id="event-key"
                      autoCapitalize="characters"
                      autoComplete="off"
                      onChange={(event) => {
                        setEventKey(formatKey(event.target.value));
                        setSource("search");
                      }}
                      placeholder="HUSKY-42F7"
                      value={eventKey}
                    />
                    <button className="primary-button icon-only" type="submit" aria-label="Search event">
                      <Icon name="search" />
                    </button>
                  </div>
                </form>

                <div className="event-list">
                  {matches.map((event) => (
                    <button className="event-option" key={event.id} onClick={() => chooseEvent(event)} type="button">
                      <span>
                        <strong>{event.name}</strong>
                        <small>{event.date}</small>
                      </span>
                      <code>{event.key}</code>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {step === "consent" || step === "reference" ? (
              <form className="consent-form" onSubmit={submitConsent}>
                <p className="section-label">Consent</p>
                <h1>{selectedEvent?.name}</h1>
                <p className="helper-text">Tell the organizer whether you are okay appearing in shared event photos.</p>

                <label htmlFor="full-name">Your name</label>
                <input
                  id="full-name"
                  autoComplete="name"
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="First and last name"
                  value={fullName}
                />

                <div className="choice-grid" role="radiogroup" aria-label="Photo consent">
                  <button
                    className={`choice-card ${consent === "opt-in" ? "selected" : ""}`}
                    onClick={() => {
                      setConsent("opt-in");
                      setStep("consent");
                    }}
                    type="button"
                  >
                    <Icon name="check" size={20} />
                    <span>
                      <strong>Opt in</strong>
                      <small>I am okay appearing in event photos.</small>
                    </span>
                  </button>
                  <button
                    className={`choice-card ${consent === "opt-out" ? "selected" : ""}`}
                    onClick={() => {
                      setConsent("opt-out");
                      setStep("reference");
                    }}
                    type="button"
                  >
                    <Icon name="shield" size={20} />
                    <span>
                      <strong>Opt out</strong>
                      <small>Please blur my face before photos are shared.</small>
                    </span>
                  </button>
                </div>

                {consent === "opt-out" ? (
                  <div className="reference-section">
                    <div className="spread">
                      <div>
                          <strong>Steady reference photo</strong>
                          <p>{cameraStatus}</p>
                      </div>
                      {photoDataUrl ? (
                        <button className="text-button" onClick={() => setPhotoDataUrl("")} type="button">
                          Replace
                        </button>
                      ) : null}
                    </div>

                    <div className="camera-preview">
                      {photoDataUrl ? (
                        <img alt="Selected reference" src={photoDataUrl} />
                      ) : cameraMode === "reference" ? (
                        <div className="steady-camera">
                          <video ref={videoRef} autoPlay muted playsInline />
                          <div className="camera-grid" aria-hidden="true" />
                          {countdown > 0 ? <span className="countdown-badge">{countdown}</span> : null}
                        </div>
                      ) : (
                        <div className="camera-empty">
                          <Icon name="camera" size={36} />
                          <span>Open camera and hold steady</span>
                        </div>
                      )}
                    </div>

                    <div className="button-row">
                      {cameraMode === "reference" ? (
                        <button
                          className="primary-button"
                          disabled={isCountingDown}
                          onClick={startSteadyCountdown}
                          type="button"
                        >
                          {isCountingDown ? "Hold steady..." : "Start 3 second capture"}
                        </button>
                      ) : (
                        <button className="secondary-button" onClick={() => openCamera("reference")} type="button">
                          <Icon name="camera" size={16} />
                          Use camera
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                <canvas ref={canvasRef} hidden />
                <canvas ref={qrCanvasRef} hidden />

                <button className="submit-button" disabled={!canSubmit} type="submit">
                  Submit preference
                </button>
              </form>
            ) : null}

            {step === "submitted" && submission ? (
              <section className="receipt-card">
                <span className="success-mark">
                  <Icon name="check" size={30} />
                </span>
                <p className="section-label">Submitted</p>
                <h1>Preference saved.</h1>
                <p>
                  {submission.name} is {submission.consent === "opt-out" ? "opted out of" : "opted in to"} public photos for {submission.eventName}.
                </p>
                {submission.photoDataUrl ? <img alt="" src={submission.photoDataUrl} /> : null}
                <button
                  className="secondary-button full"
                  onClick={() => {
                    stopCamera();
                    setStep("lookup");
                    setPhotoDataUrl("");
                    setFullName("");
                    setSubmission(null);
                  }}
                  type="button"
                >
                  Submit another preference
                </button>
              </section>
            ) : null}
          </section>

          <aside className="event-summary-panel" aria-label="Selected event">
            <p className="section-label">Selected event</p>
            <h2>{selectedEvent?.name ?? "No event selected"}</h2>
            <dl>
              <div>
                <dt>Key</dt>
                <dd>{selectedEvent?.key ?? "-"}</dd>
              </div>
              <div>
                <dt>Date</dt>
                <dd>{selectedEvent?.date ?? "-"}</dd>
              </div>
              <div>
                <dt>Entry</dt>
                <dd>{source === "qr-camera" ? "QR scan" : source === "qr-link" ? "QR link" : "Search"}</dd>
              </div>
            </dl>
          </aside>
        </div>
      </section>
    </main>
  );
}

function StepBar({ step }: { step: Step }) {
  const steps: Step[] = ["lookup", "consent", "reference", "submitted"];
  const activeIndex = steps.indexOf(step);

  return (
    <div className="step-bar" aria-label="Consent progress">
      {steps.map((item, index) => (
        <span className={index <= activeIndex ? "active" : ""} key={item} />
      ))}
    </div>
  );
}

type IconName = "camera" | "check" | "qr" | "search" | "shield";

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
    shield: <path d="M12 2 4 5v7c0 4.5 3.5 8.5 8 10 4.5-1.5 8-5.5 8-10V5z" />
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
