# INEHSS Design Specification
**System Name**: Integrated National Environmental Health Surveillance System (INEHSS)
**Organization**: National Environmental Standards and Regulations Enforcement Agency (NESREA)

## 1. Overview
The INEHSS is a digital platform designed to monitor, report, and manage environmental hazards. It serves two distinct user groups:
1.  **General Public**: Can anonymously or simply report environmental hazards (pollution, waste dumping, fumes, etc.).
2.  **NESREA Officers**: Authenticated officials who receive assignments, conduct inspections, and file detailed technical reports.

## 2. User Roles & Workflows

### A. General Public (Unauthenticated)
**Goal**: Quick, barrier-free reporting of hazards.
**Workflow**:
1.  User visits `inehss.portal/report`.
2.  **Form**: "Public Hazard Report".
    *   **Location**: GPS (Auto-detected) + Manual Address.
    *   **Category**: Air, Water, Soil, Noise, Hazardous Waste.
    *   **Description**: Simple text.
    *   **Media**: Photo/Video upload.
    *   **Contact Info**: Optional (Name/Phone).
3.  **Submission**: Returns a Tracking ID for follow-up.

### B. NESREA Officers (Authenticated)
**Goal**: Detailed inspection, verification, and enforcement.
**Workflow**:
1.  **Login**: Secure credentials.
2.  **Dashboard**: View "Assigned Tasks", "Pending Reports", "Map View".
3.  **Assignment**:
    *   Admins/Supervisors assign a "Public Report" to an Officer.
    *   Officer receives notification.
4.  **Action**: Officer visits site.
5.  **Form**: "Technical Inspection Report" (Based on NESREA Standards).
    *   **Reference**: Links to original Public Report (if applicable).
    *   **Technical Data**: measurements (pH, decibels, etc.), violation codes.
    *   **Enforcement Action**: "Abatement Notice Served", "Sealed", "Fine Issued".
    *   **Status**: Open -> Investigating -> Resolved.

## 3. Data Architecture (Draft)

### Models

#### `HazardReport` (Generic)
-   `tracking_id` (UUID)
-   `status` (New, Assigned, In Progress, Closed)
-   `location` (Point)
-   `reporter_metadata` (JSON - IP, Device, optional contact)

#### `OfficerAssignment`
-   `officer` (ForeignKey to User)
-   `report` (ForeignKey to HazardReport)
-   `date_assigned`
-   `priority` (High, Medium, Low)

#### `InspectionLog`
-   `assignment` (ForeignKey)
-   `findings` (Text)
-   `compliance_score` (Integer)
-   `media_attachments` (Many-to-Many)

### Technical Inspection Forms (Officer Only)

#### `ChemicalSiteInspection`
Based on *NESREA Hazardous Chemical Site* verification:
-   **Facility Info**: Name, Address, Contact Person, GPS Coordinates.
-   **Site Characteristics**:
    -   `facility_type`: Warehouse, Manufacturing, Distributor, Retail, Informal/Workshop.
    -   `surroundings`: Residential, Commercial, Industrial, Agricultural, Sensitive (School/Hospital).
-   **Chemical Inventory**:
    -   `substance_type`: Acid, Alkali, Solvent, Pesticide, Heavy Metal, Unknown.
    -   `quantity_estimated`: Liters/Kg.
    -   `storage_condition`: Secure, Leaking, Open Container, Corroded, Improper Labeling.
-   **Exposure Assessment**:
    -   `odors_present`: Strong Chemical, Burning, Rotten Egg, None.
    -   `visual_evidence`: Spills, Stained Soil, Dead Vegetation, Corroded Structures.
    -   `risk_level`: Critical (Immediate Threat), High, Medium, Low.
-   **Enforcement Actions**:
    -   `action_taken`: Violation Notice, Site Sealed, Remediation Ordered, Evacuation.

#### `DumpsiteInspection`
Based on standard *Hazard Surveillance Dumpsites* form:
-   **Site Info**: Location, Size (Estimated Area), Official/Unofficial.
-   **Waste Composition**:
    -   `waste_types`: Electronic Waste, Medical Waste, Industrial Sludge, Municipal Solid Waste, Construction Debris.
    -   `burning_activity`: Active Burning, Evidence of Past Burning, None.
-   **Vectors & Hazards**:
    -   `vectors`: Rats, Flies, Scavengers Present.
    -   `leachate`: Visible Leachate (Liquid runoff), Water contamination risk.
-   **Proximity**: Distance to nearest settlement/water body.

## 4. UI/UX Strategy
-   **Theme**: Professional, authoritative (Green/White national colors + Warning High-Vis accents).
-   **Mobile First**: Officers will use this on tablets/phones in the field.
-   **Offline Mode**: Officer forms must save locally if network is poor.

## 5. Next Steps
1.  Define the exact fields for the "Officer" form (Waiting on specific "Hazard Surveillance" doc).
2.  Build the Backend API for `HazardReport`.
3.  Build the Public Frontend page.
4.  Build the Officer Dashboard.
