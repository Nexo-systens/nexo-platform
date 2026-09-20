export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type CompanyStatus = "active" | "archived";

export type CompanyTaxRegime =
  | "mei"
  | "simples_nacional"
  | "lucro_presumido"
  | "lucro_real";

export type CompanySize = "mei" | "micro" | "pequena" | "media" | "grande";

export type DocumentStatus = "uploaded" | "processing" | "processed" | "failed";

export type DiagnosisReviewStatus =
  | "ACCEPTED"
  | "PARTIALLY_ACCEPTED"
  | "REJECTED"
  | "SUPERSEDED";

// Sufixo "Row" (ao contrário de DiagnosisReviewStatus acima) —
// deliberado: efos/application/decision-execution/DecisionExecutionEvent.ts
// e efos/domain (OutcomeStatus) já exportam tipos com esses nomes
// exatos; nenhum arquivo importa o tipo bare deste arquivo diretamente
// (mesmo padrão já usado por DiagnosisReviewStatus — sempre via
// Database["public"]["Tables"][...]["Row"]), mas o sufixo evita
// qualquer ambiguidade se algum dia forem importados lado a lado.
export type DecisionExecutionStatusRow =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETED"
  | "CANCELLED";

// Mission 139 — "classification" em public.financial_observations é
// uma coluna `text` com `check` (não um Postgres enum como os demais)
// — vocabulário fechado, mas deliberadamente estreito (hoje só
// "TEMPORAL_ASSOCIATION") para nunca sugerir causalidade, mesmo por
// engano no schema. Ver migration 009 e D-071.
export type FinancialCorrelationClassificationRow = "TEMPORAL_ASSOCIATION";

export type OutcomeStatusRow =
  | "pending"
  | "positive"
  | "negative"
  | "neutral"
  | "inconclusive";

// Mission 140 — mesmo sufixo "Row" de DecisionExecutionStatusRow/
// OutcomeStatusRow acima: efos/domain (LearningEvidenceClassification)
// já exporta um tipo com este nome exato.
export type LearningEvidenceClassificationRow =
  | "TEMPORAL_ASSOCIATION"
  | "EVIDENCE_FAVORABLE"
  | "EVIDENCE_CONTRARY"
  | "INCONCLUSIVE";

// Mission 141 — mesmo sufixo "Row" de LearningEvidenceClassificationRow
// acima: efos/domain (KnowledgeCategory) já exporta um tipo com este
// nome exato.
export type KnowledgeCategoryRow =
  | "historical_pattern"
  | "recurring_observation"
  | "accumulated_learning";

// Mission 145 — mesmo sufixo "Row" de KnowledgeCategoryRow acima:
// efos/application/knowledge-evaluation (KnowledgeEvaluationOutcome)
// já exporta um tipo com este nome exato. Nenhum valor causal —
// sempre evidencial.
export type KnowledgeEvaluationOutcomeRow =
  | "REINFORCED"
  | "CONTRADICTED"
  | "MIXED"
  | "INSUFFICIENT_EVIDENCE";

