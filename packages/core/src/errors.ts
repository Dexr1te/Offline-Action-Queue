export type OfflineQErrorCode =
  | "configuration"
  | "storage"
  | "serialization"
  | "action-state"
  | "not-found"
  | "ownership-lost"

export interface OfflineQErrorOptions {
  cause?: unknown
}

export class OfflineQError extends Error {
  readonly code: OfflineQErrorCode
  override readonly cause?: unknown

  constructor(
    code: OfflineQErrorCode,
    message: string,
    options?: OfflineQErrorOptions
  ) {
    super(message, options)
    this.name = "OfflineQError"
    this.code = code
    this.cause = options?.cause
  }
}
