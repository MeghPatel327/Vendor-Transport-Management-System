# Project Details

## Project Name

Vendor Transport Management System

## Main Idea

The Vendor Transport Management System is a business management application for handling vendor orders, transport dispatches, payment status, and basic financial calculation in one place.

The main purpose of the project is to help a small business owner or operator keep track of:

- Which vendors are connected with the business
- What items have been ordered from each vendor
- Which orders are still pending and which are received
- Which transport entries have been created
- How much quantity has been dispatched
- How much quantity is still left
- Which transport payments are pending or paid
- How much money is calculated from dispatched transport quantity

The system works like a simple operations register. Instead of keeping vendor details, order records, transport entries, dispatch updates, and financial totals in separate notebooks or files, this project keeps those records organized through separate screens.

## Target Users

This project is mainly useful for small businesses that regularly deal with vendors and transport movement.

Example users include:

- Shop owners
- Traders
- Transport coordinators
- Small warehouse operators
- Vendor managers
- Business owners who need order and dispatch tracking

## Business Problem Solved

In many small businesses, vendor orders and transport records are managed manually. This can create problems such as:

- Forgetting which vendor supplied which item
- Losing track of pending orders
- Not knowing whether an order has been received
- Not knowing how much quantity has been dispatched
- Confusion about remaining quantity
- Difficulty checking transport payment status
- Manual calculation mistakes in totals
- Difficulty preparing quick reports

This project solves those problems by giving the user a structured system where vendor, order, transport, and financial records are connected.

## Main Sections of the Project

The project has four main working sections:

1. Vendor Management
2. Vendor Order Management
3. Transport Management
4. Hissab / Financial Summary

## 1. Vendor Management

The Vendor section is the starting point of the system.

In this section, the user can:

- Add a new vendor
- View all existing vendors
- Delete a vendor
- Open a vendor to manage that vendor's orders
- Search orders by item name
- Save vendor-related data as an image report

Each vendor represents a business party from whom items are ordered or with whom transport records may be connected.

### Vendor Record

A vendor record mainly stores:

- Vendor name

The vendor name is used in other parts of the system, especially while adding orders and transport entries.

### Vendor Search

The Vendor screen includes a search option for item names.

When the user searches for an item, the system shows matching order records with:

- Vendor name
- Item name
- Quantity
- Rate
- Amount
- Date
- Status

This helps the user quickly find which vendor is connected with a specific item.

## 2. Vendor Order Management

The Orders section opens after selecting a vendor.

This section is used to manage the order records of one selected vendor.

In this section, the user can:

- Add an item order for the selected vendor
- Enter item quantity
- Enter item rate
- Enter order date
- View all orders of that vendor
- Search orders by item name
- Filter orders by status
- Mark an order as received
- Undo received status and mark it pending again
- Delete an order
- Save order data as an image report

### Order Record

Each order record contains:

- Vendor name
- Item name
- Quantity
- Rate
- Total amount
- Status
- Date

### Order Status

Orders use two statuses:

- Pending
- Received

When a new order is added, its default status is pending.

If the item has arrived or the order is completed, the user can mark it as received.

If the status was changed by mistake, the user can undo it and return the order to pending.

### Order Calculation

For each order, the system calculates:

`Total Amount = Quantity x Rate`

This calculation helps the user avoid manual amount calculation for every order.

### Order Filters

The order screen supports three filters:

- All orders
- Pending orders
- Received orders

This makes it easy to check only incomplete or completed orders.

## 3. Transport Management

The Transport section is used to manage transport-related entries and dispatch tracking.

In this section, the user can:

- Add a transport entry
- Select the vendor for the transport entry
- Enter LR number
- Enter transport name
- Enter city
- Enter item
- Enter total quantity
- Enter rate
- Track dispatched quantity
- See remaining quantity
- Search transport records
- Filter transport records by payment status
- Mark transport payment as paid
- Undo paid status and mark it pending again
- Delete transport records
- Save transport records as an image report

### Transport Record

Each transport record contains:

- LR number
- Vendor name
- Transport name
- City
- Item name
- Total quantity
- Rate
- Total amount
- Dispatched quantity
- Payment status
- Date

### LR Number

The LR number is used as an important transport reference.

It helps identify a specific transport entry when dispatch quantity needs to be updated.

### Dispatch Tracking

The dispatch system tracks how much quantity has been sent.

For each transport entry, the system stores:

- Total quantity
- Dispatched quantity
- Left quantity

The left quantity is calculated as:

`Left Quantity = Total Quantity - Dispatched Quantity`

When the user enters an LR number and dispatch quantity, the system updates the dispatched quantity for that transport entry.

The system does not allow dispatch quantity to go above the remaining quantity. If the user enters more than the remaining quantity, only the available remaining quantity is added.

### Transport Amount Calculation

For each transport entry, the system calculates:

