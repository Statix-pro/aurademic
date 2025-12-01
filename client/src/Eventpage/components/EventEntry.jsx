import React, { useState } from "react";
import Navbar from "../../components/navbar/navbar";
import { Plus, Trash2 } from "lucide-react";
import "../styles/EventEntry.css";

export default function EventEntry() {
  const [entries, setEntries] = useState([
    {
      role: "",
      category: "",
      name: "",
      designation: "",
      department: "",
      organization: "",
      country: "",
    },
  ]);

  const handleChange = (index, field, value) => {
    const updated = [...entries];
    updated[index][field] = value;
    setEntries(updated);
  };

  const handleAddRow = (index) => {
    const newRow = {
      role: "",
      category: "",
      name: "",
      designation: "",
      department: "",
      organization: "",
      country: "",
    };
    const updated = [...entries];
    updated.splice(index + 1, 0, newRow); // add below current
    setEntries(updated);
  };

  const handleDeleteRow = (index) => {
    if (entries.length === 1) return; // prevent deleting last row
    const updated = entries.filter((_, i) => i !== index);
    setEntries(updated);
  };

  return (
    <div className="event-entry-container">
      <Navbar />
      <div className="content">
        <h2 className="section-title">Project Investigators</h2>

        {entries.map((entry, index) => (
          <div className="entry-card" key={index}>
            {/* ROW 1 */}
            <div className="investigator-row row1">
              <input
                type="text"
                value={entry.role}
                onChange={(e) => handleChange(index, "role", e.target.value)}
                placeholder="Principal Investigator / Co-PI"
              />
              <select
                value={entry.category}
                onChange={(e) =>
                  handleChange(index, "category", e.target.value)
                }
              >
                <option value="">Category</option>
                <option value="KSRCT Faculty">KSRCT Faculty</option>
                <option value="KSRCT Students">KSRCT Students</option>
                <option value="External Faculty">External Faculty</option>
                <option value="Industry">Industry</option>
              </select>
              <input
                type="text"
                value={entry.name}
                onChange={(e) => handleChange(index, "name", e.target.value)}
                placeholder="Name"
              />
              <input
                type="text"
                value={entry.designation}
                onChange={(e) =>
                  handleChange(index, "designation", e.target.value)
                }
                placeholder="Designation"
              />
            </div>

            {/* ROW 2 */}
            <div className="investigator-row row2">
              <input
                type="text"
                value={entry.department}
                onChange={(e) =>
                  handleChange(index, "department", e.target.value)
                }
                placeholder="Department"
              />
              <input
                type="text"
                value={entry.organization}
                onChange={(e) =>
                  handleChange(index, "organization", e.target.value)
                }
                placeholder="Organization"
              />
              <input
                type="text"
                value={entry.country}
                onChange={(e) => handleChange(index, "country", e.target.value)}
                placeholder="Country"
              />
              <div className="action-icons">
                <button
                  onClick={() => handleAddRow(index)}
                  className="icon-btn add-btn"
                  title="Add"
                >
                  <Plus size={16} />
                </button>
                <button
                  onClick={() => handleDeleteRow(index)}
                  className="icon-btn delete-btn"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
