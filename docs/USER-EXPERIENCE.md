# BEATZ User Experience Workflows

This document outlines the complete user journeys for the BEATZ platform, detailing how guardians and students interact with the system from registration through subject approval and ongoing learning.

---

## Overview

The BEATZ platform uses a two-stage authorization model:

1. **Guardians** control student access and approve subjects (which trigger per-subject billing)
2. **Students** configure their own learning profiles and select subjects for guardian approval

This ensures guardians maintain financial control while empowering students to personalize their learning experience.

---

## Guardian User Journey

### 1. Initial Registration & Setup

**Entry Point**: Guardian visits BEATZ website and clicks "Sign Up"

**Flow**:

```
Sign Up (Clerk) → Complete Registration Form → Dashboard
```

**Steps**:

1. Guardian creates account via Clerk authentication (email/password or social login)
2. Redirected to `/register` to complete profile:
   - Select role: Parent/Teacher/Admin
   - Enter display name
   - Create/join tenant (family name or school name)
   - Optionally add first student's basic info (name, year group, country)
3. Submit registration → redirected to Dashboard

**Technical**: `POST /api/v1/registrations` creates User, Tenant, Parent, and optional Student records

---

### 2. Adding Student Profiles

**Entry Point**: Guardian navigates to Dashboard

**Flow**:

```
Dashboard → Add Student Form → Save → Student appears in list
```

**Steps**:

1. Guardian fills out "Add a student" form:
   - Student display name (required)
   - Year group (e.g., "Year 10")
   - Country (dropdown from meta options)
   - Optional: Initial subjects with level/exam body
2. Click "Save student"
3. Student card appears in "Your students" list with status "Not Invited"

**Technical**: `POST /api/v1/students` creates Student record with `invitationStatus='none'` and empty `userId`

**UI States**:

- Empty state: "No students yet. Add your first student to get started."
- List view: Student cards showing name, year group, country, and enrolled subjects

---

### 3. Inviting Students

**Entry Point**: Guardian clicks "Invite" button on student card

**Flow**:

```
Click Invite → Enter Email Dialog → Send Invitation → Status changes to "Pending"
```

**Steps**:

1. Dialog opens with email input field
2. Guardian enters student's email address
3. System validates email format
4. Click "Send Invitation"
5. Clerk invitation email sent with invitation link
6. Student card status badge changes from "Not Invited" (gray) to "Pending" (yellow)
7. Invitation timestamp displayed

**Technical**:

- `POST /api/v1/students/:studentId/invite` updates Student `invitationStatus='pending'`
- Clerk invitation includes `publicMetadata: {studentId, tenantId, guardianUserId}`

**Resend Flow**:

- If >24 hours since last invite, "Resend" button appears
- Clicking resends invitation and updates timestamp
- Cooldown prevents spam (24hr minimum between invites)

**Status Badge Colors**:

- Gray: Not Invited
- Yellow: Pending (invitation sent, awaiting acceptance)
- Green: Active (student accepted and created account)
- Red: Expired (invitation >7 days old, not yet automated)

---

### 4. Reviewing Pending Subject Approvals

**Entry Point**: Guardian sees notification badge or "Pending Approvals" section in Dashboard

**Flow**:

```
Dashboard → Subject Approval Panel → Review subjects → Approve or Reject
```

**Steps**:

1. Guardian receives in-app notification: "New subject request from [Student Name]"
2. Notification badge shows unread count (polls every 30 seconds)
3. Click notification or scroll to "Subject Approval Panel" in Dashboard
4. Panel groups pending subjects by student name
5. Each subject card displays:
   - Subject name (e.g., "Biology")
   - Level (e.g., "GCSE")
   - Exam body (e.g., "AQA")
   - Study resources/books
   - **Placeholder price**: "£29.99/month"
6. Monthly cost calculator shows per-student totals and grand total

**Technical**: Subjects with `approvalStatus='pending_approval'` are fetched and displayed

---

### 5. Approving Subjects

**Entry Point**: Guardian clicks "Approve" button on subject card

**Flow**:

```
Click Approve → Confirmation → Subject activated → Student notified
```

**Steps**:

1. Confirmation dialog: "Approve Biology for [Student Name]? This will add £29.99/month to your subscription."
2. Guardian confirms
3. Subject status changes to "Approved" (green badge)
4. Billing status updates to "Placeholder Active"
5. Monthly price recorded: £29.99
6. Student receives notification: "Your guardian approved Biology - you can now access it!"
7. Subject appears in student's active subjects list
8. Guardian's billing summary updates with new monthly total

