import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mountFrost } from './legacy';
import QuickActions from './components/QuickActions';
import Settings from './components/Settings';
import DeviceBinding from './components/DeviceBinding';
import { useDeviceConfig } from './DeviceConfigSync';
import type { User } from 'firebase/auth';

export default function HomeScreen({ user }: { user: User }) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const quickActionsRoot = useRef<Root | null>(null);
  const settingsRoot = useRef<Root | null>(null);
  const deviceBindingRoot = useRef<Root | null>(null);
  const [volume, setVolume] = useState(30);
  const [displaySeconds, setDisplaySeconds] = useState(60);
  const [macAddress, setMacAddress] = useState<string | null>(null);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const { config: storedDeviceConfig, dndEnabled: storedDndEnabled } = useDeviceConfig(macAddress, user.uid);

  useEffect(() => {
    const handleMac = (event: Event) => {
      const mac = (event as CustomEvent<{ macAddress?: string }>).detail?.macAddress;
      if (mac) {
        setMacAddress(mac);
        setIsDeviceConnected(true);
      }
    };
    const handleDisconnect = () => {
      setMacAddress(null);
      setIsDeviceConnected(false);
    };
    window.addEventListener('frost-device-mac', handleMac);
    window.addEventListener('frost-device-disconnected', handleDisconnect);
    return () => {
      window.removeEventListener('frost-device-mac', handleMac);
      window.removeEventListener('frost-device-disconnected', handleDisconnect);
    };
  }, []);

  useEffect(() => {
    if (storedDeviceConfig) {
      window.dispatchEvent(new CustomEvent('frost-device-config', { detail: { config: storedDeviceConfig } }));
    }
  }, [macAddress, storedDeviceConfig]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('frost-device-dnd-status', { detail: { enabled: Boolean(storedDndEnabled) } }));
  }, [storedDndEnabled]);

  const renderQuickActions = (currentVolume: number, currentDndEnabled: boolean) => quickActionsRoot.current?.render(
    <QuickActions
      volume={currentVolume}
      dndEnabled={currentDndEnabled}
      isDeviceConnected={isDeviceConnected}
      onVolumeChange={(value) => {
        setVolume(value);
        dispatchQuickAction('volume', value);
      }}
      onWifi={() => dispatchQuickAction('wifi')}
      onDnd={() => dispatchQuickAction('dnd')}
      onSetTime={() => dispatchQuickAction('time')}
      onUpdate={() => dispatchQuickAction('update')}
    />,
  );

  const dispatchQuickAction = (type: 'volume' | 'wifi' | 'dnd' | 'time' | 'update', value?: number) => {
    window.dispatchEvent(new CustomEvent('frost-quick-action', { detail: { type, ...(value === undefined ? {} : { value }) } }));
  };

  const renderSettings = (seconds: number) => settingsRoot.current?.render(
    <Settings
      displaySeconds={seconds}
      onDisplaySecondsChange={(value) => {
        setDisplaySeconds(value);
        window.dispatchEvent(new CustomEvent('frost-settings-change', { detail: { displaySeconds: value } }));
      }}
    />,
  );

  useEffect(() => {
    const dashboard = dashboardRef.current;
    if (!dashboard) return;

    mountFrost(dashboard, user);

    const deviceBindingHost = dashboard.querySelector<HTMLElement>('#device-binding-root');
    if (deviceBindingHost) {
      deviceBindingRoot.current = createRoot(deviceBindingHost);
      deviceBindingRoot.current.render(<DeviceBinding user={user} mode="device" />);
      deviceBindingHost.dataset.mounted = 'true';
    }

    const host = dashboard.querySelector<HTMLElement>('#quick-actions-root');
    if (!host) return;

    quickActionsRoot.current = createRoot(host);
    renderQuickActions(volume, Boolean(storedDndEnabled));
    const settingsHost = dashboard.querySelector<HTMLElement>('#settings-root');
    if (settingsHost) {
      settingsRoot.current = createRoot(settingsHost);
      renderSettings(displaySeconds);
    }

    return () => {
      quickActionsRoot.current?.unmount();
      quickActionsRoot.current = null;
      settingsRoot.current?.unmount();
      settingsRoot.current = null;
      deviceBindingRoot.current?.unmount();
      deviceBindingRoot.current = null;
      dashboard.replaceChildren();
    };
  }, [user]);

  useEffect(() => {
    renderQuickActions(volume, Boolean(storedDndEnabled));
  }, [volume, storedDndEnabled, isDeviceConnected]);

  useEffect(() => {
    renderSettings(displaySeconds);
  }, [displaySeconds]);

  return <main ref={dashboardRef} aria-label="FROST Aura device dashboard" />;
}
