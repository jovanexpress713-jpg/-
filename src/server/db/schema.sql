-- ============================================================
-- مؤسسة إيجاز للنقليات · EJAZ TRANSPORT
-- Production PostgreSQL Database Schema V1.0
-- Comprehensive Logistics & Fleet Management Database Definition
-- ============================================================

-- Ensure UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS & ROLES
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(32),
    role VARCHAR(64) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. ROLES & PERMISSIONS
CREATE TABLE IF NOT EXISTS roles_permissions (
    role VARCHAR(64) NOT NULL,
    permission VARCHAR(128) NOT NULL,
    PRIMARY KEY (role, permission)
);

-- 3. VEHICLES (Restricted to official EJAZ types: براد, سطحة, جاف, ستارة)
CREATE TABLE IF NOT EXISTS vehicles (
    id VARCHAR(64) PRIMARY KEY,
    plate VARCHAR(32) UNIQUE NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (type IN ('براد', 'سطحة', 'جاف', 'ستارة')),
    model VARCHAR(128) NOT NULL,
    year INT NOT NULL,
    cab VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'in_trip', 'maintenance', 'idle', 'suspended')),
    max_load_tons NUMERIC(8, 2) NOT NULL,
    current_load_tons NUMERIC(8, 2) DEFAULT 0,
    fuel_level INT DEFAULT 100,
    engine_temp INT DEFAULT 90,
    odometer_km NUMERIC(12, 2) DEFAULT 0,
    assigned_driver_id VARCHAR(64),
    gps_device_id VARCHAR(64),
    gps_provider VARCHAR(64),
    registration_expiry DATE,
    insurance_expiry DATE,
    inspection_expiry DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vehicles_status ON vehicles(status);
CREATE INDEX IF NOT EXISTS idx_vehicles_type ON vehicles(type);

-- 4. DRIVERS
CREATE TABLE IF NOT EXISTS drivers (
    id VARCHAR(64) PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(32) NOT NULL,
    national_id VARCHAR(32) UNIQUE NOT NULL,
    license_number VARCHAR(64) UNIQUE NOT NULL,
    license_expiry DATE NOT NULL,
    assigned_vehicle_id VARCHAR(64) REFERENCES vehicles(id) ON DELETE SET NULL,
    status VARCHAR(32) DEFAULT 'available' CHECK (status IN ('available', 'on_trip', 'rest', 'suspended', 'leave')),
    rating NUMERIC(3, 2) DEFAULT 5.0,
    total_trips INT DEFAULT 0,
    current_trip_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);

-- 5. CUSTOMERS / CLIENTS
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(32) NOT NULL,
    email VARCHAR(255),
    commercial_reg VARCHAR(64),
    vat_number VARCHAR(64),
    city VARCHAR(128),
    address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. TRIPS (Central Business Object with Unified Trip Number)
