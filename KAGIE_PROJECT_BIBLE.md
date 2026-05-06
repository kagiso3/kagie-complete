# Kagie Project Bible

## Overview

Kagie is a South African tertiary application assistance platform that helps learners create one profile, choose multiple institutions and course options, pay for guided application packages and services, receive support from assistants, upload documents, track progress through a dashboard, and stay informed with notifications while assistant admins and master admins manage the workflow behind the scenes.

Kagie is both:

- a software product
- a service business

The platform is designed to reduce student stress and turn a confusing tertiary application process into one guided, trackable, supported journey.

## Problem Kagie Solves

Kagie exists to solve common student problems such as:

- applying to multiple institutions one by one
- not knowing which courses fit their marks
- confusion around required documents
- missing deadlines
- struggling with institution portals
- limited visibility into progress
- no guided support during the process
- difficulty handling changes like email, PIN, or re-application

## Core Promise

Kagie’s main value proposition is:

`Apply once and reach many institutions.`

The fuller promise is:

- one place to manage tertiary applications
- guided support from assistants
- easy tracking and dashboard visibility
- notifications at each important step
- access to additional student support services

## Primary Users

Kagie is mainly built for:

- matric learners
- gap year students
- university applicants
- TVET applicants
- students who want one place to manage many applications
- students who need guidance through the process

## South African Context

Kagie is intentionally localized for South Africa. The platform is designed around:

- South African provinces
- South African schools
- South African postal codes
- DBE-style subjects
- percentage marks
- levels 1-7
- universities, TVET colleges, and related tertiary institutions

## Product Pillars

Kagie is built around six major product pillars:

1. Student onboarding and forms
2. Institution and course selection
3. Packages, cart, and payment flow
4. Dashboard, tracking, and notifications
5. Personal assistance and support
6. Assistant and master admin operations

## Main Workflow

The intended user journey is:

1. Student opens the app
2. Student signs up or logs in
3. Student lands on the home page
4. Student completes forms:
   learner, parent, school, marks
5. Student selects a package
6. Student selects institutions and course choices
7. Student adds the package to cart
8. Student reviews cart and proceeds to checkout
9. Student submits payment details
10. Application status becomes active for processing
11. Student tracks progress in dashboard
12. Student receives notifications and can request assistance

## Student Onboarding and Forms

The forms layer is the data foundation of Kagie. It allows the student to enter information once and reuse it across the rest of the journey.

### Main forms sections

- learner
- parent
- school
- marks
- pack
- apply

### Learner details

- ID number
- full names
- surname
- maiden name
- phone number
- email
- province
- postal code
- address
- date of birth
- gender
- home language

### Parent or guardian details

- mother or father selection
- guardian ID number
- guardian full names
- guardian surname
- phone number
- alternative phone number
- guardian email
- province
- postal code
- address

### School details

- school name
- school confirmation
- school province
- school type
- year of completion
- average mark

### Marks section

- subject names
- percentages
- levels 1-7

## Institution and Course Selection

Kagie allows students to build a structured list of institutions and courses inside one application flow.

### Core selection flow

- select province
- select institution type
- select institution
- select faculty
- select three course choices

### Institution types

- University
- TVET College
- potential future support for private colleges and related institutions

### Stored selection data

Each selected institution may include:

- province
- institution type
- institution name
- faculty
- choice 1
- choice 2
- choice 3

## Packages, Cart, and Payment

Kagie uses packages to group and monetize application services.

### Pack concept

Packs can include:

- pack name
- price
- institution limit
- institutions list

Example pack ideas include:

- starter
- premium
- gold
- platinum

### Cart

The cart stores the application-ready bundle before payment. Cart data can include:

- application pack
- selected institutions
- more-service items
- structured student data attached to the application flow

### Checkout

Checkout collects:

- payer full name
- phone number
- payment reference
- payment note
- payment method

Supported payment method ideas include:

- EFT / bank transfer
- cash deposit
- card transfer
- mobile payment

### Post-checkout behavior

After payment:

- payment data is stored
- application status becomes `Application being processed`
- payment status becomes `Pending Verification`
- cart is cleared
- student is redirected to dashboard
- admin and assistants can continue the workflow

## Dashboard and Tracking

The dashboard is the student command center and trust-building screen.

### Dashboard content

- personalized welcome state
- overall progress / readiness
- quick stats
- smart alerts
- selected institutions
- document tracker
- assistant activity
- deadline tracker
- timeline

### Dashboard value

The dashboard proves that:

- progress is being tracked
- support is active
- the student has visibility
- the process is organized

## Notifications and Updates

Notifications keep the student informed at each stage. They may include:

- welcome notification
- payment received
- application updated
- document reviewed
- new support message
- assistant assigned
- callback updated
- deadline alert
- admin announcement

## Personal Assistance and Support

Kagie differentiates itself by combining software with human support.

### Support capabilities

- support chat
- callback request
- assistant follow-up
- help with missing info
- guided support during the application process

### Business value of assistance

Students are not only paying for software. They are paying for:

- confidence
- convenience
- support
- guidance
- reduced confusion

## Prospectus and Information Layer

Kagie also supports information access beyond application flow.

### Prospectus support

- browse prospectuses
- download prospectuses
- research institutions
- view institution information and branding

### Updates support

- application announcements
- opening dates
- deadline reminders
- Kagie notices
- tertiary education updates

## More Service

Kagie includes a secondary services area for problems students face during or after applications.

### Example services

- change email
- forgot PIN
- forgot student number
- re-apply assistance

### Business value

More Service creates:

- extra revenue streams
- a broader support offering
- continued usefulness beyond first application

## Recommendations

Kagie includes the idea of smart recommendations based on student data.

### Recommendation inputs

