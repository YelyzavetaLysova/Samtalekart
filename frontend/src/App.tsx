import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";

import { ConversationMap } from "./components/ConversationMap";
import { connectAudio, disconnectAudio, testMicrophone } from "./lib/audio";
import { activityWebSocket, api } from "./lib/api";
import { clearParticipantSession, loadParticipantSession, saveParticipantSession } from "./lib/session";
import type { Activity, Group, MapNodeData, Participant, ParticipantSession } from "./types";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header">
        <Link to="/" className="brand"><span>S</span>Samtalekart</Link>
        <small>Støtte for samtaler i små grupper</small>
      </header>
      <main>{children}</main>
    </div>
  );
}

function ErrorNotice({ error }: { error: string | null }) {
  return error ? <div className="error-notice" role="alert">{error}</div> : null;
}

function Home() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  return (
    <Shell>
      <section className="home-card">
        <p className="eyebrow">Norsktrening</p>
        <h1>Snakk sammen. Få hjelp når du trenger det.</h1>
        <p>Åpne en aktivitet fra læreren, finn gruppen din og bruk samtalekartet under samtalen.</p>
        <form className="join-inline" onSubmit={(event) => {
          event.preventDefault();
          if (code.trim()) navigate(`/join/${code.trim().toUpperCase()}`);
        }}>
          <label>
            Aktivitetskode
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="ABC123" maxLength={6} />
          </label>
          <button className="primary" type="submit">Bli med</button>
        </form>
        <div className="home-divider"><span>eller</span></div>
        <Link className="text-link" to="/teacher">Opprett en aktivitet</Link>
      </section>
    </Shell>
  );
}

function useActivity(code: string | undefined, initial?: Activity | null) {
  const [activity, setActivity] = useState<Activity | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    api.activity(code).then(setActivity).catch((reason) => setError(reason.message));
    const socket = activityWebSocket(code);
    socket.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.activity) setActivity(payload.activity);
    };
    return () => socket.close();
  }, [code]);

  return { activity, setActivity, error, setError };
}