export type Database = {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          user_id: string;
          razao_social: string;
          nome_fantasia: string | null;
          cnpj: string;
          regime_tributario: CompanyTaxRegime | null;
          cnae: string | null;
          segmento: string | null;
          porte: CompanySize | null;
          data_abertura: string | null;
          status: CompanyStatus;
          observacoes: string | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          razao_social: string;
          nome_fantasia?: string | null;
          cnpj: string;
          regime_tributario?: CompanyTaxRegime | null;
          cnae?: string | null;
          segmento?: string | null;
          porte?: CompanySize | null;
          data_abertura?: string | null;
          status?: CompanyStatus;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          razao_social?: string;
          nome_fantasia?: string | null;
          cnpj?: string;
          regime_tributario?: CompanyTaxRegime | null;
          cnae?: string | null;
          segmento?: string | null;
          porte?: CompanySize | null;
          data_abertura?: string | null;
          status?: CompanyStatus;
          observacoes?: string | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      users: {
        Row: {
          id: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          company_id: string;
          nome_original: string;
          nome_armazenado: string;
          categoria: string;
          tipo_arquivo: string;
          tamanho_bytes: number;
          status: DocumentStatus;
          versao: number;
          storage_path: string;
          hash_arquivo: string;
          metadata: Json;
          processing_revision: number;
          active_attempt_id: string | null;
          active_attempt_started_at: string | null;
          governance_revision: number | null;
          created_at: string;
          updated_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          nome_original: string;
          nome_armazenado: string;
          categoria: string;
          tipo_arquivo: string;
          tamanho_bytes: number;
          status?: DocumentStatus;
          versao?: number;
          storage_path: string;
          hash_arquivo: string;
          metadata?: Json;
          processing_revision?: number;
          active_attempt_id?: string | null;
          active_attempt_started_at?: string | null;
          governance_revision?: number | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          nome_original?: string;
          nome_armazenado?: string;
          categoria?: string;
          tipo_arquivo?: string;
          tamanho_bytes?: number;
          status?: DocumentStatus;
          versao?: number;
          storage_path?: string;
          hash_arquivo?: string;
          metadata?: Json;
          processing_revision?: number;
          active_attempt_id?: string | null;
          active_attempt_started_at?: string | null;
          governance_revision?: number | null;
          created_at?: string;
          updated_at?: string;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      executions: {
        Row: {
          id: string;
          execution_id: string;
          company_id: string;
          metadata: Json;
          execution: Json;
          report: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          execution_id: string;
          company_id: string;
          metadata: Json;
          execution: Json;
          report?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          execution_id?: string;
          company_id?: string;
          metadata?: Json;
          execution?: Json;
          report?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      executive_diagnoses: {
        Row: {
          id: string;
          company_id: string;
          execution_id: string | null;
          diagnosis: Json;
          provider_name: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          execution_id?: string | null;
          diagnosis: Json;
          provider_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          execution_id?: string | null;
          diagnosis?: Json;
          provider_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      diagnosis_reviews: {
        Row: {
          id: string;
          diagnosis_id: string;
          company_id: string;
          reviewer_user_id: string;
          status: DiagnosisReviewStatus;
          review: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          diagnosis_id: string;
          company_id: string;
          reviewer_user_id: string;
          status: DiagnosisReviewStatus;
          review: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          diagnosis_id?: string;
          company_id?: string;
          reviewer_user_id?: string;
          status?: DiagnosisReviewStatus;
          review?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      decisions: {
        Row: {
          id: string;
          company_id: string;
          diagnosis_id: string | null;
          review_id: string | null;
          human_actor_id: string | null;
          decision: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          diagnosis_id?: string | null;
          review_id?: string | null;
          human_actor_id?: string | null;
          decision: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          diagnosis_id?: string | null;
          review_id?: string | null;
          human_actor_id?: string | null;
          decision?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      decision_execution_events: {
        Row: {
          id: string;
          decision_id: string;
          company_id: string;
          actor_id: string;
          status: DecisionExecutionStatusRow;
          occurred_at: string;
          target_date: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          decision_id: string;
          company_id: string;
          actor_id: string;
          status: DecisionExecutionStatusRow;
          occurred_at?: string;
          target_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          decision_id?: string;
          company_id?: string;
          actor_id?: string;
          status?: DecisionExecutionStatusRow;
          occurred_at?: string;
          target_date?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      decision_outcomes: {
        Row: {
          id: string;
          decision_id: string;
          company_id: string;
          recorded_by: string;
          status: OutcomeStatusRow;
          observed_at: string;
          description: string;
          expected_result: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          decision_id: string;
          company_id: string;
          recorded_by: string;
          status: OutcomeStatusRow;
          observed_at: string;
          description: string;
          expected_result?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          decision_id?: string;
          company_id?: string;
          recorded_by?: string;
          status?: OutcomeStatusRow;
          observed_at?: string;
          description?: string;
          expected_result?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      financial_observations: {
        Row: {
          id: string;
          decision_id: string;
          company_id: string;
          human_outcome_id: string | null;
          computed_by: string;
          classification: FinancialCorrelationClassificationRow;
          baseline_execution_id: string;
          baseline_executed_at: string;
          observation_execution_id: string;
          observation_executed_at: string;
          metrics: Json;
          computed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          decision_id: string;
          company_id: string;
          human_outcome_id?: string | null;
          computed_by: string;
          classification: FinancialCorrelationClassificationRow;
          baseline_execution_id: string;
          baseline_executed_at: string;
          observation_execution_id: string;
          observation_executed_at: string;
          metrics: Json;
          computed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          decision_id?: string;
          company_id?: string;
          human_outcome_id?: string | null;
          computed_by?: string;
          classification?: FinancialCorrelationClassificationRow;
          baseline_execution_id?: string;
          baseline_executed_at?: string;
          observation_execution_id?: string;
          observation_executed_at?: string;
          metrics?: Json;
          computed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      learning_records: {
        Row: {
          id: string;
          company_id: string;
          primary_decision_id: string;
          derived_by: string;
          evidence_classification: LearningEvidenceClassificationRow;
          record: Json;
          derived_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          primary_decision_id: string;
          derived_by: string;
          evidence_classification: LearningEvidenceClassificationRow;
          record: Json;
          derived_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          primary_decision_id?: string;
          derived_by?: string;
          evidence_classification?: LearningEvidenceClassificationRow;
          record?: Json;
          derived_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      knowledge_records: {
        Row: {
          id: string;
          company_id: string;
          formed_by: string;
          category: KnowledgeCategoryRow;
          derived_from_learning_record_ids: string[];
          derived_from_outcome_ids: string[];
          record: Json;
          formed_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          company_id: string;
          formed_by: string;
          category: KnowledgeCategoryRow;
          derived_from_learning_record_ids: string[];
          derived_from_outcome_ids?: string[];
          record: Json;
          formed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          formed_by?: string;
          category?: KnowledgeCategoryRow;
          derived_from_learning_record_ids?: string[];
          derived_from_outcome_ids?: string[];
          record?: Json;
          formed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      knowledge_evaluations: {
        Row: {
          id: string;
          company_id: string;
          knowledge_id: string;
          evaluated_by: string;
          outcome: KnowledgeEvaluationOutcomeRow;
          supporting_learning_record_ids: string[];
          contradicting_learning_record_ids: string[];
          insufficient_learning_record_ids: string[];
          record: Json;
          as_of: string | null;
          evaluated_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          knowledge_id: string;
          evaluated_by: string;
          outcome: KnowledgeEvaluationOutcomeRow;
          supporting_learning_record_ids?: string[];
          contradicting_learning_record_ids?: string[];
          insufficient_learning_record_ids?: string[];
          record: Json;
          as_of?: string | null;
          evaluated_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          knowledge_id?: string;
          evaluated_by?: string;
          outcome?: KnowledgeEvaluationOutcomeRow;
          supporting_learning_record_ids?: string[];
          contradicting_learning_record_ids?: string[];
          insufficient_learning_record_ids?: string[];
          record?: Json;
          as_of?: string | null;
          evaluated_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      acquire_processing_attempt_revision: {
        Args: Record<string, never>;
        Returns: number;
      };
    };
    Enums: {
      company_status: CompanyStatus;
      company_tax_regime: CompanyTaxRegime;
      company_size: CompanySize;
      document_status: DocumentStatus;
      diagnosis_review_status: DiagnosisReviewStatus;
      decision_execution_status: DecisionExecutionStatusRow;
      outcome_status: OutcomeStatusRow;
      learning_evidence_classification: LearningEvidenceClassificationRow;
      knowledge_category: KnowledgeCategoryRow;
      knowledge_evaluation_outcome: KnowledgeEvaluationOutcomeRow;
    };
    CompositeTypes: Record<string, never>;
  };
};
