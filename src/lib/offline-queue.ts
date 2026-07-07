import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';

const QUEUE_KEY = 'whale-app/pending-sightings';
const UNIQUE_VIOLATION = '23505';

export type PendingSighting = {
  clientId: string;
  userId: string;
  speciesId: number | null;
  latitude: number;
  longitude: number;
  sightedAt: string;
  notes: string | null;
  photoUri: string | null;
  status: 'pending' | 'synced';
};

async function readQueue(): Promise<PendingSighting[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? (JSON.parse(raw) as PendingSighting[]) : [];
}

async function writeQueue(queue: PendingSighting[]) {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function addPendingSighting(sighting: Omit<PendingSighting, 'status'>) {
  const queue = await readQueue();
  queue.push({ ...sighting, status: 'pending' });
  await writeQueue(queue);
}

export async function getPendingSightings() {
  const queue = await readQueue();
  return queue.filter((item) => item.status === 'pending');
}

async function markSynced(clientId: string) {
  const queue = await readQueue();
  const updated = queue.map((item) =>
    item.clientId === clientId ? { ...item, status: 'synced' as const } : item,
  );
  await writeQueue(updated);
}

// Uploads a sighting straight to Supabase. Used both for the initial "online"
// save attempt and for syncing items out of the local queue later.
export async function submitSighting(sighting: Omit<PendingSighting, 'status'>) {
  let photoUrl: string | null = null;

  if (sighting.photoUri) {
    const photoResponse = await fetch(sighting.photoUri);
    const photoData = await photoResponse.arrayBuffer();
    const photoPath = `${sighting.userId}/${sighting.clientId}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('sighting-photos')
      .upload(photoPath, photoData, { contentType: 'image/jpeg', upsert: true });
    if (uploadError) {
      throw uploadError;
    }

    photoUrl = supabase.storage.from('sighting-photos').getPublicUrl(photoPath).data.publicUrl;
  }

  const { error: insertError } = await supabase.from('sightings').insert({
    user_id: sighting.userId,
    species_id: sighting.speciesId,
    latitude: sighting.latitude,
    longitude: sighting.longitude,
    sighted_at: sighting.sightedAt,
    notes: sighting.notes,
    photo_url: photoUrl,
    client_id: sighting.clientId,
  });

  // A unique-constraint hit on client_id means this exact sighting already
  // reached the server on an earlier attempt — treat that as success rather
  // than retrying forever.
  if (insertError && insertError.code !== UNIQUE_VIOLATION) {
    throw insertError;
  }
}

let syncing = false;

export async function syncPendingSightings() {
  if (syncing) {
    return;
  }
  syncing = true;

  try {
    const pending = await getPendingSightings();
    for (const sighting of pending) {
      try {
        await submitSighting(sighting);
        await markSynced(sighting.clientId);
      } catch {
        // Leave it pending — the next sync pass (reconnect or app start) will retry.
      }
    }
  } finally {
    syncing = false;
  }
}
