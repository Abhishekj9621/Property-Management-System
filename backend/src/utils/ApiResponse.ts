export class ApiResponse<T> {
  public success: boolean;
  public message: string;
  public data?: T;
  public meta?: Record<string, unknown>;

  constructor(message: string, data?: T, meta?: Record<string, unknown>) {
    this.success = true;
    this.message = message;
    this.data = data;
    this.meta = meta;
  }
}
