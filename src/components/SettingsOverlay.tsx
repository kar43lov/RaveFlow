import { useStore, Quality, AutoCycleMode } from '../store/useStore'
import { MicStatus } from '../scenes/types'
import { TapTempo } from '../audio/BeatClock'

function formatInterval(s: number): string {
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return r === 0 ? `${m}m` : `${m}m ${r}s`
}

interface SettingsOverlayProps {
  sceneNames: string[]
  onEnableMic: () => Promise<void>
  onDisableMic: () => void
  tapTempo: TapTempo
}

export function SettingsOverlay({
  sceneNames,
  onEnableMic,
  onDisableMic,
  tapTempo
}: SettingsOverlayProps) {
  const {
    showSettings,
    closeSettings,
    currentSceneIndex,
    setCurrentSceneIndex,
    multiSelectMode,
    setMultiSelectMode,
    selectedScenes,
    toggleSceneSelected,
    setSelectedScenes,
    autoCycleEnabled,
    setAutoCycleEnabled,
    autoCycleMode,
    setAutoCycleMode,
    autoCycleInterval,
    setAutoCycleInterval,
    micMode,
    setMicMode,
    micStatus,
    bpm,
    setBpm,
    autoBPM,
    isBpmLocked,
    toggleBpmLock,
    quality,
    setQuality,
    masterIntensity,
    setMasterIntensity,
    sensitivity,
    setSensitivity,
    smoothing,
    setSmoothing,
    showEqualizer,
    toggleEqualizer
  } = useStore()

  if (!showSettings) {
    return null
  }

  const handleMicToggle = async () => {
    if (micMode) {
      setMicMode(false)
      onDisableMic()
    } else {
      await onEnableMic()
    }
  }

  const handleTapTempo = () => {
    const newBpm = tapTempo.tap()
    if (newBpm) {
      setBpm(newBpm)
    }
  }

  const getMicStatusText = (status: MicStatus): string => {
    switch (status) {
      case 'off': return 'Off'
      case 'requesting': return 'Requesting...'
      case 'on': return 'Active'
      case 'blocked': return 'Blocked'
      case 'no-device': return 'No Device'
    }
  }

  return (
    <div className="settings-overlay" onClick={(e) => {
      if (e.target === e.currentTarget) closeSettings()
    }}>
      <div className="settings-panel">
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="close-btn" onClick={closeSettings}>&times;</button>
        </div>

        {/* Scene Selection */}
        <div className="settings-section">
          <h3>Scene</h3>

          <div className="control-row">
            <label>Multi-select playlist</label>
            <div
              className={`toggle ${multiSelectMode ? 'active' : ''}`}
              onClick={() => setMultiSelectMode(!multiSelectMode)}
            />
          </div>

          {multiSelectMode && (
            <div className="btn-group" style={{ marginBottom: '12px' }}>
              <button
                className="btn"
                onClick={() => setSelectedScenes(sceneNames.map((_, i) => i))}
              >
                Select all
              </button>
              <button className="btn" onClick={() => setSelectedScenes([])}>
                Clear
              </button>
              <span className="control-value" style={{ marginLeft: 'auto' }}>
                {selectedScenes.length} / {sceneNames.length}
              </span>
            </div>
          )}

          <div className="scene-grid">
            {sceneNames.map((name, index) => {
              const isCurrent = currentSceneIndex === index
              const isSelected = multiSelectMode && selectedScenes.includes(index)
              const cls = [
                'scene-btn',
                isCurrent ? 'active' : '',
                isSelected ? 'selected' : ''
              ].filter(Boolean).join(' ')
              return (
                <button
                  key={index}
                  className={cls}
                  onClick={() => {
                    if (multiSelectMode) {
                      toggleSceneSelected(index)
                    } else {
                      setCurrentSceneIndex(index)
                    }
                  }}
                >
                  <span className="scene-number">{index + 1}</span>
                  {name}
                </button>
              )
            })}
          </div>

          {multiSelectMode && (
            <p style={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.4)',
              marginTop: '8px',
              lineHeight: 1.4
            }}>
              Tap scenes to add or remove from the rotation. Next/Prev will only
              cycle through the selected ones.
            </p>
          )}
        </div>

        {/* Auto-cycle */}
        <div className="settings-section">
          <h3>Auto-cycle</h3>

          <div className="control-row">
            <label>Auto-cycle scenes</label>
            <div
              className={`toggle ${autoCycleEnabled ? 'active' : ''}`}
              onClick={() => setAutoCycleEnabled(!autoCycleEnabled)}
            />
          </div>

          {autoCycleEnabled && (
            <>
              <div className="control-row">
                <label>Mode</label>
                <div className="quality-selector">
                  {(['auto', 'timed'] as AutoCycleMode[]).map((m) => (
                    <button
                      key={m}
                      className={`quality-btn ${autoCycleMode === m ? 'active' : ''}`}
                      onClick={() => setAutoCycleMode(m)}
                    >
                      {m === 'auto' ? 'By music' : 'Timed'}
                    </button>
                  ))}
                </div>
              </div>

              {autoCycleMode === 'timed' && (
                <div className="control-row">
                  <label>Every</label>
                  <input
                    type="range"
                    min="30"
                    max="600"
                    step="30"
                    value={autoCycleInterval}
                    onChange={(e) => setAutoCycleInterval(parseInt(e.target.value))}
                  />
                  <span className="control-value">{formatInterval(autoCycleInterval)}</span>
                </div>
              )}

              <p style={{
                fontSize: '11px',
                color: 'rgba(255,255,255,0.4)',
                marginTop: '4px',
                lineHeight: 1.4
              }}>
                {autoCycleMode === 'auto'
                  ? 'Switches on big drops or transitions in the music (mic mode required for best results).'
                  : `Switches every ${formatInterval(autoCycleInterval)}. Manual Next/Prev resets the timer.`}
              </p>
            </>
          )}
        </div>

        {/* Audio Mode */}
        <div className="settings-section">
          <h3>Audio</h3>

          <div className="control-row">
            <label>Microphone Mode</label>
            <div
              className={`toggle ${micMode ? 'active' : ''}`}
              onClick={handleMicToggle}
            />
          </div>

          <div className="mic-status">
            <span className={`mic-status-dot ${micStatus}`} />
            <span>Mic: {getMicStatusText(micStatus)}</span>
          </div>

          {micMode && micStatus === 'on' && (
            <>
              <div className="control-row">
                <label>Sensitivity</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sensitivity}
                  onChange={(e) => setSensitivity(parseFloat(e.target.value))}
                />
                <span className="control-value">{sensitivity.toFixed(2)}</span>
              </div>

              <div className="control-row">
                <label>Smoothing</label>
                <input
                  type="range"
                  min="0"
                  max="0.95"
                  step="0.05"
                  value={smoothing}
                  onChange={(e) => setSmoothing(parseFloat(e.target.value))}
                />
                <span className="control-value">{smoothing.toFixed(2)}</span>
              </div>

              <div className="control-row">
                <label>Auto BPM</label>
                <span className="control-value" style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  {autoBPM}
                </span>
                <button
                  className={`btn ${isBpmLocked ? 'active' : ''}`}
                  onClick={toggleBpmLock}
                  style={{ marginLeft: '8px' }}
                >
                  {isBpmLocked ? 'Locked' : 'Lock'}
                </button>
              </div>

              <div className="control-row">
                <label>Equalizer</label>
                <div
                  className={`toggle ${showEqualizer ? 'active' : ''}`}
                  onClick={toggleEqualizer}
                />
              </div>
            </>
          )}
        </div>

        {/* Manual BPM Controls */}
        {!micMode && (
          <div className="settings-section">
            <h3>Manual BPM</h3>

            <div className="control-row">
              <label>BPM</label>
              <input
                type="range"
                min="120"
                max="190"
                step="1"
                value={bpm}
                onChange={(e) => setBpm(parseInt(e.target.value))}
              />
              <span className="control-value">{bpm}</span>
            </div>

            <div className="btn-group">
              <button className="btn" onClick={handleTapTempo}>
                Tap Tempo
              </button>
              <button className="btn" onClick={() => setBpm(140)}>140</button>
              <button className="btn" onClick={() => setBpm(160)}>160</button>
              <button className="btn" onClick={() => setBpm(174)}>174</button>
              <button className="btn" onClick={() => setBpm(180)}>180</button>
            </div>
          </div>
        )}

        {/* Visual Settings */}
        <div className="settings-section">
          <h3>Visuals</h3>

          <div className="control-row">
            <label>Quality</label>
            <div className="quality-selector">
              {(['low', 'medium', 'high'] as Quality[]).map((q) => (
                <button
                  key={q}
                  className={`quality-btn ${quality === q ? 'active' : ''}`}
                  onClick={() => setQuality(q)}
                >
                  {q.charAt(0).toUpperCase() + q.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="control-row">
            <label>Intensity</label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={masterIntensity}
              onChange={(e) => setMasterIntensity(parseFloat(e.target.value))}
            />
            <span className="control-value">{masterIntensity.toFixed(1)}</span>
          </div>
        </div>

        {/* Keyboard Shortcuts */}
        <div className="settings-section">
          <h3>Keyboard Shortcuts</h3>
          <div className="shortcuts-grid">
            <div className="shortcut">
              <span>Scene 1-9</span>
              <kbd>1-9</kbd>
            </div>
            <div className="shortcut">
              <span>Next Scene</span>
              <kbd>N</kbd>
            </div>
            <div className="shortcut">
              <span>Prev Scene</span>
              <kbd>P</kbd>
            </div>
            <div className="shortcut">
              <span>Fullscreen</span>
              <kbd>F</kbd>
            </div>
            <div className="shortcut">
              <span>Pause</span>
              <kbd>Space</kbd>
            </div>
            <div className="shortcut">
              <span>Settings</span>
              <kbd>Tab</kbd>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
