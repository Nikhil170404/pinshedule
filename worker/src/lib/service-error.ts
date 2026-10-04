/** Thrown by service functions; routes map it to an HTTP response, the assistant maps it to tool output. */
export class ServiceError extends Error {
  constructor(message: string, readonly status = 400, readonly extra: Record<string, unknown> = {}) {
    super(message)
  }
}
