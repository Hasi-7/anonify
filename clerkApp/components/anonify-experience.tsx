"use client";

import { UserButton } from "@clerk/nextjs";
import { ChangeEvent, ReactElement, SVGProps, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {
  adaptEvent,
  adaptEventOverview,
  adaptPhotoDetail,
  getEventByKey,
  getEventOverview,
  getEventPhotoDetail,
  getEventPhotos,
  getOptOutAttendees,
  processEventPhoto,
  seedDemoData,
  uploadEventPhoto,
} from "@/lib/api";
import { BACKEND_URL } from "@/lib/api/backend-client";
import { backendPhotoDetailToPhotoReviewModel, canBuildPhotoReviewFromBackend } from "@/lib/processing/backend-photo-review-adapter";
import {
  attendees,
  auditLog,
  events,
  photos as seedPhotos,
  type Attendee,
  type EventPhoto,
  type EventSummary,
  type Figure,
  type PhotoStatus
} from "@/lib/mock-data";
import { getMockPhotoReviewModel } from "@/lib/processing/photo-review-adapter";
import type { PhotoReviewModel } from "@/types/photo-review";

const DEMO_EVENT_KEY = "HUSKY-42F7";

const figureColors = ["#2563eb", "#f97316", "#14b8a6", "#7c3aed", "#0ea5e9", "#f43f5e"];

const formatDate = (value?: string | null) => {
  if (!value) {
    return "May 2, 2026";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(date);
};

const formatTime = (value?: string | null) => {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(date);
};

const toMockStatus = (status: string): PhotoStatus => {
  if (["not_processed", "processing", "match", "no_match", "manual_review", "processed"].includes(status)) {
    return status as PhotoStatus;
  }

  return status === "needs_review" ? "manual_review" : "processed";
};

type OrganizerPhoto = EventPhoto & {
  dataUrl?: string;
  redacted: boolean;
};

type OrganizerTab = "intake" | "privacy" | "audit";

const statusCopy: Record<PhotoStatus, string> = {
  not_processed: "Queued",
  processing: "Processing",
  match: "Match found",
  no_match: "Clear",
  manual_review: "Review",
  processed: "Processed"
};

const demoFigures: Figure[] = [
  { id: "upload-1", x: 18, y: 32, w: 14, h: 42, color: "#16a34a", match: "a1", confidence: 0.9 },
  { id: "upload-2", x: 45, y: 29, w: 15, h: 45, color: "#2563eb", confidence: 0.34 },
  { id: "upload-3", x: 68, y: 35, w: 13, h: 40, color: "#f97316", match: "a3", confidence: 0.82 }
];

const photoReviewFixtureIds: Record<string, string> = {
  p1: "photo_001",
  p2: "photo_002",
  p3: "photo_003",
  p4: "photo_004"
};

const toReviewFixtureId = (photoId: string) => photoReviewFixtureIds[photoId] ?? photoId;

const toReviewFigures = (model: PhotoReviewModel): Figure[] =>
  model.regions.map((region, index) => ({
    id: `${model.photoId}-region-${index}`,
    x: (region.x / 400) * 100,
    y: (region.y / 300) * 100,
    w: (region.width / 400) * 100,
    h: (region.height / 300) * 100,
    color: figureColors[index % figureColors.length],
    match: region.attendeeId,
    confidence: region.confidencePercent / 100
  }));

const readImageSize = (src: string): Promise<{ width: number; height: number } | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve(null);
    image.src = src;
  });

const normalizeReviewModelForPreview = (
  model: PhotoReviewModel,
  imageSize: { width: number; height: number } | null
): PhotoReviewModel => {
  if (!imageSize?.width || !imageSize.height) {
    return model;
  }

  return {
    ...model,
    regions: model.regions.map((region) => ({
      ...region,
      x: (region.x / imageSize.width) * 400,
      y: (region.y / imageSize.height) * 300,
      width: (region.width / imageSize.width) * 400,
      height: (region.height / imageSize.height) * 300
    }))
  };
};

const toAdminAttendees = (
  backendAttendees: Array<{
    id: number;
    name: string;
    consent_status: "opted_out" | "consented";
    reference_photo_url: string | null;
    submitted_at: string;
  }>
): Attendee[] =>
  backendAttendees.map((attendee, index) => ({
    id: String(attendee.id),
    name: attendee.name,
    email: "",
    submitted: formatTime(attendee.submitted_at),
    status: attendee.consent_status,
    referenceHue: (index * 57 + 180) % 360,
    referencePhotoUrl: attendee.reference_photo_url,
    confidenceNote: attendee.reference_photo_url ? "Reference photo submitted" : "No reference photo"
  }));

