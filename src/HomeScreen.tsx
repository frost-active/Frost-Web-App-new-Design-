import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { mountFrost } from './legacy';
import HeaderControls from './components/HeaderControls';
import DeviceFirmwareActions from './components/DeviceFirmwareActions';
import DeviceBottleControls from './components/DeviceBottleControls';
import DeviceBinding from './components/DeviceBinding';
import { ConfigureClockPanel, ConfigureSidePanel } from './pages/ConfigurePage';
import ChallengesPage from './features/challenges/ChallengesPage';
import ChallengeNotifications from './features/challenges/components/ChallengeNotifications';
import { MyDayStore } from './components/configure/store';
import type { ConfigureBridge } from './components/configure/types';
import { useDeviceConfig, useDeviceConfigHistory } from './DeviceConfigSync';
import type { User } from 'firebase/auth';

export default function HomeScreen({ user }: { user: User }) {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const headerControlsRoot = useRef<Root | null>(null);
  const bottleControlsRoot = useRef<Root | null>(null);
  const deviceBindingRoot = useRef<Root | null>(null);
  const deviceFirmwareActionsRoot = useRef<Root | null>(null);
  const configureClockRoot = useRef<Root | null>(null);
  const configureSideRoot = useRef<Root | null>(null);
  const challengesRoot = useRef<Root | null>(null);
  const notificationsRoot = useRef<Root | null>(null);
  const challengeBridge = useRef<ConfigureBridge | null>(null);
  const myDayStore = useRef<MyDayStore | null>(null);
  const [volume, setVolume] = useState(30);
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

  const dispatchQuickAction = useCallback((type: 'volume' | 'wifi' | 'dnd' | 'update', value?: number) => {
    window.dispatchEvent(new CustomEvent('frost-quick-action', { detail: { type, ...(value === undefined ? {} : { value }) } }));
  }, []);

  const renderHeaderControls = useCallback((currentVolume: number, currentDndEnabled: boolean, deviceConnected: boolean) => headerControlsRoot.current?.render(
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
  ), [dispatchQuickAction]);

  const renderBottleControls = useCallback((deviceConnected: boolean) => bottleControlsRoot.current?.render(
    <DeviceBottleControls isDeviceConnected={deviceConnected} />,
  ), []);

  useEffect(() => {
    const dashboard = dashboardRef.current;
    if (!dashboard) return;

    const configureBridge = mountFrost(dashboard, user) as ConfigureBridge;
    challengeBridge.current = configureBridge;

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
    const challengesHost = dashboard.querySelector<HTMLElement>('#challenges-root');
    if (challengesHost) {
      challengesRoot.current = createRoot(challengesHost);
    }
    const notificationsHost = dashboard.querySelector<HTMLElement>('#challenge-notifications-root');
    if (notificationsHost) {
      notificationsRoot.current = createRoot(notificationsHost);
    }

    const deviceBindingHost = dashboard.querySelector<HTMLElement>('#device-binding-root');
    if (deviceBindingHost) {
      deviceBindingRoot.current = createRoot(deviceBindingHost);
      deviceBindingRoot.current.render(<DeviceBinding user={user} mode="device" />);
      deviceBindingHost.dataset.mounted = 'true';
    }

    const bottleControlsHost = dashboard.querySelector<HTMLElement>('#device-bottle-controls-root');
    if (bottleControlsHost) {
      bottleControlsRoot.current = createRoot(bottleControlsHost);
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
    }
    return () => {
      headerControlsRoot.current?.unmount();
      headerControlsRoot.current = null;
      bottleControlsRoot.current?.unmount();
      bottleControlsRoot.current = null;
      deviceBindingRoot.current?.unmount();
      deviceBindingRoot.current = null;
      deviceFirmwareActionsRoot.current?.unmount();
      deviceFirmwareActionsRoot.current = null;
      configureClockRoot.current?.unmount();
      configureClockRoot.current = null;
      configureSideRoot.current?.unmount();
      configureSideRoot.current = null;
      challengesRoot.current?.unmount();
      challengesRoot.current = null;
      notificationsRoot.current?.unmount();
      notificationsRoot.current = null;
      challengeBridge.current = null;
      myDayStore.current?.dispose();
      myDayStore.current = null;
      dashboard.replaceChildren();
    };
  }, [user, dispatchQuickAction]);

  useEffect(() => {
    if (!challengesRoot.current || !challengeBridge.current) return;
    challengesRoot.current.render(<ChallengesPage user={user} deviceConnected={isDeviceConnected} deviceMac={macAddress} bridge={challengeBridge.current} />);
  }, [user, isDeviceConnected, macAddress, storedDeviceConfig]);

  useEffect(() => {
    if (!notificationsRoot.current || !challengeBridge.current) return;
    notificationsRoot.current.render(<ChallengeNotifications user={user} deviceConnected={isDeviceConnected} deviceMac={macAddress} bridge={challengeBridge.current} />);
  }, [user, isDeviceConnected, macAddress, storedDeviceConfig]);

  useEffect(() => {
    renderHeaderControls(volume, Boolean(storedDndEnabled), isDeviceConnected);
  }, [volume, storedDndEnabled, isDeviceConnected, renderHeaderControls]);

  useEffect(() => {
    renderBottleControls(isDeviceConnected);
  }, [isDeviceConnected, renderBottleControls]);

  return <main ref={dashboardRef} aria-label="FROST Aura device dashboard" />;
}
