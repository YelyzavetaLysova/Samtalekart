import { Room, RoomEvent } from "livekit-client";

let room: Room | null = null;

export async function testMicrophone(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
  });
  stream.getTracks().forEach((track) => track.stop());
}

export async function connectAudio(url: string, token: string): Promise<Room> {
  if (room) return room;
  room = new Room({
    adaptiveStream: true,
    dynacast: true,
  });
  room.on(RoomEvent.Disconnected, () => {
    room = null;
  });
  await room.connect(url, token, { autoSubscribe: false });
  await room.localParticipant.setMicrophoneEnabled(true);
  return room;
}

export async function disconnectAudio(): Promise<void> {
  if (!room) return;
  await room.localParticipant.setMicrophoneEnabled(false);
  room.disconnect();
  room = null;
}

