/**
 * Mission 156 — Synthetic Company Validation Foundation.
 *
 * `SyntheticCompanyDefinition` é a identidade de uma empresa fictícia
 * usada exclusivamente para validar o EFOS contra dados determinísticos
 * — nunca uma entidade `Company`/`CompanyAggregate` de domínio (Etapa
 * 1/A da auditoria: `Company` existe no Domain, mas nenhum dos 10
 * Engines do pipeline oficial a consome — todo Engine opera só sobre
 * `companyId: string`; construir um `Company` completo aqui seria um
 * conceito paralelo desnecessário, nunca usado pelo caminho real).
 * `companyId` aqui é apenas a mesma string opaca que qualquer Engine já
 * aceita — nunca um novo mecanismo de identidade.
 */
export interface SyntheticCompanyDefinition {
  readonly companyId: string;
  readonly scenarioId: string;
  readonly legalName: string;
  readonly industry: string;
  readonly businessModel: string;
  readonly executiveDescription: string;
  /** Sempre BRL nesta versão — nenhuma conversão de moeda modelada. */
  readonly currency: string;
  readonly fiscalCalendar: {
    readonly periodType: "monthly";
    readonly firstPeriodStart: string; // ISO date
  };
}
