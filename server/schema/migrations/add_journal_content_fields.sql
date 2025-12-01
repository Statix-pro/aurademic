-- Migration: Add article_number, abstract, keywords, and sdgs columns to journals table
-- Date: 2025-01-16

ALTER TABLE journals 
ADD COLUMN article_number VARCHAR(50) AFTER pages_to,
ADD COLUMN abstract TEXT AFTER article_number,
ADD COLUMN keywords TEXT AFTER abstract,
ADD COLUMN sdgs JSON AFTER keywords;