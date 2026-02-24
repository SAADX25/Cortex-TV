import React from 'react';

const Home = () => {
  return (
    <div>
      <h2 className="text-3xl font-semibold mb-6">Welcome back!</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((item) => (
          <div key={item} className="bg-gray-800 p-4 rounded-lg shadow-lg hover:scale-105 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500" tabIndex={0}>
            <div className="h-40 bg-gray-700 rounded mb-4"></div>
            <div className="h-6 bg-gray-700 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-700 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Home;
