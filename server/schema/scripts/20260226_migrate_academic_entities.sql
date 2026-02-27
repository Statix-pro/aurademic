-- ==========================================================
-- ACADEMIC ENTITY - TOTAL CLEAN & SYNC MIGRATION
-- Target: 10.1.16.2 (research)
-- Date: Feb 26, 2026
-- Description: 
--   1. Deletes all academic entities NOT in the 71-item CSV list.
--   2. Syncs/Updates the 71 verified entities.
--   3. Syncs contact emails.
-- ==========================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_SAFE_UPDATES = 0;
START TRANSACTION;

-- STEP 1: Identify and Delete "Extra" or "Stale" entities
-- We use a temporary table to define the "Source of Truth" list of names.
CREATE TEMPORARY TABLE IF NOT EXISTS verified_entities (name VARCHAR(255));
TRUNCATE TABLE verified_entities;

INSERT INTO verified_entities (name) VALUES 
('Institutions Innovation Council'),('Intellectual Property Rights Cell'),('Consultancy'),('Entrepreneurship Development Cell'),
('Higher Education Cell'),('Alumni Cell'),('National Cadet Corps (NCC) Army Wing'),('National Cadet Corps (NCC) Air Wing'),
('National Service Scheme (NSS)'),('Youth Red Cross (YRC)'),('Red Ribbon Club (RRC)'),('Unnat Bharat Abhiyan (UBA)'),
('Autonomous'),('Internal Quality Assurance Cell'),('Training'),('Placement'),('Exam Cell'),('Admission'),('NPTEL'),
('Women Empowerment Cell'),('Press & Media'),('Overall Project Coordination'),
('Centre for Research and Development'),('Centre for Sustainable Development Goals'),('Centre for Skill Development'),
('AICTE IDEA Lab'),('Career Guidance Academy'),('Centre for Student Affairs'),('Centre for IT Infrastructure'),
('KSRCT MSME Business Incubator'),('KSRCT ACIC Incubation Foundation'),('National Instruments Centre of Excellence'),
('Cultural Club'),('Readers Club'),('NDLI Club'),('Service Motto Volunteers'),('LifX Club'),('Build Club'),
('Eco Care Club'),('Drone Club'),('PAC PMC Club'),('Tamil Mandram'),('Young Indians'),('Rotaract Club'),
('Movie & Literary Club'),('Coders Club'),
('ICT Academy'),('Indian Society for Technical Education'),('The Institution of Engineers (India)'),
('Institute of Electrical and Electronics Engineers'),('Institution of Electronics and Telecommunication Engineers'),
('Indian Welding Society'),('American Society of Mechanical Engineers'),('SAE Collegiate Club'),
('Textile Association of India'),('Madras Management Association'),('IEEE Engineering in Medicine and Biology Society'),
('Confederation of Indian Industry'),('Indian Concrete Institute'),('Indian Geotechnical Society'),
('Association of Food Scientist & Technologists (India)'),('Microbiologists Society, India'),
('The Indian Society of Heating, Refrigerating and Air Conditioning Engineers'),('The Indian Institute of Welding'),
('The Institute of Indian Foundrymen'),('American Society of Mechanical Engineers (Student Chapter)'),
('Society for the Advancement of Library and Information Science'),('Erode Salaram Foundation'),
('Local Library Authority, Erode & Namakkal'),('Computer Society of India'),('The Robotics Society');

-- Delete entities NOT in the list (for the specific academic types)
-- This also clears their contacts via ON DELETE CASCADE (if configured) or manual delete here
DELETE FROM master_entity_contacts 
WHERE entity_id IN (
    SELECT id FROM master_entities 
    WHERE name NOT IN (SELECT name FROM verified_entities)
    AND entity_type_id IN (SELECT id FROM master_entity_types WHERE code IN ('CELL', 'CENTRE', 'CLUB', 'PROFESSIONAL_BODY'))
);

DELETE FROM master_entities 
WHERE name NOT IN (SELECT name FROM verified_entities)
AND entity_type_id IN (SELECT id FROM master_entity_types WHERE code IN ('CELL', 'CENTRE', 'CLUB', 'PROFESSIONAL_BODY'));


-- STEP 2: Create Helper Procedure for Syncing
DROP PROCEDURE IF EXISTS SyncEntity;
DELIMITER //