**Technical**:

- `POST /api/v1/students/:studentId/enrolments/:index/approve`
- Updates enrolment: `approvalStatus='approved'`, `approvedAt=now`, `billingStatus='placeholder_active'`, `monthlyPrice=29.99`
- Creates Notification for student

---

### 6. Rejecting Subjects

**Entry Point**: Guardian clicks "Reject" button on subject card

**Flow**:

```
Click Reject → Reason Dialog → Submit → Subject rejected → Student notified
```

**Steps**:

1. Rejection dialog opens with:
   - Reason dropdown (required):
     - "Too expensive"
     - "Not relevant"
     - "Needs discussion"
   - Optional custom text field for additional context
2. Guardian selects reason and adds notes (optional)
3. Click "Submit Rejection"
4. Subject status changes to "Rejected" (red badge)
5. Student receives notification: "Your guardian rejected Biology - Reason: [reason]"
6. Subject appears in student's rejected list with reason visible

**Technical**:

- `POST /api/v1/students/:studentId/enrolments/:index/reject`
- Updates enrolment: `approvalStatus='rejected'`, `rejectedAt=now`, `rejectionReason="reason text"`
- Creates Notification for student with reason

---

### 7. Managing Multiple Students

**Dashboard View**:

```
┌─────────────────────────────────────┐
│ Dashboard Summary                   │
│ Total Students: 3                   │
│ Pending Approvals: 5 🔔            │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Student: Emma (Year 10, UK)         │
│ Status: Active ●                    │
│ Subjects: Biology (GCSE), Maths     │
│ [Invite] [View Details]             │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Student: Noah (Year 8, UK)          │
│ Status: Pending ●                   │
│ Invited: 2 days ago                 │
│ [Resend Invitation]                 │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ Subject Approval Panel              │
│                                     │
│ Emma's Pending Subjects (2)         │
│ ├─ Chemistry GCSE AQA £29.99/mo    │
│ │  [Approve] [Reject]               │
│ └─ Physics GCSE OCR £29.99/mo      │
│    [Approve] [Reject]               │
│                                     │
│ Noah's Pending Subjects (3)         │
│ └─ (awaiting student acceptance)    │
│                                     │
│ Monthly Total: £59.98               │
└─────────────────────────────────────┘
```

---

### 8. Handling Subject Modifications (Re-approval)

**Trigger**: Student modifies an already-approved subject

**Flow**:

```
Student edits subject → Status resets → Guardian notified → Re-approval needed
```

**Steps**:

1. Guardian receives notification: "[Student Name] modified Biology - re-approval needed"
2. Subject appears in "Subject Approval Panel" again
3. Shows previous configuration vs. new configuration
4. Guardian reviews changes
5. Approve or reject with new reason
6. If approved, subject reactivates with updated config
7. If rejected, student can modify again

**Technical**:

- `PUT /api/v1/me/student-profile` detects changes to approved enrolments
- Resets: `approvalStatus='pending_approval'`, clears `approvedAt`, sets `billingStatus='inactive'`
- Creates Notification for guardian

---

### 9. Monitoring Notifications

**Header Bell Icon**:

- Red badge with unread count
- Polls every 30 seconds for new notifications
- Click to open dropdown

**Notification Types**:

- "New subject request from [Student]" (yellow)
- "[Student] modified [Subject] - re-approval needed" (orange)
- "[Student] accepted invitation" (green)

**Actions**:

- Click notification → marks as read → navigates to relevant section
- Notifications auto-delete after 30 days

---

## Student User Journey

### 1. Receiving Invitation

**Entry Point**: Student receives email from Clerk

**Email Content**:

```
Subject: You've been invited to BEATZ by [Guardian Name]

[Guardian Name] has invited you to join BEATZ, a personalized
learning platform for exam preparation.

Your guardian has set up your profile. Click below to accept
the invitation and complete your setup.

[Accept Invitation Button]

This invitation expires in 7 days.
```

**Flow**:

```
Email → Click Link → Clerk Sign-Up → Profile Setup Wizard → Dashboard
```

---

### 2. Account Creation (Via Invitation)

**Entry Point**: Student clicks invitation link in email

**Flow**:

```
Invitation Link → Clerk Sign-Up → Verify Email → Redirected to Profile Setup
```

**Steps**:

