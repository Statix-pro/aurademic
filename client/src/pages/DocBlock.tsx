import React, { useState } from 'react';
import { Card, Button, Collapse } from 'react-bootstrap';

interface PropTypeInfo {
  name: string;
  type: string;
  default?: string;
  description: string;
}

interface DocBlockProps {
  title: string;
  description?: string;
  component: React.ReactNode;
  code: string;
  props?: PropTypeInfo[];
}

const DocBlock: React.FC<DocBlockProps> = ({ 
  title, 
  description, 
  component, 
  code, 
  props 
}) => {
  const [open, setOpen] = useState<boolean>(false);

  return (
    <Card className="mb-4 shadow-sm">
      <Card.Header className="d-flex justify-content-between align-items-center bg-white">
        <h5 className="mb-0 text-primary">{title}</h5>
        <Button
          variant="outline-secondary"
          size="sm"
          onClick={() => setOpen(!open)}
          aria-controls="example-code"
          aria-expanded={open}
        >
          {open ? 'Hide Code' : 'Show Code'}
        </Button>
      </Card.Header>
      <Card.Body>
        {description && <Card.Text className="text-muted mb-4">{description}</Card.Text>}

        <div className="p-4 border rounded bg-light mb-3 d-flex justify-content-center align-items-center">
          {component}
        </div>

        <Collapse in={open}>
          <div id="example-code">
            <div className="position-relative">
              <pre className="bg-dark text-light p-3 rounded mb-3" style={{ fontSize: '0.85rem', overflowX: 'auto' }}>
                <code>{code}</code>
              </pre>
            </div>
          </div>
        </Collapse>

        {props && (
           <div className="mt-3">
             <h6 className="text-secondary border-bottom pb-2">Props</h6>
             <div className="table-responsive">
               <table className="table table-sm table-borderless text-small">
                 <thead>
                   <tr>
                     <th>Name</th>
                     <th>Type</th>
                     <th>Default</th>
                     <th>Description</th>
                   </tr>
                 </thead>
                 <tbody>
                   {props.map((prop, idx) => (
                     <tr key={idx}>
                       <td className="font-monospace text-primary">{prop.name}</td>
                       <td className="font-monospace text-muted">{prop.type}</td>
                       <td className="font-monospace">{prop.default || '-'}</td>
                       <td>{prop.description}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>
           </div>
        )}
      </Card.Body>
    </Card>
  );
};

export default DocBlock;