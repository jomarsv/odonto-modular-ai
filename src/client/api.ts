const API_BASE = "/api";

export type Session = {
  token: string;
  user: { id: string; name: string; email: string; role: string; clinicId: string };
  clinic: { id: string; name: string };
};

export class ApiClient {
  constructor(private getToken: () => string | null) {}

  async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers = new Headers(options.headers);
    if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ message: "Erro inesperado." }));
      const fallback =
        response.status === 403
          ? "Sem permissao ou modulo inativo para esta acao."
          : response.status === 401
            ? "Sessao expirada ou credenciais invalidas."
            : "Erro inesperado.";
      throw new Error(body.message ?? fallback);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }

  get<T>(path: string) {
    return this.request<T>(path);
  }

  post<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "POST", body: JSON.stringify(body) });
  }

  put<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "PUT", body: JSON.stringify(body) });
  }

  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, { method: "PATCH", body: JSON.stringify(body) });
  }

  delete<T>(path: string) {
    return this.request<T>(path, { method: "DELETE" });
  }

  upload<T>(path: string, formData: FormData) {
    return this.request<T>(path, { method: "POST", body: formData });
  }
}
