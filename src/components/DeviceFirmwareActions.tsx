import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type Props = {
  onWifi: (ssid: string, password: string) => void;
  onUpdate: () => void;
};

export default function DeviceFirmwareActions({ onWifi, onUpdate }: Props) {
  const [isWifiModalOpen, setIsWifiModalOpen] = useState(false);
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const wifiButtonRef = useRef<HTMLButtonElement>(null);
  const ssidInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isWifiModalOpen) return;

    ssidInputRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsWifiModalOpen(false);
        setSsid('');
        setPassword('');
        setError('');
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      wifiButtonRef.current?.focus();
    };
  }, [isWifiModalOpen]);

  const closeWifiModal = () => {
    setIsWifiModalOpen(false);
    setSsid('');
    setPassword('');
    setError('');
  };

  const saveWifiSettings = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const networkName = ssid.trim();
    if (!networkName) {
      setError('Enter a Wi-Fi network name.');
      return;
    }
    if (networkName.includes('|') || password.includes('|')) {
      setError('Wi-Fi name and password cannot contain the | character.');
      return;
    }

    onWifi(networkName, password);
    closeWifiModal();
  };

  return <>
    <span className="device-firmware-actions">
      <button ref={wifiButtonRef} className="btn sm" type="button" onClick={() => setIsWifiModalOpen(true)} aria-haspopup="dialog">
        Wi-Fi Settings
      </button>
      <button className="btn sm pri" type="button" onClick={onUpdate}>
        Update Firmware
      </button>
    </span>
    {isWifiModalOpen && createPortal(<div className="wifi-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeWifiModal(); }}>
      <section className="wifi-modal" role="dialog" aria-modal="true" aria-labelledby="wifiModalTitle" aria-describedby="wifiModalDescription">
        <div className="wifi-modal-heading">
          <div>
            <h2 id="wifiModalTitle">Wi-Fi Settings</h2>
            <p id="wifiModalDescription">Connect your Aura to a 2.4 GHz Wi-Fi network.</p>
          </div>
          <button className="wifi-modal-close" type="button" onClick={closeWifiModal} aria-label="Close Wi-Fi settings">×</button>
        </div>
        <form onSubmit={saveWifiSettings}>
          <label className="wifi-field">
            <span>Network name</span>
            <input ref={ssidInputRef} type="text" autoComplete="off" value={ssid} onChange={(event) => { setSsid(event.target.value); setError(''); }} required />
          </label>
          <label className="wifi-field">
            <span>Password</span>
            <input type="password" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} />
          </label>
          {error && <p className="wifi-modal-error" role="alert">{error}</p>}
          <div className="wifi-modal-actions">
            <button className="btn sm" type="button" onClick={closeWifiModal}>Cancel</button>
            <button className="btn sm pri" type="submit">Save</button>
          </div>
        </form>
      </section>
    </div>, document.body)}
  </>;
}