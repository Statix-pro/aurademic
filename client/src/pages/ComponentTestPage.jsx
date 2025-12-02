import React, { useState } from 'react';
import CustomCard from '../components/common/CustomCard';
import CustomButton from '../components/common/CustomButton';
import CustomInput from '../components/common/CustomInput';
import CustomDropdown from '../components/common/CustomDropdown';
import CustomCheckbox from '../components/common/CustomCheckbox';
import CustomRadio from '../components/common/CustomRadio';
import CustomModal from '../components/common/CustomModal';

const ComponentTestPage = () => {
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: null,
    agreement: false,
    preference: 'email',
  });

  const roleOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'user', label: 'User' },
    { value: 'guest', label: 'Guest' },
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSelectChange = (selectedOption) => {
    setFormData(prev => ({ ...prev, role: selectedOption }));
  };

  return (
    <div className="container py-5">
      <h1 className="mb-4">Component Style Guide</h1>

      <div className="row">
        <div className="col-md-6">
          <CustomCard title="Typography & Buttons">
            <p>This is a standard paragraph inside a CustomCard.</p>
            <div className="d-flex gap-2 flex-wrap mb-3">
              <CustomButton>Primary Button</CustomButton>
              <CustomButton variant="secondary">Secondary Button</CustomButton>
              <CustomButton variant="outline">Outline Button</CustomButton>
              <CustomButton variant="danger">Danger Button</CustomButton>
              <CustomButton disabled>Disabled</CustomButton>
            </div>
          </CustomCard>

          <CustomCard title="Modals" dashed>
            <p>Click below to open a custom modal.</p>
            <CustomButton onClick={() => setShowModal(true)}>Open Modal</CustomButton>
          </CustomCard>
        </div>

        <div className="col-md-6">
          <CustomCard title="Form Elements">
            <CustomInput
              label="Full Name"
              name="name"
              placeholder="Enter your name"
              value={formData.name}
              onChange={handleInputChange}
            />

            <CustomInput
              label="Email Address"
              name="email"
              type="email"
              placeholder="name@example.com"
              value={formData.email}
              onChange={handleInputChange}
              error={formData.email && !formData.email.includes('@') ? 'Invalid email' : null}
            />

            <CustomDropdown
              label="Select Role"
              name="role"
              options={roleOptions}
              value={formData.role}
              onChange={handleSelectChange}
            />

            <div className="mb-3">
              <label className="custom-label">Communication Preference</label>
              <CustomRadio
                label="Email"
                name="preference"
                value="email"
                checked={formData.preference === 'email'}
                onChange={handleInputChange}
              />
              <CustomRadio
                label="SMS"
                name="preference"
                value="sms"
                checked={formData.preference === 'sms'}
                onChange={handleInputChange}
              />
            </div>

            <CustomCheckbox
              label="I agree to the terms and conditions"
              name="agreement"
              checked={formData.agreement}
              onChange={handleInputChange}
            />

            <div className="mt-4">
              <CustomButton className="w-100">Submit Form</CustomButton>
            </div>
          </CustomCard>
        </div>
      </div>

      <CustomModal
        show={showModal}
        onHide={() => setShowModal(false)}
        title="Example Modal"
        footer={
          <>
            <CustomButton variant="secondary" onClick={() => setShowModal(false)}>Close</CustomButton>
            <CustomButton onClick={() => setShowModal(false)}>Save Changes</CustomButton>
          </>
        }
      >
        <p>This is the content of the custom modal. It uses the same styling variables as the rest of the application.</p>
      </CustomModal>
    </div>
  );
};

export default ComponentTestPage;
