import React from 'react';
import 'bootstrap/dist/css/bootstrap.css';
import './home.css';

import Bannerimage from '../../shared/assets/images/dashboard-images/banner-img.png';
import AboutImg from '../../shared/assets/images/dashboard-images/about-ksrct.png';

const Home: React.FC = () => {
  return (
    <div className="home">


      <div
        className="banner-container"
        style={{ overflow: 'hidden', height: '300px' }}
      >
        <img src={Bannerimage} alt="Banner" />
        <div className="banner-text">
          <h1>Collaborative Research, Impactful Results. KSRCT</h1>{' '}
          <p>Advancing knowledge, inspiring solutions. </p>
        </div>
      </div>

      <div className="container">
        <div className="row" style={{ marginTop: '30px' }}>
          <div className="col-md-5 text-center">
            <img
              src={AboutImg}
              alt="about ksrct"
              style={{ borderRadius: '20px' }}
            />
          </div>
          <div
            className="col-md-7"
            style={{ paddingTop: '50px', paddingLeft: '50px' }}
          >
            <h5>Research #KSRCT</h5>
            <p>
              K.S. Rangasamy College of Technology (KSRCT) is dedicated to
              driving societal advancement through cutting-edge research, the
              development of transformative technologies, and a strong emphasis
              on interdisciplinary and multidisciplinary collaboration. We
              strive to be a leader in innovative research, focused on making a
              tangible impact on our local community and the world.
            </p>

            <button className="btn" id="dashboard-aboutksrct-button">
              Know more about KSRCT
            </button>
          </div>
        </div>
      </div>

      <div
        className="container"
        style={{
          marginTop: '40px',
          backgroundColor: '#062652',
          borderRadius: '50px',
        }}
      >
        <div className="row text-center text-light" style={{ paddingTop: '20px' }}>
          <div className="col-md-3">
            <h4 id="count-aboutus">36+ crores</h4>
            <p>Total Grant-in-aid</p>
          </div>
          <div className="col-md-3">
            <h4 id="count-aboutus">450+</h4>
            <p>Projects</p>
          </div>
          <div className="col-md-3">
            <h4 id="count-aboutus">60+</h4>
            <p>Student Projects</p>
          </div>
          <div className="col-md-3">
            <h4 id="count-aboutus">6.5 crores</h4>
            <p>Highest Grant-in-aid</p>
          </div>
        </div>
      </div>
      <br />
    </div>
  );
};

export default Home;
