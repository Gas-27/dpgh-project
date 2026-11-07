import { supabase } from '@/integrations/supabase/client';

export type TrainingVideoRole = 'agent' | 'subagent' | 'subsubagent';

export interface TrainingVideo {
  id: string;
  title: string;
  url: string;
}

const SLOTS = [1, 2, 3] as const;

const clean = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

export const selectTrainingVideoColumns = (): string =>
  (['agent', 'subagent', 'subsubagent'] as const)
    .flatMap((role) => SLOTS.map((n) => `${role}_video_${n}_title, ${role}_video_${n}_url`))
    .join(', ');

// afa_settings can hold several rows (older/empty ones included), so each slot
// takes the first non-empty value from the newest row backwards instead of
// relying on a single arbitrary row.
export const mergeTrainingVideoRows = (
  rows: Record<string, unknown>[],
  role: TrainingVideoRole
): TrainingVideo[] => {
  const videos: TrainingVideo[] = [];
  for (const n of SLOTS) {
    for (const row of rows) {
      const url = clean(row[`${role}_video_${n}_url`]);
      if (url) {
        videos.push({
          id: String(n),
          title: clean(row[`${role}_video_${n}_title`]) || `Video ${n}`,
          url,
        });
        break;
      }
    }
  }
  return videos;
};

export const fetchTrainingVideoRows = async (): Promise<Record<string, unknown>[]> => {
  const { data, error } = await supabase
    .from('afa_settings')
    .select(`id, ${selectTrainingVideoColumns()}`)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as unknown as Record<string, unknown>[];
};

export const fetchTrainingVideos = async (role: TrainingVideoRole): Promise<TrainingVideo[]> =>
  mergeTrainingVideoRows(await fetchTrainingVideoRows(), role);

export const getYouTubeEmbedUrl = (url: string | null | undefined): string | null => {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?(?:[^#]*&)?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtube\.com\/live\/)([A-Za-z0-9_-]{11})/,
    /^([A-Za-z0-9_-]{11})$/,
  ];
  for (const pattern of patterns) {
    const match = url.trim().match(pattern);
    if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`;
  }
  return null;
};
