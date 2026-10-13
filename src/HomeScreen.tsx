import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mountFrost } from './legacy';
import HeaderControls from './components/HeaderControls';
import DeviceFirmwareActions from './components/DeviceFirmwareActions';
import Settings from './components/Settings';
import DeviceBinding from './components/DeviceBinding';
import { ConfigureClockPanel, ConfigureSidePanel, ConfigureChallengesPanel } from './pages/ConfigurePage';
import { MyDayStore } from './components/configure/store';
import type { ConfigureBridge } from './components/configure/types';
import { useDeviceConfig, useDeviceConfigHistory } from './DeviceConfigSync';
import type { User } from 'firebase/auth';

export default function HomeScreen({ user }: { user: User }) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const headerControlsRoot = useRef<Root | null>(null);
  const settingsRoot = useRef<Root | null>(null);
  const deviceBindingRoot = useRef<Root | null>(null);
  const deviceFirmwareActionsRoot = useRef<Root | null>(null);
  const configureClockRoot = useRef<Root | null>(null);
  const configureSideRoot = useRef<Root | null>(null);
  const configureChallengesRoot = useRef<Root | null>(null);
  const myDayStore = useRef<MyDayStore | null>(null);
  const [volume, setVolume] = useState(30);
  const [displaySeconds, setDisplaySeconds] = useState(60);
  const [macAddress, setMacAddress] = useState<string | null>(null);
  const [isDeviceConnected, setIsDeviceConnected] = useState(false);
  const { config: storedDeviceConfig, lastSyncedAt, dndEnabled: storedDndEnabled, deviceName: storedDeviceName, loading: configLoading, error: configError, reload: reloadConfig } = useDeviceConfig(macAddress, user.uid);
  const storedConfigHistory = useDeviceConfigHistory(macAddress, user.uid);

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

  // Tells the Configure tab whether the last synced schedule is loading, was never synced, is ready or could not be read.
  useEffect(() => {
    const status = storedDeviceConfig ? 'ready' : configError ? 'error' : configLoading ? 'loading' : 'empty';
    window.dispatchEvent(new CustomEvent('frost-device-config-status', {
      detail: { status, lastSyncedAt: lastSyncedAt?.getTime() ?? null, message: configError?.message ?? '' },
    }));
  }, [storedDeviceConfig, lastSyncedAt, configLoading, configError]);

  useEffect(() => {
    window.addEventListener('frost-device-config-retry', reloadConfig);
    return () => window.removeEventListener('frost-device-config-retry', reloadConfig);
  }, [reloadConfig]);

  useEffect(() => {
    const entries = storedConfigHistory.slice();
    if (storedDeviceConfig && lastSyncedAt && !entries.some((entry) => entry.syncedAt.getTime() === lastSyncedAt.getTime())) {
      entries.push({ config: storedDeviceConfig, syncedAt: lastSyncedAt });
    }
    entries.sort((left, right) => left.syncedAt.getTime() - right.syncedAt.getTime());
    window.dispatchEvent(new CustomEvent('frost-device-config-history', { detail: { entries } }));
  }, [lastSyncedAt, storedConfigHistory, storedDeviceConfig]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('frost-device-dnd-status', { detail: { enabled: Boolean(storedDndEnabled) } }));
  }, [storedDndEnabled]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('frost-device-name', { detail: { deviceName: storedDeviceName } }));
  }, [storedDeviceName]);

  const renderHeaderControls = (currentVolume: number, currentDndEnabled: boolean, deviceConnected: boolean) => headerControlsRoot.current?.render(
    <HeaderControls
      volume={currentVolume}
      dndEnabled={currentDndEnabled}
      isDeviceConnected={deviceConnected}
      onVolumeChange={(value) => {
        setVolume(value);
        dispatchQuickAction('volume', value);
      }}
      onDnd={() => dispatchQuickAction('dnd')}
    />,
  );

  const dispatchQuickAction = (type: 'volume' | 'wifi' | 'dnd' | 'update', value?: number) => {
    window.dispatchEvent(new CustomEvent('frost-quick-action', { detail: { type, ...(value === undefined ? {} : { value }) } }));
  };

  const renderSettings = (seconds: number, deviceConnected: boolean) => settingsRoot.current?.render(
    <Settings
      displaySeconds={seconds}
      isDeviceConnected={deviceConnected}
      onDisplaySecondsChange={(value) => {
        setDisplaySeconds(value);
        window.dispatchEvent(new CustomEvent('frost-settings-change', { detail: { displaySeconds: value } }));
      }}
    />,
  );

  useEffect(() => {
    const dashboard = dashboardRef.current;
    if (!dashboard) return;

    const configureBridge = mountFrost(dashboard, user) as ConfigureBridge;

    // Configure ("My day") tab: the schedule lives in legacy.ts; the habit tracker
    // (streaks, challenges, audio library) is layered on top here, in the browser.
    myDayStore.current = new MyDayStore(configureBridge, user.uid);
    const configureClockHost = dashboard.querySelector<HTMLElement>('#configure-dial-root');
    if (configureClockHost) {
      configureClockRoot.current = createRoot(configureClockHost);
      configureClockRoot.current.render(<ConfigureClockPanel store={myDayStore.current} />);
    }
    const configureSideHost = dashboard.querySelector<HTMLElement>('#configure-side-root');
    if (configureSideHost) {
      configureSideRoot.current = createRoot(configureSideHost);
      configureSideRoot.current.render(<ConfigureSidePanel store={myDayStore.current} />);
    }
    const configureChallengesHost = dashboard.querySelector<HTMLElement>('#configure-challenges-root');
    if (configureChallengesHost) {
      configureChallengesRoot.current = createRoot(configureChallengesHost);
      configureChallengesRoot.current.render(<ConfigureChallengesPanel store={myDayStore.current} />);
    }

    const deviceBindingHost = dashboard.querySelector<HTMLElement>('#device-binding-root');
    if (deviceBindingHost) {
      deviceBindingRoot.current = createRoot(deviceBindingHost);
      deviceBindingRoot.current.render(<DeviceBinding user={user} mode="device" />);
      deviceBindingHost.dataset.mounted = 'true';
    }

    const deviceFirmwareActionsHost = dashboard.querySelector<HTMLElement>('#device-firmware-actions-root');
    if (deviceFirmwareActionsHost) {
      deviceFirmwareActionsRoot.current = createRoot(deviceFirmwareActionsHost);
      deviceFirmwareActionsRoot.current.render(<DeviceFirmwareActions
        onWifi={(ssid, password) => window.dispatchEvent(new CustomEvent('frost-quick-action', { detail: { type: 'wifi', ssid, password } }))}
        onUpdate={() => dispatchQuickAction('update')}
      />);
    }

    const headerControlsHost = dashboard.querySelector<HTMLElement>('#header-controls-root');
    if (headerControlsHost) {
      headerControlsRoot.current = createRoot(headerControlsHost);
      renderHeaderControls(volume, Boolean(storedDndEnabled), isDeviceConnected);
    }
    const settingsHost = dashboard.querySelector<HTMLElement>('#settings-root');
    if (settingsHost) {
      settingsRoot.current = createRoot(settingsHost);
      renderSettings(displaySeconds, isDeviceConnected);
    }

    return () => {
      headerControlsRoot.current?.unmount();
      headerControlsRoot.current = null;
      settingsRoot.current?.unmount();
      settingsRoot.current = null;
      deviceBindingRoot.current?.unmount();
      deviceBindingRoot.current = null;
      deviceFirmwareActionsRoot.current?.unmount();
      deviceFirmwareActionsRoot.current = null;
      configureClockRoot.current?.unmount();
      configureClockRoot.current = null;
      configureSideRoot.current?.unmount();
      configureSideRoot.current = null;
      configureChallengesRoot.current?.unmount();
      configureChallengesRoot.current = null;
      myDayStore.current?.dispose();
      myDayStore.current = null;
      dashboard.replaceChildren();
    };
  }, [user]);

  useEffect(() => {
    renderHeaderControls(volume, Boolean(storedDndEnabled), isDeviceConnected);
  }, [volume, storedDndEnabled, isDeviceConnected]);

  useEffect(() => {
    renderSettings(displaySeconds, isDeviceConnected);
  }, [displaySeconds, isDeviceConnected]);

  return <main ref={dashboardRef} aria-label="FROST Aura device dashboard" />;
}