CREATE PROCEDURE SyncEntity(
    IN p_type_code VARCHAR(50),
    IN p_name VARCHAR(255),
    IN p_acronym VARCHAR(50),
    IN p_email TEXT
)
BEGIN
    DECLARE v_type_id INT;
    DECLARE v_entity_id INT;
    DECLARE v_email_list TEXT;
    DECLARE v_email VARCHAR(255);
    DECLARE v_is_primary TINYINT DEFAULT 1;

    -- Get Type ID
    SELECT id INTO v_type_id FROM master_entity_types WHERE code = p_type_code LIMIT 1;

    IF v_type_id IS NOT NULL THEN
        -- Upsert Entity and ensure it is ACTIVE
        INSERT INTO master_entities (entity_type_id, name, code, is_active)
        VALUES (v_type_id, p_name, p_acronym, 1)
        ON DUPLICATE KEY UPDATE 
            code = p_acronym, 
            is_active = 1, 
            updated_at = CURRENT_TIMESTAMP;

        -- Get Entity ID
        SELECT id INTO v_entity_id FROM master_entities WHERE name = p_name AND entity_type_id = v_type_id LIMIT 1;

        -- Clean and Sync Contacts
        DELETE FROM master_entity_contacts WHERE entity_id = v_entity_id;
        
        -- Handle comma separated emails
        SET v_email_list = p_email;
        WHILE (LOCATE(',', v_email_list) > 0) DO
            SET v_email = TRIM(SUBSTRING(v_email_list, 1, LOCATE(',', v_email_list) - 1));
            INSERT INTO master_entity_contacts (entity_id, role, email, is_primary) VALUES (v_entity_id, 'office', v_email, v_is_primary);
            SET v_email_list = SUBSTRING(v_email_list, LOCATE(',', v_email_list) + 1);
            SET v_is_primary = 0;
        END WHILE;
        
        -- Last or only email
        INSERT INTO master_entity_contacts (entity_id, role, email, is_primary) VALUES (v_entity_id, 'office', TRIM(v_email_list), v_is_primary);
    END IF;
END //

DELIMITER ;

-- STEP 3: Execute Sync (71 Entities)

-- CELLS (22)
CALL SyncEntity('CELL', 'Institutions Innovation Council', 'IIC', 'iic@ksrct.ac.in');
CALL SyncEntity('CELL', 'Intellectual Property Rights Cell', 'IPR', 'iprpolicy@ksrct.ac.in');
CALL SyncEntity('CELL', 'Consultancy', 'CON', 'consultancy@ksrct.ac.in');
CALL SyncEntity('CELL', 'Entrepreneurship Development Cell', 'EDC', 'edc@ksrct.ac.in');
CALL SyncEntity('CELL', 'Higher Education Cell', 'HEC', 'hec@ksrct.ac.in');
CALL SyncEntity('CELL', 'Alumni Cell', 'ALM', 'alumni@ksrct.ac.in');
CALL SyncEntity('CELL', 'National Cadet Corps (NCC) Army Wing', 'NCCAR', 'nccarmy@ksrct.ac.in');
CALL SyncEntity('CELL', 'National Cadet Corps (NCC) Air Wing', 'NCCAI', 'nccairwing@ksrct.ac.in');
CALL SyncEntity('CELL', 'National Service Scheme (NSS)', 'NSS', 'nss@ksrct.ac.in');
CALL SyncEntity('CELL', 'Youth Red Cross (YRC)', 'YRC', 'yrc@ksrct.ac.in');
CALL SyncEntity('CELL', 'Red Ribbon Club (RRC)', 'RRC', 'rrc@ksrct.ac.in');
CALL SyncEntity('CELL', 'Unnat Bharat Abhiyan (UBA)', 'UBA', 'uba@ksrct.ac.in');
CALL SyncEntity('CELL', 'Autonomous', 'AUT', 'autonomous@ksrct.ac.in');
CALL SyncEntity('CELL', 'Internal Quality Assurance Cell', 'IQAC', 'iqac@ksrct.ac.in');
CALL SyncEntity('CELL', 'Training', 'TRA', 'training@ksrct.ac.in');
CALL SyncEntity('CELL', 'Placement', 'PLC', 'placement@ksrct.ac.in');
CALL SyncEntity('CELL', 'Exam Cell', 'EXC', 'examcell@ksrct.ac.in');
CALL SyncEntity('CELL', 'Admission', 'ADM', 'admission@ksrct.ac.in');
CALL SyncEntity('CELL', 'NPTEL', 'NPT', 'spocnptel@ksrct.ac.in');
CALL SyncEntity('CELL', 'Women Empowerment Cell', 'WEC', 'wec@ksrct.ac.in');
CALL SyncEntity('CELL', 'Press & Media', 'PAM', 'press@ksrct.ac.in');
CALL SyncEntity('CELL', 'Overall Project Coordination', 'OPC', 'opc@ksrct.ac.in');

-- CENTRES (10)
CALL SyncEntity('CENTRE', 'Centre for Research and Development', 'CFRD', 'headcfrd@ksrct.ac.in');
CALL SyncEntity('CENTRE', 'Centre for Sustainable Development Goals', 'CSDG', 'sdg@ksrct.ac.in');
CALL SyncEntity('CENTRE', 'Centre for Skill Development', 'CSD', 'csd@ksrct.ac.in');
CALL SyncEntity('CENTRE', 'AICTE IDEA Lab', 'IDEA', 'idealab@ksrct.ac.in');
CALL SyncEntity('CENTRE', 'Career Guidance Academy', 'CGA', 'cga@ksrct.ac.in');
CALL SyncEntity('CENTRE', 'Centre for Student Affairs', 'CSA', 'csa@ksrct.ac.in');
CALL SyncEntity('CENTRE', 'Centre for IT Infrastructure', 'CIT', 'directoritim@ksrct.ac.in');
CALL SyncEntity('CENTRE', 'KSRCT MSME Business Incubator', 'MSME', 'msme@ksrct.ac.in');
CALL SyncEntity('CENTRE', 'KSRCT ACIC Incubation Foundation', 'ACIC', 'acic@ksrct.ac.in');
CALL SyncEntity('CENTRE', 'National Instruments Centre of Excellence', 'NICE', 'nice@ksrct.ac.in');

