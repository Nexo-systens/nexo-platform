import type { ApplicationError } from "./ApplicationError";
import type { Result } from "../shared/Result";

/**
 * Envelope de resultado que todo `UseCase.execute()` retorna —
 * `Result` (efos/application/shared/Result.ts) especializado com
 * `ApplicationError` como tipo de erro. Mesmo principio de
 * `EfosEngineResult` (efos/interfaces/engine.ts) para os Engines,
 * agora para a Application Layer. Puramente estrutural — nenhuma
 * logica de negocio, sem dependencia de HTTP.
 */
export type ApplicationResult<TOutput = unknown> = Result<TOutput, ApplicationError>;
