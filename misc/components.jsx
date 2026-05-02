// Anonify — shared components & icons

// ── Icons (lucide-style, hand-rolled) ─────────────────────────
function Icon({ name, size = 16, ...rest }) {
  const paths = {
    shield: <><path d="M12 2 4 5v7c0 4.5 3.5 8.5 8 10 4.5-1.5 8-5.5 8-10V5z"/></>,
    eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>,
    'eye-off': <><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    copy: <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
    check: <><path d="M20 6 9 17l-5-5"/></>,
    'check-circle': <><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></>,
    x: <><path d="M18 6 6 18M6 6l12 12"/></>,
    'x-circle': <><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/></>,
    chevron: <><path d="m9 18 6-6-6-6"/></>,
    'chevron-down': <><path d="m6 9 6 6 6-6"/></>,
    'arrow-left': <><path d="m15 18-6-6 6-6"/></>,
    'arrow-right': <><path d="m9 18 6-6-6-6"/></>,
    upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/></>,
    images: <><path d="M18 22H4a2 2 0 0 1-2-2V6"/><rect x="6" y="2" width="16" height="16" rx="2"/><circle cx="12" cy="9" r="2"/><path d="m22 14-3-3-7 7"/></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
    user: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
    'user-x': <><path d="M14.5 17h-9a4 4 0 0 0-3 3.87"/><circle cx="9.5" cy="7" r="4"/><path d="m17 8 5 5M22 8l-5 5"/></>,
    home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-6h-2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
    qr: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01"/></>,
    link: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
    info: <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
    alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>,
    flag: <><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></>,
    list: <><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
    grid: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></>,
    clock: <><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>,
    'log-out': <><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></>,
    camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></>,
    sparkles: <><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/></>,
    lock: <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
    refresh: <><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></>,
    'more-h': <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
    blur: <><path d="M2 12c0-5 4-10 10-10s10 5 10 10-4 10-10 10S2 17 2 12z"/><path d="M12 2v20M2 12h20" strokeOpacity="0.4"/></>,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {paths[name] || null}
    </svg>
  );
}

// ── Confidence ────────────────────────────────────────────
function confidenceClass(c) {
  if (c >= 0.8) return 'high';
  if (c >= 0.65) return 'mid';
  return 'low';
}
function confidenceLabel(c) {
  if (c >= 0.8) return 'High';
  if (c >= 0.65) return 'Medium';
  return 'Low';
}
function ConfidenceBar({ value, threshold = 0.65, showLabel = true, width }) {
  const cls = confidenceClass(value);
  return (
    <div className="confidence" style={width ? { width } : null}>
      <div className="confidence-bar">
        <div className={`confidence-bar-fill conf-${cls}-bg`} style={{ width: `${Math.round(value * 100)}%` }} />
        <div className="confidence-bar-threshold" style={{ left: `${threshold * 100}%` }} />
      </div>
      {showLabel && <span className={`confidence-value conf-${cls}`}>{Math.round(value * 100)}%</span>}
    </div>
  );
}

