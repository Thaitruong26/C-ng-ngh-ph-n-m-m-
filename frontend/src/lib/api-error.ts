import { ApiErrorDetail, ApiErrorResponse } from "@/types/order";

/**
 * Lỗi API theo định dạng thống nhất (api.md mục 2.1):
 * { statusCode, code, message, details?, path, timestamp }
 * Frontend dựa vào `code` để hiển thị thông báo phù hợp.
 */
export class ApiError extends Error {
  statusCode: number;
  status: number;
  code: string;
  details?: ApiErrorDetail[] | unknown;
  replayed?: boolean;

  constructor(
    arg1: string | ApiErrorResponse,
    arg2?: number | { replayed?: boolean },
    arg3?: string,
    arg4?: unknown,
  ) {
    if (typeof arg1 === "object" && arg1 !== null) {
      super(arg1.message || "Đã xảy ra lỗi khi kết nối máy chủ.");
      this.name = "ApiError";
      this.statusCode = arg1.statusCode || 500;
      this.status = this.statusCode;
      this.code = arg1.code || "UNKNOWN_ERROR";
      this.details = arg1.details;
      this.replayed = (arg2 as { replayed?: boolean })?.replayed;
    } else {
      super(arg1 || "Đã xảy ra lỗi");
      this.name = "ApiError";
      this.status = typeof arg2 === "number" ? arg2 : 500;
      this.statusCode = this.status;
      this.code = arg3 || "UNKNOWN_ERROR";
      this.details = arg4;
    }
  }

  /** NestJS trả 404 "Cannot GET /api/..." khi route chưa được khai báo ở backend. */
  get isMissingRoute() {
    return this.status === 404 && /^Cannot (GET|POST|PATCH|PUT|DELETE) /.test(this.message);
  }
}
