import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import OnlineCall from './pages/OnlineCall';
import Web_Peer from './pages/Web_Peer';


export default function App(){

  return(
    <BrowserRouter>
      <Routes>        
        <Route path='/' element={<Home/>} />
        <Route path='/call' element={<OnlineCall/>} />
        <Route path='/webpeer' element={<Web_Peer/>} />
      </Routes>
    </BrowserRouter>    
  )
}