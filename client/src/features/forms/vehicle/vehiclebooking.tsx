// VehicleBooking.tsx
import React, { useState, ChangeEvent, FormEvent } from 'react';
import Select, { MultiValue, StylesConfig } from 'react-select';
import 'bootstrap/dist/css/bootstrap.min.css';
import './vehiclebooking.css';
import { FaPlus, FaTrash } from 'react-icons/fa';

type VehicleTypeOption = {
  value: string;
  label: string;
};

type Journey = {
  id: number;
  date: string;
  time: string;
  placeFrom: string;
  persons: string;
  returnDate: string;
  returnTime: string;
  returnPlace: string;
  remarks?: string;
};

const selectStyles: StylesConfig<VehicleTypeOption, true> = {
  control: (provided, state) => ({
    ...provided,
    minHeight: '38px',
    borderColor: '#ced4da',
    borderRadius: '0.25rem',
    boxShadow: state.isFocused ? '0 0 0 0.15rem rgba(13,110,253,.25)' : 'none',
    backgroundColor: '#fff',
    fontSize: '0.95rem',
    transition: 'border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out',
    paddingLeft: '8px',
    display: 'flex',
    alignItems: 'center',
  }),
  valueContainer: (provided) => ({
    ...provided,
    padding: '0 6px',
    minHeight: '38px',
  }),
  input: (provided) => ({
    ...provided,
    margin: 0,
    padding: 0,
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 10,
  }),
};

const VEHICLE_TYPES: VehicleTypeOption[] = [
  { value: 'Bus', label: 'Bus' },
  { value: 'Car', label: 'Car' },
  { value: 'Van', label: 'Van' },
  { value: 'Auto', label: 'Auto' },
  { value: 'Eicher', label: 'Eicher' },
  { value: 'Lorry', label: 'Lorry' },
  { value: 'Other', label: 'Other' },
];

const VehicleBooking: React.FC = () => {
  const [collegeName, setCollegeName] = useState<string>('K.S.Rangasamy College of Technology');
  const [bookingDate, setBookingDate] = useState<string>('');
  const [department, setDepartment] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [vehicleType, setVehicleType] = useState<VehicleTypeOption[]>([]);
  const [otherVehicleType, setOtherVehicleType] = useState<string>('');
  const [journeys, setJourneys] = useState<Journey[]>([
    {
      id: 1,
      date: '',
      time: '',
      placeFrom: '',
      persons: '',
      returnDate: '',
      returnTime: '',
      returnPlace: '',
    },
  ]);
  const [accompanyingStaffName, setAccompanyingStaffName] = useState<string>('');
  const [accompanyingMobile, setAccompanyingMobile] = useState<string>('');
  const [attentionTo, setAttentionTo] = useState<string>('');
  const [officeRemarks, setOfficeRemarks] = useState<string>('');
  const [driverName, setDriverName] = useState<string>('');
  const [driverMobile, setDriverMobile] = useState<string>('');
  const [vehicleNo, setVehicleNo] = useState<string>('');
  const [openingKm, setOpeningKm] = useState<string>('');
  const [closingKm, setClosingKm] = useState<string>('');

  const totalKm: number | '' = (() => {
    const o = parseFloat(openingKm || '0');
    const c = parseFloat(closingKm || '0');
    return !isNaN(o) && !isNaN(c) ? c - o : '';
  })();

  const [inchargeSignature, setInchargeSignature] = useState<string>('');
  const [hodSignature, setHodSignature] = useState<string>('');
  const [principalSignature, setPrincipalSignature] = useState<string>('');
  const [directorComments, setDirectorComments] = useState<string>('');
  const [directorStatus, setDirectorStatus] = useState<boolean | null>(null);
  const [managerSignature, setManagerSignature] = useState<string>('');

  const addJourney = () => {
    setJourneys((prev) => [
      ...prev,
      {
        id: Date.now(),
        date: '',
        time: '',
        placeFrom: '',
        persons: '',
        returnDate: '',
        returnTime: '',
        returnPlace: '',
      },
    ]);
  };

  const removeJourney = (id: number) => {
    setJourneys((prev) => prev.filter((j) => j.id !== id));
  };

  const updateJourney = (id: number, field: keyof Journey, value: string) => {
    setJourneys((prev) =>
      prev.map((j) => (j.id === id ? { ...j, [field]: value } : j)),
    );
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const payload = {
      collegeName,
      bookingDate,
      department,
      purpose,
      vehicleType,
      otherVehicleType,
      journeys,
      accompanyingStaffName,
      accompanyingMobile,
      attentionTo,
      officeRemarks,
      driverName,
      driverMobile,
      vehicleNo,
      openingKm,
      closingKm,
      totalKm,
      inchargeSignature,
      hodSignature,
      principalSignature,
      directorComments,
      directorStatus,
      managerSignature,
    };
    console.log('Vehicle Booking payload:', payload);
    alert('Form submitted (check console for payload).');
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Keep your original layout/markup here, only types were added */}
      {/* Example snippet for journeys table, structure unchanged */}

      <table className="table table-bordered">
        <thead>
          <tr>
            <th>S.No.</th>
            <th colSpan={3}>BOARDING / FROM</th>
            <th colSpan={3}>DISMOUNTING / TO</th>
            <th>REMARKS</th>
            <th>Action</th>
          </tr>
          <tr>
            <th />
            <th>Date</th>
            <th>Time</th>
            <th>Place</th>
            <th>No. of Persons</th>
            <th>Date</th>
            <th>Time</th>
            <th>Place</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {journeys.map((j, index) => (
            <tr key={j.id}>
              <td>{index + 1}</td>
              <td>
                <input
                  type="date"
                  className="form-control"
                  value={j.date}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateJourney(j.id, 'date', e.target.value)
                  }
                />
              </td>
              <td>
                <input
                  type="time"
                  className="form-control"
                  value={j.time}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateJourney(j.id, 'time', e.target.value)
                  }
                />
              </td>
              <td>
                <input
                  type="text"
                  className="form-control"
                  value={j.placeFrom}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateJourney(j.id, 'placeFrom', e.target.value)
                  }
                />
              </td>
              <td>
                <input
                  type="number"
                  className="form-control"
                  value={j.persons}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateJourney(j.id, 'persons', e.target.value)
                  }
                />
              </td>
              <td>
                <input
                  type="date"
                  className="form-control"
                  value={j.returnDate}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateJourney(j.id, 'returnDate', e.target.value)
                  }
                />
              </td>
              <td>
                <input
                  type="time"
                  className="form-control"
                  value={j.returnTime}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateJourney(j.id, 'returnTime', e.target.value)
                  }
                />
              </td>
              <td>
                <input
                  type="text"
                  className="form-control"
                  value={j.returnPlace}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    updateJourney(j.id, 'returnPlace', e.target.value)
                  }
                />
              </td>
              <td>
                <div className="d-flex">
                  <button
                    type="button"
                    className="btn btn-danger btn-sm me-2"
                    onClick={() => removeJourney(j.id)}
                  >
                    <FaTrash />
                  </button>
                  {index === journeys.length - 1 && (
                    <button
                      type="button"
                      className="btn btn-success btn-sm"
                      onClick={addJourney}
                    >
                      <FaPlus />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Rest of your form JSX goes here, unchanged in structure */}
    </form>
  );
};

export default VehicleBooking;
