// EFOS Platform — Context. Ver README.md deste diretorio.
// FinancialContextBuilder/DefaultFinancialContextBuilder (Mission 052) e
// a camada oficial de consolidacao de contexto financeiro entre
// documentos — nunca executa o Pipeline, nunca cria ou altera
// documento/linha/valor/data/label/currency/classificacao/hint; apenas
// confirma relacoes ja existentes (diagnostico interno descartado) e
// organiza a colecao de documentos de forma deterministica.
export * from "./FinancialContextBuilder";
export * from "./DefaultFinancialContextBuilder";