1. Clerk sign-up page opens with pre-filled context
2. Student creates credentials (email/password or social login)
3. Email verification (if required by Clerk settings)
4. System validates invitation metadata contains `studentId`
5. Links new User account to existing Student record
6. Sets `invitationStatus='accepted'`
7. Redirected to `/student-profile-setup`

**Technical**:

- `POST /api/v1/registrations` with `role='student'`
- Extracts `studentId` from `req.auth().invitation.publicMetadata`
- Updates Student record: `userId=user._id`, `invitationStatus='accepted'`

**Error State**: If student tries to self-register without invitation:

```
❌ Error: Students must be invited by a guardian

Please ask your parent, teacher, or tutor to send you an
invitation to join BEATZ.
```

---

### 3. Profile Setup Wizard

**Entry Point**: First login after accepting invitation

**Step 1: Welcome**

```
┌─────────────────────────────────────┐
│ Welcome to BEATZ, Emma!             │
│                                     │
│ Your guardian has set up your       │
│ profile with the following info:    │
│                                     │
│ Name: Emma Thompson (read-only)     │
│ Year Group: Year 10 (read-only)     │
│ Country: United Kingdom (read-only) │
│                                     │
│ [Next: Select Your Subjects]        │
└─────────────────────────────────────┘
```

**Step 2: Subject Selection**

```
┌─────────────────────────────────────┐
│ Select Your Subjects                │
│                                     │
│ Search: [biology______] 🔍          │
│                                     │
│ Available Subjects:                 │
│ ☑ Biology                           │
│ ☑ Chemistry                         │
│ ☐ Physics                           │
│ ☑ Mathematics                       │
│ ☐ English Literature                │
│ ... (searchable/filterable list)    │
│                                     │
│ Selected: 3 subjects                │
│                                     │
│ [Back] [Next: Configure Details]    │
└─────────────────────────────────────┘
```

**Step 3: Configure Each Subject**

```
┌─────────────────────────────────────┐
│ Configure Biology (1 of 3)          │
│                                     │
│ Level: [GCSE ▼]                     │
│   Options: GCSE, A-Level, IB        │
│                                     │
│ Exam Body: [AQA ▼]                  │
│   Options: AQA, Edexcel, OCR, WJEC  │
│                                     │
│ Study Resources (optional):         │
│ + [AQA GCSE Biology Student Book]   │
│ + [CGP Revision Guide]              │
│   [+ Add another book]              │
│                                     │
│ [Back] [Next Subject →]             │
└─────────────────────────────────────┘
```

**Step 4: Review Summary**

```
┌─────────────────────────────────────┐
│ Review Your Subjects                │
│                                     │
│ 1. Biology GCSE (AQA)               │
│    Books: AQA Student Book, CGP     │
│                                     │
│ 2. Chemistry GCSE (Edexcel)         │
│    Books: None                      │
│                                     │
│ 3. Mathematics A-Level (OCR)        │
│    Books: OCR Textbook              │
│                                     │
│ ⚠️ Your guardian will review and    │
│    approve these subjects before    │
│    you can access learning content. │
│                                     │
│ [Back] [Submit for Approval]        │
└─────────────────────────────────────┘
```

**Submit Action**:

1. Student clicks "Submit for Approval"
2. All subjects saved with `approvalStatus='pending_approval'`
3. Guardian receives notification
4. Student redirected to Dashboard
5. Success message: "Subjects submitted! Your guardian will review them soon."

**Technical**: `PUT /api/v1/me/student-profile` saves enrolments array

---

### 4. Student Dashboard - Awaiting Approval

**Entry Point**: Student logs in after submitting subjects

**Dashboard View**:

```
┌─────────────────────────────────────┐
│ Hi, Emma                            │
│ Signed in as: emma@example.com      │
│ Last signed in: 2 hours ago         │
└─────────────────────────────────────┘

┌─────────────────────────────────────┐
│ My Subjects                         │
│                                     │
│ ℹ️ Subjects become active once your │
│   guardian approves them            │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Biology GCSE (AQA)              │ │
│ │ Status: Pending Approval ●      │ │
│ │ Submitted: 1 hour ago           │ │
│ │ [View Details]                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Chemistry GCSE (Edexcel)        │ │
│ │ Status: Pending Approval ●      │ │
│ │ Submitted: 1 hour ago           │ │
│ │ [View Details]                  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Mathematics A-Level (OCR)       │ │
│ │ Status: Pending Approval ●      │ │
│ │ Submitted: 1 hour ago           │ │
│ │ [View Details]                  │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Status Badge Colors**:

- Yellow: Pending Approval (waiting for guardian)
- Green: Approved (can access learning content)
- Red: Rejected (can view reason and request changes)

---

### 5. Receiving Approval Notification

**Trigger**: Guardian approves a subject

**Flow**:

```
Guardian approves → Notification sent → Subject activates → Student can access
```

**Notification**:

```
🔔 Notification Bell (1)

