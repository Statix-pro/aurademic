import React, { useState } from 'react';
import { Container, Row, Col, Nav, Tab } from 'react-bootstrap';
import CustomButton from '../components/common/CustomButton';
import CustomInput from '../components/common/CustomInput';
import CustomCheckbox from '../components/common/CustomCheckbox';
import CustomRadio from '../components/common/CustomRadio';
import CustomCard from '../components/common/CustomCard';
import CustomModal from '../components/common/CustomModal';
import CustomDropdown from '../components/common/CustomDropdown';
import CustomSearchInput from '../components/common/CustomSearchInput';
import CustomTagInput from '../components/common/CustomTagInput';
import CustomTable from '../components/common/CustomTable';
import CustomToggle from '../components/common/CustomToggle';
import CustomFileUploader from '../components/common/CustomFileUploader';
import DocBlock from './DocBlock';

const ComponentTestPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('buttons');

  // State for examples
  const [searchVal, setSearchVal] = useState('');
  const [tags, setTags] = useState(['React', 'Bootstrap']);
  const [file, setFile] = useState(null);
  const [toggle, setToggle] = useState(false);
  const [radioVal, setRadioVal] = useState('1');
  const [checkVal, setCheckVal] = useState(false);
  const [selectVal, setSelectVal] = useState(null);

  const searchResults = [
    { id: 1, label: 'Result 1' },
    { id: 2, label: 'Result 2' },
    { id: 3, label: 'Result 3' },
  ].filter(i => i.label.toLowerCase().includes(searchVal.toLowerCase()));

  const tableData = [
    { id: 1, name: 'John Doe', role: 'Admin', status: 'Active' },
    { id: 2, name: 'Jane Smith', role: 'User', status: 'Inactive' },
    { id: 3, name: 'Bob Johnson', role: 'Editor', status: 'Active' },
  ];

  const tableColumns = [
    { key: 'id', label: 'ID' },
    { key: 'name', label: 'Name' },
    { key: 'role', label: 'Role' },
    {
      key: 'status',
      label: 'Status',
      render: (row) => (
        <span className={`badge bg-${row.status === 'Active' ? 'success' : 'secondary'}`}>
          {row.status}
        </span>
      )
    },
  ];

  const sections = [
    { id: 'buttons', label: 'Buttons' },
    { id: 'inputs', label: 'Inputs & Toggles' },
    { id: 'selects', label: 'Selects & Tags' },
    { id: 'data', label: 'Data Display' },
    { id: 'feedback', label: 'Feedback & Upload' },
  ];

  return (
    <Container className="py-5">
      <div className="mb-5 text-center">
        <h1 className="display-4 text-primary fw-bold">UI Component Library</h1>
        <p className="lead text-muted">A collection of reusable, standardized components for the application.</p>
      </div>

      <Tab.Container activeKey={activeTab} onSelect={(k) => setActiveTab(k)}>
        <Row>
          <Col md={3} className="mb-4">
            <CustomCard className="sticky-top" style={{ top: '20px' }}>
              <Nav variant="pills" className="flex-column gap-2">
                {sections.map(section => (
                  <Nav.Item key={section.id}>
                    <Nav.Link eventKey={section.id} style={{ cursor: 'pointer' }}>
                      {section.label}
                    </Nav.Link>
                  </Nav.Item>
                ))}
              </Nav>
            </CustomCard>
          </Col>

          <Col md={9}>
            <Tab.Content>
              {/* BUTTONS SECTION */}
              <Tab.Pane eventKey="buttons">
                <h2 className="mb-4 border-bottom pb-2">Buttons</h2>
                <DocBlock
                  title="CustomButton"
                  description="Standard button component supporting variants, loading state, and icons."
                  component={
                    <div className="d-flex gap-2 flex-wrap">
                      <CustomButton variant="primary">Primary</CustomButton>
                      <CustomButton variant="secondary">Secondary</CustomButton>
                      <CustomButton variant="outline-primary">Outline</CustomButton>
                      <CustomButton variant="danger">Danger</CustomButton>
                      <CustomButton loading>Loading</CustomButton>
                      <CustomButton disabled>Disabled</CustomButton>
                    </div>
                  }
                  code={`<CustomButton variant="primary">Primary</CustomButton>
<CustomButton loading>Loading</CustomButton>`}
                  propTypes={[
                    { name: 'variant', type: 'string', default: 'primary', description: 'Bootstrap variant name' },
                    { name: 'loading', type: 'bool', default: 'false', description: 'Shows spinner if true' },
                    { name: 'disabled', type: 'bool', default: 'false', description: 'Disables the button' },
                    { name: 'onClick', type: 'func', default: '-', description: 'Click handler' },
                  ]}
                />
              </Tab.Pane>

              {/* INPUTS SECTION */}
              <Tab.Pane eventKey="inputs">
                <h2 className="mb-4 border-bottom pb-2">Inputs & Toggles</h2>
                <DocBlock
                  title="CustomInput"
                  description="Wrapper for form inputs with label and error handling."
                  component={
                    <div className="w-100" style={{ maxWidth: '400px' }}>
                      <CustomInput label="Username" name="username" placeholder="Enter username" />
                      <CustomInput label="Email" name="email" type="email" error="Invalid email address" />
                      <CustomInput label="Bio" name="bio" as="textarea" rows={3} />
                    </div>
                  }
                  code={`<CustomInput label="Username" name="username" />
<CustomInput label="Email" error="Error message" />`}
                />

                <DocBlock
                  title="CustomCheckbox & CustomRadio"
                  description="Standardized checkboxes and radios."
                  component={
                    <div className="d-flex flex-column gap-2">
                      <CustomCheckbox
                        label="Subscribe to newsletter"
                        name="check1"
                        checked={checkVal}
                        onChange={(e) => setCheckVal(e.target.checked)}
                      />
                      <hr />
                      <CustomRadio
                        label="Option 1"
                        name="radio1"
                        value="1"
                        checked={radioVal === '1'}
                        onChange={() => setRadioVal('1')}
                      />
                      <CustomRadio
                        label="Option 2"
                        name="radio1"
                        value="2"
                        checked={radioVal === '2'}
                        onChange={() => setRadioVal('2')}
                      />
                    </div>
                  }
                  code={`<CustomCheckbox label="Label" checked={val} onChange={fn} />
<CustomRadio label="Option 1" value="1" checked={val==='1'} onChange={fn} />`}
                />

                <DocBlock
                  title="CustomToggle"
                  description="Switch toggle component."
                  component={
                     <CustomToggle
                       label="Enable Notifications"
                       name="toggle1"
                       checked={toggle}
                       onChange={(e) => setToggle(e.target.checked)}
                     />
                  }
                  code={`<CustomToggle label="Enable" checked={val} onChange={fn} />`}
                />
              </Tab.Pane>

              {/* SELECTS & TAGS SECTION */}
              <Tab.Pane eventKey="selects">
                <h2 className="mb-4 border-bottom pb-2">Selects & Tags</h2>
                <DocBlock
                  title="CustomDropdown"
                  description="Wrapper for react-select."
                  component={
                    <div style={{ maxWidth: '400px' }}>
                      <CustomDropdown
                        label="Select Role"
                        options={[{value: 'admin', label: 'Admin'}, {value: 'user', label: 'User'}]}
                        value={selectVal}
                        onChange={setSelectVal}
                      />
                    </div>
                  }
                  code={`<CustomDropdown
  label="Select Role"
  options={options}
  value={val}
  onChange={setVal}
/>`}
                />

                <DocBlock
                  title="CustomSearchInput"
                  description="Input with autocomplete suggestions."
                  component={
                    <div style={{ maxWidth: '400px' }}>
                      <CustomSearchInput
                        label="Search Items"
                        name="search"
                        value={searchVal}
                        onChange={setSearchVal}
                        results={searchResults}
                        onSelect={(item) => { setSearchVal(item.label); alert(`Selected: ${item.label}`); }}
                        placeholder="Type 'Result'..."
                      />
                    </div>
                  }
                  code={`<CustomSearchInput
  value={query}
  onChange={setQuery}
  results={filteredResults}
  onSelect={handleSelect}
/>`}
                />

                <DocBlock
                  title="CustomTagInput"
                  description="Multi-value input for tags/keywords."
                  component={
                    <div style={{ maxWidth: '400px' }}>
                       <CustomTagInput
                         label="Skills"
                         name="skills"
                         value={tags}
                         onChange={setTags}
                         suggestions={['JavaScript', 'React', 'Node.js', 'Python']}
                         placeholder="Type and press Enter"
                       />
                    </div>
                  }
                  code={`<CustomTagInput
  value={tags} // ['tag1', 'tag2']
  onChange={setTags}
  suggestions={['suggest1', 'suggest2']}
/>`}
                />
              </Tab.Pane>

              {/* DATA DISPLAY SECTION */}
              <Tab.Pane eventKey="data">
                <h2 className="mb-4 border-bottom pb-2">Data Display</h2>
                <DocBlock
                  title="CustomTable"
                  description="Standardized table with loading state and custom rendering."
                  component={
                    <CustomTable
                      columns={tableColumns}
                      data={tableData}
                      actions={(row) => <CustomButton size="sm" variant="outline-primary" onClick={() => alert(`Edit ${row.name}`)}>Edit</CustomButton>}
                    />
                  }
                  code={`<CustomTable
  columns={[
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> }
  ]}
  data={data}
  actions={(row) => <Button>Edit</Button>}
/>`}
                />

                <DocBlock
                  title="CustomCard"
                  description="Card container with optional dashed border."
                  component={
                    <div className="d-flex gap-3">
                      <CustomCard title="Regular Card" className="flex-grow-1">
                        Content goes here
                      </CustomCard>
                      <CustomCard title="Dashed Card" dashed className="flex-grow-1">
                        Dashed content
                      </CustomCard>
                    </div>
                  }
                  code={`<CustomCard title="Title">Content</CustomCard>`}
                />
              </Tab.Pane>

              {/* FEEDBACK SECTION */}
              <Tab.Pane eventKey="feedback">
                <h2 className="mb-4 border-bottom pb-2">Feedback & Upload</h2>
                <DocBlock
                  title="CustomModal"
                  description="Modal dialog."
                  component={
                    <>
                      <CustomButton onClick={() => setShowModal(true)}>Open Modal</CustomButton>
                      <CustomModal
                        show={showModal}
                        onHide={() => setShowModal(false)}
                        title="Confirmation"
                        footer={
                          <>
                            <CustomButton variant="secondary" onClick={() => setShowModal(false)}>Cancel</CustomButton>
                            <CustomButton variant="primary" onClick={() => setShowModal(false)}>Confirm</CustomButton>
                          </>
                        }
                      >
                        <p>Are you sure you want to proceed?</p>
                      </CustomModal>
                    </>
                  }
                  code={`<CustomModal show={show} onHide={handleClose} title="Title">
  <p>Content</p>
</CustomModal>`}
                />

                <DocBlock
                  title="CustomFileUploader"
                  description="Standardized file upload component."
                  component={
                    <div style={{ maxWidth: '500px' }}>
                      <CustomFileUploader
                        label="Upload Document"
                        name="doc"
                        onChange={(f) => setFile(f)}
                        onDelete={() => setFile(null)}
                        fileName={file ? file.name : null}
                      />
                    </div>
                  }
                  code={`<CustomFileUploader
  label="Upload"
  onChange={handleFile}
  fileName={currentFileName}
/>`}
                />
              </Tab.Pane>
            </Tab.Content>
          </Col>
        </Row>
      </Tab.Container>
    </Container>
  );
};

export default ComponentTestPage;
