// EFOS Infrastructure Layer — ponto de entrada. Ver README.md deste
// diretorio. Estrutura criada na Mission 029; cada subpasta exporta o
// que existir. `composition/` (Mission 038) é o Composition Root
// oficial que liga um SupabaseClient já criado a um EFOSContainer.
export * from "./repositories";
export * from "./providers";
export * from "./storage";
export * from "./shared";
export * from "./composition";
