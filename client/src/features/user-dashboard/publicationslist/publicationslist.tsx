import React from 'react';
import './publicationslist.css';

const PublicationsList: React.FC = () => {
  return (
    <div className="publications-list">
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <h5 className="tab-title">Conference</h5>
        <div>
          <button className="btn btn-primary">Add+</button>
        </div>
      </div>
      <div className="publication-item p-3 mb-4 bg-light rounded">
        <div className="row">
          <div className="col-md-10">
            <h5 style={{ lineHeight: '32px' }}>
              Evaluation of Wear Properties and Water Absorption Behavior of
              Banana and Sisal Fiber Reinforced Epoxy Hybrid Composites
            </h5>
            <p>Jeyaprakasam S.;Kathirselvam M.;Velmurugan C.;Venkatachalam R.</p>
            <span>
              <p style={{ fontSize: '13px' }}>
                <span style={{ backgroundColor: '#AFDBF7', padding: '5px' }}>Jounal Article</span>
                <span>Journal of Natural Fibers, Year 2022</span>
              </p>
            </span>
          </div>
          <div className="col-md-2">
            <div className="actions" style={{ marginTop: '20px' }}>
              <button className="btn custom-btn" title="View"><i className="fas fa-eye"></i></button>
              <button className="btn custom-btn" title="Share-link"><i className="fas fa-link"></i></button>
              <button className="btn custom-btn" title="Edit"><i className="fas fa-edit"></i></button>
              <button className="btn custom-btn" title="Delete"><i className="fas fa-trash"></i></button>
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '13px' }}>Last edited : 2 days ago</p>
            </div>
          </div>
        </div>
      </div>
      <div className="publication-item p-3 mb-4 bg-light rounded">
        <div className="row">
          <div className="col-10">
            <h5 style={{ lineHeight: '32px' }}>
              Experimental study of process parameters on machining performance
              in electro-discharge machining
            </h5>
            <p>Jeyaprakasam S.;Kathirselvam M.;Velmurugan C.;Venkatachalam R.</p>
            <span>
              <p style={{ fontSize: '13px' }}>
                <span style={{ backgroundColor: '#AFDBF7', padding: '5px' }}>Jounal Article</span>
                <span>Journal of Natural Fibers, Year 2022</span>
              </p>
            </span>
          </div>
          <div className="col-md-2">
            <div className="actions" style={{ marginTop: '20px' }}>
              <button className="btn custom-btn" title="View"><i className="fas fa-eye"></i></button>
              <button className="btn custom-btn" title="Share-link"><i className="fas fa-link"></i></button>
              <button className="btn custom-btn" title="Edit"><i className="fas fa-edit"></i></button>
              <button className="btn custom-btn" title="Delete"><i className="fas fa-trash"></i></button>
            </div>
            <div>
              <p className="text-muted" style={{ fontSize: '13px' }}>Last edited : 2 days ago</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PublicationsList;
