-- Add book_chapter_title column to journals table
-- This field stores the book title when the type is 'Book Chapter'
-- For Book Chapters: book_chapter_title = actual book title, title = chapter title

ALTER TABLE journals 
ADD COLUMN book_chapter_title VARCHAR(255) DEFAULT NULL 
AFTER title;