export function AnonifyExperience() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const singleDownloadRef = useRef<HTMLAnchorElement | null>(null);
  const [eventList, setEventList] = useState(events);
  const [selectedEventId, setSelectedEventId] = useState(events[0]?.id ?? "");
  const [photoList, setPhotoList] = useState<OrganizerPhoto[]>(
    seedPhotos.map((photo) => ({ ...photo, redacted: photo.status === "match" }))
  );
  const [selectedPhotoId, setSelectedPhotoId] = useState(seedPhotos[0]?.id ?? "");
  const [optOutAttendees, setOptOutAttendees] = useState(attendees);
  const [threshold, setThreshold] = useState(65);
  const [uploadMessage, setUploadMessage] = useState("Upload event photos to add them to this workspace.");
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [activeTab, setActiveTab] = useState<OrganizerTab>("intake");
  const [exportMessage, setExportMessage] = useState("Anonymize photos to enable exports.");
  const [reviewModelsByPhotoId, setReviewModelsByPhotoId] = useState<Record<string, PhotoReviewModel>>({});
  const [runningDetectionForId, setRunningDetectionForId] = useState<string | null>(null);
  const [detectionMessage, setDetectionMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadBackendDemoEvent() {
      let eventResult = await getEventByKey(DEMO_EVENT_KEY);
      if (!eventResult.ok) {
        await seedDemoData();
        eventResult = await getEventByKey(DEMO_EVENT_KEY);
      }

      if (!eventResult.ok) {
        return;
      }

      const backendEvent = adaptEvent(eventResult.data);
      const [overviewResult, attendeeResult, photoResult] = await Promise.all([
        getEventOverview(backendEvent.id),
        getOptOutAttendees(backendEvent.id),
        getEventPhotos(backendEvent.id)
      ]);

      if (cancelled) {
        return;
      }

      const overview = overviewResult.ok ? adaptEventOverview(overviewResult.data, backendEvent.id) : null;
      const hydratedEvent: EventSummary = {
        id: backendEvent.id,
        name: overview?.name ?? backendEvent.name,
        date: formatDate(backendEvent.createdAt),
        key: overview?.key ?? backendEvent.key,
        attendees: overview?.attendees ?? events[0]?.attendees ?? 0,
        optOuts: overview?.optOuts ?? events[0]?.optOuts ?? 0,
        photos: overview?.photos ?? events[0]?.photos ?? 0,
        processed: overview?.processed ?? events[0]?.processed ?? 0,
        needsReview: overview?.needsReview ?? events[0]?.needsReview ?? 0,
        active: true
      };

      setEventList((currentEvents) => [
        hydratedEvent,
        ...currentEvents.filter((event) => event.key !== hydratedEvent.key)
      ]);
      setSelectedEventId(hydratedEvent.id);

      if (attendeeResult.ok) {
        setOptOutAttendees(toAdminAttendees(attendeeResult.data));
      }

      if (photoResult.ok && photoResult.data.length > 0) {
        const details = await Promise.all(
          photoResult.data.map(async (photo) => {
            const detailResult = await getEventPhotoDetail(backendEvent.id, photo.id);
            return detailResult.ok ? detailResult.data : null;
          })
        );

        if (cancelled) {
          return;
        }

        const backendPhotos: OrganizerPhoto[] = photoResult.data.map((photo, index) => {
          const rawDetail = details[index];
          const detail = rawDetail ? adaptPhotoDetail(rawDetail) : null;
          const detections = detail?.detections ?? [];

          return {
            id: String(photo.id),
            name: photo.filename,
            captured: formatTime(photo.uploaded_at),
            source: photo.source === "google_drive" ? "Drive import" : "Manual upload",
            status: detections.some((detection) => detection.manualReviewRequired)
              ? "manual_review"
              : detections.length > 0
                ? "match"
                : toMockStatus(photo.status),
            bg: index % 2 === 0 ? ["#12355b", "#6d4c41"] : ["#312e81", "#0f766e"],
            figures: detections.map((detection, detectionIndex) => ({
              id: detection.id,
              x: detection.boundingBox?.x ?? 18 + detectionIndex * 22,
              y: detection.boundingBox?.y ?? 32,
              w: detection.boundingBox?.width ?? 14,
              h: detection.boundingBox?.height ?? 42,
              color: figureColors[detectionIndex % figureColors.length],
              match: detection.attendeeId,
              confidence: detection.confidenceRaw
            })),
            redacted: Boolean(photo.redacted_image_url)
          };
        });

        setReviewModelsByPhotoId((currentModels) => {
          const nextModels = { ...currentModels };
          details.forEach((detail) => {
            if (detail && canBuildPhotoReviewFromBackend(detail)) {
              nextModels[String(detail.id)] = backendPhotoDetailToPhotoReviewModel(detail);
            }
          });
          return nextModels;
        });
        setPhotoList(backendPhotos);
        setSelectedPhotoId(backendPhotos[0]?.id ?? "");
      }
    }

    void loadBackendDemoEvent();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!/^\d+$/.test(selectedEventId)) {
      return;
    }

    let cancelled = false;

    const refreshAdminView = async () => {
      const [overviewResult, attendeeResult] = await Promise.all([
        getEventOverview(selectedEventId),
        getOptOutAttendees(selectedEventId)
      ]);

      if (cancelled) {
        return;
      }

      if (attendeeResult.ok) {
        setOptOutAttendees(toAdminAttendees(attendeeResult.data));
      }

      if (overviewResult.ok) {
        const overview = adaptEventOverview(overviewResult.data, selectedEventId);
        setEventList((currentEvents) =>
          currentEvents.map((event) =>
            event.id === selectedEventId
              ? {
                  ...event,
                  attendees: overview.attendees,
                  optOuts: overview.optOuts,
                  photos: overview.photos,
                  processed: overview.processed,
                  needsReview: overview.needsReview
                }
              : event
          )
        );
      }
    };

    const intervalId = window.setInterval(() => {
      void refreshAdminView();
    }, 3000);

    void refreshAdminView();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [selectedEventId]);

  const selectedEvent =
    eventList.find((event) => event.id === selectedEventId) ?? eventList[0];
  const selectedPhoto =
    photoList.find((photo) => photo.id === selectedPhotoId) ?? photoList[0];
  const selectedPhotoReviewModel = selectedPhoto
    ? reviewModelsByPhotoId[selectedPhoto.id] ?? getMockPhotoReviewModel(toReviewFixtureId(selectedPhoto.id))
    : undefined;
  const reviewModelSource: "backend" | "mock" =
    selectedPhoto != null && selectedPhoto.id in reviewModelsByPhotoId ? "backend" : "mock";
  const processedCount = photoList.filter((photo) => photo.redacted || photo.status === "no_match").length;
  const reviewCount = photoList.filter((photo) => photo.status === "manual_review").length;
  const progress = Math.round((processedCount / Math.max(photoList.length, 1)) * 100);

  const anonymizeSelectedPhoto = () => {
    if (!selectedPhoto) {
      return;
    }

    setPhotoList((currentPhotos) =>
      currentPhotos.map((photo) =>
        photo.id === selectedPhoto.id
          ? {
              ...photo,
              redacted: true,
              status: photo.figures.some((figure) => figure.match) ? "match" : "no_match"
            }
          : photo
      )
    );
    setExportMessage(`${selectedPhoto.name} is ready to export.`);
  };

  const anonymizeAllPhotos = () => {
    setPhotoList((currentPhotos) =>
      currentPhotos.map((photo) => ({
        ...photo,
        redacted: true,
        status: photo.figures.some((figure) => figure.match) ? "match" : photo.status === "manual_review" ? "manual_review" : "no_match"
      }))
    );
    setExportMessage("Batch anonymization complete. Export is ready.");
  };

  const exportSelectedPhoto = () => {
    if (!selectedPhoto?.redacted) {
      setExportMessage("Anonymize the selected photo before exporting.");
      return;
    }

    if (selectedPhoto.dataUrl && singleDownloadRef.current) {
      singleDownloadRef.current.href = selectedPhoto.dataUrl;
      singleDownloadRef.current.download = `anonified-${selectedPhoto.name}`;
      singleDownloadRef.current.click();
      setExportMessage(`${selectedPhoto.name} downloaded.`);
      return;
    }

    setExportMessage(`${selectedPhoto.name} is queued for export in the demo bundle.`);
  };

  const exportBatch = () => {
    const readyCount = photoList.filter((photo) => photo.redacted).length;
    setExportMessage(
      readyCount > 0
        ? `${readyCount} anonymized image${readyCount === 1 ? "" : "s"} queued for batch export.`
        : "Anonymize at least one photo before exporting."
    );
  };

  const handleRunDetection = async (photo: OrganizerPhoto) => {
    const backendEventId = /^\d+$/.test(selectedEventId) ? selectedEventId : null;
    if (!backendEventId || !/^\d+$/.test(photo.id)) {
      setDetectionMessage("Local detection requires a backend event. Showing mock result.");
      return;
    }

    setRunningDetectionForId(photo.id);
    setDetectionMessage(null);

    try {
      // Backend resolves the image from the stored path — no need to re-send the data URL.
      const processed = await processEventPhoto(backendEventId, photo.id, {});

      if (!processed.ok) {
        setDetectionMessage(`Detection unavailable: ${processed.error}`);
        return;
      }

      const imageSize = photo.dataUrl ? await readImageSize(photo.dataUrl) : null;
      const reviewModel = normalizeReviewModelForPreview(
        backendPhotoDetailToPhotoReviewModel(processed.data),
        imageSize
      );
      const detail = adaptPhotoDetail(processed.data);
      const detections = detail.detections;
      const nextStatus: PhotoStatus = detections.some((d) => d.manualReviewRequired)
        ? "manual_review"
        : detections.length > 0
          ? "match"
          : "no_match";

      setReviewModelsByPhotoId((currentModels) => ({ ...currentModels, [photo.id]: reviewModel }));
      setPhotoList((currentPhotos) =>
        currentPhotos.map((p) =>
          p.id === photo.id
            ? {
                ...p,
                status: nextStatus,
                figures: toReviewFigures(reviewModel),
                redacted: Boolean(processed.data.redacted_image_url),
              }
            : p
        )
      );
      setDetectionMessage(
        detections.length > 0
          ? `${detections.length} opted-out detection${detections.length === 1 ? "" : "s"} found.`
          : "No opted-out attendees detected. Mock result shown as fallback."
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setDetectionMessage(`Detection did not complete: ${message}`);
    } finally {
      setRunningDetectionForId(null);
    }
  };

  const handleUploads = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []).filter((file) =>
      file.type.startsWith("image/")
    );

    if (!files.length) {
      setUploadMessage("Choose one or more image files.");
      return;
    }

    const backendEventId = /^\d+$/.test(selectedEvent.id) ? selectedEvent.id : null;

    files.forEach((file, index) => {
      const reader = new FileReader();

      reader.onload = () => {
        if (typeof reader.result !== "string") {
          setUploadMessage("One upload could not be read.");
          return;
        }

        const dataUrl = reader.result;
        const created: OrganizerPhoto = {
          id: `upload-${Date.now()}-${index}`,
          name: file.name || "uploaded-event-photo.jpg",
          captured: "Just now",
          source: "Organizer upload",
          status: "processing",
          bg: ["#dcfce7", "#86efac"],
          figures: [],
          dataUrl,
          redacted: false
        };

        setPhotoList((currentPhotos) => [created, ...currentPhotos]);
        setSelectedPhotoId(created.id);
        setUploadMessage(`${file.name} uploaded. Running backend recognition and blur.`);

        void (async () => {
          if (!backendEventId) {
            setPhotoList((currentPhotos) =>
              currentPhotos.map((photo) =>
                photo.id === created.id
                  ? {
                      ...photo,
                      status: "not_processed",
                      figures: demoFigures.map((figure) => ({ ...figure, id: `${figure.id}-${created.id}` }))
                    }
                  : photo
              )
            );
            setUploadMessage("Select the backend demo event before running recognition.");
            return;
          }

          // Upload the file — saves it to backend/uploads/photos/.
          const uploaded = await uploadEventPhoto(backendEventId, {
            file_name: file.name || "uploaded-event-photo.jpg",
            image_data_url: dataUrl,
          });

          if (!uploaded.ok) {
            throw new Error(uploaded.error);
          }

          const backendPhotoId = String(uploaded.data.id);
          setSelectedPhotoId((currentId) => currentId === created.id ? backendPhotoId : currentId);
          setPhotoList((currentPhotos) =>
            currentPhotos.map((photo) =>
              photo.id === created.id
                ? {
                    ...photo,
                    id: backendPhotoId,
                    captured: formatTime(uploaded.data.uploaded_at),
                    name: file.name || "uploaded-event-photo.jpg",
                    status: "not_processed",
                  }
                : photo
            )
          );
          setUploadMessage(`${file.name} saved. Click "Run local detection" to process it.`);
          setDetectionMessage(null);
        })().catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          setPhotoList((currentPhotos) =>
            currentPhotos.map((photo) =>
              photo.id === created.id || photo.name === created.name
                ? { ...photo, status: "not_processed" }
                : photo
            )
          );
          setUploadMessage(`Upload did not complete: ${message}`);
        });
      };

      reader.onerror = () => setUploadMessage("One upload could not be read.");
      reader.readAsDataURL(file);
    });

    event.currentTarget.value = "";
  };

  return (
    <main className="organizer-page">
      <aside className="organizer-sidebar" aria-label="Organizer events">
        <BrandLogo subtitle="event photo privacy" />

        <div className="sidebar-section">
          <p className="section-label">Events</p>
          <div className="event-stack">
            {eventList.map((event) => (
              <button
                className={`event-switcher ${event.id === selectedEvent.id ? "selected" : ""}`}
                key={event.id}
                onClick={() => setSelectedEventId(event.id)}
                type="button"
              >
                <span>{event.name}</span>
                <code>{event.key}</code>
              </button>
            ))}
          </div>
          <button className="secondary-button full" onClick={() => setCreatingEvent(true)} type="button">
            <Icon name="plus" size={16} />
            Create event
          </button>
        </div>

        <div className="threshold-card">
          <div className="spread">
            <span>Auto blur threshold</span>
            <strong>{threshold}%</strong>
          </div>
          <input
            aria-label="Auto blur threshold"
            max={95}
            min={40}
            onChange={(event) => setThreshold(Number(event.target.value))}
            type="range"
            value={threshold}
          />
        </div>
      </aside>

      <section className="organizer-main">
        <header className="organizer-header">
          <div>
            <p className="section-label">Organizer dashboard</p>
            <h1>{selectedEvent.name}</h1>
            <p>
              Upload event photos, review opt-out matches, and anonymize faces before sharing.
            </p>
          </div>
          <div className="header-actions">
            <a className="link-button" href={`/attend?event=${selectedEvent.key}`}>
              Attendee link
            </a>
            <LinkHome />
            <UserButton />
          </div>
        </header>

        <section className="metric-grid" aria-label="Event metrics">
          <Metric label="Attendees" value={selectedEvent.attendees} />
          <Metric label="Opt-outs" value={selectedEvent.optOuts} tone="green" />
          <Metric label="Photos" value={photoList.length} />
          <Metric label="Needs review" value={reviewCount} tone="amber" />
        </section>

        <nav className="dashboard-tabs" aria-label="Organizer dashboard sections">
          <button className={activeTab === "intake" ? "active" : ""} onClick={() => setActiveTab("intake")} type="button">
            Photo Intake
          </button>
          <button className={activeTab === "privacy" ? "active" : ""} onClick={() => setActiveTab("privacy")} type="button">
            Privacy List
          </button>
          <button className={activeTab === "audit" ? "active" : ""} onClick={() => setActiveTab("audit")} type="button">
            Security Audit Log
          </button>
        </nav>

        {activeTab === "intake" ? (
          <section className="organizer-grid">
            <div className="workspace-panel">
            <div className="panel-heading">
              <div>
                <p className="section-label">Photo intake</p>
                <h2>Uploaded event photos</h2>
              </div>
              <button className="primary-button" onClick={() => fileInputRef.current?.click()} type="button">
                <Icon name="upload" size={16} />
                Upload photos
              </button>
              <input
                ref={fileInputRef}
                accept="image/*"
                hidden
                multiple
                onChange={handleUploads}
                type="file"
              />
            </div>
            <p className="helper-text">{uploadMessage}</p>
            <div className="photo-grid">
              {photoList.map((photo) => (
                <button
                  className={`photo-card ${photo.id === selectedPhoto?.id ? "selected" : ""}`}
                  key={photo.id}
                  onClick={() => setSelectedPhotoId(photo.id)}
                  type="button"
                >
                  <PhotoPreview photo={photo} redacted={photo.redacted} />
                  <span>
                    <strong>{photo.name}</strong>
                    <small>{photo.source} / {photo.captured}</small>
                  </span>
                  <StatusBadge status={photo.status} redacted={photo.redacted} />
                </button>
              ))}
            </div>
            </div>

            <div className="workspace-panel review-panel">
            {selectedPhoto ? (
              <>
                <PhotoReview
                  attendees={optOutAttendees}
                  exportMessage={exportMessage}
                  onAnonymizeAll={anonymizeAllPhotos}
                  onAnonymize={anonymizeSelectedPhoto}
                  onExportBatch={exportBatch}
                  onExportSelected={exportSelectedPhoto}
                  photo={selectedPhoto}
                  progress={progress}
                  reviewModel={selectedPhotoReviewModel}
                  reviewModelSource={reviewModelSource}
                  threshold={threshold / 100}
                />
                {/^\d+$/.test(selectedPhoto.id) ? (
                  <div className="detection-action-bar">
                    <button
                      className="secondary-button"
                      disabled={runningDetectionForId === selectedPhoto.id}
                      onClick={() => void handleRunDetection(selectedPhoto)}
                      type="button"
                    >
                      {runningDetectionForId === selectedPhoto.id ? "Running…" : "Run local detection"}
                    </button>
                    {detectionMessage ? (
                      <small className="helper-text">{detectionMessage}</small>
                    ) : null}
                  </div>
                ) : null}
              </>
            ) : null}
            <a ref={singleDownloadRef} hidden />
            </div>
          </section>
        ) : null}

        {activeTab === "privacy" ? (
          <PrivacyListPanel attendees={optOutAttendees} />
        ) : null}

        {activeTab === "audit" ? (
          <AuditLogPanel />
        ) : null}
      </section>

      {creatingEvent ? (
        <CreateEventModal
          onClose={() => setCreatingEvent(false)}
          onCreated={(createdEvent) => {
            setEventList((currentEvents) => [createdEvent, ...currentEvents]);
            setSelectedEventId(createdEvent.id);
            setCreatingEvent(false);
          }}
        />
      ) : null}
    </main>
  );
}

