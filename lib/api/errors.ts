/** A rejected request; `field` names the form field to highlight. */
export class ApiError extends Error {
  constructor(
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

/** Outcome of an action on many records at once. */
export interface BulkResult {
  done: number;
  skipped: number;
}
