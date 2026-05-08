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
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { adaptEvent, getBackendHealth, getEventByKey, seedDemoData, submitAttendee } from "@/lib/api";
import { events, type EventSummary } from "@/lib/mock-data";

type ConsentChoice = "opt-in" | "opt-out";
type Step = "lookup" | "consent" | "reference" | "submitted";
type CaptureState = "idle" | "ready" | "counting" | "valid" | "invalid" | "captured";

type SubmissionRecord = {
  id: string;
  consent: ConsentChoice;
  eventKey: string;
  eventName: string;
  name: string;
  photoDataUrl?: string;
  submittedAt: string;
};

type FaceBox = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type FaceDetectionResult = {
  boundingBox: DOMRectReadOnly | FaceBox;
};

const STORAGE_KEY = "anonify-attendee-submissions";

const normalizeKey = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

const formatKey = (value: string) => {
  const normalized = normalizeKey(value);
  if ("HUSKY".startsWith(normalized)) {
    return normalized;
  }

  if (normalized.startsWith("HUSKY")) {
    const suffix = normalized.slice(5, 9);
    return suffix ? `HUSKY-${suffix}` : normalized;
  }

  return normalized.length <= 3 ? normalized : `${normalized.slice(0, 3)}-${normalized.slice(3, 7)}`;
};

const findEvent = (value: string, eventList: EventSummary[]) => {
  const normalized = normalizeKey(value);
  return eventList.find((event) => normalizeKey(event.key) === normalized) ?? null;
};

const toEventSummary = (event: ReturnType<typeof adaptEvent>): EventSummary => ({
  id: event.id,
  name: event.name,
  date: "May 2, 2026",
  key: event.key,
  attendees: 0,
  optOuts: 0,
  photos: 0,
  processed: 0,
  needsReview: 0,
  active: true
});

const getUrlEventKey = () => {
  if (typeof window === "undefined") {
    return "";
  }

  const url = new URL(window.location.href);
  return url.searchParams.get("event") ?? url.searchParams.get("key") ?? url.searchParams.get("eventKey") ?? "";
};

