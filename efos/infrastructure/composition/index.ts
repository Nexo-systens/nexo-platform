// Infrastructure — Composition Root. Ver README.md deste diretorio.
// DefaultInfrastructureContainer (Mission 038) monta SupabaseClient →
// SupabasePersistenceClient → SupabaseExecutionRepository →
// DefaultEFOSContainer, expondo apenas getContainer(): EFOSContainer.
export * from "./DefaultInfrastructureContainer";
