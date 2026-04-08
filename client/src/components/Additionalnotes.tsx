import React from 'react';

const AdditionalNotes = () => {
  return (<div className="p-4 bg-gray-900 rounded-lg border border-gray-700">
      <h3 className="text-white text-lg font-semibold mb-1">Additional Notes</h3>
      <p className="text-gray-400 text-sm mb-4">If you have any specific instructions, type them here.</p>
      
      <textarea
        className="w-full h-32 p-3 bg-gray-800 text-gray-100 rounded-md border border-gray-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder-gray-500"
        placeholder="Type any additional instructions here..."
      />
    </div>
  );
};
export default AdditionalNotes;