export default function AttendPage() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousFrameRef = useRef<Uint8ClampedArray | null>(null);
  const invalidCaptureRef = useRef(false);
  const countdownTimerRef = useRef<number | null>(null);
  const validationTimerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoReadyRef = useRef(false);

  const [step, setStep] = useState<Step>("lookup");
  const [eventKey, setEventKey] = useState("");
  const [eventList, setEventList] = useState<EventSummary[]>(events);
  const [selectedEvent, setSelectedEvent] = useState<EventSummary | null>(events[0] ?? null);
  const [lookupMessage, setLookupMessage] = useState("Search by event name or event key to join.");
  const [fullName, setFullName] = useState("");
  const [consent, setConsent] = useState<ConsentChoice>("opt-out");
  const [photoDataUrl, setPhotoDataUrl] = useState("");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraStatus, setCameraStatus] = useState("Camera is idle.");
  const [captureState, setCaptureState] = useState<CaptureState>("idle");
  const [countdown, setCountdown] = useState(0);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [faceInside, setFaceInside] = useState(false);
  const [movementScore, setMovementScore] = useState(0);
  const [submission, setSubmission] = useState<SubmissionRecord | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const matches = useMemo(() => {
    const normalized = normalizeKey(eventKey);
    if (!normalized) {
      return eventList;
    }

    return eventList.filter(
      (event) =>
        normalizeKey(event.key).includes(normalized) ||
        event.name.toUpperCase().includes(eventKey.toUpperCase())
    );
  }, [eventKey, eventList]);

  const stopCamera = useCallback(() => {
    if (countdownTimerRef.current) {
      window.clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }

    if (validationTimerRef.current) {
      window.clearInterval(validationTimerRef.current);
      validationTimerRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setCountdown(0);
    setIsCountingDown(false);
    setFaceInside(false);
    setVideoReady(false);
    videoReadyRef.current = false;
    previousFrameRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    if (!videoRef.current || !stream) {
      return;
    }

    const video = videoRef.current;
    video.srcObject = stream;

    const markReady = () => {
      videoReadyRef.current = true;
      setVideoReady(true);
      setFaceInside(false);
      setCaptureState("ready");
      setCameraStatus("Camera ready. Center your face in the frame.");
      void video.play().catch(() => setCameraStatus("Tap the preview to start the camera."));
    };

    video.addEventListener("loadedmetadata", markReady, { once: true });
    void video.play().catch(() => setCameraStatus("Tap the preview to start the camera."));

    return () => {
      video.removeEventListener("loadedmetadata", markReady);
    };
  }, [stream]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const chooseEvent = useCallback((event: EventSummary) => {
    stopCamera();
    setSelectedEvent(event);
    setEventKey(event.key);
    setLookupMessage(`${event.name} selected.`);
    setSubmitError("");
    setStep("consent");
  }, [stopCamera]);

  const lookupBackendEvent = useCallback(async (value: string) => {
    const formattedKey = formatKey(value);
    let result = await getEventByKey(formattedKey);
    if (!result.ok && formattedKey === "HUSKY-42F7") {
      await seedDemoData();
      result = await getEventByKey(formattedKey);
    }

    if (!result.ok) {
      return null;
    }

    const backendEvent = toEventSummary(adaptEvent(result.data));
    setEventList((currentEvents) => [
      backendEvent,
      ...currentEvents.filter((event) => normalizeKey(event.key) !== normalizeKey(backendEvent.key))
    ]);
    return backendEvent;
  }, []);

  useEffect(() => {
    const urlKey = getUrlEventKey();
    if (!urlKey) {
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        const event = (await lookupBackendEvent(urlKey)) ?? findEvent(urlKey, eventList);

        if (cancelled) {
          return;
        }

        setEventKey(formatKey(urlKey));

        if (event) {
          chooseEvent(event);
          setLookupMessage(`${event.name} matched from the event link.`);
        } else {
          setLookupMessage("That event link did not match a known event.");
        }
      })();
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [chooseEvent, eventList, lookupBackendEvent]);

  const searchEvent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupMessage("Searching for that event...");
    const match = (await lookupBackendEvent(eventKey)) ?? findEvent(eventKey, eventList);

    if (!match) {
      setLookupMessage("No event found for that key or name.");
      setStep("lookup");
      return;
    }

    chooseEvent(match);
  };

  const openCamera = async () => {
    console.log("[attend] openCamera: start, getUserMedia available:", Boolean(navigator.mediaDevices?.getUserMedia));
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStatus("Camera is unavailable in this browser. Try desktop Chrome, Edge, or a mobile browser.");
      setCaptureState("invalid");
      return;
    }

    try {
      stopCamera();
      setCameraStatus("Opening camera...");
      setCaptureState("idle");
      setVideoReady(false);
      let mediaStream: MediaStream;

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "user" },
            height: { ideal: 960 },
            width: { ideal: 1280 }
          }
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true
        });
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      setCameraStatus("Camera warming up...");
      console.log("[attend] openCamera: stream acquired, tracks:", mediaStream.getTracks().map(t => `${t.kind}:${t.readyState}`));
    } catch (err) {
      console.error("[attend] openCamera: failed", err);
      setCameraStatus("Camera access needs permission or HTTPS.");
      setCaptureState("invalid");
    }
  };

  const measureFrame = useCallback(async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      return { inside: false, movement: 1 };
    }

    const sampleWidth = 96;
    const sampleHeight = 72;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) {
      return { inside: false, movement: 1 };
    }

    canvas.width = sampleWidth;
    canvas.height = sampleHeight;
    context.drawImage(video, 0, 0, sampleWidth, sampleHeight);
    const frame = context.getImageData(0, 0, sampleWidth, sampleHeight).data;
    const previous = previousFrameRef.current;
    let movement = 0;

    if (previous) {
      let diff = 0;
      for (let index = 0; index < frame.length; index += 16) {
        diff += Math.abs(frame[index] - previous[index]);
      }
      movement = Math.min(diff / (frame.length / 16) / 42, 1);
    }

    previousFrameRef.current = new Uint8ClampedArray(frame);

    let inside = false;
    const detectorConstructor = (window as unknown as {
      FaceDetector?: new () => {
        detect: (source: HTMLVideoElement) => Promise<FaceDetectionResult[]>;
      };
    }).FaceDetector;

    if (detectorConstructor) {
      try {
        const faces = await new detectorConstructor().detect(video);
        const face = faces[0]?.boundingBox;
        if (!face) {
          inside = false;
        } else {
          const faceLeft = face.x;
          const faceRight = face.x + face.width;
          const faceTop = face.y;
          const faceBottom = face.y + face.height;
          const gridLeft = video.videoWidth * 0.18;
          const gridRight = video.videoWidth * 0.82;
          const gridTop = video.videoHeight * 0.1;
          const gridBottom = video.videoHeight * 0.88;
          inside = faceLeft >= gridLeft && faceRight <= gridRight && faceTop >= gridTop && faceBottom <= gridBottom;
        }
      } catch {
        inside = false;
      }
    } else {
      // Shape Detection is not available in every browser. Fall back to requiring
      // a stable, non-blank camera feed so capture still works on Safari/Firefox.
      let lumaTotal = 0;
      let lumaSquaredTotal = 0;
      let samples = 0;

      for (let index = 0; index < frame.length; index += 16) {
        const luma = frame[index] * 0.299 + frame[index + 1] * 0.587 + frame[index + 2] * 0.114;
        lumaTotal += luma;
        lumaSquaredTotal += luma * luma;
        samples += 1;
      }

      const mean = lumaTotal / samples;
      const variance = lumaSquaredTotal / samples - mean * mean;
      inside = mean > 20 && mean < 238 && variance > 55;
    }

    return { inside, movement };
  }, []);

  const captureReference = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      setCameraStatus("Camera is still warming up.");
      setCaptureState("invalid");
      return;
    }

    const width = video.videoWidth || 960;
    const height = video.videoHeight || 720;
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraStatus("Camera capture failed.");
      setCaptureState("invalid");
      return;
    }

    canvas.width = width;
    canvas.height = height;
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.translate(width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, width, height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
    console.log("[attend] captureReference: captured, dataUrl length:", dataUrl.length, "starts with data:image:", dataUrl.startsWith("data:image/"));
    setPhotoDataUrl(dataUrl);
    context.setTransform(1, 0, 0, 1, 0, 0);
    setCameraStatus("Good capture saved.");
    setCaptureState("captured");
    stopCamera();
  }, [stopCamera]);

  const startSteadyCountdown = useCallback(() => {
    if (!streamRef.current || !videoReadyRef.current || isCountingDown || countdownTimerRef.current) {
      if (!videoReadyRef.current) {
        setCameraStatus("Camera is still warming up. Try again in a moment.");
      }
      return;
    }

    invalidCaptureRef.current = false;
    previousFrameRef.current = null;
    setIsCountingDown(true);
    setCountdown(3);
    setCaptureState("counting");
    setCameraStatus("Hold steady in the frame.");

    let failedSamples = 0;
    validationTimerRef.current = window.setInterval(() => {
      void (async () => {
        const result = await measureFrame();
        const tooMuchMovement = result.movement > 0.55;
        setFaceInside(result.inside);
        setMovementScore(result.movement);

        if (!result.inside || tooMuchMovement) {
          failedSamples += 1;
          setCaptureState("invalid");
          setCameraStatus(!result.inside ? "Please stay within the frame." : "Please hold still.");

          if (failedSamples >= 99) {
            invalidCaptureRef.current = true;
          }
        } else {
          failedSamples = 0;
          setCaptureState("valid");
          setCameraStatus("Good position. Keep holding.");
        }
      })();
    }, 260);

    let nextCount = 3;
    countdownTimerRef.current = window.setInterval(() => {
      nextCount -= 1;

      if (nextCount > 0) {
        setCountdown(nextCount);
        return;
      }

      if (countdownTimerRef.current) {
        window.clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
      }

      if (validationTimerRef.current) {
        window.clearInterval(validationTimerRef.current);
        validationTimerRef.current = null;
      }
      setCountdown(0);
      setIsCountingDown(false);

      if (invalidCaptureRef.current) {
        setCaptureState("invalid");
        setCameraStatus("Please stay within the frame. Retake when ready.");
        return;
      }

      captureReference();
    }, 1000);
  }, [captureReference, isCountingDown, measureFrame]);

  const submitConsent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log("[attend] submitConsent: clicked, consent:", consent, "photoDataUrl set:", Boolean(photoDataUrl), "photoDataUrl length:", photoDataUrl?.length ?? 0, "selectedEvent:", selectedEvent?.key);

    if (isSubmitting || !selectedEvent || !fullName.trim()) {
      return;
    }

    if (consent === "opt-out" && !photoDataUrl) {
      setStep("reference");
      setSubmitError("Take a reference photo before submitting your opt-out preference.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");

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
      submittedAt: new Date().toISOString()
    };

    try {
      const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as SubmissionRecord[];
      localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...existing].slice(0, 40)));
    } catch {
      // Local storage is optional for the demo flow.
    }

    try {
      const backendEvent = await lookupBackendEvent(selectedEvent.key);
      const backendEventId = backendEvent?.id ?? (/^\d+$/.test(selectedEvent.id) ? selectedEvent.id : null);

      if (backendEventId) {
        const photoPayload = consent === "opt-out" ? photoDataUrl || null : null;
        console.log("[attend] submitAttendee: backendEventId:", backendEventId, "sending reference_photo_url:", photoPayload ? `[data URL, length ${photoPayload.length}]` : null);
        const submitResult = await submitAttendee(backendEventId, {
          name: record.name,
          consent_status: consent === "opt-out" ? "opted_out" : "consented",
          opted_out: consent === "opt-out",
          reference_photo_url: photoPayload
        });
        console.log("[attend] submitAttendee: result ok:", submitResult.ok, submitResult.ok ? "" : `error: ${submitResult.error}`);

        if (!submitResult.ok) {
          throw new Error(submitResult.error);
        }
      } else {
        const health = await getBackendHealth();
        if (!health.ok) {
          throw new Error(health.error);
        }
        throw new Error("Backend event was not found. Check the event key and make sure the backend is seeded.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSubmitError(`Could not save to the organizer dashboard: ${message}`);
      setIsSubmitting(false);
      return;
    }

    {
      setSubmission(record);
      setStep("submitted");
      setIsSubmitting(false);
    }
  };

  const canSubmit = Boolean(selectedEvent && fullName.trim() && (consent === "opt-in" || photoDataUrl));
  const movementLabel = movementScore < 0.22 ? "Stable" : movementScore < 0.55 ? "Slight movement" : "Too much movement";

  return (
    <main className="attendee-page">
      <section className="attendee-shell" aria-label="Attendee consent flow">
        <header className="attendee-header">
          <BrandLogo subtitle="attendee privacy" />
          <Link className="link-button" href="/">Back home</Link>
        </header>

        <div className="attendee-layout">
          <section className="attendee-card">
            <StepBar step={step} />

            {step === "lookup" ? (
              <>
                <p className="section-label">Find event</p>
                <h1>Search and join your event.</h1>
                <p className="helper-text">{lookupMessage}</p>

                <form className="lookup-form hero-search" onSubmit={searchEvent}>
                  <label htmlFor="event-key">Event key or event name</label>
                  <div className="input-row">
                    <input
                      id="event-key"
                      autoCapitalize="characters"
                      autoComplete="off"
                      onChange={(event) => setEventKey(formatKey(event.target.value))}
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
                      setSubmitError("");
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
                      setSubmitError("");
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
                        <strong>Smart reference capture</strong>
                        <p>{cameraStatus}</p>
                      </div>
                      {photoDataUrl ? (
                        <button
                          className="text-button"
                          onClick={() => {
                            setPhotoDataUrl("");
                            setCaptureState("idle");
                            setSubmitError("");
                          }}
                          type="button"
                        >
                          Retake
                        </button>
                      ) : null}
                    </div>

                    <div className={`camera-preview capture-${captureState}`}>
                      {photoDataUrl ? (
                        <img alt="Selected reference" src={photoDataUrl} />
                      ) : stream ? (
                        <div className="steady-camera">
                          <video
                            ref={videoRef}
                            autoPlay
                            muted
                            onClick={() => void videoRef.current?.play()}
                            playsInline
                          />
                          <div className="camera-grid" aria-hidden="true" />
                          <div className="capture-feedback">
                            <span className={faceInside ? "dot green" : "dot amber"} />
                            <strong>{faceInside ? "Face in frame" : "Center your face"}</strong>
                            <small>{movementLabel}</small>
                          </div>
                          {countdown > 0 ? <span className="countdown-badge">{countdown}</span> : null}
                        </div>
                      ) : (
                        <div className="camera-empty">
                          <Icon name="camera" size={36} />
                          <span>Open camera and align inside the frame</span>
                        </div>
                      )}
                    </div>

                    <div className="button-row">
                      {stream ? (
                        <>
                          <button
                            className="primary-button"
                            disabled={isCountingDown || !videoReady}
                            onClick={startSteadyCountdown}
                            type="button"
                          >
                            {isCountingDown
                              ? "Hold steady..."
                              : !videoReady
                                ? "Camera warming up..."
                                : captureState === "invalid"
                                  ? "Retake"
                                  : "Start 3 second capture"}
                          </button>
                          <button className="secondary-button" onClick={stopCamera} type="button">
                            Close camera
                          </button>
                        </>
                      ) : (
                        <button className="secondary-button" onClick={openCamera} type="button">
                          <Icon name="camera" size={16} />
                          Use camera
                        </button>
                      )}
                    </div>
                  </div>
                ) : null}

                <canvas ref={canvasRef} hidden />

                {submitError ? <p className="form-error" role="alert">{submitError}</p> : null}

                <button className="submit-button" disabled={!canSubmit || isSubmitting} type="submit">
                  {isSubmitting ? "Submitting..." : "Submit preference"}
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
                    setCaptureState("idle");
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
                <dd>Search</dd>
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

type IconName = "camera" | "check" | "search" | "shield";

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
