import React from 'react';
import PropTypes from 'prop-types';
import { Card } from 'react-bootstrap';
import './common.css';

const CustomCard = ({ children, title, className = '', dashed = false, ...props }) => {
  return (
    <Card className={`custom-card ${dashed ? 'dashed' : ''} ${className}`} {...props}>
      <Card.Body>
        {title && <Card.Title className="custom-card-title custom-card-header">{title}</Card.Title>}
        {children}
      </Card.Body>
    </Card>
  );
};

CustomCard.propTypes = {
  children: PropTypes.node.isRequired,
  title: PropTypes.string,
  className: PropTypes.string,
  dashed: PropTypes.bool,
};

export default CustomCard;
