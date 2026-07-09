import React from 'react';

const Navbar = () => {
  return (
    <nav className="navbar">
      <div className="logo">ADOPTION</div>
      <ul className="nav-links">
        <li><a href="/">Home</a></li>
        <li><a href="/signup">Sign up</a></li>
        <li><a href="/login">Login</a></li>
        <li><a href="/bookings">Bookings</a></li>
      </ul>
    </nav>
  );
};

export default Navbar;
