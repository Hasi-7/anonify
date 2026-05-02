// anonify — main app

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "#2563eb",
  "theme": "dark",
  "density": "comfortable",
  "blurThreshold": 65,
  "photoLayout": "split",
  "emptyState": false,
  "view": "split"
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [view, setViewState] = React.useState({ screen: 'events' });
  const [showCreate, setShowCreate] = React.useState(false);
  const [events, setEvents] = React.useState(window.MOCK_DATA.events);

  // Stash view ref so ReviewTab can read photoId
  React.useEffect(() => { window.__currentView = view; }, [view]);

  // Apply tokens
  React.useEffect(() => {
    document.documentElement.dataset.theme = tweaks.theme;
    document.documentElement.dataset.density = tweaks.density;
    document.documentElement.style.setProperty('--accent', tweaks.accent);
    // accent-soft: derive
    const hex = tweaks.accent.replace('#', '');
    const r = parseInt(hex.slice(0,2), 16), g = parseInt(hex.slice(2,4), 16), b = parseInt(hex.slice(4,6), 16);
    document.documentElement.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.14)`);
  }, [tweaks.theme, tweaks.density, tweaks.accent]);

  const setView = (v) => setViewState(v);

  const currentEvent = view.eventId
    ? events.find(e => e.id === view.eventId)
    : (view.screen === 'event' ? events[0] : null);

  const visibleEvents = tweaks.emptyState ? [] : events;

  // Top-level: split = both organizer + attendee, organizer-only, attendee-only
  const v = tweaks.view;

  return (
    <>
      <FrameSwitcher view={v} setView={(nv) => setTweak('view', nv)} />

      <div className="split-stage" style={v === 'attendee' ? { padding: 'var(--pad-6)' } : null}>
        {(v === 'split' || v === 'organizer') && (
          <div style={{ flex: '1 1 1100px', maxWidth: v === 'organizer' ? '100%' : 1300, minWidth: 900 }}>
            <BrowserChrome url={`anonify.app/${view.screen === 'events' ? 'events' : `events/${currentEvent?.id || ''}`}`}>
              <div className="app-shell">
                <Sidebar view={view} setView={setView} currentEvent={currentEvent} />
                <div>
                  {view.screen === 'events' && (
                    <EventsList events={visibleEvents} setView={setView} onCreate={() => setShowCreate(true)} emptyState={tweaks.emptyState} />
                  )}
                  {view.screen === 'event' && currentEvent && (
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
          </div>
        )}

        {(v === 'split' || v === 'attendee') && (
          <div style={{ flex: '0 0 auto', position: v === 'split' ? 'sticky' : 'static', top: 28 }}>
            <IOSDevice width={380} height={780} dark={true}>
              <AttendeeFlow accent={tweaks.accent} />
            </IOSDevice>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onCreated={(key, name, date) => {
            const id = 'e' + (events.length + 1);
            const newEv = {
              id, name, date: date || 'Apr 28, 2026', key,
              attendees: 0, optOuts: 0, photos: 0, processed: 0, needsReview: 0, active: true,
            };
            setEvents([newEv, ...events]);
            setShowCreate(false);
            setView({ screen: 'event', tab: 'overview', eventId: id });
          }}
        />
      )}

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme">
          <TweakRadio
            label="Mode"
            value={tweaks.theme}
            options={[{ value: 'dark', label: 'Dark' }, { value: 'light', label: 'Light' }]}
            onChange={(v) => setTweak('theme', v)}
          />
          <TweakRadio
            label="Density"
            value={tweaks.density}
            options={[{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }]}
            onChange={(v) => setTweak('density', v)}
          />
          <TweakColor label="Accent" value={tweaks.accent} onChange={(v) => setTweak('accent', v)} />
        </TweakSection>

        <TweakSection label="Photo review">
          <TweakSlider
            label="Auto-blur threshold"
            value={tweaks.blurThreshold}
            min={40} max={95} step={1} unit="%"
            onChange={(v) => setTweak('blurThreshold', v)}
          />
          <TweakRadio
            label="Layout"
            value={tweaks.photoLayout}
            options={[{ value: 'split', label: 'Split' }, { value: 'overlay', label: 'Overlay' }]}
            onChange={(v) => setTweak('photoLayout', v)}
          />
        </TweakSection>

        <TweakSection label="Demo state">
          <TweakToggle label="Show empty state" value={tweaks.emptyState} onChange={(v) => setTweak('emptyState', v)} />
          <TweakRadio
            label="View"
            value={tweaks.view}
            options={[
              { value: 'split', label: 'Both' },
              { value: 'organizer', label: 'Organizer' },
              { value: 'attendee', label: 'Attendee' },
            ]}
            onChange={(v) => setTweak('view', v)}
          />
        </TweakSection>

        <TweakSection label="Demo path">
          <TweakButton label="1. Organizer dashboard" onClick={() => setView({ screen: 'events' })} />
          <TweakButton label="2. Create event" onClick={() => setShowCreate(true)} />
          <TweakButton label="3. Event overview" onClick={() => setView({ screen: 'event', tab: 'overview', eventId: 'e1' })} />
          <TweakButton label="4. Opt-out attendees" onClick={() => setView({ screen: 'event', tab: 'optouts', eventId: 'e1' })} />
          <TweakButton label="5. Event photos" onClick={() => setView({ screen: 'event', tab: 'photos', eventId: 'e1' })} />
          <TweakButton label="6. Photo review" onClick={() => setView({ screen: 'event', tab: 'review', eventId: 'e1', photoId: 'p1' })} />
          <TweakButton label="7. Manual review case" onClick={() => setView({ screen: 'event', tab: 'review', eventId: 'e1', photoId: 'p2' })} />
        </TweakSection>
      </TweaksPanel>
    </>
  );
}

function FrameSwitcher({ view, setView }) {
  return (
    <div className="app-frame-switch">
      <button className={view === 'split' ? 'active' : ''} onClick={() => setView('split')}>
        <Icon name="grid" size={12}/>Both
      </button>
      <button className={view === 'organizer' ? 'active' : ''} onClick={() => setView('organizer')}>
        <Icon name="home" size={12}/>Organizer
      </button>
      <button className={view === 'attendee' ? 'active' : ''} onClick={() => setView('attendee')}>
        <Icon name="user" size={12}/>Attendee
      </button>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