function PhotoReview({
  attendees,
  exportMessage,
  onAnonymizeAll,
  onAnonymize,
  onExportBatch,
  onExportSelected,
  photo,
  progress,
  reviewModel,
  reviewModelSource,
  threshold
}: {
  attendees: Attendee[];
  exportMessage: string;
  onAnonymizeAll: () => void;
  onAnonymize: () => void;
  onExportBatch: () => void;
  onExportSelected: () => void;
  photo: OrganizerPhoto;
  progress: number;
  reviewModel?: PhotoReviewModel;
  reviewModelSource?: "backend" | "mock";
  threshold: number;
}) {
  const reviewPhoto = useMemo(
    () => (reviewModel ? { ...photo, figures: toReviewFigures(reviewModel) } : photo),
    [photo, reviewModel]
  );
  const matches = useMemo(() => reviewPhoto.figures.filter((figure) => figure.match), [reviewPhoto]);

  return (
    <>
      <div className="panel-heading">
        <div>
          <p className="section-label">Review</p>
          <h2>{photo.name}</h2>
        </div>
        <div className="panel-actions">
          <button className="primary-button" onClick={onAnonymize} type="button">
            <Icon name="sparkles" size={16} />
            Anonymize
          </button>
          <button className="secondary-button" onClick={onAnonymizeAll} type="button">
            Batch anonymize
          </button>
        </div>
      </div>

      <div className="comparison-grid" aria-label="Before and after comparison">
        <figure>
          <figcaption>Before</figcaption>
          <PhotoPreview photo={reviewPhoto} redacted={false} large />
        </figure>
        <figure>
          <figcaption>After</figcaption>
          <PhotoPreview photo={reviewPhoto} redacted={photo.redacted} large />
        </figure>
      </div>

      <div className="progress-card">
        <div className="spread">
          <span>Workspace processed</span>
          <strong>{progress}%</strong>
        </div>
        <div className="progress-track">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <div className="export-card">
        <div>
          <p className="section-label">Export</p>
          <strong>Export anonymized images</strong>
          <span>{exportMessage}</span>
        </div>
        <div className="export-actions">
          <button className="secondary-button" disabled={!photo.redacted} onClick={onExportSelected} type="button">
            Single download
          </button>
          <button className="primary-button" onClick={onExportBatch} type="button">
            Export Anonymized Images
          </button>
        </div>
      </div>

      <div className="detections-list">
        <div className="spread">
          <p className="section-label">Opt-out detections</p>
          {reviewModelSource === "backend"
            ? <em className="status-badge green">Live</em>
            : <em className="status-badge">Demo</em>}
        </div>
        {reviewModel ? <p className="helper-text">{reviewModel.confidenceWarning}</p> : null}
        {reviewModel ? (
          reviewModel.participants.length === 0 ? (
            <p className="empty-state">No opted-out attendees were detected in this photo.</p>
          ) : (
            reviewModel.participants.map((participant) => (
              <div className="detection-row" key={participant.attendeeId}>
                <TrafficLight confidence={participant.confidencePercent} />
                <div>
                  <strong>{participant.attendeeName}</strong>
                  <small>
                    {participant.statusLabel} / {participant.reviewRequired ? "Manual review required" : "No manual review required"}
                  </small>
                </div>
                <ConfidenceBadge confidence={participant.confidencePercent} />
              </div>
            ))
          )
        ) : matches.length === 0 ? (
          <p className="empty-state">No opted-out attendees were detected in this photo.</p>
        ) : (
          matches.map((figure) => {
            const attendee = attendees.find((item) => item.id === figure.match);
            const needsReview = figure.confidence < threshold;

            return (
              <div className="detection-row" key={figure.id}>
                <TrafficLight confidence={Math.round(figure.confidence * 100)} />
                <div>
                  <strong>{attendee?.name ?? "Unknown attendee"}</strong>
                  <small>{needsReview ? "Manual review suggested" : "Ready for automatic blur"}</small>
                </div>
                <ConfidenceBadge confidence={Math.round(figure.confidence * 100)} />
              </div>
            );
          })
        )}
      </div>

      <div className="activity-list">
        <p className="section-label">Recent activity</p>
        {auditLog.slice(0, 3).map((entry) => (
          <div className="activity-row" key={entry.id}>
            <span>{entry.time}</span>
            <p>{entry.action}</p>
          </div>
        ))}
      </div>
    </>
  );
}

