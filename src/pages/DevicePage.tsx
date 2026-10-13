type Props = { connected: boolean; serial: string; battery: number; json: string; onConnect: () => void; onExport: () => void; onReset: () => void };

export default function DevicePage({ connected, serial, battery, json, onConnect, onExport, onReset }: Props) {
  return (
    <section id="page-device">
      <div className="ptitle">Device</div>
      <p className="psub">Your FROST Aura connection, firmware, and the schedule it's currently running.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 680 }}>
        <div className="card">
          <h2>Binding</h2>
          <div className="drow">
            <div className="t"><p>FROST Aura</p><small id="dSerial">{serial}</small></div>
            <div className="batt"><i style={{ '--p': `${battery}%` } as React.CSSProperties} /></div>
            <span className={`pill${connected ? ' ok' : ''}`} id="dState">{connected ? 'Connected' : 'Offline'}</span>
            <button className="btn" id="dConnect" type="button" onClick={onConnect}>{connected ? 'Disconnect' : 'Connect'}</button>
          </div>
        </div>
        <div className="card">
          <h2>Backup <span className="r">schema_ver 6 · sent to device</span></h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <button className="btn" id="dExport" type="button" onClick={onExport}>Export JSON</button>
            <button className="btn" id="dReset" type="button" onClick={onReset}>Reset schedule</button>
          </div>
          <pre id="jsonOut">{json}</pre>
        </div>
      </div>
    </section>
  );
}
