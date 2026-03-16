import Navbar from './navbar/navbar';
import { Outlet } from 'react-router-dom';

const MainLayout = () => (
    <>
        <Navbar />
        <Outlet />
    </>
);

export default MainLayout;