type OrganizerAttendee = Attendee & { referencePhotoUrl?: string | null };

function PrivacyListPanel({ attendees }: { attendees: OrganizerAttendee[] }) {
  return (
    <section className="workspace-panel full-panel">
      <div className="panel-heading">
        <div>
          <p className="section-label">Privacy list</p>
          <h2>Opted-out attendees and reference images</h2>
        </div>
        <em className="status-badge green">{attendees.length} active opt-outs</em>
      </div>
      <div className="privacy-grid">
        {attendees.map((attendee) => (
          <article className="privacy-card" key={attendee.id}>
            {attendee.referencePhotoUrl ? (
              <img
                className="reference-avatar"
                src={attendee.referencePhotoUrl.startsWith("/") ? `${BACKEND_URL}${attendee.referencePhotoUrl}` : attendee.referencePhotoUrl}
                alt={`Reference photo for ${attendee.name}`}
              />
            ) : (
              <div
                className="reference-avatar"
                style={{ background: `linear-gradient(135deg, hsl(${attendee.referenceHue} 78% 78%), hsl(${attendee.referenceHue} 78% 42%))` }}
                aria-hidden="true"
              >
                <span />
              </div>
            )}
            <div>
              <strong>{attendee.name}</strong>
              <small>{attendee.email || "Public attendee submission"}</small>
              <p>{attendee.confidenceNote}</p>
            </div>
            <em className="status-badge green">Opted out</em>
          </article>
        ))}
      </div>
    </section>
  );
}

