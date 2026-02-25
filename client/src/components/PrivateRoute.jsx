import { useState } from 'react';
import { useSelector } from 'react-redux';
import { Outlet, Navigate, useNavigate } from 'react-router-dom';



export default function PrivateRoute() {

    const navigate = useNavigate();
    const username = localStorage.getItem('username')
    const [validSession, setValidSession]=useState(true);
    const BASE_API=import.meta.env.VITE_API_BASE_URL;
    console.log("Pricve arouter")
    // check if sessionToken is valid or not
    const checkSession = async ()=>{
        
        try {
            if(!username){
                navigate('/login');
                return
            }

        } catch (error) {
            alert(error)
        }

        
    }
    checkSession();  
    // useState(()=>{
    //     checkSession();
    // })

    return username ? <Outlet /> : <Navigate to='/login' />;
  }