┌─────────────────────────────────────┐
│ ✅ Your guardian approved Biology   │
│    You can now access it!           │
│    2 minutes ago                    │
└─────────────────────────────────────┘
```

**Dashboard Update**:

```
┌─────────────────────────────────────┐
│ Biology GCSE (AQA)                  │
│ Status: Approved ●                  │
│ Approved: 2 minutes ago             │
│ [Start Learning →]                  │
└─────────────────────────────────────┘
```

**Student Actions**:

- Click notification → navigates to Dashboard
- Click "Start Learning" → accesses Biology learning content
- Subject now appears in active subjects list

---

### 6. Receiving Rejection Notification

**Trigger**: Guardian rejects a subject

**Flow**:

```
Guardian rejects → Notification sent → Subject shows rejected → Student can modify
```

**Notification**:

```
🔔 Notification Bell (1)

┌─────────────────────────────────────┐
│ ❌ Your guardian rejected Chemistry │
│    Reason: Too expensive            │
│    "Let's discuss during exam term" │
│    5 minutes ago                    │
└─────────────────────────────────────┘
```

**Dashboard Update**:

```
┌─────────────────────────────────────┐
│ Chemistry GCSE (Edexcel)            │
│ Status: Rejected ●                  │
│ Reason: Too expensive               │
│ Note: "Let's discuss during exam    │
│        term"                        │
│ [Request Changes] [Remove]          │
└─────────────────────────────────────┘
```

**Student Actions**:

- Click "Request Changes" → edit subject details → resubmit
- Click "Remove" → removes subject from list
- Can discuss with guardian offline and resubmit later

---

### 7. Modifying Approved Subjects

**Trigger**: Student wants to change exam board on approved subject

**Flow**:

```
Edit approved subject → Changes detected → Approval reset → Guardian notified
```

**Steps**:

1. Student clicks "Edit" on approved subject (e.g., Biology)
2. Edit form opens with current configuration pre-filled
3. Student changes exam board from "AQA" to "Edexcel"
4. Warning displayed: "⚠️ Modifying this subject will require guardian re-approval"
5. Student confirms and submits
6. Subject status changes from "Approved" to "Pending Approval"
7. Subject access disabled until re-approved
8. Guardian receives notification: "Emma modified Biology - re-approval needed"

**Dashboard Update**:

```
┌─────────────────────────────────────┐
│ Biology GCSE (Edexcel) - Modified   │
│ Status: Pending Approval ●          │
│ Previous: AQA → New: Edexcel        │
│ Awaiting guardian re-approval       │
│ Modified: Just now                  │
└─────────────────────────────────────┘
```

**Technical**:

- `PUT /api/v1/me/student-profile` detects changes to approved enrolment
- Resets `approvalStatus='pending_approval'`, `billingStatus='inactive'`
- Creates guardian notification

---

### 8. Adding New Subjects (Post-Setup)

**Entry Point**: Student wants to add another subject later

**Flow**:

```
Dashboard → Add Subject → Configure → Submit → Awaits approval
```

**Steps**:

1. Student clicks "Add Another Subject" button on Dashboard
2. Subject selection form opens (similar to wizard Step 2)
3. Student selects subject, level, exam body, books
4. Click "Submit for Approval"
5. New subject appears with "Pending Approval" status
6. Guardian receives notification: "Emma requested a new subject: Physics"
7. Guardian approves/rejects via approval panel

**Technical**:

- `PUT /api/v1/me/student-profile` adds new enrolment to array
- New enrolment has `approvalStatus='pending_approval'`

---

### 9. Active Learning State

**After Guardian Approves All Subjects**:

**Dashboard View**:

```
┌─────────────────────────────────────┐
│ My Active Subjects (3)              │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Biology GCSE (AQA)              │ │
│ │ Status: Active ●                │ │
│ │ Progress: 45% complete          │ │
│ │ Last studied: 2 days ago        │ │
│ │ [Continue Learning →]           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Chemistry GCSE (Edexcel)        │ │
│ │ Status: Active ●                │ │
│ │ Progress: 12% complete          │ │
│ │ Last studied: 1 week ago        │ │
│ │ [Continue Learning →]           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Mathematics A-Level (OCR)       │ │
│ │ Status: Active ●                │ │
│ │ Progress: Not started           │ │
│ │ [Start Learning →]              │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Student can now**:

