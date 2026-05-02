export type EventSummary = {
  id: string;
  name: string;
  date: string;
  key: string;
  attendees: number;
  optOuts: number;
  photos: number;
  processed: number;
  needsReview: number;
  active: boolean;
};

export type Attendee = {
  id: string;
  name: string;
  email: string;
  submitted: string;
  status: "opted_out" | "consented";
  referenceHue: number;
  confidenceNote: string;
};

export type PhotoStatus =
  | "not_processed"
  | "processing"
  | "match"
  | "no_match"
  | "manual_review"
  | "processed";

export type Figure = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  match?: string;
  confidence: number;
};

export type EventPhoto = {
  id: string;
  name: string;
  captured: string;
  source: string;
  status: PhotoStatus;
  bg: [string, string];
  figures: Figure[];
};

export type AuditLogEntry = {
  id: string;
  time: string;
  actor: string;
  action: string;
  tone: "ok" | "warn" | "info" | "muted";
};

export const events: EventSummary[] = [
  {
    id: "e1",
    name: "HuskyHack Demo Day",
    date: "May 2, 2026",
    key: "HUSKY-42F7",
    attendees: 148,
    optOuts: 12,
    photos: 86,
    processed: 74,
    needsReview: 5,
    active: true
  },
  {
    id: "e2",
    name: "Northeastern Founder Night",
    date: "May 9, 2026",
    key: "FND-X4Q8",
    attendees: 92,
    optOuts: 7,
    photos: 43,
    processed: 31,
    needsReview: 3,
    active: true
  },
  {
    id: "e3",
    name: "AI Ethics Poster Walk",
    date: "May 17, 2026",
    key: "AIE-P9V1",
    attendees: 64,
    optOuts: 4,
    photos: 18,
    processed: 18,
    needsReview: 0,
    active: false
  }
];

export const attendees: Attendee[] = [
  {
    id: "a1",
    name: "Maya Chen",
    email: "maya.chen@example.com",
    submitted: "9:14 AM",
    status: "opted_out",
    referenceHue: 210,
    confidenceNote: "Strong match across 4 photos"
  },
  {
    id: "a2",
    name: "Jordan Reyes",
    email: "jordan.reyes@example.com",
    submitted: "9:21 AM",
    status: "opted_out",
    referenceHue: 34,
    confidenceNote: "Manual review needed once"
  },
  {
    id: "a3",
    name: "Priya Shah",
    email: "priya.shah@example.com",
    submitted: "9:28 AM",
    status: "opted_out",
    referenceHue: 145,
    confidenceNote: "High confidence reference"
  },
  {
    id: "a4",
    name: "Elliot Brooks",
    email: "elliot.brooks@example.com",
    submitted: "9:39 AM",
    status: "opted_out",
    referenceHue: 292,
    confidenceNote: "Low light in upload"
  }
];

export const photos: EventPhoto[] = [
  {
    id: "p1",
    name: "demo-day-stage-014.jpg",
    captured: "10:08 AM",
    source: "Drive import",
    status: "match",
    bg: ["#12355b", "#6d4c41"],
    figures: [
      { id: "p1f1", x: 16, y: 34, w: 14, h: 45, color: "#2563eb", match: "a1", confidence: 0.92 },
      { id: "p1f2", x: 42, y: 30, w: 16, h: 48, color: "#f97316", confidence: 0.24 },
      { id: "p1f3", x: 66, y: 36, w: 13, h: 42, color: "#14b8a6", match: "a3", confidence: 0.86 }
    ]
  },
  {
    id: "p2",
    name: "networking-floor-022.jpg",
    captured: "10:27 AM",
    source: "Manual upload",
    status: "manual_review",
    bg: ["#312e81", "#0f766e"],
    figures: [
      { id: "p2f1", x: 19, y: 32, w: 15, h: 46, color: "#7c3aed", match: "a2", confidence: 0.58 },
      { id: "p2f2", x: 47, y: 29, w: 14, h: 48, color: "#0ea5e9", confidence: 0.33 },
      { id: "p2f3", x: 70, y: 35, w: 13, h: 42, color: "#f43f5e", match: "a4", confidence: 0.67 }
    ]
  },
  {
    id: "p3",
    name: "team-table-037.jpg",
    captured: "11:02 AM",
    source: "Drive import",
    status: "no_match",
    bg: ["#334155", "#155e75"],
    figures: [
      { id: "p3f1", x: 23, y: 38, w: 13, h: 39, color: "#22c55e", confidence: 0.18 },
      { id: "p3f2", x: 52, y: 35, w: 15, h: 44, color: "#eab308", confidence: 0.21 }
    ]
  },
  {
    id: "p4",
    name: "closing-photo-041.jpg",
    captured: "11:36 AM",
    source: "Backboard mock",
    status: "processing",
    bg: ["#0f172a", "#7c2d12"],
    figures: [
      { id: "p4f1", x: 14, y: 35, w: 14, h: 42, color: "#6366f1", confidence: 0.41 },
      { id: "p4f2", x: 38, y: 32, w: 15, h: 46, color: "#ef4444", match: "a1", confidence: 0.76 },
      { id: "p4f3", x: 63, y: 34, w: 15, h: 44, color: "#06b6d4", confidence: 0.27 }
    ]
  }
];

export const auditLog: AuditLogEntry[] = [
  {
    id: "l1",
    time: "11:41 AM",
    actor: "Mock redaction worker",
    action: "Flagged networking-floor-022.jpg for manual review.",
    tone: "warn"
  },
  {
    id: "l2",
    time: "11:37 AM",
    actor: "Drive mock adapter",
    action: "Imported 12 new event photos.",
    tone: "info"
  },
  {
    id: "l3",
    time: "11:33 AM",
    actor: "Anonify",
    action: "Blurred 2 opted-out attendee matches in demo-day-stage-014.jpg.",
    tone: "ok"
  },
  {
    id: "l4",
    time: "10:55 AM",
    actor: "Organizer",
    action: "Shared attendee opt-out link and QR code.",
    tone: "muted"
  }
];

export const mockData = {
  events,
  attendees,
  photos,
  log: auditLog
};
