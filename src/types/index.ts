// ============================================================
// Domain Types for Vendor Transport Management System
// ============================================================

// --- Master Data: Customer & Transport ---
export interface Customer {
  id: number;
  name: string;
  created_at: string;
}

export interface TransportMaster {
  id: number;
  name: string;
  created_at: string;
}

// Legacy Vendor type maintained for backward compatibility
export interface Vendor {
  id: number;
  name: string;
  created_at: string;
}

// --- Order ---
export interface Order {
  id: number;
  customer_id: number;
  customer_name?: string;
  item: string;
  order_date: string;
  is_history?: boolean;
}

export interface CreateOrderPayload {
  customer_id: number;
  item: string;
  order_date: string;
  is_history?: boolean;
}

export interface UpdateOrderPayload extends Partial<CreateOrderPayload> {}

// --- Transport ---
export type PaymentStatus = 'Pending' | 'Paid';

export interface Transport {
  id: number;
  transport_master_id?: number;
  transport_name: string;
  lr_number: string;
  item: string;
  quantity: number; // Lot / Quantity
  remaining_quantity?: number;
  rate: number;
  amount: number; // computed: quantity * rate
  payment_status: PaymentStatus;
  booking_date: string; // Booking Date (YYYY-MM-DD)
}

export interface CreateTransportPayload {
  transport_name: string;
  lr_number: string;
  item: string;
  quantity: number;
  rate: number;
  payment_status: PaymentStatus;
  booking_date: string;
}

export interface UpdateTransportPayload extends Partial<CreateTransportPayload> {}

// --- Hissab (computed from Transport) ---
export interface HissabEntry {
  transport_id: number;
  transport_name: string;
  item: string;
  lr_number: string;
  quantity: number;
  rate: number;
  amount: number;
  booking_date: string;
  payment_status: PaymentStatus;
}

export interface HissabSummary {
  entries: HissabEntry[];
  total_hissab_amount: number;
  total_quantity: number;
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
  total_customers: number;
  total_transports_master: number;
  total_orders: number;
  total_transport: number;
  pending_payments: number;
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
export interface MasterQueryParams {
  search?: string;
}

export interface OrderQueryParams {
  customer_id?: number;
  search?: string;
  is_history?: boolean;
}

export interface TransportQueryParams {
  transport_name?: string;
  payment_status?: PaymentStatus;
  search?: string; // LR number or transport name search
}

export interface HissabQueryParams {
  transport_name?: string;
  search?: string; // transport name or LR number search
  payment_status?: PaymentStatus;
}