- Access AI tutor for approved subjects
- Track learning progress
- View study resources
- Take practice exams
- Request modifications (triggers re-approval)
- Add more subjects (requires approval)

---

## Notification System Workflows

### Notification Types

| Type                  | Recipient | Trigger                        | Message                                             | Action                     |
| --------------------- | --------- | ------------------------------ | --------------------------------------------------- | -------------------------- |
| `subject_requested`   | Guardian  | Student submits new subjects   | "New subject request from [Student]"                | Review in Approval Panel   |
| `subject_approved`    | Student   | Guardian approves              | "[Subject] approved - you can now access it!"       | Navigate to Dashboard      |
| `subject_rejected`    | Student   | Guardian rejects               | "[Subject] rejected - Reason: [reason]"             | View reason, modify/remove |
| `subject_modified`    | Guardian  | Student edits approved subject | "[Student] modified [Subject] - re-approval needed" | Review changes in Panel    |
| `invitation_accepted` | Guardian  | Student accepts invite         | "[Student] accepted invitation and joined"          | View in student list       |

### Notification Polling Behavior

**Client-Side**:

- Poll every 30 seconds using `setInterval` in `useEffect`
- Fetch `GET /api/v1/notifications` with `read=false` filter
- Update badge count and notification list
- On user interaction, mark notification as read: `PUT /api/v1/notifications/:id/read`

**Server-Side**:

- Notifications stored in MongoDB with TTL index
- Auto-delete after 30 days from `createdAt`
- Indexed by `userId` and `read` for fast queries

---

## Error States & Edge Cases

### 1. Invitation Expired

**Scenario**: Student clicks invitation link after 7 days

**Flow**:

```
Click Link → Clerk validates → Shows expired message → Contact guardian
```

**UI**:

```
❌ Invitation Expired

This invitation from [Guardian Name] has expired.

Please ask your guardian to resend the invitation from
their BEATZ dashboard.
```

**Guardian Action**: Click "Resend" on student card (available after 24hr cooldown)

---

### 2. Unauthorized Self-Registration

**Scenario**: Student tries to sign up without invitation

**Flow**:

```
Sign Up → Select "Student" role → Registration blocked → Error shown
```

**UI**:

```
❌ Students Must Be Invited

Students cannot create accounts directly. Please ask
your parent, teacher, or tutor to:

1. Create a BEATZ account
2. Add you as a student
3. Send you an invitation email

Need help? Contact support@beatz.com
```

---

### 3. No Subjects Submitted

**Scenario**: Student skips profile wizard or submits with no subjects

**Dashboard**:

```
┌─────────────────────────────────────┐
│ My Subjects                         │
│                                     │
│ You haven't added any subjects yet. │
│                                     │
│ [Add Your First Subject]            │
└─────────────────────────────────────┘
```

**Action**: Click button → opens subject selection wizard

---

### 4. All Subjects Rejected

**Scenario**: Guardian rejects all student's subject requests

**Dashboard**:

```
┌─────────────────────────────────────┐
│ My Subjects                         │
│                                     │
│ ❌ All subjects were rejected       │
│                                     │
│ Your guardian provided feedback.    │
│ Review the reasons below and        │
│ discuss with your guardian.         │
│                                     │
│ [View Rejected Subjects]            │
└─────────────────────────────────────┘
```

**Student Actions**:

- View rejection reasons
- Modify and resubmit
- Add different subjects
- Discuss offline with guardian

---

### 5. Subject Already Exists

**Scenario**: Student tries to add Biology when they already have Biology GCSE AQA

**Validation**:

- API checks for duplicate `subject + level + examBody` combination
- Returns validation error
- UI shows: "You already have Biology GCSE (AQA). Edit the existing subject instead."

---

## UI Navigation Map