function Teacher() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("Planlegg en aktivitet for nye deltakere i kommunen");
  const [level, setLevel] = useState("A2");
  const [mode, setMode] = useState<"automatic" | "manual">("automatic");
  const [groupSize, setGroupSize] = useState(4);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.createActivity({
        topic,
        language_level: level,
        grouping_mode: mode,
        target_group_size: groupSize,
      });
      localStorage.setItem(`samtalekart.host.${result.activity.join_code}`, result.host_token);
      navigate(`/teacher/${result.activity.join_code}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunne ikke opprette aktiviteten");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <section className="panel narrow">
        <p className="eyebrow">For lærer</p>
        <h1>Opprett samtaleaktivitet</h1>
        <p className="lead">Skriv bare det deltakerne skal snakke om. Resten kan justeres senere.</p>
        <ErrorNotice error={error} />
        <form className="stack-form" onSubmit={create}>
          <label>
            Oppgave eller tema
            <textarea value={topic} onChange={(event) => setTopic(event.target.value)} rows={4} />
          </label>
          <div className="form-grid">
            <label>
              Omtrent nivå
              <select value={level} onChange={(event) => setLevel(event.target.value)}>
                <option>A1</option><option>A2</option><option>B1</option>
              </select>
            </label>
            <label>
              Grupper
              <select value={mode} onChange={(event) => setMode(event.target.value as "automatic" | "manual")}>
                <option value="automatic">Automatisk</option>
                <option value="manual">Manuelt</option>
              </select>
            </label>
          </div>
          {mode === "automatic" && (
            <label>
              Ønsket gruppestørrelse
              <select value={groupSize} onChange={(event) => setGroupSize(Number(event.target.value))}>
                <option value={3}>3 personer</option>
                <option value={4}>4 personer</option>
                <option value={5}>5 personer</option>
              </select>
            </label>
          )}
          <button className="primary wide" disabled={busy} type="submit">{busy ? "Oppretter ..." : "Opprett aktivitet"}</button>
        </form>
      </section>
    </Shell>
  );
}

function statusLabel(status: Participant["status"]) {
  return {
    joined: "I lobbyen",
    grouped: "Finner gruppen",
    confirmed: "Med gruppen",
    calibrated: "Klar",
    left: "Har forlatt",
  }[status];
}

function TeacherDashboard() {
  const { code } = useParams();
  const { activity, setActivity, error, setError } = useActivity(code);
  const [manual, setManual] = useState<Record<string, number>>({});
  const hostToken = code ? localStorage.getItem(`samtalekart.host.${code}`) ?? "" : "";
  const joinUrl = code ? `${window.location.origin}/join/${code}` : "";

  useEffect(() => {
    if (!activity) return;
    const next: Record<string, number> = {};
    activity.participants.forEach((participant) => {
      const group = activity.groups.find((item) => item.id === participant.group_id);
      next[participant.id] = group?.number ?? 1;
    });
    setManual(next);
  }, [activity?.groups.length]);

  if (!code) return <Navigate to="/teacher" replace />;
  if (!activity) return <Shell><div className="loading">Laster aktiviteten ...</div><ErrorNotice error={error} /></Shell>;

  async function run(action: () => Promise<Activity>) {
    try {
      setError(null);
      setActivity(await action());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Noe gikk galt");
    }
  }

  const groupNumbers = Array.from(new Set(Object.values(manual))).sort();

  async function saveManual() {
    const numbers = groupNumbers.length ? groupNumbers : [1];
    const groups = numbers.map((number) => activity!.participants
      .filter((participant) => participant.status !== "left" && (manual[participant.id] ?? 1) === number)
      .map((participant) => participant.id));
    await run(() => api.manualGroups(code!, hostToken, groups));
  }

  return (
    <Shell>
      <section className="teacher-dashboard">
        <div className="dashboard-title">
          <div>
            <p className="eyebrow">Aktivitet {activity.join_code}</p>
            <h1>{activity.topic}</h1>
            <p>{activity.language_level} · {activity.participants.filter((p) => p.status !== "left").length} deltakere</p>
          </div>
          <span className={`status-pill ${activity.status}`}>{activity.status === "lobby" ? "Lobby" : activity.status === "active" ? "Pågår" : "Avsluttet"}</span>
        </div>
        <ErrorNotice error={error} />

        <div className="teacher-grid">
          <section className="panel qr-panel">
            <h2>1. Bli med</h2>
            <QRCodeSVG value={joinUrl} size={180} bgColor="#ffffff" fgColor="#18332b" />
            <strong>{activity.join_code}</strong>
            <small>Skann QR-koden eller skriv inn koden.</small>
            <button className="secondary" onClick={() => navigator.clipboard.writeText(joinUrl)}>Kopier lenke</button>
          </section>

          <section className="panel participants-panel">
            <div className="section-title"><div><h2>2. Deltakere</h2><p>Listen oppdateres automatisk.</p></div></div>
            {activity.participants.length === 0 && <div className="empty-state">Ingen har blitt med ennå.</div>}
            <div className="participant-list">
              {activity.participants.map((participant) => (
                <div className={`participant-row ${participant.status}`} key={participant.id}>
                  <span className="avatar">{participant.nickname.charAt(0).toUpperCase()}</span>
                  <div><strong>{participant.nickname}</strong><small>{statusLabel(participant.status)}</small></div>
                  {activity.grouping_mode === "manual" && activity.status === "lobby" && (
                    <select value={manual[participant.id] ?? 1} onChange={(event) => setManual((current) => ({ ...current, [participant.id]: Number(event.target.value) }))}>
                      {[1, 2, 3, 4, 5, 6].map((number) => <option key={number} value={number}>Gruppe {number}</option>)}
                    </select>
                  )}
                </div>
              ))}
            </div>
            {activity.status === "lobby" && activity.participants.length > 0 && (
              activity.grouping_mode === "automatic"
                ? <button className="secondary wide" onClick={() => run(() => api.autoGroups(code, hostToken))}>Fordel i grupper</button>
                : <button className="secondary wide" onClick={saveManual}>Lagre grupper</button>
            )}
          </section>
        </div>

        {activity.groups.length > 0 && (
          <section className="panel groups-panel">
            <div className="section-title"><div><h2>3. Grupper</h2><p>Deltakerne bekrefter når de har funnet hverandre.</p></div></div>
            <div className="group-cards">
              {activity.groups.map((group) => <GroupCard key={group.id} group={group} participants={activity.participants} />)}
            </div>
          </section>
        )}

        <section className="teacher-actions">
          {activity.status === "lobby" && (
            <button className="primary" onClick={() => run(() => api.start(code, hostToken))}>Start samtalene</button>
          )}
          {activity.status === "active" && (
            <>
              <button className="secondary" onClick={async () => {
                const first = activity.groups[0];
                if (first) await api.suggestMap(first.id, "Vi må tenke på buss og transport hvis det regner");
              }}>Demo: oppdater kartet</button>
              <button className="danger" onClick={() => run(() => api.end(code, hostToken))}>Avslutt alle samtaler</button>
            </>
          )}
        </section>
      </section>
    </Shell>
  );
}

function GroupCard({ group, participants }: { group: Group; participants: Participant[] }) {
  const members = group.participant_ids.map((id) => participants.find((item) => item.id === id)).filter(Boolean) as Participant[];
  return (
    <article className="group-card">
      <div><strong>Gruppe {group.number}</strong><span>{members.filter((p) => ["confirmed", "calibrated"].includes(p.status)).length}/{members.length} bekreftet</span></div>
      <ul>{members.map((participant) => <li key={participant.id}><span>{participant.nickname}</span><small>{statusLabel(participant.status)}</small></li>)}</ul>
    </article>
  );
}

function ParticipantPage() {
  const { code } = useParams();
  const stored = loadParticipantSession();
  const [session, setSession] = useState<ParticipantSession | null>(stored?.activityCode === code ? stored : null);
  const { activity, setActivity, error, setError } = useActivity(code);
  const [nickname, setNickname] = useState("");
  const [calibrationBusy, setCalibrationBusy] = useState(false);

  if (!code) return <Navigate to="/" replace />;

  const currentParticipant = activity?.participants.find((item) => item.id === session?.participant.id) ?? session?.participant;
  const currentGroup = activity?.groups.find((item) => item.id === currentParticipant?.group_id) ?? null;

  async function join(event: React.FormEvent) {
    event.preventDefault();
    try {
      const result = await api.join(code!, nickname);
      const next = { participant: result.participant, activityCode: code! };
      saveParticipantSession(next);
      setSession(next);
      setActivity(result.activity);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunne ikke bli med");
    }
  }

  if (!activity) return <Shell><div className="loading">Finner aktiviteten ...</div><ErrorNotice error={error} /></Shell>;

  if (!session || !currentParticipant) {
    return (
      <Shell>
        <section className="phone-page centered">
          <div className="participant-card">
            <p className="eyebrow">Aktivitet {activity.join_code}</p>
            <h1>{activity.topic}</h1>
            <form className="stack-form" onSubmit={join}>
              <label>Hva skal vi kalle deg?<input autoFocus value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Fornavn eller kallenavn" /></label>
              <button className="primary wide" type="submit">Bli med</button>
            </form>
            <ErrorNotice error={error} />
          </div>
        </section>
      </Shell>
    );
  }

  if (currentParticipant.status === "left") {
    return (
      <Shell><section className="phone-page centered"><div className="participant-card">
        <h1>Du har forlatt samtalen</h1>
        <p>Du kan åpne aktivitetslenken på nytt hvis du vil bli med igjen.</p>
        <button className="primary wide" onClick={() => { clearParticipantSession(); window.location.reload(); }}>Bli med på nytt</button>
      </div></section></Shell>
    );
  }

  if (!currentGroup) {
    return <WaitingScreen title="Du er med" text="Vent mens læreren lager gruppene." activity={activity} />;
  }

  if (currentParticipant.status === "grouped") {
    const members = currentGroup.participant_ids.map((id) => activity.participants.find((p) => p.id === id)).filter(Boolean) as Participant[];
    return (
      <Shell><section className="phone-page centered"><div className="participant-card">
        <p className="eyebrow">Finn gruppen din</p><h1>Gruppe {currentGroup.number}</h1>
        <p>Sett deg sammen med disse deltakerne:</p>
        <ul className="member-list">{members.map((member) => <li key={member.id}>{member.nickname}</li>)}</ul>
        <button className="primary wide" onClick={async () => {
          try { setActivity(await api.confirm(session)); } catch (reason) { setError(reason instanceof Error ? reason.message : "Kunne ikke bekrefte"); }
        }}>Jeg er sammen med gruppen</button>
        <ErrorNotice error={error} />
      </div></section></Shell>
    );
  }

  if (activity.status === "lobby") {
    return <WaitingScreen title="Gruppen er klar" text="Vent til læreren starter samtalen." activity={activity} />;
  }

  if (activity.status === "ended") {
    return <Reflection activity={activity} session={session} />;
  }

  if (currentParticipant.status !== "calibrated") {
    return (
      <Shell><section className="phone-page centered"><div className="participant-card calibration-card">
        <p className="eyebrow">Lydsjekk</p><h1>Les teksten høyt</h1>
        <p className="instruction">Hold telefonen slik du vil ha den under samtalen. Les rolig og tydelig.</p>
        <blockquote>Vi skal snakke om {activity.topic.toLowerCase()}. Jeg vil lytte til de andre og forklare hva jeg mener.</blockquote>
        <button className="primary wide" disabled={calibrationBusy} onClick={async () => {
          setCalibrationBusy(true);
          try {
            await testMicrophone();
            setActivity(await api.calibrated(session));
          } catch {
            setError("Nettleseren fikk ikke tilgang til mikrofonen. Kontroller tillatelsen og prøv igjen.");
          } finally {
            setCalibrationBusy(false);
          }
        }}>{calibrationBusy ? "Sjekker mikrofonen ..." : "Start lydsjekk"}</button>
        <ErrorNotice error={error} />
      </div></section></Shell>
    );
  }

  return <Conversation activity={activity} group={currentGroup} session={session} setActivity={setActivity} />;
}

function WaitingScreen({ title, text, activity }: { title: string; text: string; activity: Activity }) {
  return (
    <Shell><section className="phone-page centered"><div className="participant-card waiting-card">
      <div className="waiting-pulse"><span /><span /><span /></div>
      <p className="eyebrow">{activity.join_code}</p><h1>{title}</h1><p>{text}</p>
    </div></section></Shell>
  );
}

function Conversation({ activity, group, session, setActivity }: {
  activity: Activity;
  group: Group;
  session: ParticipantSession;
  setActivity: (value: Activity) => void;
}) {
  const [selectedNode, setSelectedNode] = useState<MapNodeData | null>(null);
  const [help, setHelp] = useState<{ type: "say" | "understand"; level: number; max: number; text: string } | null>(null);
  const [audioStatus, setAudioStatus] = useState<"connecting" | "mock" | "connected" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.liveKitToken(session).then(async (result) => {
      if (!active) return;
      if (result.mock || !result.token) {
        setAudioStatus("mock");
        return;
      }
      await connectAudio(result.url, result.token);
      if (active) setAudioStatus("connected");
    }).catch(() => setAudioStatus("error"));
    return () => {
      active = false;
      void disconnectAudio();
    };
  }, [session.participant.id]);

  async function requestHelp(type: "say" | "understand", nextLevel = 1) {
    try {
      const result = type === "say"
        ? await api.helpSay(group.id, session.participant.id, selectedNode?.id ?? null, nextLevel)
        : await api.helpUnderstand(group.id, session.participant.id, nextLevel);
      setHelp({ type, level: result.level, max: result.max_level, text: result.text });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunne ikke hente hjelp");
    }
  }

  return (
    <Shell>
      <section className="conversation-page">
        <header className="conversation-header">
          <div><small>Gruppe {group.number}</small><h1>{activity.topic}</h1></div>
          <div className={`listening-indicator ${audioStatus}`}><span />{audioStatus === "connected" ? "Lytter" : audioStatus === "mock" ? "Demomodus" : audioStatus === "error" ? "Ingen lyd" : "Kobler til"}</div>
        </header>
        <ErrorNotice error={error} />
        <div className="conversation-layout">
          <section className="map-panel">
            <div className="section-title"><div><h2>Samtalekart</h2><p>Velg en gren hvis du trenger ord eller en ny retning.</p></div><span>v{group.map.version}</span></div>
            <ConversationMap map={group.map} selectedNode={selectedNode?.id ?? null} onSelect={setSelectedNode} />
          </section>
          <aside className="conversation-side">
            {selectedNode ? (
              <section className="language-support">
                <div className="support-heading"><small>Valgt tema</small><h2>{selectedNode.label}</h2></div>
                <p className="support-question">{selectedNode.question}</p>
                <div><strong>Ord</strong><div className="chips">{selectedNode.words.map((word) => <span key={word}>{word}</span>)}</div></div>
                <div><strong>Uttrykk</strong>{selectedNode.phrases.map((phrase) => <p className="phrase" key={phrase}>{phrase}</p>)}</div>
              </section>
            ) : (
              <section className="language-support empty-support"><h2>Velg en gren ved behov</h2><p>Da vises spørsmål, ord og uttrykk for akkurat dette temaet.</p></section>
            )}
            <div className="help-actions">
              <button className="primary" onClick={() => requestHelp("say")}>Hva kan jeg si?</button>
              <button className="secondary" onClick={() => requestHelp("understand")}>Jeg forstod ikke</button>
            </div>
            {help && (
              <section className="private-help">
                <div><small>Privat hjelp · trinn {help.level}</small><button aria-label="Lukk" onClick={() => setHelp(null)}>×</button></div>
                <p>{help.text}</p>
                {help.level < help.max && <button className="text-button" onClick={() => requestHelp(help.type, help.level + 1)}>Vis mer konkret hjelp</button>}
              </section>
            )}
            <button className="leave-button" onClick={async () => {
              await disconnectAudio();
              setActivity(await api.leave(session));
            }}>Forlat samtalen</button>
          </aside>
        </div>
      </section>
    </Shell>
  );
}

function Reflection({ activity, session }: { activity: Activity; session: ParticipantSession }) {
  const [items, setItems] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadFeedback() {
    try {
      const result = await api.feedback(session);
      setItems(result.items);
      setOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Kunne ikke hente tilbakemeldingen");
    }
  }

  return (
    <Shell><section className="phone-page centered"><div className="participant-card reflection-card">
      <div className="completion-mark">✓</div><p className="eyebrow">Samtalen er avsluttet</p><h1>Takk for samtalen</h1>
      <p>Tilbakemeldingen er privat og vises bare på denne enheten.</p>
      {!open && <button className="primary wide" onClick={loadFeedback}>Se min tilbakemelding</button>}
      {open && <div className="feedback-list">{items.map((item, index) => <article key={item}><span>{index + 1}</span><p>{item}</p></article>)}</div>}
      <ErrorNotice error={error} />
      <button className="text-button" onClick={() => { clearParticipantSession(); window.location.href = "/"; }}>Til forsiden</button>
    </div></section></Shell>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/teacher" element={<Teacher />} />
      <Route path="/teacher/:code" element={<TeacherDashboard />} />
      <Route path="/join/:code" element={<ParticipantPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

