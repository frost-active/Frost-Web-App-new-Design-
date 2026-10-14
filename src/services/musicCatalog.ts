export type MusicCategory = 'pomodoro' | 'meditation' | 'healing';
export type MusicTrack = { music: string; music_id: number };

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export async function fetchMusicCatalog(): Promise<MusicTrack[]> {
  const csvUrl = import.meta.env.VITE_MUSIC_SHEET_CSV_URL?.trim();
  if (!csvUrl) {
    throw new Error('Music sheet is not configured. Set VITE_MUSIC_SHEET_CSV_URL and restart the app.');
  }

  const response = await fetch(csvUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Music sheet request failed (${response.status}).`);

  const [headerRow, ...dataRows] = parseCsvRows(await response.text());
  if (!headerRow) throw new Error('Music sheet is empty or does not contain a header row.');

  const headers = headerRow.map((header) => header.replace(/^\uFEFF/, '').trim().toLowerCase().replace(/\s+/g, '_'));
  const musicIndex = headers.indexOf('music');
  const idIndex = headers.indexOf('music_id');
  if (musicIndex < 0 || idIndex < 0) {
    throw new Error('Music sheet must have music and music id columns.');
  }

  const tracks: MusicTrack[] = [];
  const seenRows = new Set<string>();
  dataRows.forEach((dataRow) => {
    const music = dataRow[musicIndex]?.trim() ?? '';
    const musicIdText = dataRow[idIndex]?.trim() ?? '';
    const musicId = Number(musicIdText);
    const rowKey = `${musicId}\u0000${music}`;
    if (music && musicIdText && Number.isSafeInteger(musicId) && musicId >= 0 && !seenRows.has(rowKey)) {
      seenRows.add(rowKey);
      tracks.push({ music, music_id: musicId });
    }
  });

  return tracks.sort((left, right) =>
    left.music.localeCompare(right.music, undefined, { sensitivity: 'base' }) || left.music_id - right.music_id);
}