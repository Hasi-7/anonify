// Anonify — photo review screen

function PhotoReview({ photo, allPhotos, setView, photoLayout = 'split', blurThreshold = 0.65 }) {
  const [mode, setMode] = React.useState('redacted'); // original / redacted
  const [selectedFigure, setSelectedFigure] = React.useState(null);
  const [decisions, setDecisions] = React.useState({}); // figureId -> 'approved' | 'rejected' | 'manual'

  if (!photo) return null;
  const matches = photo.figures.filter(f => f.match);
  const attendees = window.MOCK_DATA.attendees;
  const aFor = (id) => attendees.find(a => a.id === id);

  const sortedMatches = [...matches].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  const lowConf = matches.filter(f => f.confidence < blurThreshold);

  const setDecision = (id, d) => setDecisions(prev => ({ ...prev, [id]: d }));
  const statusFor = (f) => {
    const d = decisions[f.id];
    if (d === 'approved') return { tone: 'ok', label: 'Approved', icon: 'check-circle' };
    if (d === 'rejected') return { tone: 'danger', label: 'Marked incorrect', icon: 'x-circle' };
    if (d === 'manual')   return { tone: 'warn', label: 'Manual review', icon: 'flag' };
    if (f.confidence >= blurThreshold) return { tone: 'ok', label: 'Auto-blurred', icon: 'eye-off' };
    return { tone: 'warn', label: 'Needs review', icon: 'flag' };
  };

  const Stage = (
    <div className="review-stage">
      <div className="review-stage-toolbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn ghost sm" onClick={() => setView({ screen: 'event', tab: 'photos' })}>
            <Icon name="arrow-left" size={13}/>Back to photos
          </button>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--fg-muted)' }}>{photo.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="toggle-group">
            <button className={mode === 'original' ? 'active' : ''} onClick={() => setMode('original')}>
              <Icon name="eye" size={12}/>Original
            </button>
            <button className={mode === 'redacted' ? 'active' : ''} onClick={() => setMode('redacted')}>
              <Icon name="eye-off" size={12}/>Redacted
            </button>
          </div>
          <button className="btn sm"><Icon name="download" size={12}/>Export</button>
        </div>
      </div>
      <div className="review-stage-canvas">
        <div className="review-image-wrap" style={{ width: '100%', maxWidth: 720 }}>
          <PhotoSVG
            photo={photo}
            redacted={mode === 'redacted'}
            blurThreshold={blurThreshold}
            highlightId={selectedFigure}
          />
        </div>
      </div>
      <div style={{
        padding: '10px 16px',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: 12,
      }}>
        <div style={{ display: 'flex', gap: 16, color: 'var(--fg-muted)' }}>
          <span><Icon name="user-x" size={11}/> {matches.length} opted-out detected</span>
          <span style={{ color: lowConf.length > 0 ? 'var(--warn)' : undefined }}>
            <Icon name="flag" size={11}/> {lowConf.length} need manual review
          </span>
          <span>Threshold {Math.round(blurThreshold * 100)}%</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(() => {
            const idx = allPhotos.findIndex(p => p.id === photo.id);
            const prev = allPhotos[idx - 1];
            const next = allPhotos[idx + 1];
            return (
              <>
                <button className="btn sm ghost" disabled={!prev}
                  onClick={() => prev && setView({ screen: 'event', tab: 'review', photoId: prev.id })}>
                  <Icon name="arrow-left" size={12}/>Prev
                </button>
                <button className="btn sm" disabled={!next}
                  onClick={() => next && setView({ screen: 'event', tab: 'review', photoId: next.id })}>
                  Next<Icon name="arrow-right" size={12}/>
                </button>
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );

  const Side = (
    <div className="review-side">
      <div className="review-side-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Detections</h3>
          <span className="badge muted">{matches.length} found</span>
        </div>
        <div className="notice warn" style={{ padding: 10, fontSize: 11 }}>
          <div className="notice-icon"><Icon name="alert" size={16}/></div>
          <div>Confidence scores are estimates. Review all results before publishing.</div>
        </div>
      </div>
      <div className="review-side-body">
        {sortedMatches.length === 0 ? (
          <div className="empty" style={{ padding: 20 }}>
            <div className="empty-icon"><Icon name="check" size={20} /></div>
            <h3>No restricted attendees detected</h3>
            <p>This photo is safe to publish.</p>
          </div>
        ) : sortedMatches.map(f => {
          const a = aFor(f.match);
          const st = statusFor(f);
          const flag = f.confidence < blurThreshold;
          const isSelected = selectedFigure === f.id;
          return (
            <div key={f.id}
              className={`detection-card ${isSelected ? 'selected' : ''} ${flag ? 'flag' : ''}`}
              onClick={() => setSelectedFigure(isSelected ? null : f.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Avatar initials={a.avatar.initials} hue={a.avatar.hue} size={36} square />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{a.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-muted)' }}>Reference photo on file</div>
                </div>
                <span className={`badge ${st.tone}`}><Icon name={st.icon} size={10}/>{st.label}</span>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--fg-muted)', marginBottom: 4 }}>
                  <span>Confidence estimate</span>
                  <span className={`conf-${confidenceClass(f.confidence)}`} style={{ fontWeight: 500 }}>
                    {confidenceLabel(f.confidence)}
                  </span>
                </div>
                <ConfidenceBar value={f.confidence} threshold={blurThreshold} />
              </div>
              {isSelected && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  <button className="btn sm" onClick={(e) => { e.stopPropagation(); setDecision(f.id, 'approved'); }}>
                    <Icon name="check" size={11}/>Approve
                  </button>
                  <button className="btn sm" onClick={(e) => { e.stopPropagation(); setDecision(f.id, 'rejected'); }}>
                    <Icon name="x" size={11}/>Mark incorrect
                  </button>
                  <button className="btn sm" onClick={(e) => { e.stopPropagation(); setDecision(f.id, 'manual'); }}>
                    <Icon name="flag" size={11}/>Manual review
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding: 'var(--pad-3)', borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <button className="btn ghost" style={{ flex: 1 }}>Skip</button>
        <button className="btn primary" style={{ flex: 1 }}>
          <Icon name="check" size={13}/>Approve all
        </button>
      </div>
    </div>
  );

  if (photoLayout === 'overlay') {
    return (
      <div style={{ position: 'relative' }}>
        {Stage}
        <div style={{
          position: 'absolute', top: 60, right: 16, width: 340, maxHeight: 'calc(100% - 80px)',
          boxShadow: 'var(--shadow-lg)',
        }}>{Side}</div>
      </div>
    );
  }

  return <div className="review-layout">{Stage}{Side}</div>;
}

window.PhotoReview = PhotoReview;
