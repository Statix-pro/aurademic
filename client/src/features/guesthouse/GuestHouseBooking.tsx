import React from 'react';
import Navbar from '../../shared/components/layout/navbar/navbar';
import UnderConstruction from '../../shared/components/ui/UnderConstruction';

const GuestHouseBooking: React.FC = () => {
    return (
        <>
            <Navbar />
            <div className="container mt-4">
                <h2>Guest House Booking</h2>
                <UnderConstruction pageName="Guest House Booking" />
            </div>
        </>
    );
};

export default GuestHouseBooking;
