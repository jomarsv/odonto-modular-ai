export type UserRole = "ADMIN" | "DENTIST" | "ASSISTANT" | "CLINIC_MANAGER" | "LEO_TECH_ADMIN";
export type AppointmentStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELED" | "NO_SHOW";
export type ModuleCategory = "ADMINISTRATIVE" | "CLINICAL" | "AI" | "FINANCIAL" | "SPECIALTY" | "SECURITY";
export type AIPrecisionLevel = "BASIC" | "STANDARD" | "ADVANCED" | "SPECIALIST";

export const userRoles = ["ADMIN", "DENTIST", "ASSISTANT", "CLINIC_MANAGER", "LEO_TECH_ADMIN"] as const;
export const appointmentStatuses = ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELED", "NO_SHOW"] as const;
export const aiPrecisionLevels = ["BASIC", "STANDARD", "ADVANCED", "SPECIALIST"] as const;
