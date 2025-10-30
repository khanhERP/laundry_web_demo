export function setupFetchInterceptor() {
  let token = localStorage.getItem("authToken");
  if(token) {
    const originalFetch = window.fetch;
  
    window.fetch = async (url, options = {}) => {
  
      options.headers = {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
  
      // Bạn có thể thêm credentials nếu BE cần cookie
      options.credentials = options.credentials || "include";
  
      const response = await originalFetch(url, options);
  
      // Nếu 401 -> logout hoặc refresh token
      if (response.status === 401) {
        console.warn("Token hết hạn hoặc không hợp lệ");
        localStorage.removeItem("authToken");
        window.location.href = "/";
      }
  
      return response;
    };
  }
}
