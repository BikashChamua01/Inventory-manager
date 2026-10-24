
const API_BASE_URL = '/api'

export async function apiRequest<T>(
     path: string,
     options: RequestInit = {},
): Promise<T> {
     const response = await fetch(`${API_BASE_URL}${path}`, {
          ...options,
          headers: {
               'Content-Type': 'application/json',
               ...options.headers,
          },
     })

     const result = await response.json().catch(() => null)

     if (!response.ok) {
          throw new Error(
               result?.message ||
               result?.error ||
               `Request failed with status ${response.status}`,
          )
     }

     return result as T
}
