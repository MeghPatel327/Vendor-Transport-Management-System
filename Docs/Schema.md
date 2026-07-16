# Database Schema

## Vendors
- id
- name
- created_at

## Orders
- id
- vendor_id
- item
- quantity
- rate
- amount
- status
- order_date

## Transport
- id
- vendor_id
- lr_number
- transport_name
- city
- item
- quantity
- dispatched_quantity
- remaining_quantity
- rate
- amount
- payment_status
- transport_date

## Hissab
Derived from Transport:
amount = dispatched_quantity * rate
