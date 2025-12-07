import express from 'express';
import {
  getEvents,
  getEventById,
  getEventSummary,
  createEvent,
  updateEvent,
  deleteEvent,
} from './eventController.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Events
 *   description: Event management
 */

// Event APIs
/**
 * @swagger
 * /events:
 *   get:
 *     summary: Get all events
 *     tags: [Events]
 *     responses:
 *       200:
 *         description: List of events
 *   post:
 *     summary: Create a new event
 *     tags: [Events]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Event created
 */
router.get('/', getEvents); // GET all events
router.post('/', createEvent); // CREATE new event

/**
 * @swagger
 * /events/{id}:
 *   get:
 *     summary: Get event by ID
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Event details
 *   put:
 *     summary: Update an event
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Event updated
 *   delete:
 *     summary: Delete an event
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Event deleted
 */
router.get('/:id', getEventById); // GET event by ID
router.put('/:id', updateEvent); // UPDATE event
router.delete('/:id', deleteEvent); // DELETE event

/**
 * @swagger
 * /events/{id}/summary:
 *   get:
 *     summary: Get event summary
 *     tags: [Events]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Event summary
 */
router.get('/:id/summary', getEventSummary); // GET event summary for EventPage

export default router;
