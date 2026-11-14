import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { collection, doc, getDocs, onSnapshot, query, runTransaction, serverTimestamp, Timestamp, where } from 'firebase/firestore';
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

const getLatestUserBinding = async (uid: string): Promise<DeviceBinding | null> => {
  const bindings = await getDocs(query(collection(firebaseDb, 'deviceBindings'), where('boundUid', '==', uid)));
  const latest = bindings.docs
    .map((binding) => binding.data() as DeviceBinding)
    .filter((binding): binding is DeviceBinding => Boolean(binding.macAddress))
    .sort((left, right) => (right.boundAt?.toMillis() ?? 0) - (left.boundAt?.toMillis() ?? 0))[0];

  return latest ?? null;
};

export default function DeviceBinding({ user, mode = 'home', onStateChange }: Props) {
  const [macAddress, setMacAddress] = useState('');
  const [binding, setBinding] = useState<DeviceBinding | null>(null);
  const [state, setState] = useState<BindingState>('idle');
  const [message, setMessage] = useState('');
  const [bindingBusy, setBindingBusy] = useState(false);
  const [deviceConnected, setDeviceConnected] = useState(false);
  const [isBindPromptOpen, setIsBindPromptOpen] = useState(false);
  const isBindPromptDismissed = useRef(false);
  const bindModalRef = useRef<HTMLElement>(null);
  const bindButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleConnected = (event: Event) => {
      const nextMac = (event as CustomEvent<{ macAddress: string }>).detail?.macAddress;
      if (nextMac) {
        setDeviceConnected(true);
        setMacAddress(nextMac);
        setIsBindPromptOpen(false);
        isBindPromptDismissed.current = false;
        setMessage('');
      }
    };
    const handleDisconnected = () => {
      setDeviceConnected(false);
      setMacAddress('');
      setIsBindPromptOpen(false);
      isBindPromptDismissed.current = false;
    };
    window.addEventListener('frost-device-mac', handleConnected);
    window.addEventListener('frost-device-disconnected', handleDisconnected);
    return () => { window.removeEventListener('frost-device-mac', handleConnected); window.removeEventListener('frost-device-disconnected', handleDisconnected); };
  }, []);

  useEffect(() => {
    if (!user.uid) return;

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    const applyBinding = (data: DeviceBinding | null, nextMac?: string) => {
      if (cancelled) return;
      setBinding(data);
      if (nextMac) setMacAddress(nextMac);
      if (deviceConnected && nextMac === macAddress) {
        if (data) setIsBindPromptOpen(false);
        else if (!isBindPromptDismissed.current) setIsBindPromptOpen(true);
      }
      window.dispatchEvent(new CustomEvent('frost-device-binding', {
        detail: { macAddress: data?.boundUid === user.uid ? data.macAddress : null },
      }));
      if (!data) {
        setState('unbound');
        onStateChange?.('unbound');
        return;
      }
      const nextState = data.boundUid === user.uid ? 'owned' : 'other';
      setState(nextState);
      onStateChange?.(nextState);
    };

    if (macAddress) {
      setState('loading');
      setMessage('');
      const bindingRef = doc(collection(firebaseDb, 'deviceBindings'), sanitizeMac(macAddress));
      unsubscribe = onSnapshot(bindingRef, (snapshot) => {
        if (!snapshot.exists()) { applyBinding(null, macAddress); return; }
        const data = snapshot.data() as DeviceBinding;
        applyBinding(data, macAddress);
      }, (error) => { if (cancelled) return; setState('error'); setMessage(errorText(error)); setIsBindPromptOpen(false); onStateChange?.('error'); });
      return () => {
        cancelled = true;
        unsubscribe?.();
      };
    }

    void (async () => {
      try {
        setState('loading');
        setMessage('');
        const latest = await getLatestUserBinding(user.uid);
        if (cancelled) return;
        if (!latest) {
          applyBinding(null, undefined);
          return;
        }
        setMacAddress(latest.macAddress);
        applyBinding(latest, latest.macAddress);
      } catch (error) {
        if (cancelled) return;
        setState('error');
        setMessage(errorText(error));
        onStateChange?.('error');
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [deviceConnected, macAddress, onStateChange, user.uid]);

  useEffect(() => {
    if (!isBindPromptOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    bindButtonRef.current?.focus();
    return () => previousFocus?.focus();
  }, [isBindPromptOpen]);

  const bindDevice = async () => {
    if (!macAddress || !user.email) return;
    setBindingBusy(true); setMessage('');
    const bindingRef = doc(collection(firebaseDb, 'deviceBindings'), sanitizeMac(macAddress));
    try {
      await runTransaction(firebaseDb, async (transaction) => {
        const existing = await transaction.get(bindingRef);
        if (existing.exists()) {
          const existingData = existing.data() as { boundUid?: string; boundEmail?: string };
          if (existingData.boundUid && existingData.boundUid !== user.uid) {
            throw new Error('This Frost device is linked to another account. Sign in with the registered account to sync.');
          }
          if (existingData.boundUid === user.uid) {
            transaction.set(bindingRef, { macAddress, boundEmail: user.email, boundUid: user.uid, boundAt: serverTimestamp() }, { merge: true });
            return;
          }
          throw new Error('This Frost device is linked to another account. Sign in with the registered account to sync.');
        }
        transaction.set(bindingRef, { macAddress, boundEmail: user.email, boundUid: user.uid, boundAt: serverTimestamp() });
      });
      window.dispatchEvent(new CustomEvent('frost-device-bound', { detail: { macAddress, uid: user.uid, email: user.email } }));
      setIsBindPromptOpen(false);
      isBindPromptDismissed.current = true;
    } catch (error) {
      setMessage(errorText(error));
      setState('other');
    } finally { setBindingBusy(false); }
  };

  const dismissBindPrompt = () => {
    setIsBindPromptOpen(false);
    isBindPromptDismissed.current = true;
  };
  const handleBindDialogKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismissBindPrompt();
      return;
    }
    if (event.key !== 'Tab' || !bindModalRef.current) return;
    const focusable = bindModalRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || !bindModalRef.current.contains(document.activeElement))) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || !bindModalRef.current.contains(document.activeElement))) {
      event.preventDefault();
      first?.focus();
    }
  };

  if (mode !== 'device') return null;
  return <>
    {state === 'loading' && <div className="binding-status">Checking binding…</div>}
    {state === 'error' && <div className="binding-error" role="alert">{message}</div>}
    {state === 'unbound' && <div className="binding-card"><h2>Device Binding</h2><p>This FROST device is not bound to your account yet.</p><button className="btn pri" type="button" disabled={bindingBusy} onClick={bindDevice}>{bindingBusy ? 'Binding device…' : 'Bind Device'}</button>{message && <p className="binding-error" role="alert">{message}</p>}</div>}
    {state === 'other' && <div className="binding-card" role="alert"><h2>Account mismatch</h2><p>This Frost device is linked to another account. Sign in with the registered account to sync.</p>{message && <small>{message}</small>}</div>}
    {state !== 'loading' && state !== 'error' && state !== 'unbound' && state !== 'other' && <div className="binding-details"><span className="pill ok">Binding Status: Active</span><dl><div><dt>Device</dt><dd>FROST</dd></div><div><dt>MAC Address</dt><dd>{binding?.macAddress || macAddress}</dd></div><div><dt>Bound Account</dt><dd>{binding?.boundEmail}</dd></div><div><dt>Bound Date</dt><dd>{binding?.boundAt?.toDate().toLocaleDateString() || 'Pending'}</dd></div><div><dt>Bound Time</dt><dd>{binding?.boundAt?.toDate().toLocaleTimeString() || 'Pending'}</dd></div></dl></div>}
    {isBindPromptOpen && createPortal(<div className="wifi-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) dismissBindPrompt(); }}>
      <section ref={bindModalRef} className="wifi-modal bind-modal" role="dialog" aria-modal="true" aria-labelledby="bindModalTitle" aria-describedby="bindModalDescription" onKeyDown={handleBindDialogKeyDown}>
        <div className="wifi-modal-heading">
          <h2 id="bindModalTitle">Bind your Frost device</h2>
          <button className="wifi-modal-close" type="button" onClick={dismissBindPrompt} aria-label="Close device binding prompt">×</button>
        </div>
        <button ref={bindButtonRef} className="btn pri bind-modal-button" type="button" disabled={bindingBusy} onClick={bindDevice}>{bindingBusy ? 'Binding device…' : 'Bind Device'}</button>
        <p id="bindModalDescription" className="bind-modal-description">Binding links this device to your account so your data syncs securely and only you can access it.</p>
        {message && <p className="wifi-modal-error" role="alert">{message}</p>}
        <div className="wifi-modal-actions"><button className="btn sm" type="button" onClick={dismissBindPrompt}>Later</button></div>
      </section>
    </div>, document.body)}
  </>;
}