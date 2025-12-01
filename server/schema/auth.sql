CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    picture VARCHAR(512),
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    INDEX idx_email (email)
); 


CREATE TABLE edit_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    entity_type ENUM('journals', 'research_projects') NOT NULL,
    entity_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected', 'none') NOT NULL;
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX entity_type_id_index (entity_type, entity_id) -- Index for efficient lookups
);