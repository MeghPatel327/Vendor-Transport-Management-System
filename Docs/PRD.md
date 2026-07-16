# Product Requirements Document

## Product
Vendor Transport Management System (Web)

## Goal
Build a modern web application for managing vendors, purchase orders, transport dispatch, payment tracking, and financial summaries.

## Core Modules
- Vendor Management
- Order Management
- Transport Management
- Hissab (Financial Summary)
- Reporting

## Functional Requirements
### Vendors
- Create, edit, delete vendors
- Search vendors
- View vendor profile

### Orders
- CRUD orders
- Pending/Received status
- Amount = Quantity × Rate
- Search & filters

### Transport
- CRUD transport entries
- Dispatch tracking
- Remaining quantity calculation
- Payment status
- LR number search

### Hissab
- Calculate amount from dispatched quantity
- Vendor & city filters
- Totals

### Reports
- Vendor
- Orders
- Transport
- Hissab
Export as PDF/Excel/PNG (future).
