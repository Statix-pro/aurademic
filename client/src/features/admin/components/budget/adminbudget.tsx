import React from 'react';
import Navbar from '../../../../shared/components/layout/navbar/navbar';
import UnderConstruction from '../../../../shared/components/ui/UnderConstruction';

const AdminBudget: React.FC = () => {
    return (
        <>
            <Navbar />
            <div className="container mt-4">
                <h2>Admin Budget</h2>
                <UnderConstruction pageName="Admin Budget" />
            </div>
        </>
    );
};

export default AdminBudget;
