import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import '@/index.css';
// Side-effect import: silently reloads the page when a fresh service
// worker takes over, so deploys reach installed users without them
// having to clear data or reinstall the PWA.
import '@/lib/pwaUpdate';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);