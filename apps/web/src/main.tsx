import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import '@analytic-pulse/ui/styles.css';
import './style.css';
import { init } from '@analytic-pulse/rum';

init({
  endpoint: 'https://analytic-pulse-api.onrender.com',
  token: 'ap_rum_2JOpr7gSzi0un4UwQ-nGW5rtZXIhgzvy',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
