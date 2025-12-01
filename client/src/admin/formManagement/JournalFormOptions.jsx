import React, { useState, useEffect } from "react";
import { Table, Button, Form, Modal, Alert } from "react-bootstrap";
import authenticityUtility from "../../utility/authenticityUtility";
import "./FormManagementStyles.css";

const JournalManagement = () => {
  const [journals, setJournals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentJournal, setCurrentJournal] = useState({
    journal_name: "",
    publisher: "",
    website: "",
    print_issn: "",
    online_issn: "",
    category: "National",
  });
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchJournals();
  }, []);

  const fetchJournals = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await authenticityUtility.get("/form-options/journals");
      console.log("Response:", response);
      setJournals(response.data || []);
    } catch (error) {
      console.error("Error fetching journals:", error);
      setError(
        "Failed to fetch journals. " +
          (error.response?.message || "Please try again later."),
      );
      setJournals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      if (isEditing) {
        await authenticityUtility.put(
          `/form-options/journals/${currentJournal.id}`,
          currentJournal,
        );
      } else {
        await authenticityUtility.post(
          "/form-options/journals",
          currentJournal,
        );
      }

      setShowModal(false);
      fetchJournals();
      resetForm();
    } catch (error) {
      console.error("Error saving journal:", error);
      setError(
        "Failed to save journal. " +
          (error.response?.data?.message || "Please try again later."),
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this journal?")) {
      try {
        setLoading(true);
        setError("");
        await authenticityUtility.delete(`/form-options/journals/${id}`);
        fetchJournals();
      } catch (error) {
        console.error("Error deleting journal:", error);
        setError(
          "Failed to delete journal. " +
            (error.response?.data?.message || "Please try again later."),
        );
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEdit = (journal) => {
    setCurrentJournal(journal);
    setIsEditing(true);
    setShowModal(true);
  };

  const resetForm = () => {
    setCurrentJournal({
      journal_name: "",
      publisher: "",
      website: "",
      print_issn: "",
      online_issn: "",
      category: "National",
    });
    setIsEditing(false);
    setError("");
  };

  return (
    <div className="journal-management container mt-4">
      {error && <Alert variant="danger">{error}</Alert>}
      {loading && (
        <div className="text-center mb-3">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
        </div>
      )}

      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Journal Management</h2>
        <Button
          variant="primary"
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          disabled={loading}
        >
          Add New Journal
        </Button>
      </div>

      <Table striped bordered hover>
        <thead>
          <tr>
            <th>Journal Name</th>
            <th>Category</th>
            <th>Publisher</th>
            <th>Print ISSN</th>
            <th>Online ISSN</th>
            <th>Website</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {journals && journals.length > 0 ? (
            journals.map((journal) => (
              <tr key={journal.id}>
                <td>{journal.journal_name}</td>
                <td>
                  <span
                    className={`badge bg-${journal.category === "International" ? "primary" : "secondary"}`}
                  >
                    {journal.category || "National"}
                  </span>
                </td>
                <td>{journal.publisher}</td>
                <td>{journal.print_issn}</td>
                <td>{journal.online_issn}</td>
                <td>{journal.website}</td>
                <td>
                  <Button
                    variant="primary"
                    size="sm"
                    className="me-2"
                    onClick={() => handleEdit(journal)}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(journal.id)}
                  >
                    Delete
                  </Button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="7" className="text-center">
                {loading ? "Loading..." : "No journals found"}
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            {isEditing ? "Edit Journal" : "Add New Journal"}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Journal Name</Form.Label>
              <Form.Control
                type="text"
                value={currentJournal.journal_name}
                onChange={(e) =>
                  setCurrentJournal({
                    ...currentJournal,
                    journal_name: e.target.value,
                  })
                }
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Category</Form.Label>
              <Form.Select
                value={currentJournal.category}
                onChange={(e) =>
                  setCurrentJournal({
                    ...currentJournal,
                    category: e.target.value,
                  })
                }
                required
              >
                <option value="National">National</option>
                <option value="International">International</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Publisher</Form.Label>
              <Form.Control
                type="text"
                value={currentJournal.publisher}
                onChange={(e) =>
                  setCurrentJournal({
                    ...currentJournal,
                    publisher: e.target.value,
                  })
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Print ISSN</Form.Label>
              <Form.Control
                type="text"
                value={currentJournal.print_issn}
                onChange={(e) =>
                  setCurrentJournal({
                    ...currentJournal,
                    print_issn: e.target.value,
                  })
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Online ISSN</Form.Label>
              <Form.Control
                type="text"
                value={currentJournal.online_issn}
                onChange={(e) =>
                  setCurrentJournal({
                    ...currentJournal,
                    online_issn: e.target.value,
                  })
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Website</Form.Label>
              <Form.Control
                type="text"
                value={currentJournal.website}
                onChange={(e) =>
                  setCurrentJournal({
                    ...currentJournal,
                    website: e.target.value,
                  })
                }
              />
            </Form.Group>
            <div className="d-flex justify-content-end">
              <Button
                variant="secondary"
                className="me-2"
                onClick={() => setShowModal(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default JournalManagement;
