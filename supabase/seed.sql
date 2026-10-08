-- =============================================================================
-- KMFRI Scientists & Research Management System
-- Non-Operational Reference Data Seed Script (supabase/seed.sql)
-- Strictly seeds ONLY Roles, Permissions, Role-Permissions, Directorates,
-- Research Areas, and System Settings. Zero fake operational records.
-- =============================================================================

-- 1. Seed RBAC Roles
INSERT INTO public.roles (id, code, name, description) VALUES
  ('10000000-0000-4000-8000-000000000001', 'SUPER_ADMIN', 'SUPER ADMIN', 'Full system governance, security configuration, role management, and unrestricted institutional oversight.'),
  ('10000000-0000-4000-8000-000000000002', 'ADMIN', 'ADMIN', 'Institutional administrator managing scientist accounts, reference tables, projects, funding, and system imports/exports.'),
  ('10000000-0000-4000-8000-000000000003', 'DIRECTOR', 'DIRECTOR / OVERALL MANAGEMENT', 'Executive leadership with institution-wide analytics, project/report approval authority, and strategic oversight.'),
  ('10000000-0000-4000-8000-000000000004', 'HEAD_OCS', 'HEAD OF OCEANS & COASTAL SYSTEMS', 'Directorate head overseeing Oceans & Coastal Systems scientists, projects, funding, reports, and marine sites.'),
  ('10000000-0000-4000-8000-000000000005', 'SCIENTIST', 'SCIENTIST / RESEARCHER', 'Research scientist managing assigned projects, milestones, field activities, technical reports, and publications.'),
  ('10000000-0000-4000-8000-000000000006', 'VIEWER', 'VIEWER', 'Read-only stakeholder access to approved dashboards, project portfolios, locations, and published research outputs.')
ON CONFLICT (code) DO NOTHING;

-- 2. Seed Granular Permissions
INSERT INTO public.permissions (id, code, module, description) VALUES
  ('20000000-0000-4000-8000-000000000001', 'users:manage', 'Administration', 'Create, update, deactivate, and reactivate scientist and user accounts'),
  ('20000000-0000-4000-8000-000000000002', 'users:view', 'Administration', 'View scientist and user accounts (read-only)'),
  ('20000000-0000-4000-8000-000000000003', 'users:reset_password', 'Administration', 'Initiate and execute password resets for user accounts'),
  ('20000000-0000-4000-8000-000000000004', 'roles:manage', 'Administration', 'Manage RBAC role assignments and permission mappings'),
  ('20000000-0000-4000-8000-000000000005', 'projects:create', 'Projects', 'Create new research project proposals'),
  ('20000000-0000-4000-8000-000000000006', 'projects:edit', 'Projects', 'Update project metadata, milestones, deliverables, and progress'),
  ('20000000-0000-4000-8000-000000000007', 'projects:approve', 'Projects', 'Approve, suspend, or cancel research projects'),
  ('20000000-0000-4000-8000-000000000008', 'projects:archive', 'Projects', 'Archive or restore completed/cancelled projects'),
  ('20000000-0000-4000-8000-000000000009', 'funding:manage', 'Funding', 'Create and update funders, grant awards, and budget allocations'),
  ('20000000-0000-4000-8000-000000000010', 'reports:submit', 'Reports', 'Draft and submit project technical and progress reports'),
  ('20000000-0000-4000-8000-000000000011', 'reports:review', 'Reports', 'Review, approve, or reject submitted scientist reports'),
  ('20000000-0000-4000-8000-000000000012', 'reports:view', 'Reports', 'View completed and approved research reports'),
  ('20000000-0000-4000-8000-000000000013', 'locations:manage', 'Locations', 'Register and edit GIS sampling stations and marine coordinates'),
  ('20000000-0000-4000-8000-000000000014', 'collaborators:manage', 'Collaborators', 'Manage partner institutions and MOU agreements'),
  ('20000000-0000-4000-8000-000000000015', 'outputs:manage', 'Research Outputs', 'Create and update publications, datasets, presentations, and technical reports'),
  ('20000000-0000-4000-8000-000000000016', 'documents:manage', 'Documents', 'Upload, version, and manage research attachments'),
  ('20000000-0000-4000-8000-000000000017', 'settings:manage', 'Administration', 'Configure institutional settings, reference tables, and deadlines'),
  ('20000000-0000-4000-8000-000000000018', 'audit:view', 'Administration', 'Inspect immutable security and operational audit trails'),
  ('20000000-0000-4000-8000-000000000019', 'export:data', 'System', 'Export datasets and analytics to CSV, Excel, and PDF formats')
