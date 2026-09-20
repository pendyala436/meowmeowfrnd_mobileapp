# Dummy KYC fill sheet (Women Bank KYC)

Use these values on the **Bank KYC Verification** form. All numbers are **fake** and only for format / UI testing — do not use for real payouts.

**JPEG uploads** (required format where noted): see `images/`

| File | Upload field |
|------|----------------|
| `images/aadhaar_front.jpg` | Aadhaar Front (JPEG only) |
| `images/aadhaar_back.jpg` | Aadhaar Back |
| `images/id_proof_front.jpg` | ID Proof Front (JPEG only) |
| `images/id_proof_back.jpg` | ID Proof Back |
| `images/address_proof.jpg` | Address Proof Document |
| `images/selfie.jpg` | Selfie (prefer camera in app; this file works if gallery allowed) |

---

## 1. Personal Information

| Field | Value | Required? |
|-------|--------|-----------|
| Full Name (as per bank) | **Priya Sharma Test** | Yes |
| Father's / Mother's Name | **Ramesh Sharma** | Optional |
| Date of Birth | **1998-05-14** | Yes |
| Gender | **Female** | Optional |
| Marital Status | **Single** | Optional |
| Nationality | **Indian** | Optional |
| Occupation | **Student** | Optional |
| Annual Income Range | **Below ₹1 Lakh** (`below_1l`) | Optional |

---

## 2. Contact Information

| Field | Value | Required? |
|-------|--------|-----------|
| Mobile Number | **+91 98765 43210** | Optional |
| Email Address | **priya.kyc.test@example.com** | Optional |
| Current Address | **Flat 12B, Green Park Residency, Near Metro Station, New Delhi** | Optional |
| Permanent Address | **Same as current** / **House 45, Village Road, Aligarh, UP** | Optional |
| City | **New Delhi** | Optional |
| State | **Delhi** | Optional |
| PIN Code | **110016** | Optional (must be 6 digits if filled) |

---

## 3. Identity Proof

| Field | Value | Required? |
|-------|--------|-----------|
| ID Type | **PAN Card** (`pan`) | Yes |
| ID Number | **ABCDE1234F** | Yes (6–20 chars) |
| ID Proof Front | `images/id_proof_front.jpg` | Optional (JPEG) |
| ID Proof Back | `images/id_proof_back.jpg` | Optional |

**Alt ID samples** (if you want to try other dropdowns):

| ID Type | Dummy number |
|---------|----------------|
| Passport | `Z1234567` |
| Voter ID | `ABC1234567` |
| Driving Licence | `DL1420110012345` |
| Ration Card | `DLNOR1234567890` |
| College ID | `COL2024-998877` |
| Government ID | `GOV-EMP-445566` |
| NREGA Job Card | `UP-06-001-001-001/123` |
| Defence ID | `DEF-EX-778899` |
| India Post ID | `IPOST-112233` |

---

## 4. Aadhaar (Address Proof)

| Field | Value | Required? |
|-------|--------|-----------|
| Aadhaar Number | **999988887777** | Yes (exactly 12 digits) |
| Aadhaar Front | `images/aadhaar_front.jpg` | Optional (JPEG) |
| Aadhaar Back | `images/aadhaar_back.jpg` | Optional |

---

## 5. Additional Address Proof (Optional)

| Field | Value |
|-------|--------|
| Address Proof Type | **Electricity Bill** (`electricity_bill`) |
| Document | `images/address_proof.jpg` |

---

## 6. Bank Details

| Field | Value | Required? |
|-------|--------|-----------|
| Bank Name | **HDFC Bank** | Yes |
| Branch Name | **Connaught Place** | Optional |
| Account Holder Name | **Priya Sharma Test** | Yes |
| Account Number | **50100123456789** | Yes (9–18 chars) |
| IFSC Code | **HDFC0001234** | Yes (any bank: `AAAA0XXXXXX`) |
| Account Type | **Savings** | Optional |
| UPI VPA | **priya.test@okhdfcbank** | Optional |
| Beneficiary Purpose | **Others** (`others`) | Yes (default) |

**Other IFSC samples that pass validation:**

- `SBIN0001234` (SBI)
- `ICIC0000456` (ICICI)
- `AXIS0000789` (Axis)
- `PUNB0123456` (PNB)

---

## 7. Nominee Details (Optional)

| Field | Value |
|-------|--------|
| Nominee Name | **Ananya Sharma** |
| Relationship | **Sister** (`sibling`) |
| Nominee DOB | **2001-09-20** |
| Nominee Address | **Same as applicant address, New Delhi 110016** |

---

## 8. Selfie Verification

| Field | Value | Notes |
|-------|--------|--------|
| Selfie | Use **camera** in app, or `images/selfie.jpg` | Marked required in UI; take a clear face photo |

---

## 9. Declaration

| Field | Value | Required? |
|-------|--------|-----------|
| Place | **New Delhi** | Optional |
| Consent checkbox | **Checked** | Yes |

---

## Quick copy-paste block

```
Full name:        Priya Sharma Test
Father:           Ramesh Sharma
DOB:              1998-05-14
Gender:           female
Marital:          single
Nationality:      Indian
Occupation:       Student
Income:           below_1l

Mobile:           +91 98765 43210
Email:            priya.kyc.test@example.com
Current address:  Flat 12B, Green Park Residency, Near Metro Station, New Delhi
Permanent:        House 45, Village Road, Aligarh, UP
City:             New Delhi
State:            Delhi
PIN:              110016

ID type:          pan
ID number:        ABCDE1234F
Aadhaar:          999988887777

Bank:             HDFC Bank
Branch:           Connaught Place
Account holder:   Priya Sharma Test
Account number:   50100123456789
IFSC:             HDFC0001234
Account type:     savings
UPI:              priya.test@okhdfcbank
Purpose:          others

Nominee:          Ananya Sharma
Relation:         sibling
Nominee DOB:      2001-09-20
Place:            New Delhi
Consent:          YES
```

---

## After submit — verify checklist

1. Toast: **KYC submitted successfully!** (or updated)
2. Status badge: **Pending Review**
3. Admin → **KYC Management**: row for this user with bank / IFSC / Aadhaar last-4
4. Admin → **User Lookup** → KYC tab: same fields + document thumbnails
5. Re-open form as user: fields prefilled; editing approved KYC resets to pending
6. Optional: reject with reason → user sees rejection banner → resubmit with same pack