CREATE TABLE IF NOT EXISTS trips (
    id VARCHAR(64) PRIMARY KEY,
    trip_number VARCHAR(64) UNIQUE NOT NULL, -- Format: EJ-YYYY-XXXXXX
    status VARCHAR(64) NOT NULL DEFAULT 'DRAFT_CREATED',
    customer_id VARCHAR(64) REFERENCES customers(id),
    vehicle_id VARCHAR(64) REFERENCES vehicles(id),
    driver_id VARCHAR(64) REFERENCES drivers(id),
    origin_city VARCHAR(128) NOT NULL,
    destination_city VARCHAR(128) NOT NULL,
    pickup_address TEXT,
    delivery_address TEXT,
    cargo_description TEXT NOT NULL,
    cargo_type VARCHAR(32) NOT NULL CHECK (cargo_type IN ('براد', 'سطحة', 'جاف', 'ستارة')),
    cargo_weight_tons NUMERIC(8, 2) NOT NULL,
    max_capacity_tons NUMERIC(8, 2) NOT NULL,
    temperature_required NUMERIC(5, 2), -- For Reefer (براد)
    corridor_key VARCHAR(64) DEFAULT 'riyadh-jeddah',
    current_lat NUMERIC(10, 6),
    current_lng NUMERIC(10, 6),
    current_speed NUMERIC(5, 2) DEFAULT 0,
    current_heading NUMERIC(5, 2) DEFAULT 0,
    departure_time TIMESTAMP WITH TIME ZONE,
    estimated_arrival TIMESTAMP WITH TIME ZONE,
    actual_arrival TIMESTAMP WITH TIME ZONE,
    trip_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
    driver_fee NUMERIC(12, 2) DEFAULT 0,
    fuel_cost NUMERIC(12, 2) DEFAULT 0,
    other_expenses NUMERIC(12, 2) DEFAULT 0,
    settlement_status VARCHAR(32) DEFAULT 'UNSETTLED' CHECK (settlement_status IN ('UNSETTLED', 'SETTLEMENT_PENDING', 'SETTLED')),
    payment_status VARCHAR(32) DEFAULT 'UNPAID' CHECK (payment_status IN ('UNPAID', 'PARTIALLY_PAID', 'PAID')),
    cancellation_reason TEXT,
    reopening_reason TEXT,
    created_by VARCHAR(64) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trips_trip_number ON trips(trip_number);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_vehicle_id ON trips(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_customer_id ON trips(customer_id);

-- 7. TRIP EVENTS (State transitions and operational timeline)
CREATE TABLE IF NOT EXISTS trip_events (
    id VARCHAR(64) PRIMARY KEY,
    trip_id VARCHAR(64) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    event_type VARCHAR(64) NOT NULL,
    from_status VARCHAR(64),
    to_status VARCHAR(64) NOT NULL,
    actor_id VARCHAR(64),
    actor_name VARCHAR(255),
    actor_role VARCHAR(64),
    notes TEXT,
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    metadata JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trip_events_trip_id ON trip_events(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_events_timestamp ON trip_events(timestamp);

-- 8. TRIP DOCUMENTS
CREATE TABLE IF NOT EXISTS trip_documents (
    id VARCHAR(64) PRIMARY KEY,
    trip_id VARCHAR(64) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    document_type VARCHAR(64) NOT NULL, -- 'BOL', 'COMMERCIAL_INVOICE', 'CARGO_INSURANCE', 'TEMP_LOG', 'POD'
    title VARCHAR(255) NOT NULL,
    file_url TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type VARCHAR(128),
    verification_status VARCHAR(32) DEFAULT 'VERIFIED',
    uploaded_by VARCHAR(64),
    expires_at DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trip_docs_trip_id ON trip_documents(trip_id);

-- 9. PROOF OF DELIVERY (POD)
CREATE TABLE IF NOT EXISTS pod_records (
    id VARCHAR(64) PRIMARY KEY,
    trip_id VARCHAR(64) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    recipient_name VARCHAR(255) NOT NULL,
    recipient_phone VARCHAR(32),
    recipient_national_id VARCHAR(32),
    signature_url TEXT,
    photo_urls JSONB DEFAULT '[]'::jsonb,
    latitude NUMERIC(10, 6),
    longitude NUMERIC(10, 6),
    confirmation_code VARCHAR(32),
    notes TEXT,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pod_trip_id ON pod_records(trip_id);

-- 10. CLAIMS / DAMAGES / SHORTAGES
CREATE TABLE IF NOT EXISTS claims (
    id VARCHAR(64) PRIMARY KEY,
    trip_id VARCHAR(64) NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    claim_number VARCHAR(64) UNIQUE NOT NULL,
    claim_type VARCHAR(64) NOT NULL, -- 'DAMAGE', 'SHORTAGE', 'TEMPERATURE_DEVIATION', 'DELAY', 'ACCIDENT'
    description TEXT NOT NULL,
    estimated_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) DEFAULT 'SAR',
    responsible_party VARCHAR(64) NOT NULL, -- 'DRIVER', 'TRANSPORTER', 'SHIPPER', 'WEATHER'
    evidence_urls JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(32) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'UNDER_INVESTIGATION', 'APPROVED', 'REJECTED', 'SETTLED')),
    resolution_notes TEXT,
    resolved_by VARCHAR(64),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_claims_trip_id ON claims(trip_id);

-- 11. INVOICES
CREATE TABLE IF NOT EXISTS invoices (
    id VARCHAR(64) PRIMARY KEY,
    trip_id VARCHAR(64) NOT NULL REFERENCES trips(id),
    invoice_number VARCHAR(64) UNIQUE NOT NULL,
    customer_id VARCHAR(64) NOT NULL REFERENCES customers(id),
    total_amount NUMERIC(12, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) NOT NULL DEFAULT 0, -- 15% VAT in KSA
    net_amount NUMERIC(12, 2) NOT NULL,
    status VARCHAR(32) DEFAULT 'ISSUED' CHECK (status IN ('ISSUED', 'SENT', 'PAID', 'OVERDUE', 'CANCELLED')),
    due_date DATE,
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    paid_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_invoices_trip_id ON invoices(trip_id);

-- 12. PAYMENTS & SETTLEMENTS
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    invoice_id VARCHAR(64) REFERENCES invoices(id),
    trip_id VARCHAR(64) NOT NULL REFERENCES trips(id),
    amount NUMERIC(12, 2) NOT NULL,
    payment_method VARCHAR(64) DEFAULT 'BANK_TRANSFER',
    reference_number VARCHAR(128),
    recorded_by VARCHAR(64) REFERENCES users(id),
    paid_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. GPS TELEMETRY (Real provider records)
CREATE TABLE IF NOT EXISTS gps_telemetry (
    id BIGSERIAL PRIMARY KEY,
    vehicle_id VARCHAR(64) NOT NULL REFERENCES vehicles(id),
    device_id VARCHAR(64),
    trip_id VARCHAR(64) REFERENCES trips(id),
    latitude NUMERIC(10, 6) NOT NULL,
    longitude NUMERIC(10, 6) NOT NULL,
    speed NUMERIC(5, 2) NOT NULL,
    heading NUMERIC(5, 2) DEFAULT 0,
    altitude NUMERIC(8, 2),
    accuracy NUMERIC(5, 2),
    ignition BOOLEAN DEFAULT TRUE,
    provider VARCHAR(64) NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gps_vehicle_time ON gps_telemetry(vehicle_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_gps_trip ON gps_telemetry(trip_id);

-- 14. NOTIFICATIONS
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64),
    target_role VARCHAR(64),
    title_ar VARCHAR(255) NOT NULL,
    title_en VARCHAR(255) NOT NULL,
    message_ar TEXT NOT NULL,
    message_en TEXT NOT NULL,
    type VARCHAR(32) NOT NULL DEFAULT 'INFO', -- 'INFO', 'WARNING', 'ALERT', 'SUCCESS'
    entity_type VARCHAR(64),
    entity_id VARCHAR(64),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(target_role, is_read);

-- 15. AUDIT LOG (Immutable Audit Trail)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    actor_id VARCHAR(64),
    actor_name VARCHAR(255),
    actor_role VARCHAR(64),
    action VARCHAR(128) NOT NULL,
    entity VARCHAR(64) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    trip_id VARCHAR(64),
    old_values JSONB,
    new_values JSONB,
    reason TEXT,
    ip_address VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_trip ON audit_logs(trip_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);

-- 16. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(128) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