function AuditLogPanel() {
  return (
    <section className="workspace-panel full-panel">
      <div className="panel-heading">
        <div>
          <p className="section-label">Security audit log</p>
          <h2>Uploads, anonymizations, and reviews</h2>
        </div>
      </div>
      <div className="audit-timeline">
        {auditLog.map((entry) => (
          <article className={`audit-entry ${entry.tone}`} key={entry.id}>
            <span>{entry.time}</span>
            <div>
              <strong>{entry.actor}</strong>
              <p>{entry.action}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function confidenceTone(confidence: number) {
  if (confidence >= 90) {
    return { label: "Green (Safe)", tone: "green" };
  }

  if (confidence >= 70) {
    return { label: "Amber (Review)", tone: "amber" };
  }

  return { label: "Red (Conflict)", tone: "red" };
}

function TrafficLight({ confidence }: { confidence: number }) {
  const tone = confidenceTone(confidence);
  return <span className={`dot ${tone.tone}`} aria-label={tone.label} />;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const tone = confidenceTone(confidence);
  return (
    <span className={`confidence-badge ${tone.tone}`}>
      {tone.label} {confidence}%
    </span>
  );
}

function LinkHome() {
  return (
    <Link className="link-button" href="/">
      Home
    </Link>
  );
}

function PhotoPreview({
  large = false,
  photo,
  redacted
}: {
  large?: boolean;
  photo: OrganizerPhoto;
  redacted: boolean;
}) {
  return (
    <div className={`photo-preview ${large ? "large" : ""}`}>
      {photo.dataUrl ? (
        <img alt="" src={photo.dataUrl} />
      ) : (
        <svg aria-hidden="true" viewBox="0 0 400 300">
          <defs>
            <linearGradient id={`bg-${photo.id}`} x1="0" x2="1" y1="0" y2="1">
              <stop stopColor={photo.bg[0]} />
              <stop offset="1" stopColor={photo.bg[1]} />
            </linearGradient>
          </defs>
          <rect fill={`url(#bg-${photo.id})`} height="300" width="400" />
          <rect fill="rgba(255,255,255,0.38)" height="56" rx="8" width="190" x="185" y="42" />
          <rect fill="rgba(20,83,45,0.22)" height="34" rx="8" width="250" x="75" y="220" />
          {photo.figures.map((figure) => {
            const x = (figure.x / 100) * 400;
            const y = (figure.y / 100) * 300;
            const width = (figure.w / 100) * 400;
            const height = (figure.h / 100) * 300;

            return (
              <g key={figure.id}>
                <circle cx={x + width / 2} cy={y} fill="#fed7aa" r={width * 0.32} />
                <rect fill={figure.color} height={height} rx="18" width={width} x={x} y={y + 18} />
              </g>
            );
          })}
        </svg>
      )}
      {redacted
        ? photo.figures
            .filter((figure) => figure.match)
            .map((figure) => (
              <span
                className="face-blur"
                key={figure.id}
                style={{
                  height: `${figure.h + 8}%`,
                  left: `${figure.x - 1}%`,
                  top: `${figure.y - 10}%`,
                  width: `${figure.w + 2}%`
                }}
              />
            ))
        : null}
    </div>
  );
}

function CreateEventModal({
  onClose,
  onCreated
}: {
  onClose: () => void;
  onCreated: (event: EventSummary) => void;
}) {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h2>Create event</h2>
        <p>Generate an organizer workspace and public attendee key.</p>
        <label>
          Event name
          <input onChange={(event) => setName(event.target.value)} placeholder="HuskyHack Demo Day" value={name} />
        </label>
        <label>
          Event date
          <input onChange={(event) => setDate(event.target.value)} placeholder="May 2, 2026" value={date} />
        </label>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">Cancel</button>
          <button
            className="primary-button"
            disabled={!name.trim()}
            onClick={() => {
              const key = `EVT-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
              onCreated({
                id: `e-${Date.now()}`,
                name: name.trim(),
                date: date.trim() || "May 2, 2026",
                key,
                attendees: 0,
                optOuts: 0,
                photos: 0,
                processed: 0,
                needsReview: 0,
                active: true
              });
            }}
            type="button"
          >
            Create event
          </button>
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  tone = "neutral",
  value
}: {
  label: string;
  tone?: "neutral" | "green" | "amber";
  value: number;
}) {
  return (
    <div className={`metric-card ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function StatusBadge({ redacted, status }: { redacted: boolean; status: PhotoStatus }) {
  return <em className={`status-badge ${redacted ? "green" : status}`}>{redacted ? "Anonymized" : statusCopy[status]}</em>;
}

type IconName = "plus" | "sparkles" | "upload";

function Icon({
  name,
  size = 18,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactElement> = {
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 1.8 4.2L18 9l-4.2 1.8L12 15l-1.8-4.2L6 9l4.2-1.8Z" />
        <path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9Z" />
      </>
    ),
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
