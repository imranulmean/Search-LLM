if (typeof global === 'undefined') {
  window.global = window;
}

import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import Peer from "simple-peer/simplepeer.min.js";

export default function OnlineCall() {
  const BASE_API = import.meta.env.VITE_API_BASE_URL;
 
  const socket = useRef();

  const [me, setMe] = useState("");
  const [stream, setStream] = useState(null);
  const [receivingCall, setReceivingCall] = useState(false);
  const [caller, setCaller] = useState("");
  const [callerSignal, setCallerSignal] = useState(null);
  const [callAccepted, setCallAccepted] = useState(false);
  const [idToCall, setIdToCall] = useState("");
  const [callEnded, setCallEnded] = useState(false);

  const myVideo = useRef();
  const userVideo = useRef();
  const connectionRef = useRef();

  useEffect(() => {
    // Connect to Socket
    socket.current = io.connect(BASE_API);

    // Get Camera
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then((currentStream) => {
        setStream(currentStream);
        if (myVideo.current) {
          myVideo.current.srcObject = currentStream;
        }
      })
      .catch((err) => alert("Camera blocked or not found: " + err));

    socket.current.on("me", (id) => setMe(id));

    socket.current.on("callUser", (data) => {
      setReceivingCall(true);
      setCaller(data.from);
      setCallerSignal(data.signal);
    });

    return () => socket.current.disconnect();
  }, [BASE_API]);

  const callUser = (id) => {
    alert("Button clicked. Stream status: " + (stream ? "Ready" : "Empty"));
    if (!stream) return alert("Please wait for camera to load");

    const peer = new Peer({
      initiator: true,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      },
    });

    peer.on("signal", (data) => {
      // This alert will now work!
      console.log("Generated Signal:", data);
      socket.current.emit("callUser", {
        userToCall: id,
        signalData: data,
        from: me,
      });
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = remoteStream;
      }
    });

    socket.current.on("callAccepted", (signal) => {
      setCallAccepted(true);
      peer.signal(signal);
    });

    connectionRef.current = peer;
  };

  const answerCall = () => {
    setCallAccepted(true);
    const peer = new Peer({
      initiator: false,
      trickle: false,
      stream: stream,
      config: {
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
        ],
      },
    });

    peer.on("signal", (data) => {
      socket.current.emit("answerCall", { signal: data, to: caller });
    });

    peer.on("stream", (remoteStream) => {
      if (userVideo.current) {
        userVideo.current.srcObject = remoteStream;
      }
    });

    peer.signal(callerSignal);
    connectionRef.current = peer;
  };

  return (
    <div style={{ padding: "20px", textAlign: "center", background: "#f0f0f0", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "center", gap: "20px", flexWrap: "wrap" }}>
        <div style={{ background: "#000", padding: "10px", borderRadius: "8px" }}>
          <p style={{ color: "#fff" }}>My Camera</p>
          <video playsInline muted ref={myVideo} autoPlay style={{ width: "300px", height: "225px", transform: "scaleX(-1)" }} />
        </div>

        <div style={{ background: "#000", padding: "10px", borderRadius: "8px" }}>
          <p style={{ color: "#fff" }}>Remote Camera</p>
          {callAccepted && !callEnded ? (
            <video playsInline ref={userVideo} autoPlay style={{ width: "300px", height: "225px" }} />
          ) : (
            <div style={{ width: "300px", height: "225px", color: "#666", display: "flex", alignItems: "center", justifyContent: "center" }}>
              Waiting for connection...
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: "30px" }}>
        <p>Your ID: <strong style={{color: 'blue'}}>{me || "Connecting..."}</strong></p>
        <input 
          placeholder="Paste ID here" 
          value={idToCall} 
          onChange={(e) => setIdToCall(e.target.value)} 
          style={{ padding: "10px", width: "250px" }}
        />
        <button onClick={() => callUser(idToCall)} style={{ padding: "10px 20px", marginLeft: "10px" }}>Call</button>
      </div>

      {receivingCall && !callAccepted && (
        <div style={{ marginTop: "20px", padding: "20px", border: "2px solid red", backgroundColor: 'white' }}>
          <h3>Incoming Call...</h3>
          <button onClick={answerCall} style={{ background: "green", color: "white", padding: "10px 30px", border: 'none', cursor: 'pointer' }}>Answer</button>
        </div>
      )}
    </div>
  );
}