ON CONFLICT (code) DO NOTHING;

-- 3. Seed Role-Permission Mappings
INSERT INTO public.role_permissions (id, role_id, permission_id)
SELECT gen_random_uuid(), r.id, p.id
FROM public.roles r
JOIN public.permissions p ON p.code IN (
  CASE r.code
    WHEN 'SUPER_ADMIN' THEN ('users:manage','users:view','users:reset_password','roles:manage','projects:create','projects:edit','projects:approve','projects:archive','funding:manage','reports:submit','reports:review','reports:view','locations:manage','collaborators:manage','outputs:manage','documents:manage','settings:manage','audit:view','export:data')
    WHEN 'ADMIN' THEN ('users:manage','users:view','users:reset_password','projects:create','projects:edit','projects:archive','funding:manage','reports:submit','reports:view','locations:manage','collaborators:manage','outputs:manage','documents:manage','settings:manage','audit:view','export:data')
    WHEN 'DIRECTOR' THEN ('users:view','projects:create','projects:edit','projects:approve','projects:archive','funding:manage','reports:review','reports:view','collaborators:manage','export:data')
    WHEN 'HEAD_OCS' THEN ('users:view','projects:create','projects:edit','projects:approve','funding:manage','reports:submit','reports:review','reports:view','locations:manage','collaborators:manage','outputs:manage','documents:manage','export:data')
    WHEN 'SCIENTIST' THEN ('projects:create','projects:edit','reports:submit','reports:view','locations:manage','outputs:manage','documents:manage','export:data')
    WHEN 'VIEWER' THEN ('users:view','reports:view','export:data')
    ELSE NULL
  END
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- 4. Seed KMFRI Directorates (Official Non-Operational Reference Data)
INSERT INTO public.directorates (id, code, name, headquarters, description, is_active) VALUES
  ('30000000-0000-4000-8000-000000000001', 'OCS', 'Oceans and Coastal Systems', 'Mombasa Headquarters (English Point)', 'Leads marine ecology, oceanography, coral reef conservation, blue carbon ecosystems, and Exclusive Economic Zone (EEZ) fisheries research.', TRUE),
  ('30000000-0000-4000-8000-000000000002', 'FWS', 'Freshwater Systems', 'Kisumu Research Centre', 'Coordinates limnological, stock assessment, and catchment biodiversity research across Lake Victoria, Lake Turkana, Lake Baringo, and Lake Naivasha.', TRUE),
  ('30000000-0000-4000-8000-000000000003', 'ARD', 'Aquaculture Research and Development', 'Sagana Aquaculture Centre', 'Focuses on mariculture, freshwater fish breeding, feed formulation, aquatic animal health, and post-harvest value addition.', TRUE),
  ('30000000-0000-4000-8000-000000000004', 'SPG', 'Socio-Economics, Policy and Governance', 'Mombasa Headquarters', 'Conducts socio-economic valuation, marine spatial planning, BMU co-management studies, and Blue Economy policy advisory.', TRUE),
  ('30000000-0000-4000-8000-000000000005', 'LAB', 'Aquatic Environment & Quality Laboratories', 'Mombasa & Kisumu Analytical Labs', 'Provides ISO-accredited water quality, heavy metal toxicology, microplastics, and fish safety analytical services.', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 4. Seed KMFRI Research Areas (Official Non-Operational Reference Data)
INSERT INTO public.research_areas (id, code, name, directorate_id, description, is_active) VALUES
  ('40000000-0000-4000-8000-000000000001', 'OCS-REEF', 'Coral Reef Ecology & Benthic Dynamics', '30000000-0000-4000-8000-000000000001', 'Thermal bleaching monitoring, reef resilience assessment, and benthic habitat restoration along the Kenyan coast.', TRUE),
  ('40000000-0000-4000-8000-000000000002', 'OCS-OCEAN', 'Physical, Chemical & Biological Oceanography', '30000000-0000-4000-8000-000000000001', 'Western Indian Ocean circulation, upwelling productivity, ocean acidification, and RV Mtafiti offshore hydrographic surveys.', TRUE),
  ('40000000-0000-4000-8000-000000000003', 'OCS-CARBON', 'Mangrove & Seagrass Blue Carbon Systems', '30000000-0000-4000-8000-000000000001', 'Carbon sequestration accounting, Gazi Bay mangrove restoration, and seagrass meadow mapping.', TRUE),
  ('40000000-0000-4000-8000-000000000004', 'OCS-FISH', 'Marine Stock Assessment & Pelagic Fisheries', '30000000-0000-4000-8000-000000000001', 'Artisanal and offshore tuna/pelagic stock assessments, catch-effort analytics, and bycatch mitigation.', TRUE),
  ('40000000-0000-4000-8000-000000000005', 'FWS-LIMN', 'Inland Waters Limnology & Catchment Ecology', '30000000-0000-4000-8000-000000000002', 'Eutrophication tracking, invasive macrophyte dynamics, and freshwater biodiversity monitoring.', TRUE),
  ('40000000-0000-4000-8000-000000000006', 'ARD-MARI', 'Coastal Mariculture & Seed Production', '30000000-0000-4000-8000-000000000003', 'Seaweed farming, mud crab fattening, marine finfish hatchery protocols, and cage culture sustainability.', TRUE),
  ('40000000-0000-4000-8000-000000000007', 'SPG-MSP', 'Marine Spatial Planning & Blue Economy Governance', '30000000-0000-4000-8000-000000000004', 'Coastal community livelihoods, Beach Management Unit (BMU) governance, and EEZ spatial zoning.', TRUE),
  ('40000000-0000-4000-8000-000000000008', 'LAB-ECOTOX', 'Marine Pollution, Ecotoxicology & Post-Harvest Safety', '30000000-0000-4000-8000-000000000005', 'Microplastic pollution baselines, heavy metal bioaccumulation, and post-harvest value chain quality assurance.', TRUE)
ON CONFLICT (code) DO NOTHING;

-- 5. Seed System Settings
INSERT INTO public.system_settings (id, setting_key, setting_value, category, description) VALUES
  ('50000000-0000-4000-8000-000000000001', 'institution_profile', '{"name":"Kenya Marine and Fisheries Research Institute","shortName":"KMFRI","ministry":"Ministry of Mining, Blue Economy and Maritime Affairs","headquarters":"English Point, Mkomani, Mombasa, Kenya","website":"https://www.kmfri.go.ke"}'::jsonb, 'General', 'Official institutional identity and parent ministry metadata'),
  ('50000000-0000-4000-8000-000000000002', 'reporting_policy', '{"autoFlagOverdue":true,"reminderDaysBeforeDue":7,"gracePeriodDays":0,"requireAttachmentOnSubmit":false}'::jsonb, 'Reports', 'Automated deadline and overdue report governance rules'),
  ('50000000-0000-4000-8000-000000000003', 'storage_policy', '{"maxFileSizeMB":25,"allowedExtensions":[".pdf",".docx",".xlsx",".csv",".geojson",".png",".jpg"]}'::jsonb, 'Storage', 'Document upload validation constraints and permitted file formats'),
  ('50000000-0000-4000-8000-000000000004', 'financial_policy', '{"defaultCurrency":"KES","supportedCurrencies":["KES","USD","EUR","GBP"],"fiscalYearStartMonth":7}'::jsonb, 'Finance', 'Default currency and Government of Kenya fiscal year calendar (July - June)')
ON CONFLICT (setting_key) DO NOTHING;

-- 6. Seed System Administrator Bootstrap Accounts
INSERT INTO public.users (
  id, staff_number, email, full_name, title, position, role_id, role_code,
  phone, office_station, is_active, is_operational_scientist, password_reset_required
) VALUES
  (
    '00000000-0000-4000-8000-000000000001', 'SYS-BOOTSTRAP-01', 'sysadmin@kmfri.go.ke',
    'KMFRI System Administrator', 'Sys.', 'Chief Information & Governance Administrator',
    '10000000-0000-4000-8000-000000000001', 'SUPER_ADMIN',
    '+254 20 8021560', 'Mombasa Headquarters (English Point)', TRUE, FALSE, FALSE
  ),
  (
    '00000000-0000-4000-8000-000000000004', 'SYS-DG-01', 'dg@kmfri.go.ke',
    'Director General', 'Prof.', 'Director General / Chief Executive Officer',
    '10000000-0000-4000-8000-000000000003', 'DIRECTOR',
    '+254 20 8021560', 'Mombasa Headquarters (English Point)', TRUE, FALSE, FALSE
  )
ON CONFLICT (email) DO NOTHING;
