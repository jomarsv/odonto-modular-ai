import { FormEvent, useEffect, useMemo, useState } from "react";
import { ApiClient, Session } from "./api";

type Patient = {
  id: string;
  fullName: string;
  birthDate?: string | null;
  phone?: string | null;
  email?: string | null;
  cpf?: string | null;
  address?: string | null;
  notes?: string | null;
  consentForAI: boolean;
};

type Appointment = {
  id: string;
  patientId: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  patient?: Patient;
  dentist?: { name: string };
};

type ClinicalRecord = {
  id: string;
  patientId: string;
  anamnesis?: string | null;
  diagnosisNotes?: string | null;
  treatmentPlan?: string | null;
  evolutionNotes?: string | null;
  createdAt: string;
};

type DocumentFile = {
  id: string;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  createdAt: string;
};

const tabs = [
  ["dashboard", "Dashboard"],
  ["patients", "Pacientes"],
  ["appointments", "Agenda"],
  ["records", "Prontuario"],
  ["documents", "Documentos"],
  ["users", "Equipe"],
  ["clinic", "Clinica"],
  ["profile", "Perfil"],
  ["audit", "Auditoria"],
  ["account", "Conta"],
  ["modules", "Modulos"],
  ["ai", "Uso de IA"],
  ["billing", "Cobranca"]
] as const;

const tabModules: Partial<Record<(typeof tabs)[number][0], string[]>> = {
  patients: ["patients"],
  appointments: ["appointments"],
  records: ["records"],
  documents: ["documents"],
  ai: ["ai-basic", "ai-advanced"],
  billing: ["billing"]
};

