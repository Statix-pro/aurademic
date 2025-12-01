-- Add publication_details JSON column to journals table
-- This field stores category-specific details (Conference Title, Publisher, Source, ISBN) 
-- for Conference, Book Chapter, and Book categories as JSON

ALTER TABLE journals 
ADD COLUMN publication_details JSON DEFAULT NULL 
AFTER book_chapter_title;

