-- Migration: Create Master Departments Table
-- Author: System
-- Date: 2026-01-19
-- Description: Global department master table for all modules
-- Run Order: 1 of 3

-- ============================================
-- MASTER DEPARTMENTS TABLE
-- ============================================
-- This is the global departments table that will be referenced by:
-- - master_employees (staff department)
-- - events (organizing department)
-- - publications (author affiliation)
-- - And all future modules

CREATE TABLE IF NOT EXISTS master_departments (
    id INT NOT NULL AUTO_INCREMENT,
    
    -- ========================
    -- CORE INFORMATION
    -- ========================
    code VARCHAR(20) UNIQUE COMMENT 'Short code like CSE, ECE, MBA',
    name VARCHAR(255) NOT NULL COMMENT 'Full department name',
    
    -- ========================
    -- HIERARCHY
    -- ========================
    parent_id INT NULL COMMENT 'For parent department relationship (e.g., ECE under Engineering)',
    
    -- ========================
    -- CLASSIFICATION
    -- ========================
    type ENUM('Academic', 'Administrative', 'Support', 'Research') DEFAULT 'Academic',
    
    -- ========================
    -- CONTACT (Optional)
    -- ========================
    hod_name VARCHAR(255) COMMENT 'Head of Department name (denormalized for quick access)',
    email VARCHAR(255) COMMENT 'Department email',
    phone VARCHAR(20) COMMENT 'Department phone',
    
    -- ========================
    -- METADATA
    -- ========================
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0 COMMENT 'For custom ordering in dropdowns',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    KEY idx_dept_code (code),
    KEY idx_dept_name (name),
    KEY idx_dept_parent (parent_id),
    KEY idx_dept_active (is_active),
    CONSTRAINT fk_dept_parent FOREIGN KEY (parent_id) REFERENCES master_departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ============================================
-- SEED DATA: Common Departments
-- ============================================
-- Customize this list based on your college structure

INSERT INTO master_departments (code, name, type, sort_order) VALUES
-- Engineering Departments (From actual CSV data)
('AIDS', 'Artificial Intelligence & Data Science', 'Academic', 1),
('AIML', 'CSE (Artificial Intelligence and Machine Learning)', 'Academic', 2),
('BT', 'Biotechnology', 'Academic', 3),
('CIVIL', 'Civil Engineering', 'Academic', 4),
('CSE', 'Computer Science and Engineering', 'Academic', 5),
('CSBS', 'Computer Science and Business Systems', 'Academic', 6),
('ECE', 'Electronics and Communication Engineering', 'Academic', 7),
('EEE', 'Electrical and Electronics Engineering', 'Academic', 8),
('FT', 'Food Technology', 'Academic', 9),
('IT', 'Information Technology', 'Academic', 10),
('MCT', 'Mechatronics Engineering', 'Academic', 11),
('MECH', 'Mechanical Engineering', 'Academic', 12),
('TT', 'Textile Technology', 'Academic', 13),
('VLSI', 'Electronics Engineering (VLSI Design & Technology)', 'Academic', 14),
('NST', 'Nano Science and Technology', 'Academic', 15),

-- Management & Applications
('MBA', 'Master of Business Administration', 'Academic', 20),
('MCA', 'Master of Computer Application', 'Academic', 21),

-- Science & Humanities (Parent Departments from CSV)
('PHYSICS', 'Physics', 'Academic', 30),
('CHEMISTRY', 'Chemistry', 'Academic', 31),
('MATHS', 'Mathematics', 'Academic', 32),
('ENGLISH', 'English', 'Academic', 33),

-- Administrative
('ADMIN', 'Administration', 'Administrative', 50);

-- ============================================
-- VERIFICATION
-- ============================================
-- Run after migration:
-- SELECT * FROM master_departments ORDER BY sort_order;
