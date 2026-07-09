import React from 'react';
import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Search from './components/Search';
import FeaturedPets from './components/FeaturedPets';

function App() {
  return (
    <>
      <Navbar />
      <Hero />
      <Search />
      <FeaturedPets />
    </>
  );
}

export default App;
