/**
 * Response formatter utility for consistent API responses
 */

/**
 * Create a success response with the given data
 */
export function formatSuccessResponse<T>(data: T, meta: Record<string, any> = {}): {
  success: true;
  data: T;
  meta?: Record<string, any>;
} {
  return {
    success: true,
    data,
    ...(Object.keys(meta).length > 0 ? { meta } : {})
  };
}

/**
 * Create an error response with the given message and code
 */
export function formatErrorResponse(error: string, code: string = 'ERROR', details?: any): {
  success: false;
  error: string;
  code: string;
  details?: any;
} {
  return {
    success: false,
    error,
    code,
    ...(details ? { details } : {})
  };
}

/**
 * Create a tool error response object
 */
export function createToolErrorResponse(error: string, code: string = 'ERROR', details?: any) {
  return {
    content: [{ 
      type: "text" as const, 
      text: JSON.stringify(formatErrorResponse(error, code, details), null, 2),
      mimeType: "application/json"
    }],
    isError: true
  };
}

/**
 * Create a tool success response object
 */
export function createToolSuccessResponse<T>(data: T, meta: Record<string, any> = {}) {
  return {
    content: [{ 
      type: "text" as const, 
      text: JSON.stringify(formatSuccessResponse(data, meta), null, 2),
      mimeType: "application/json"
    }]
  };
}

/**
 * Create a resource error response object
 */
export function createResourceErrorResponse(uri: string, error: string, code: string = 'ERROR', details?: any) {
  return {
    contents: [{
      uri,
      text: JSON.stringify(formatErrorResponse(error, code, details), null, 2),
      mimeType: "application/json"
    }]
  };
}

/**
 * Create a resource success response object
 */
export function createResourceSuccessResponse<T>(uri: string, data: T, meta: Record<string, any> = {}) {
  return {
    contents: [{
      uri,
      text: JSON.stringify(formatSuccessResponse(data, meta), null, 2),
      mimeType: "application/json"
    }]
  };
}