`Total Amount = Total Quantity x Rate`

This amount is shown in the transport table and used for reporting.

### Payment Status

Transport entries use two payment statuses:

- Pending
- Paid

When a transport entry is added, its default payment status is pending.

The user can mark the payment as paid after payment is completed.

If needed, the user can undo paid status and return it to pending.

### Transport Search

The Transport screen allows searching by:

- LR number
- Vendor name
- City
- Item name

This helps the user quickly locate transport records.

### Transport Filters

The transport screen supports three filters:

- All records
- Pending payment records
- Paid records

This helps the user separate unpaid transport entries from paid ones.

## 4. Hissab / Financial Summary

The Hissab section is used for financial summary and calculation based on dispatched transport quantity.

This section helps the user check how much money is calculated from actual dispatched quantity, not just from total planned quantity.

In this section, the user can:

- View financial records from transport dispatch data
- Filter records by vendor
- Filter records by city
- See LR-wise dispatched quantity
- See amount calculated from dispatched quantity
- View the total amount

### Hissab Calculation

The Hissab section calculates amount using:

`Amount = Dispatched Quantity x Rate`

Only records with dispatched quantity greater than zero are included.

This means Hissab focuses on actual dispatched work instead of planned transport quantity.

### Hissab Filters

The Hissab section supports:

- Vendor filter
- City filter

If no vendor is selected, the table shows vendor names.

If no city is selected, the table shows city names.

This keeps the table flexible. The user can see a full summary or narrow the view to one vendor or city.

## Navigation Flow

The project uses a simple navigation flow:

1. Vendor screen
2. Orders screen for a selected vendor
3. Transport screen
4. Hissab screen

The main navigation bar gives access to:

- Vendors
- Transport
- Hissab

The Orders screen is opened from the Vendor screen by selecting a vendor.

## Data Relationships

The main records are connected like this:

- Vendors are used when creating orders
- Vendors are used when creating transport entries
- Orders are linked to vendors
- Transport entries are linked to vendors
- Hissab is calculated from transport entries

This creates a simple business flow:

`Vendor -> Orders -> Transport -> Dispatch -> Hissab`

## Main Workflow Example

A typical business workflow in the project is:

1. Add a vendor.
2. Open that vendor.
3. Add item orders with quantity, rate, and date.
4. Mark orders as received when the items arrive.
5. Add transport entries for vendor-related movement.
6. Enter LR number, city, item, quantity, and rate.
7. Update dispatch quantity as goods are dispatched.
8. Check remaining quantity.
9. Mark transport payment as paid when payment is completed.
10. Open Hissab to check dispatched quantity and calculated amount.
11. Export reports as images when needed.

## Reports and Export

The project supports image export for important records.

The user can export:

- Vendor report
- Selected vendor order report
- Transport report

These reports help the user save or share business records outside the application.

### Vendor Report

The vendor report includes vendors and their related order items.

### Order Report

The order report includes filtered order data for a selected vendor.

It also includes:

- Total quantity
- Total amount
- Applied filters

### Transport Report

The transport report includes filtered transport records.

It also includes:

- LR number
- Vendor
- City
- Item
- Quantity
- Dispatched quantity
- Left quantity
- Rate
- Amount
- Total amount
- Applied filters

## Important Calculations

The project uses these main calculations:

### Order Total

`Order Total = Quantity x Rate`

### Transport Total

`Transport Total = Total Quantity x Rate`

### Left Quantity

`Left Quantity = Total Quantity - Dispatched Quantity`

### Hissab Amount

`Hissab Amount = Dispatched Quantity x Rate`

## Record Statuses

The project uses simple statuses to make tracking easy.

### Order Status

- Pending: order is not yet received
- Received: order has been received

### Transport Payment Status

- Pending: transport payment is not completed
- Paid: transport payment is completed

## Main Benefits

The project provides these benefits:

- Keeps vendor records organized
- Tracks order quantity, rate, total, date, and status
- Shows pending and received orders separately
- Tracks transport records using LR number
- Tracks dispatched and remaining quantity
- Tracks pending and paid transport payments
- Calculates totals automatically
- Provides financial summary from dispatched quantity
- Reduces manual calculation mistakes
- Makes searching and filtering records easier
- Allows reports to be saved as images

## Project Scope

The current project scope is focused on operational tracking for vendors, orders, transport, dispatch, payment status, and financial summary.

It is not designed as a large enterprise system. It is designed as a practical, simple, and direct business tool for daily record management.

## Summary

The Vendor Transport Management System is a complete small-business record management project for vendor orders and transport dispatches.

Its main idea is to connect vendor records, order records, transport records, dispatch quantity, payment status, and Hissab calculation in one organized system.

The project helps a user know what was ordered, what was received, what was transported, what quantity was dispatched, what quantity is left, what payment is pending or paid, and what amount is calculated from dispatched work.
