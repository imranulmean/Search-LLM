import { useRef, useState } from "react";

export default function Home(){
    const [text, setText] = useState("");
    const [isRecording, setIsRecording] = useState(false);
    const mediaRecorder = useRef(null);
    const chunks = useRef([]);
    const BASE_API=import.meta.env.VITE_API_BASE_URL;
    const [loading, setLoading] = useState(false);

    const start = async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      chunks.current = [];
  
      mediaRecorder.current.ondataavailable = (e) => chunks.current.push(e.data);
      
      mediaRecorder.current.onstop = async () => {
        alert("Uploading the file")
        const audioBlob = new Blob(chunks.current, { type: 'audio/wav' });
        await uploadAndTranscribe(audioBlob);
      };
  
      mediaRecorder.current.start();
      setIsRecording(true);
    };
  
    const uploadAndTranscribe = async (blob) => {
      const formData = new FormData();
      formData.append('audio', blob, 'recording.wav');
      setLoading(true)  ;
      try {
        const res = await fetch(`${BASE_API}/transcribe`, {
          method: 'POST',
          body: formData
        });
        const data = await res.json();
        setText(data);        
      } catch (error) {
        alert(error.message);
      }finally{
        setLoading(false);
      }

    };

    const stopRecording = async()=>{
      if(isRecording){
        mediaRecorder.current.stop(); 
        setIsRecording(false);
      }
    }
    return (
      <div className="flex flex-col justify-center items-center p-4 gap-2 ">
        {/* <textarea value={text} onChange={(e) => setText(e.target.value)} /> */}
        <p>Recorded Text: {text}</p>
        {
          (!isRecording && !loading) &&
            (
              <button onClick={start}
                      className="bg-gray-900 text-white text-sm px-4 py-2 border rounded-lg"
              >
                Start Recording
              </button>
            )
        }
        {
          (isRecording && !loading) &&
            (
              <button onClick={stopRecording}
                      className="bg-green-900 text-white text-sm px-4 py-2 border rounded-lg"
              >
                Stop n Process
              </button> 
            )
        }
        {
          (!isRecording && loading) &&
            (
               <p>Your data is processing in backend</p> 
            )
        }
      </div>
    );
}