```
┌────────────────────────────────────────────────────────────────┐
│                        GUARDIAN FLOW                           │
└────────────────────────────────────────────────────────────────┘

  Sign Up (Clerk)
       ↓
  Registration Form (/register)
       ↓
  Dashboard (/dashboard)
       ├─→ Add Student Form → Save → Student List
       ├─→ Invite Student → Email Dialog → Invitation Sent
       ├─→ Subject Approval Panel
       │       ├─→ Approve Subject → Confirmation → Activated
       │       └─→ Reject Subject → Reason Dialog → Rejected
       ├─→ Notification Bell → Dropdown → Navigate to relevant view
       └─→ Student Details → View/Edit basic info

┌────────────────────────────────────────────────────────────────┐
│                         STUDENT FLOW                           │
└────────────────────────────────────────────────────────────────┘

  Email Invitation
       ↓
  Click Link → Clerk Sign Up
       ↓
  Profile Setup Wizard (/student-profile-setup)
       ├─→ Step 1: Welcome (read guardian-set info)
       ├─→ Step 2: Select Subjects
       ├─→ Step 3: Configure Each Subject
       └─→ Step 4: Review & Submit
       ↓
  Dashboard (/dashboard)
       ├─→ View Subject Status (Pending/Approved/Rejected)
       ├─→ Start Learning (approved subjects only)
       ├─→ Edit Subject → Triggers Re-approval
       ├─→ Add New Subject → Awaits Approval
       ├─→ Notification Bell → View approval status
       └─→ Request Changes (rejected subjects)
```

---

## Key UX Principles

### 1. Guardian Control

- Guardians have final say on all subject approvals
- Financial transparency with clear pricing display
- Easy multi-student management
- Actionable notifications

### 2. Student Autonomy

- Students choose their own subjects and configuration
- Clear status visibility (pending/approved/rejected)
- Ability to modify and resubmit
- Helpful rejection feedback

### 3. Communication

- In-app notifications for all key events
- Status badges provide at-a-glance information
- Rejection reasons help students understand decisions
- Polling ensures timely updates without complexity

### 4. Progressive Disclosure

- Wizard breaks complex setup into manageable steps
- Dashboard shows only relevant information per role
- Approval panel groups by student for clarity
- Notifications prioritize unread/recent items

### 5. Error Prevention

- Invitation-only student registration prevents unauthorized access
- Duplicate subject detection avoids confusion
- Modification warnings inform students of re-approval consequences
- Cooldown periods prevent invitation spam

---

## Technical Integration Points

### API Endpoints Used

**Guardian Workflows**:

- `POST /api/v1/registrations` - Complete guardian registration
- `POST /api/v1/students` - Add student profile
- `POST /api/v1/students/:id/invite` - Send invitation
- `POST /api/v1/students/:id/enrolments/:index/approve` - Approve subject
- `POST /api/v1/students/:id/enrolments/:index/reject` - Reject subject
- `GET /api/v1/students` - List all guardian's students
- `GET /api/v1/notifications` - Fetch notifications

**Student Workflows**:

- `POST /api/v1/registrations` - Accept invitation & create account
- `GET /api/v1/me/student-profile` - Fetch own profile
- `PUT /api/v1/me/student-profile` - Update subjects/enrolments
- `GET /api/v1/notifications` - Fetch notifications
- `PUT /api/v1/notifications/:id/read` - Mark notification read

**Metadata Endpoints**:

- `GET /api/v1/meta/enrolment-options` - Country/level/exam body options

---

## Future Enhancements

### Phase 2 Features

- Bulk approval for guardians managing many students
- Real-time notifications via WebSockets
- Student messaging to guardian for subject discussions
- Approval history/audit log
- Billing dashboard with Stripe integration
- Multiple guardians per student support

### Phase 3 Features

- Smart approval suggestions based on student profile
- Automatic subject recommendations
- Progress reports shared with guardians
- Scheduled subject activations (start date)
- Trial periods before billing activation
- Family/school group billing discounts

---

## Success Metrics

**Guardian Experience**:

- Time to invite first student: <2 minutes
- Average approval decision time: <30 seconds per subject
- Notification acknowledgment rate: >80%
- Monthly billing visibility: 100% transparency

**Student Experience**:

- Profile setup completion rate: >90%
- Subject approval wait time: <24 hours average
- Re-approval submission rate after rejection: >60%
- Active learning engagement rate: >70% of approved subjects

**System Health**:

- Invitation acceptance rate: >80% within 7 days
- Notification delivery success: >99%
- Zero unauthorized student registrations
- Subject modification re-approval rate: >85%

---

_Last Updated: December 2, 2025_
