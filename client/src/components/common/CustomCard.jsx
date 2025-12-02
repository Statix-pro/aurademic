import React from 'react';
import PropTypes from 'prop-types';
import './common.css';

const CustomCard = ({ children, title, className = '', dashed = false, ...props }) => {
  return (
    <div
      className={`custom-card ${dashed ? 'dashed' : ''} ${className}`}
      {...props}
    >
      {title && (
        <div className="custom-card-header">
          <h3 className="custom-card-title">{title}</h3>
        </div>
      )}
      <div className="custom-card-body">
        {children}
      </div>
    </div>
  );
};

CustomCard.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
  className: PropTypes.string,
  dashed: PropTypes.bool,
};

export default CustomCard;