- subjects
- percentages
- levels
- average
- possible province or preference filters

### Recommendation outputs

- suggested courses
- suggested institutions
- suggested faculties

## User Roles

Kagie has three main roles:

- User
- Assistant Admin
- Master Admin

### User

The user is the student and can:

- create account
- log in
- complete forms
- choose institutions and courses
- select a pack
- add items to cart
- check out
- upload documents
- view dashboard
- receive notifications
- request support
- use more-service tools

### Assistant Admin

Assistant admins are support staff and can:

- view assigned applications
- review student details
- review documents
- update application statuses
- respond to support chats
- handle callback requests
- add notes
- log activity

### Master Admin

The master admin controls the full operation and can:

- see all users
- see all applications
- see all assistants
- create assistant accounts
- assign assistants to applications
- monitor payments
- monitor statuses
- view callback requests
- send notifications
- monitor assistant activity
- manage workflow across the platform

## Assistant Account Creation

Assistant accounts should be created by the master admin rather than through public signup.

### Assistant creation fields

- full name
- email
- phone
- password

### Role stored

- `assistant_admin`

This keeps staff access controlled and professional.

## Admin Dashboards

Kagie has two main admin surfaces:

- assistant dashboard
- master admin dashboard

### Assistant dashboard should cover

- assigned applications
- student details
- document review
- support messages
- callback requests
- notes
- status update tools

### Master admin dashboard should cover

- create assistant
- view assistants
- view users
- view all applications
- assign assistants
- monitor notifications
- review payment and processing overview
- monitor activity and workload

## Backend Architecture

The MVP is designed for fast launch. Current architecture favors:

- HTML
- CSS
- JavaScript
- localStorage-backed demo logic
- optional Supabase integration for future production path

This supports rapid launch while leaving room to move toward a real backend later.

## Main Data Keys

Important storage keys include:

- `kagie_users`
- `kagie_current_user`
- `kagie_applications`
- `kagie_notifications`
- `kagie_docs`
- `kagie_doc_reviews`
- `kagie_support_chats`
- `kagie_call_requests`
- `kagie_assistant_activity`
- `kagie_notes`
- `kagie_settings`
- `kagie_cart_<userId>`

## Main Backend Capabilities

The platform backend is expected to support:

### Authentication

- register user
- login
- logout
- restore session
- get current user
- require role

### User and Admin Management

- update current user profile
- create assistant account
- create master admin account
- get users by role
- update user by admin
- delete user by admin

### Application Management

- ensure draft
- get latest application
- get applications by user
- get applications by assistant
- update application
- assign assistant
- save form section
- add institution to draft
- remove institution from draft
- add notes
- get notes

### Cart and Checkout

- get cart
- add cart item
- remove cart item
- clear cart
- get cart total
- submit application from cart

### Notifications

- get notifications
- push notification
- push global notification
- mark notification read

### Documents

- save documents
- get documents by user
- review documents
- get document reviews

### Support

- get support messages
- send support message
- request callback
- get callback requests
- update callback request

### Activity and Summaries

- log assistant activity
- get assistant activity
- get dashboard summary
- get admin summary

## Status Model

### Application statuses

- Draft
- Submitted
- Under Review
- Missing Documents
- Ready to Apply
- Applied
- Pending Feedback
- Accepted
- Rejected
- Application being processed

### Payment statuses

- Payment Pending
- Pending Verification
- Verified

## Document Workflow

Documents are a key operational part of Kagie.

### Document flow

1. student uploads document
2. document is saved
3. document is marked pending review
4. assistant or admin reviews it
5. student receives updates

## Assistant Activity Tracking

Kagie should track assistant actions such as:

- application updates
- support messages
- document reviews
- notes added
- callback handling

This helps with:

- workload visibility
- quality control
- internal performance tracking
- future scaling

## UI Direction

Kagie should feel:

- premium
- modern
- polished
- mobile-fit
- animated
- glassy
- intentionally designed

### Visual language

- glassmorphism cards
- strong shadows
- blur effects
- rounded corners
- premium call-to-action buttons
- strong branded headers

### Brand palette

Common Kagie colors include:

- red
- blue
- yellow / orange
- white

Core red reference:

- `#c90000`

## Page Map

### Core user pages

- `index.html`
- `login.html`
- `signup.html`
- `home.html`
- `forms.html`
- `cart.html`
- `checkout.html`
- `Dashboard.html`
- `profile.html`
- `notifications.html`
- `personal-assistance.html`
- `updates.html`
- `prospectus.html`
- `more-service/index.html`

### Admin pages

- assistant dashboard
- assistant review pages
- master admin dashboard
- master admin application management pages

## Revenue Model

Primary revenue opportunities include:

- application packs
- extra student support services
- premium assistance
- future add-ons such as accommodation or transport-related support

Students are paying for:

- convenience
- support
- time-saving
- clarity
- guidance

## Launch Strategy

The recommended approach is MVP first.

### MVP scope

- working signup and login
- forms
- institution selection
- cart
- checkout
- dashboard
- notifications
- support basics
- admin basics

### Why MVP first

Launching early allows Kagie to:

- validate the business model
- get real users
- learn from real demand
- improve through actual feedback

## What Makes Kagie Special

Kagie stands out because it combines:

- application organization
- multiple institution selection
- human assistant support
- dashboard tracking
- notifications
- extra student services
- South African relevance

Instead of being just a portal or just a service, Kagie aims to become the whole journey in one place.

## One-Line Summary

Kagie is a South African tertiary application assistance platform that combines profile capture, institution selection, package-based application support, payment handling, document workflow, notifications, assistant support, and full admin management into one guided student journey.

## Product Truth

At its core, Kagie exists to reduce student stress and replace a confusing tertiary application process with a guided, trackable, supported experience.
 