import React from 'react';

const FeaturedPets = () => {
  return (
    <section className="pets-section">
      <h2>Featured Pets</h2>
      <div className="pets-container">
        {/* Add pet cards dynamically here */}
        <div className="pet-card">🐶 Bruno - Labrador</div>
        <div className="pet-card">🐱 Lily - Persian Cat</div>
      </div>
    </section>
  );
};

export default FeaturedPets;
