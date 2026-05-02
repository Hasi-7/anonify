// anonify — attendee mobile flow (inside iOS frame)

function AttendeeFlow({ initialKey = 'HUSK-K7M2', accent }) {
  const [step, setStep] = React.useState('key'); // key → name → consent → upload → done
  const [key, setKey] = React.useState(initialKey);
  const [name, setName] = React.useState('');
  const [consent, setConsent] = React.useState(null); // 'yes' | 'no'
  const [uploaded, setUploaded] = React.useState(false);

  const eventName = 'HuskyHack Demo Day';
  const valid = key.replace('-', '').length >= 6;

  return (
    <div className="mobile-screen" style={{ background: '#0a0a0c' }}>
      {/* header — clears iOS status bar */}
      <div style={{ padding: '64px 24px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 24, height: 24, borderRadius: 6, background: '#f4f4f6', color: '#0a0a0c',
            display: 'grid', placeItems: 'center', fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: 13,
          }}>a</div>
          <span style={{ fontWeight: 600, fontSize: 15 }}>anonify</span>
        </div>
        <span className="badge muted" style={{ fontSize: 10 }}><Icon name="lock" size={9}/>Private</span>
      </div>

      {/* Progress */}
      <div style={{ padding: '0 24px 12px', display: 'flex', gap: 4 }}>
        {['key','name','consent','upload'].filter(s => !(s === 'upload' && consent !== 'no')).map((s, i, arr) => {
          const order = ['key','name','consent','upload','done'];
          const current = order.indexOf(step);
          const sIdx = order.indexOf(s);
          return (
            <div key={s} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: sIdx <= current ? accent : '#25252d',
              transition: 'background 0.3s',
            }} />
          );
        })}
      </div>

      <div className="mobile-content">
        {step === 'key' && (
          <div className="fade-in">
            <h1 className="mobile-h1">Join an event</h1>
            <p className="mobile-sub">Enter the event key from the organizer's poster, link, or QR code.</p>
            <label className="mobile-label">Event key</label>
            <input className="mobile-input mono" value={key} onChange={e => setKey(e.target.value.toUpperCase())} />
            <p className="mobile-helper">
              {valid ? <><span style={{ color: '#10b981' }}>✓</span> {eventName} · Apr 28, 2026</> : 'Type or paste the event key.'}
            </p>
          </div>
        )}

        {step === 'name' && (
          <div className="fade-in">
            <h1 className="mobile-h1">{eventName}</h1>
            <p className="mobile-sub">We just need your name and your photo preferences. No account needed.</p>
            <label className="mobile-label">Your name</label>
            <input className="mobile-input" value={name} placeholder="First and last name"
              onChange={e => setName(e.target.value)} autoFocus />
            <p className="mobile-helper">Used only to associate your consent with your reference photo if you opt out.</p>
          </div>
        )}

        {step === 'consent' && (
          <div className="fade-in">
            <h1 className="mobile-h1">Photo consent</h1>
            <p className="mobile-sub">Are you okay appearing in public event photos?</p>

            <div className={`consent-card ${consent === 'yes' ? 'selected' : ''}`} onClick={() => setConsent('yes')}>
              <div className="consent-radio"/>
              <div>
                <h3 className="consent-title">I consent to appearing in public event photos</h3>
                <p className="consent-desc">No additional steps. Photos may be shared by the organizer.</p>
              </div>
            </div>

            <div className={`consent-card ${consent === 'no' ? 'selected' : ''}`} onClick={() => setConsent('no')}>
              <div className="consent-radio"/>
              <div>
                <h3 className="consent-title">I do not consent</h3>
                <p className="consent-desc">We'll ask for a reference photo so the organizer can blur you out before publishing.</p>
              </div>
            </div>

            <div style={{ marginTop: 16, padding: 12, borderRadius: 12, background: 'rgba(37,99,235,0.08)', border: `1px solid ${accent}30`, display: 'flex', gap: 10 }}>
              <Icon name="lock" size={16} style={{ color: accent, flexShrink: 0, marginTop: 2 }}/>
              <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.5 }}>
                anonify is a privacy review assistant. Detection is not perfect — organizers manually review low-confidence matches.
              </div>
            </div>
          </div>
        )}

        {step === 'upload' && (
          <div className="fade-in">
            <h1 className="mobile-h1">Reference photo</h1>
            <p className="mobile-sub">A clear, recent selfie helps the organizer identify and blur you in event photos.</p>

            <div onClick={() => setUploaded(true)} style={{
              border: uploaded ? `1.5px solid ${accent}` : '1.5px dashed #34343f',
              borderRadius: 16,
              padding: 24,
              textAlign: 'center',
              cursor: 'pointer',
              background: uploaded ? 'rgba(37,99,235,0.06)' : 'transparent',
              transition: 'all 0.2s',
            }}>
              {uploaded ? (
                <>
                  <div style={{ width: 80, height: 80, margin: '0 auto 12px', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #ec4899)', display: 'grid', placeItems: 'center', color: 'white', fontWeight: 600, fontSize: 24 }}>
                    {(name.split(' ').map(s => s[0]).slice(0,2).join('').toUpperCase()) || 'YO'}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>selfie.jpg</div>
                  <div style={{ fontSize: 12, color: '#71717a' }}>Tap to replace</div>
                </>
              ) : (
                <>
                  <div style={{ width: 56, height: 56, margin: '0 auto 12px', borderRadius: 14, background: '#16161b', border: '1px solid #25252d', display: 'grid', placeItems: 'center', color: '#a1a1aa' }}>
                    <Icon name="camera" size={22}/>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>Take a selfie or upload</div>
                  <div style={{ fontSize: 12, color: '#71717a' }}>JPEG or PNG · stays on this event</div>
                </>
              )}
            </div>

            <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: '#16161b', border: '1px solid #25252d' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <Icon name="lock" size={14} style={{ color: accent }}/>
                <span style={{ fontSize: 13, fontWeight: 500 }}>How your photo is used</span>
              </div>
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', fontSize: 12, color: '#a1a1aa', lineHeight: 1.6 }}>
                <li>· Used only to redact you from this event's photos.</li>
                <li>· Not shared with other events or third parties.</li>
                <li>· Removed when this event ends.</li>
              </ul>
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="fade-in" style={{ padding: '40px 0', textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, margin: '0 auto 20px',
              borderRadius: '50%', background: 'rgba(16, 185, 129, 0.12)',
              display: 'grid', placeItems: 'center', color: '#10b981',
            }}>
              <Icon name="check" size={36}/>
            </div>
            <h1 className="mobile-h1" style={{ marginBottom: 8 }}>You're all set</h1>
            <p className="mobile-sub" style={{ marginBottom: 24 }}>
              {consent === 'no'
                ? 'Your reference photo is on file. The organizer will blur you out of event photos before publishing.'
                : 'Thanks — enjoy the event! Photos may be shared publicly.'}
            </p>

            <div style={{ textAlign: 'left', padding: 16, borderRadius: 14, background: '#16161b', border: '1px solid #25252d' }}>
              <div style={{ fontSize: 12, color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Submission</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: '#a1a1aa' }}>Event</span><span>{eventName}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: '#a1a1aa' }}>Name</span><span>{name || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                <span style={{ color: '#a1a1aa' }}>Consent</span>
                <span style={{ color: consent === 'no' ? '#f59e0b' : '#10b981' }}>
                  {consent === 'no' ? 'Opted out' : 'Consented'}
                </span>
              </div>
              {consent === 'no' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: 13 }}>
                  <span style={{ color: '#a1a1aa' }}>Reference photo</span>
                  <span style={{ color: '#10b981' }}>On file</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mobile-bottom" style={{ paddingBottom: 48 }}>
        {step === 'key' && (
          <button className="mobile-btn" disabled={!valid} onClick={() => setStep('name')}>
            Continue<Icon name="arrow-right" size={16}/>
          </button>
        )}
        {step === 'name' && (
          <button className="mobile-btn" disabled={!name.trim()} onClick={() => setStep('consent')}>
            Continue<Icon name="arrow-right" size={16}/>
          </button>
        )}
        {step === 'consent' && (
          <button className="mobile-btn" disabled={!consent}
            onClick={() => setStep(consent === 'no' ? 'upload' : 'done')}>
            Continue<Icon name="arrow-right" size={16}/>
          </button>
        )}
        {step === 'upload' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <button className="mobile-btn" disabled={!uploaded} onClick={() => setStep('done')}>
              Submit
            </button>
          </div>
        )}
        {step === 'done' && (
          <button className="mobile-btn secondary" onClick={() => {
            setStep('key'); setName(''); setConsent(null); setUploaded(false);
          }}>
            Restart demo
          </button>
        )}
      </div>
    </div>
  );
}

window.AttendeeFlow = AttendeeFlow;
