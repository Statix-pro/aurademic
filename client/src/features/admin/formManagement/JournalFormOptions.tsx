import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { Table, Button, Form, Modal, Alert } from "react-bootstrap";
import authenticityUtility from "../../../shared/utils/authenticityUtility";
import "./FormManagementStyles.css";

interface JournalOption {
  id: number;
  journal_name: string;
  publisher?: string;
  website?: string;
  print_issn?: string;
  online_issn?: string;
  impact_factor?: number | null;
  cite_score?: number | null;
  category: string;
}

const JournalManagement: React.FC = () => {
  const [journals, setJournals] = useState<JournalOption[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentJournal, setCurrentJournal] = useState<Partial<JournalOption>>({
    journal_name: "",
    publisher: "",
    website: "",
    print_issn: "",
    online_issn: "",
    impact_factor: null,
    cite_score: null,
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
      const response = await authenticityUtility.get("/form-options/journals") as { data: JournalOption[] };
      setJournals(response.data || []);
    } catch (err: unknown) {
      console.error("Error fetching journals:", err);
      const error = err as { response?: { message?: string } };
      setError("Failed to fetch journals. " + (error.response?.message || "Please try again later."));
      setJournals([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      setLoading(true);
      setError("");

      if (isEditing && currentJournal.id) {
        await authenticityUtility.put(`/form-options/journals/${currentJournal.id}`, currentJournal);
      } else {
        await authenticityUtility.post("/form-options/journals", currentJournal);
      }

      setShowModal(false);
      fetchJournals();
      resetForm();
    } catch (err: unknown) {
      console.error("Error saving journal:", err);
      const error = err as { response?: { data?: { message?: string } } };
      setError("Failed to save journal. " + (error.response?.data?.message || "Please try again later."));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm("Are you sure you want to delete this journal?")) {
      try {
        setLoading(true);
        setError("");
        await authenticityUtility.delete(`/form-options/journals/${id}`);
        fetchJournals();
      } catch (err: unknown) {
        console.error("Error deleting journal:", err);
        const error = err as { response?: { data?: { message?: string } } };
        setError("Failed to delete journal. " + (error.response?.data?.message || "Please try again later."));
      } finally {
        setLoading(false);
      }
    }
  };

  const handleEdit = (journal: JournalOption) => {
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
      impact_factor: null,
      cite_score: null,
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
        <Button variant="primary" onClick={() => { resetForm(); setShowModal(true); }} disabled={loading}>
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
            <th>Impact Factor</th>
            <th>Cite Score</th>
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
                  <span className={`badge bg-${journal.category === "International" ? "primary" : "secondary"}`}>
                    {journal.category || "National"}
                  </span>
                </td>
                <td>{journal.publisher}</td>
                <td>{journal.print_issn}</td>
                <td>{journal.online_issn}</td>
                <td>{journal.impact_factor ?? "-"}</td>
                <td>{journal.cite_score ?? "-"}</td>
                <td>{journal.website}</td>
                <td>
                  <Button variant="primary" size="sm" className="me-2" onClick={() => handleEdit(journal)}>Edit</Button>
                  <Button variant="danger" size="sm" onClick={() => handleDelete(journal.id)}>Delete</Button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={9} className="text-center">{loading ? "Loading..." : "No journals found"}</td>
            </tr>
          )}
        </tbody>
      </Table>

      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>{isEditing ? "Edit Journal" : "Add New Journal"}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form onSubmit={handleSubmit}>
            <Form.Group className="mb-3">
              <Form.Label>Journal Name</Form.Label>
              <Form.Control
                type="text"
                value={currentJournal.journal_name || ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentJournal({ ...currentJournal, journal_name: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Category</Form.Label>
              <Form.Select
                value={currentJournal.category || "National"}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setCurrentJournal({ ...currentJournal, category: e.target.value })}
                required
              >
                <option value="National">National</option>
                <option value="International">International</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Publisher *</Form.Label>
              <Form.Control
                type="text"
                value={currentJournal.publisher || ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentJournal({ ...currentJournal, publisher: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Print ISSN *</Form.Label>
              <Form.Control
                type="text"
                value={currentJournal.print_issn || ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentJournal({ ...currentJournal, print_issn: e.target.value })}
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Online ISSN *</Form.Label>
              <Form.Control
                type="text"
                value={currentJournal.online_issn || ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentJournal({ ...currentJournal, online_issn: e.target.value })}
                required
              />
            </Form.Group>
            <div className="row mb-3">
              <div className="col-6">
                <Form.Group>
                  <Form.Label>Impact Factor *</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.001"
                    value={currentJournal.impact_factor ?? ""}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentJournal({ ...currentJournal, impact_factor: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="e.g., 5.123"
                    required
                  />
                </Form.Group>
              </div>
              <div className="col-6">
                <Form.Group>
                  <Form.Label>Cite Score *</Form.Label>
                  <Form.Control
                    type="number"
                    step="0.001"
                    value={currentJournal.cite_score ?? ""}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentJournal({ ...currentJournal, cite_score: e.target.value ? parseFloat(e.target.value) : null })}
                    placeholder="e.g., 8.5"
                    required
                  />
                </Form.Group>
              </div>
            </div>
            <Form.Group className="mb-3">
              <Form.Label>Website *</Form.Label>
              <Form.Control
                type="text"
                value={currentJournal.website || ""}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setCurrentJournal({ ...currentJournal, website: e.target.value })}
                required
              />
            </Form.Group>
            <div className="d-flex justify-content-end">
              <Button variant="secondary" className="me-2" onClick={() => setShowModal(false)} disabled={loading}>Cancel</Button>
              <Button variant="primary" type="submit" disabled={loading}>{loading ? "Saving..." : "Save"}</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default JournalManagement;