function money(value: number | string) {
  return Number(value ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function useStoredSession() {
  const [session, setSessionState] = useState<Session | null>(() => {
    const raw = localStorage.getItem("odonto-session");
    return raw ? (JSON.parse(raw) as Session) : null;
  });
  function setSession(next: Session | null) {
    setSessionState(next);
    if (next) localStorage.setItem("odonto-session", JSON.stringify(next));
    else localStorage.removeItem("odonto-session");
  }
  return [session, setSession] as const;
}

export default function App() {
  const [session, setSession] = useStoredSession();
  const api = useMemo(() => new ApiClient(() => session?.token ?? null), [session]);
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>("dashboard");
  const [message, setMessage] = useState("");
  const [modules, setModules] = useState<Array<{ id: string; key: string; enabled: boolean }>>([]);

  useEffect(() => {
    if (session) api.get<Array<{ id: string; key: string; enabled: boolean }>>("/modules").then(setModules).catch(() => setModules([]));
  }, [api, session]);

  if (!session) return <Login onLogin={setSession} />;
  const enabledModules = new Set(modules.filter((module) => module.enabled).map((module) => module.key));
  const visibleTabs = tabs.filter(([id]) => {
    if (id === "users") return ["ADMIN", "CLINIC_MANAGER"].includes(session.user.role);
    if (id === "clinic") return ["ADMIN", "CLINIC_MANAGER"].includes(session.user.role);
    if (id === "audit") return ["ADMIN", "CLINIC_MANAGER"].includes(session.user.role);
    const required = tabModules[id];
    return !required || required.some((key) => enabledModules.has(key));
  });

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-r border-slate-200 bg-white lg:w-72">
        <div className="border-b border-slate-200 p-5">
          <h1 className="text-xl font-bold text-slate-900">Odonto Modular AI</h1>
          <p className="mt-1 text-sm text-slate-500">{session.clinic.name}</p>
        </div>
        <nav className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-1">
          {visibleTabs.map(([id, label]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`whitespace-nowrap text-left lg:w-full ${
                activeTab === id ? "bg-primary-50 text-primary-700" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-slate-200 p-4 text-sm text-slate-500">
          <p>{session.user.name}</p>
          <p>{session.user.role}</p>
          <button className="btn-secondary mt-3 w-full" onClick={() => setSession(null)}>
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 lg:p-8">
        {message && <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
        {activeTab === "dashboard" && <Dashboard api={api} />}
        {activeTab === "patients" && <Patients api={api} onSaved={setMessage} />}
        {activeTab === "appointments" && <Appointments api={api} onSaved={setMessage} />}
        {activeTab === "records" && <Records api={api} onSaved={setMessage} />}
        {activeTab === "documents" && <Documents api={api} onSaved={setMessage} />}
        {activeTab === "users" && <Users api={api} onSaved={setMessage} />}
        {activeTab === "clinic" && <ClinicSettings api={api} session={session} setSession={setSession} onSaved={setMessage} />}
        {activeTab === "profile" && <Profile api={api} session={session} setSession={setSession} onSaved={setMessage} />}
        {activeTab === "audit" && <Audit api={api} />}
        {activeTab === "account" && <AccountStatus api={api} />}
        {activeTab === "modules" && <Modules api={api} onSaved={setMessage} />}
        {activeTab === "ai" && <AIUsage api={api} onSaved={setMessage} />}
        {activeTab === "billing" && <Billing api={api} />}
      </main>
    </div>
  );
}

function Login({ onLogin }: { onLogin: (session: Session) => void }) {
  const api = useMemo(() => new ApiClient(() => null), []);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("dentista@demo.com");
  const [password, setPassword] = useState("demo1234");
  const [name, setName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      onLogin(
        await api.post<Session>(mode === "login" ? "/auth/login" : "/auth/register", {
          email,
          password,
          name,
          clinicName,
          role: "CLINIC_MANAGER"
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha no login.");
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <form onSubmit={submit} className="panel w-full max-w-md p-6">
        <h1 className="text-2xl font-bold text-slate-900">Odonto Modular AI</h1>
        <p className="mt-2 text-sm text-slate-500">{mode === "login" ? "Acesse a plataforma modular da clinica." : "Crie a primeira conta da clinica."}</p>
        {error && <p className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-6 space-y-4">
          {mode === "register" && (
            <>
              <Field label="Nome">
                <input required value={name} onChange={(event) => setName(event.target.value)} />
              </Field>
              <Field label="Clinica">
                <input required value={clinicName} onChange={(event) => setClinicName(event.target.value)} />
              </Field>
            </>
          )}
          <Field label="E-mail">
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Senha">
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </Field>
          <button className="btn-primary w-full">{mode === "login" ? "Entrar" : "Criar clinica"}</button>
          <button
            type="button"
            className="btn-secondary w-full"
            onClick={() => {
              setError("");
              setMode(mode === "login" ? "register" : "login");
            }}
          >
            {mode === "login" ? "Cadastrar nova clinica" : "Voltar para login"}
          </button>
        </div>
      </form>
    </div>
  );
}

function Dashboard({ api }: { api: ApiClient }) {
  const [data, setData] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    api.get<Record<string, number>>("/dashboard").then(setData);
  }, [api]);
  const cards = [
    ["Pacientes", data?.patientsCount ?? 0],
    ["Consultas hoje", data?.todayAppointments ?? 0],
    ["Modulos ativos", data?.activeModules ?? 0],
    ["Tokens IA no mes", data?.aiTokensThisMonth ?? 0],
    ["Custo IA no mes", money(data?.aiCostThisMonth ?? 0)],
    ["Estimativa mensal", money(data?.monthlyPrice ?? 0)]
  ];
  return (
    <Section title="Dashboard">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value]) => (
          <div key={label} className="panel p-5">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function Patients({ api, onSaved }: { api: ApiClient; onSaved: (message: string) => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selected, setSelected] = useState<Patient | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ fullName: "", phone: "", email: "", cpf: "", address: "", notes: "", consentForAI: false });
  const load = () => api.get<Patient[]>(`/patients?search=${encodeURIComponent(search)}`).then(setPatients);
  useEffect(() => {
    load();
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    await api.post<Patient>("/patients", form);
    setForm({ fullName: "", phone: "", email: "", cpf: "", address: "", notes: "", consentForAI: false });
    onSaved("Paciente salvo.");
    load();
  }
  return (
    <Section title="Pacientes">
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form onSubmit={save} className="panel space-y-3 p-4">
          <Field label="Nome completo"><input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></Field>
          <Field label="Telefone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
          <Field label="E-mail"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="CPF"><input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} /></Field>
          <Field label="Endereco"><input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
          <Field label="Notas"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <label className="flex items-center gap-2 text-sm normal-case tracking-normal text-slate-700">
            <input className="h-4 w-4" type="checkbox" checked={form.consentForAI} onChange={(e) => setForm({ ...form, consentForAI: e.target.checked })} />
            Consentimento para apoio de IA registrado
          </label>
          <button className="btn-primary">Criar paciente</button>
        </form>
        <div className="panel overflow-hidden">
          <div className="flex gap-2 border-b border-slate-200 p-3">
            <input placeholder="Buscar por nome" value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn-secondary" onClick={load}>Buscar</button>
          </div>
          <Table headers={["Nome", "Telefone", "E-mail", ""]}>
            {patients.map((patient) => (
              <tr key={patient.id}>
                <td>{patient.fullName}</td>
                <td>{patient.phone}</td>
                <td>{patient.email}</td>
                <td><button className="btn-secondary" onClick={() => setSelected(patient)}>Perfil</button></td>
              </tr>
            ))}
          </Table>
          {selected && (
            <div className="border-t border-slate-200 p-4 text-sm">
              <h3 className="font-semibold">{selected.fullName}</h3>
              <p className="mt-1 text-slate-600">{selected.notes || "Sem notas."}</p>
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}

function Appointments({ api, onSaved }: { api: ApiClient; onSaved: (message: string) => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [form, setForm] = useState({ patientId: "", startTime: "", endTime: "", notes: "" });
  const load = () => {
    api.get<Patient[]>("/patients").then(setPatients);
    api.get<Appointment[]>("/appointments").then(setAppointments);
  };
  useEffect(load, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    await api.post<Appointment>("/appointments", { ...form, startTime: new Date(form.startTime).toISOString(), endTime: new Date(form.endTime).toISOString() });
    onSaved("Consulta criada.");
    load();
  }
  async function status(id: string, next: string) {
    await api.patch(`/appointments/${id}/status`, { status: next });
    load();
  }
  return (
    <Section title="Agenda">
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form onSubmit={save} className="panel space-y-3 p-4">
          <Field label="Paciente"><select required value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}><option value="">Selecione</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></Field>
          <Field label="Inicio"><input required type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></Field>
          <Field label="Fim"><input required type="datetime-local" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></Field>
          <Field label="Notas"><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
          <button className="btn-primary">Criar consulta</button>
        </form>
        <div className="panel overflow-hidden">
          <Table headers={["Paciente", "Inicio", "Status", "Alterar"]}>
            {appointments.map((item) => (
              <tr key={item.id}>
                <td>{item.patient?.fullName}</td>
                <td>{new Date(item.startTime).toLocaleString("pt-BR")}</td>
                <td>{item.status}</td>
                <td><select value={item.status} onChange={(e) => status(item.id, e.target.value)}>{["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"].map((s) => <option key={s}>{s}</option>)}</select></td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </Section>
  );
}

function Records({ api, onSaved }: { api: ApiClient; onSaved: (message: string) => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [records, setRecords] = useState<ClinicalRecord[]>([]);
  const [patientId, setPatientId] = useState("");
  const [form, setForm] = useState({ anamnesis: "", diagnosisNotes: "", treatmentPlan: "", evolutionNotes: "" });
  useEffect(() => { api.get<Patient[]>("/patients").then(setPatients); }, [api]);
  useEffect(() => { if (patientId) api.get<ClinicalRecord[]>(`/records/patient/${patientId}`).then(setRecords); }, [patientId, api]);
  async function save(event: FormEvent) {
    event.preventDefault();
    await api.post<ClinicalRecord>("/records", { ...form, patientId });
    onSaved("Prontuario salvo.");
    setForm({ anamnesis: "", diagnosisNotes: "", treatmentPlan: "", evolutionNotes: "" });
    api.get<ClinicalRecord[]>(`/records/patient/${patientId}`).then(setRecords);
  }
  return (
    <Section title="Prontuario">
      <Field label="Paciente"><select className="mb-4 max-w-xl" value={patientId} onChange={(e) => setPatientId(e.target.value)}><option value="">Selecione</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></Field>
      {patientId && <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form onSubmit={save} className="panel space-y-3 p-4">
          <Field label="Anamnese"><textarea value={form.anamnesis} onChange={(e) => setForm({ ...form, anamnesis: e.target.value })} /></Field>
          <Field label="Diagnostico"><textarea value={form.diagnosisNotes} onChange={(e) => setForm({ ...form, diagnosisNotes: e.target.value })} /></Field>
          <Field label="Plano de tratamento"><textarea value={form.treatmentPlan} onChange={(e) => setForm({ ...form, treatmentPlan: e.target.value })} /></Field>
          <Field label="Evolucao clinica"><textarea value={form.evolutionNotes} onChange={(e) => setForm({ ...form, evolutionNotes: e.target.value })} /></Field>
          <button className="btn-primary">Salvar prontuario</button>
        </form>
        <div className="space-y-3">
          {records.map((record) => <div key={record.id} className="panel p-4 text-sm"><p className="font-semibold">{new Date(record.createdAt).toLocaleString("pt-BR")}</p><p>{record.anamnesis}</p><p>{record.treatmentPlan}</p><p>{record.evolutionNotes}</p></div>)}
        </div>
      </div>}
    </Section>
  );
}

function Documents({ api, onSaved }: { api: ApiClient; onSaved: (message: string) => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [patientId, setPatientId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  useEffect(() => { api.get<Patient[]>("/patients").then(setPatients); }, [api]);
  useEffect(() => { if (patientId) api.get<DocumentFile[]>(`/documents/patient/${patientId}`).then(setDocuments); }, [patientId, api]);
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    const form = new FormData();
    form.set("patientId", patientId);
    form.set("file", file);
    await api.upload<DocumentFile>("/documents", form);
    onSaved("Documento enviado.");
    api.get<DocumentFile[]>(`/documents/patient/${patientId}`).then(setDocuments);
  }
  return (
    <Section title="Documentos">
      <form onSubmit={upload} className="panel mb-4 flex flex-col gap-3 p-4 md:flex-row md:items-end">
        <Field label="Paciente"><select required value={patientId} onChange={(e) => setPatientId(e.target.value)}><option value="">Selecione</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></Field>
        <Field label="Arquivo"><input required type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
        <button className="btn-primary">Enviar</button>
      </form>
      <div className="panel overflow-hidden"><Table headers={["Arquivo", "Tipo", "Tamanho", "Data"]}>{documents.map((d) => <tr key={d.id}><td><a className="text-primary-700" href={d.fileUrl} target="_blank">{d.fileName}</a></td><td>{d.fileType}</td><td>{Math.round(d.fileSize / 1024)} KB</td><td>{new Date(d.createdAt).toLocaleString("pt-BR")}</td></tr>)}</Table></div>
    </Section>
  );
}

function Modules({ api, onSaved }: { api: ApiClient; onSaved: (message: string) => void }) {
  const [modules, setModules] = useState<Array<{ id: string; name: string; description: string; category: string; basePrice: string; enabled: boolean }>>([]);
  const load = () => api.get<typeof modules>("/modules").then(setModules);
  useEffect(() => {
    load();
  }, []);
  async function toggle(id: string, enabled: boolean) {
    await api.patch(`/modules/${id}`, { enabled });
    onSaved(enabled ? "Modulo ativado." : "Modulo desativado.");
    load();
  }
  return <Section title="Modulos disponiveis"><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{modules.map((m) => <div key={m.id} className="panel p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-primary-700">{m.category}</p><h3 className="mt-1 font-semibold">{m.name}</h3></div><label className="flex items-center gap-2 normal-case tracking-normal"><input className="h-4 w-4" type="checkbox" checked={m.enabled} onChange={(e) => toggle(m.id, e.target.checked)} />Ativo</label></div><p className="mt-3 text-sm text-slate-600">{m.description}</p><p className="mt-3 text-sm font-semibold">{money(m.basePrice)}</p></div>)}</div></Section>;
}

function Users({ api, onSaved }: { api: ApiClient; onSaved: (message: string) => void }) {
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "DENTIST" });
  const load = () => api.get<typeof users>("/users").then(setUsers);
  useEffect(() => {
    load();
  }, []);
  async function save(event: FormEvent) {
    event.preventDefault();
    await api.post("/users", form);
    setForm({ name: "", email: "", password: "", role: "DENTIST" });
    onSaved("Usuario criado.");
    load();
  }
  async function changeRole(id: string, role: string) {
    await api.patch(`/users/${id}/role`, { role });
    onSaved("Role atualizada.");
    load();
  }
  return (
    <Section title="Equipe">
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <form onSubmit={save} className="panel space-y-3 p-4">
          <Field label="Nome"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="E-mail"><input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
          <Field label="Senha inicial"><input required type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></Field>
          <Field label="Role"><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{["DENTIST", "ASSISTANT", "CLINIC_MANAGER", "ADMIN"].map((role) => <option key={role}>{role}</option>)}</select></Field>
          <button className="btn-primary">Criar usuario</button>
        </form>
        <div className="panel overflow-hidden">
          <Table headers={["Nome", "E-mail", "Role"]}>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td><select value={user.role} onChange={(e) => changeRole(user.id, e.target.value)}>{["DENTIST", "ASSISTANT", "CLINIC_MANAGER", "ADMIN"].map((role) => <option key={role}>{role}</option>)}</select></td>
              </tr>
            ))}
          </Table>
        </div>
      </div>
    </Section>
  );
}

function ClinicSettings({
  api,
  session,
  setSession,
  onSaved
}: {
  api: ApiClient;
  session: Session;
  setSession: (session: Session | null) => void;
  onSaved: (message: string) => void;
}) {
  const [form, setForm] = useState({ name: "", documentNumber: "", phone: "", email: "", address: "" });
  useEffect(() => {
    api.get<typeof form & { id: string }>("/clinic/me").then((clinic) =>
      setForm({
        name: clinic.name ?? "",
        documentNumber: clinic.documentNumber ?? "",
        phone: clinic.phone ?? "",
        email: clinic.email ?? "",
        address: clinic.address ?? ""
      })
    );
  }, [api]);
  async function save(event: FormEvent) {
    event.preventDefault();
    const clinic = await api.put<Session["clinic"]>("/clinic/me", form);
    setSession({ ...session, clinic });
    onSaved("Dados da clinica atualizados.");
  }
  return (
    <Section title="Clinica">
      <form onSubmit={save} className="panel max-w-2xl space-y-3 p-4">
        <Field label="Nome"><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
        <Field label="Documento"><input value={form.documentNumber} onChange={(e) => setForm({ ...form, documentNumber: e.target.value })} /></Field>
        <Field label="Telefone"><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
        <Field label="E-mail"><input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
        <Field label="Endereco"><textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
        <button className="btn-primary">Salvar clinica</button>
      </form>
    </Section>
  );
}

function Profile({
  api,
  session,
  setSession,
  onSaved
}: {
  api: ApiClient;
  session: Session;
  setSession: (session: Session | null) => void;
  onSaved: (message: string) => void;
}) {
  const [name, setName] = useState(session.user.name);
  const [password, setPassword] = useState({ currentPassword: "", newPassword: "" });
  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    const user = await api.put<Session["user"]>("/profile", { name });
    setSession({ ...session, user: { ...session.user, ...user } });
    onSaved("Perfil atualizado.");
  }
  async function changePassword(event: FormEvent) {
    event.preventDefault();
    await api.post("/profile/password", password);
    setPassword({ currentPassword: "", newPassword: "" });
    onSaved("Senha atualizada.");
  }
  return (
    <Section title="Perfil">
      <div className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={saveProfile} className="panel space-y-3 p-4">
          <Field label="Nome"><input required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="E-mail"><input disabled value={session.user.email} /></Field>
          <Field label="Role"><input disabled value={session.user.role} /></Field>
          <button className="btn-primary">Salvar perfil</button>
        </form>
        <form onSubmit={changePassword} className="panel space-y-3 p-4">
          <Field label="Senha atual"><input required type="password" value={password.currentPassword} onChange={(e) => setPassword({ ...password, currentPassword: e.target.value })} /></Field>
          <Field label="Nova senha"><input required minLength={8} type="password" value={password.newPassword} onChange={(e) => setPassword({ ...password, newPassword: e.target.value })} /></Field>
          <button className="btn-primary">Trocar senha</button>
        </form>
      </div>
    </Section>
  );
}

function Audit({ api }: { api: ApiClient }) {
  const [logs, setLogs] = useState<Array<Record<string, any>>>([]);
  useEffect(() => {
    api.get<Array<Record<string, any>>>("/audit").then(setLogs);
  }, [api]);
  return (
    <Section title="Auditoria">
      <div className="panel overflow-hidden">
        <Table headers={["Data", "Usuario", "Acao", "Entidade"]}>
          {logs.map((log) => (
            <tr key={String(log.id)}>
              <td>{log.createdAt ? new Date(String(log.createdAt)).toLocaleString("pt-BR") : ""}</td>
              <td>{String(log.user?.name ?? log.userId ?? "")}</td>
              <td>{String(log.action ?? "")}</td>
              <td>{String(log.entity ?? "")}</td>
            </tr>
          ))}
        </Table>
      </div>
    </Section>
  );
}

function AccountStatus({ api }: { api: ApiClient }) {
  const [data, setData] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    api.get<Record<string, any>>("/account/status").then(setData);
  }, [api]);
  if (!data) return <Section title="Conta"><p>Carregando...</p></Section>;
  return (
    <Section title="Status da conta">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Usuarios" value={data.usersCount} />
        <StatCard label="Modulos ativos" value={data.activeModulesCount} />
        <StatCard label="Tokens IA" value={data.aiTokensThisMonth} />
        <Price label="Custo mensal" value={data.monthlyPrice} highlight />
      </div>
      <div className="panel mt-4 overflow-hidden">
        <Table headers={["Modulo", "Categoria", "Preco"]}>
          {(data.activeModules ?? []).map((module: any) => (
            <tr key={String(module.id)}>
              <td>{String(module.name)}</td>
              <td>{String(module.category)}</td>
              <td>{money(String(module.basePrice ?? 0))}</td>
            </tr>
          ))}
        </Table>
      </div>
    </Section>
  );
}

function AIUsage({ api, onSaved }: { api: ApiClient; onSaved: (message: string) => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [logs, setLogs] = useState<Array<Record<string, any>>>([]);
  const [result, setResult] = useState("");
  const [form, setForm] = useState({ featureKey: "record-summary", precisionLevel: "STANDARD", input: "", patientId: "" });
  const loadLogs = () => api.get<Array<Record<string, any>>>("/ai/usage").then(setLogs);
  useEffect(() => { api.get<Patient[]>("/patients").then(setPatients); loadLogs(); }, []);
  async function generate(event: FormEvent) {
    event.preventDefault();
    const response = await api.post<{ text: string }>("/ai/generate", { ...form, patientId: form.patientId || undefined });
    setResult(response.text);
    onSaved("IA executada e consumo registrado.");
    loadLogs();
  }
  return (
    <Section title="Uso de IA">
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form onSubmit={generate} className="panel space-y-3 p-4">
          <Field label="Funcao"><select value={form.featureKey} onChange={(e) => setForm({ ...form, featureKey: e.target.value })}><option value="record-summary">Resumo do prontuario</option><option value="clinical-report">Relatorio clinico</option><option value="patient-guidance">Orientacao ao paciente</option></select></Field>
          <Field label="Precisao"><select value={form.precisionLevel} onChange={(e) => setForm({ ...form, precisionLevel: e.target.value })}>{["BASIC", "STANDARD", "ADVANCED", "SPECIALIST"].map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Paciente"><select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}><option value="">Sem paciente</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></Field>
          <Field label="Entrada"><textarea required rows={7} value={form.input} onChange={(e) => setForm({ ...form, input: e.target.value })} /></Field>
          <button className="btn-primary">Gerar com IA</button>
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">Conteudo gerado por inteligencia artificial para apoio profissional. A decisao clinica final deve ser tomada por cirurgiao-dentista habilitado.</p>
        </form>
        <div className="space-y-4">
          {result && <pre className="panel whitespace-pre-wrap p-4 text-sm">{result}</pre>}
          <div className="panel overflow-hidden"><Table headers={["Funcao", "Precisao", "Tokens", "Custo"]}>{logs.map((log) => <tr key={String(log.id)}><td>{String(log.featureKey)}</td><td>{String(log.precisionLevel)}</td><td>{String(log.totalTokens)}</td><td>{money(String(log.estimatedCost))}</td></tr>)}</Table></div>
        </div>
      </div>
    </Section>
  );
}

function Billing({ api }: { api: ApiClient }) {
  const [estimate, setEstimate] = useState<Record<string, any> | null>(null);
  useEffect(() => { api.get<Record<string, any>>("/billing/estimate").then(setEstimate); }, [api]);
  if (!estimate) return <Section title="Cobranca"><p>Carregando...</p></Section>;
  return (
    <Section title="Estimativa de cobranca">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Price label="Plano base" value={estimate.basePlanPrice} />
        <Price label="Modulos ativos" value={estimate.activeModulesPrice} />
        <Price label="Armazenamento" value={estimate.storagePrice} />
        <Price label="Consumo de IA" value={estimate.aiUsagePrice} />
        <Price label="Seguranca" value={estimate.securityPrice} />
        <Price label="Total estimado" value={estimate.monthlyPrice} highlight />
      </div>
    </Section>
  );
}

function Price({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return <div className={`panel p-5 ${highlight ? "border-primary-600" : ""}`}><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{money(value)}</p></div>;
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return <div className="panel p-5"><p className="text-sm text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><label>{label}</label>{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><div className="mb-5"><h2 className="text-2xl font-bold text-slate-900">{title}</h2></div>{children}</section>;
}

function Table({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="overflow-x-auto"><table className="table w-full"><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
