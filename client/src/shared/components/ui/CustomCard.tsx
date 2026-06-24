import React from 'react';
import { Card, CardProps } from 'react-bootstrap';
import './common.css';

interface CustomCardProps extends CardProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
  dashed?: boolean;
}

const CustomCard: React.FC<CustomCardProps> = ({
  children,
  title,
  className = '',
  dashed = false,
  ...props
}) => {
  return (
    <Card className={`custom-card ${dashed ? 'dashed' : ''} ${className}`} {...props}>
      <Card.Body>
        {title && <Card.Title className="custom-card-title custom-card-header">{title}</Card.Title>}
        {children}
      </Card.Body>
    </Card>
  );
};

export default CustomCard;
