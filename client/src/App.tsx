import React from 'react';
import logo from './logo.svg';
import './App.css';

import { AppRouter } from './Router';
import { BrowserRouter as Router } from "react-router-dom";
import { Header } from './components/Header';
import { Footer } from './components/Footer';

const App = () => {
  return (
    <Router>
      <Header />
      <AppRouter />
      <Footer />
    </Router>
  );
}

export default App;
