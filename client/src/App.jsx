import { BrowserRouter, Routes, Route } from 'react-router-dom';
import PrivateRoute from './components/PrivateRoute';
import Chat from './pages/Chat';
import Home from './pages/Home';
import Login from './pages/Login';
import OnlineCall from './pages/OnlineCall';
import Web_Peer from './pages/Web_Peer';


export default function App(){

  return(
    <BrowserRouter>
      <Routes>
        <Route path='/login' element={<Login />} />
        <Route path='/' element={<Home/>} />
        <Route path='/call' element={<OnlineCall/>} />
        <Route path='/webpeer' element={<Web_Peer/>} />
        <Route element={<PrivateRoute />}>
          <Route path='/chat' element={<Chat/>} />
        </Route>        
      </Routes>
    </BrowserRouter>    
  )
}