-- CLUBS (14)
CALL SyncEntity('CLUB', 'Cultural Club', 'CUL', 'culturalclub@ksrct.ac.in');
CALL SyncEntity('CLUB', 'Readers Club', 'RDR', 'readersclub@ksrct.ac.in');
CALL SyncEntity('CLUB', 'NDLI Club', 'NDLI', 'ndliclub@ksrct.ac.in');
CALL SyncEntity('CLUB', 'Service Motto Volunteers', 'SMV', 'smvolunteers@ksrct.ac.in');
CALL SyncEntity('CLUB', 'LifX Club', 'LIFX', 'lifxclub@ksrct.ac.in');
CALL SyncEntity('CLUB', 'Build Club', 'BULD', 'buildclub@ksrct.ac.in');
CALL SyncEntity('CLUB', 'Eco Care Club', 'ECO', 'ecocareclub@ksrct.ac.in');
CALL SyncEntity('CLUB', 'Drone Club', 'DRO', 'droneclub@ksrct.ac.in');
CALL SyncEntity('CLUB', 'PAC PMC Club', 'PAC', 'pacpmc@ksrct.ac.in');
CALL SyncEntity('CLUB', 'Tamil Mandram', 'TMA', 'tamilmandram@ksrct.ac.in');
CALL SyncEntity('CLUB', 'Young Indians', 'YI', 'youngindians@ksrct.ac.in');
CALL SyncEntity('CLUB', 'Rotaract Club', 'RTC', 'rotractclub@ksrct.ac.in');
CALL SyncEntity('CLUB', 'Movie & Literary Club', 'MLC', 'library@ksrct.ac.in');
CALL SyncEntity('CLUB', 'Coders Club', 'CDC', 'karthickj@ksrct.ac.in');

-- PROFESSIONAL BODIES (25)
CALL SyncEntity('PROFESSIONAL_BODY', 'ICT Academy', 'ICTA', 'ictacademy@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Indian Society for Technical Education', 'ISTE', 'iste@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'The Institution of Engineers (India)', 'IEI', 'iei@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Institute of Electrical and Electronics Engineers', 'IEEE', 'ieee@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Institution of Electronics and Telecommunication Engineers', 'IETE', 'iete@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Indian Welding Society', 'IWS', 'iws@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'American Society of Mechanical Engineers', 'ASME', 'asme@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'SAE Collegiate Club', 'SAE', 'sae@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Textile Association of India', 'TAI', 'tai@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Madras Management Association', 'MMA', 'mma@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'IEEE Engineering in Medicine and Biology Society', 'IEEEEM', 'ieeeembs@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Confederation of Indian Industry', 'CII', 'cii@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Indian Concrete Institute', 'ICI', 'ici@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Indian Geotechnical Society', 'IGS', 'igs@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Association of Food Scientist & Technologists (India)', 'AFST', 'afst@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Microbiologists Society, India', 'MBS', 'mbs@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'The Indian Society of Heating, Refrigerating and Air Conditioning Engineers', 'ISHRAE', 'ishrae@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'The Indian Institute of Welding', 'IIW', 'iiw@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'The Institute of Indian Foundrymen', 'IIF', 'iif@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'American Society of Mechanical Engineers (Student Chapter)', 'ASMESS', 'asmess@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Society for the Advancement of Library and Information Science', 'SALIS', 'library@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Erode Salaram Foundation', 'ESF', 'library@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Local Library Authority, Erode & Namakkal', 'LLAEN', 'library@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'Computer Society of India', 'CSI', 'office@ksrct.ac.in, dineshkumarrt@ksrct.ac.in');
CALL SyncEntity('PROFESSIONAL_BODY', 'The Robotics Society', 'TRS', 'indumathi@ksrct.ac.in, sasikumarm@ksrct.ac.in');

-- Cleanup and Final Verification
DROP PROCEDURE IF EXISTS SyncEntity;
DROP TEMPORARY TABLE IF EXISTS verified_entities;
COMMIT;
SET FOREIGN_KEY_CHECKS = 1;

-- Verification Query
-- This should now show EXACTLY: CELL 22, CENTRE 10, CLUB 14, PROFESSIONAL_BODY 25
SELECT met.code AS 'Category', COUNT(me.id) AS 'Total Entities'
FROM master_entity_types met
JOIN master_entities me ON met.id = me.entity_type_id
GROUP BY met.code;
