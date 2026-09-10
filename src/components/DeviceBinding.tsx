import { useEffect, useState } from 'react';
import { collection, doc, onSnapshot, runTransaction, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { firebaseDb } from '../firebase';

export interface DeviceBinding {
  macAddress: string;
  boundEmail: string;
  boundAt: Timestamp | null;
  boundUid: string;
}

type BindingState = 'idle' | 'loading' | 'unbound' | 'owned' | 'other' | 'error';
type Props = { user: User; mode?: 'home' | 'device'; onStateChange?: (state: BindingState) => void };

export const sanitizeMac = (macAddress: string) => macAddress.replace(/:/g, '-');
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Unable to read device binding.';

export default function DeviceBinding({ user, mode = 'home', onStateChange }: Props) {
  const [macAddress, setMacAddress] = useState('');
  const [binding, setBinding] = useState<DeviceBinding | null>(null);
  const [state, setState] = useState<BindingState>('idle');
  const [message, setMessage] = useState('');
  const [bindingBusy, setBindingBusy] = useState(false);

  useEffect(() => {
    const handleConnected = (event: Event) => {
      const nextMac = (event as CustomEvent<{ macAddress: string }>).detail?.macAddress;
      if (nextMac) setMacAddress(nextMac);
    };
    const handleDisconnected = () => { setMacAddress(''); setBinding(null); setState('idle'); };
    window.addEventListener('frost-device-mac', handleConnected);
    window.addEventListener('frost-device-disconnected', handleDisconnected);
    return () => { window.removeEventListener('frost-device-mac', handleConnected); window.removeEventListener('frost-device-disconnected', handleDisconnected); };
  }, []);

  useEffect(() => {
    if (!macAddress) { setState('idle'); return; }
    setState('loading'); setMessage('');
    const bindingRef = doc(collection(firebaseDb, 'deviceBindings'), sanitizeMac(macAddress));
    return onSnapshot(bindingRef, (snapshot) => {
      if (!snapshot.exists()) { setBinding(null); setState('unbound'); onStateChange?.('unbound'); return; }
      const data = snapshot.data() as DeviceBinding;
      setBinding(data);
      const nextState = data.boundUid === user.uid ? 'owned' : 'other';
      setState(nextState); onStateChange?.(nextState);
    }, (error) => { setState('error'); setMessage(errorText(error)); onStateChange?.('error'); });
  }, [macAddress, onStateChange, user.uid]);

  const bindDevice = async () => {
    if (!macAddress || !user.email) return;
    setBindingBusy(true); setMessage('');
    const bindingRef = doc(collection(firebaseDb, 'deviceBindings'), sanitizeMac(macAddress));
    try {
      await runTransaction(firebaseDb, async (transaction) => {
        const existing = await transaction.get(bindingRef);
        if (existing.exists()) throw new Error('This device was bound by another account.');
        transaction.set(bindingRef, { macAddress, boundEmail: user.email, boundUid: user.uid, boundAt: serverTimestamp() });
      });
    } catch (error) {
      setMessage(errorText(error));
      setState('other');
    } finally { setBindingBusy(false); }
  };

  if (mode !== 'device') return null;
  if (!macAddress || state === 'idle' || state === 'loading') return <div className="binding-status">{state === 'loading' ? 'Checking binding…' : 'Connect a device to view binding.'}</div>;
  if (state === 'error') return <div className="binding-error" role="alert">{message}</div>;
  if (state === 'unbound') return <div className="binding-card"><h2>Device Binding</h2><p>This FROST device is not bound to an account.</p><button className="btn pri" type="button" disabled={bindingBusy} onClick={bindDevice}>{bindingBusy ? 'Binding device…' : 'Bind Device'}</button>{message && <p className="binding-error" role="alert">{message}</p>}</div>;
  if (state === 'other') return <div className="binding-card" role="alert"><h2>Device unavailable</h2><p>This device is already registered to another account. Please contact support if you believe this is a mistake.</p>{message && <small>{message}</small>}</div>;
  return <div className="binding-details"><span className="pill ok">Binding Status: Active</span><dl><div><dt>Device</dt><dd>FROST</dd></div><div><dt>MAC Address</dt><dd>{binding?.macAddress || macAddress}</dd></div><div><dt>Bound Account</dt><dd>{binding?.boundEmail}</dd></div><div><dt>Bound Date</dt><dd>{binding?.boundAt?.toDate().toLocaleDateString() || 'Pending'}</dd></div><div><dt>Bound Time</dt><dd>{binding?.boundAt?.toDate().toLocaleTimeString() || 'Pending'}</dd></div></dl></div>;
}