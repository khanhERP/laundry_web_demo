import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const BASE_URL = "https://laundry-be-demo.onrender.com"; // 👈 đổi theo domain backend của bạn

export async function defaultFetcher({ queryKey }) {
  const [path] = queryKey;

  // Cho phép truyền cả path hoặc URL đầy đủ
  const url = path.startsWith("http") ? path : `${BASE_URL}${path}`;
  const token = localStorage.getItem("token");

  const res = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    credentials: "include", // nếu dùng cookie, giữ nguyên
  });

  // Xử lý token hết hạn hoặc lỗi xác thực
  if (res.status === 401) {
    console.warn("Token hết hạn hoặc không hợp lệ");
    localStorage.removeItem("token");
    window.location.href = "/";
    return;
  }

  if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

  return res.json();
}

/**
 * Function to complete the order payment.
 * @param orderId - The ID of the order to complete payment for.
 * @param paymentData - The data related to the payment.
 * @param apiRequest - A function to make API requests.
 */
export async function completeOrderPayment(orderId, paymentData, apiRequest) {
  // Update order with payment completion
  const response = await apiRequest("PUT", `https://laundry-be-demo.onrender.com/api/orders/${orderId}`, {
    status: "paid",
    paymentMethod: paymentData.paymentMethod,
    paymentStatus: "paid",
    invoiceStatus: 1, // Set to Completed
    paidAt: new Date(),
  });

  return response;
}