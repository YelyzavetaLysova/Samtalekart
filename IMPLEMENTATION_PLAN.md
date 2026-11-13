# Implementation plan

## Stage 1: interaction foundation

The first stage tests the complete activity flow without depending on speech recognition or an external language model. The system must be understandable before the automated components are added.

Acceptance criteria:

1. A teacher can create an activity in less than one minute.
2. Participants can join from a QR link without an account.
3. Automatic grouping creates balanced groups.
4. Manual grouping remains possible.
5. Each participant can identify the correct physical group.
6. The teacher can see who confirmed their group.
7. Participants understand the calibration instruction without an explanation.
8. Participants can open and close private support.
9. The teacher can end all sessions.
10. Feedback is unavailable until the activity ends.

## Stage 2: persistence

Move activities, participants, group membership, conversation maps and feedback to PostgreSQL. Add database migrations and recovery after backend restarts.

## Stage 3: realtime audio

Enable LiveKit in publish-only mode for learners. Each browser publishes one labelled microphone track. Learner devices do not subscribe to the other audio tracks. A server worker subscribes to every track in one group.

## Stage 4: speaker and channel selection

Add sequential calibration, clock alignment, voice activity detection and channel scoring. Select one microphone for each utterance before paid transcription. Keep raw audio handling independent from the speech provider.

## Stage 5: Norwegian speech recognition

Implement a common speech-provider interface. Compare Azure Speech and Deepgram using the same learner recordings. Select the provider based on recognition quality, latency and cost.

## Stage 6: conversation support

Maintain a short rolling conversation state. Use structured model responses to propose small map patches rather than regenerating the full map. Keep shared map updates separate from private help.

## Stage 7: post-session feedback

When the teacher ends the activity, stop microphones and generate short private feedback for the part of the conversation in which each learner participated.

