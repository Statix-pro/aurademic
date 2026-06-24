import React from 'react';
import './UnderConstruction.css';


interface UnderConstructionProps {
    pageName?: string;
}

const UnderConstruction: React.FC<UnderConstructionProps> = ({ pageName = "This page" }) => {
    return (
        <>

            <div className="under-construction-container">
                <div className="under-construction-content">
                    <div className="construction-icon">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="80"
                            height="80"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M2 20h20" />
                            <path d="M5 20V8.5a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4V20" />
                            <path d="M12 4v4" />
                            <path d="M9 12h6" />
                            <path d="M9 16h6" />
                        </svg>
                    </div>
                    <h1 className="construction-title">Under Construction</h1>
                    <p className="construction-message">
                        <strong>{pageName}</strong> is currently being built.
                        <br />
                        Please check back soon!
                    </p>
                    <div className="construction-progress">
                        <div className="progress-bar">
                            <div className="progress-fill"></div>
                        </div>
                        <span className="progress-text">Coming Soon...</span>
                    </div>
                </div>
            </div>
        </>
    );
};

export default UnderConstruction;
