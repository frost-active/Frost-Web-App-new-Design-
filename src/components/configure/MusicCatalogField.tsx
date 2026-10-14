import { useEffect, useRef, useState } from 'react';
import { fetchMusicCatalog, type MusicTrack } from '../../services/musicCatalog';
import { cn } from './format';

type Props = {
  category: 'pomodoro' | 'meditation' | 'healing';
  selectedTrackIds: number[];
  onChange: (trackIds: number[]) => void;
};

export default function MusicCatalogField({ category, selectedTrackIds, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [tracks, setTracks] = useState<MusicTrack[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const requestId = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestId.current += 1;
    };
  }, []);

  const loadTracks = async () => {
    const activeRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const catalog = await fetchMusicCatalog();
      if (mounted.current && activeRequest === requestId.current) setTracks(catalog);
    } catch (cause) {
      if (mounted.current && activeRequest === requestId.current) {
        setError(cause instanceof Error ? cause.message : 'Unable to load music. Please try again.');
      }
    } finally {
      if (mounted.current && activeRequest === requestId.current) setLoading(false);
    }
  };

  const toggleLibrary = () => {
    const shouldOpen = !open;
    setOpen(shouldOpen);
    if (shouldOpen) void loadTracks();
  };

  const toggleTrack = (musicId: number) => {
    onChange(selectedTrackIds.includes(musicId)
      ? selectedTrackIds.filter((id) => id !== musicId)
      : [...selectedTrackIds, musicId]);
  };

  const missingIds = tracks
    ? selectedTrackIds.filter((id) => !tracks.some((track) => track.music_id === id))
    : [];
  const selectedMusicNames = tracks
    ? selectedTrackIds.map((id) => tracks.find((track) => track.music_id === id)?.music ?? 'Unavailable track').join(', ') || '----'
    : selectedTrackIds.length ? (error ? 'Unavailable track' : 'Loading...') : '----';

  return (
    <div className={cn('msec')}>
      <div className={cn('mlabel')}><span>Device music</span></div>
      <button type="button" className={`${cn('btn')} ${cn('music-toggle')}`} aria-expanded={open} onClick={toggleLibrary}>
        {open ? 'Hide Music Library' : 'Music Library'} · {selectedTrackIds.length} selected
      </button>
      <p className={cn('music-selected-name')} aria-live="polite">Selected Music Name: <b>{selectedMusicNames}</b></p>
      {open && (
        <div className={cn('music-catalog')}>
          <div className={cn('music-catalog-heading')}>
            <span>Music Library</span>
            <div>
              <button type="button" className={cn('btn sm')} disabled={loading} onClick={() => void loadTracks()}>Refresh</button>
              <button type="button" className={cn('btn sm')} onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
          {error && <p className={cn('music-catalog-error')} role="alert">{error}</p>}
          <div className={cn('music-catalog-list')} aria-live="polite" aria-busy={loading}>
            {loading ? (
              <div className={cn('music-catalog-state')} role="status"><span className={cn('spinner')} aria-hidden="true" /> Loading music...</div>
            ) : error ? (
              <div className={cn('music-catalog-state')}>Could not load the sheet music list.</div>
            ) : tracks?.length ? (
              <>
                {missingIds.map((musicId) => (
                  <label key={`missing-${musicId}`} className={cn('music-track')}>
                    <input type="checkbox" checked onChange={() => toggleTrack(musicId)} />
                    <span className={cn('music-track-name')}>Unavailable track</span>
                  </label>
                ))}
                {tracks.map((track) => (
                  <label key={`${track.music_id}-${track.music}`} className={cn('music-track')}>
                    <input type="checkbox" checked={selectedTrackIds.includes(track.music_id)} onChange={() => toggleTrack(track.music_id)} />
                    <span className={cn('music-track-name')}>{track.music}</span>
                  </label>
                ))}
              </>
            ) : (
              <div className={cn('music-catalog-state')}>{tracks ? 'No valid music rows found.' : 'Open the library to load music.'}</div>
            )}
          </div>
          <p className={cn('music-catalog-count')}>{category[0].toUpperCase() + category.slice(1)} · Selected: {selectedTrackIds.length}</p>
        </div>
      )}
    </div>
  );
}