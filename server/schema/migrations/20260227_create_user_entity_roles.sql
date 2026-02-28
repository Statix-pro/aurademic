-- Migration: Create user_entity_roles mapping table for multi-context RBAC

CREATE TABLE IF NOT EXISTS user_entity_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    entity_id INT NOT NULL,
    entity_type ENUM('DEPARTMENT', 'CENTRE', 'CELL', 'CLUB', 'PROFESSIONAL_BODY') NOT NULL,
    role_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_entity_role (user_id, entity_id, entity_type, role_id),
    CONSTRAINT fk_uer_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_uer_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
    -- Note: We do not enforce a strict FK on entity_id because it spans multiple tables (departments vs master_entities)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
