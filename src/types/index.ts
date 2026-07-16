// ============================================================
// Core Domain Types for Vendor Transport Management System
// ============================================================

// --- Vendor ---
export interface Vendor {
  id: number;
  name: string;
  created_at: string;
}

export interface CreateVendorPayload {
  name: string;
}

export interface UpdateVendorPayload {
  name: string;
}

// --- Order ---
export type OrderStatus = 'Pending' | 'Received';

export interface Order {
  id: number;
  vendor_id: number;
  vendor_name?: string; // joined
  item: string;
  quantity: number;
  rate: number;
  amount: number; // computed: quantity * rate
  status: OrderStatus;
  order_date: string;
}

export interface CreateOrderPayload {
  vendor_id: number;
  item: string;
  quantity: number;
  rate: number;
  status: OrderStatus;
  order_date: string;
}

export interface UpdateOrderPayload extends Partial<CreateOrderPayload> {}

// --- Transport ---
export type PaymentStatus = 'Pending' | 'Paid' | 'Partial';

export interface Transport {
  id: number;
  vendor_id: number;
  vendor_name?: string; // joined
  lr_number: string;
  transport_name: string;
  city: string;
  item: string;
  quantity: number;
  dispatched_quantity: number;
  remaining_quantity: number; // computed: quantity - dispatched_quantity
  rate: number;
  amount: number; // computed: quantity * rate
  payment_status: PaymentStatus;
  transport_date: string;
}

export interface CreateTransportPayload {
  vendor_id: number;
  lr_number: string;
  transport_name: string;
  city: string;
  item: string;
  quantity: number;
  dispatched_quantity: number;
  rate: number;
  payment_status: PaymentStatus;
  transport_date: string;
}

export interface UpdateTransportPayload extends Partial<CreateTransportPayload> {}

// --- Hissab (computed from Transport) ---
export interface HissabEntry {
  transport_id: number;
  vendor_id: number;
  vendor_name: string;
  city: string;
  item: string;
  lr_number: string;
  dispatched_quantity: number;
  rate: number;
  hissab_amount: number; // dispatched_quantity * rate
  transport_date: string;
  payment_status: PaymentStatus;
}

export interface HissabSummary {
  entries: HissabEntry[];
  total_hissab_amount: number;
  total_dispatched_quantity: number;
}

// --- Auth ---
export interface AuthUser {
  username: string;
  name: string;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  user: AuthUser;
}

// --- Dashboard Stats ---
export interface DashboardStats {
  total_vendors: number;
  total_orders: number;
  pending_orders: number;
  total_transport: number;
  pending_payments: number;
  total_dispatched_quantity: number;
  total_hissab_amount: number;
}

// --- API Response Wrapper ---
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
}

// --- Table / Query Params ---
export interface PaginationParams {
  page?: number;
  page_size?: number;
}

export interface VendorQueryParams extends PaginationParams {
  search?: string;
}

export interface OrderQueryParams extends PaginationParams {
  vendor_id?: number;
  status?: OrderStatus;
  search?: string;
}

export interface TransportQueryParams extends PaginationParams {
  vendor_id?: number;
  payment_status?: PaymentStatus;
  city?: string;
  search?: string; // LR number search
}

export interface HissabQueryParams {
  vendor_id?: number;
  city?: string;
}
