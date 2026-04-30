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

type ClinicalProcedure = {
  id: string;
  patientId: string;
  tooth?: string | null;
  region?: string | null;
  procedureName: string;
  status: string;
  notes?: string | null;
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

type ExamImage = {
  id: string;
  patientId: string;
  examType: string;
  clinicalQuestion?: string | null;
  fileName: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  analysisStatus: string;
  analysisProvider?: string | null;
  analysisResult?: string | null;
  createdAt: string;
};

type ModuleItem = {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  basePrice: string;
  enabled: boolean;
  scope?: string | null;
  specialtyKey?: string | null;
  specialtyName?: string | null;
};

type CustomFeatureRequest = {
  id: string;
  moduleId: string;
  moduleName?: string | null;
  specialtyName: string;
  title: string;
  description: string;
  expectedBenefit: string;
  suggestedMonthlyBudget?: number | null;
  status: string;
  monthlyPrice?: number | null;
  enabled?: boolean;
  reviewNotes?: string | null;
  requestedById: string;
  approvedForUserId?: string | null;
  requestedBy?: { name?: string; email?: string } | null;
  createdAt: string;
};

const tabs = [
  ["dashboard", "Dashboard"],
  ["patients", "Pacientes"],
  ["appointments", "Agenda"],
  ["records", "Prontuario"],
  ["documents", "Documentos"],
  ["examImages", "Exames IA"],
  ["specialties", "Especialidades"],
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
  examImages: ["exam-images-ai"],
  specialties: [],
  ai: ["ai-basic", "ai-advanced"],
  billing: ["billing"]
};

const endodonticSubmodules = [
  {
    moduleKey: "endodontics-planning",
    label: "Planejamento endodontico",
    description: "Ficha base para diagnostico, plano endodontico, canais, testes, achados e acompanhamento.",
    monthlyPrice: 89.9
  },
  {
    moduleKey: "endodontics-conventional",
    label: "Endodontia clinica convencional",
    description: "Tratamento de canal, retratamento, controle de infeccoes pulpares e diagnostico de dor endodontica.",
    monthlyPrice: 79.9
  },
  {
    moduleKey: "endodontics-microscopic",
    label: "Endodontia microscopica",
    description: "Uso de microscopio operatorio para canais calcificados, instrumentos fraturados e anatomias complexas.",
    monthlyPrice: 129.9
  },
  {
    moduleKey: "endodontics-surgical",
    label: "Endodontia cirurgica / parendodontica",
    description: "Apicectomia, curetagem periapical, retrobturacao e manejo de falhas do tratamento convencional.",
    monthlyPrice: 149.9
  },
  {
    moduleKey: "endodontics-regenerative",
    label: "Endodontia regenerativa",
    description: "Regeneracao tecidual e manejo de dentes imaturos com necrose pulpar e raiz incompleta.",
    monthlyPrice: 159.9
  },
  {
    moduleKey: "endodontics-vital",
    label: "Endodontia biologica / vital",
    description: "Preservacao da polpa viva, capeamentos pulpares, pulpotomia e tratamentos conservadores.",
    monthlyPrice: 99.9
  },
  {
    moduleKey: "endodontics-advanced-diagnosis",
    label: "Diagnostico endodontico avancado",
    description: "Testes de vitalidade, interpretacao de dor e correlacao com radiografia ou CBCT.",
    monthlyPrice: 119.9
  },
  {
    moduleKey: "endodontics-microbiology",
    label: "Microbiologia endodontica",
    description: "Biofilmes, bacterias dos canais radiculares, infeccao persistente e resistencia microbiana.",
    monthlyPrice: 109.9
  },
  {
    moduleKey: "endodontics-technology",
    label: "Endodontia tecnologica",
    description: "Instrumentacao rotatoria/reciprocante, localizadores apicais e sistemas avancados de irrigacao.",
    monthlyPrice: 119.9
  }
];

const implantologySubmodules = [
  {
    moduleKey: "implantology-planning",
    label: "Planejamento de implantes",
    description: "Base para planejamento cirurgico-protetico, avaliacao de risco e checklist de implantes.",
    monthlyPrice: 149.9
  },
  {
    moduleKey: "implantology-surgical",
    label: "Implantodontia cirurgica",
    description: "Instalacao de implantes, acesso osseo, volume/densidade ossea, implantes unitarios, multiplos e imediatos.",
    monthlyPrice: 139.9
  },
  {
    moduleKey: "implantology-prosthetic",
    label: "Implantodontia protetica",
    description: "Reabilitacao sobre implantes, coroas, proteses fixas, protocolo, ajustes oclusais e estetica funcional.",
    monthlyPrice: 129.9
  },
  {
    moduleKey: "implantology-bone-regeneration",
    label: "Implantodontia com regeneracao ossea",
    description: "Enxertos osseos, regeneracao ossea guiada, biomateriais e preparo de leito para implantes.",
    monthlyPrice: 159.9
  },
  {
    moduleKey: "implantology-advanced-surgeries",
    label: "Implantodontia com cirurgias avancadas",
    description: "Sinus lift, expansao ossea, split crest e cirurgias reconstrutivas.",
    monthlyPrice: 179.9
  },
  {
    moduleKey: "implantology-immediate",
    label: "Implantodontia imediata",
    description: "Implante no momento da extracao, estabilidade primaria, reducao de tempo e planejamento preciso.",
    monthlyPrice: 149.9
  },
  {
    moduleKey: "implantology-guided",
    label: "Implantodontia guiada",
    description: "Planejamento digital com CBCT/software, guias cirurgicos e execucao minimamente invasiva.",
    monthlyPrice: 169.9
  },
  {
    moduleKey: "implantology-aesthetic",
    label: "Implantodontia estetica",
    description: "Regiao anterior, contorno gengival, harmonia facial e perfil de emergencia.",
    monthlyPrice: 149.9
  },
  {
    moduleKey: "implantology-peri-implant",
    label: "Implantodontia peri-implantar",
    description: "Peri-implantite, mucosite peri-implantar, manutencao preventiva e complicacoes.",
    monthlyPrice: 119.9
  },
  {
    moduleKey: "implantology-biomaterials",
    label: "Implantodontia biomateriais e superficies",
    description: "Tipos de implantes, tratamentos de superficie, biomateriais e osseointegracao.",
    monthlyPrice: 109.9
  },
  {
    moduleKey: "implantology-digital-ai",
    label: "Implantodontia digital / inteligente",
    description: "Planejamento digital completo, simulacao, integracao com IA e predicao de sucesso do implante.",
    monthlyPrice: 189.9
  }
];

const aestheticSubmodules = [
  {
    moduleKey: "aesthetic-dentistry",
    label: "Planejamento estetico",
    description: "Base para planejamento estetico, fotografias, mockups, objetivos do sorriso e acompanhamento.",
    monthlyPrice: 109.9
  },
  {
    moduleKey: "aesthetic-restorative",
    label: "Dentistica estetica restauradora",
    description: "Resinas compostas, reconstrucoes, fechamento de diastemas, naturalidade, funcao e forma dental.",
    monthlyPrice: 99.9
  },
  {
    moduleKey: "aesthetic-whitening",
    label: "Clareamento dental",
    description: "Clareamento de consultorio, caseiro supervisionado e interno em dentes tratados endodonticamente.",
    monthlyPrice: 69.9
  },
  {
    moduleKey: "aesthetic-veneers",
    label: "Lentes de contato dentais e facetas",
    description: "Facetas de resina, facetas de porcelana, lentes ultrafinas, forma, cor e alinhamento visual.",
    monthlyPrice: 139.9
  },
  {
    moduleKey: "aesthetic-reanatomization",
    label: "Reanatomizacao dental",
    description: "Modelagem estetica, alteracao de formato dental e harmonizacao do sorriso com minimo desgaste.",
    monthlyPrice: 89.9
  },
  {
    moduleKey: "aesthetic-dsd",
    label: "Planejamento estetico digital / DSD",
    description: "Digital Smile Design, simulacao do sorriso, planejamento com fotos, softwares e suporte de IA.",
    monthlyPrice: 149.9
  },
  {
    moduleKey: "aesthetic-gingival",
    label: "Estetica gengival",
    description: "Gengivoplastia, gengivectomia, correcao de sorriso gengival e harmonia dos tecidos moles.",
    monthlyPrice: 119.9
  },
  {
    moduleKey: "aesthetic-biomimetic",
    label: "Odontologia biomimetica",
    description: "Restauracoes que imitam a estrutura natural e preservam ao maximo o tecido dental.",
    monthlyPrice: 129.9
  },
  {
    moduleKey: "aesthetic-prosthetic",
    label: "Estetica com proteses dentarias",
    description: "Coroas esteticas, proteses fixas e reabilitacao oral estetica integrada.",
    monthlyPrice: 139.9
  },
  {
    moduleKey: "aesthetic-materials",
    label: "Materiais esteticos avancados",
    description: "Ceramicas odontologicas, resinas de alta performance e sistemas CAD/CAM.",
    monthlyPrice: 109.9
  },
  {
    moduleKey: "aesthetic-digital-ai",
    label: "Odontologia estetica digital / IA",
    description: "Simulacao estetica com IA, previsao de resultado, analise de sorriso e sugestao de tratamento.",
    monthlyPrice: 179.9
  }
];

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
  const [modules, setModules] = useState<ModuleItem[]>([]);

  useEffect(() => {
    if (session) api.get<ModuleItem[]>("/modules").then(setModules).catch(() => setModules([]));
  }, [api, session]);

  if (!session) return <Login onLogin={setSession} />;
  if (session.user.role === "LEO_TECH_ADMIN") return <LeoTechConsole api={api} session={session} setSession={setSession} onSaved={setMessage} message={message} />;
  const enabledModules = new Set(modules.filter((module) => module.enabled).map((module) => module.key));
  const visibleTabs = tabs.filter(([id]) => {
    if (id === "users") return ["ADMIN", "CLINIC_MANAGER"].includes(session.user.role);
    if (id === "clinic") return ["ADMIN", "CLINIC_MANAGER"].includes(session.user.role);
    if (id === "audit") return ["ADMIN", "CLINIC_MANAGER"].includes(session.user.role);
    if (id === "specialties") return modules.some((module) => module.enabled && module.scope === "SPECIALTY");
    const required = tabModules[id];
    return !required || required.some((key) => enabledModules.has(key));
  });

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-r border-slate-200 bg-white lg:w-72">
        <div className="border-b border-slate-200 p-5">
          <h1 className="text-xl font-bold text-slate-900">Odonto Modular AI</h1>
          <p className="mt-1 text-sm text-slate-500">{session.clinic?.name}</p>
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
        {activeTab === "examImages" && <ExamImages api={api} onSaved={setMessage} />}
        {activeTab === "specialties" && <Specialties api={api} modules={modules} session={session} onSaved={setMessage} />}
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

function LeoTechConsole({
  api,
  session,
  setSession,
  onSaved,
  message
}: {
  api: ApiClient;
  session: Session;
  setSession: (session: Session | null) => void;
  onSaved: (message: string) => void;
  message: string;
}) {
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [clinics, setClinics] = useState<Array<Record<string, any>>>([]);
  const [requests, setRequests] = useState<Array<Record<string, any>>>([]);
  const [review, setReview] = useState({ reviewNotes: "", monthlyPrice: "99.9" });
  const load = () => {
    api.get<Record<string, any>>("/platform/summary").then(setSummary);
    api.get<Array<Record<string, any>>>("/platform/clinics").then(setClinics);
    api.get<Array<Record<string, any>>>("/platform/custom-features").then(setRequests);
  };
  useEffect(load, [api]);
  async function reviewRequest(id: string, status: "APPROVED" | "REJECTED") {
    await api.patch(`/platform/custom-features/${id}/review`, {
      status,
      reviewNotes: review.reviewNotes || (status === "APPROVED" ? "Aprovado para desenvolvimento e liberacao personalizada." : "Nao aprovado neste momento."),
      monthlyPrice: status === "APPROVED" ? Number(review.monthlyPrice || 0) : 0
    });
    setReview({ reviewNotes: "", monthlyPrice: "99.9" });
    onSaved(status === "APPROVED" ? "Pedido aprovado pela LEO-Tech." : "Pedido rejeitado pela LEO-Tech.");
    load();
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-5 py-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Console LEO-Tech</h1>
            <p className="text-sm text-slate-500">Gestao operacional da plataforma Odonto Modular AI</p>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <span>{session.user.name}</span>
            <button className="btn-secondary" onClick={() => setSession(null)}>Sair</button>
          </div>
        </div>
      </header>
      <main className="space-y-5 p-4 lg:p-8">
        {message && <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</div>}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Clinicas" value={summary?.clinicsCount ?? 0} />
          <StatCard label="Usuarios" value={summary?.usersCount ?? 0} />
          <StatCard label="Pedidos pendentes" value={summary?.pendingCustomFeatures ?? 0} />
          <StatCard label="Extras aprovados" value={summary?.approvedCustomFeatures ?? 0} />
          <StatCard label="Tokens IA" value={summary?.aiTokensTotal ?? 0} />
        </section>
        <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold">Pedidos de funcionalidades</h2>
            <p className="text-sm text-slate-500">Analise pela LEO-Tech com apoio de especialistas em odontologia.</p>
          </div>
          <Table headers={["Clinica", "Especialidade", "Pedido", "Solicitante", "Status", "Custo", "Decisao"]}>
            {requests.map((request) => (
              <tr key={String(request.id)}>
                <td>{String(request.clinic?.name ?? request.clinicId)}</td>
                <td>{String(request.specialtyName)}</td>
                <td><p className="font-medium">{String(request.title)}</p><p className="text-xs text-slate-500">{String(request.description)}</p><p className="mt-1 text-xs text-slate-500">Beneficio: {String(request.expectedBenefit)}</p></td>
                <td>{String(request.requestedBy?.name ?? request.requestedBy?.email ?? request.requestedById)}</td>
                <td>{String(request.status)}</td>
                <td>{money(String(request.monthlyPrice ?? 0))}</td>
                <td>
                  {request.status === "REQUESTED" ? (
                    <div className="min-w-60 space-y-2">
                      <input placeholder="Preco mensal" value={review.monthlyPrice} onChange={(e) => setReview({ ...review, monthlyPrice: e.target.value })} />
                      <textarea rows={2} placeholder="Parecer LEO-Tech" value={review.reviewNotes} onChange={(e) => setReview({ ...review, reviewNotes: e.target.value })} />
                      <div className="flex gap-2">
                        <button type="button" className="btn-primary" onClick={() => reviewRequest(String(request.id), "APPROVED")}>Aprovar</button>
                        <button type="button" className="btn-secondary" onClick={() => reviewRequest(String(request.id), "REJECTED")}>Rejeitar</button>
                      </div>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-500">{String(request.reviewNotes ?? "Revisado")}</span>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </section>
        <section className="panel overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <h2 className="font-semibold">Clinicas</h2>
          </div>
          <Table headers={["Clinica", "Usuarios", "Pedidos", "Tokens IA"]}>
            {clinics.map((clinic) => (
              <tr key={String(clinic.id)}>
                <td><p className="font-medium">{String(clinic.name)}</p><p className="text-xs text-slate-500">{String(clinic.email ?? "")}</p></td>
                <td>{String(clinic.usersCount ?? 0)}</td>
                <td>{String(clinic.customFeatureRequestsCount ?? 0)}</td>
                <td>{String(clinic.aiTokensTotal ?? 0)}</td>
              </tr>
            ))}
          </Table>
        </section>
      </main>
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
  const [procedures, setProcedures] = useState<ClinicalProcedure[]>([]);
  const [summary, setSummary] = useState<Record<string, any> | null>(null);
  const [aiResult, setAiResult] = useState("");
  const [patientId, setPatientId] = useState("");
  const [form, setForm] = useState({ anamnesis: "", diagnosisNotes: "", treatmentPlan: "", evolutionNotes: "" });
  const [procedureForm, setProcedureForm] = useState({ tooth: "", region: "", procedureName: "", status: "PLANNED", notes: "" });
  useEffect(() => { api.get<Patient[]>("/patients").then(setPatients); }, [api]);
  const loadClinical = () => {
    if (!patientId) return;
    api.get<ClinicalRecord[]>(`/records/patient/${patientId}`).then(setRecords);
    api.get<ClinicalProcedure[]>(`/records/procedures/patient/${patientId}`).then(setProcedures);
    api.get<Record<string, any>>(`/records/patient/${patientId}/summary`).then(setSummary);
  };
  useEffect(loadClinical, [patientId, api]);
  async function save(event: FormEvent) {
    event.preventDefault();
    await api.post<ClinicalRecord>("/records", { ...form, patientId });
    onSaved("Prontuario salvo.");
    setForm({ anamnesis: "", diagnosisNotes: "", treatmentPlan: "", evolutionNotes: "" });
    loadClinical();
  }
  async function saveProcedure(event: FormEvent) {
    event.preventDefault();
    await api.post<ClinicalProcedure>("/records/procedures", { ...procedureForm, patientId });
    setProcedureForm({ tooth: "", region: "", procedureName: "", status: "PLANNED", notes: "" });
    onSaved("Procedimento registrado.");
    loadClinical();
  }
  async function updateProcedureStatus(id: string, status: string) {
    await api.patch(`/records/procedures/${id}/status`, { status });
    loadClinical();
  }
  function buildClinicalSummaryInput() {
    const patient = summary?.patient ?? patients.find((item) => item.id === patientId);
    const recordLines = records.length
      ? records
          .map(
            (record, index) =>
              `Evolucao ${index + 1} (${new Date(record.createdAt).toLocaleDateString("pt-BR")}):\n` +
              `- Anamnese: ${record.anamnesis || "Nao informado"}\n` +
              `- Diagnostico/anotacoes: ${record.diagnosisNotes || "Nao informado"}\n` +
              `- Plano de tratamento: ${record.treatmentPlan || "Nao informado"}\n` +
              `- Evolucao: ${record.evolutionNotes || "Nao informado"}`
          )
          .join("\n\n")
      : "Sem evolucoes clinicas registradas.";
    const procedureLines = procedures.length
      ? procedures
          .map((procedure) => `- ${procedure.procedureName} | Dente/regiao: ${procedure.tooth || procedure.region || "Nao informado"} | Status: ${procedure.status} | Obs: ${procedure.notes || "Sem observacoes"}`)
          .join("\n")
      : "Sem procedimentos registrados.";
    return [
      `Paciente: ${patient?.fullName ?? "Nao informado"}`,
      patient?.birthDate ? `Nascimento: ${new Date(String(patient.birthDate)).toLocaleDateString("pt-BR")}` : "",
      patient?.notes ? `Observacoes gerais: ${patient.notes}` : "",
      "",
      "Historico clinico:",
      recordLines,
      "",
      "Procedimentos:",
      procedureLines,
      "",
      "Gere um resumo clinico objetivo para revisao do cirurgiao-dentista, sem JSON bruto. Use secoes: Queixa/Contexto, Achados registrados, Plano em andamento, Pendencias e Alertas."
    ]
      .filter((line) => line !== "")
      .join("\n");
  }
  async function generateSummary() {
    const response = await api.post<{ text: string }>("/ai/generate", {
      featureKey: "record-summary",
      precisionLevel: "STANDARD",
      patientId,
      input: buildClinicalSummaryInput().slice(0, 6000)
    });
    setAiResult(response.text);
    onSaved("Resumo clinico gerado.");
  }
  return (
    <Section title="Prontuario">
      <Field label="Paciente"><select className="mb-4 max-w-xl" value={patientId} onChange={(e) => setPatientId(e.target.value)}><option value="">Selecione</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></Field>
      {patientId && <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <div className="space-y-4">
          <form onSubmit={save} className="panel space-y-3 p-4">
            <Field label="Anamnese"><textarea value={form.anamnesis} onChange={(e) => setForm({ ...form, anamnesis: e.target.value })} /></Field>
            <Field label="Diagnostico"><textarea value={form.diagnosisNotes} onChange={(e) => setForm({ ...form, diagnosisNotes: e.target.value })} /></Field>
            <Field label="Plano de tratamento"><textarea value={form.treatmentPlan} onChange={(e) => setForm({ ...form, treatmentPlan: e.target.value })} /></Field>
            <Field label="Evolucao clinica"><textarea value={form.evolutionNotes} onChange={(e) => setForm({ ...form, evolutionNotes: e.target.value })} /></Field>
            <button className="btn-primary">Salvar evolucao</button>
          </form>
          <form onSubmit={saveProcedure} className="panel space-y-3 p-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Dente"><input placeholder="Ex: 16" value={procedureForm.tooth} onChange={(e) => setProcedureForm({ ...procedureForm, tooth: e.target.value })} /></Field>
              <Field label="Regiao"><input placeholder="Ex: Oclusal" value={procedureForm.region} onChange={(e) => setProcedureForm({ ...procedureForm, region: e.target.value })} /></Field>
            </div>
            <Field label="Procedimento"><input required value={procedureForm.procedureName} onChange={(e) => setProcedureForm({ ...procedureForm, procedureName: e.target.value })} /></Field>
            <Field label="Status"><select value={procedureForm.status} onChange={(e) => setProcedureForm({ ...procedureForm, status: e.target.value })}>{["PLANNED", "IN_PROGRESS", "COMPLETED"].map((s) => <option key={s}>{s}</option>)}</select></Field>
            <Field label="Notas"><textarea value={procedureForm.notes} onChange={(e) => setProcedureForm({ ...procedureForm, notes: e.target.value })} /></Field>
            <button className="btn-primary">Registrar procedimento</button>
          </form>
        </div>
        <div className="space-y-4">
          <div className="panel p-4">
            <div className="flex items-center justify-between gap-3">
              <div><h3 className="font-semibold">{summary?.patient?.fullName ?? "Perfil clinico"}</h3><p className="text-sm text-slate-500">{procedures.length} procedimentos registrados</p></div>
              <button className="btn-secondary" onClick={generateSummary}>Resumo IA</button>
            </div>
            {aiResult && <pre className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{aiResult}</pre>}
          </div>
          <div className="panel overflow-hidden"><Table headers={["Dente", "Procedimento", "Status"]}>{procedures.map((p) => <tr key={p.id}><td>{p.tooth || p.region || "-"}</td><td>{p.procedureName}</td><td><select value={p.status} onChange={(e) => updateProcedureStatus(p.id, e.target.value)}>{["PLANNED", "IN_PROGRESS", "COMPLETED"].map((s) => <option key={s}>{s}</option>)}</select></td></tr>)}</Table></div>
          <div className="space-y-3">
            {records.map((record) => <div key={record.id} className="panel p-4 text-sm"><p className="font-semibold">{new Date(record.createdAt).toLocaleString("pt-BR")}</p><p>{record.anamnesis}</p><p>{record.treatmentPlan}</p><p>{record.evolutionNotes}</p></div>)}
          </div>
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

function ExamImages({ api, onSaved }: { api: ApiClient; onSaved: (message: string) => void }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [exams, setExams] = useState<ExamImage[]>([]);
  const [patientId, setPatientId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ examType: "Radiografia panoramica", clinicalQuestion: "", precisionLevel: "SPECIALIST", aiQuestion: "" });
  const [selectedResult, setSelectedResult] = useState("");
  useEffect(() => { api.get<Patient[]>("/patients").then(setPatients); }, [api]);
  const load = () => {
    if (patientId) api.get<ExamImage[]>(`/exam-images/patient/${patientId}`).then(setExams);
  };
  useEffect(load, [patientId, api]);
  async function upload(event: FormEvent) {
    event.preventDefault();
    if (!file) return;
    const body = new FormData();
    body.set("patientId", patientId);
    body.set("examType", form.examType);
    body.set("clinicalQuestion", form.clinicalQuestion);
    body.set("file", file);
    await api.upload<ExamImage>("/exam-images", body);
    setFile(null);
    onSaved("Imagem de exame enviada.");
    load();
  }
  async function analyze(examId: string) {
    const response = await api.post<{ exam: ExamImage; analysis: { text: string; provider: string } }>(`/exam-images/${examId}/analyze`, {
      precisionLevel: form.precisionLevel,
      clinicalQuestion: form.clinicalQuestion
    });
    setSelectedResult(response.analysis.text);
    onSaved("Analise visual real registrada.");
    load();
  }
  async function removeExam(exam: ExamImage) {
    const confirmed = window.confirm(`Excluir ${exam.examType} (${exam.fileName})?`);
    if (!confirmed) return;
    await api.delete<void>(`/exam-images/${exam.id}`);
    setSelectedResult("");
    onSaved("Exame excluido.");
    load();
  }
  async function askExamAI(exam: ExamImage) {
    const input = [
      `Tipo de exame: ${exam.examType}`,
      `Arquivo: ${exam.fileName}`,
      `Status da analise: ${exam.analysisStatus}`,
      `Resultado da analise: ${exam.analysisResult || "Sem analise registrada"}`,
      `Pergunta: ${form.aiQuestion}`
    ].join("\n");
    const response = await api.post<{ text: string }>("/ai/generate", {
      featureKey: "specialty-question",
      precisionLevel: form.precisionLevel,
      patientId,
      input
    });
    setSelectedResult(response.text);
    onSaved("Pergunta respondida pela IA.");
  }
  return (
    <Section title="Exames por imagem IA">
      <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
        <form onSubmit={upload} className="panel space-y-3 p-4">
          <Field label="Paciente"><select required value={patientId} onChange={(e) => setPatientId(e.target.value)}><option value="">Selecione</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></Field>
          <Field label="Tipo de exame"><select value={form.examType} onChange={(e) => setForm({ ...form, examType: e.target.value })}><option>Radiografia panoramica</option><option>Radiografia periapical</option><option>Tomografia odontologica</option><option>Foto intraoral</option><option>Outro exame de imagem</option></select></Field>
          <Field label="Pergunta clinica"><textarea rows={4} value={form.clinicalQuestion} onChange={(e) => setForm({ ...form, clinicalQuestion: e.target.value })} /></Field>
          <Field label="Pergunta para IA"><textarea rows={3} value={form.aiQuestion} onChange={(e) => setForm({ ...form, aiQuestion: e.target.value })} /></Field>
          <Field label="Precisao da analise"><select value={form.precisionLevel} onChange={(e) => setForm({ ...form, precisionLevel: e.target.value })}>{["STANDARD", "ADVANCED", "SPECIALIST"].map((level) => <option key={level}>{level}</option>)}</select></Field>
          <Field label="Imagem"><input required type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></Field>
          <button className="btn-primary">Enviar imagem</button>
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">Este modulo exige OpenAI Vision configurado e interpreta pixels da imagem. O resultado e apoio profissional, nao laudo definitivo. A decisao clinica final deve ser tomada por cirurgiao-dentista habilitado.</p>
        </form>
        <div className="space-y-4">
          <div className="panel overflow-hidden">
            <Table headers={["Exame", "Status", "Imagem", "Acoes"]}>
              {exams.map((exam) => (
                <tr key={exam.id}>
                  <td><p className="font-medium">{exam.examType}</p><p className="text-xs text-slate-500">{exam.fileName}</p></td>
                  <td><p>{exam.analysisStatus}</p><p className="text-xs text-slate-500">{exam.analysisProvider || "pendente"}</p></td>
                  <td><a className="text-primary-700" href={exam.fileUrl} target="_blank">Abrir</a></td>
                  <td><div className="flex flex-wrap gap-2"><button className="btn-secondary" onClick={() => analyze(exam.id)}>Analisar</button><button className="btn-secondary" disabled={!form.aiQuestion.trim()} onClick={() => askExamAI(exam)}>Perguntar</button><button className="btn-secondary" onClick={() => removeExam(exam)}>Excluir</button></div></td>
                </tr>
              ))}
            </Table>
          </div>
          {selectedResult && <pre className="panel whitespace-pre-wrap p-4 text-sm">{selectedResult}</pre>}
          {exams.filter((exam) => exam.analysisResult).map((exam) => (
            <div key={`${exam.id}-analysis`} className="panel p-4 text-sm">
              <p className="font-semibold">{exam.examType}</p>
              <pre className="mt-2 whitespace-pre-wrap text-slate-700">{exam.analysisResult}</pre>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function Specialties({ api, modules, session, onSaved }: { api: ApiClient; modules: ModuleItem[]; session: Session; onSaved: (message: string) => void }) {
  const activeSpecialtyModules = modules.filter((module) => module.enabled && module.scope === "SPECIALTY");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedModuleId, setSelectedModuleId] = useState(activeSpecialtyModules[0]?.id ?? "");
  const [entries, setEntries] = useState<Array<Record<string, any>>>([]);
  const [featureRequests, setFeatureRequests] = useState<CustomFeatureRequest[]>([]);
  const [form, setForm] = useState({
    patientId: "",
    title: "",
    notes: "",
    status: "OPEN",
    endodonticSubarea: "clinical-conventional",
    tooth: "",
    diagnosis: "",
    canalNotes: "",
    pulpStatus: "",
    periapicalStatus: "",
    imagingFindings: "",
    endodonticObjective: "",
    implantRegion: "",
    boneAssessment: "",
    prostheticPlan: "",
    surgicalPlan: "",
    implantImaging: "",
    implantRiskFactors: "",
    smileComplaint: "",
    shadeGoal: "",
    toothShapePlan: "",
    aestheticMaterials: "",
    gingivalAesthetics: "",
    digitalSmilePlan: "",
    skeletalClass: "",
    malocclusion: "",
    orthodonticObjectives: "",
    aiQuestion: ""
  });
  const [featureForm, setFeatureForm] = useState({ title: "", description: "", expectedBenefit: "", suggestedMonthlyBudget: "" });
  const [aiResult, setAiResult] = useState("");
  const selectedModule = activeSpecialtyModules.find((module) => module.id === selectedModuleId);
  const selectedEndodonticSubmodule = endodonticSubmodules.find((item) => item.moduleKey === selectedModule?.id);
  const isEndodonticModule = Boolean(selectedEndodonticSubmodule);
  const selectedImplantologySubmodule = implantologySubmodules.find((item) => item.moduleKey === selectedModule?.id);
  const isImplantologyModule = Boolean(selectedImplantologySubmodule);
  const selectedAestheticSubmodule = aestheticSubmodules.find((item) => item.moduleKey === selectedModule?.id);
  const isAestheticModule = Boolean(selectedAestheticSubmodule);
  useEffect(() => { api.get<Patient[]>("/patients").then(setPatients); }, [api]);
  const loadEntries = () => {
    if (selectedModuleId) api.get<Array<Record<string, any>>>(`/module-workspace/${selectedModuleId}`).then(setEntries);
  };
  const loadFeatureRequests = () => {
    if (selectedModuleId) api.get<CustomFeatureRequest[]>(`/custom-features?moduleId=${selectedModuleId}`).then(setFeatureRequests);
  };
  useEffect(loadEntries, [api, selectedModuleId]);
  useEffect(loadFeatureRequests, [api, selectedModuleId]);
  useEffect(() => {
    if (!selectedModuleId && activeSpecialtyModules[0]) setSelectedModuleId(activeSpecialtyModules[0].id);
  }, [activeSpecialtyModules.length, selectedModuleId]);
  async function save(event: FormEvent) {
    event.preventDefault();
    await api.post("/module-workspace", {
      moduleId: selectedModuleId,
      patientId: form.patientId || undefined,
      title: form.title,
      notes: buildSpecialtyNotes(),
      status: form.status
    });
    setForm({
      patientId: "",
      title: "",
      notes: "",
      status: "OPEN",
      endodonticSubarea: "clinical-conventional",
      tooth: "",
      diagnosis: "",
      canalNotes: "",
      pulpStatus: "",
      periapicalStatus: "",
      imagingFindings: "",
      endodonticObjective: "",
      implantRegion: "",
      boneAssessment: "",
      prostheticPlan: "",
      surgicalPlan: "",
      implantImaging: "",
      implantRiskFactors: "",
      smileComplaint: "",
      shadeGoal: "",
      toothShapePlan: "",
      aestheticMaterials: "",
      gingivalAesthetics: "",
      digitalSmilePlan: "",
      skeletalClass: "",
      malocclusion: "",
      orthodonticObjectives: "",
      aiQuestion: ""
    });
    onSaved("Registro do modulo salvo.");
    loadEntries();
  }
  function buildSpecialtyNotes() {
    if (isEndodonticModule) {
      return [
        `Submodulo endodontico: ${selectedEndodonticSubmodule?.label || "Nao informado"}`,
        `Escopo: ${selectedEndodonticSubmodule?.description || "Nao informado"}`,
        `Dente/regiao: ${form.tooth || "Nao informado"}`,
        `Hipotese diagnostica: ${form.diagnosis || "Nao informado"}`,
        `Status pulpar: ${form.pulpStatus || "Nao informado"}`,
        `Status periapical: ${form.periapicalStatus || "Nao informado"}`,
        `Achados de imagem: ${form.imagingFindings || "Nao informado"}`,
        `Objetivo endodontico: ${form.endodonticObjective || "Nao informado"}`,
        `Canais/testes/observacoes: ${form.canalNotes || "Nao informado"}`,
        `Notas gerais: ${form.notes || "Nao informado"}`
      ].join("\n");
    }
    if (selectedModule?.id === "orthodontics-planning") {
      return [
        `Classe esqueletica/relacao sagital: ${form.skeletalClass || "Nao informado"}`,
        `Maloclusao e achados principais: ${form.malocclusion || "Nao informado"}`,
        `Objetivos ortodonticos: ${form.orthodonticObjectives || "Nao informado"}`,
        `Notas gerais: ${form.notes || "Nao informado"}`
      ].join("\n");
    }
    if (isImplantologyModule) {
      return [
        `Submodulo de implantodontia: ${selectedImplantologySubmodule?.label || "Nao informado"}`,
        `Escopo: ${selectedImplantologySubmodule?.description || "Nao informado"}`,
        `Regiao/elementos: ${form.implantRegion || "Nao informado"}`,
        `Avaliacao ossea: ${form.boneAssessment || "Nao informado"}`,
        `Planejamento protetico: ${form.prostheticPlan || "Nao informado"}`,
        `Planejamento cirurgico: ${form.surgicalPlan || "Nao informado"}`,
        `Achados de imagem/CBCT: ${form.implantImaging || "Nao informado"}`,
        `Fatores de risco e manutencao: ${form.implantRiskFactors || "Nao informado"}`,
        `Notas gerais: ${form.notes || "Nao informado"}`
      ].join("\n");
    }
    if (isAestheticModule) {
      return [
        `Submodulo de odontologia estetica: ${selectedAestheticSubmodule?.label || "Nao informado"}`,
        `Escopo: ${selectedAestheticSubmodule?.description || "Nao informado"}`,
        `Queixa/objetivo estetico: ${form.smileComplaint || "Nao informado"}`,
        `Meta de cor/clareamento: ${form.shadeGoal || "Nao informado"}`,
        `Forma, proporcao e reanatomizacao: ${form.toothShapePlan || "Nao informado"}`,
        `Materiais e tecnica: ${form.aestheticMaterials || "Nao informado"}`,
        `Estetica gengival: ${form.gingivalAesthetics || "Nao informado"}`,
        `Planejamento digital/DSD/IA: ${form.digitalSmilePlan || "Nao informado"}`,
        `Notas gerais: ${form.notes || "Nao informado"}`
      ].join("\n");
    }
    return form.notes;
  }
  function buildSpecialtyAIInput() {
    const patient = patients.find((item) => item.id === form.patientId);
    const recentEntries = entries
      .slice(0, 5)
      .map((entry) => `- ${entry.title} (${entry.status}): ${entry.notes}`)
      .join("\n");
    return [
      `Especialidade: ${selectedModule?.specialtyName}`,
      `Modulo: ${selectedModule?.name}`,
      `Paciente: ${patient?.fullName ?? "Nao vinculado"}`,
      isEndodonticModule ? "Nota tecnica: Endodontia nao se subdivide oficialmente em especialidades formais pelo CFO; os submodulos organizam frentes clinicas e cientificas para cobranca, fluxo e analise." : "",
      isEndodonticModule ? `Submodulo endodontico: ${selectedEndodonticSubmodule?.label || "Nao informado"}` : "",
      isEndodonticModule ? `Escopo do submodulo: ${selectedEndodonticSubmodule?.description || "Nao informado"}` : "",
      isEndodonticModule ? `Dente/regiao: ${form.tooth || "Nao informado"}` : "",
      isEndodonticModule ? `Hipotese diagnostica: ${form.diagnosis || "Nao informado"}` : "",
      isEndodonticModule ? `Status pulpar: ${form.pulpStatus || "Nao informado"}` : "",
      isEndodonticModule ? `Status periapical: ${form.periapicalStatus || "Nao informado"}` : "",
      isEndodonticModule ? `Achados de imagem: ${form.imagingFindings || "Nao informado"}` : "",
      isEndodonticModule ? `Objetivo endodontico: ${form.endodonticObjective || "Nao informado"}` : "",
      isEndodonticModule ? `Canais/testes/observacoes: ${form.canalNotes || "Nao informado"}` : "",
      isImplantologyModule ? "Nota tecnica: Implantodontia e uma especialidade formal; estes itens sao submodulos funcionais e comerciais para organizar fluxo, cobranca e analise." : "",
      isImplantologyModule ? `Submodulo de implantodontia: ${selectedImplantologySubmodule?.label || "Nao informado"}` : "",
      isImplantologyModule ? `Escopo do submodulo: ${selectedImplantologySubmodule?.description || "Nao informado"}` : "",
      isImplantologyModule ? `Regiao/elementos: ${form.implantRegion || "Nao informado"}` : "",
      isImplantologyModule ? `Avaliacao ossea: ${form.boneAssessment || "Nao informado"}` : "",
      isImplantologyModule ? `Planejamento protetico: ${form.prostheticPlan || "Nao informado"}` : "",
      isImplantologyModule ? `Planejamento cirurgico: ${form.surgicalPlan || "Nao informado"}` : "",
      isImplantologyModule ? `Achados de imagem/CBCT: ${form.implantImaging || "Nao informado"}` : "",
      isImplantologyModule ? `Fatores de risco e manutencao: ${form.implantRiskFactors || "Nao informado"}` : "",
      isAestheticModule ? "Nota tecnica: Odontologia Estetica/Dentistica Estetica usa submodulos funcionais e comerciais para organizar fluxo, cobranca e analise." : "",
      isAestheticModule ? `Submodulo de odontologia estetica: ${selectedAestheticSubmodule?.label || "Nao informado"}` : "",
      isAestheticModule ? `Escopo do submodulo: ${selectedAestheticSubmodule?.description || "Nao informado"}` : "",
      isAestheticModule ? `Queixa/objetivo estetico: ${form.smileComplaint || "Nao informado"}` : "",
      isAestheticModule ? `Meta de cor/clareamento: ${form.shadeGoal || "Nao informado"}` : "",
      isAestheticModule ? `Forma, proporcao e reanatomizacao: ${form.toothShapePlan || "Nao informado"}` : "",
      isAestheticModule ? `Materiais e tecnica: ${form.aestheticMaterials || "Nao informado"}` : "",
      isAestheticModule ? `Estetica gengival: ${form.gingivalAesthetics || "Nao informado"}` : "",
      isAestheticModule ? `Planejamento digital/DSD/IA: ${form.digitalSmilePlan || "Nao informado"}` : "",
      selectedModule?.id === "orthodontics-planning" ? `Classe esqueletica/relacao sagital: ${form.skeletalClass || "Nao informado"}` : "",
      selectedModule?.id === "orthodontics-planning" ? `Maloclusao e achados principais: ${form.malocclusion || "Nao informado"}` : "",
      selectedModule?.id === "orthodontics-planning" ? `Objetivos ortodonticos: ${form.orthodonticObjectives || "Nao informado"}` : "",
      `Registro atual: ${form.title || "Sem titulo"}`,
      `Notas atuais: ${form.notes || "Sem notas"}`,
      `Historico recente do modulo:\n${recentEntries || "Sem historico"}`,
      `Pergunta para IA: ${form.aiQuestion || "Realize uma analise tecnica do caso e sugira proximos passos."}`
    ]
      .filter(Boolean)
      .join("\n");
  }
  async function runSpecialtyAI(featureKey: "specialty-analysis" | "specialty-question") {
    const response = await api.post<{ text: string }>("/ai/generate", {
      featureKey,
      precisionLevel: "ADVANCED",
      patientId: form.patientId || undefined,
      input: buildSpecialtyAIInput()
    });
    setAiResult(response.text);
    onSaved(featureKey === "specialty-analysis" ? "Analise da especialidade gerada." : "Pergunta respondida pela IA.");
  }
  async function requestCustomFeature(event: FormEvent) {
    event.preventDefault();
    if (!selectedModule) return;
    await api.post("/custom-features", {
      moduleId: selectedModule.id,
      specialtyKey: selectedModule.specialtyKey,
      specialtyName: selectedModule.specialtyName,
      title: featureForm.title,
      description: featureForm.description,
      expectedBenefit: featureForm.expectedBenefit,
      suggestedMonthlyBudget: featureForm.suggestedMonthlyBudget ? Number(featureForm.suggestedMonthlyBudget) : undefined
    });
    setFeatureForm({ title: "", description: "", expectedBenefit: "", suggestedMonthlyBudget: "" });
    onSaved("Solicitacao enviada para analise.");
    loadFeatureRequests();
  }
  function customFeatureStatusLabel(request: CustomFeatureRequest) {
    if (request.status === "REQUESTED") return "EM ANALISE PELA LEO-TECH";
    if (request.status === "APPROVED" && request.approvedForUserId === session.user.id) return "ADICIONADA PARA VOCE";
    if (request.status === "APPROVED") return "APROVADA PELA LEO-TECH";
    if (request.status === "REJECTED") return "NAO APROVADA";
    return request.status;
  }
  if (!activeSpecialtyModules.length) return <Section title="Especialidades"><p>Nenhum modulo de especialidade ativo.</p></Section>;
  return (
    <Section title="Especialidades">
      <div className="mb-4 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {activeSpecialtyModules.map((module) => (
          <button key={module.id} className={selectedModuleId === module.id ? "btn-primary whitespace-nowrap" : "btn-secondary whitespace-nowrap"} onClick={() => setSelectedModuleId(module.id)}>
            {module.name}
          </button>
        ))}
      </div>
      {selectedModule && (
        <div className="grid gap-4 xl:grid-cols-[420px_1fr]">
          <form onSubmit={save} className="panel space-y-3 p-4">
            <div>
              <p className="text-xs font-semibold text-primary-700">{selectedModule.specialtyName}</p>
              <h3 className="font-semibold">{selectedModule.name}</h3>
              <p className="mt-1 text-sm text-slate-500">{selectedModule.description}</p>
            </div>
            {selectedModule.id === "exam-images-ai" && <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-600">Este modulo tambem possui a tela dedicada Exames IA para upload e analise visual real.</p>}
            <Field label="Paciente"><select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}><option value="">Sem paciente</option>{patients.map((patient) => <option key={patient.id} value={patient.id}>{patient.fullName}</option>)}</select></Field>
            {isEndodonticModule && (
              <>
                <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">A Endodontia nao se subdivide oficialmente em especialidades formais pelo CFO. Este item e tratado como submodulo comercial e funcional dentro da especialidade.</p>
                <p className="rounded-md bg-primary-50 p-3 text-xs text-primary-800">{selectedEndodonticSubmodule?.description} Custo do submodulo: {money(selectedEndodonticSubmodule?.monthlyPrice ?? selectedModule.basePrice)} / mes.</p>
                <Field label="Dente/regiao"><input value={form.tooth} onChange={(e) => setForm({ ...form, tooth: e.target.value })} /></Field>
                <Field label="Hipotese diagnostica"><input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} /></Field>
                <Field label="Status pulpar"><input value={form.pulpStatus} onChange={(e) => setForm({ ...form, pulpStatus: e.target.value })} placeholder="Ex.: pulpite irreversivel, necrose, polpa normal..." /></Field>
                <Field label="Status periapical"><input value={form.periapicalStatus} onChange={(e) => setForm({ ...form, periapicalStatus: e.target.value })} placeholder="Ex.: normal, periodontite apical, abscesso..." /></Field>
                <Field label="Achados de imagem"><textarea rows={3} value={form.imagingFindings} onChange={(e) => setForm({ ...form, imagingFindings: e.target.value })} placeholder="Radiografia, CBCT, rarefacao, reabsorcao, anatomia radicular..." /></Field>
                <Field label="Objetivo endodontico"><textarea rows={3} value={form.endodonticObjective} onChange={(e) => setForm({ ...form, endodonticObjective: e.target.value })} placeholder="Tratamento, retratamento, preservacao de vitalidade, regeneracao, cirurgia..." /></Field>
                <Field label="Canais, testes e observacoes"><textarea rows={4} value={form.canalNotes} onChange={(e) => setForm({ ...form, canalNotes: e.target.value })} /></Field>
              </>
            )}
            {selectedModule.id === "orthodontics-planning" && (
              <>
                <Field label="Classe esqueletica / relacao sagital"><input value={form.skeletalClass} onChange={(e) => setForm({ ...form, skeletalClass: e.target.value })} placeholder="Ex.: Classe I, Classe II, Classe III" /></Field>
                <Field label="Maloclusao e achados principais"><textarea rows={4} value={form.malocclusion} onChange={(e) => setForm({ ...form, malocclusion: e.target.value })} placeholder="Apinhamento, mordida aberta, sobremordida, mordida cruzada..." /></Field>
                <Field label="Objetivos ortodonticos"><textarea rows={4} value={form.orthodonticObjectives} onChange={(e) => setForm({ ...form, orthodonticObjectives: e.target.value })} placeholder="Alinhamento, nivelamento, correcao transversal, controle vertical..." /></Field>
              </>
            )}
            {isImplantologyModule && (
              <>
                <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">A Implantodontia e uma especialidade formal; este item e tratado como submodulo comercial e funcional para fluxo, cobranca e analise especifica.</p>
                <p className="rounded-md bg-primary-50 p-3 text-xs text-primary-800">{selectedImplantologySubmodule?.description} Custo do submodulo: {money(selectedImplantologySubmodule?.monthlyPrice ?? selectedModule.basePrice)} / mes.</p>
                <Field label="Regiao / elementos"><input value={form.implantRegion} onChange={(e) => setForm({ ...form, implantRegion: e.target.value })} placeholder="Ex.: 11, 21, posterior mandibula, protocolo superior..." /></Field>
                <Field label="Avaliacao ossea"><textarea rows={3} value={form.boneAssessment} onChange={(e) => setForm({ ...form, boneAssessment: e.target.value })} placeholder="Volume, densidade, altura, espessura, necessidade de enxerto..." /></Field>
                <Field label="Planejamento protetico"><textarea rows={3} value={form.prostheticPlan} onChange={(e) => setForm({ ...form, prostheticPlan: e.target.value })} placeholder="Coroa, protocolo, carga, oclusao, perfil de emergencia..." /></Field>
                <Field label="Planejamento cirurgico"><textarea rows={3} value={form.surgicalPlan} onChange={(e) => setForm({ ...form, surgicalPlan: e.target.value })} placeholder="Tecnica, implante imediato, guia cirurgico, sinus lift, split crest..." /></Field>
                <Field label="Achados de imagem / CBCT"><textarea rows={3} value={form.implantImaging} onChange={(e) => setForm({ ...form, implantImaging: e.target.value })} placeholder="CBCT, canal mandibular, seio maxilar, cortical, defeitos osseos..." /></Field>
                <Field label="Fatores de risco e manutencao"><textarea rows={3} value={form.implantRiskFactors} onChange={(e) => setForm({ ...form, implantRiskFactors: e.target.value })} placeholder="Tabagismo, diabetes, peri-implantite, higiene, manutencao..." /></Field>
              </>
            )}
            {isAestheticModule && (
              <>
                <p className="rounded-md bg-slate-50 p-3 text-xs text-slate-600">A Odontologia Estetica/Dentistica Estetica e organizada aqui em submodulos comerciais e funcionais para fluxo, cobranca e analise especifica.</p>
                <p className="rounded-md bg-primary-50 p-3 text-xs text-primary-800">{selectedAestheticSubmodule?.description} Custo do submodulo: {money(selectedAestheticSubmodule?.monthlyPrice ?? selectedModule.basePrice)} / mes.</p>
                <Field label="Queixa / objetivo estetico"><textarea rows={3} value={form.smileComplaint} onChange={(e) => setForm({ ...form, smileComplaint: e.target.value })} placeholder="Cor, forma, diastema, fratura, proporcao, harmonia do sorriso..." /></Field>
                <Field label="Meta de cor / clareamento"><input value={form.shadeGoal} onChange={(e) => setForm({ ...form, shadeGoal: e.target.value })} placeholder="Ex.: A1, BL2, clareamento interno, caseiro..." /></Field>
                <Field label="Forma, proporcao e reanatomizacao"><textarea rows={3} value={form.toothShapePlan} onChange={(e) => setForm({ ...form, toothShapePlan: e.target.value })} placeholder="Formato dental, largura/altura, borda incisal, fechamento de diastemas..." /></Field>
                <Field label="Materiais e tecnica"><textarea rows={3} value={form.aestheticMaterials} onChange={(e) => setForm({ ...form, aestheticMaterials: e.target.value })} placeholder="Resina composta, ceramica, faceta, lente, CAD/CAM..." /></Field>
                <Field label="Estetica gengival"><textarea rows={3} value={form.gingivalAesthetics} onChange={(e) => setForm({ ...form, gingivalAesthetics: e.target.value })} placeholder="Sorriso gengival, zenite, gengivoplastia, contorno gengival..." /></Field>
                <Field label="Planejamento digital / DSD / IA"><textarea rows={3} value={form.digitalSmilePlan} onChange={(e) => setForm({ ...form, digitalSmilePlan: e.target.value })} placeholder="Fotos, DSD, mockup, simulacao, previsao de resultado por IA..." /></Field>
              </>
            )}
            <Field label="Titulo"><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></Field>
            <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{["OPEN", "IN_PROGRESS", "DONE"].map((status) => <option key={status}>{status}</option>)}</select></Field>
            <Field label="Notas do modulo"><textarea required rows={6} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></Field>
            <Field label="Pergunta para IA"><textarea rows={4} value={form.aiQuestion} onChange={(e) => setForm({ ...form, aiQuestion: e.target.value })} /></Field>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary">Salvar registro</button>
              <button type="button" className="btn-secondary" onClick={() => runSpecialtyAI("specialty-analysis")}>Analisar IA</button>
              <button type="button" className="btn-secondary" disabled={!form.aiQuestion.trim()} onClick={() => runSpecialtyAI("specialty-question")}>Perguntar IA</button>
            </div>
            <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">Conteudo gerado por IA para apoio profissional. A decisao clinica final deve ser tomada por cirurgiao-dentista habilitado.</p>
          </form>
          <div className="space-y-4">
            <div className="panel p-4">
              <div className="mb-3">
                <p className="text-xs font-semibold text-primary-700">Balcao LEO-Tech</p>
                <h3 className="font-semibold">Extras personalizados</h3>
                <p className="mt-1 text-sm text-slate-500">Solicite uma funcionalidade especifica para esta especialidade. A equipe LEO-Tech analisa com especialistas em odontologia e, se aprovar, adiciona o recurso somente para o usuario solicitante com custo mensal adicional.</p>
              </div>
              <form onSubmit={requestCustomFeature} className="grid gap-3 lg:grid-cols-2">
                <Field label="Funcionalidade desejada"><input required value={featureForm.title} onChange={(e) => setFeatureForm({ ...featureForm, title: e.target.value })} placeholder="Ex.: checklist de caso complexo" /></Field>
                <Field label="Orcamento mensal sugerido"><input type="number" min="0" step="0.01" value={featureForm.suggestedMonthlyBudget} onChange={(e) => setFeatureForm({ ...featureForm, suggestedMonthlyBudget: e.target.value })} /></Field>
                <Field label="Descricao"><textarea required rows={3} value={featureForm.description} onChange={(e) => setFeatureForm({ ...featureForm, description: e.target.value })} /></Field>
                <Field label="Beneficio esperado"><textarea required rows={3} value={featureForm.expectedBenefit} onChange={(e) => setFeatureForm({ ...featureForm, expectedBenefit: e.target.value })} /></Field>
                <div className="lg:col-span-2"><button className="btn-primary">Enviar para LEO-Tech</button></div>
              </form>
            </div>
            <div className="panel overflow-hidden">
              <Table headers={["Funcionalidade", "Solicitante", "Status", "Custo", "Retorno LEO-Tech"]}>
                {featureRequests.map((request) => (
                  <tr key={request.id}>
                    <td><p className="font-medium">{request.title}</p><p className="text-xs text-slate-500">{request.description}</p></td>
                    <td>{request.requestedBy?.name ?? request.requestedBy?.email ?? request.requestedById}</td>
                    <td>{customFeatureStatusLabel(request)}</td>
                    <td>{money(String(request.monthlyPrice ?? 0))}</td>
                    <td>{request.reviewNotes ? <span className="text-sm text-slate-600">{request.reviewNotes}</span> : <span className="text-sm text-slate-500">Aguardando analise tecnica.</span>}</td>
                  </tr>
                ))}
              </Table>
            </div>
            {aiResult && <pre className="panel whitespace-pre-wrap p-4 text-sm">{aiResult}</pre>}
            <div className="panel overflow-hidden">
              <Table headers={["Data", "Paciente", "Titulo", "Status"]}>
                {entries.map((entry) => (
                  <tr key={String(entry.id)}>
                    <td>{entry.createdAt ? new Date(String(entry.createdAt)).toLocaleString("pt-BR") : ""}</td>
                    <td>{String(entry.patient?.fullName ?? "-")}</td>
                    <td><p className="font-medium">{String(entry.title)}</p><p className="text-xs text-slate-500 whitespace-pre-wrap">{String(entry.notes)}</p></td>
                    <td>{String(entry.status)}</td>
                  </tr>
                ))}
              </Table>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

function Modules({ api, onSaved }: { api: ApiClient; onSaved: (message: string) => void }) {
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [activeGroup, setActiveGroup] = useState("common");
  const load = () => api.get<typeof modules>("/modules").then(setModules);
  useEffect(() => {
    load();
  }, []);
  async function toggle(id: string, enabled: boolean) {
    await api.patch(`/modules/${id}`, { enabled });
    onSaved(enabled ? "Modulo ativado." : "Modulo desativado.");
    load();
  }
  const groups = [
    { key: "common", label: "Comuns", count: modules.filter((module) => (module.scope ?? "COMMON") === "COMMON").length },
    ...Array.from(
      new Map(
        modules
          .filter((module) => module.scope === "SPECIALTY")
          .map((module) => [module.specialtyKey ?? "specialty", { key: module.specialtyKey ?? "specialty", label: module.specialtyName ?? "Especialidade", count: 0 }])
      ).values()
    ).map((group) => ({ ...group, count: modules.filter((module) => module.specialtyKey === group.key).length }))
  ];
  const visibleModules = modules.filter((module) =>
    activeGroup === "common" ? (module.scope ?? "COMMON") === "COMMON" : module.specialtyKey === activeGroup
  );
  return (
    <Section title="Modulos disponiveis">
      <div className="mb-4 flex gap-2 overflow-x-auto border-b border-slate-200 pb-2">
        {groups.map((group) => (
          <button
            key={group.key}
            className={activeGroup === group.key ? "btn-primary whitespace-nowrap" : "btn-secondary whitespace-nowrap"}
            onClick={() => setActiveGroup(group.key)}
          >
            {group.label} ({group.count})
          </button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {visibleModules.map((m) => (
          <div key={m.id} className="panel p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold text-primary-700">{m.scope === "SPECIALTY" ? m.specialtyName : "Comum"} · {m.category}</p>
                <h3 className="mt-1 font-semibold">{m.name}</h3>
              </div>
              <label className="flex items-center gap-2 normal-case tracking-normal">
                <input className="h-4 w-4" type="checkbox" checked={m.enabled} onChange={(e) => toggle(m.id, e.target.checked)} />Ativo
              </label>
            </div>
            <p className="mt-3 text-sm text-slate-600">{m.description}</p>
            <p className="mt-3 text-sm font-semibold">{money(m.basePrice)}</p>
          </div>
        ))}
      </div>
    </Section>
  );
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
          <Field label="Funcao"><select value={form.featureKey} onChange={(e) => setForm({ ...form, featureKey: e.target.value })}><option value="record-summary">Resumo do prontuario</option><option value="clinical-report">Relatorio clinico</option><option value="patient-guidance">Orientacao ao paciente</option><option value="specialty-question">Pergunta livre por especialidade</option></select></Field>
          <Field label="Precisao"><select value={form.precisionLevel} onChange={(e) => setForm({ ...form, precisionLevel: e.target.value })}>{["BASIC", "STANDARD", "ADVANCED", "SPECIALIST"].map((p) => <option key={p}>{p}</option>)}</select></Field>
          <Field label="Paciente"><select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })}><option value="">Sem paciente</option>{patients.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}</select></Field>
          <Field label="Entrada"><textarea required rows={7} value={form.input} onChange={(e) => setForm({ ...form, input: e.target.value })} /></Field>
          <button className="btn-primary">Gerar com IA</button>
          <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">Perguntas para IA sao cobradas por pergunta realizada, mesmo quando o assunto envolver uma especialidade cujo modulo nao esteja ativo. Conteudo gerado por IA e apoio profissional; a decisao clinica final deve ser tomada por cirurgiao-dentista habilitado.</p>
        </form>
        <div className="space-y-4">
          {result && <pre className="panel whitespace-pre-wrap p-4 text-sm">{result}</pre>}
          <div className="panel overflow-hidden"><Table headers={["Funcao", "Tipo", "Precisao", "Tokens", "Custo"]}>{logs.map((log) => <tr key={String(log.id)}><td>{String(log.featureKey)}</td><td>{String(log.featureKey) === "specialty-question" ? "Pergunta cobrada" : "Consumo"}</td><td>{String(log.precisionLevel)}</td><td>{String(log.totalTokens)}</td><td>{money(String(log.estimatedCost))}</td></tr>)}</Table></div>
        </div>
      </div>
    </Section>
  );
}

function Billing({ api }: { api: ApiClient }) {
  const [estimate, setEstimate] = useState<Record<string, any> | null>(null);
  const [events, setEvents] = useState<Array<Record<string, any>>>([]);
  const [invoice, setInvoice] = useState<Record<string, any> | null>(null);
  const [subscription, setSubscription] = useState<Record<string, any> | null>(null);
  const [checkout, setCheckout] = useState<Record<string, any> | null>(null);
  const [busy, setBusy] = useState(false);
  const loadBilling = () => {
    api.get<Record<string, any>>("/billing/estimate").then(setEstimate);
    api.get<Array<Record<string, any>>>("/billing/events").then(setEvents);
    api.get<Record<string, any>>("/billing/invoice/current").then(setInvoice);
    api.get<{ subscription: Record<string, any> | null }>("/subscription/current").then((data) => setSubscription(data.subscription));
  };
  useEffect(() => {
    loadBilling();
  }, [api]);
  async function startCheckout() {
    setBusy(true);
    try {
      const response = await api.post<{ checkout: Record<string, any>; subscription: Record<string, any> | null }>("/subscription/checkout", {});
      setCheckout(response.checkout);
      setSubscription(response.subscription);
      loadBilling();
    } finally {
      setBusy(false);
    }
  }
  async function activateMock() {
    setBusy(true);
    try {
      const response = await api.post<{ subscription: Record<string, any> }>("/subscription/mock/activate", { confirm: true });
      setSubscription(response.subscription);
      setCheckout(null);
      loadBilling();
    } finally {
      setBusy(false);
    }
  }
  if (!estimate) return <Section title="Cobranca"><p>Carregando...</p></Section>;
  return (
    <Section title="Fatura estimada">
      <div className="panel mb-4 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-900">Politica: mensalidade por ciclo, sem pro-rata no MVP.</p>
        <p>Ativacao cobra o modulo no ciclo atual. Desativacao remove renovacao no proximo ciclo. IA, perguntas para IA e storage entram como consumo.</p>
        <p>Perguntas para IA sao cobradas por pergunta, independentemente da especialidade perguntada estar ativa como modulo.</p>
        <p className="mt-2">Ciclo atual: {new Date(String(estimate.cycleStart)).toLocaleDateString("pt-BR")} ate {new Date(String(estimate.cycleEnd)).toLocaleDateString("pt-BR")}</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Price label="Plano base" value={estimate.basePlanPrice} />
        <Price label="Mensalidade dos modulos" value={estimate.activeModulesPrice} />
        <Price label="Extras personalizados" value={estimate.customFeaturesPrice ?? 0} />
        <Price label="Storage do ciclo" value={estimate.storagePrice} />
        <Price label="IA por tokens" value={estimate.aiOtherUsagePrice ?? estimate.aiUsagePrice} />
        <Price label={`Perguntas IA (${estimate.aiQuestionsThisMonth ?? 0})`} value={estimate.aiQuestionPrice ?? 0} />
        <Price label="Seguranca" value={estimate.securityPrice} />
        <Price label="Total estimado" value={estimate.monthlyPrice} highlight />
      </div>
      <div className="panel mt-4 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="font-semibold">Assinatura</h3>
            <p className="mt-1 text-sm text-slate-500">
              Status {String(subscription?.status ?? "NAO_INICIADA")} via {String(subscription?.provider ?? "mock")}.
            </p>
            {subscription && (
              <p className="mt-1 text-sm text-slate-500">
                Periodo: {new Date(String(subscription.currentPeriodStart)).toLocaleDateString("pt-BR")} ate{" "}
                {new Date(String(subscription.currentPeriodEnd)).toLocaleDateString("pt-BR")}. Valor {money(String(subscription.monthlyAmount ?? 0))}.
              </p>
            )}
            {checkout && <p className="mt-2 rounded-md bg-slate-50 p-3 text-sm text-slate-600">Checkout mock criado: {String(checkout.checkoutUrl)}</p>}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button className="btn-secondary" disabled={busy} onClick={startCheckout}>
              Criar checkout
            </button>
            <button className="btn-primary" disabled={busy} onClick={activateMock}>
              Ativar mock
            </button>
          </div>
        </div>
      </div>
      {invoice && (
        <div className="panel mt-4 overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <h3 className="font-semibold">Pre-fatura do ciclo</h3>
            <p className="text-sm text-slate-500">Status {String(invoice.status)}. Pronta para futura integracao com gateway de pagamento.</p>
          </div>
          <Table headers={["Item", "Descricao", "Valor"]}>
            {(invoice.items ?? []).map((item: any) => (
              <tr key={String(item.type)}>
                <td>{String(item.type)}</td>
                <td>{String(item.description)}</td>
                <td>{money(String(item.amount ?? 0))}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
      <div className="panel mt-4 overflow-hidden">
        <Table headers={["Evento", "Descricao", "Valor", "Data"]}>
          {events.map((event) => (
            <tr key={String(event.id)}>
              <td>{String(event.eventType)}</td>
              <td>{String(event.description)}</td>
              <td>{money(String(event.amount ?? 0))}</td>
              <td>{event.createdAt ? new Date(String(event.createdAt)).toLocaleString("pt-BR") : ""}</td>
            </tr>
          ))}
        </Table>
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
