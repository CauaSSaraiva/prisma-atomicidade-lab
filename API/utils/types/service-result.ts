// T = O dado de sucesso 
// E = O erro 
export type ServiceResult<T, E = string> =
  | { ok: true; data: T }
  | { ok: false; erro: E };
