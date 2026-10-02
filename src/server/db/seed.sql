-- ============================================================
-- مؤسسة إيجاز للنقليات · EJAZ TRANSPORT
-- Database Seed Data (Roles, Permissions, Official Fleet & Users)
-- ============================================================

-- Roles & Granular Permissions
INSERT INTO roles_permissions (role, permission) VALUES
('SUPER_ADMIN', '*'),
('GENERAL_MANAGER', 'trips.view'), ('GENERAL_MANAGER', 'trips.approve'), ('GENERAL_MANAGER', 'trips.reopen'), ('GENERAL_MANAGER', 'trips.cancel'), ('GENERAL_MANAGER', 'finance.view'), ('GENERAL_MANAGER', 'finance.approve'), ('GENERAL_MANAGER', 'reports.view'), ('GENERAL_MANAGER', 'reports.export'), ('GENERAL_MANAGER', 'audit.view'),
('OPERATIONS_MANAGER', 'trips.view'), ('OPERATIONS_MANAGER', 'trips.create'), ('OPERATIONS_MANAGER', 'trips.assign'), ('OPERATIONS_MANAGER', 'trips.transition'), ('OPERATIONS_MANAGER', 'vehicles.view'), ('OPERATIONS_MANAGER', 'vehicles.assign'), ('OPERATIONS_MANAGER', 'drivers.view'), ('OPERATIONS_MANAGER', 'gps.view'), ('OPERATIONS_MANAGER', 'reports.view'),
('DISPATCHER', 'trips.view'), ('DISPATCHER', 'trips.create'), ('DISPATCHER', 'trips.assign'), ('DISPATCHER', 'trips.transition'), ('DISPATCHER', 'vehicles.view'), ('DISPATCHER', 'drivers.view'), ('DISPATCHER', 'gps.view'),
('ACCOUNTANT', 'finance.view'), ('ACCOUNTANT', 'finance.create'), ('ACCOUNTANT', 'finance.approve'), ('ACCOUNTANT', 'finance.settle'), ('ACCOUNTANT', 'trips.view'), ('ACCOUNTANT', 'reports.view'),
('DRIVER', 'trips.view'), ('DRIVER', 'trips.transition'), ('DRIVER', 'pod.create'), ('DRIVER', 'documents.upload'),
('CUSTOMER', 'trips.view'), ('CUSTOMER', 'trips.create'), ('CUSTOMER', 'documents.view'), ('CUSTOMER', 'claims.create'),
('WAREHOUSE', 'trips.view'), ('WAREHOUSE', 'loading.record'), ('WAREHOUSE', 'documents.view'),
('BROKER', 'trips.view'), ('BROKER', 'trips.create'),
('CUSTOMS_BROKER', 'trips.view'), ('CUSTOMS_BROKER', 'documents.upload'), ('CUSTOMS_BROKER', 'documents.view'),
('REPRESENTATIVE', 'trips.view'), ('REPRESENTATIVE', 'documents.view')
ON CONFLICT DO NOTHING;

-- Seed Default System Setting
INSERT INTO system_settings (key, value, description) VALUES
('company_info', '{"name_ar": "مؤسسة إيجاز للنقليات", "name_en": "EJAZ TRANSPORT ESTABLISHMENT", "cr": "1010892019", "vat": "310492817200003", "city": "Riyadh"}', 'Official Corporate Profile'),
('gps_provider_config', '{"provider": "NONE_CONFIGURED", "status": "OFFLINE", "endpoint": "", "api_key": ""}', 'Active Telemetry Gateway Config')
ON CONFLICT DO NOTHING;
