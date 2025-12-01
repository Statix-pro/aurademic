import React from 'react';
import 'bootstrap/dist/css/bootstrap.css';
import './home.css';
import Navbar from '../components/navbar/navbar';
import Bannerimage from '../components/images/dashboard-images/banner-img.png';
import AboutImg from '../components/images/dashboard-images/about-ksrct.png';

function home() {
  return (
    <div class="home">
      <Navbar />

      {/* <!-- Banner starts here --> */}
      <div
        class="banner-container"
        style={{ overflow: 'hidden', height: '300px' }}
      >
        <img src={Bannerimage} alt="Banner" />
        <div class="banner-text">
          <h1>Collaborative Research, Impactful Results. KSRCT</h1>{' '}
          <p>Advancing knowledge, inspiring solutions. </p>
        </div>
      </div>
      {/* <!-- Banner ends here --> */}

      {/* <!-- About research #KSRCT starts here--> */}
      <div class="container">
        <div class="row" style={{ marginTop: '30px' }}>
          <div class="col-md-5 text-center">
            <img
              src={AboutImg}
              alt="about ksrct"
              style={{ borderRadius: '20px' }}
            />
          </div>
          <div
            class="col-md-7"
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

            <button class="btn" id="dashboard-aboutksrct-button">
              Know more about KSRCT
            </button>
          </div>
        </div>
      </div>
      {/* <!-- About research #KSRCT ends here --> */}

      {/* <!-- Count starts here --> */}
      <div
        class="container"
        style={{
          marginTop: '40px',
          backgroundColor: '#062652',
          borderRadius: '50px',
        }}
      >
        <div class="row text-center text-light" style={{ paddingTop: '20px' }}>
          <div class="col-md-3">
            <h4 id="count-aboutus">36+ crores</h4>
            <p>Total Grant-in-aid</p>
          </div>
          <div class="col-md-3">
            <h4 id="count-aboutus">450+</h4>
            <p>Projects</p>
          </div>
          <div class="col-md-3">
            <h4 id="count-aboutus">60+</h4>
            <p>Student Projects</p>
          </div>
          <div class="col-md-3">
            <h4 id="count-aboutus">6.5 crores</h4>
            <p>Highest Grant-in-aid</p>
          </div>
        </div>
      </div>
      <br />
      {/* <!-- Count ends here --> */}
    </div>
  );
}

export default home;
