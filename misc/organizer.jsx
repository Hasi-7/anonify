// anonify — organizer-side screens

// ── Browser chrome wrapper ─────────────────────────────────
function BrowserChrome({ url, children }) {
  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div className="browser-chrome">
        <div className="browser-dots"><span/><span/><span/></div>
        <div className="browser-url">
          <Icon name="lock" size={11} />
          <span>{url}</span>
        </div>
        <div style={{ width: 50 }} />
      </div>
      {children}
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────
function Sidebar({ view, setView, currentEvent }) {
  return (
    <div className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-mark">a</div>
        <span>anonify</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div
          className={`sidebar-item ${view.screen === 'events' ? 'active' : ''}`}
          onClick={() => setView({ screen: 'events' })}
        >
          <Icon name="home" size={15} />
          Events
        </div>
        <div className={`sidebar-item`} style={{ opacity: 0.5 }}>
          <Icon name="settings" size={15} />
          Settings
        </div>
      </div>

      {currentEvent && (
        <>
          <div className="sidebar-section-title">Current event</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[
              { id: 'overview',   label: 'Overview',         icon: 'info' },
              { id: 'optouts',    label: 'Opt-out attendees', icon: 'user-x' },
              { id: 'photos',     label: 'Event photos',     icon: 'images' },
              { id: 'review',     label: 'Photo review',     icon: 'eye' },
              { id: 'log',        label: 'Processing log',   icon: 'list' },
            ].map(t => (
              <div
                key={t.id}
                className={`sidebar-item ${view.screen === 'event' && view.tab === t.id ? 'active' : ''}`}
                onClick={() => setView({ screen: 'event', tab: t.id })}
              >
                <Icon name={t.icon} size={15} />
                {t.label}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="sidebar-user">
        <Avatar initials="AM" hue={264} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Alex M.</div>
          <div style={{ fontSize: 11, color: 'var(--fg-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>alex@huskyhacks.io</div>
        </div>
        <Icon name="log-out" size={14} style={{ color: 'var(--fg-dim)', cursor: 'pointer' }} />
      </div>
    </div>
  );
}

// ── Events list (Organizer dashboard) ──────────────────────
function EventsList({ events, setView, onCreate, emptyState }) {
  const list = emptyState ? [] : events;
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="crumbs">
            <span>Workspace</span>
            <span className="sep">/</span>
            <span style={{ color: 'var(--fg)' }}>Events</span>
          </div>
          <h1 className="page-title">Events</h1>
          <p className="page-subtitle">Manage events and review photos for opt-out compliance.</p>
        </div>
        <button className="btn primary" onClick={onCreate}>
          <Icon name="plus" size={14} />
          Create event
        </button>
      </div>

      {list.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="empty-icon"><Icon name="images" size={20} /></div>
            <h3>No events yet</h3>
            <p>Create your first event to start collecting attendee consent and reviewing event photos.</p>
            <button className="btn primary" onClick={onCreate}>
              <Icon name="plus" size={14} />
              Create event
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--pad-3)' }}>
          {list.map(ev => (
            <div key={ev.id} className="event-card" onClick={() => setView({ screen: 'event', tab: 'overview', eventId: ev.id })}>
              <div className="event-card-top">
                <div>
                  <h3 className="event-name">{ev.name}</h3>
                  <div className="event-date">{ev.date}</div>
                </div>
                {ev.active && <span className="badge accent"><span className="dot"/>Active</span>}
              </div>

              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="event-key-pill">{ev.key}</span>
                <span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>·</span>
                <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{ev.attendees} attendee submissions</span>
              </div>

              <div className="event-card-stats">
                <div className="mini-stat">
                  <div className="mini-stat-value">{ev.optOuts}</div>
                  <div className="mini-stat-label">opt-outs</div>
                </div>
                <div className="mini-stat">
                  <div className="mini-stat-value">{ev.processed}<span style={{ color: 'var(--fg-dim)', fontSize: 13, fontWeight: 400 }}>/{ev.photos}</span></div>
                  <div className="mini-stat-label">processed</div>
                </div>
                <div className={`mini-stat ${ev.needsReview > 0 ? 'alert' : ''}`}>
                  <div className="mini-stat-value">{ev.needsReview}</div>
                  <div className="mini-stat-label">need review</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create Event modal ─────────────────────────────────────
function CreateEventModal({ onClose, onCreated }) {
  const [name, setName] = React.useState('');
  const [date, setDate] = React.useState('');
  const [step, setStep] = React.useState('form'); // form → success
  const [generatedKey, setGeneratedKey] = React.useState('');

  const create = () => {
    const key = 'EVT-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    setGeneratedKey(key);
    setStep('success');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        {step === 'form' ? (
          <>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Create event</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>
                Generate a unique event key and shareable attendee link.
              </p>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="label">Event name</label>
                <input className="input" placeholder="e.g. HuskyHack Demo Day"
                  value={name} onChange={e => setName(e.target.value)} autoFocus />
              </div>
              <div className="field">
                <label className="label">Event date</label>
                <input className="input" placeholder="Apr 28, 2026"
                  value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <Notice icon="lock">
                <strong>Reference photos for opt-outs are scoped to this event only.</strong> They are not shared with other events or used for any purpose outside this redaction workflow.
              </Notice>
            </div>
            <div className="modal-footer">
              <button className="btn ghost" onClick={onClose}>Cancel</button>
              <button className="btn primary" disabled={!name} onClick={create}>Create event</button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-header">
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="check-circle" size={18} style={{ color: 'var(--ok)' }} />
                Event created
              </h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>
                Share the event key or attendee link below. Attendees do not need an account.
              </p>
            </div>
            <div className="modal-body">
              <div className="field">
                <label className="label">Event key</label>
                <CopyField value={generatedKey} />
              </div>
              <div className="field">
                <label className="label">Attendee link</label>
                <CopyField value={`anonify.app/e/${generatedKey}`} />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn primary" onClick={() => onCreated(generatedKey, name, date)}>Open event dashboard</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Event Dashboard (tabs) ─────────────────────────────────
function EventDashboard({ event, view, setView, photoLayout, blurThreshold }) {
  const tab = view.tab || 'overview';
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="crumbs">
            <a onClick={() => setView({ screen: 'events' })}>Events</a>
            <span className="sep">/</span>
            <span style={{ color: 'var(--fg)' }}>{event.name}</span>
          </div>
          <h1 className="page-title">{event.name}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <span className="event-key-pill">{event.key}</span>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{event.date}</span>
            {event.active && <span className="badge accent"><span className="dot"/>Active</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn"><Icon name="qr" size={14}/>QR code</button>
          <button className="btn"><Icon name="link" size={14}/>Share link</button>
        </div>
      </div>

      <div className="tabs">
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'optouts',  label: 'Opt-out attendees', count: event.optOuts },
          { id: 'photos',   label: 'Event photos',     count: event.photos },
          { id: 'review',   label: 'Review queue',     count: event.needsReview, alert: event.needsReview > 0 },
          { id: 'log',      label: 'Processing log' },
        ].map(t => (
          <div key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setView({ ...view, tab: t.id })}>
            {t.label}
            {t.count != null && <span className="tab-count" style={t.alert ? { color: 'var(--warn)', background: 'rgba(245,158,11,0.12)' } : null}>{t.count}</span>}
          </div>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab event={event} />}
      {tab === 'optouts'  && <OptOutsTab />}
      {tab === 'photos'   && <PhotosTab event={event} setView={setView} />}
      {tab === 'review'   && <ReviewTab event={event} setView={setView} photoLayout={photoLayout} blurThreshold={blurThreshold} />}
      {tab === 'log'      && <LogTab />}
    </div>
  );
}

function OverviewTab({ event }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad-4)' }}>
      <div className="stat-grid">
        <div className="stat">
          <div className="stat-label"><Icon name="users" size={13}/>Attendee submissions</div>
          <div className="stat-value">{event.attendees}</div>
          <div className="stat-sub">{event.attendees - event.optOuts} consented · {event.optOuts} opted out</div>
        </div>
        <div className="stat">
          <div className="stat-label"><Icon name="user-x" size={13}/>Opt-outs</div>
          <div className="stat-value">{event.optOuts}</div>
          <div className="stat-sub">Reference photos on file</div>
        </div>
        <div className="stat">
          <div className="stat-label"><Icon name="images" size={13}/>Event photos</div>
          <div className="stat-value">{event.photos}</div>
          <div className="stat-sub">{event.processed} processed · {event.photos - event.processed} pending</div>
        </div>
        <div className="stat">
          <div className="stat-label"><Icon name="flag" size={13}/>Needs review</div>
          <div className="stat-value" style={{ color: event.needsReview > 0 ? 'var(--warn)' : undefined }}>{event.needsReview}</div>
          <div className="stat-sub">Low-confidence detections</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--pad-4)' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Share with attendees</h3>
          </div>
          <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad-3)' }}>
            <div>
              <label className="label">Event key</label>
              <CopyField value={event.key} />
              <div className="helper">Attendees can type this on the consent form.</div>
            </div>
            <div>
              <label className="label">Attendee link</label>
              <CopyField value={`anonify.app/e/${event.key}`} />
              <div className="helper">Direct link — pre-fills the event key.</div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">QR code</h3>
            <span className="badge muted">Print-ready</span>
          </div>
          <div className="card-pad" style={{ display: 'flex', gap: 'var(--pad-4)', alignItems: 'center' }}>
            <QRCode size={140} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 4 }}>Scan to consent</div>
              <p style={{ fontSize: 12, color: 'var(--fg-muted)', margin: '0 0 10px', lineHeight: 1.5 }}>
                Print this on signage at the event entrance. Scanning opens the consent form pre-filled with the event key.
              </p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn sm"><Icon name="download" size={12}/>PNG</button>
                <button className="btn sm"><Icon name="download" size={12}/>SVG</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Notice icon="lock">
        <strong>Privacy-first by design.</strong> Reference photos collected from opted-out attendees are used only for this event's redaction workflow and are not retained beyond the event lifecycle. Confidence scores are estimates — review all auto-redactions before publishing.
      </Notice>
    </div>
  );
}

function OptOutsTab() {
  const attendees = window.MOCK_DATA.attendees;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad-3)' }}>
      <Notice icon="lock">
        <strong>Reference photos are used only for this event's redaction workflow.</strong> They are scoped to this event and removed when the event lifecycle ends.
      </Notice>
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>Attendee</th>
              <th>Reference photo</th>
              <th>Submitted</th>
              <th>Consent</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {attendees.map(a => (
              <tr key={a.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar initials={a.avatar.initials} hue={a.avatar.hue} size={32} />
                    <div>
                      <div style={{ fontWeight: 500 }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>id:{a.id}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar initials={a.avatar.initials} hue={a.avatar.hue} size={36} square />
                    <span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>1 photo</span>
                  </div>
                </td>
                <td><span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{a.time}</span></td>
                <td><span className="badge warn"><span className="dot"/>Opted out</span></td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn ghost sm"><Icon name="more-h" size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PhotosTab({ event, setView }) {
  const [filter, setFilter] = React.useState('all');
  const [grid, setGrid] = React.useState(true);
  const photos = window.MOCK_DATA.photos;
  const filtered = photos.filter(p => {
    if (filter === 'all') return true;
    if (filter === 'review') return p.status === 'manual_review';
    if (filter === 'matches') return p.status === 'match' || p.status === 'manual_review';
    if (filter === 'pending') return !p.processed;
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--pad-3)' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[
            { id: 'all', label: 'All', count: photos.length },
            { id: 'matches', label: 'Has matches', count: photos.filter(p => p.status === 'match' || p.status === 'manual_review').length },
            { id: 'review', label: 'Needs review', count: photos.filter(p => p.status === 'manual_review').length },
            { id: 'pending', label: 'Pending', count: photos.filter(p => !p.processed).length },
          ].map(f => (
            <button key={f.id} className={`btn sm ${filter === f.id ? 'primary' : ''}`} onClick={() => setFilter(f.id)}>
              {f.label} <span style={{ opacity: 0.7, marginLeft: 4 }}>{f.count}</span>
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="toggle-group">
            <button className={grid ? 'active' : ''} onClick={() => setGrid(true)}><Icon name="grid" size={12}/></button>
            <button className={!grid ? 'active' : ''} onClick={() => setGrid(false)}><Icon name="list" size={12}/></button>
          </div>
          <button className="btn"><Icon name="upload" size={14}/>Upload</button>
        </div>
      </div>

      {grid ? (
        <div className="photo-grid">
          {filtered.map(p => {
            const matches = p.figures.filter(f => f.match);
            const topConf = matches.reduce((m, f) => Math.max(m, f.confidence || 0), 0);
            return (
              <div key={p.id} className="photo-card" onClick={() => setView({ screen: 'event', tab: 'review', photoId: p.id })}>
                <div className="photo-card-thumb">
                  <PhotoSVG photo={p} redacted={false} />
                  <div className="status-overlay"><PhotoStatusBadge status={p.status} /></div>
                  {matches.length > 0 && (
                    <div className="match-overlay">
                      {matches.length} match{matches.length > 1 ? 'es' : ''} · {Math.round(topConf * 100)}%
                    </div>
                  )}
                </div>
                <div className="photo-card-meta">
                  <div className="photo-card-name">{p.name}</div>
                  <div className="photo-card-status-row">
                    <span style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{p.time}</span>
                    <button className="btn sm ghost" style={{ padding: '0 8px' }}>Review<Icon name="chevron" size={11}/></button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr><th>File</th><th>Status</th><th>Matches</th><th>Top confidence</th><th>Time</th><th></th></tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const matches = p.figures.filter(f => f.match);
                const topConf = matches.reduce((m, f) => Math.max(m, f.confidence || 0), 0);
                return (
                  <tr key={p.id} className="clickable" onClick={() => setView({ screen: 'event', tab: 'review', photoId: p.id })}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 36, height: 28, borderRadius: 4, overflow: 'hidden', flexShrink: 0 }}>
                          <PhotoSVG photo={p} />
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{p.name}</span>
                      </div>
                    </td>
                    <td><PhotoStatusBadge status={p.status} /></td>
                    <td>{matches.length}</td>
                    <td>{topConf > 0 ? <ConfidenceBar value={topConf} width={140} /> : <span style={{ color: 'var(--fg-dim)' }}>—</span>}</td>
                    <td><span style={{ fontSize: 12, color: 'var(--fg-muted)' }}>{p.time}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn sm ghost">Review<Icon name="chevron" size={11}/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReviewTab({ event, setView, photoLayout, blurThreshold }) {
  const photos = window.MOCK_DATA.photos;
  const photoId = (window.__currentView && window.__currentView.photoId) || photos.find(p => p.status === 'manual_review')?.id || photos[0].id;
  const photo = photos.find(p => p.id === photoId);
  return <PhotoReview photo={photo} allPhotos={photos} setView={setView} photoLayout={photoLayout} blurThreshold={blurThreshold} />;
}

function LogTab() {
  const log = window.MOCK_DATA.log;
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Processing log</h3>
        <span className="badge muted"><Icon name="clock" size={11}/>Live</span>
      </div>
      <div style={{ padding: 'var(--pad-2) 0' }}>
        {log.map((row, i) => (
          <div key={i} style={{
            display: 'grid',
            gridTemplateColumns: '90px 90px 1fr',
            gap: 12,
            padding: '8px 16px',
            fontSize: 12,
            fontFamily: 'var(--font-mono)',
            borderBottom: i < log.length - 1 ? '1px solid var(--border)' : 'none',
            alignItems: 'center',
          }}>
            <span style={{ color: 'var(--fg-dim)' }}>{row.time}</span>
            <span className={`badge ${row.kind === 'warn' ? 'warn' : 'muted'}`} style={{ width: 'fit-content' }}>
              {row.kind === 'warn' ? 'review' : 'info'}
            </span>
            <span style={{ color: 'var(--fg)', fontFamily: 'var(--font-sans)' }}>{row.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, {
  BrowserChrome, Sidebar, EventsList, CreateEventModal, EventDashboard,
});
