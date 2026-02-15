import { useEffect, useRef, useState } from "react";
import Peer from "simple-peer/simplepeer.min.js";

export default function Web_Peer() {
    const peer = useRef();
    const [mySignal, setMySignal] = useState("");
    const [inputSignal, setInputSignal] = useState("");
    const [status, setStatus] = useState("Choose a role");

    // Initialize Peer as either Initiator (Browser 1) or Receiver (Browser 2)
    const initPeer = (isInitiator) => {
        setStatus(isInitiator ? "Generating Offer..." : "Waiting for Offer...");
        
        peer.current = new Peer({
            initiator: isInitiator,
            trickle: false
        });

        peer.current.on('signal', data => {
            // This is the string we need to copy to the OTHER browser
            setMySignal(JSON.stringify(data));
        });

        peer.current.on('connect', () => {
            setStatus("Connected! ✅");
        });

        peer.current.on('data', data => {
            alert('Received message: ' + data);
        });
    };

    const processSignal = () => {
        console.log("Inside Process Signal")
        console.log(inputSignal)
        try {
            const jsonSignal = JSON.parse(inputSignal);
            peer.current.signal(jsonSignal);
        } catch (err) {
            alert("Invalid Signal Data!");
        }
    };

    const sendMessage = () => {
        console.log(peer.current)
        if (peer.current && peer.current.connected) {
            peer.current.send("Hello from the other browser!");
        } else {
            alert("Connection not ready! Check if status says 'Connected! ✅'");
        }
    };

    return (
        <div className="p-10 space-y-6 flex flex-col items-center border m-10 rounded-xl bg-gray-50">
            <h2 className="text-xl font-bold">WebRTC Manual Handshake</h2>
            <p className="text-blue-600 font-semibold">{status}</p>

            {/* Step 1: Role Selection */}
            {!peer.current && (
                <div className="space-x-4">
                    <button onClick={() => initPeer(true)} className="bg-blue-500 text-white p-2 rounded">I am Browser 1 (Start)</button>
                    <button onClick={() => initPeer(false)} className="bg-purple-500 text-white p-2 rounded">I am Browser 2 (Join)</button>
                </div>
            )}

            {/* Step 2: Copy your signal */}
            {mySignal && (
                <div className="w-full max-w-md">
                    <label className="block text-sm font-bold">Copy this signal and send to other browser:</label>
                    <textarea 
                        readOnly 
                        value={mySignal} 
                        className="w-full h-24 p-2 text-xs border rounded bg-white"
                        onClick={(e) => e.target.select()}
                    />
                </div>
            )}

            {/* Step 3: Paste incoming signal */}
            <div className="w-full max-w-md">
                <label className="block text-sm font-bold">Paste signal from OTHER browser here:</label>
                <textarea 
                    onChange={(e) => setInputSignal(e.target.value)} 
                    className="w-full h-24 p-2 text-xs border rounded bg-white"
                    placeholder="Paste the JSON here..."
                />
                <button onClick={processSignal} className="mt-2 w-full bg-green-500 text-white p-2 rounded">Connect</button>
            </div>

            <button onClick={sendMessage} className="bg-black text-white p-2 px-8 rounded">Send Data Message</button>
        </div>
    );
}