// ── CopyField ─────────────────────────────────────────────
function CopyField({ value, mono = true }) {
  const [copied, setCopied] = React.useState(false);
  const onCopy = () => {
    setCopied(true);
    if (navigator.clipboard) navigator.clipboard.writeText(value).catch(() => {});
    setTimeout(() => setCopied(false), 1400);
  };
  return (
    <div className="copy-field">
      <input readOnly value={value} style={mono ? null : { fontFamily: 'var(--font-sans)', textTransform: 'none', letterSpacing: 0 }} />
      <button onClick={onCopy} className={copied ? 'copied' : ''}>
        <Icon name={copied ? 'check' : 'copy'} size={13} />
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

// ── Avatar ────────────────────────────────────────────────
function Avatar({ initials = '?', hue = 220, size = 36, square = false }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: square ? 8 : '50%',
      background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${(hue + 40) % 360} 70% 45%))`,
      color: 'white',
      display: 'grid', placeItems: 'center',
      fontWeight: 600,
      fontSize: size * 0.4,
      flexShrink: 0,
      letterSpacing: '0.02em',
    }}>{initials}</div>
  );
}

// ── PhotoSVG — renders a placeholder event photo with optional redactions ──
function PhotoSVG({ photo, redacted = false, blurThreshold = 0.65, highlightId, viewBox = '0 0 800 600' }) {
  const [bg1, bg2] = photo.bg;
  return (
    <svg viewBox={viewBox} width="100%" height="100%" style={{ display: 'block', borderRadius: 'inherit' }}>
      <defs>
        <linearGradient id={`bg-${photo.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={bg1} />
          <stop offset="100%" stopColor={bg2} />
        </linearGradient>
        <filter id={`blur-${photo.id}`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="14" />
        </filter>
        <pattern id={`noise-${photo.id}`} width="4" height="4" patternUnits="userSpaceOnUse">
          <rect width="4" height="4" fill="rgba(255,255,255,0.02)"/>
        </pattern>
      </defs>
      {/* sky/background */}
      <rect width="100%" height="100%" fill={`url(#bg-${photo.id})`} />
      <rect width="100%" height="100%" fill={`url(#noise-${photo.id})`} />
      {/* horizon */}
      <rect y="380" width="800" height="220" fill="rgba(0,0,0,0.25)" />
      <rect y="440" width="800" height="160" fill="rgba(0,0,0,0.15)" />
      {/* abstract decoration — string lights */}
      <path d="M 0 80 Q 200 130, 400 90 T 800 100" stroke="rgba(255,255,255,0.15)" strokeWidth="1" fill="none"/>
      {[60, 180, 300, 420, 540, 660, 780].map((x, i) => (
        <circle key={i} cx={x} cy={i % 2 ? 110 : 95} r="3" fill="rgba(253, 224, 71, 0.7)"/>
      ))}
      {/* figures */}
      {photo.figures.map((f) => {
        const px = (f.x / 100) * 800;
        const py = (f.y / 100) * 600;
        const pw = (f.w / 100) * 800;
        const ph = (f.h / 100) * 600;
        const headR = pw * 0.32;
        const headCx = px + pw / 2;
        const headCy = py + headR;
        const isMatch = !!f.match;
        const shouldBlur = redacted && isMatch && f.confidence >= blurThreshold;
        const isHighlight = highlightId === f.id;
        const groupOpacity = highlightId && !isHighlight ? 0.55 : 1;
        return (
          <g key={f.id} opacity={groupOpacity}>
            {/* figure body */}
            <g filter={shouldBlur ? `url(#blur-${photo.id})` : undefined}>
              {/* body */}
              <path
                d={`M ${px} ${py + headR * 1.6}
                    Q ${px} ${py + ph * 0.4}, ${px + pw * 0.15} ${py + ph * 0.5}
                    L ${px + pw * 0.15} ${py + ph}
                    L ${px + pw * 0.85} ${py + ph}
                    L ${px + pw * 0.85} ${py + ph * 0.5}
                    Q ${px + pw} ${py + ph * 0.4}, ${px + pw} ${py + headR * 1.6}
                    Z`}
                fill={f.color}
                opacity="0.9"
              />
              {/* head */}
              <circle cx={headCx} cy={headCy} r={headR} fill="#e2c4a0" />
              {/* hair shadow */}
              <path
                d={`M ${headCx - headR * 0.9} ${headCy - headR * 0.3}
                    Q ${headCx} ${headCy - headR * 1.3}, ${headCx + headR * 0.9} ${headCy - headR * 0.3}
                    Q ${headCx + headR * 0.6} ${headCy - headR * 0.7}, ${headCx} ${headCy - headR * 0.6}
                    Q ${headCx - headR * 0.6} ${headCy - headR * 0.7}, ${headCx - headR * 0.9} ${headCy - headR * 0.3} Z`}
                fill="rgba(40,28,20,0.7)"
              />
            </g>
            {/* redaction box overlay (when redacted on a match) */}
            {redacted && isMatch && (
              <g>
                <rect
                  x={headCx - headR * 1.4}
                  y={headCy - headR * 1.4}
                  width={headR * 2.8}
                  height={headR * 2.8}
                  fill="none"
                  stroke={f.confidence >= blurThreshold ? '#10b981' : '#f59e0b'}
                  strokeWidth="2"
                  strokeDasharray="6 3"
                  rx="4"
                />
                <rect
                  x={headCx - headR * 1.4}
                  y={headCy - headR * 1.4 - 22}
                  width={f.confidence >= blurThreshold ? 100 : 130}
                  height="20"
                  fill={f.confidence >= blurThreshold ? '#10b981' : '#f59e0b'}
                  rx="3"
                />
                <text
                  x={headCx - headR * 1.4 + 6}
                  y={headCy - headR * 1.4 - 7}
                  fontSize="12"
                  fontFamily="ui-monospace, monospace"
                  fontWeight="600"
                  fill="white"
                >
                  {f.confidence >= blurThreshold ? `BLURRED ${Math.round(f.confidence * 100)}%` : `REVIEW ${Math.round(f.confidence * 100)}%`}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {/* foreground texture */}
      <rect width="800" height="600" fill="rgba(255,255,255,0.02)"/>
    </svg>
  );
}

// ── QR placeholder ────────────────────────────────────────
function QRCode({ size = 140 }) {
  // Deterministic 13x13 pattern — looks like a QR but isn't real
  const pattern = "1110111010111,1000001011001,1011101011101,1011101000101,1011101010001,1000001001101,1111111010101,0000000011000,1101011101110,0010110010100,1101101110111,0110010100100,1011110111110".split(',');
  const cells = [];
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++)
    cells.push({ on: pattern[r][c] === '1', key: `${r}-${c}` });
  return (
    <div className="qr" style={{ width: size, height: size }}>
      {cells.map(({ on, key }) => <div key={key} className={on ? '' : 'off'} />)}
    </div>
  );
}

// ── Notice ────────────────────────────────────────────────
function Notice({ icon = 'lock', tone = 'default', children }) {
  return (
    <div className={`notice ${tone === 'warn' ? 'warn' : ''}`}>
      <div className="notice-icon"><Icon name={icon} size={18} /></div>
      <div>{children}</div>
    </div>
  );
}

// ── Status badge for photo ────────────────────────────────
function PhotoStatusBadge({ status }) {
  const cfg = {
    not_processed: { tone: 'muted', label: 'Not processed', icon: 'clock' },
    processing:    { tone: 'info',  label: 'Processing',   icon: 'refresh' },
    match:         { tone: 'ok',    label: 'Match found',  icon: 'check-circle' },
    no_match:      { tone: 'muted', label: 'No restricted match', icon: 'check' },
    manual_review: { tone: 'warn',  label: 'Manual review', icon: 'flag' },
    processed:     { tone: 'ok',    label: 'Processed',     icon: 'check' },
  }[status] || { tone: 'muted', label: status, icon: 'info' };
  return (
    <span className={`badge ${cfg.tone}`}>
      <Icon name={cfg.icon} size={11} />
      {cfg.label}
    </span>
  );
}

Object.assign(window, {
  Icon, ConfidenceBar, CopyField, Avatar, PhotoSVG, QRCode, Notice,
  PhotoStatusBadge, confidenceClass, confidenceLabel,
});
